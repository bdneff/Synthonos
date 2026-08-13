/**
 * One polyphonic voice: two unison oscillator banks, a stereo TPT SVF, and
 * two ADSR envelopes (amp, filter). Reads its per-sample modulation and
 * parameter values from the engine's shared ControlState, which the engine
 * updates once per sample from its smoothers and LFO.
 *
 * Voice stealing: beginSteal() fades the running voice to zero over
 * STEAL_FADE_SEC and only then restarts it on the pending note, so a steal
 * can never click. When the amp envelope finishes its release the voice
 * snaps to exact zero, clears all state, and frees itself.
 */

import { Adsr, STAGE_RELEASE } from "./adsr";
import {
  FILTER_ENV_OCTAVES,
  KEYTRACK_CENTER_NOTE,
  STEAL_FADE_SEC,
  VOICE_HEADROOM,
  WAVE_SAW,
} from "./constants";
import { UnisonOsc } from "./oscillator";
import { Svf, svfCutoffG } from "./svf";

const HALF_PI = Math.PI / 2;
const SQRT2 = Math.SQRT2;

/**
 * Per-sample control values shared by every voice, updated once per sample
 * by the engine. All continuous values are post-smoothing; times are raw
 * (they are snapshotted into envelope coefficients at note-on).
 */
export class ControlState {
  // Oscillator banks (waveform indices and unison counts apply at note-on /
  // via UnisonOsc.setWaveform crossfades).
  osc1Wave = WAVE_SAW;
  osc2Wave = WAVE_SAW;
  uni1 = 1;
  uni2 = 1;
  /** 2^(pitch cents / 1200) per oscillator, includes octave+semitone+fine. */
  osc1PitchMul = 1;
  osc2PitchMul = 1;
  osc1Level = 0;
  osc2Level = 0;
  osc1Pan = 0;
  osc2Pan = 0;
  osc1Detune = 0;
  osc2Detune = 0;

  // Filter.
  cutoffLog2 = 10;
  /** k = 1/Q for the SVF. */
  resK = Math.SQRT2;
  envAmt = 0;
  keytrack = 0;
  gLp = 1;
  gHp = 0;
  gBp = 0;

  // LFO routing, already scaled by depth (engine side).
  lfoPitchMul = 1;
  lfoCutOct = 0;
  lfoAmpGain = 1;
  lfoPan = 0;

  // Envelope times/levels in engine units (seconds / 0..1). Safe fallbacks
  // only; the host applies the real patch before audio starts.
  ampAttack = 0.01;
  ampDecay = 0.1;
  ampSustain = 1;
  ampRelease = 0.1;
  fenvAttack = 0.01;
  fenvDecay = 0.1;
  fenvSustain = 1;
  fenvRelease = 0.1;
}

export const VOICE_IDLE = 0;
export const VOICE_ACTIVE = 1;

export class Voice {
  private readonly sampleRate: number;
  private readonly ctl: ControlState;
  private readonly osc1: UnisonOsc;
  private readonly osc2: UnisonOsc;
  private readonly svfL = new Svf();
  private readonly svfR = new Svf();
  private readonly ampEnv: Adsr;
  private readonly fenv: Adsr;
  private readonly fadeStep: number;

  state = VOICE_IDLE;
  note = -1;
  velocity = 0;
  /** Monotonic note-on order, for oldest-first stealing. */
  order = 0;

  stealing = false;
  private fadeGain = 1;
  private pendingNote = -1;
  private pendingVelocity = 0;
  private pendingOrder = 0;

  private baseFreq = 0;

  outL = 0;
  outR = 0;

  constructor(sampleRate: number, ctl: ControlState) {
    this.sampleRate = sampleRate;
    this.ctl = ctl;
    this.osc1 = new UnisonOsc(sampleRate);
    this.osc2 = new UnisonOsc(sampleRate);
    this.ampEnv = new Adsr(sampleRate);
    this.fenv = new Adsr(sampleRate);
    this.fadeStep = 1 / Math.max(1, Math.round(STEAL_FADE_SEC * sampleRate));
  }

  /** Fresh start on an idle (or just-faded) voice. */
  start(note: number, velocity: number, order: number): void {
    const c = this.ctl;
    this.note = note;
    this.velocity = velocity;
    this.order = order;
    this.baseFreq = 440 * Math.pow(2, (note - 69) / 12);
    this.osc1.reset(c.uni1, c.osc1Wave);
    this.osc2.reset(c.uni2, c.osc2Wave);
    this.svfL.reset();
    this.svfR.reset();
    this.ampEnv.kill();
    this.fenv.kill();
    this.ampEnv.setTimes(c.ampAttack, c.ampDecay, c.ampSustain, c.ampRelease);
    this.fenv.setTimes(c.fenvAttack, c.fenvDecay, c.fenvSustain, c.fenvRelease);
    this.ampEnv.noteOn();
    this.fenv.noteOn();
    this.stealing = false;
    this.fadeGain = 1;
    this.pendingNote = -1;
    this.state = VOICE_ACTIVE;
  }

  /** Same-note retrigger: envelopes restart from their current level. */
  retrigger(velocity: number, order: number): void {
    const c = this.ctl;
    this.velocity = velocity;
    this.order = order;
    this.ampEnv.setTimes(c.ampAttack, c.ampDecay, c.ampSustain, c.ampRelease);
    this.fenv.setTimes(c.fenvAttack, c.fenvDecay, c.fenvSustain, c.fenvRelease);
    this.ampEnv.noteOn();
    this.fenv.noteOn();
  }

  noteOff(): void {
    this.ampEnv.noteOff();
    this.fenv.noteOff();
  }

  /** Crossfaded waveform switch on a running voice. */
  setOsc1Waveform(wave: number): void {
    this.osc1.setWaveform(wave);
  }

  setOsc2Waveform(wave: number): void {
    this.osc2.setWaveform(wave);
  }

  /** Fade out over a few ms, then restart on the pending note. */
  beginSteal(note: number, velocity: number, order: number): void {
    this.pendingNote = note;
    this.pendingVelocity = velocity;
    this.pendingOrder = order;
    if (!this.stealing) {
      this.stealing = true;
      this.fadeGain = 1;
    }
  }

  /** The pending stolen-to note was released before it started; drop it. */
  cancelPending(note: number): boolean {
    if (this.stealing && this.pendingNote === note) {
      this.pendingNote = -1;
      return true;
    }
    return false;
  }

  isReleasing(): boolean {
    return this.ampEnv.stage === STAGE_RELEASE;
  }

  ampLevel(): number {
    return this.ampEnv.level;
  }

  kill(): void {
    this.state = VOICE_IDLE;
    this.note = -1;
    this.ampEnv.kill();
    this.fenv.kill();
    this.svfL.reset();
    this.svfR.reset();
    this.stealing = false;
    this.fadeGain = 1;
    this.pendingNote = -1;
    this.outL = 0;
    this.outR = 0;
  }

  /** Render one sample into outL/outR. Allocation-free. */
  tick(): void {
    if (this.stealing) {
      this.fadeGain -= this.fadeStep;
      if (this.fadeGain <= 0) {
        const pending = this.pendingNote;
        if (pending >= 0) {
          this.start(pending, this.pendingVelocity, this.pendingOrder);
        } else {
          this.kill();
          return;
        }
      }
    }

    const amp = this.ampEnv.tick();
    const fl = this.fenv.tick();
    if (this.ampEnv.isIdle()) {
      this.kill();
      return;
    }

    const c = this.ctl;
    const pitchMul = c.lfoPitchMul;
    this.osc1.tick(this.baseFreq * c.osc1PitchMul * pitchMul, c.osc1Detune, c.osc1Pan);
    let mixL = this.osc1.outL * c.osc1Level;
    let mixR = this.osc1.outR * c.osc1Level;
    if (c.osc2Level > 1e-7) {
      this.osc2.tick(this.baseFreq * c.osc2PitchMul * pitchMul, c.osc2Detune, c.osc2Pan);
      mixL += this.osc2.outL * c.osc2Level;
      mixR += this.osc2.outR * c.osc2Level;
    }

    const cutOct =
      c.cutoffLog2 +
      (c.keytrack * (this.note - KEYTRACK_CENTER_NOTE)) / 12 +
      c.envAmt * fl * FILTER_ENV_OCTAVES +
      c.lfoCutOct;
    const g = svfCutoffG(Math.pow(2, cutOct), this.sampleRate);
    const k = c.resK;
    this.svfL.tick(mixL, g, k);
    this.svfR.tick(mixR, g, k);
    const fL = c.gLp * this.svfL.low + c.gHp * this.svfL.high + c.gBp * this.svfL.band;
    const fR = c.gLp * this.svfR.low + c.gHp * this.svfR.high + c.gBp * this.svfR.band;

    const gain = amp * this.velocity * c.lfoAmpGain * this.fadeGain * VOICE_HEADROOM;

    // LFO pan as an equal-power stereo balance; unity at center.
    let p = c.lfoPan;
    if (p < -1) p = -1;
    if (p > 1) p = 1;
    const theta = (p + 1) * 0.5 * HALF_PI;
    this.outL = fL * gain * Math.cos(theta) * SQRT2;
    this.outR = fR * gain * Math.sin(theta) * SQRT2;
  }
}
