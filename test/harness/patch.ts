/**
 * Bridge between preset files (validated, enums as strings) and the engine
 * (numbers only). Lives in the harness rather than src/dsp so the engine
 * stays import-free.
 */

import {
  PARAM_IDS,
  toEngineValue,
  validatePatchParams,
  type ParamId,
  type ParamValue,
} from "../../src/generated/params";
import defaultPreset from "../../src/generated/default-preset.json";

export function patchParamsToEngine(
  params: Record<ParamId, ParamValue>,
): Record<string, number> {
  const issues = validatePatchParams(params, "full");
  if (issues.length > 0) {
    const detail = issues.map((i) => `${i.param}: ${i.message}`).join("; ");
    throw new Error(`invalid patch params: ${detail}`);
  }
  const out: Record<string, number> = {};
  for (const id of PARAM_IDS) {
    out[id] = toEngineValue(id, params[id]);
  }
  return out;
}

export const DEFAULT_PATCH_PARAMS_ENGINE: Record<string, number> = patchParamsToEngine(
  defaultPreset.params as Record<ParamId, ParamValue>,
);
