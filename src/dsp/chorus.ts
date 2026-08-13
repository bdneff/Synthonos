/**
 * Stereo chorus: one modulated delay line per channel, read by two
 * fractional-delay taps whose sinusoidal modulation runs in antiphase
 * (SYNTH_REFERENCE.md 5.3: a feedback-free modulated comb). The right
 * channel's LFO phases are offset a quarter cycle from the left's so the
 * two channels never sweep together, which is what makes chorus widen the
 * image. Depth scales the modulation excursion; the dry/wet blend happens
 * in the engine so mix 0 is a bit-exact passthrough.
 *
 * All memory is preallocated in the constructor; tick() never allocates.
 */

import { CHORUS_BASE_SEC, CHORUS_MOD_SEC } from "./constants";

const TWO_PI = 2 * Math.PI;

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export class Chorus {
  private readonly sampleRate: number;
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private readonly mask: number;
  private writeIdx = 0;
  private phase = 0;
  private readonly baseSamples: number;
  private readonly modSamplesMax: number;

  wetL = 0;
  wetR = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.baseSamples = CHORUS_BASE_SEC * sampleRate;
    this.modSamplesMax = CHORUS_MOD_SEC * sampleRate;
    const size = nextPow2(Math.ceil((CHORUS_BASE_SEC + CHORUS_MOD_SEC) * sampleRate) + 8);
    this.bufL = new Float32Array(size);
    this.bufR = new Float32Array(size);
    this.mask = size - 1;
  }

  /** Flush all line memory to zero (tail gate). The LFO phase is kept. */
  reset(): void {
    this.bufL.fill(0);
    this.bufR.fill(0);
    this.wetL = 0;
    this.wetR = 0;
  }

  private readTap(buf: Float32Array, delaySamples: number): number {
    const pos = this.writeIdx - delaySamples;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = buf[i0 & this.mask];
    const b = buf[(i0 + 1) & this.mask];
    return a + frac * (b - a);
  }

  /** Advance one sample. rateHz and depth (0..1) arrive smoothed. */
  tick(inL: number, inR: number, rateHz: number, depth: number): void {
    const w = this.writeIdx & this.mask;
    this.bufL[w] = inL;
    this.bufR[w] = inR;

    let inc = rateHz / this.sampleRate;
    if (inc < 0) inc = 0;
    if (inc > 0.5) inc = 0.5;
    this.phase += inc;
    if (this.phase >= 1) this.phase -= 1;

    const mod = depth * this.modSamplesMax;
    const p = TWO_PI * this.phase;
    // Two taps per channel in antiphase; right channel a quarter cycle later.
    const dL1 = this.baseSamples + mod * Math.sin(p);
    const dL2 = this.baseSamples - mod * Math.sin(p);
    const dR1 = this.baseSamples + mod * Math.sin(p + Math.PI / 2);
    const dR2 = this.baseSamples - mod * Math.sin(p + Math.PI / 2);
    this.wetL = 0.5 * (this.readTap(this.bufL, dL1) + this.readTap(this.bufL, dL2));
    this.wetR = 0.5 * (this.readTap(this.bufR, dR1) + this.readTap(this.bufR, dR2));

    this.writeIdx = (this.writeIdx + 1) & this.mask;
  }
}
