/**
 * GENERATED FILE. Do not edit by hand.
 * Source of truth: params.schema.json. Regenerate with: npm run codegen
 */

/* eslint-disable */

export type ParamId =
  | "osc1_waveform"
  | "osc1_octave"
  | "osc1_semitone"
  | "osc1_fine"
  | "osc1_level"
  | "osc1_pan"
  | "osc1_unison_voices"
  | "osc1_unison_detune"
  | "osc2_waveform"
  | "osc2_octave"
  | "osc2_semitone"
  | "osc2_fine"
  | "osc2_level"
  | "osc2_pan"
  | "osc2_unison_voices"
  | "osc2_unison_detune"
  | "filter_type"
  | "filter_cutoff"
  | "filter_resonance"
  | "filter_env_amount"
  | "filter_keytrack"
  | "amp_attack"
  | "amp_decay"
  | "amp_sustain"
  | "amp_release"
  | "fenv_attack"
  | "fenv_decay"
  | "fenv_sustain"
  | "fenv_release"
  | "lfo_waveform"
  | "lfo_rate"
  | "lfo_depth"
  | "lfo_target"
  | "master_volume"
;

export type ParamType = "float" | "int" | "enum";
export type ParamCurve = "linear" | "log";

export interface ParamMeta {
  readonly id: ParamId;
  readonly label: string;
  readonly group: string;
  readonly type: ParamType;
  /** Present only for enum params: the ordered option names. */
  readonly values?: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly curve: ParamCurve;
  readonly unit: string;
  readonly nlAliases: readonly string[];
  readonly nlDirection: string;
}

export const PARAM_IDS = [
  "osc1_waveform",
  "osc1_octave",
  "osc1_semitone",
  "osc1_fine",
  "osc1_level",
  "osc1_pan",
  "osc1_unison_voices",
  "osc1_unison_detune",
  "osc2_waveform",
  "osc2_octave",
  "osc2_semitone",
  "osc2_fine",
  "osc2_level",
  "osc2_pan",
  "osc2_unison_voices",
  "osc2_unison_detune",
  "filter_type",
  "filter_cutoff",
  "filter_resonance",
  "filter_env_amount",
  "filter_keytrack",
  "amp_attack",
  "amp_decay",
  "amp_sustain",
  "amp_release",
  "fenv_attack",
  "fenv_decay",
  "fenv_sustain",
  "fenv_release",
  "lfo_waveform",
  "lfo_rate",
  "lfo_depth",
  "lfo_target",
  "master_volume",
] as const;

export const PARAMS: Readonly<Record<ParamId, ParamMeta>> = {
  "osc1_waveform": { id: "osc1_waveform", label: "Waveform", group: "Oscillator A", type: "enum", values: ["sine","triangle","saw","square"], min: 0, max: 3, default: 2, curve: "linear", unit: "", nlAliases: ["shape","tone character","buzzy","smooth","hollow"], nlDirection: "sine is purest, saw is buzziest and brightest, square is hollow" },
  "osc1_octave": { id: "osc1_octave", label: "Octave", group: "Oscillator A", type: "int", min: -3, max: 3, default: 0, curve: "linear", unit: "oct", nlAliases: ["register","low","high","sub","bass","deep"], nlDirection: "higher is a higher register; negative values go toward bass and sub territory" },
  "osc1_semitone": { id: "osc1_semitone", label: "Semitone", group: "Oscillator A", type: "int", min: -12, max: 12, default: 0, curve: "linear", unit: "st", nlAliases: ["pitch offset","interval","transpose"], nlDirection: "higher shifts pitch up in semitone steps" },
  "osc1_fine": { id: "osc1_fine", label: "Fine", group: "Oscillator A", type: "float", min: -100, max: 100, default: 0, curve: "linear", unit: "cents", nlAliases: ["detune","drift","beating"], nlDirection: "further from zero drifts the pitch and creates slow beating against other oscillators" },
  "osc1_level": { id: "osc1_level", label: "Level", group: "Oscillator A", type: "float", min: 0, max: 1, default: 0.8, curve: "linear", unit: "", nlAliases: ["volume","loudness","presence","balance"], nlDirection: "higher is louder" },
  "osc1_pan": { id: "osc1_pan", label: "Pan", group: "Oscillator A", type: "float", min: -1, max: 1, default: 0, curve: "linear", unit: "", nlAliases: ["stereo position","left","right","placement"], nlDirection: "negative is left, positive is right, zero is center" },
  "osc1_unison_voices": { id: "osc1_unison_voices", label: "Unison", group: "Oscillator A", type: "int", min: 1, max: 8, default: 1, curve: "linear", unit: "voices", nlAliases: ["thickness","fatness","supersaw","stacked","big"], nlDirection: "more voices is thicker and bigger; 1 is a single plain voice" },
  "osc1_unison_detune": { id: "osc1_unison_detune", label: "Detune", group: "Oscillator A", type: "float", min: 0, max: 100, default: 15, curve: "linear", unit: "cents", nlAliases: ["spread","width","lushness","wobble","chorus"], nlDirection: "higher spreads the unison voices further apart, sounding wider and lusher; too high sounds out of tune" },
  "osc2_waveform": { id: "osc2_waveform", label: "Waveform", group: "Oscillator B", type: "enum", values: ["sine","triangle","saw","square"], min: 0, max: 3, default: 2, curve: "linear", unit: "", nlAliases: ["shape","tone character","buzzy","smooth","hollow"], nlDirection: "sine is purest, saw is buzziest and brightest, square is hollow" },
  "osc2_octave": { id: "osc2_octave", label: "Octave", group: "Oscillator B", type: "int", min: -3, max: 3, default: 0, curve: "linear", unit: "oct", nlAliases: ["register","low","high","sub","bass","deep"], nlDirection: "higher is a higher register; negative values go toward bass and sub territory" },
  "osc2_semitone": { id: "osc2_semitone", label: "Semitone", group: "Oscillator B", type: "int", min: -12, max: 12, default: 0, curve: "linear", unit: "st", nlAliases: ["pitch offset","interval","transpose","fifth","octave up"], nlDirection: "higher shifts pitch up in semitone steps; +7 is a fifth, +12 an octave" },
  "osc2_fine": { id: "osc2_fine", label: "Fine", group: "Oscillator B", type: "float", min: -100, max: 100, default: 0, curve: "linear", unit: "cents", nlAliases: ["detune","drift","beating"], nlDirection: "further from zero drifts the pitch and creates slow beating against oscillator A" },
  "osc2_level": { id: "osc2_level", label: "Level", group: "Oscillator B", type: "float", min: 0, max: 1, default: 0, curve: "linear", unit: "", nlAliases: ["volume","loudness","presence","balance","layer"], nlDirection: "higher is louder; zero turns oscillator B off" },
  "osc2_pan": { id: "osc2_pan", label: "Pan", group: "Oscillator B", type: "float", min: -1, max: 1, default: 0, curve: "linear", unit: "", nlAliases: ["stereo position","left","right","placement"], nlDirection: "negative is left, positive is right, zero is center" },
  "osc2_unison_voices": { id: "osc2_unison_voices", label: "Unison", group: "Oscillator B", type: "int", min: 1, max: 8, default: 1, curve: "linear", unit: "voices", nlAliases: ["thickness","fatness","supersaw","stacked","big"], nlDirection: "more voices is thicker and bigger; 1 is a single plain voice" },
  "osc2_unison_detune": { id: "osc2_unison_detune", label: "Detune", group: "Oscillator B", type: "float", min: 0, max: 100, default: 15, curve: "linear", unit: "cents", nlAliases: ["spread","width","lushness","wobble","chorus"], nlDirection: "higher spreads the unison voices further apart, sounding wider and lusher; too high sounds out of tune" },
  "filter_type": { id: "filter_type", label: "Type", group: "Filter", type: "enum", values: ["lowpass","highpass","bandpass"], min: 0, max: 2, default: 0, curve: "linear", unit: "", nlAliases: ["filter mode","dark","thin","nasal"], nlDirection: "lowpass removes highs (darker), highpass removes lows (thinner), bandpass keeps only the middle (nasal, telephone-like)" },
  "filter_cutoff": { id: "filter_cutoff", label: "Cutoff", group: "Filter", type: "float", min: 20, max: 20000, default: 12000, curve: "log", unit: "Hz", nlAliases: ["brightness","darkness","openness","muffled","tone","dull","crisp"], nlDirection: "higher is brighter and more open; lower is darker and more muffled" },
  "filter_resonance": { id: "filter_resonance", label: "Resonance", group: "Filter", type: "float", min: 0, max: 1, default: 0.1, curve: "linear", unit: "", nlAliases: ["peak","squelch","acid","whistle","emphasis","sharpness"], nlDirection: "higher emphasizes the cutoff frequency, from subtle sharpening to a squelchy acid whistle" },
  "filter_env_amount": { id: "filter_env_amount", label: "Env Amount", group: "Filter", type: "float", min: -1, max: 1, default: 0, curve: "linear", unit: "", nlAliases: ["filter movement","sweep","pluck","wah","bite"], nlDirection: "further from zero makes the filter envelope sweep the cutoff more; positive opens then closes (plucky), negative closes then opens" },
  "filter_keytrack": { id: "filter_keytrack", label: "Keytrack", group: "Filter", type: "float", min: 0, max: 1, default: 0.5, curve: "linear", unit: "", nlAliases: ["key follow","even brightness across keys"], nlDirection: "higher makes high notes open the filter more, keeping brightness consistent up the keyboard" },
  "amp_attack": { id: "amp_attack", label: "Attack", group: "Amp Envelope", type: "float", min: 0.001, max: 5, default: 0.005, curve: "log", unit: "s", nlAliases: ["softness","fade in","swell","punchy","immediate"], nlDirection: "higher fades the note in slowly (pads, swells); lower snaps instantly (plucks, keys, punch)" },
  "amp_decay": { id: "amp_decay", label: "Decay", group: "Amp Envelope", type: "float", min: 0.01, max: 10, default: 0.5, curve: "log", unit: "s", nlAliases: ["fall time","pluckiness","percussive"], nlDirection: "lower falls to the sustain level faster, sounding more percussive and plucky" },
  "amp_sustain": { id: "amp_sustain", label: "Sustain", group: "Amp Envelope", type: "float", min: 0, max: 1, default: 0.8, curve: "linear", unit: "", nlAliases: ["held level","body","staccato","sustained"], nlDirection: "higher holds the note at a louder level while the key is down; zero makes every note die away like a pluck" },
  "amp_release": { id: "amp_release", label: "Release", group: "Amp Envelope", type: "float", min: 0.01, max: 10, default: 0.2, curve: "log", unit: "s", nlAliases: ["tail","ring out","abrupt","lingering"], nlDirection: "higher lets the note ring out after the key is released; lower cuts it off quickly" },
  "fenv_attack": { id: "fenv_attack", label: "Attack", group: "Filter Envelope", type: "float", min: 0.001, max: 5, default: 0.005, curve: "log", unit: "s", nlAliases: ["sweep in","opening speed"], nlDirection: "higher makes the filter open gradually after the note starts" },
  "fenv_decay": { id: "fenv_decay", label: "Decay", group: "Filter Envelope", type: "float", min: 0.01, max: 10, default: 0.3, curve: "log", unit: "s", nlAliases: ["pluck length","bite length","wow"], nlDirection: "lower makes the filter sweep close quickly, giving a short plucky bite" },
  "fenv_sustain": { id: "fenv_sustain", label: "Sustain", group: "Filter Envelope", type: "float", min: 0, max: 1, default: 0.2, curve: "linear", unit: "", nlAliases: ["held brightness"], nlDirection: "higher keeps the filter more open while the key is held" },
  "fenv_release": { id: "fenv_release", label: "Release", group: "Filter Envelope", type: "float", min: 0.01, max: 10, default: 0.2, curve: "log", unit: "s", nlAliases: ["closing tail"], nlDirection: "higher lets the filter close slowly after the key is released" },
  "lfo_waveform": { id: "lfo_waveform", label: "Waveform", group: "LFO", type: "enum", values: ["sine","triangle","saw","square","sample_hold"], min: 0, max: 4, default: 0, curve: "linear", unit: "", nlAliases: ["wobble shape","smooth wobble","choppy","random"], nlDirection: "sine and triangle wobble smoothly, square chops on and off, sample and hold jumps randomly" },
  "lfo_rate": { id: "lfo_rate", label: "Rate", group: "LFO", type: "float", min: 0.01, max: 20, default: 1, curve: "log", unit: "Hz", nlAliases: ["speed","wobble speed","slow drift","fast flutter","vibrato speed"], nlDirection: "higher wobbles faster; very low is a slow drift, very high is a nervous flutter" },
  "lfo_depth": { id: "lfo_depth", label: "Depth", group: "LFO", type: "float", min: 0, max: 1, default: 0, curve: "linear", unit: "", nlAliases: ["movement","wobble amount","intensity","vibrato amount","static"], nlDirection: "higher is more movement; zero is completely still" },
  "lfo_target": { id: "lfo_target", label: "Target", group: "LFO", type: "enum", values: ["none","cutoff","pitch","amp","pan"], min: 0, max: 4, default: 0, curve: "linear", unit: "", nlAliases: ["what moves","wah","vibrato","tremolo","auto-pan"], nlDirection: "cutoff gives wah and wobble, pitch gives vibrato, amp gives tremolo, pan sweeps side to side" },
  "master_volume": { id: "master_volume", label: "Volume", group: "Master", type: "float", min: 0, max: 1, default: 0.7, curve: "linear", unit: "", nlAliases: ["overall volume","output","quieter","louder"], nlDirection: "higher is louder overall" },
};

/**
 * Preset file value: numbers for float/int params, option name strings
 * for enum params. The engine itself only ever sees numbers; use
 * toEngineValue to convert.
 */
export type ParamValue = number | string;

export interface Patch {
  name: string;
  params: Record<ParamId, ParamValue>;
}

/** A partial edit, e.g. the result of a natural language request. */
export type PatchEdit = Partial<Record<ParamId, ParamValue>>;

export interface ValidationIssue {
  param: string;
  message: string;
}

/**
 * Validate a patch params object. Out of bounds values are REJECTED,
 * never clamped silently. mode "full" requires every parameter to be
 * present; mode "partial" allows any subset (used for NL edits).
 */
export function validatePatchParams(
  params: unknown,
  mode: "full" | "partial",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return [{ param: "", message: "params must be a plain object" }];
  }
  const rec = params as Record<string, unknown>;
  const known = new Set<string>(PARAM_IDS);
  for (const key of Object.keys(rec)) {
    if (!known.has(key)) issues.push({ param: key, message: "unknown parameter" });
  }
  for (const id of PARAM_IDS) {
    const meta = PARAMS[id];
    if (!Object.prototype.hasOwnProperty.call(rec, id)) {
      if (mode === "full") issues.push({ param: id, message: "missing parameter" });
      continue;
    }
    const v = rec[id];
    if (meta.type === "enum") {
      const values = meta.values ?? [];
      if (typeof v !== "string" || !values.includes(v)) {
        issues.push({
          param: id,
          message: `must be one of: ${values.join(", ")}`,
        });
      }
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      issues.push({ param: id, message: "must be a finite number" });
      continue;
    }
    if (v < meta.min || v > meta.max) {
      issues.push({
        param: id,
        message: `${v} outside [${meta.min}, ${meta.max}]`,
      });
      continue;
    }
    if (meta.type === "int" && !Number.isInteger(v)) {
      issues.push({ param: id, message: "must be an integer" });
    }
  }
  return issues;
}

/**
 * Convert a validated preset value to the number the engine consumes.
 * Enum option names become their index. Throws on invalid input; call
 * validatePatchParams first.
 */
export function toEngineValue(id: ParamId, value: ParamValue): number {
  const meta = PARAMS[id];
  if (meta.type === "enum") {
    const values = meta.values ?? [];
    const idx = typeof value === "string" ? values.indexOf(value) : -1;
    if (idx === -1) throw new Error(`invalid enum value for ${id}: ${String(value)}`);
    return idx;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`invalid value for ${id}: ${String(value)}`);
  }
  return value;
}

/** Default value in engine units (enums as indices), keyed by id. */
export const ENGINE_DEFAULTS: Readonly<Record<ParamId, number>> = {
  "osc1_waveform": 2,
  "osc1_octave": 0,
  "osc1_semitone": 0,
  "osc1_fine": 0,
  "osc1_level": 0.8,
  "osc1_pan": 0,
  "osc1_unison_voices": 1,
  "osc1_unison_detune": 15,
  "osc2_waveform": 2,
  "osc2_octave": 0,
  "osc2_semitone": 0,
  "osc2_fine": 0,
  "osc2_level": 0,
  "osc2_pan": 0,
  "osc2_unison_voices": 1,
  "osc2_unison_detune": 15,
  "filter_type": 0,
  "filter_cutoff": 12000,
  "filter_resonance": 0.1,
  "filter_env_amount": 0,
  "filter_keytrack": 0.5,
  "amp_attack": 0.005,
  "amp_decay": 0.5,
  "amp_sustain": 0.8,
  "amp_release": 0.2,
  "fenv_attack": 0.005,
  "fenv_decay": 0.3,
  "fenv_sustain": 0.2,
  "fenv_release": 0.2,
  "lfo_waveform": 0,
  "lfo_rate": 1,
  "lfo_depth": 0,
  "lfo_target": 0,
  "master_volume": 0.7,
};
