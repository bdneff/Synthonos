/**
 * Direct unit tests of the TPT state variable filter: knee placement at
 * several cutoffs and sample rates, resonance peak growth, coarse HP/BP
 * shapes, and denormal-free ringdown to exact zero. White noise through the
 * whole engine is impractical (no noise source in the schema), so the module
 * is driven directly with the deterministic xorshift noise fixture.
 */

import { describe, it, expect } from "vitest";
import { Svf, svfCutoffG, resonanceToQ } from "../src/dsp/svf";
import { whiteNoise } from "./harness/fixtures";
import {
  assertLowpassCutoffNear,
  measurePeakAboveTargetDb,
  assertFinite,
  assertNoDenormals,
} from "./harness/assertions";
import { magnitudeSpectrum, binFrequency, db } from "./harness/fft";

type SvfOutput = "low" | "band" | "high";

function filterNoise(
  output: SvfOutput,
  cutoffHz: number,
  resonance: number,
  sampleRate: number,
  seconds = 4,
): Float32Array {
  const input = whiteNoise(Math.round(sampleRate * seconds));
  const out = new Float32Array(input.length);
  const svf = new Svf();
  const g = svfCutoffG(cutoffHz, sampleRate);
  const k = 1 / resonanceToQ(resonance);
  for (let i = 0; i < input.length; i += 1) {
    svf.tick(input[i], g, k);
    out[i] = output === "low" ? svf.low : output === "band" ? svf.band : svf.high;
  }
  return out;
}

/** Average magnitude (linear) in a frequency band of an averaged spectrum. */
function bandLevelDb(
  signal: Float32Array,
  fromHz: number,
  toHz: number,
  sampleRate: number,
  frameSize = 4096,
): number {
  const frames = Math.floor(signal.length / frameSize);
  const power = new Float64Array(frameSize / 2 + 1);
  for (let f = 0; f < frames; f += 1) {
    const mags = magnitudeSpectrum(signal.subarray(f * frameSize, (f + 1) * frameSize));
    for (let k = 0; k < power.length; k += 1) power[k] += mags[k] * mags[k];
  }
  let sum = 0;
  let count = 0;
  for (let k = 1; k < power.length; k += 1) {
    const freq = binFrequency(k, frameSize, sampleRate);
    if (freq < fromHz || freq > toHz) continue;
    sum += power[k] / frames;
    count += 1;
  }
  if (count === 0) throw new Error("bandLevelDb: empty band");
  return db(Math.sqrt(sum / count));
}

describe("SVF lowpass knee", () => {
  it("lands within tolerance at 500, 2000, and 8000 Hz (48 kHz)", () => {
    for (const cutoff of [500, 2000, 8000]) {
      const filtered = filterNoise("low", cutoff, 0, 48000);
      assertLowpassCutoffNear(filtered, cutoff, { sampleRate: 48000 }, `lp ${cutoff}`);
    }
  });

  it("is sample-rate independent (44100 and 96000)", () => {
    for (const sr of [44100, 96000]) {
      const filtered = filterNoise("low", 2000, 0, sr);
      assertLowpassCutoffNear(filtered, 2000, { sampleRate: sr }, `lp 2000 @ ${sr}`);
    }
  });
});

describe("SVF resonance", () => {
  it("peak at the cutoff rises monotonically with the resonance param", () => {
    const peaks = [0, 0.3, 0.6, 0.9].map((r) =>
      measurePeakAboveTargetDb(filterNoise("low", 2000, r, 48000), 2000, {
        sampleRate: 48000,
      }),
    );
    for (let i = 1; i < peaks.length; i += 1) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1] + 1);
    }
    expect(peaks[0]).toBeLessThan(3);
    expect(peaks[3]).toBeGreaterThan(10);
  });

  it("maps resonance 0 to a Butterworth Q and 1 to a strong musical Q", () => {
    expect(resonanceToQ(0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(resonanceToQ(1)).toBeCloseTo(20, 1);
  });
});

describe("SVF highpass and bandpass shapes", () => {
  it("highpass at 2 kHz suppresses lows and passes highs", () => {
    const filtered = filterNoise("high", 2000, 0, 48000);
    const lowBand = bandLevelDb(filtered, 100, 800, 48000);
    const highBand = bandLevelDb(filtered, 4000, 12000, 48000);
    expect(highBand - lowBand).toBeGreaterThan(20);
  });

  it("bandpass at 2 kHz peaks at the center and falls off both sides", () => {
    const filtered = filterNoise("band", 2000, 0.5, 48000);
    const center = bandLevelDb(filtered, 1600, 2500, 48000);
    const below = bandLevelDb(filtered, 100, 400, 48000);
    const above = bandLevelDb(filtered, 8000, 16000, 48000);
    expect(center - below).toBeGreaterThan(15);
    expect(center - above).toBeGreaterThan(15);
  });
});

describe("SVF state hygiene", () => {
  it("rings down to exact zero with no denormals after an impulse", () => {
    const sr = 48000;
    const svf = new Svf();
    const g = svfCutoffG(200, sr);
    const k = 1 / resonanceToQ(0.9);
    const out = new Float32Array(sr * 2);
    for (let i = 0; i < out.length; i += 1) {
      svf.tick(i === 0 ? 1 : 0, g, k);
      out[i] = svf.low;
    }
    assertFinite(out, "ringdown");
    assertNoDenormals(out, "ringdown");
    expect(out[out.length - 1]).toBe(0);
  });

  it("stays finite and stable at extreme settings", () => {
    for (const [cutoff, res] of [
      [20, 1],
      [20000, 1],
      [20000, 0],
    ] as const) {
      const filtered = filterNoise("low", cutoff, res, 48000, 1);
      assertFinite(filtered, `lp ${cutoff} res ${res}`);
    }
  });
});
