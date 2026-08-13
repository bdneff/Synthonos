/**
 * Shared deterministic test fixtures. Tests must never depend on
 * Math.random; the noise generator here is the same xorshift32 the harness
 * self-tests calibrate against.
 */

/** Deterministic white noise in [-1, 1]. */
export function whiteNoise(frames: number, seed = 12345): Float32Array {
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

/** Frequency snapped to the nearest FFT bin so window leakage is confined. */
export function binAlignedFreq(
  freqHz: number,
  frameSize: number,
  sampleRate: number,
): number {
  return (Math.round((freqHz * frameSize) / sampleRate) * sampleRate) / frameSize;
}

/**
 * Bin-aligned frequency nudged off integer divisors of the sample rate,
 * where aliasing folds exactly onto harmonics and becomes invisible (same
 * rule the sweep helper applies automatically).
 */
export function safeTestFreq(
  freqHz: number,
  frameSize: number,
  sampleRate: number,
): number {
  const binHz = sampleRate / frameSize;
  let f = Math.max(1, Math.round(freqHz / binHz)) * binHz;
  while (Math.abs(sampleRate / f - Math.round(sampleRate / f)) * f < 4 * binHz) {
    f += binHz;
  }
  return f;
}

/** RMS of a buffer slice. */
export function rms(buf: Float32Array, from = 0, to = buf.length): number {
  let sum = 0;
  const n = to - from;
  for (let i = from; i < to; i += 1) sum += buf[i] * buf[i];
  return n > 0 ? Math.sqrt(sum / n) : 0;
}

export function rmsDb(buf: Float32Array, from = 0, to = buf.length): number {
  return 20 * Math.log10(Math.max(rms(buf, from, to), 1e-12));
}

/** MIDI note (possibly fractional) whose equal-tempered pitch is freqHz. */
export function freqToMidi(freqHz: number): number {
  return 69 + 12 * Math.log2(freqHz / 440);
}
