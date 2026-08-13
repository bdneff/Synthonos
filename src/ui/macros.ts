/**
 * Layer 2: the eight macro knobs. Each macro drives a weighted bundle of
 * real schema parameters, declared here and nowhere else. Only generated
 * ParamIds may appear; the compiler enforces it and test/ui-macros.test.ts
 * double-checks bounds at the extremes.
 *
 * How a macro move works (gesture-relative, so a loaded preset keeps its
 * character): when the user grabs a macro we capture the current patch as
 * the base. As the macro moves from `from` to `to`, each target parameter
 * shifts in NORMALIZED space by (curve(to) - curve(from)) * weight, then
 * clamps into its schema range. So a macro nudge is a nudge, never a jump
 * to some absolute position. Enum targets shift by index the same way.
 *
 * Pure logic, no React, no DOM.
 */

import { PARAMS } from "../generated/params";
import type { ParamId, ParamValue, PatchEdit } from "../generated/params";
import {
  clamp01,
  clampRange,
  denormalizeValue,
  normalizeValue,
} from "./param-utils";

export type MacroId =
  | "brightness"
  | "thickness"
  | "movement"
  | "attack"
  | "space"
  | "grit"
  | "width"
  | "character";

export type MacroCurve = "linear" | "easeIn" | "easeOut";

export interface MacroTarget {
  readonly paramId: ParamId;
  /** -1..1. Positive: macro up moves the parameter up its range. */
  readonly weight: number;
  /** Optional response shape for this target. Default "linear". */
  readonly curve?: MacroCurve;
}

export interface MacroDef {
  readonly id: MacroId;
  readonly name: string;
  /** Plain language tooltip, written for a musician. */
  readonly description: string;
  readonly targets: readonly MacroTarget[];
}

/** Macro knobs rest here; moving away from center nudges the bundle. */
export const MACRO_DEFAULT = 0.5;

export const MACROS: readonly MacroDef[] = [
  {
    id: "brightness",
    name: "Brightness",
    description:
      "Opens or darkens the tone. Up is crisp and open, down is warm and muffled.",
    targets: [
      { paramId: "filter_cutoff", weight: 1.0 },
      { paramId: "filter_keytrack", weight: 0.25 },
    ],
  },
  {
    id: "thickness",
    name: "Thickness",
    description:
      "Stacks extra voices and blends in oscillator B. Up sounds bigger and fatter.",
    targets: [
      { paramId: "osc1_unison_voices", weight: 1.0 },
      { paramId: "osc1_unison_detune", weight: 0.35 },
      { paramId: "osc2_unison_voices", weight: 0.6 },
      { paramId: "osc2_level", weight: 0.45 },
      { paramId: "osc1_level", weight: 0.1 },
    ],
  },
  {
    id: "movement",
    name: "Movement",
    description:
      "Adds wobble from the LFO. Up brings the sound to life, down holds it still.",
    targets: [
      { paramId: "lfo_depth", weight: 1.0 },
      { paramId: "lfo_rate", weight: 0.25 },
      // Pushing Movement up nudges the LFO onto the filter so the wobble
      // is audible even when the target was "none".
      { paramId: "lfo_target", weight: 0.3 },
    ],
  },
  {
    id: "attack",
    name: "Attack",
    description:
      "How the note starts. Down is an instant snap, up is a slow fade in.",
    targets: [
      { paramId: "amp_attack", weight: 1.0 },
      { paramId: "fenv_attack", weight: 0.5 },
    ],
  },
  {
    id: "space",
    name: "Space",
    description:
      "Spreads the sound out and lets it ring longer after you let go.",
    // TODO(schema): the ideal targets are reverb size/decay/mix, which do
    // not exist yet. See docs/SYNTH_REFERENCE.md section 6 (item 8,
    // effects parameters). Until then: pan spread, unison detune, and
    // longer releases are the best available stand-ins.
    targets: [
      { paramId: "osc1_pan", weight: -0.5 },
      { paramId: "osc2_pan", weight: 0.5 },
      { paramId: "amp_release", weight: 0.4 },
      { paramId: "fenv_release", weight: 0.25 },
      { paramId: "osc1_unison_detune", weight: 0.2 },
    ],
  },
  {
    id: "grit",
    name: "Grit",
    description:
      "Roughens the tone with resonance and edge. Down is smooth and polite.",
    // TODO(schema): the ideal targets are filter_drive and a distortion
    // effect. See docs/SYNTH_REFERENCE.md section 6 (items 1 and 8).
    // Until then: resonance, a waveform bias toward the buzzier shapes,
    // and a touch of fine detune roughness stand in.
    targets: [
      { paramId: "filter_resonance", weight: 0.6, curve: "easeIn" },
      { paramId: "osc1_waveform", weight: 0.35 },
      { paramId: "osc1_fine", weight: 0.15 },
    ],
  },
  {
    id: "width",
    name: "Width",
    description:
      "How far the sound spreads between the left and right speakers.",
    // TODO(schema): a master_width (mid/side) control would do this
    // properly. See docs/SYNTH_REFERENCE.md section 6 (item 9). Until
    // then: oscillator pan spread plus unison detune.
    targets: [
      { paramId: "osc1_pan", weight: -0.6 },
      { paramId: "osc2_pan", weight: 0.6 },
      { paramId: "osc1_unison_detune", weight: 0.45 },
      { paramId: "osc2_unison_detune", weight: 0.45 },
      { paramId: "osc1_unison_voices", weight: 0.3 },
    ],
  },
  {
    id: "character",
    name: "Character",
    description:
      "Adds bite and color from the filter envelope and oscillator B.",
    targets: [
      { paramId: "filter_env_amount", weight: 0.4 },
      { paramId: "filter_resonance", weight: 0.2 },
      { paramId: "osc2_level", weight: 0.3 },
      { paramId: "fenv_decay", weight: 0.25 },
      { paramId: "osc1_fine", weight: 0.1 },
    ],
  },
];

export const MACRO_IDS: readonly MacroId[] = MACROS.map((m) => m.id);

function applyMacroCurve(m: number, curve: MacroCurve | undefined): number {
  const x = clamp01(m);
  switch (curve) {
    case "easeIn":
      return x * x;
    case "easeOut":
      return 1 - (1 - x) * (1 - x);
    default:
      return x;
  }
}

/**
 * Compute the partial patch produced by moving `def` from macro position
 * `from` to `to` (both 0..1), relative to the `base` patch captured when
 * the gesture started. Every returned value is guaranteed inside its
 * schema range; enum values are returned as option-name strings.
 */
export function computeMacroEdit(
  def: MacroDef,
  base: Readonly<Record<ParamId, ParamValue>>,
  from: number,
  to: number,
): PatchEdit {
  const edit: PatchEdit = {};
  for (const target of def.targets) {
    const meta = PARAMS[target.paramId];
    const delta =
      applyMacroCurve(to, target.curve) - applyMacroCurve(from, target.curve);
    if (Math.abs(delta) < 1e-9) continue;

    if (meta.type === "enum") {
      const values = meta.values ?? [];
      const count = values.length;
      if (count < 2) continue;
      const baseValue = base[target.paramId];
      let index =
        typeof baseValue === "string" ? values.indexOf(baseValue) : -1;
      if (index < 0) index = meta.default;
      const shifted = index + delta * target.weight * (count - 1);
      const next = Math.round(clampRange(shifted, 0, count - 1));
      edit[target.paramId] = values[next];
      continue;
    }

    const baseValue = base[target.paramId];
    const baseNumber =
      typeof baseValue === "number" && Number.isFinite(baseValue)
        ? baseValue
        : meta.default;
    const spec = { min: meta.min, max: meta.max, curve: meta.curve };
    const norm = normalizeValue(spec, baseNumber);
    const nextNorm = clamp01(norm + delta * target.weight);
    edit[target.paramId] = denormalizeValue(spec, nextNorm, meta.type === "int");
  }
  return edit;
}
