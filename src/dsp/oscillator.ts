/**
 * Unison oscillator bank: up to 8 bandlimited wavetable voices with symmetric
 * detune spread, deterministic start phases, stereo spread, and equal-power
 * level compensation. Waveform switches crossfade over a few milliseconds so
 * an enum change never clicks.
 */

import {
  MAX_UNISON,
  UNISON_PHASES,
  UNISON_STEREO_SPREAD,
  WAVE_XFADE_SEC,
} from "./constants";
import { getWavetables, mipForDt, readWavetable } from "./wavetable";

const HALF_PI = Math.PI / 2;

export class UnisonOsc {
  private readonly sampleRate: number;
  private readonly tables: Float32Array[][];
  private readonly phases: Float64Array;
  private readonly offsets: Float64Array;
  private voiceCount = 1;
  private gain = 1;
  private wave = 0;
  private prevWave = 0;
  /** Crossfade position: 1 = fully previous waveform, counts down to 0. */
  private xfade = 0;
  private readonly xfadeStep: number;

  outL = 0;
  outR = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.tables = getWavetables();
    this.phases = new Float64Array(MAX_UNISON);
    this.offsets = new Float64Array(MAX_UNISON);
    this.xfadeStep = 1 / Math.max(1, Math.round(WAVE_XFADE_SEC * sampleRate));
  }

  /** Restart for a new note: unison layout and waveform snapshot, fixed phases. */
  reset(voiceCount: number, wave: number): void {
    let n = voiceCount | 0;
    if (n < 1) n = 1;
    if (n > MAX_UNISON) n = MAX_UNISON;
    this.voiceCount = n;
    this.gain = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i += 1) {
      this.offsets[i] = n === 1 ? 0 : (2 * i) / (n - 1) - 1;
      this.phases[i] = UNISON_PHASES[i];
    }
    this.wave = wave | 0;
    this.prevWave = this.wave;
    this.xfade = 0;
    this.outL = 0;
    this.outR = 0;
  }

  /** Discrete waveform switch, crossfaded so it cannot click. */
  setWaveform(wave: number): void {
    const w = wave | 0;
    if (w === this.wave) return;
    this.prevWave = this.wave;
    this.wave = w;
    this.xfade = 1;
  }

  /**
   * Render one sample into outL/outR. baseFreq in Hz (already includes pitch
   * params and LFO), detuneCents is the symmetric spread at the edges, pan in
   * [-1, 1]. Allocation-free.
   */
  tick(baseFreq: number, detuneCents: number, pan: number): void {
    const n = this.voiceCount;
    const sr = this.sampleRate;
    const curTables = this.tables[this.wave];
    const prevTables = this.tables[this.prevWave];
    const fading = this.xfade > 0;
    let l = 0;
    let r = 0;
    for (let i = 0; i < n; i += 1) {
      const off = this.offsets[i];
      const f = baseFreq * Math.pow(2, (off * detuneCents) / 1200);
      let dt = f / sr;
      if (dt > 0.45) dt = 0.45;
      if (dt < 0) dt = 0;
      const mip = mipForDt(dt);
      const t = this.phases[i];
      let v = readWavetable(curTables[mip], t);
      if (fading) {
        const pv = readWavetable(prevTables[mip], t);
        v += (pv - v) * this.xfade;
      }
      let t2 = t + dt;
      if (t2 >= 1) t2 -= 1;
      this.phases[i] = t2;

      let p = pan + off * UNISON_STEREO_SPREAD;
      if (p < -1) p = -1;
      if (p > 1) p = 1;
      const theta = (p + 1) * 0.5 * HALF_PI;
      l += v * Math.cos(theta);
      r += v * Math.sin(theta);
    }
    if (fading) {
      this.xfade -= this.xfadeStep;
      if (this.xfade < 0) this.xfade = 0;
    }
    this.outL = l * this.gain;
    this.outR = r * this.gain;
  }
}
