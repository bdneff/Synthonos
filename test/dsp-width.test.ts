/**
 * master_width: mid/side scaling after the effects chain, before master
 * volume. 0 collapses to exact mono (L == R sample for sample), 1 is a
 * bit-exact passthrough (the transform is skipped entirely at width 1),
 * 2 exaggerates the side signal.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";

const SR = 48000;

/** A patch with genuine stereo content: wide unison + oscillator pans. */
const STEREO_PATCH: Record<string, number> = {
  osc1_waveform: 2,
  osc1_unison_voices: 6,
  osc1_unison_detune: 35,
  osc1_level: 0.7,
  osc2_level: 0.4,
  osc2_waveform: 3,
  osc2_pan: 0.7,
  osc1_pan: -0.3,
  amp_attack: 0.005,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.1,
  amp_velocity: 0,
  master_volume: 0.7,
};

function renderWidth(width: number) {
  return renderOffline({
    durationSec: 0.8,
    sampleRate: SR,
    params: { ...STEREO_PATCH, master_width: width },
    events: [
      { timeSec: 0.02, type: "on", note: 57, velocity: 1 },
      { timeSec: 0.7, type: "off", note: 57 },
    ],
  });
}

function sideEnergy(l: Float32Array, r: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    const s = (l[i] - r[i]) * 0.5;
    sum += s * s;
  }
  return sum;
}

describe("master_width", () => {
  const from = Math.round(0.2 * SR);
  const to = Math.round(0.65 * SR);

  it("width 0 collapses to exact mono: L == R sample for sample", () => {
    const { left, right } = renderWidth(0);
    let any = false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        throw new Error(`width 0 differs at sample ${i}: ${left[i]} vs ${right[i]}`);
      }
      if (left[i] !== 0) any = true;
    }
    expect(any).toBe(true); // still sounding, just mono
  });

  it("width 1 is a bit-exact passthrough of the unmodified image", () => {
    const a = renderWidth(1);
    const b = renderOffline({
      durationSec: 0.8,
      sampleRate: SR,
      params: STEREO_PATCH, // width left at its schema default of 1
      events: [
        { timeSec: 0.02, type: "on", note: 57, velocity: 1 },
        { timeSec: 0.7, type: "off", note: 57 },
      ],
    });
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`width 1 differs at sample ${i}`);
      }
    }
    // The source patch actually has side content to preserve.
    expect(sideEnergy(a.left, a.right, from, to)).toBeGreaterThan(1e-6);
  });

  it("width 2 increases side energy; width 0.5 decreases it", () => {
    const unit = renderWidth(1);
    const wide = renderWidth(2);
    const narrow = renderWidth(0.5);
    const sUnit = sideEnergy(unit.left, unit.right, from, to);
    const sWide = sideEnergy(wide.left, wide.right, from, to);
    const sNarrow = sideEnergy(narrow.left, narrow.right, from, to);
    expect(sWide).toBeGreaterThan(sUnit * 2); // ~4x in energy for 2x side gain
    expect(sNarrow).toBeLessThan(sUnit * 0.5);
  });

  it("width changes leave the mid (mono sum) untouched", () => {
    const unit = renderWidth(1);
    const wide = renderWidth(2);
    for (let i = 0; i < unit.left.length; i += 1) {
      const midUnit = (unit.left[i] + unit.right[i]) * 0.5;
      const midWide = (wide.left[i] + wide.right[i]) * 0.5;
      if (Math.abs(midUnit - midWide) > 1e-6) {
        throw new Error(`mid changed at sample ${i}: ${midUnit} vs ${midWide}`);
      }
    }
  });
});
