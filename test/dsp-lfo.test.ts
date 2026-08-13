/**
 * LFO tests: deterministic sample-and-hold, rate accuracy, slew-limited
 * discontinuous shapes, and click-free modulation of every routing target
 * through the full engine.
 */

import { describe, it, expect } from "vitest";
import { Lfo } from "../src/dsp/lfo";
import {
  LFO_WAVE_SINE,
  LFO_WAVE_SQUARE,
  LFO_WAVE_SAMPLE_HOLD,
} from "../src/dsp/constants";
import { renderOffline } from "./harness/render";
import {
  assertFinite,
  assertNoDenormals,
  assertNoClicks,
} from "./harness/assertions";

const SR = 48000;

describe("LFO unit behavior", () => {
  it("is deterministic: two instances produce identical sample_hold output", () => {
    const a = new Lfo(SR);
    const b = new Lfo(SR);
    a.setWaveform(LFO_WAVE_SAMPLE_HOLD);
    b.setWaveform(LFO_WAVE_SAMPLE_HOLD);
    for (let i = 0; i < 50000; i += 1) {
      const va = a.tick(7);
      const vb = b.tick(7);
      if (va !== vb) throw new Error(`sample_hold diverged at sample ${i}`);
    }
  });

  it("sine rate is accurate (zero crossing count over 10 s at 2 Hz)", () => {
    const lfo = new Lfo(SR);
    lfo.setWaveform(LFO_WAVE_SINE);
    let prev = lfo.tick(2);
    let risingCrossings = 0;
    for (let i = 1; i < SR * 10; i += 1) {
      const v = lfo.tick(2);
      if (prev <= 0 && v > 0) risingCrossings += 1;
      prev = v;
    }
    expect(risingCrossings).toBeGreaterThanOrEqual(19);
    expect(risingCrossings).toBeLessThanOrEqual(21);
  });

  it("square output is slew-limited so it cannot step a gain hard", () => {
    const lfo = new Lfo(SR);
    lfo.setWaveform(LFO_WAVE_SQUARE);
    let prev = lfo.tick(5);
    let worstStep = 0;
    for (let i = 1; i < SR * 2; i += 1) {
      const v = lfo.tick(5);
      worstStep = Math.max(worstStep, Math.abs(v - prev));
      prev = v;
    }
    expect(worstStep).toBeLessThan(0.06);
    expect(worstStep).toBeGreaterThan(0.001); // it does move
  });

  it("sample_hold stays in [-1, 1] and holds between steps", () => {
    const lfo = new Lfo(SR);
    lfo.setWaveform(LFO_WAVE_SAMPLE_HOLD);
    const out = new Float64Array(SR); // one second at 4 Hz = 4 segments
    for (let i = 0; i < out.length; i += 1) out[i] = lfo.tick(4);
    for (let i = 0; i < out.length; i += 1) {
      expect(Math.abs(out[i])).toBeLessThanOrEqual(1);
    }
    // Once the slew settles inside a hold segment the value is constant.
    const mid = out[Math.round(SR * 0.22)];
    const late = out[Math.round(SR * 0.245)];
    expect(Math.abs(late - mid)).toBeLessThan(1e-6);
  });
});

describe("LFO through the engine", () => {
  function renderWithLfo(target: number, wave: number, extra: Record<string, number> = {}) {
    return renderOffline({
      durationSec: 1.2,
      sampleRate: SR,
      params: {
        lfo_target: target,
        lfo_waveform: wave,
        lfo_rate: 6,
        lfo_depth: 1,
        amp_sustain: 0.8,
        ...extra,
      },
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.9, type: "off", note: 60 },
      ],
    });
  }

  it("square tremolo (amp target) does not click", () => {
    const { left, right } = renderWithLfo(3, LFO_WAVE_SQUARE);
    for (const [buf, label] of [
      [left, "left"],
      [right, "right"],
    ] as const) {
      assertFinite(buf, label);
      assertNoDenormals(buf, label);
      assertNoClicks(buf, 0.25, label);
    }
  });

  it("sample_hold auto-pan does not click", () => {
    const { left, right } = renderWithLfo(4, LFO_WAVE_SAMPLE_HOLD, { lfo_rate: 8 });
    assertNoClicks(left, 0.25, "left");
    assertNoClicks(right, 0.25, "right");
  });

  it("sample_hold cutoff wobble at high resonance stays finite and denormal-free", () => {
    const { left, right } = renderWithLfo(1, LFO_WAVE_SAMPLE_HOLD, {
      filter_resonance: 0.9,
      filter_cutoff: 1500,
      lfo_rate: 8,
    });
    for (const [buf, label] of [
      [left, "left"],
      [right, "right"],
    ] as const) {
      assertFinite(buf, label);
      assertNoDenormals(buf, label);
      assertNoClicks(buf, 0.25, label);
    }
  });

  it("pitch vibrato stays finite and click-free", () => {
    const { left, right } = renderWithLfo(2, LFO_WAVE_SINE, { lfo_depth: 0.5 });
    assertFinite(left, "left");
    assertNoClicks(left, 0.25, "left");
    assertFinite(right, "right");
    assertNoClicks(right, 0.25, "right");
  });

  it("tremolo actually modulates the amplitude", () => {
    const audio = renderWithLfo(3, LFO_WAVE_SINE, { lfo_rate: 4, lfo_depth: 1 });
    // Compare short-window RMS across the sustain: with a 4 Hz full-depth
    // tremolo the loudest 50 ms window is much louder than the quietest.
    const win = Math.round(0.05 * SR);
    let min = Infinity;
    let max = 0;
    for (let start = Math.round(0.3 * SR); start + win < Math.round(0.85 * SR); start += win) {
      let sum = 0;
      for (let i = start; i < start + win; i += 1) sum += audio.left[i] * audio.left[i];
      const r = Math.sqrt(sum / win);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(max).toBeGreaterThan(min * 2);
  });
});
