/**
 * Self-tests for the measurement tools. The harness is the thing standing
 * between us and silently wrong DSP, so it gets tested harder than anything:
 * every assertion must both pass a known-good signal and FAIL a known-bad
 * one. An assertion that never fails proves nothing.
 */

import { describe, it, expect } from "vitest";
import { magnitudeSpectrum, binFrequency, db, fftInPlace } from "./harness/fft";
import { encodeWavFloat32, decodeWavFloat32 } from "./harness/wav";
import {
  assertSilent,
  assertFinite,
  assertNoDenormals,
  assertDcOffsetBelow,
  assertNoClicks,
  assertAliasingBelow,
  measureWorstAliasDb,
  measureDcOffset,
  measureLowpassKneeHz,
  assertLowpassCutoffNear,
  assertSweepAliasFree,
} from "./harness/assertions";

const SR = 48000;
const N = 8192;

/** Frequency snapped to the nearest FFT bin so window leakage is confined. */
function binAligned(freqHz: number, frameSize = N, sampleRate = SR): number {
  return (Math.round((freqHz * frameSize) / sampleRate) * sampleRate) / frameSize;
}

function sine(freqHz: number, frames = N, amplitude = 1, sampleRate = SR): Float32Array {
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

/** Deterministic white noise; tests must not depend on Math.random. */
function whiteNoise(frames: number, seed = 12345): Float32Array {
  const out = new Float32Array(frames);
  let state = seed >>> 0;
  for (let i = 0; i < frames; i += 1) {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[i] = (state / 0xffffffff) * 2 - 1;
  }
  return out;
}

describe("fft", () => {
  it("recovers an impulse spectrum (flat)", () => {
    const real = new Float64Array(64);
    const imag = new Float64Array(64);
    real[0] = 1;
    fftInPlace(real, imag);
    for (let k = 0; k < 64; k += 1) {
      expect(real[k]).toBeCloseTo(1, 10);
      expect(imag[k]).toBeCloseTo(0, 10);
    }
  });

  it("puts a bin-aligned full-scale sine at 0 dBFS in the right bin", () => {
    const f = binAligned(1000);
    const mags = magnitudeSpectrum(sine(f));
    const k = Math.round((f * N) / SR);
    expect(db(mags[k])).toBeGreaterThan(-0.5);
    expect(db(mags[k])).toBeLessThan(0.5);
    expect(binFrequency(k, N, SR)).toBeCloseTo(f, 6);
  });

  it("keeps leakage from a bin-aligned sine below -100 dBFS outside +/-3 bins", () => {
    const f = binAligned(1000);
    const mags = magnitudeSpectrum(sine(f));
    const k = Math.round((f * N) / SR);
    for (let bin = 1; bin < mags.length; bin += 1) {
      if (Math.abs(bin - k) <= 3) continue;
      expect(db(mags[bin])).toBeLessThan(-100);
    }
  });
});

describe("wav", () => {
  it("round-trips stereo float audio bit-exactly", () => {
    const left = sine(440, 1000);
    const right = whiteNoise(1000);
    const bytes = encodeWavFloat32({ sampleRate: SR, channels: [left, right] });
    const back = decodeWavFloat32(bytes);
    expect(back.sampleRate).toBe(SR);
    expect(back.channels.length).toBe(2);
    expect(Array.from(back.channels[0])).toEqual(Array.from(left));
    expect(Array.from(back.channels[1])).toEqual(Array.from(right));
  });
});

describe("silence / finite / denormal / DC assertions", () => {
  it("passes exact silence and fails a single leaked sample", () => {
    const quiet = new Float32Array(1000);
    assertSilent(quiet);
    quiet[500] = 1e-9;
    expect(() => assertSilent(quiet)).toThrow(/expected exact silence/);
  });

  it("fails on NaN and infinity", () => {
    const buf = sine(440, 1000);
    assertFinite(buf);
    buf[10] = NaN;
    expect(() => assertFinite(buf)).toThrow(/sample 10/);
    buf[10] = Infinity;
    expect(() => assertFinite(buf)).toThrow(/sample 10/);
  });

  it("fails on denormal values and passes normal ones", () => {
    const buf = sine(440, 1000, 0.5);
    assertNoDenormals(buf);
    buf[3] = 1e-40; // subnormal in float32
    expect(() => assertNoDenormals(buf)).toThrow(/denormal/);
  });

  it("measures and rejects DC offset", () => {
    const centered = sine(binAligned(440), N);
    expect(Math.abs(measureDcOffset(centered))).toBeLessThan(1e-3);
    assertDcOffsetBelow(centered);
    const shifted = new Float32Array(N).fill(0.1);
    expect(() => assertDcOffsetBelow(shifted)).toThrow(/DC offset/);
  });
});

describe("click assertion", () => {
  it("passes a continuous sine and fails a hard gate edge", () => {
    const smooth = sine(440, 4800);
    assertNoClicks(smooth);

    // Chop the sine off at a phase where it is near its peak.
    const gated = sine(440, 4800);
    const quarterPeriod = Math.round(SR / 440 / 4);
    for (let i = 2200 + quarterPeriod; i < gated.length; i += 1) gated[i] = 0;
    expect(() => assertNoClicks(gated)).toThrow(/discontinuity/);
  });
});

describe("aliasing assertion", () => {
  /** Naive sawtooth: the canonical aliasing bug. */
  function naiveSaw(freqHz: number, frames = N): Float32Array {
    const out = new Float32Array(frames);
    let phase = 0;
    const inc = freqHz / SR;
    for (let i = 0; i < frames; i += 1) {
      out[i] = 2 * phase - 1;
      phase += inc;
      if (phase >= 1) phase -= 1;
    }
    return out;
  }

  /** Bandlimited additive sawtooth: harmonics only, up to Nyquist. */
  function additiveSaw(freqHz: number, frames = N): Float32Array {
    const out = new Float32Array(frames);
    const maxHarmonic = Math.floor(SR / 2 / freqHz) - 1;
    for (let k = 1; k <= maxHarmonic; k += 1) {
      const amp = ((2 / Math.PI) * (k % 2 === 1 ? 1 : -1)) / k;
      const w = (2 * Math.PI * k * freqHz) / SR;
      for (let i = 0; i < frames; i += 1) {
        out[i] += amp * Math.sin(w * i);
      }
    }
    return out;
  }

  it("passes a bandlimited sawtooth", () => {
    const f = binAligned(1500);
    assertAliasingBelow(additiveSaw(f), { sampleRate: SR, fundamental: f });
  });

  it("fails a naive sawtooth at a high fundamental, loudly", () => {
    // 3123 Hz, not 3000: 48000 / 3000 = 16 exactly, which folds every alias
    // onto a legitimate harmonic and hides the bug from the measurement. The
    // sweep helper nudges such fundamentals automatically; single-frequency
    // tests must pick them by hand.
    const f = binAligned(3123);
    const worst = measureWorstAliasDb(naiveSaw(f), { sampleRate: SR, fundamental: f });
    // The aliased images should not be borderline; they sit tens of dB above
    // the -60 dBFS line. If this margin shrinks, the measurement broke.
    expect(worst).toBeGreaterThan(-40);
    expect(() =>
      assertAliasingBelow(naiveSaw(f), { sampleRate: SR, fundamental: f }),
    ).toThrow(/non-harmonic energy/);
  });

  it("sweep helper catches the naive saw and passes the bandlimited one", () => {
    expect(() =>
      assertSweepAliasFree((f) => naiveSaw(f), { sampleRate: SR }),
    ).toThrow(/non-harmonic energy/);
    assertSweepAliasFree((f) => additiveSaw(f), { sampleRate: SR });
  });

  it("passes a pure sine at every register", () => {
    for (const raw of [55, 440, 3520]) {
      const f = binAligned(raw);
      assertAliasingBelow(sine(f), { sampleRate: SR, fundamental: f });
    }
  });
});

describe("filter response measurement", () => {
  /** One-pole lowpass with a known -3 dB point, as a calibration fixture. */
  function onePoleLowpass(input: Float32Array, cutoffHz: number): Float32Array {
    const out = new Float32Array(input.length);
    const a = Math.exp((-2 * Math.PI * cutoffHz) / SR);
    let state = 0;
    for (let i = 0; i < input.length; i += 1) {
      state = (1 - a) * input[i] + a * state;
      out[i] = state;
    }
    return out;
  }

  it("finds the -3 dB knee of a known one-pole filter", () => {
    const noise = whiteNoise(SR * 4);
    const filtered = onePoleLowpass(noise, 1000);
    const knee = measureLowpassKneeHz(filtered, { sampleRate: SR });
    expect(knee).toBeGreaterThan(750);
    expect(knee).toBeLessThan(1250);
    assertLowpassCutoffNear(filtered, 1000, { sampleRate: SR });
  });

  it("rejects a knee that misses the requested cutoff", () => {
    const noise = whiteNoise(SR * 4);
    const filtered = onePoleLowpass(noise, 500);
    expect(() =>
      assertLowpassCutoffNear(filtered, 4000, { sampleRate: SR }),
    ).toThrow(/knee/);
  });
});
