/**
 * Stereo feedback delay, third stage of the fixed effects chain.
 *
 * Time changes never pitch-shift: the read position is not slewed. Instead,
 * when the target time changes, the output crossfades from the old read tap
 * to the new one over DELAY_XFADE_SEC (equivalent to crossfading two delay
 * lines that share one write head). A change that arrives mid-fade waits
 * until the current fade completes, then fades again, so rapid knob moves
 * degrade into a short series of clean crossfades instead of artifacts.
 *
 * Feedback is clamped to 0..0.9 (the schema's max) on top of whatever the
 * smoothed parameter says, so the loop can never run away. Line memory for
 * the schema's full 2 s range is preallocated; tick() never allocates.
 */

import { DELAY_MAX_SEC, DELAY_XFADE_SEC, DENORMAL_EPS } from "./constants";

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export class StereoDelay {
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private readonly mask: number;
  private writeIdx = 0;

  private curDelay: number;
  private fadeToDelay = 0;
  private fade = 0;
  private readonly fadeStep: number;
  private readonly maxDelay: number;

  outL = 0;
  outR = 0;

  constructor(sampleRate: number, initialDelaySec: number) {
    const size = nextPow2(Math.ceil(DELAY_MAX_SEC * sampleRate) + 8);
    this.bufL = new Float32Array(size);
    this.bufR = new Float32Array(size);
    this.mask = size - 1;
    this.maxDelay = Math.ceil(DELAY_MAX_SEC * sampleRate);
    this.fadeStep = 1 / Math.max(1, Math.round(DELAY_XFADE_SEC * sampleRate));
    this.curDelay = this.clampDelay(Math.round(initialDelaySec * sampleRate));
  }

  private clampDelay(d: number): number {
    let v = d | 0;
    if (v < 1) v = 1;
    if (v > this.maxDelay) v = this.maxDelay;
    return v;
  }

  /**
   * Longest read tap currently in use (samples). The engine's tail gate must
   * stay open at least this long after the last non-silent output, because a
   * feedback delay is legitimately silent between echoes.
   */
  maxTapSamples(): number {
    return this.fade > 0 && this.fadeToDelay > this.curDelay
      ? this.fadeToDelay
      : this.curDelay;
  }

  /** Flush all line memory to zero (tail gate). Tap positions are kept. */
  reset(): void {
    this.bufL.fill(0);
    this.bufR.fill(0);
    this.outL = 0;
    this.outR = 0;
  }

  /** Advance one sample. targetDelaySamples is the raw knob value in samples. */
  tick(inL: number, inR: number, targetDelaySamples: number, feedback: number): void {
    const target = this.clampDelay(targetDelaySamples);
    if (this.fade === 0 && target !== this.curDelay) {
      this.fadeToDelay = target;
      this.fade = this.fadeStep;
    }

    const w = this.writeIdx;
    const mask = this.mask;
    let oL = this.bufL[(w - this.curDelay) & mask];
    let oR = this.bufR[(w - this.curDelay) & mask];
    if (this.fade > 0) {
      const x = this.fade;
      const bL = this.bufL[(w - this.fadeToDelay) & mask];
      const bR = this.bufR[(w - this.fadeToDelay) & mask];
      oL += x * (bL - oL);
      oR += x * (bR - oR);
      this.fade += this.fadeStep;
      if (this.fade >= 1) {
        this.curDelay = this.fadeToDelay;
        this.fade = 0;
      }
    }

    let fb = feedback;
    if (fb < 0) fb = 0;
    if (fb > 0.9) fb = 0.9;
    let wL = inL + fb * oL;
    let wR = inR + fb * oR;
    if (wL < DENORMAL_EPS && wL > -DENORMAL_EPS) wL = 0;
    if (wR < DENORMAL_EPS && wR > -DENORMAL_EPS) wR = 0;
    this.bufL[w] = wL;
    this.bufR[w] = wR;
    this.writeIdx = (w + 1) & mask;

    this.outL = oL;
    this.outR = oR;
  }
}
