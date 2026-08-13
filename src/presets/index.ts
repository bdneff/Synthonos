/**
 * Factory preset bank loader. The bank lives in factory.json (40 presets,
 * organized by vibe per build plan section 8); this module gives it a typed,
 * validated shape for the UI. Pure module: no storage, no DOM, no side
 * effects beyond evaluating the JSON import.
 *
 * Every preset is validated with the generated validator in full mode at
 * load. A factory bank that fails validation is a build defect, so this
 * throws rather than silently dropping entries the way user-preset loading
 * does; test/presets-factory.test.ts keeps this from ever reaching users.
 */

import factoryJson from "./factory.json";
import { validatePatchParams } from "../generated/params";
import type { ParamId, ParamValue } from "../generated/params";

export interface FactoryPreset {
  readonly name: string;
  readonly category: string;
  readonly params: Record<ParamId, ParamValue>;
}

function toFactoryPresets(raw: unknown): FactoryPreset[] {
  if (!Array.isArray(raw)) {
    throw new Error("factory presets: expected an array");
  }
  const seen = new Set<string>();
  const presets: FactoryPreset[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("factory presets: entry is not an object");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.trim() === "") {
      throw new Error("factory presets: entry with missing name");
    }
    if (typeof record.category !== "string" || record.category.trim() === "") {
      throw new Error(`factory preset "${record.name}": missing category`);
    }
    if (seen.has(record.name)) {
      throw new Error(`factory preset "${record.name}": duplicate name`);
    }
    const issues = validatePatchParams(record.params, "full");
    if (issues.length > 0) {
      throw new Error(
        `factory preset "${record.name}": ${issues[0].param} ${issues[0].message}`,
      );
    }
    seen.add(record.name);
    presets.push({
      name: record.name,
      category: record.category,
      params: record.params as Record<ParamId, ParamValue>,
    });
  }
  return presets;
}

export const FACTORY_PRESETS: readonly FactoryPreset[] =
  toFactoryPresets(factoryJson);

/** Category names in bank order, deduplicated, for group headers. */
export const FACTORY_CATEGORIES: readonly string[] = FACTORY_PRESETS.reduce<
  string[]
>((cats, preset) => {
  if (!cats.includes(preset.category)) cats.push(preset.category);
  return cats;
}, []);
