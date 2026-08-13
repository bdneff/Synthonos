/**
 * DSP-side constants, including mirrors of the schema's enum orders.
 *
 * src/dsp may not import src/generated (no imports outside src/dsp), so the
 * enum option orders are mirrored here as plain arrays. A test outside
 * src/dsp (test/dsp-constants.test.ts) asserts these mirrors match the
 * generated metadata, so drift fails CI instead of detuning the engine.
 */

/** Mirror of params.schema.json osc*_waveform values, in index order. */
export const OSC_WAVEFORM_VALUES = ["sine", "triangle", "saw", "square"];
export const WAVE_SINE = 0;
export const WAVE_TRIANGLE = 1;
export const WAVE_SAW = 2;
export const WAVE_SQUARE = 3;

/** Mirror of params.schema.json filter_type values, in index order. */
export const FILTER_TYPE_VALUES = ["lowpass", "highpass", "bandpass"];
export const FILTER_LOWPASS = 0;
export const FILTER_HIGHPASS = 1;
export const FILTER_BANDPASS = 2;

/** Mirror of params.schema.json lfo_waveform values, in index order. */
export const LFO_WAVEFORM_VALUES = [
  "sine",
  "triangle",
  "saw",
  "square",
  "sample_hold",
];
export const LFO_WAVE_SINE = 0;
export const LFO_WAVE_TRIANGLE = 1;
export const LFO_WAVE_SAW = 2;
export const LFO_WAVE_SQUARE = 3;
export const LFO_WAVE_SAMPLE_HOLD = 4;

/** Mirror of params.schema.json lfo_target values, in index order. */
export const LFO_TARGET_VALUES = ["none", "cutoff", "pitch", "amp", "pan"];
export const LFO_TARGET_NONE = 0;
export const LFO_TARGET_CUTOFF = 1;
export const LFO_TARGET_PITCH = 2;
export const LFO_TARGET_AMP = 3;
export const LFO_TARGET_PAN = 4;

/** Mirror of params.schema.json filter_slope values, in index order. */
export const FILTER_SLOPE_VALUES = ["12", "24"];
export const FILTER_SLOPE_12 = 0;
export const FILTER_SLOPE_24 = 1;

/** Mirror of params.schema.json lfo_retrigger values, in index order. */
export const LFO_RETRIGGER_VALUES = ["free", "note"];
export const LFO_RETRIGGER_FREE = 0;
export const LFO_RETRIGGER_NOTE = 1;

// ---------------------------------------------------------------------------
// Engine sizing and behavior constants
// ---------------------------------------------------------------------------

export const MAX_VOICES = 16;
export const MAX_UNISON = 8;

/** One-pole parameter smoothing time constant in milliseconds. */
export const PARAM_SMOOTH_MS = 5;

/** LFO output slew time constant (ms): keeps square / sample-hold click-free. */
export const LFO_SLEW_MS = 1.5;

/** Fast fade applied to a voice before it is reused by stealing (seconds). */
export const STEAL_FADE_SEC = 0.003;

/** Waveform-switch crossfade length (seconds). */
export const WAVE_XFADE_SEC = 0.005;

/**
 * Amp envelope level below which a releasing voice snaps to exact zero and
 * frees itself. -80 dB relative to the envelope's own full scale.
 */
export const ENV_KILL_LEVEL = 1e-4;

/** Attack aims at this overshoot target and clamps at 1.0 (see reference 5.5). */
export const ENV_ATTACK_TARGET = 1.3;

/** knob time = time to reach 1.0 given the overshoot target: ln(1.3 / 0.3). */
export const ENV_ATTACK_TIME_FACTOR = 1.4663370687934272;

/** knob time = time to fall within 0.1% of target: ln(1000). */
export const ENV_EXP_TIME_FACTOR = 6.907755278982137;

/** filter_env_amount at +/-1 sweeps the cutoff by this many octaves. */
export const FILTER_ENV_OCTAVES = 6;

/** lfo_depth 1 with target "pitch" is a vibrato of +/- this many semitones. */
export const LFO_PITCH_SEMITONES = 2;

/** lfo_depth 1 with target "cutoff" sweeps +/- this many octaves. */
export const LFO_CUTOFF_OCTAVES = 3;

/** How far unison edge voices are pushed toward the sides, in pan units. */
export const UNISON_STEREO_SPREAD = 0.6;

/**
 * Per-voice headroom so 16 voices sum without slamming the output, and so a
 * bandlimited saw/square edge stays under the harness click threshold at
 * unity patch levels.
 */
export const VOICE_HEADROOM = 0.25;

/**
 * Deterministic unison start phases (never random: golden renders are
 * bit-exact). Low-discrepancy golden-ratio sequence; voice 0 starts at 0.5,
 * which is the zero crossing of the saw and sine tables.
 */
export const UNISON_PHASES = [
  0.5, 0.11803398875, 0.7360679775, 0.35410196625, 0.972135955, 0.59016994375,
  0.2082039325, 0.82623792125,
];

/** Filter/LFO internal state below this magnitude is flushed to hard zero. */
export const DENORMAL_EPS = 1e-25;

/** Final output below this magnitude is flushed to hard zero (float32 safety). */
export const OUTPUT_FLUSH_EPS = 1e-30;

/** MIDI note whose pitch the filter keytrack is anchored to (middle C). */
export const KEYTRACK_CENTER_NOTE = 60;

// ---------------------------------------------------------------------------
// Phase 3: drive, glide, noise, per-voice LFO
// ---------------------------------------------------------------------------

/**
 * filter_drive 1 pushes the filter input through tanh with this much extra
 * pre-gain (g = 1 + drive * DRIVE_PREGAIN_MAX). Makeup is 1/sqrt(g) so quiet
 * signals gain roughly what loud peaks lose and loudness does not balloon.
 */
export const DRIVE_PREGAIN_MAX = 5;

/**
 * glide_time at or below this is treated as "off": new notes start exactly
 * on pitch (the schema minimum is 0.001 s, i.e. no audible portamento).
 */
export const GLIDE_JUMP_SEC = 0.0015;

/** Glide snaps to the target when within this many semitones (0.1 cents). */
export const GLIDE_SNAP_SEMITONES = 1e-3;

/** Per-voice white-noise xorshift seeds, derived from the voice index. */
export const NOISE_SEED_BASE = 0x9e3779b9;
export const NOISE_SEED_STEP = 0x85ebca6b;

// ---------------------------------------------------------------------------
// Phase 3: effects chain (fixed order: distortion -> chorus -> delay ->
// reverb, per the Sylenth fixed-chain lesson in SYNTH_REFERENCE.md section 1)
// ---------------------------------------------------------------------------

/** distortion_drive 1 maps to this much tanh pre-gain (g = 1 + drive * it). */
export const DIST_PREGAIN_MAX = 9;

/** Chorus center delay and maximum modulation excursion, in seconds. */
export const CHORUS_BASE_SEC = 0.015;
export const CHORUS_MOD_SEC = 0.006;

/** Maximum delay_time supported by the preallocated delay lines (schema max). */
export const DELAY_MAX_SEC = 2;

/**
 * Delay-time changes crossfade between the old and new read taps over this
 * long instead of slewing the read pointer, so moving the knob can never
 * pitch-shift the audio in the line.
 */
export const DELAY_XFADE_SEC = 0.05;

/**
 * Schroeder reverb tunings (M. R. Schroeder, "Natural Sounding Artificial
 * Reverberation", JAES 1962): four parallel combs into two series allpasses
 * per channel. Lengths in seconds so the topology is sample-rate independent;
 * right-channel lengths are offset slightly for decorrelation.
 */
export const REVERB_COMB_SEC = [0.0297, 0.0371, 0.0411, 0.0437];
export const REVERB_COMB_R_OFFSET_SEC = [0.00067, 0.00071, 0.00059, 0.00083];
export const REVERB_ALLPASS_SEC = [0.005, 0.0017];
export const REVERB_ALLPASS_R_OFFSET_SEC = [0.00023, 0.00013];
export const REVERB_ALLPASS_G = 0.5;

/** reverb_size 0..1 scales every reverb delay length between these bounds. */
export const REVERB_SIZE_SCALE_MIN = 0.4;
export const REVERB_SIZE_SCALE_MAX = 1.3;

/** Mild in-loop lowpass damping so the Schroeder tail is less metallic. */
export const REVERB_DAMP = 0.2;

/** Comb feedback ceiling, regardless of what reverb_decay asks for. */
export const REVERB_MAX_FEEDBACK = 0.98;

/** Wet gain applied to the summed combs. */
export const REVERB_COMB_GAIN = 0.25;

/**
 * Effects tail gate: when no voice is sounding and the chain's own output
 * stays below TAIL_GATE_EPS for the hold period, all effect memories are
 * flushed to zero and the engine outputs exact 0.0. This preserves the
 * silence invariant (silence means EXACT zero, never merely quiet) with
 * feedback effects in the chain.
 *
 * The hold period is TAIL_GATE_HOLD_SEC plus the delay's longest active tap:
 * a feedback delay legitimately outputs silence between echoes, so "quiet
 * for one full loop plus margin" is the shortest safe proof that everything
 * still stored in any loop is itself below the threshold. The base hold must
 * exceed the longest reverb comb loop (~57 ms at max size) for the same
 * reason.
 */
export const TAIL_GATE_EPS = 1e-6;
export const TAIL_GATE_HOLD_SEC = 0.1;

/** Reverb size moves slowly (ms) so length changes stay artifact-free-ish. */
export const REVERB_SIZE_SMOOTH_MS = 50;
