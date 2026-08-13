"""Render bridge tests: real subprocess, real engine, small renders."""

from __future__ import annotations

import numpy as np
import pytest

from synthmatch.bridge import RenderBridge, RenderRequest

SR = 44100
NOTE_ON_SEC = 0.02  # matches scripts/render-batch.ts


@pytest.fixture(scope="module")
def bridge():
    with RenderBridge() as b:
        yield b


def test_known_patch_renders_audio(bridge: RenderBridge) -> None:
    duration = 0.5
    result = bridge.render_one(
        RenderRequest(
            id="known",
            params={"filter_cutoff": 2000.0, "osc1_waveform": 2.0},
            note=60,
            duration_sec=duration,
            sample_rate=SR,
        )
    )
    assert result.id == "known"
    assert result.sample_rate == SR
    assert len(result.samples) == int(duration * SR)
    assert result.samples.dtype == np.float32
    # nonzero audio while the note is held
    held = result.samples[int(0.1 * SR) : int(0.3 * SR)]
    assert float(np.abs(held).max()) > 0.01
    # silence before note-on (leave one control block of slack)
    pre = result.samples[: int(NOTE_ON_SEC * SR) - 256]
    assert float(np.abs(pre).max()) == 0.0


def test_batch_preserves_order_and_ids(bridge: RenderBridge) -> None:
    reqs = [
        RenderRequest(id=f"b{i}", params={}, note=57 + i, duration_sec=0.2, sample_rate=SR)
        for i in range(5)
    ]
    results = bridge.render(reqs)
    assert [r.id for r in results] == [f"b{i}" for i in range(5)]
    for r in results:
        assert len(r.samples) == int(0.2 * SR)
        assert np.all(np.isfinite(r.samples))
        assert float(np.abs(r.samples).max()) > 0.0


def test_deterministic_renders(bridge: RenderBridge) -> None:
    req = RenderRequest(id="det", params={"filter_cutoff": 800.0}, duration_sec=0.25, sample_rate=SR)
    a = bridge.render_one(req).samples
    b = bridge.render_one(req).samples
    assert np.array_equal(a, b)
