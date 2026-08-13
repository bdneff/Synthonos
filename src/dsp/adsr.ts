/**
 * ADSR envelope per docs/SYNTH_REFERENCE.md 5.5: exponential decay and
 * release (knob time = time to fall within 0.1% of target), attack as an
 * exponential charge toward an overshoot target clamped at 1.0. Every segment
 * transition continues from the current level, so retrigger and early release
 * can never jump. Release snaps to exact zero below the kill threshold.
 */

import {
  ENV_ATTACK_TARGET,
  ENV_ATTACK_TIME_FACTOR,
  ENV_EXP_TIME_FACTOR,
  ENV_KILL_LEVEL,
} from "./constants";

export const STAGE_IDLE = 0;
export const STAGE_ATTACK = 1;
export const STAGE_DECAY = 2;
export const STAGE_SUSTAIN = 3;
export const STAGE_RELEASE = 4;

const MIN_TIME_SEC = 1e-4;

export class Adsr {
  private readonly sampleRate: number;
  private aCoef = 1;
  private dCoef = 1;
  private rCoef = 1;
  private sustain = 1;

  stage = STAGE_IDLE;
  level = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /** Snapshot times (seconds) and sustain level. Called at note-on/retrigger. */
  setTimes(attack: number, decay: number, sustain: number, release: number): void {
    const sr = this.sampleRate;
    const a = attack > MIN_TIME_SEC ? attack : MIN_TIME_SEC;
    const d = decay > MIN_TIME_SEC ? decay : MIN_TIME_SEC;
    const r = release > MIN_TIME_SEC ? release : MIN_TIME_SEC;
    this.aCoef = 1 - Math.exp(-ENV_ATTACK_TIME_FACTOR / (a * sr));
    this.dCoef = 1 - Math.exp(-ENV_EXP_TIME_FACTOR / (d * sr));
    this.rCoef = 1 - Math.exp(-ENV_EXP_TIME_FACTOR / (r * sr));
    let s = sustain;
    if (s < 0) s = 0;
    if (s > 1) s = 1;
    this.sustain = s;
  }

  /** Start (or restart) the attack from the current level. */
  noteOn(): void {
    this.stage = STAGE_ATTACK;
  }

  /** Release from whatever stage and level we are at. */
  noteOff(): void {
    if (this.stage !== STAGE_IDLE) this.stage = STAGE_RELEASE;
  }

  /** Hard reset to silence (voice kill). */
  kill(): void {
    this.stage = STAGE_IDLE;
    this.level = 0;
  }

  isReleasing(): boolean {
    return this.stage === STAGE_RELEASE;
  }

  isIdle(): boolean {
    return this.stage === STAGE_IDLE;
  }

  /** Advance one sample and return the level in [0, 1]. Allocation-free. */
  tick(): number {
    const stage = this.stage;
    if (stage === STAGE_ATTACK) {
      this.level += this.aCoef * (ENV_ATTACK_TARGET - this.level);
      if (this.level >= 1) {
        this.level = 1;
        this.stage = STAGE_DECAY;
      }
    } else if (stage === STAGE_DECAY) {
      this.level += this.dCoef * (this.sustain - this.level);
      const d = this.level - this.sustain;
      if (d < ENV_KILL_LEVEL && d > -ENV_KILL_LEVEL) {
        this.level = this.sustain;
        this.stage = STAGE_SUSTAIN;
      }
    } else if (stage === STAGE_RELEASE) {
      this.level -= this.rCoef * this.level;
      if (this.level <= ENV_KILL_LEVEL) {
        this.level = 0;
        this.stage = STAGE_IDLE;
      }
    } else if (stage === STAGE_IDLE) {
      this.level = 0;
    }
    // STAGE_SUSTAIN holds level as-is.
    return this.level;
  }
}
