/**
 * Synthonos engine: 16-voice virtual analog subtractive synth.
 *
 * Composition: per voice, two unison wavetable oscillator banks (bandlimited
 * mipmaps, see wavetable.ts), a stereo TPT state variable filter, and two
 * ADSR envelopes; one free-running LFO and one set of parameter smoothers
 * shared per engine; master volume last. Voice allocation is idle-first, then
 * steal (releasing-and-quietest first, then oldest sustaining, never the
 * newest), with a short fade so stealing is inaudible.
 *
 * Hard rules for this directory (see CLAUDE.md):
 * - Only relative imports of sibling src/dsp modules. This code must remain
 *   mechanically portable to Rust, so it speaks only in numbers, strings, and
 *   Float32Array.
 * - process() never allocates, logs, throws, or awaits.
 * - The sample rate is whatever the constructor was given. Never assume 44100.
 * - Parameter values arrive in engine units: floats and ints as-is, enums as
 *   their option index. Mapping from preset files happens outside the engine
 *   via the generated toEngineValue(). Every continuous parameter change is
 *   smoothed; enum switches crossfade or slew so they cannot click.
 * - Nothing here is random or time-dependent: renders are bit-exact.
 */

import {
  LFO_CUTOFF_OCTAVES,
  LFO_PITCH_SEMITONES,
  LFO_TARGET_AMP,
  LFO_TARGET_CUTOFF,
  LFO_TARGET_PAN,
  LFO_TARGET_PITCH,
  MAX_VOICES,
  OUTPUT_FLUSH_EPS,
  PARAM_SMOOTH_MS,
} from "./constants";
import { Lfo } from "./lfo";
import { Smoother } from "./smoother";
import { resonanceToQ } from "./svf";
import { ControlState, Voice, VOICE_IDLE } from "./voice";

export class SynthEngine {
  readonly sampleRate: number;

  /** Raw engine-unit value per parameter id, as last set. */
  private params: { [id: string]: number };

  private readonly ctl: ControlState;
  private readonly voices: Voice[];
  private readonly lfo: Lfo;

  /** Before the first process() call, parameter changes snap instead of ramp. */
  private started = false;
  private noteCounter = 0;

  // Smoothers for every continuous parameter that reaches the audio path.
  private readonly smOsc1Cents: Smoother;
  private readonly smOsc2Cents: Smoother;
  private readonly smOsc1Level: Smoother;
  private readonly smOsc2Level: Smoother;
  private readonly smOsc1Pan: Smoother;
  private readonly smOsc2Pan: Smoother;
  private readonly smOsc1Detune: Smoother;
  private readonly smOsc2Detune: Smoother;
  private readonly smCutoffLog2: Smoother;
  private readonly smResonance: Smoother;
  private readonly smEnvAmt: Smoother;
  private readonly smKeytrack: Smoother;
  private readonly smGLp: Smoother;
  private readonly smGHp: Smoother;
  private readonly smGBp: Smoother;
  private readonly smLfoRate: Smoother;
  private readonly smDepthCutoff: Smoother;
  private readonly smDepthPitch: Smoother;
  private readonly smDepthAmp: Smoother;
  private readonly smDepthPan: Smoother;
  private readonly smMaster: Smoother;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.params = {};
    this.ctl = new ControlState();
    this.lfo = new Lfo(sampleRate);
    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i += 1) {
      this.voices.push(new Voice(sampleRate, this.ctl));
    }
    const ms = PARAM_SMOOTH_MS;
    this.smOsc1Cents = new Smoother(sampleRate, ms, 0);
    this.smOsc2Cents = new Smoother(sampleRate, ms, 0);
    this.smOsc1Level = new Smoother(sampleRate, ms, 0);
    this.smOsc2Level = new Smoother(sampleRate, ms, 0);
    this.smOsc1Pan = new Smoother(sampleRate, ms, 0);
    this.smOsc2Pan = new Smoother(sampleRate, ms, 0);
    this.smOsc1Detune = new Smoother(sampleRate, ms, 0);
    this.smOsc2Detune = new Smoother(sampleRate, ms, 0);
    this.smCutoffLog2 = new Smoother(sampleRate, ms, this.ctl.cutoffLog2);
    this.smResonance = new Smoother(sampleRate, ms, 0);
    this.smEnvAmt = new Smoother(sampleRate, ms, 0);
    this.smKeytrack = new Smoother(sampleRate, ms, 0);
    this.smGLp = new Smoother(sampleRate, ms, 1);
    this.smGHp = new Smoother(sampleRate, ms, 0);
    this.smGBp = new Smoother(sampleRate, ms, 0);
    this.smLfoRate = new Smoother(sampleRate, ms, 1);
    this.smDepthCutoff = new Smoother(sampleRate, ms, 0);
    this.smDepthPitch = new Smoother(sampleRate, ms, 0);
    this.smDepthAmp = new Smoother(sampleRate, ms, 0);
    this.smDepthPan = new Smoother(sampleRate, ms, 0);
    this.smMaster = new Smoother(sampleRate, ms, 0);
  }

  private setSm(sm: Smoother, value: number): void {
    if (this.started) sm.setTarget(value);
    else sm.snap(value);
  }

  private rawParam(id: string, fallback: number): number {
    const v = this.params[id];
    return v === undefined ? fallback : v;
  }

  private updatePitchTarget(osc: 1 | 2): void {
    const prefix = osc === 1 ? "osc1" : "osc2";
    const cents =
      this.rawParam(`${prefix}_octave`, 0) * 1200 +
      this.rawParam(`${prefix}_semitone`, 0) * 100 +
      this.rawParam(`${prefix}_fine`, 0);
    this.setSm(osc === 1 ? this.smOsc1Cents : this.smOsc2Cents, cents);
  }

  private updateLfoDepthTargets(): void {
    const target = this.rawParam("lfo_target", 0) | 0;
    const depth = this.rawParam("lfo_depth", 0);
    this.setSm(this.smDepthCutoff, target === LFO_TARGET_CUTOFF ? depth : 0);
    this.setSm(this.smDepthPitch, target === LFO_TARGET_PITCH ? depth : 0);
    this.setSm(this.smDepthAmp, target === LFO_TARGET_AMP ? depth : 0);
    this.setSm(this.smDepthPan, target === LFO_TARGET_PAN ? depth : 0);
  }

  private setFilterTypeTargets(type: number): void {
    this.setSm(this.smGLp, type === 0 ? 1 : 0);
    this.setSm(this.smGHp, type === 1 ? 1 : 0);
    this.setSm(this.smGBp, type === 2 ? 1 : 0);
  }

  private setOscWaveform(osc: 1 | 2, wave: number): void {
    let w = wave | 0;
    if (w < 0) w = 0;
    if (w > 3) w = 3;
    if (osc === 1) this.ctl.osc1Wave = w;
    else this.ctl.osc2Wave = w;
    // Running voices crossfade to the new shape; idle voices pick it up from
    // ControlState at their next start().
    for (let i = 0; i < this.voices.length; i += 1) {
      const vc = this.voices[i];
      if (vc.state !== VOICE_IDLE) {
        if (osc === 1) vc.setOsc1Waveform(w);
        else vc.setOsc2Waveform(w);
      }
    }
  }

  /**
   * Set a parameter in engine units. Unknown ids are ignored here; validation
   * happens at the boundary (preset load, NL edit) before values reach the
   * audio thread.
   */
  setParam(id: string, value: number): void {
    this.params[id] = value;
    const c = this.ctl;
    switch (id) {
      case "osc1_waveform":
        this.setOscWaveform(1, value);
        break;
      case "osc2_waveform":
        this.setOscWaveform(2, value);
        break;
      case "osc1_octave":
      case "osc1_semitone":
      case "osc1_fine":
        this.updatePitchTarget(1);
        break;
      case "osc2_octave":
      case "osc2_semitone":
      case "osc2_fine":
        this.updatePitchTarget(2);
        break;
      case "osc1_level":
        this.setSm(this.smOsc1Level, value);
        break;
      case "osc2_level":
        this.setSm(this.smOsc2Level, value);
        break;
      case "osc1_pan":
        this.setSm(this.smOsc1Pan, value);
        break;
      case "osc2_pan":
        this.setSm(this.smOsc2Pan, value);
        break;
      case "osc1_unison_voices":
        c.uni1 = value | 0;
        break;
      case "osc2_unison_voices":
        c.uni2 = value | 0;
        break;
      case "osc1_unison_detune":
        this.setSm(this.smOsc1Detune, value);
        break;
      case "osc2_unison_detune":
        this.setSm(this.smOsc2Detune, value);
        break;
      case "filter_type":
        this.setFilterTypeTargets(value | 0);
        break;
      case "filter_cutoff":
        this.setSm(this.smCutoffLog2, Math.log2(value > 1 ? value : 1));
        break;
      case "filter_resonance":
        this.setSm(this.smResonance, value);
        break;
      case "filter_env_amount":
        this.setSm(this.smEnvAmt, value);
        break;
      case "filter_keytrack":
        this.setSm(this.smKeytrack, value);
        break;
      case "amp_attack":
        c.ampAttack = value;
        break;
      case "amp_decay":
        c.ampDecay = value;
        break;
      case "amp_sustain":
        c.ampSustain = value;
        break;
      case "amp_release":
        c.ampRelease = value;
        break;
      case "fenv_attack":
        c.fenvAttack = value;
        break;
      case "fenv_decay":
        c.fenvDecay = value;
        break;
      case "fenv_sustain":
        c.fenvSustain = value;
        break;
      case "fenv_release":
        c.fenvRelease = value;
        break;
      case "lfo_waveform":
        this.lfo.setWaveform(value | 0);
        break;
      case "lfo_rate":
        this.setSm(this.smLfoRate, value);
        break;
      case "lfo_depth":
      case "lfo_target":
        this.updateLfoDepthTargets();
        break;
      case "master_volume":
        this.setSm(this.smMaster, value);
        break;
      default:
        break;
    }
  }

  getParam(id: string): number {
    const v = this.params[id];
    return v === undefined ? 0 : v;
  }

  noteOn(midiNote: number, velocity: number): void {
    if (midiNote < 0 || midiNote > 127 || velocity <= 0) return;
    this.noteCounter += 1;
    const order = this.noteCounter;
    const voices = this.voices;

    // Same-note retrigger: reuse the existing voice, envelopes ramp from
    // their current level (mono-per-note, reference 5.6).
    for (let i = 0; i < voices.length; i += 1) {
      const vc = voices[i];
      if (vc.state !== VOICE_IDLE && !vc.stealing && vc.note === midiNote) {
        vc.retrigger(velocity, order);
        return;
      }
    }

    // Idle voice first.
    for (let i = 0; i < voices.length; i += 1) {
      if (voices[i].state === VOICE_IDLE) {
        voices[i].start(midiNote, velocity, order);
        return;
      }
    }

    // Steal: releasing and quietest first.
    let chosen: Voice | null = null;
    for (let i = 0; i < voices.length; i += 1) {
      const vc = voices[i];
      if (vc.stealing || !vc.isReleasing()) continue;
      if (chosen === null || vc.ampLevel() < chosen.ampLevel()) chosen = vc;
    }
    // Then the oldest sustaining voice; picking the minimum order can never
    // pick the newest note while more than one candidate exists.
    if (chosen === null) {
      for (let i = 0; i < voices.length; i += 1) {
        const vc = voices[i];
        if (vc.stealing) continue;
        if (chosen === null || vc.order < chosen.order) chosen = vc;
      }
    }
    // Every voice is already mid-steal: replace the pending note on the one
    // that will free up first (lowest order).
    if (chosen === null) {
      for (let i = 0; i < voices.length; i += 1) {
        const vc = voices[i];
        if (chosen === null || vc.order < chosen.order) chosen = vc;
      }
    }
    if (chosen !== null) chosen.beginSteal(midiNote, velocity, order);
  }

  noteOff(midiNote: number): void {
    const voices = this.voices;
    for (let i = 0; i < voices.length; i += 1) {
      const vc = voices[i];
      if (vc.state === VOICE_IDLE) continue;
      if (vc.cancelPending(midiNote)) continue;
      if (!vc.stealing && vc.note === midiNote) vc.noteOff();
    }
  }

  /** Update the shared per-sample control values from smoothers and LFO. */
  private updateControl(): void {
    const c = this.ctl;
    c.osc1PitchMul = Math.pow(2, this.smOsc1Cents.tick() / 1200);
    c.osc2PitchMul = Math.pow(2, this.smOsc2Cents.tick() / 1200);
    c.osc1Level = this.smOsc1Level.tick();
    c.osc2Level = this.smOsc2Level.tick();
    c.osc1Pan = this.smOsc1Pan.tick();
    c.osc2Pan = this.smOsc2Pan.tick();
    c.osc1Detune = this.smOsc1Detune.tick();
    c.osc2Detune = this.smOsc2Detune.tick();
    c.cutoffLog2 = this.smCutoffLog2.tick();
    c.resK = 1 / resonanceToQ(this.smResonance.tick());
    c.envAmt = this.smEnvAmt.tick();
    c.keytrack = this.smKeytrack.tick();
    c.gLp = this.smGLp.tick();
    c.gHp = this.smGHp.tick();
    c.gBp = this.smGBp.tick();
    const lv = this.lfo.tick(this.smLfoRate.tick());
    c.lfoCutOct = lv * this.smDepthCutoff.tick() * LFO_CUTOFF_OCTAVES;
    c.lfoPitchMul = Math.pow(2, (lv * this.smDepthPitch.tick() * LFO_PITCH_SEMITONES) / 12);
    c.lfoAmpGain = 1 - this.smDepthAmp.tick() * (0.5 + 0.5 * lv);
    c.lfoPan = lv * this.smDepthPan.tick();
  }

  /**
   * Render one block into the given stereo buffers. Runs on the audio thread:
   * no allocation, no logging, no throwing, no async.
   */
  process(outLeft: Float32Array, outRight: Float32Array): void {
    this.started = true;
    const voices = this.voices;
    const n = outLeft.length < outRight.length ? outLeft.length : outRight.length;
    for (let i = 0; i < n; i += 1) {
      this.updateControl();
      let sumL = 0;
      let sumR = 0;
      for (let v = 0; v < voices.length; v += 1) {
        const vc = voices[v];
        if (vc.state !== VOICE_IDLE) {
          vc.tick();
          sumL += vc.outL;
          sumR += vc.outR;
        }
      }
      const m = this.smMaster.tick();
      let l = sumL * m;
      let r = sumR * m;
      if (l < OUTPUT_FLUSH_EPS && l > -OUTPUT_FLUSH_EPS) l = 0;
      if (r < OUTPUT_FLUSH_EPS && r > -OUTPUT_FLUSH_EPS) r = 0;
      outLeft[i] = l;
      outRight[i] = r;
    }
  }
}
