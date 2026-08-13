"""Tier 2 parameter search: differential evolution over the schema space.

The optimizer works in the unit cube [0, 1]^n_free (log dims traverse
geometrically, see params.py) and evaluates whole populations at once:
scipy's ``vectorized=True`` interface hands the objective the full
population matrix, which we route through ONE render-batch call per
generation via the persistent bridge. Node startup is paid once per search,
not once per candidate.

Tier stubs (see SYNTH_BUILD_PLAN.md section 4):

- ``tier1_retrieval_initial_guess`` is a stub. Tier 1 nearest-neighbor
  retrieval needs the factory preset bank, which does not exist yet
  (Phase 3). When it lands, its result seeds ``x0`` here.
- ``tier3_learned_inverse_initial_guess`` is a stub. The learned inverse
  (Sound2Synth / InverSynth style) would replace tier 1 as the initializer.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from scipy.optimize import differential_evolution

from .bridge import RenderBridge, RenderRequest
from .loss import multi_resolution_stft_loss, resample_to
from .params import ParamSpace

DEFAULT_RENDER_SAMPLE_RATE = 44100
# master_volume only scales loudness; leaving it free wastes a dimension and
# lets the optimizer trade loudness against timbre. Fixed to default.
DEFAULT_FIXED_TO_DEFAULT: tuple[str, ...] = ("master_volume",)


@dataclass
class MatchResult:
    params_engine: dict[str, float]
    params_preset: dict[str, float | int | str]
    loss: float
    initial_median_loss: float
    history: list[dict[str, float]] = field(default_factory=list)
    n_renders: int = 0
    wall_seconds: float = 0.0


ProgressCallback = Callable[[dict[str, float]], None]


def tier1_retrieval_initial_guess(
    target: np.ndarray, sample_rate: int
) -> dict[str, float] | None:
    """STUB. Tier 1: nearest-neighbor retrieval over the factory preset bank.

    TODO(tier-1): render the factory preset bank (does not exist yet, Phase
    3) across a few notes, extract feature vectors (mel statistics, MFCCs,
    spectral centroid/flux, attack time, ...), and return the closest
    preset's engine params as the search initializer.
    """
    return None


def tier3_learned_inverse_initial_guess(
    target: np.ndarray, sample_rate: int
) -> dict[str, float] | None:
    """STUB. Tier 3: learned inverse model (Sound2Synth / InverSynth).

    TODO(tier-3): train a network on randomly sampled renders mapping mel
    spectrogram -> parameter vector, and use its prediction as x0 for the
    tier 2 search.
    """
    return None


def match_audio(
    target: np.ndarray,
    target_sample_rate: int,
    *,
    note: int = 60,
    duration_sec: float | None = None,
    space: ParamSpace | None = None,
    bridge: RenderBridge | None = None,
    free_dims: list[str] | None = None,
    fixed_params: dict[str, float] | None = None,
    maxiter: int = 20,
    popsize: int = 4,
    seed: int | None = None,
    render_sample_rate: int = DEFAULT_RENDER_SAMPLE_RATE,
    progress: ProgressCallback | None = None,
) -> MatchResult:
    """Find the patch in the engine's parameter space closest to ``target``.

    ``target`` is mono float audio at ``target_sample_rate``; it is
    resampled to ``render_sample_rate`` once up front. ``free_dims`` limits
    the search to a subset of parameter ids (all others are fixed to
    ``fixed_params`` overrides, falling back to schema defaults);
    None searches every dimension except DEFAULT_FIXED_TO_DEFAULT.

    Budget: scipy's population size is popsize * n_free (rounded up to a
    power of 2 by init='sobol'), and each generation is one render batch of
    that size. Defaults land a full-space search in the tens of seconds.
    ``seed`` makes the search deterministic.
    """
    t0 = time.monotonic()
    space = space or ParamSpace()
    own_bridge = bridge is None
    bridge = bridge or RenderBridge(space.root)

    target = np.asarray(target, dtype=np.float64).ravel()
    target = resample_to(target, target_sample_rate, render_sample_rate)
    if duration_sec is None:
        duration_sec = len(target) / render_sample_rate
    duration_sec = float(duration_sec)
    n_target = int(round(duration_sec * render_sample_rate))
    target = target[:n_target]

    if free_dims is None:
        free_dims = [d for d in space.order if d not in DEFAULT_FIXED_TO_DEFAULT]
    unknown = set(free_dims) - set(space.index)
    if unknown:
        raise KeyError(f"unknown free_dims: {sorted(unknown)}")
    free_idx = [space.index[d] for d in free_dims]

    base_engine = space.defaults_engine()
    for pid, value in (fixed_params or {}).items():
        if pid not in space.index:
            raise KeyError(f"unknown fixed param: {pid}")
        base_engine[pid] = float(value)
    base_u = space.encode(base_engine)

    renders_at_start = bridge.renders_completed
    history: list[dict[str, float]] = []
    initial_median: float | None = None
    generation = 0

    def objective(x: np.ndarray) -> np.ndarray | float:
        nonlocal initial_median, generation
        single = x.ndim == 1
        pop = x[:, None] if single else x  # shape (n_free, S)
        n_candidates = pop.shape[1]

        requests = []
        for s in range(n_candidates):
            u = base_u.copy()
            u[free_idx] = pop[:, s]
            engine_params = space.decode(u)
            requests.append(
                RenderRequest(
                    id=f"g{generation}c{s}",
                    params=engine_params,
                    note=note,
                    duration_sec=duration_sec,
                    sample_rate=render_sample_rate,
                )
            )
        results = bridge.render(requests)
        losses = np.array(
            [
                multi_resolution_stft_loss(r.samples, target)
                for r in results
            ]
        )

        if initial_median is None:
            initial_median = float(np.median(losses))
        entry = {
            "generation": float(generation),
            "best_loss": float(losses.min()),
            "median_loss": float(np.median(losses)),
            "renders": float(bridge.renders_completed - renders_at_start),
            "elapsed_sec": time.monotonic() - t0,
        }
        history.append(entry)
        if progress is not None:
            progress(entry)
        generation += 1
        return float(losses[0]) if single else losses

    try:
        result = differential_evolution(
            objective,
            bounds=[(0.0, 1.0)] * len(free_dims),
            vectorized=True,
            updating="deferred",
            init="sobol",
            maxiter=maxiter,
            popsize=popsize,
            seed=seed,
            polish=False,
            tol=1e-8,  # run the full budget; the budget IS the stop condition
        )

        best_u = base_u.copy()
        best_u[free_idx] = result.x
        best_engine = space.decode(best_u)
        # Re-render the decoded best (rounded ints/enums) for an honest loss.
        final = bridge.render_one(
            RenderRequest(
                id="final",
                params=best_engine,
                note=note,
                duration_sec=duration_sec,
                sample_rate=render_sample_rate,
            )
        )
        final_loss = multi_resolution_stft_loss(final.samples, target)
        return MatchResult(
            params_engine=best_engine,
            params_preset=space.to_preset(best_engine),
            loss=final_loss,
            initial_median_loss=initial_median if initial_median is not None else float("nan"),
            history=history,
            n_renders=bridge.renders_completed - renders_at_start,
            wall_seconds=time.monotonic() - t0,
        )
    finally:
        if own_bridge:
            bridge.close()
