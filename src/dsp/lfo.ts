/**
 * Free-running low frequency oscillator. One instance per engine, never
 * retriggered by notes, so golden renders stay deterministic under fixed
 * block scheduling. sample_hold draws from a small LCG seeded with a
 * constant: deterministic, never Math.random.
 *
 * The raw shape passes through a short one-pole slew (LFO_SLEW_MS) so the
 * discontinuous shapes (square, saw wrap, sample_hold) and discrete waveform
 * switches can never step an audio-path gain hard enough to click.
 */

import {
  DENORMAL_EPS,
  LFO_SLEW_MS,
  LFO_WAVE_SAMPLE_HOLD,
  LFO_WAVE_SAW,
  LFO_WAVE_SINE,
  LFO_WAVE_SQUARE,
  LFO_WAVE_TRIANGLE,
} from "./constants";

const TWO_PI = 2 * Math.PI;
const LCG_SEED = 0x2c9277b5;

export class Lfo {
  private readonly sampleRate: number;
  private readonly slewCoef: number;
  private phase = 0;
  private wave = LFO_WAVE_SINE;
  private lcgState: number;
  private shValue: number;
  private smoothed = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.slewCoef = 1 - Math.exp(-1 / (sampleRate * LFO_SLEW_MS * 0.001));
    this.lcgState = LCG_SEED;
    this.shValue = this.draw();
  }

  private draw(): number {
    this.lcgState = (Math.imul(this.lcgState, 1664525) + 1013904223) >>> 0;
    return (this.lcgState / 4294967296) * 2 - 1;
  }

  setWaveform(wave: number): void {
    this.wave = wave | 0;
  }

  /**
   * Restart the cycle from phase zero (per-voice "note" retrigger mode).
   * Also reseeds sample_hold so every note hears the same deterministic
   * random sequence, and clears the slew so the first value ramps from zero
   * instead of jumping from a previous note's state.
   */
  reset(): void {
    this.phase = 0;
    this.lcgState = LCG_SEED;
    this.shValue = this.draw();
    this.smoothed = 0;
  }

  /** Advance one sample at the given rate (Hz); returns the slewed value in [-1, 1]. */
  tick(rateHz: number): number {
    let inc = rateHz / this.sampleRate;
    if (inc < 0) inc = 0;
    if (inc > 0.5) inc = 0.5;
    this.phase += inc;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.shValue = this.draw();
    }
    const t = this.phase;
    let raw: number;
    const w = this.wave;
    if (w === LFO_WAVE_SINE) {
      raw = Math.sin(TWO_PI * t);
    } else if (w === LFO_WAVE_TRIANGLE) {
      const d = t - 0.5;
      raw = 1 - 4 * (d < 0 ? -d : d);
    } else if (w === LFO_WAVE_SAW) {
      raw = 2 * t - 1;
    } else if (w === LFO_WAVE_SQUARE) {
      raw = t < 0.5 ? 1 : -1;
    } else if (w === LFO_WAVE_SAMPLE_HOLD) {
      raw = this.shValue;
    } else {
      raw = 0;
    }
    const d = raw - this.smoothed;
    if (d > -1e-9 && d < 1e-9) {
      this.smoothed = raw;
    } else {
      this.smoothed += this.slewCoef * d;
    }
    if (this.smoothed < DENORMAL_EPS && this.smoothed > -DENORMAL_EPS) {
      this.smoothed = 0;
    }
    return this.smoothed;
  }
}
