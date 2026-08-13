/**
 * One polyphonic voice: two unison oscillator banks plus a deterministic
 * per-voice white noise source, a saturating drive stage, a stereo TPT SVF
 * (one or two cascaded stages for the 12/24 dB slope switch, crossfaded so
 * switching cannot click), and two ADSR envelopes (amp, filter). Reads its
 * per-sample modulation and parameter values from the engine's shared
 * ControlState, which the engine updates once per sample from its smoothers
 * and LFO.
 *
 * Phase 3 additions handled here:
 * - Glide (portamento): the sounding pitch approaches the target note
 *   exponentially in semitone space with time constant glide_time; new notes
 *   start from the previous sounding pitch when glide is on, else jump.
 * - amp_velocity: gain = mix(1, velocity, amp_velocity), snapshotted at
 *   note-on, so 0 ignores velocity entirely.
 * - Per-voice LFO: in "note" retrigger mode each voice runs its own LFO,
 *   phase-reset at note start; in "free" mode the engine's global LFO value
 *   is used. Either way lfo_fade ramps this voice's modulation depth from 0
 *   over lfo_fade seconds from the voice's own start. The mode is
 *   snapshotted at note start so flipping the enum can never click a
 *   running voice.
 * - Noise: per-voice xorshift32 seeded from the voice index, reseeded at
 *   every note start, so renders stay bit-exact. Mixed pre-drive/pre-filter.
 *
 * Voice stealing: beginSteal() fades the running voice to zero over
 * STEAL_FADE_SEC and only then restarts it on the pending note, so a steal
 * can never click. When the amp envelope finishes its release the voice
 * snaps to exact zero, clears all state, and frees itself.
 */

import { Adsr, STAGE_RELEASE } from "./adsr";
import {
  DRIVE_PREGAIN_MAX,
  FILTER_ENV_OCTAVES,
  GLIDE_JUMP_SEC,
  GLIDE_SNAP_SEMITONES,
  KEYTRACK_CENTER_NOTE,
  LFO_CUTOFF_OCTAVES,
  LFO_PITCH_SEMITONES,
  LFO_RETRIGGER_NOTE,
  NOISE_SEED_BASE,
  NOISE_SEED_STEP,
  STEAL_FADE_SEC,
  VOICE_HEADROOM,
  WAVE_SAW,
} from "./constants";
import { Lfo } from "./lfo";
import { UnisonOsc } from "./oscillator";
import { Svf, svfCutoffG } from "./svf";

const HALF_PI = Math.PI / 2;
const SQRT2 = Math.SQRT2;

/** Second-stage damping: fixed Butterworth (k = sqrt(2)) so the 24 dB mode
 *  steepens the slope without squaring the resonance peak. */
const SLOPE_STAGE2_K = Math.SQRT2;

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

  /** White noise level into the filter input (post-smoothing). */
  noiseLevel = 0;

  // Filter.
  cutoffLog2 = 10;
  /** k = 1/Q for the SVF. */
  resK = Math.SQRT2;
  envAmt = 0;
  keytrack = 0;
  gLp = 1;
  gHp = 0;
  gBp = 0;
  /** Saturation into the filter, 0..1 (post-smoothing). */
  driveAmt = 0;
  /** Crossfade weight of the 24 dB (two-stage) output, 0..1 (post-smoothing). */
  w24 = 1;

  // LFO: raw per-target depths (post-smoothing); voices apply them together
  // with their own fade ramp and, in "note" mode, their own LFO phase.
  lfoRetrigger = 0;
  lfoWave = 0;
  lfoRateHz = 1;
  /** The engine's global free-running LFO value for "free" mode. */
  lfoGlobal = 0;
  lfoFadeSec = 0;
  depthCutoff = 0;
  depthPitch = 0;
  depthAmp = 0;
  depthPan = 0;

  // Pitch behavior (raw; snapshotted at note-on).
  glideTime = 0.001;
  /** Velocity-to-level sensitivity; 1 mirrors the pre-Phase-3 behavior. */
  ampVelocity = 1;

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
  private readonly svfL2 = new Svf();
  private readonly svfR2 = new Svf();
  private readonly ampEnv: Adsr;
  private readonly fenv: Adsr;
  private readonly ownLfo: Lfo;
  private readonly fadeStep: number;
  private readonly noiseSeed: number;

  state = VOICE_IDLE;
  note = -1;
  velocity = 0;
  /** Monotonic note-on order, for oldest-first stealing. */
  order = 0;

  /** Current sounding pitch in (fractional) MIDI note units; glides to note. */
  glideNote = -1;
  private glideCoeff = 1;

  stealing = false;
  private fadeGain = 1;
  private pendingNote = -1;
  private pendingVelocity = 0;
  private pendingOrder = 0;
  private pendingGlideFrom = -1;

  private baseFreq = 0;
  private velGain = 0;
  private noiseState = 1;
  private lfoNoteMode = false;
  private lfoFade = 1;
  private lfoFadeStep = 1;

  outL = 0;
  outR = 0;

  constructor(sampleRate: number, ctl: ControlState, voiceIndex: number) {
    this.sampleRate = sampleRate;
    this.ctl = ctl;
    this.osc1 = new UnisonOsc(sampleRate);
    this.osc2 = new UnisonOsc(sampleRate);
    this.ampEnv = new Adsr(sampleRate);
    this.fenv = new Adsr(sampleRate);
    this.ownLfo = new Lfo(sampleRate);
    this.fadeStep = 1 / Math.max(1, Math.round(STEAL_FADE_SEC * sampleRate));
    let seed = (NOISE_SEED_BASE ^ Math.imul(voiceIndex + 1, NOISE_SEED_STEP)) >>> 0;
    if (seed === 0) seed = NOISE_SEED_BASE;
    this.noiseSeed = seed;
    this.noiseState = seed;
  }

  /**
   * Fresh start on an idle (or just-faded) voice. glideFrom is the previous
   * sounding pitch in MIDI note units, or a negative number to start exactly
   * on the target pitch.
   */
  start(note: number, velocity: number, order: number, glideFrom: number): void {
    const c = this.ctl;
    this.note = note;
    this.velocity = velocity;
    this.order = order;
    this.velGain = 1 + c.ampVelocity * (velocity - 1);
    if (glideFrom >= 0 && c.glideTime > GLIDE_JUMP_SEC) {
      this.glideNote = glideFrom;
      this.glideCoeff = 1 - Math.exp(-1 / (c.glideTime * this.sampleRate));
    } else {
      this.glideNote = note;
      this.glideCoeff = 1;
    }
    this.baseFreq = 440 * Math.pow(2, (this.glideNote - 69) / 12);
    this.noiseState = this.noiseSeed;
    this.osc1.reset(c.uni1, c.osc1Wave);
    this.osc2.reset(c.uni2, c.osc2Wave);
    this.svfL.reset();
    this.svfR.reset();
    this.svfL2.reset();
    this.svfR2.reset();
    this.ampEnv.kill();
    this.fenv.kill();
    this.ampEnv.setTimes(c.ampAttack, c.ampDecay, c.ampSustain, c.ampRelease);
    this.fenv.setTimes(c.fenvAttack, c.fenvDecay, c.fenvSustain, c.fenvRelease);
    this.ampEnv.noteOn();
    this.fenv.noteOn();
    // LFO mode is snapshotted per note so flipping the enum cannot click a
    // running voice; the fade ramp is keyed from this voice's start in both
    // modes.
    this.lfoNoteMode = (c.lfoRetrigger | 0) === LFO_RETRIGGER_NOTE;
    if (this.lfoNoteMode) this.ownLfo.reset();
    this.resetLfoFade();
    this.stealing = false;
    this.fadeGain = 1;
    this.pendingNote = -1;
    this.pendingGlideFrom = -1;
    this.state = VOICE_ACTIVE;
  }

  private resetLfoFade(): void {
    const fadeSec = this.ctl.lfoFadeSec;
    if (fadeSec > 1e-4) {
      this.lfoFade = 0;
      this.lfoFadeStep = 1 / (fadeSec * this.sampleRate);
    } else {
      this.lfoFade = 1;
      this.lfoFadeStep = 1;
    }
  }

  /** Same-note retrigger: envelopes restart from their current level. */
  retrigger(velocity: number, order: number): void {
    const c = this.ctl;
    this.velocity = velocity;
    this.order = order;
    this.velGain = 1 + c.ampVelocity * (velocity - 1);
    this.ampEnv.setTimes(c.ampAttack, c.ampDecay, c.ampSustain, c.ampRelease);
    this.fenv.setTimes(c.fenvAttack, c.fenvDecay, c.fenvSustain, c.fenvRelease);
    this.ampEnv.noteOn();
    this.fenv.noteOn();
    // A retrigger is a new note musically: restart the per-voice LFO cycle
    // and the depth fade (docs: "keyed per-voice from that voice's start").
    if (this.lfoNoteMode) this.ownLfo.reset();
    this.resetLfoFade();
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
  beginSteal(note: number, velocity: number, order: number, glideFrom: number): void {
    this.pendingNote = note;
    this.pendingVelocity = velocity;
    this.pendingOrder = order;
    this.pendingGlideFrom = glideFrom;
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
    this.svfL2.reset();
    this.svfR2.reset();
    this.stealing = false;
    this.fadeGain = 1;
    this.pendingNote = -1;
    this.pendingGlideFrom = -1;
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
          this.start(pending, this.pendingVelocity, this.pendingOrder, this.pendingGlideFrom);
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

    // Glide: exponential approach in semitone space, snapping when within a
    // tenth of a cent so a settled pitch is exact and denormal-free.
    if (this.glideNote !== this.note) {
      let gn = this.glideNote + this.glideCoeff * (this.note - this.glideNote);
      const d = this.note - gn;
      if (d < GLIDE_SNAP_SEMITONES && d > -GLIDE_SNAP_SEMITONES) gn = this.note;
      this.glideNote = gn;
      this.baseFreq = 440 * Math.pow(2, (gn - 69) / 12);
    }

    // Per-voice LFO value and depth fade.
    this.ownLfo.setWaveform(c.lfoWave);
    const lv = this.lfoNoteMode ? this.ownLfo.tick(c.lfoRateHz) : c.lfoGlobal;
    let fade = this.lfoFade;
    if (fade < 1) {
      fade += this.lfoFadeStep;
      if (fade >= 1) fade = 1;
      this.lfoFade = fade;
    }
    const pitchSemis = lv * c.depthPitch * LFO_PITCH_SEMITONES * fade;
    const pitchMul = pitchSemis === 0 ? 1 : Math.pow(2, pitchSemis / 12);
    const lfoCutOct = lv * c.depthCutoff * LFO_CUTOFF_OCTAVES * fade;
    const lfoAmpGain = 1 - c.depthAmp * (0.5 + 0.5 * lv) * fade;
    const lfoPan = lv * c.depthPan * fade;

    this.osc1.tick(this.baseFreq * c.osc1PitchMul * pitchMul, c.osc1Detune, c.osc1Pan);
    let mixL = this.osc1.outL * c.osc1Level;
    let mixR = this.osc1.outR * c.osc1Level;
    if (c.osc2Level > 1e-7) {
      this.osc2.tick(this.baseFreq * c.osc2PitchMul * pitchMul, c.osc2Detune, c.osc2Pan);
      mixL += this.osc2.outL * c.osc2Level;
      mixR += this.osc2.outR * c.osc2Level;
    }

    // Deterministic per-voice white noise (xorshift32), pre-drive/pre-filter.
    if (c.noiseLevel > 1e-7) {
      let s = this.noiseState;
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      this.noiseState = s;
      const nv = ((s / 0xffffffff) * 2 - 1) * c.noiseLevel;
      mixL += nv;
      mixR += nv;
    }

    // filter_drive: tanh saturation into the filter. Pre-gain g rises with
    // drive; 1/sqrt(g) makeup keeps loudness roughly constant (quiet material
    // gains what peaks lose). Blended by drive so 0 is a true passthrough.
    const drv = c.driveAmt;
    if (drv > 1e-7) {
      const dg = 1 + drv * DRIVE_PREGAIN_MAX;
      const mk = 1 / Math.sqrt(dg);
      const shL = Math.tanh(dg * mixL) * mk;
      const shR = Math.tanh(dg * mixR) * mk;
      mixL += drv * (shL - mixL);
      mixR += drv * (shR - mixR);
    }

    const cutOct =
      c.cutoffLog2 +
      (c.keytrack * (this.note - KEYTRACK_CENTER_NOTE)) / 12 +
      c.envAmt * fl * FILTER_ENV_OCTAVES +
      lfoCutOct;
    const g = svfCutoffG(Math.pow(2, cutOct), this.sampleRate);
    const k = c.resK;
    this.svfL.tick(mixL, g, k);
    this.svfR.tick(mixR, g, k);
    const f1L = c.gLp * this.svfL.low + c.gHp * this.svfL.high + c.gBp * this.svfL.band;
    const f1R = c.gLp * this.svfR.low + c.gHp * this.svfR.high + c.gBp * this.svfR.band;
    // Second identical stage for the 24 dB slope; always ticked so its state
    // stays warm and the slope crossfade (c.w24) can never click.
    this.svfL2.tick(f1L, g, SLOPE_STAGE2_K);
    this.svfR2.tick(f1R, g, SLOPE_STAGE2_K);
    const f2L = c.gLp * this.svfL2.low + c.gHp * this.svfL2.high + c.gBp * this.svfL2.band;
    const f2R = c.gLp * this.svfR2.low + c.gHp * this.svfR2.high + c.gBp * this.svfR2.band;
    const fL = f1L + c.w24 * (f2L - f1L);
    const fR = f1R + c.w24 * (f2R - f1R);

    const gain = amp * this.velGain * lfoAmpGain * this.fadeGain * VOICE_HEADROOM;

    // LFO pan as an equal-power stereo balance; unity at center.
    let p = lfoPan;
    if (p < -1) p = -1;
    if (p > 1) p = 1;
    const theta = (p + 1) * 0.5 * HALF_PI;
    this.outL = fL * gain * Math.cos(theta) * SQRT2;
    this.outR = fR * gain * Math.sin(theta) * SQRT2;
  }
}
