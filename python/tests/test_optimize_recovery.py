"""The key test: render a target with known params, then recover it.

Target: saw, cutoff 2000 Hz, resonance 0.4, single note. The search frees
only cutoff, resonance, osc1_waveform and amp_attack; everything else is
fixed to the target's values. Small budget, fixed seed. Convergence is
asserted as: final loss well below the initial-population median, and the
recovered cutoff within an octave of the truth.
"""

from __future__ import annotations

import numpy as np
import pytest

from synthmatch.bridge import RenderBridge, RenderRequest
from synthmatch.optimize import match_audio
from synthmatch.params import ParamSpace

SR = 44100
NOTE = 60
DURATION = 0.5
SEED = 1234

TRUE_PARAMS = {
    "osc1_waveform": 2.0,  # saw
    "filter_cutoff": 2000.0,
    "filter_resonance": 0.4,
}
FREE_DIMS = ["filter_cutoff", "filter_resonance", "osc1_waveform", "amp_attack"]


@pytest.mark.slow
def test_small_search_recovers_known_patch() -> None:
    space = ParamSpace()
    with RenderBridge(space.root) as bridge:
        # Fix everything the search does not touch to the target's values.
        fixed = space.defaults_engine()
        fixed.update(TRUE_PARAMS)

        target = bridge.render_one(
            RenderRequest(
                id="target", params=fixed, note=NOTE, duration_sec=DURATION, sample_rate=SR
            )
        )
        assert float(np.abs(target.samples).max()) > 0.01

        result = match_audio(
            target.samples.astype(np.float64),
            SR,
            note=NOTE,
            duration_sec=DURATION,
            space=space,
            bridge=bridge,
            free_dims=FREE_DIMS,
            fixed_params=fixed,
            maxiter=12,
            popsize=8,  # population = 8 * 4 dims -> 32 (sobol power of 2)
            seed=SEED,
            render_sample_rate=SR,
        )

    assert np.isfinite(result.loss)
    assert result.initial_median_loss > 0.0
    # Converged well below where a random population starts.
    assert result.loss < 0.15 * result.initial_median_loss, (
        f"final loss {result.loss:.4f} vs initial median "
        f"{result.initial_median_loss:.4f}"
    )
    # Recovered cutoff within an octave of the truth.
    cutoff = result.params_engine["filter_cutoff"]
    assert 1000.0 <= cutoff <= 4000.0, f"recovered cutoff {cutoff:.1f} Hz"
    # Waveform recovered exactly (it dominates the spectrum).
    assert result.params_preset["osc1_waveform"] == "saw"
    # History is usable for progress streaming and improves overall.
    assert len(result.history) >= 2
    assert result.history[-1]["best_loss"] <= result.history[0]["best_loss"]


def test_search_is_deterministic_with_seed() -> None:
    """Two tiny runs with the same seed produce identical best params."""
    space = ParamSpace()
    with RenderBridge(space.root) as bridge:
        fixed = space.defaults_engine()
        fixed.update(TRUE_PARAMS)
        target = bridge.render_one(
            RenderRequest(
                id="target", params=fixed, note=NOTE, duration_sec=0.3, sample_rate=SR
            )
        )
        runs = [
            match_audio(
                target.samples.astype(np.float64),
                SR,
                note=NOTE,
                duration_sec=0.3,
                space=space,
                bridge=bridge,
                free_dims=["filter_cutoff", "filter_resonance"],
                fixed_params=fixed,
                maxiter=2,
                popsize=4,
                seed=42,
                render_sample_rate=SR,
            )
            for _ in range(2)
        ]
    assert runs[0].params_engine == runs[1].params_engine
    assert runs[0].loss == pytest.approx(runs[1].loss)
