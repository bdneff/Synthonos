/**
 * Synthonos engine: 16-voice virtual analog subtractive synth with a fixed
 * stereo effects chain.
 *
 * Composition: per voice, two unison wavetable oscillator banks (bandlimited
 * mipmaps, see wavetable.ts), a white noise source, a drive stage, a stereo
 * TPT state variable filter (12 or 24 dB/oct), and two ADSR envelopes; one
 * free-running LFO (or per-voice LFOs in "note" retrigger mode) and one set
 * of parameter smoothers shared per engine. After the voice sum the signal
 * runs once (not per voice) through the fixed effects chain
 * distortion -> chorus -> delay -> reverb (fixed order per the Sylenth
 * lesson, SYNTH_REFERENCE.md section 1), then mid/side width, then master
 * volume. Voice allocation is idle-first, then steal (releasing-and-quietest
 * first, then oldest sustaining, never the newest), with a short fade so
 * stealing is inaudible.
 *
 * Silence invariant: with no voice sounding and all effect tails decayed the
 * output returns to EXACT 0.0. A chain-level tail gate watches the chain
 * output whenever no voice is active; once it stays below TAIL_GATE_EPS for
 * TAIL_GATE_HOLD_SEC, every effect memory (delay lines, comb and allpass
 * buffers, chorus lines) is flushed to hard zero and the engine outputs
 * exact zeros until the next input.
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
 *   smoothed (delay_time is "smoothed" structurally: the delay crossfades
 *   read taps instead, which is what keeps knob moves pitch-artifact-free);
 *   enum switches crossfade or snapshot per note so they cannot click.
 * - Nothing here is random or time-dependent: renders are bit-exact.
 */

import {
  LFO_TARGET_AMP,
  LFO_TARGET_CUTOFF,
  LFO_TARGET_PAN,
  LFO_TARGET_PITCH,
  MAX_VOICES,
  OUTPUT_FLUSH_EPS,
  PARAM_SMOOTH_MS,
  REVERB_SIZE_SMOOTH_MS,
  TAIL_GATE_EPS,
  TAIL_GATE_HOLD_SEC,
} from "./constants";
import { Chorus } from "./chorus";
import { StereoDelay } from "./delay";
import { distortSample } from "./distortion";
import { Lfo } from "./lfo";
import { Reverb } from "./reverb";
import { Smoother } from "./smoother";
import { resonanceToQ } from "./svf";
import { ControlState, Voice, VOICE_IDLE } from "./voice";

/** Fallback delay time (s) before the host applies the real patch. */
const DELAY_TIME_FALLBACK_SEC = 0.35;

export class SynthEngine {
  readonly sampleRate: number;

  /** Raw engine-unit value per parameter id, as last set. */
  private params: { [id: string]: number };

  private readonly ctl: ControlState;
  private readonly voices: Voice[];
  private readonly lfo: Lfo;

  // Effects chain, run once per engine after the voice sum.
  private readonly chorus: Chorus;
  private readonly delay: StereoDelay;
  private readonly reverb: Reverb;
  /** delay_time in samples (raw; the delay crossfades between taps itself). */
  private delayTargetSamples: number;

  // Tail gate state (see the silence invariant in the header comment).
  private fxGated = true;
  private fxQuietRun = 0;
  private readonly tailGateHoldSamples: number;

  /** Before the first process() call, parameter changes snap instead of ramp. */
  private started = false;
  private noteCounter = 0;

  /** Most recently started/retriggered voice; glide starts from its pitch. */
  private lastVoice: Voice | null = null;
  /** Target note of the last noteOn, for glide when nothing is sounding. */
  private lastNoteTarget = -1;

  // Smoothers for every continuous parameter that reaches the audio path.
  private readonly smOsc1Cents: Smoother;
  private readonly smOsc2Cents: Smoother;
  private readonly smOsc1Level: Smoother;
  private readonly smOsc2Level: Smoother;
  private readonly smOsc1Pan: Smoother;
  private readonly smOsc2Pan: Smoother;
  private readonly smOsc1Detune: Smoother;
  private readonly smOsc2Detune: Smoother;
  private readonly smNoiseLevel: Smoother;
  private readonly smCutoffLog2: Smoother;
  private readonly smResonance: Smoother;
  private readonly smEnvAmt: Smoother;
  private readonly smKeytrack: Smoother;
  private readonly smDrive: Smoother;
  private readonly smSlope24: Smoother;
  private readonly smGLp: Smoother;
  private readonly smGHp: Smoother;
  private readonly smGBp: Smoother;
  private readonly smLfoRate: Smoother;
  private readonly smDepthCutoff: Smoother;
  private readonly smDepthPitch: Smoother;
  private readonly smDepthAmp: Smoother;
  private readonly smDepthPan: Smoother;
  private readonly smDistDrive: Smoother;
  private readonly smDistMix: Smoother;
  private readonly smChorusRate: Smoother;
  private readonly smChorusDepth: Smoother;
  private readonly smChorusMix: Smoother;
  private readonly smDelayFeedback: Smoother;
  private readonly smDelayMix: Smoother;
  private readonly smReverbSize: Smoother;
  private readonly smReverbDecay: Smoother;
  private readonly smReverbMix: Smoother;
  private readonly smWidth: Smoother;
  private readonly smMaster: Smoother;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.params = {};
    this.ctl = new ControlState();
    this.lfo = new Lfo(sampleRate);
    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i += 1) {
      this.voices.push(new Voice(sampleRate, this.ctl, i));
    }
    this.chorus = new Chorus(sampleRate);
    this.delay = new StereoDelay(sampleRate, DELAY_TIME_FALLBACK_SEC);
    this.reverb = new Reverb(sampleRate);
    this.delayTargetSamples = Math.round(DELAY_TIME_FALLBACK_SEC * sampleRate);
    this.tailGateHoldSamples = Math.max(1, Math.round(TAIL_GATE_HOLD_SEC * sampleRate));
    const ms = PARAM_SMOOTH_MS;
    this.smOsc1Cents = new Smoother(sampleRate, ms, 0);
    this.smOsc2Cents = new Smoother(sampleRate, ms, 0);
    this.smOsc1Level = new Smoother(sampleRate, ms, 0);
    this.smOsc2Level = new Smoother(sampleRate, ms, 0);
    this.smOsc1Pan = new Smoother(sampleRate, ms, 0);
    this.smOsc2Pan = new Smoother(sampleRate, ms, 0);
    this.smOsc1Detune = new Smoother(sampleRate, ms, 0);
    this.smOsc2Detune = new Smoother(sampleRate, ms, 0);
    this.smNoiseLevel = new Smoother(sampleRate, ms, 0);
    this.smCutoffLog2 = new Smoother(sampleRate, ms, this.ctl.cutoffLog2);
    this.smResonance = new Smoother(sampleRate, ms, 0);
    this.smEnvAmt = new Smoother(sampleRate, ms, 0);
    this.smKeytrack = new Smoother(sampleRate, ms, 0);
    this.smDrive = new Smoother(sampleRate, ms, 0);
    this.smSlope24 = new Smoother(sampleRate, ms, 1);
    this.smGLp = new Smoother(sampleRate, ms, 1);
    this.smGHp = new Smoother(sampleRate, ms, 0);
    this.smGBp = new Smoother(sampleRate, ms, 0);
    this.smLfoRate = new Smoother(sampleRate, ms, 1);
    this.smDepthCutoff = new Smoother(sampleRate, ms, 0);
    this.smDepthPitch = new Smoother(sampleRate, ms, 0);
    this.smDepthAmp = new Smoother(sampleRate, ms, 0);
    this.smDepthPan = new Smoother(sampleRate, ms, 0);
    this.smDistDrive = new Smoother(sampleRate, ms, 0);
    this.smDistMix = new Smoother(sampleRate, ms, 0);
    this.smChorusRate = new Smoother(sampleRate, ms, 1);
    this.smChorusDepth = new Smoother(sampleRate, ms, 0);
    this.smChorusMix = new Smoother(sampleRate, ms, 0);
    this.smDelayFeedback = new Smoother(sampleRate, ms, 0);
    this.smDelayMix = new Smoother(sampleRate, ms, 0);
    this.smReverbSize = new Smoother(sampleRate, REVERB_SIZE_SMOOTH_MS, 0.5);
    this.smReverbDecay = new Smoother(sampleRate, ms, 1);
    this.smReverbMix = new Smoother(sampleRate, ms, 0);
    this.smWidth = new Smoother(sampleRate, ms, 1);
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
      case "osc_noise_level":
        this.setSm(this.smNoiseLevel, value);
        break;
      case "glide_time":
        c.glideTime = value;
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
      case "filter_drive":
        this.setSm(this.smDrive, value);
        break;
      case "filter_slope":
        this.setSm(this.smSlope24, (value | 0) === 1 ? 1 : 0);
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
      case "amp_velocity":
        c.ampVelocity = value;
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
        c.lfoWave = value | 0;
        break;
      case "lfo_rate":
        this.setSm(this.smLfoRate, value);
        break;
      case "lfo_depth":
      case "lfo_target":
        this.updateLfoDepthTargets();
        break;
      case "lfo_fade":
        c.lfoFadeSec = value;
        break;
      case "lfo_retrigger":
        // Snapshotted per voice at note start, so a running voice never
        // switches LFO source mid-note (that would click).
        c.lfoRetrigger = value | 0;
        break;
      case "distortion_drive":
        this.setSm(this.smDistDrive, value);
        break;
      case "distortion_mix":
        this.setSm(this.smDistMix, value);
        break;
      case "chorus_rate":
        this.setSm(this.smChorusRate, value);
        break;
      case "chorus_depth":
        this.setSm(this.smChorusDepth, value);
        break;
      case "chorus_mix":
        this.setSm(this.smChorusMix, value);
        break;
      case "delay_time":
        // Not run through a Smoother on purpose: the delay crossfades between
        // the old and new read taps (see delay.ts), which is the only change
        // law that cannot pitch-shift the line's contents.
        this.delayTargetSamples = Math.round(value * this.sampleRate);
        break;
      case "delay_feedback":
        this.setSm(this.smDelayFeedback, value);
        break;
      case "delay_mix":
        this.setSm(this.smDelayMix, value);
        break;
      case "reverb_size":
        this.setSm(this.smReverbSize, value);
        break;
      case "reverb_decay":
        this.setSm(this.smReverbDecay, value);
        break;
      case "reverb_mix":
        this.setSm(this.smReverbMix, value);
        break;
      case "master_volume":
        this.setSm(this.smMaster, value);
        break;
      case "master_width":
        this.setSm(this.smWidth, value);
        break;
      default:
        break;
    }
  }

  getParam(id: string): number {
    const v = this.params[id];
    return v === undefined ? 0 : v;
  }

  /** Pitch a new note should glide from, or -1 to start exactly on pitch. */
  private glideSourcePitch(): number {
    const lv = this.lastVoice;
    if (lv !== null && lv.state !== VOICE_IDLE) return lv.glideNote;
    return this.lastNoteTarget;
  }

  noteOn(midiNote: number, velocity: number): void {
    if (midiNote < 0 || midiNote > 127 || velocity <= 0) return;
    this.noteCounter += 1;
    const order = this.noteCounter;
    const voices = this.voices;
    const glideFrom = this.glideSourcePitch();

    // Same-note retrigger: reuse the existing voice, envelopes ramp from
    // their current level (mono-per-note, reference 5.6). Glide state is
    // untouched: the voice is already at (or heading to) this pitch.
    for (let i = 0; i < voices.length; i += 1) {
      const vc = voices[i];
      if (vc.state !== VOICE_IDLE && !vc.stealing && vc.note === midiNote) {
        vc.retrigger(velocity, order);
        this.lastVoice = vc;
        this.lastNoteTarget = midiNote;
        return;
      }
    }

    // Idle voice first.
    for (let i = 0; i < voices.length; i += 1) {
      if (voices[i].state === VOICE_IDLE) {
        voices[i].start(midiNote, velocity, order, glideFrom);
        this.lastVoice = voices[i];
        this.lastNoteTarget = midiNote;
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
    if (chosen !== null) {
      chosen.beginSteal(midiNote, velocity, order, glideFrom);
      this.lastVoice = chosen;
      this.lastNoteTarget = midiNote;
    }
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
    c.noiseLevel = this.smNoiseLevel.tick();
    c.cutoffLog2 = this.smCutoffLog2.tick();
    c.resK = 1 / resonanceToQ(this.smResonance.tick());
    c.envAmt = this.smEnvAmt.tick();
    c.keytrack = this.smKeytrack.tick();
    c.driveAmt = this.smDrive.tick();
    c.w24 = this.smSlope24.tick();
    c.gLp = this.smGLp.tick();
    c.gHp = this.smGHp.tick();
    c.gBp = this.smGBp.tick();
    c.lfoRateHz = this.smLfoRate.tick();
    // The global LFO always runs so "free" mode stays truly free-running.
    c.lfoGlobal = this.lfo.tick(c.lfoRateHz);
    c.depthCutoff = this.smDepthCutoff.tick();
    c.depthPitch = this.smDepthPitch.tick();
    c.depthAmp = this.smDepthAmp.tick();
    c.depthPan = this.smDepthPan.tick();
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
      let anyActive = false;
      for (let v = 0; v < voices.length; v += 1) {
        const vc = voices[v];
        if (vc.state !== VOICE_IDLE) {
          vc.tick();
          sumL += vc.outL;
          sumR += vc.outR;
          if (vc.state !== VOICE_IDLE) anyActive = true;
        }
      }

      // Effects parameter smoothers tick every sample, gated or not, so
      // knob moves keep converging during silence.
      const distDrive = this.smDistDrive.tick();
      const distMix = this.smDistMix.tick();
      const chorusRate = this.smChorusRate.tick();
      const chorusDepth = this.smChorusDepth.tick();
      const chorusMix = this.smChorusMix.tick();
      const delayFb = this.smDelayFeedback.tick();
      const delayMix = this.smDelayMix.tick();
      const reverbSize = this.smReverbSize.tick();
      const reverbDecay = this.smReverbDecay.tick();
      const reverbMix = this.smReverbMix.tick();
      const width = this.smWidth.tick();
      const master = this.smMaster.tick();

      let l = sumL;
      let r = sumR;
      const inputActive = anyActive || l !== 0 || r !== 0;
      if (inputActive) {
        this.fxGated = false;
        this.fxQuietRun = 0;
      }

      if (!this.fxGated) {
        // Fixed chain: distortion -> chorus -> delay -> reverb. Each wet
        // path blends as y = x + mix * (wet - x); a mix settled on exact 0
        // skips the blend entirely, so mix-0 is a bit-exact passthrough.
        if (distMix > 0) {
          l += distMix * (distortSample(l, distDrive) - l);
          r += distMix * (distortSample(r, distDrive) - r);
        }
        this.chorus.tick(l, r, chorusRate, chorusDepth);
        if (chorusMix > 0) {
          l += chorusMix * (this.chorus.wetL - l);
          r += chorusMix * (this.chorus.wetR - r);
        }
        this.delay.tick(l, r, this.delayTargetSamples, delayFb);
        if (delayMix > 0) {
          l += delayMix * (this.delay.outL - l);
          r += delayMix * (this.delay.outR - r);
        }
        this.reverb.tick(l, r, reverbSize, reverbDecay);
        if (reverbMix > 0) {
          l += reverbMix * (this.reverb.wetL - l);
          r += reverbMix * (this.reverb.wetR - r);
        }

        // Tail gate: no voice sounding and the chain output has stayed
        // below the threshold long enough -> flush every effect memory and
        // clamp to exact zero from here on. "Long enough" includes the
        // delay's longest active loop, because a feedback delay outputs
        // legitimate silence between echoes; only after a full quiet loop
        // is everything still stored in the line provably below threshold.
        if (!inputActive) {
          const magL = l < 0 ? -l : l;
          const magR = r < 0 ? -r : r;
          if (magL < TAIL_GATE_EPS && magR < TAIL_GATE_EPS) {
            this.fxQuietRun += 1;
            let holdSamples = this.tailGateHoldSamples + this.delay.maxTapSamples();
            if (this.delayTargetSamples > this.delay.maxTapSamples()) {
              holdSamples = this.tailGateHoldSamples + this.delayTargetSamples;
            }
            if (this.fxQuietRun >= holdSamples) {
              this.chorus.reset();
              this.delay.reset();
              this.reverb.reset();
              this.fxGated = true;
              l = 0;
              r = 0;
            }
          } else {
            this.fxQuietRun = 0;
          }
        }
      } else {
        l = 0;
        r = 0;
      }

      // Mid/side width, then master volume. width 1 skips the transform so
      // the default image is untouched down to the bit.
      if (width !== 1) {
        const mid = (l + r) * 0.5;
        const side = (l - r) * 0.5 * width;
        l = mid + side;
        r = mid - side;
      }
      l *= master;
      r *= master;
      if (l < OUTPUT_FLUSH_EPS && l > -OUTPUT_FLUSH_EPS) l = 0;
      if (r < OUTPUT_FLUSH_EPS && r > -OUTPUT_FLUSH_EPS) r = 0;
      outLeft[i] = l;
      outRight[i] = r;
    }
  }
}
