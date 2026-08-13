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
