/**
 * Normalization helpers used by knobs and macros: round trips, log curve
 * feel, clamping, and display formatting. Pure logic, no DOM.
 */

import { describe, expect, it } from "vitest";
import {
  clamp01,
  denormalizeValue,
  formatParamValue,
  humanizeOption,
  normalizeValue,
} from "../src/ui/param-utils";
import { PARAMS, PARAM_IDS } from "../src/generated/params";

describe("normalize/denormalize", () => {
  it("round trips every numeric parameter default", () => {
    for (const id of PARAM_IDS) {
      const meta = PARAMS[id];
      if (meta.type === "enum") continue;
      const spec = { min: meta.min, max: meta.max, curve: meta.curve };
      const norm = normalizeValue(spec, meta.default);
      const back = denormalizeValue(spec, norm, meta.type === "int");
      expect(back).toBeCloseTo(meta.default, 6);
    }
  });

  it("maps range endpoints to 0 and 1", () => {
    const cutoff = PARAMS.filter_cutoff;
    const spec = { min: cutoff.min, max: cutoff.max, curve: cutoff.curve };
    expect(normalizeValue(spec, cutoff.min)).toBe(0);
    expect(normalizeValue(spec, cutoff.max)).toBe(1);
    expect(denormalizeValue(spec, 0)).toBe(cutoff.min);
    expect(denormalizeValue(spec, 1)).toBe(cutoff.max);
  });

  it("puts the log midpoint at the geometric mean, not the average", () => {
    const spec = { min: 20, max: 20000, curve: "log" as const };
    const mid = denormalizeValue(spec, 0.5);
    expect(mid).toBeCloseTo(Math.sqrt(20 * 20000), 3);
  });

  it("never leaves the schema range, even for out of range norms", () => {
    const spec = { min: 0.01, max: 10, curve: "log" as const };
    expect(denormalizeValue(spec, -0.5)).toBe(0.01);
    expect(denormalizeValue(spec, 1.5)).toBe(10);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
  });

  it("rounds integer parameters", () => {
    const voices = PARAMS.osc1_unison_voices;
    const spec = { min: voices.min, max: voices.max, curve: voices.curve };
    const v = denormalizeValue(spec, 0.37, true);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(voices.min);
    expect(v).toBeLessThanOrEqual(voices.max);
  });
});

describe("display formatting", () => {
  it("formats frequencies for musicians", () => {
    expect(formatParamValue("filter_cutoff", 12000)).toBe("12.0 kHz");
    expect(formatParamValue("filter_cutoff", 440)).toBe("440 Hz");
    expect(formatParamValue("lfo_rate", 1)).toBe("1.00 Hz");
  });

  it("formats times in ms below one second", () => {
    expect(formatParamValue("amp_attack", 0.005)).toBe("5 ms");
    expect(formatParamValue("amp_release", 2)).toBe("2.00 s");
  });

  it("formats plain 0..1 floats as percent", () => {
    expect(formatParamValue("osc1_level", 0.8)).toBe("80%");
    expect(formatParamValue("filter_env_amount", 0.5)).toBe("+50%");
    expect(formatParamValue("osc1_pan", -1)).toBe("-100%");
  });

  it("shows enum option names with spaces", () => {
    expect(formatParamValue("lfo_waveform", "sample_hold")).toBe("sample hold");
    expect(humanizeOption("saw")).toBe("saw");
  });
});
