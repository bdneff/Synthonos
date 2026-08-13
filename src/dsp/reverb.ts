/**
 * Schroeder reverberator (M. R. Schroeder, "Natural Sounding Artificial
 * Reverberation", JAES 1962): four parallel feedback combs summed into two
 * series allpasses, per channel, with slightly different (decorrelated)
 * lengths on the right channel. Modest and musical, not a hall simulator.
 *
 * reverb_size scales every delay length between REVERB_SIZE_SCALE_MIN and
 * REVERB_SIZE_SCALE_MAX of the base tunings; lines are preallocated at the
 * maximum scale. Each comb's feedback is derived per sample from
 * reverb_decay and that comb's actual length via the T60 relation
 * g = 10^(-3 * L / T60), so the measured -60 dB time tracks the knob. A
 * mild fixed lowpass in each comb loop (REVERB_DAMP) tames the metallic
 * edge of the classic topology. All state denormals are flushed; tick()
 * never allocates.
 */

import {
  DENORMAL_EPS,
  REVERB_ALLPASS_G,
  REVERB_ALLPASS_R_OFFSET_SEC,
  REVERB_ALLPASS_SEC,
  REVERB_COMB_GAIN,
  REVERB_COMB_R_OFFSET_SEC,
  REVERB_COMB_SEC,
  REVERB_DAMP,
  REVERB_MAX_FEEDBACK,
  REVERB_SIZE_SCALE_MAX,
  REVERB_SIZE_SCALE_MIN,
} from "./constants";

const NUM_COMBS = 4;
const NUM_ALLPASSES = 2;

export class Reverb {
  private readonly sampleRate: number;

  /** Comb line buffers, [channel * NUM_COMBS + comb]. */
  private readonly combBufs: Float32Array[];
  private readonly combIdx: Int32Array;
  /** One-pole damping state per comb. */
  private readonly combLp: Float64Array;
  /** Base (unscaled) comb lengths in seconds, per channel. */
  private readonly combBaseSec: Float64Array;

  private readonly apBufs: Float32Array[];
  private readonly apIdx: Int32Array;
  private readonly apBaseSec: Float64Array;

  wetL = 0;
  wetR = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.combBufs = [];
    this.combBaseSec = new Float64Array(2 * NUM_COMBS);
    for (let ch = 0; ch < 2; ch += 1) {
      for (let c = 0; c < NUM_COMBS; c += 1) {
        const sec = REVERB_COMB_SEC[c] + (ch === 1 ? REVERB_COMB_R_OFFSET_SEC[c] : 0);
        this.combBaseSec[ch * NUM_COMBS + c] = sec;
        this.combBufs.push(
          new Float32Array(Math.ceil(sec * REVERB_SIZE_SCALE_MAX * sampleRate) + 4),
        );
      }
    }
    this.combIdx = new Int32Array(2 * NUM_COMBS);
    this.combLp = new Float64Array(2 * NUM_COMBS);
    this.apBufs = [];
    this.apBaseSec = new Float64Array(2 * NUM_ALLPASSES);
    for (let ch = 0; ch < 2; ch += 1) {
      for (let a = 0; a < NUM_ALLPASSES; a += 1) {
        const sec = REVERB_ALLPASS_SEC[a] + (ch === 1 ? REVERB_ALLPASS_R_OFFSET_SEC[a] : 0);
        this.apBaseSec[ch * NUM_ALLPASSES + a] = sec;
        this.apBufs.push(
          new Float32Array(Math.ceil(sec * REVERB_SIZE_SCALE_MAX * sampleRate) + 4),
        );
      }
    }
    this.apIdx = new Int32Array(2 * NUM_ALLPASSES);
  }

  /** Flush all comb and allpass memory to zero (tail gate). */
  reset(): void {
    for (let i = 0; i < this.combBufs.length; i += 1) this.combBufs[i].fill(0);
    for (let i = 0; i < this.apBufs.length; i += 1) this.apBufs[i].fill(0);
    this.combIdx.fill(0);
    this.combLp.fill(0);
    this.apIdx.fill(0);
    this.wetL = 0;
    this.wetR = 0;
  }

  private channel(ch: number, input: number, sizeScale: number, decaySec: number): number {
    const sr = this.sampleRate;
    let sum = 0;
    for (let c = 0; c < NUM_COMBS; c += 1) {
      const slot = ch * NUM_COMBS + c;
      const buf = this.combBufs[slot];
      let len = Math.round(this.combBaseSec[slot] * sizeScale * sr);
      if (len < 2) len = 2;
      if (len > buf.length) len = buf.length;
      let idx = this.combIdx[slot];
      if (idx >= len) idx = 0;
      const y = buf[idx];
      // T60-derived feedback for this comb's actual loop time.
      let g = Math.pow(10, (-3 * len) / (sr * decaySec));
      if (g > REVERB_MAX_FEEDBACK) g = REVERB_MAX_FEEDBACK;
      // Mild one-pole lowpass damping inside the loop (Freeverb-style:
      // store = (1 - damp) * y + damp * store).
      let lp = y + REVERB_DAMP * (this.combLp[slot] - y);
      if (lp < DENORMAL_EPS && lp > -DENORMAL_EPS) lp = 0;
      this.combLp[slot] = lp;
      let w = input + g * lp;
      if (w < DENORMAL_EPS && w > -DENORMAL_EPS) w = 0;
      buf[idx] = w;
      idx += 1;
      if (idx >= len) idx = 0;
      this.combIdx[slot] = idx;
      sum += y;
    }
    let x = sum * REVERB_COMB_GAIN;
    for (let a = 0; a < NUM_ALLPASSES; a += 1) {
      const slot = ch * NUM_ALLPASSES + a;
      const buf = this.apBufs[slot];
      let len = Math.round(this.apBaseSec[slot] * sizeScale * sr);
      if (len < 2) len = 2;
      if (len > buf.length) len = buf.length;
      let idx = this.apIdx[slot];
      if (idx >= len) idx = 0;
      const d = buf[idx];
      let w = x + REVERB_ALLPASS_G * d;
      if (w < DENORMAL_EPS && w > -DENORMAL_EPS) w = 0;
      buf[idx] = w;
      x = d - REVERB_ALLPASS_G * w;
      idx += 1;
      if (idx >= len) idx = 0;
      this.apIdx[slot] = idx;
    }
    return x;
  }

  /** Advance one sample. size (0..1) and decaySec arrive smoothed. */
  tick(inL: number, inR: number, size: number, decaySec: number): void {
    let s = size;
    if (s < 0) s = 0;
    if (s > 1) s = 1;
    const scale =
      REVERB_SIZE_SCALE_MIN + s * (REVERB_SIZE_SCALE_MAX - REVERB_SIZE_SCALE_MIN);
    let dec = decaySec;
    if (dec < 0.01) dec = 0.01;
    this.wetL = this.channel(0, inL, scale, dec);
    this.wetR = this.channel(1, inR, scale, dec);
  }
}
