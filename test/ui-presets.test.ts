/**
 * Preset persistence: save/load round trips validate, corrupt storage is
 * rejected entry by entry, rename and delete behave. Uses an in-memory
 * storage double; no DOM.
 */

import { describe, expect, it } from "vitest";
import {
  PRESET_STORAGE_KEY,
  deletePreset,
  loadUserPresets,
  renamePreset,
  saveUserPresets,
  upsertPreset,
} from "../src/ui/presets";
import type { StorageLike, UserPreset } from "../src/ui/presets";
import defaultPreset from "../src/generated/default-preset.json";
import type { ParamId, ParamValue } from "../src/generated/params";

type Patch = Record<ParamId, ParamValue>;

const VALID_PARAMS = defaultPreset.params as unknown as Patch;

class FakeStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("preset persistence", () => {
  it("round trips a saved preset through storage", () => {
    const storage = new FakeStorage();
    const list = upsertPreset([], "Warm pad", VALID_PARAMS, 1234);
    saveUserPresets(storage, list);
    const loaded = loadUserPresets(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("Warm pad");
    expect(loaded[0].savedAt).toBe(1234);
    expect(loaded[0].params).toEqual(VALID_PARAMS);
  });

  it("returns an empty list for missing or unparseable storage", () => {
    const storage = new FakeStorage();
    expect(loadUserPresets(storage)).toEqual([]);
    storage.setItem(PRESET_STORAGE_KEY, "{not json");
    expect(loadUserPresets(storage)).toEqual([]);
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadUserPresets(storage)).toEqual([]);
  });

  it("drops corrupt entries but keeps valid ones", () => {
    const storage = new FakeStorage();
    const good: UserPreset = { name: "Good", params: VALID_PARAMS, savedAt: 1 };
    const outOfBounds = {
      name: "Too loud",
      params: { ...VALID_PARAMS, master_volume: 2 },
      savedAt: 2,
    };
    const unknownParam = {
      name: "Mystery",
      // A name that can never become a real schema parameter.
      params: { ...VALID_PARAMS, definitely_not_a_real_param: 0.5 },
      savedAt: 3,
    };
    const missingParam = (() => {
      const params: Record<string, ParamValue> = { ...VALID_PARAMS };
      delete params.filter_cutoff;
      return { name: "Incomplete", params, savedAt: 4 };
    })();
    const wrongEnum = {
      name: "Bad wave",
      params: { ...VALID_PARAMS, osc1_waveform: "wavetable" },
      savedAt: 5,
    };
    const nameless = { params: VALID_PARAMS, savedAt: 6 };
    storage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify([
        good,
        outOfBounds,
        unknownParam,
        missingParam,
        wrongEnum,
        nameless,
        "not an object",
        null,
      ]),
    );
    const loaded = loadUserPresets(storage);
    expect(loaded.map((p) => p.name)).toEqual(["Good"]);
  });

  it("drops duplicate names on load, keeping the first", () => {
    const storage = new FakeStorage();
    storage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify([
        { name: "Twin", params: VALID_PARAMS, savedAt: 1 },
        { name: "Twin", params: VALID_PARAMS, savedAt: 2 },
      ]),
    );
    const loaded = loadUserPresets(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].savedAt).toBe(1);
  });

  it("upsert replaces an existing preset with the same name", () => {
    const list = upsertPreset([], "Bass", VALID_PARAMS, 1);
    const changed = { ...VALID_PARAMS, filter_cutoff: 500 };
    const next = upsertPreset(list, "Bass", changed, 2);
    expect(next).toHaveLength(1);
    expect(next[0].params.filter_cutoff).toBe(500);
    expect(next[0].savedAt).toBe(2);
  });

  it("upsert refuses invalid params and empty names", () => {
    expect(() =>
      upsertPreset([], "Broken", { ...VALID_PARAMS, filter_cutoff: -5 }),
    ).toThrow();
    expect(() => upsertPreset([], "   ", VALID_PARAMS)).toThrow();
  });

  it("renames without allowing collisions", () => {
    const list = upsertPreset(upsertPreset([], "One", VALID_PARAMS, 1), "Two", VALID_PARAMS, 2);
    const renamed = renamePreset(list, "One", "Uno");
    expect(renamed.map((p) => p.name).sort()).toEqual(["Two", "Uno"]);
    const collision = renamePreset(renamed, "Uno", "Two");
    expect(collision.map((p) => p.name).sort()).toEqual(["Two", "Uno"]);
    const empty = renamePreset(renamed, "Uno", "   ");
    expect(empty.map((p) => p.name).sort()).toEqual(["Two", "Uno"]);
  });

  it("deletes by name", () => {
    const list = upsertPreset(upsertPreset([], "One", VALID_PARAMS, 1), "Two", VALID_PARAMS, 2);
    const next = deletePreset(list, "One");
    expect(next.map((p) => p.name)).toEqual(["Two"]);
    expect(deletePreset(next, "Ghost")).toHaveLength(1);
  });
});
