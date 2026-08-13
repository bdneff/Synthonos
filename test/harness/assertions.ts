/**
 * Spectral and time-domain assertions for rendered audio. Each assertion
 * throws with a specific message on failure. docs/TESTING.md explains what
 * each one catches and why it exists.
 *
 * Convention: functions named assert* throw; functions named measure* return
 * a number so tests can also check calibration of the harness itself.
 */

import { magnitudeSpectrum, binFrequency, db } from "./fft";

const SMALLEST_NORMAL_F32 = 1.1754943508222875e-38; // 2^-126

// ---------------------------------------------------------------------------
// Silence
// ---------------------------------------------------------------------------

/**
 * With no note playing the output must be exactly 0.0, not merely quiet.
 * Catches leaking envelopes, stuck voices, and denormal tails.
 */
export function assertSilent(buf: Float32Array, label = "buffer"): void {
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] !== 0) {
      throw new Error(
        `${label}: expected exact silence but sample ${i} is ${buf[i]}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// NaN / infinity / denormals
// ---------------------------------------------------------------------------

/** Every sample must be finite. NaN spreads through feedback paths instantly. */
export function assertFinite(buf: Float32Array, label = "buffer"): void {
  for (let i = 0; i < buf.length; i += 1) {
    if (!Number.isFinite(buf[i])) {
      throw new Error(`${label}: sample ${i} is ${buf[i]}`);
    }
  }
}

/**
 * No denormal (subnormal) values in the output. Denormals in filter feedback
 * state make CPU use spike during quiet passages; the engine must flush them
 * to zero.
 */
export function assertNoDenormals(buf: Float32Array, label = "buffer"): void {
  for (let i = 0; i < buf.length; i += 1) {
    const v = Math.abs(buf[i]);
    if (v > 0 && v < SMALLEST_NORMAL_F32) {
      throw new Error(`${label}: sample ${i} is denormal (${buf[i]})`);
    }
  }
}

// ---------------------------------------------------------------------------
// DC offset
// ---------------------------------------------------------------------------

export function measureDcOffset(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) sum += buf[i];
  return buf.length > 0 ? sum / buf.length : 0;
}

/** Mean of the rendered buffer must stay near zero. */
export function assertDcOffsetBelow(
  buf: Float32Array,
  maxAbsMean = 0.01,
  label = "buffer",
): void {
  const mean = measureDcOffset(buf);
  if (Math.abs(mean) > maxAbsMean) {
    throw new Error(
      `${label}: DC offset ${mean.toFixed(6)} exceeds ${maxAbsMean}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Clicks
// ---------------------------------------------------------------------------

export interface ClickReport {
  index: number;
  step: number;
}

export function findWorstStep(buf: Float32Array): ClickReport {
  let worst = 0;
  let at = 0;
  for (let i = 1; i < buf.length; i += 1) {
    const step = Math.abs(buf[i] - buf[i - 1]);
    if (step > worst) {
      worst = step;
      at = i;
    }
  }
  return { index: at, step: worst };
}

/**
 * No sample-to-sample discontinuity above the threshold. Run this across note
 * on, note off, and voice steal boundaries; it catches missing envelope ramps
 * and abrupt voice reassignment. The default threshold allows legitimate
 * high-frequency content at moderate levels while flagging hard edges.
 */
export function assertNoClicks(
  buf: Float32Array,
  maxStep = 0.25,
  label = "buffer",
): void {
  const worst = findWorstStep(buf);
  if (worst.step > maxStep) {
    throw new Error(
      `${label}: discontinuity of ${worst.step.toFixed(4)} at sample ${worst.index} exceeds ${maxStep}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Aliasing
// ---------------------------------------------------------------------------

export interface AliasingOptions {
  sampleRate: number;
  /** Fundamental frequency of the tone in this frame, in Hz. */
  fundamental: number;
  /** FFT frame size, power of 2. */
  frameSize?: number;
  /** Bins on each side of a harmonic that still count as that harmonic. */
  harmonicToleranceBins?: number;
  /** Ignore bins below this frequency (envelope/DC leakage region). */
  ignoreBelowHz?: number;
}

/**
 * Highest non-harmonic spectral peak in dBFS. For a periodic tone at a known
 * fundamental every legitimate component sits on a harmonic; energy anywhere
 * else is aliasing (or another bug). Naive trivially-generated waveforms fail
 * this loudly at high fundamentals, which is exactly what we want.
 */
export function measureWorstAliasDb(
  frame: Float32Array,
  opts: AliasingOptions,
): number {
  const frameSize = opts.frameSize ?? frame.length;
  if (frame.length < frameSize) throw new Error("aliasing: frame shorter than frameSize");
  const tolerance = opts.harmonicToleranceBins ?? 3;
  const ignoreBelowHz = opts.ignoreBelowHz ?? 20;

  const mags = magnitudeSpectrum(frame.subarray(0, frameSize));
  const binHz = opts.sampleRate / frameSize;

  let worst = -Infinity;
  for (let k = 1; k < mags.length; k += 1) {
    const freq = binFrequency(k, frameSize, opts.sampleRate);
    if (freq < ignoreBelowHz) continue;
    // Distance in bins from the nearest harmonic of the fundamental.
    const harmonicNumber = Math.round(freq / opts.fundamental);
    if (harmonicNumber >= 1) {
      const nearestHarmonicBin = (harmonicNumber * opts.fundamental) / binHz;
      if (Math.abs(k - nearestHarmonicBin) <= tolerance) continue;
    }
    const level = db(mags[k]);
    if (level > worst) worst = level;
  }
  return worst;
}

/**
 * Assert that all non-harmonic energy stays below the threshold (default
 * -60 dBFS per the build plan). Use a frame from the steady portion of the
 * note, not the attack.
 */
export function assertAliasingBelow(
  frame: Float32Array,
  opts: AliasingOptions & { maxAliasDb?: number },
  label = "buffer",
): void {
  const maxAliasDb = opts.maxAliasDb ?? -60;
  const worst = measureWorstAliasDb(frame, opts);
  if (worst > maxAliasDb) {
    throw new Error(
      `${label}: non-harmonic energy at ${worst.toFixed(1)} dBFS exceeds ${maxAliasDb} dBFS ` +
        `(fundamental ${opts.fundamental} Hz)`,
    );
  }
}

/**
 * Sweep helper: render a tone at each of several fundamentals via the given
 * callback and assert every one passes the aliasing check. The build plan
 * calls for 20 Hz to 8 kHz; stepped tones at log-spaced frequencies make each
 * frame's expected harmonic set exact, which a continuous sweep would blur.
 */
export function assertSweepAliasFree(
  renderTone: (fundamental: number) => Float32Array,
  opts: {
    sampleRate: number;
    fromHz?: number;
    toHz?: number;
    steps?: number;
    frameSize?: number;
    maxAliasDb?: number;
  },
): void {
  const fromHz = opts.fromHz ?? 20;
  const toHz = opts.toHz ?? 8000;
  const steps = opts.steps ?? 16;
  const frameSize = opts.frameSize ?? 8192;
  const binHz = opts.sampleRate / frameSize;
  for (let s = 0; s < steps; s += 1) {
    let f = fromHz * Math.pow(toHz / fromHz, s / (steps - 1));
    // Snap to an FFT bin so Hann leakage stays confined to +/-1 bin.
    f = Math.max(1, Math.round(f / binHz)) * binHz;
    // If the fundamental divides the sample rate, every aliased image folds
    // exactly onto a legitimate harmonic and aliasing becomes invisible to
    // this measurement. Nudge such fundamentals off the pathological spot.
    while (Math.abs(opts.sampleRate / f - Math.round(opts.sampleRate / f)) * f < 4 * binHz) {
      f += binHz;
    }
    const frame = renderTone(f);
    assertAliasingBelow(
      frame,
      {
        sampleRate: opts.sampleRate,
        fundamental: f,
        frameSize: opts.frameSize ?? frame.length,
        maxAliasDb: opts.maxAliasDb ?? -60,
      },
      `sweep step ${s} (${f.toFixed(1)} Hz)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Filter response
// ---------------------------------------------------------------------------

export interface FilterKneeOptions {
  sampleRate: number;
  frameSize?: number;
  /** Number of frames to average. More frames flatten the noise floor. */
  frames?: number;
}

/** Averaged, bin-smoothed amplitude spectrum of a long signal. */
function averagedSpectrum(
  signal: Float32Array,
  frameSize: number,
  frames: number,
  smoothBins: number,
): Float64Array {
  const power = new Float64Array(frameSize / 2 + 1);
  for (let f = 0; f < frames; f += 1) {
    const mags = magnitudeSpectrum(signal.subarray(f * frameSize, (f + 1) * frameSize));
    for (let k = 0; k < power.length; k += 1) power[k] += mags[k] * mags[k];
  }
  // Moving average over neighboring bins knocks down the variance of the
  // white noise estimate; without it, first-crossing knee detection triggers
  // early on random dips and reads systematically low.
  const smoothed = new Float64Array(power.length);
  const half = Math.floor(smoothBins / 2);
  for (let k = 0; k < power.length; k += 1) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, k - half); j <= Math.min(power.length - 1, k + half); j += 1) {
      sum += power[j];
      count += 1;
    }
    smoothed[k] = Math.sqrt(sum / count / frames);
  }
  return smoothed;
}

/**
 * Estimate the -3 dB point of a lowpass response from filtered white noise.
 * Averages magnitude spectra over many frames, smooths across bins, takes
 * the low-frequency passband as reference, and finds the first SUSTAINED
 * crossing 3 dB below it (a single noisy bin does not count).
 */
export function measureLowpassKneeHz(
  filtered: Float32Array,
  opts: FilterKneeOptions,
): number {
  const frameSize = opts.frameSize ?? 4096;
  const frames = opts.frames ?? Math.floor(filtered.length / frameSize);
  if (frames < 4) throw new Error("filter knee: need at least 4 frames of audio");

  const avg = averagedSpectrum(filtered, frameSize, frames, 9);

  // Reference level: median of the low passband (skip DC region).
  const refStart = 2;
  const refEnd = Math.max(refStart + 8, Math.floor(avg.length / 64));
  const refBins = Array.from(avg.subarray(refStart, refEnd)).sort((a, b) => a - b);
  const ref = refBins[Math.floor(refBins.length / 2)];
  if (ref <= 0) throw new Error("filter knee: silent passband");

  const target = ref / Math.SQRT2; // -3 dB
  const sustain = 5;
  for (let k = refEnd; k < avg.length - sustain; k += 1) {
    if (avg[k] >= target) continue;
    let held = true;
    for (let j = 1; j <= sustain; j += 1) {
      if (avg[k + j] >= target) {
        held = false;
        break;
      }
    }
    if (!held) continue;
    // Log-linear interpolation between k-1 and k for a smoother estimate.
    const f0 = binFrequency(k - 1, frameSize, opts.sampleRate);
    const f1 = binFrequency(k, frameSize, opts.sampleRate);
    const a0 = avg[k - 1];
    const a1 = avg[k];
    const t = a0 === a1 ? 0.5 : (a0 - target) / (a0 - a1);
    return f0 + (f1 - f0) * Math.min(Math.max(t, 0), 1);
  }
  throw new Error("filter knee: response never crossed -3 dB");
}

/**
 * Assert the measured -3 dB knee lands within a multiplicative tolerance of
 * the requested cutoff. White-noise estimates are statistical, so tolerance
 * is a ratio (default 25%), not an absolute number of Hz.
 */
export function assertLowpassCutoffNear(
  filtered: Float32Array,
  expectedHz: number,
  opts: FilterKneeOptions & { toleranceRatio?: number },
  label = "filter",
): void {
  const tolerance = opts.toleranceRatio ?? 0.25;
  const knee = measureLowpassKneeHz(filtered, opts);
  const ratio = knee / expectedHz;
  if (ratio < 1 - tolerance || ratio > 1 + tolerance) {
    throw new Error(
      `${label}: -3 dB knee at ${knee.toFixed(1)} Hz, expected ${expectedHz} Hz ±${tolerance * 100}%`,
    );
  }
}

/**
 * Measure the resonance peak height in dB relative to the passband reference,
 * for resonance tests once the SVF lands.
 */
export function measurePeakAboveTargetDb(
  filtered: Float32Array,
  aroundHz: number,
  opts: FilterKneeOptions,
): number {
  const frameSize = opts.frameSize ?? 4096;
  const frames = opts.frames ?? Math.floor(filtered.length / frameSize);
  const avg = averagedSpectrum(filtered, frameSize, frames, 9);

  const refStart = 2;
  const refEnd = Math.max(refStart + 8, Math.floor(avg.length / 64));
  const refBins = Array.from(avg.subarray(refStart, refEnd)).sort((a, b) => a - b);
  const ref = refBins[Math.floor(refBins.length / 2)];

  const centerBin = Math.round((aroundHz * frameSize) / opts.sampleRate);
  const span = Math.max(2, Math.round(centerBin * 0.15));
  let peak = 0;
  for (let k = Math.max(1, centerBin - span); k <= Math.min(avg.length - 1, centerBin + span); k += 1) {
    if (avg[k] > peak) peak = avg[k];
  }
  return db(peak) - db(ref);
}
