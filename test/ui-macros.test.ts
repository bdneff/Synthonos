/**
 * Macro layer safety: every macro target references a real generated
 * ParamId, weights are sane, and driving any macro to either extreme from
 * any reachable base patch produces values the generated validator
 * accepts. Pure logic, no DOM.
 */

import { describe, expect, it } from "vitest";
import {
  MACROS,
  MACRO_DEFAULT,
  computeMacroEdit,
} from "../src/ui/macros";
import {
  PARAMS,
  PARAM_IDS,
  validatePatchParams,
} from "../src/generated/params";
import type { ParamId, ParamValue } from "../src/generated/params";
import defaultPreset from "../src/generated/default-preset.json";

type Patch = Record<ParamId, ParamValue>;

const DEFAULT_PATCH = defaultPreset.params as unknown as Patch;

function extremePatch(side: "min" | "max"): Patch {
  const patch = {} as Patch;
  for (const id of PARAM_IDS) {
    const meta = PARAMS[id];
    if (meta.type === "enum") {
      const values = meta.values ?? [];
      patch[id] = side === "min" ? values[0] : values[values.length - 1];
    } else {
      patch[id] = side === "min" ? meta.min : meta.max;
    }
  }
  return patch;
}

describe("macro definitions", () => {
  it("has exactly the eight planned macros", () => {
    expect(MACROS.map((m) => m.name)).toEqual([
      "Brightness",
      "Thickness",
      "Movement",
      "Attack",
      "Space",
      "Grit",
      "Width",
      "Character",
    ]);
  });

  it("references only real generated parameter ids", () => {
    const known = new Set<string>(PARAM_IDS);
    for (const macro of MACROS) {
      for (const target of macro.targets) {
        expect(known.has(target.paramId), `${macro.id} -> ${target.paramId}`).toBe(true);
      }
    }
  });

  it("uses weights in [-1, 1], nonzero, with no duplicate targets per macro", () => {
    for (const macro of MACROS) {
      const seen = new Set<string>();
      expect(macro.targets.length).toBeGreaterThan(0);
      for (const target of macro.targets) {
        expect(Math.abs(target.weight)).toBeGreaterThan(0);
        expect(Math.abs(target.weight)).toBeLessThanOrEqual(1);
        expect(seen.has(target.paramId), `${macro.id} duplicates ${target.paramId}`).toBe(false);
        seen.add(target.paramId);
      }
    }
  });

  it("has a plain language description for every macro", () => {
    for (const macro of MACROS) {
      expect(macro.description.length).toBeGreaterThan(10);
      expect(macro.description).not.toContain("—");
    }
  });
});

describe("computeMacroEdit bounds", () => {
  const bases: Array<[string, Patch]> = [
    ["default patch", DEFAULT_PATCH],
    ["all-minimum patch", extremePatch("min")],
    ["all-maximum patch", extremePatch("max")],
  ];
  const sweeps: Array<[number, number]> = [
    [MACRO_DEFAULT, 0],
    [MACRO_DEFAULT, 1],
    [0, 1],
    [1, 0],
  ];

  for (const [baseName, base] of bases) {
    for (const macro of MACROS) {
      it(`${macro.id} stays in bounds at extremes from the ${baseName}`, () => {
        for (const [from, to] of sweeps) {
          const edit = computeMacroEdit(macro, base, from, to);
          expect(validatePatchParams(edit, "partial")).toEqual([]);
          const merged = { ...base, ...edit };
          expect(validatePatchParams(merged, "full")).toEqual([]);
        }
      });
    }
  }

  it("returns an empty edit when the macro does not move", () => {
    for (const macro of MACROS) {
      expect(computeMacroEdit(macro, DEFAULT_PATCH, 0.5, 0.5)).toEqual({});
      expect(computeMacroEdit(macro, DEFAULT_PATCH, 0.2, 0.2)).toEqual({});
    }
  });

  it("moves the primary parameter in the weighted direction", () => {
    const brightness = MACROS.find((m) => m.id === "brightness");
    expect(brightness).toBeDefined();
    if (!brightness) return;
    const up = computeMacroEdit(brightness, DEFAULT_PATCH, 0.5, 1);
    const down = computeMacroEdit(brightness, DEFAULT_PATCH, 0.5, 0);
    const base = DEFAULT_PATCH.filter_cutoff as number;
    expect(up.filter_cutoff as number).toBeGreaterThan(base);
    expect(down.filter_cutoff as number).toBeLessThan(base);
  });

  it("keeps int parameters integral", () => {
    for (const macro of MACROS) {
      const edit = computeMacroEdit(macro, DEFAULT_PATCH, 0.5, 0.83);
      for (const [id, value] of Object.entries(edit)) {
        const meta = PARAMS[id as ParamId];
        if (meta.type === "int") {
          expect(Number.isInteger(value), `${macro.id} -> ${id}`).toBe(true);
        }
        if (meta.type === "enum") {
          expect(typeof value).toBe("string");
        }
      }
    }
  });
});
