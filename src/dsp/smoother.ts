/**
 * One-pole parameter smoother. Every user-facing continuous parameter runs
 * through one of these so no stepped value ever reaches the audio path.
 *
 * Snaps to the target once the remaining difference is negligible, which keeps the
 * value on exact numbers (no denormal tails) and makes settled renders
 * deterministic.
 */

export class Smoother {
  private value: number;
  private target: number;
  private readonly coeff: number;

  constructor(sampleRate: number, timeMs: number, initial = 0) {
    this.value = initial;
    this.target = initial;
    this.coeff = 1 - Math.exp(-1 / (sampleRate * timeMs * 0.001));
  }

  setTarget(v: number): void {
    this.target = v;
  }

  /** Jump immediately, e.g. for initial patch load before audio starts. */
  snap(v: number): void {
    this.value = v;
    this.target = v;
  }

  /** Advance one sample and return the smoothed value. */
  tick(): number {
    const d = this.target - this.value;
    if (d > -1e-9 && d < 1e-9) {
      this.value = this.target;
    } else {
      this.value += this.coeff * d;
    }
    return this.value;
  }

  /** Current value without advancing. */
  peek(): number {
    return this.value;
  }
}
