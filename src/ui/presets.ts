/**
 * User preset persistence. Pure logic over an injected storage object so
 * the round trip is unit-testable in node; the component passes
 * window.localStorage.
 *
 * Every preset read back from storage goes through the generated
 * validatePatchParams in full mode. Corrupt or out-of-bounds entries are
 * dropped, never clamped or repaired silently, per the project rules.
 */

import { validatePatchParams } from "../generated/params";
import type { ParamId, ParamValue } from "../generated/params";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PRESET_STORAGE_KEY = "synthonos.user-presets.v1";

export interface UserPreset {
  readonly name: string;
  readonly params: Record<ParamId, ParamValue>;
  readonly savedAt: number;
}

/**
 * Load and validate the user preset list. Anything malformed (bad JSON,
 * missing name, invalid or incomplete params, duplicate names) is
 * silently dropped so one corrupt entry never takes the browser down.
 */
export function loadUserPresets(storage: StorageLike): UserPreset[] {
  const raw = storage.getItem(PRESET_STORAGE_KEY);
  if (raw === null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const presets: UserPreset[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.trim() === "") continue;
    if (seen.has(record.name)) continue;
    if (validatePatchParams(record.params, "full").length > 0) continue;
    seen.add(record.name);
    presets.push({
      name: record.name,
      params: record.params as Record<ParamId, ParamValue>,
      savedAt: typeof record.savedAt === "number" ? record.savedAt : 0,
    });
  }
  return presets;
}

export function saveUserPresets(
  storage: StorageLike,
  presets: readonly UserPreset[],
): void {
  storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Add a preset, or replace the one with the same name. Returns a new
 * list; the input is not mutated. Throws if the params fail validation,
 * because saving a corrupt preset would poison every future load.
 */
export function upsertPreset(
  presets: readonly UserPreset[],
  name: string,
  params: Record<ParamId, ParamValue>,
  now: number = Date.now(),
): UserPreset[] {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new Error("Preset name cannot be empty");
  }
  const issues = validatePatchParams(params, "full");
  if (issues.length > 0) {
    throw new Error(
      `Refusing to save invalid preset: ${issues[0].param} ${issues[0].message}`,
    );
  }
  const entry: UserPreset = { name: trimmed, params: { ...params }, savedAt: now };
  const without = presets.filter((p) => p.name !== trimmed);
  return [...without, entry];
}

/**
 * Rename a preset. Returns a new list, or the original list unchanged if
 * the source is missing, the new name is empty, or the new name collides.
 */
export function renamePreset(
  presets: readonly UserPreset[],
  oldName: string,
  newName: string,
): UserPreset[] {
  const trimmed = newName.trim();
  if (trimmed === "" || trimmed === oldName) return [...presets];
  if (presets.some((p) => p.name === trimmed)) return [...presets];
  return presets.map((p) => (p.name === oldName ? { ...p, name: trimmed } : p));
}

export function deletePreset(
  presets: readonly UserPreset[],
  name: string,
): UserPreset[] {
  return presets.filter((p) => p.name !== name);
}
