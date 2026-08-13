"""Parameter space codec for the audio-match optimizer.

Loads the generated optimizer bounds (src/generated/optimizer-bounds.json)
and the schema (params.schema.json) and converts between:

- the optimizer's continuous unit vector in [0, 1]^N,
- engine-unit parameter dicts (numbers only, enums as indices), which is
  what the render bridge and the engine consume,
- preset-format parameter dicts (enums as option name strings), which is
  what the API returns and preset files store.

Traversal rules, matching how the UI knobs and the codegen treat `curve`:

- ``log`` dimensions traverse the range geometrically: u = 0.5 lands at the
  geometric mean of the bounds, so an octave of cutoff takes the same amount
  of unit-space everywhere. All log dimensions in the schema have positive
  lower bounds.
- ``int`` and ``enum`` dimensions round to the nearest integer and clamp.
- everything else is linear.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np


def find_repo_root(start: Path | None = None) -> Path:
    """Walk upward until params.schema.json is found. Raises if it is not."""
    p = (start or Path(__file__)).resolve()
    for candidate in [p, *p.parents]:
        if (candidate / "params.schema.json").is_file():
            return candidate
    raise FileNotFoundError(
        "could not locate the Synthonos repo root (params.schema.json) above "
        f"{p}; pass root= explicitly or set cwd inside the repo"
    )


@dataclass(frozen=True)
class Dim:
    """One dimension of the optimizer's parameter space."""

    id: str
    lo: float
    hi: float
    type: str  # "float" | "int" | "enum"
    curve: str  # "linear" | "log"
    default: float  # engine units


class ParamSpace:
    """Encode/decode between unit vectors, engine dicts, and preset dicts."""

    def __init__(self, root: Path | None = None) -> None:
        if root is None:
            root = find_repo_root()
        if not (root / "params.schema.json").is_file():
            raise FileNotFoundError(f"{root} does not look like the Synthonos repo root")
        self.root = root
        bounds_path = self.root / "src" / "generated" / "optimizer-bounds.json"
        schema_path = self.root / "params.schema.json"
        with bounds_path.open() as f:
            bounds = json.load(f)
        with schema_path.open() as f:
            self.schema: dict[str, dict] = json.load(f)["params"]

        self.dims: list[Dim] = [
            Dim(
                id=pid,
                lo=float(lo),
                hi=float(hi),
                type=ptype,
                curve=curve,
                default=float(default),
            )
            for pid, (lo, hi), ptype, curve, default in zip(
                bounds["order"], bounds["bounds"], bounds["type"], bounds["curve"], bounds["default"], strict=True
            )
        ]
        self.order: list[str] = [d.id for d in self.dims]
        self.index: dict[str, int] = {d.id: i for i, d in enumerate(self.dims)}
        for d in self.dims:
            if d.curve == "log" and d.lo <= 0:
                raise ValueError(f"log-curve dim {d.id} has non-positive lower bound {d.lo}")

    @property
    def n(self) -> int:
        return len(self.dims)

    # -- unit vector <-> engine units ------------------------------------

    def decode(self, u: np.ndarray) -> dict[str, float]:
        """Unit vector in [0,1]^N -> engine-unit parameter dict."""
        u = np.asarray(u, dtype=np.float64)
        if u.shape != (self.n,):
            raise ValueError(f"expected shape ({self.n},), got {u.shape}")
        out: dict[str, float] = {}
        for d, ui in zip(self.dims, u, strict=True):
            ui = float(min(1.0, max(0.0, ui)))
            if d.curve == "log":
                v = d.lo * (d.hi / d.lo) ** ui
            else:
                v = d.lo + ui * (d.hi - d.lo)
            if d.type in ("int", "enum"):
                v = float(min(d.hi, max(d.lo, round(v))))
            out[d.id] = v
        return out

    def encode(self, engine_params: dict[str, float]) -> np.ndarray:
        """Engine-unit parameter dict -> unit vector. Missing ids use defaults."""
        unknown = set(engine_params) - set(self.index)
        if unknown:
            raise KeyError(f"unknown parameter ids: {sorted(unknown)}")
        u = np.empty(self.n, dtype=np.float64)
        for i, d in enumerate(self.dims):
            v = float(engine_params.get(d.id, d.default))
            if not (d.lo <= v <= d.hi):
                raise ValueError(f"{d.id}={v} outside bounds [{d.lo}, {d.hi}]")
            if d.curve == "log":
                u[i] = math.log(v / d.lo) / math.log(d.hi / d.lo)
            else:
                u[i] = (v - d.lo) / (d.hi - d.lo) if d.hi > d.lo else 0.0
        return u

    # -- engine units <-> preset format ----------------------------------

    def to_preset(self, engine_params: dict[str, float]) -> dict[str, float | int | str]:
        """Engine-unit dict -> preset-format dict (enums as option strings)."""
        out: dict[str, float | int | str] = {}
        for d in self.dims:
            v = float(engine_params.get(d.id, d.default))
            if d.type == "enum":
                values = self.schema[d.id]["values"]
                idx = int(min(d.hi, max(d.lo, round(v))))
                out[d.id] = values[idx]
            elif d.type == "int":
                out[d.id] = int(round(v))
            else:
                out[d.id] = v
        return out

    def from_preset(self, preset_params: dict[str, float | int | str]) -> dict[str, float]:
        """Preset-format dict -> engine-unit dict. Missing ids use defaults."""
        out: dict[str, float] = {}
        for d in self.dims:
            if d.id not in preset_params:
                out[d.id] = d.default
                continue
            v = preset_params[d.id]
            if d.type == "enum":
                values = list(self.schema[d.id]["values"])
                if not isinstance(v, str) or v not in values:
                    raise ValueError(f"{d.id}: expected one of {values}, got {v!r}")
                out[d.id] = float(values.index(v))
            else:
                out[d.id] = float(v)  # type: ignore[arg-type]
        return out

    def defaults_engine(self) -> dict[str, float]:
        return {d.id: d.default for d in self.dims}
