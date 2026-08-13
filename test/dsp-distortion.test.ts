/**
 * Distortion effect (first stage of the fixed chain): THD rises with drive,
 * and mix 0 is a bit-exact passthrough (the property that keeps golden
 * renders stable while the chain sits in the signal path).
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { distortSample } from "../src/dsp/distortion";
import { magnitudeSpectrum, db } from "./harness/fft";
import { freqToMidi, safeTestFreq } from "./harness/fixtures";
import { assertFinite, assertDcOffsetBelow } from "./harness/assertions";

const SR = 48000;
const FRAME = 8192;

const SINE_PATCH: Record<string, number> = {
  osc1_waveform: 0,
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.005,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.2,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

function renderSteadyFrame(freqHz: number, extra: Record<string, number>): Float32Array {
  const settleSec = 0.25;
  const { left } = renderOffline({
    durationSec: settleSec + FRAME / SR + 0.02,
    sampleRate: SR,
    params: { ...SINE_PATCH, ...extra },
    events: [{ timeSec: 0, type: "on", note: freqToMidi(freqHz), velocity: 1 }],
  });
  const start = Math.round(settleSec * SR);
  return left.subarray(start, start + FRAME);
}

function harmonicDb(frame: Float32Array, f: number, h: number): number {
  const mags = magnitudeSpectrum(frame);
  const c = Math.round((h * f * FRAME) / SR);
  let m = 0;
  for (let k = c - 2; k <= c + 2; k += 1) m = Math.max(m, mags[k]);
  return db(m);
}

describe("distortion", () => {
  it("mix 0 is a bit-exact passthrough at any drive", () => {
    const base = renderSteadyFrame(safeTestFreq(220, FRAME, SR), {});
    const withFx = renderSteadyFrame(safeTestFreq(220, FRAME, SR), {
      distortion_drive: 1,
      distortion_mix: 0,
    });
    for (let i = 0; i < base.length; i += 1) {
      if (base[i] !== withFx[i]) {
        throw new Error(`distortion mix 0 differs at sample ${i}`);
      }
    }
  });

  it("THD rises with drive: 3rd/5th harmonics of a sine grow monotonically", () => {
    const f = safeTestFreq(330, FRAME, SR);
    const thd: number[] = [];
    for (const drive of [0.1, 0.5, 1]) {
      const frame = renderSteadyFrame(f, { distortion_drive: drive, distortion_mix: 1 });
      const fund = harmonicDb(frame, f, 1);
      const h3 = harmonicDb(frame, f, 3);
      const h5 = harmonicDb(frame, f, 5);
      thd.push(Math.max(h3, h5) - fund);
    }
    expect(thd[1]).toBeGreaterThan(thd[0] + 6);
    expect(thd[2]).toBeGreaterThan(thd[1] + 3);
    expect(thd[2]).toBeGreaterThan(-30); // full drive is audibly dirty
  });

  it("output is finite, DC-free, and bounded at full drive", () => {
    const frame = renderSteadyFrame(safeTestFreq(110, FRAME, SR), {
      distortion_drive: 1,
      distortion_mix: 1,
    });
    assertFinite(frame, "distorted");
    assertDcOffsetBelow(frame, 0.01, "distorted");
    for (let i = 0; i < frame.length; i += 1) {
      expect(Math.abs(frame[i])).toBeLessThanOrEqual(1);
    }
  });

  it("waveshaper unit: odd-symmetric, bounded, monotonic, unity at zero", () => {
    for (const drive of [0, 0.3, 0.7, 1]) {
      expect(distortSample(0, drive)).toBe(0);
      let prev = -Infinity;
      for (let x = -1.5; x <= 1.5; x += 0.05) {
        const y = distortSample(x, drive);
        expect(Math.abs(y)).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(prev); // monotonic
        expect(y).toBeCloseTo(-distortSample(-x, drive), 12); // odd symmetry
        prev = y;
      }
    }
  });
});
