"""ParamSpace codec tests: round trips, log traversal, int/enum handling."""

from __future__ import annotations

import math

import numpy as np
import pytest

from synthmatch.params import ParamSpace


@pytest.fixture(scope="module")
def space() -> ParamSpace:
    return ParamSpace()


def test_dimension_count_matches_generated_bounds(space: ParamSpace) -> None:
    # The schema is the single source of truth; derive the expected count
    # from it instead of pinning a number that grows with every phase.
    import json
    from pathlib import Path

    schema = json.loads(
        (Path(__file__).resolve().parents[2] / "params.schema.json").read_text()
    )
    assert space.n == len(space.order) == len(schema["params"])
    assert space.order[0] == "osc1_waveform"
    assert "filter_cutoff" in space.index


def test_round_trip_defaults(space: ParamSpace) -> None:
    defaults = space.defaults_engine()
    u = space.encode(defaults)
    assert u.shape == (space.n,)
    assert np.all((u >= 0.0) & (u <= 1.0))
    decoded = space.decode(u)
    for pid, v in defaults.items():
        assert decoded[pid] == pytest.approx(v, rel=1e-9, abs=1e-9), pid


def test_round_trip_arbitrary_vector(space: ParamSpace) -> None:
    rng = np.random.default_rng(7)
    u = rng.random(space.n)
    engine = space.decode(u)
    u2 = space.encode(engine)
    engine2 = space.decode(u2)
    # decode -> encode -> decode is a fixed point (rounding already applied).
    for pid in space.order:
        assert engine2[pid] == pytest.approx(engine[pid], rel=1e-9, abs=1e-9), pid


def test_log_dims_traverse_log_space(space: ParamSpace) -> None:
    u = np.full(space.n, 0.5)
    engine = space.decode(u)
    for d in space.dims:
        if d.curve == "log" and d.type == "float":
            geometric_mean = math.sqrt(d.lo * d.hi)
            assert engine[d.id] == pytest.approx(geometric_mean, rel=1e-9), d.id
    # concrete anchor: cutoff [20, 20000] midpoint is ~632.5 Hz, not 10010 Hz
    assert engine["filter_cutoff"] == pytest.approx(math.sqrt(20 * 20000), rel=1e-9)
    assert engine["filter_cutoff"] < 1000


def test_enums_decode_to_valid_option_strings(space: ParamSpace) -> None:
    rng = np.random.default_rng(11)
    for _ in range(20):
        engine = space.decode(rng.random(space.n))
        preset = space.to_preset(engine)
        for d in space.dims:
            if d.type == "enum":
                values = space.schema[d.id]["values"]
                assert preset[d.id] in values, d.id
                # engine value is the exact index of that option
                assert engine[d.id] == values.index(preset[d.id]), d.id


def test_ints_are_ints(space: ParamSpace) -> None:
    rng = np.random.default_rng(13)
    engine = space.decode(rng.random(space.n))
    preset = space.to_preset(engine)
    for d in space.dims:
        if d.type in ("int", "enum"):
            assert float(engine[d.id]).is_integer(), d.id
        if d.type == "int":
            assert isinstance(preset[d.id], int), d.id
            assert d.lo <= preset[d.id] <= d.hi, d.id


def test_decode_extremes_hit_bounds(space: ParamSpace) -> None:
    lo = space.decode(np.zeros(space.n))
    hi = space.decode(np.ones(space.n))
    for d in space.dims:
        assert lo[d.id] == pytest.approx(d.lo), d.id
        assert hi[d.id] == pytest.approx(d.hi), d.id


def test_preset_round_trip(space: ParamSpace) -> None:
    engine = space.decode(np.random.default_rng(3).random(space.n))
    preset = space.to_preset(engine)
    back = space.from_preset(preset)
    for pid in space.order:
        assert back[pid] == pytest.approx(engine[pid], rel=1e-9, abs=1e-9), pid


def test_encode_rejects_unknown_and_out_of_bounds(space: ParamSpace) -> None:
    with pytest.raises(KeyError):
        space.encode({"no_such_param": 1.0})
    with pytest.raises(ValueError):
        space.encode({"filter_cutoff": 99999.0})
