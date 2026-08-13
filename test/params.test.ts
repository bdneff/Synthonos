/**
 * The generated parameter layer: validation must reject, never clamp, and the
 * default preset must validate against its own schema.
 */

import { describe, it, expect } from "vitest";
import {
  PARAM_IDS,
  PARAMS,
  validatePatchParams,
  toEngineValue,
  ENGINE_DEFAULTS,
} from "../src/generated/params";
import defaultPreset from "../src/generated/default-preset.json";

describe("generated parameter layer", () => {
  it("default preset validates with zero issues", () => {
    expect(validatePatchParams(defaultPreset.params, "full")).toEqual([]);
  });

  it("every parameter's default is within its bounds", () => {
    for (const id of PARAM_IDS) {
      const meta = PARAMS[id];
      expect(meta.default).toBeGreaterThanOrEqual(meta.min);
      expect(meta.default).toBeLessThanOrEqual(meta.max);
    }
  });

  it("rejects out-of-bounds values instead of clamping", () => {
    const issues = validatePatchParams({ filter_cutoff: 25000 }, "partial");
    expect(issues.length).toBe(1);
    expect(issues[0].param).toBe("filter_cutoff");
    expect(issues[0].message).toContain("outside");
  });

  it("rejects unknown parameters", () => {
    const issues = validatePatchParams({ mystery_knob: 1 }, "partial");
    expect(issues.some((i) => i.param === "mystery_knob")).toBe(true);
  });

  it("rejects non-integer values for int parameters", () => {
    const issues = validatePatchParams({ osc1_octave: 1.5 }, "partial");
    expect(issues.some((i) => i.message.includes("integer"))).toBe(true);
  });

  it("rejects invalid enum options and NaN", () => {
    expect(
      validatePatchParams({ osc1_waveform: "wobbly" }, "partial").length,
    ).toBe(1);
    expect(validatePatchParams({ filter_cutoff: NaN }, "partial").length).toBe(1);
  });

  it("requires every parameter in full mode only", () => {
    expect(validatePatchParams({}, "partial")).toEqual([]);
    const fullIssues = validatePatchParams({}, "full");
    expect(fullIssues.length).toBe(PARAM_IDS.length);
  });

  it("maps enum option names to engine indices", () => {
    expect(toEngineValue("osc1_waveform", "sine")).toBe(0);
    expect(toEngineValue("osc1_waveform", "saw")).toBe(2);
    expect(() => toEngineValue("osc1_waveform", "wobbly")).toThrow(/invalid enum/);
    expect(toEngineValue("filter_cutoff", 800)).toBe(800);
  });

  it("engine defaults agree with preset defaults", () => {
    for (const id of PARAM_IDS) {
      const meta = PARAMS[id];
      const presetValue = (defaultPreset.params as Record<string, unknown>)[id];
      if (meta.type === "enum") {
        expect(meta.values?.[ENGINE_DEFAULTS[id]]).toBe(presetValue);
      } else {
        expect(ENGINE_DEFAULTS[id]).toBe(presetValue);
      }
    }
  });
});
