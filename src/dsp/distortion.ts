/**
 * Waveshaper distortion, first stage of the fixed effects chain.
 *
 * shape: y = tanh(g * x) / sqrt(g) with g = 1 + drive * DIST_PREGAIN_MAX.
 * The 1/sqrt(g) makeup splits the compensation: quiet material gains about
 * as many dB as loud peaks lose, so turning drive up changes the tone (odd
 * harmonics, compression) without the loudness ballooning or collapsing.
 *
 * The dry/wet blend happens in the engine (y = x + mix * (wet - x)) so a
 * smoothed mix that has settled on exact 0 is a bit-exact passthrough.
 */

import { DIST_PREGAIN_MAX } from "./constants";

/** Saturate one sample at the given drive (0..1). Allocation-free. */
export function distortSample(x: number, drive: number): number {
  const g = 1 + drive * DIST_PREGAIN_MAX;
  return Math.tanh(g * x) / Math.sqrt(g);
}
