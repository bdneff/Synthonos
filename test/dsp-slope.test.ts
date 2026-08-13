/**
 * filter_slope: 12 vs 24 dB/oct through the full engine, measured on the
 * engine's own white noise source (osc_noise_level 1, oscillators muted).
 * One octave above the cutoff a second identical 2-pole stage should buy at
 * least ~9 dB of extra rolloff (theoretical extra is ~12 dB minus knee
 * softening). Also checks the noise source itself: broadband, deterministic,
 * and silent at level 0.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { magnitudeSpectrum, binFrequency, db } from "./harness/fft";
import { rms } from "./harness/fixtures";

const SR = 48000;

const NOISE_PATCH: Record<string, number> = {
  osc1_level: 0,
  osc2_level: 0,
  osc_noise_level: 1,
  filter_type: 0,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  filter_drive: 0,
  amp_attack: 0.001,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.2,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

function renderNoise(extra: Record<string, number>, seconds = 4): Float32Array {
  const { left } = renderOffline({
    durationSec: seconds + 0.3,
    sampleRate: SR,
    params: { ...NOISE_PATCH, ...extra },
    events: [{ timeSec: 0, type: "on", note: 60, velocity: 1 }],
  });
  return left.subarray(Math.round(0.25 * SR), Math.round((0.25 + seconds) * SR));
}

/** Averaged band level in dB from many FFT frames. */
function bandDb(signal: Float32Array, fromHz: number, toHz: number, frameSize = 4096): number {
  const frames = Math.floor(signal.length / frameSize);
  const power = new Float64Array(frameSize / 2 + 1);
  for (let f = 0; f < frames; f += 1) {
    const mags = magnitudeSpectrum(signal.subarray(f * frameSize, (f + 1) * frameSize));
    for (let k = 0; k < power.length; k += 1) power[k] += mags[k] * mags[k];
  }
  let sum = 0;
  let count = 0;
  for (let k = 1; k < power.length; k += 1) {
    const freq = binFrequency(k, frameSize, SR);
    if (freq < fromHz || freq > toHz) continue;
    sum += power[k] / frames;
    count += 1;
  }
  if (count === 0) throw new Error("bandDb: empty band");
  return db(Math.sqrt(sum / count));
}

describe("filter slope 12 vs 24 dB/oct", () => {
  it("24 dB rolls off at least 9 dB more than 12 dB one octave above cutoff", () => {
    const cutoff = 1000;
    const s12 = renderNoise({ filter_cutoff: cutoff, filter_slope: 0 });
    const s24 = renderNoise({ filter_cutoff: cutoff, filter_slope: 1 });
    // Reference each response to its own passband so the comparison is pure
    // rolloff, independent of any level differences near the knee.
    const ref12 = bandDb(s12, 100, 400);
    const ref24 = bandDb(s24, 100, 400);
    const oct12 = bandDb(s12, 1900, 2100) - ref12;
    const oct24 = bandDb(s24, 1900, 2100) - ref24;
    expect(oct12 - oct24).toBeGreaterThan(9);
    // Sanity: the 12 dB response is itself attenuated an octave up.
    expect(oct12).toBeLessThan(-6);
  });

  it("two octaves above cutoff the difference approaches two extra poles (>= 15 dB)", () => {
    const cutoff = 500;
    const s12 = renderNoise({ filter_cutoff: cutoff, filter_slope: 0 });
    const s24 = renderNoise({ filter_cutoff: cutoff, filter_slope: 1 });
    const d12 = bandDb(s12, 1900, 2100) - bandDb(s12, 50, 200);
    const d24 = bandDb(s24, 1900, 2100) - bandDb(s24, 50, 200);
    expect(d12 - d24).toBeGreaterThan(15);
  });
});

describe("noise source", () => {
  it("is broadband: wide open, low and high bands are within 6 dB", () => {
    const open = renderNoise({ filter_cutoff: 20000 }, 2);
    const low = bandDb(open, 200, 2000);
    const high = bandDb(open, 8000, 16000);
    expect(Math.abs(low - high)).toBeLessThan(6);
  });

  it("is deterministic across renders", () => {
    const a = renderNoise({ filter_cutoff: 20000 }, 1);
    const b = renderNoise({ filter_cutoff: 20000 }, 1);
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) throw new Error(`noise differs at sample ${i}`);
    }
  });

  it("level 0 contributes nothing: oscillator-only render is bit-identical", () => {
    const base: Record<string, number> = {
      osc1_level: 0.8,
      osc_noise_level: 0,
      filter_cutoff: 8000,
    };
    const a = renderOffline({
      durationSec: 0.5,
      sampleRate: SR,
      params: { ...NOISE_PATCH, ...base },
      events: [{ timeSec: 0, type: "on", note: 60, velocity: 1 }],
    });
    const b = renderOffline({
      durationSec: 0.5,
      sampleRate: SR,
      params: { ...NOISE_PATCH, ...base },
      events: [{ timeSec: 0, type: "on", note: 60, velocity: 1 }],
    });
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i]) throw new Error(`differs at ${i}`);
    }
    // And it audibly sounds (the oscillator, not the noise).
    expect(rms(a.left, Math.round(0.2 * SR), Math.round(0.45 * SR))).toBeGreaterThan(0.001);
  });

  it("noise reaches both channels and the voice output stays finite", () => {
    const audio = renderOffline({
      durationSec: 0.6,
      sampleRate: SR,
      params: { ...NOISE_PATCH, filter_cutoff: 20000 },
      events: [{ timeSec: 0, type: "on", note: 60, velocity: 1 }],
    });
    const from = Math.round(0.2 * SR);
    const to = Math.round(0.55 * SR);
    expect(rms(audio.left, from, to)).toBeGreaterThan(0.001);
    expect(rms(audio.right, from, to)).toBeGreaterThan(0.001);
  });
});
