/**
 * TPT state variable filter, Simper formulation (docs/SYNTH_REFERENCE.md 5.1).
 * Stable and accurate across the audio band; produces lowpass, bandpass, and
 * highpass simultaneously, which is what the filter_type crossfade needs.
 * State denormals are flushed to hard zero.
 */

import { DENORMAL_EPS } from "./constants";

/** Minimum cutoff in Hz; below this the filter is effectively closed. */
export const MIN_CUTOFF_HZ = 10;

/** Cutoff is clamped to this fraction of the sample rate. */
export const MAX_CUTOFF_FRACTION = 0.45;

/**
 * Map the schema's filter_resonance (0..1) onto a musical Q range:
 * 0 -> 0.7071 (Butterworth, flat passband, -3 dB right at the knee),
 * 1 -> 20 (a strong squelch; deliberately shy of self-oscillation).
 */
export function resonanceToQ(resonance: number): number {
  let r = resonance;
  if (r < 0) r = 0;
  if (r > 1) r = 1;
  return 0.7071067811865476 * Math.pow(28.284271247461902, r);
}

/** Prewarped tuning coefficient g = tan(pi * fc / fs), with fc clamped. */
export function svfCutoffG(cutoffHz: number, sampleRate: number): number {
  let fc = cutoffHz;
  const fMax = sampleRate * MAX_CUTOFF_FRACTION;
  if (fc < MIN_CUTOFF_HZ) fc = MIN_CUTOFF_HZ;
  if (fc > fMax) fc = fMax;
  return Math.tan((Math.PI * fc) / sampleRate);
}

export class Svf {
  private ic1eq = 0;
  private ic2eq = 0;

  low = 0;
  band = 0;
  high = 0;

  reset(): void {
    this.ic1eq = 0;
    this.ic2eq = 0;
    this.low = 0;
    this.band = 0;
    this.high = 0;
  }

  /**
   * Advance one sample. g from svfCutoffG, k = 1/Q. Outputs land in
   * low/band/high. Allocation-free.
   */
  tick(x: number, g: number, k: number): void {
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    let s1 = 2 * v1 - this.ic1eq;
    let s2 = 2 * v2 - this.ic2eq;
    if (s1 < DENORMAL_EPS && s1 > -DENORMAL_EPS) s1 = 0;
    if (s2 < DENORMAL_EPS && s2 > -DENORMAL_EPS) s2 = 0;
    this.ic1eq = s1;
    this.ic2eq = s2;
    this.low = v2;
    this.band = v1;
    this.high = x - k * v1 - v2;
  }
}
