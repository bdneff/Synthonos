/**
 * Pure helpers for converting between real parameter values and the 0..1
 * normalized space that knobs, macros, and animations operate in. The curve
 * ("linear" | "log") comes from the schema via the generated metadata, so a
 * log parameter like filter cutoff feels right under the finger: half a turn
 * covers each doubling, not a fixed number of Hz.
 *
 * No React, no DOM. Unit-testable in node.
 */

import type { ParamCurve, ParamId, ParamValue } from "../generated/params";
import { PARAMS } from "../generated/params";

/** The subset of parameter metadata a knob needs to traverse a range. */
export interface RangeSpec {
  readonly min: number;
  readonly max: number;
  readonly curve: ParamCurve;
}

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function clampRange(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Real value -> normalized 0..1. Log curves require min > 0; if a schema
 * entry ever declares log with a non-positive min we fall back to linear
 * rather than produce NaN.
 */
export function normalizeValue(spec: RangeSpec, value: number): number {
  const { min, max, curve } = spec;
  if (max === min) return 0;
  if (curve === "log" && min > 0 && max > 0) {
    return clamp01(Math.log(value / min) / Math.log(max / min));
  }
  return clamp01((value - min) / (max - min));
}

/**
 * Normalized 0..1 -> real value, clamped into [min, max] so floating point
 * round trips can never produce a value the validator would reject.
 */
export function denormalizeValue(
  spec: RangeSpec,
  norm: number,
  integer = false,
): number {
  const { min, max, curve } = spec;
  const n = clamp01(norm);
  // Exact endpoints: exp/log round trips must never miss the schema bounds.
  if (n === 0) return min;
  if (n === 1) return max;
  let v: number;
  if (curve === "log" && min > 0 && max > 0) {
    v = min * Math.exp(n * Math.log(max / min));
  } else {
    v = min + n * (max - min);
  }
  if (integer) v = Math.round(v);
  return clampRange(v, min, max);
}

/** "sample_hold" -> "sample hold" for display. */
export function humanizeOption(option: string): string {
  return option.split("_").join(" ");
}

/**
 * Format a parameter value for the small readout under a control.
 * Musician-friendly: Hz become kHz when large, seconds become ms when
 * short, plain 0..1 floats read as percent.
 */
export function formatParamValue(id: ParamId, value: ParamValue): string {
  const meta = PARAMS[id];
  if (meta.type === "enum") {
    return typeof value === "string" ? humanizeOption(value) : "?";
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "?";
  const v = value;
  switch (meta.unit) {
    case "Hz":
      if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz`;
      if (v >= 100) return `${Math.round(v)} Hz`;
      return `${v.toFixed(2)} Hz`;
    case "s":
      if (v < 1) return `${Math.round(v * 1000)} ms`;
      return `${v.toFixed(2)} s`;
    case "cents": {
      const r = Math.round(v);
      return `${meta.min < 0 && r > 0 ? "+" : ""}${r} cents`;
    }
    case "st": {
      const r = Math.round(v);
      return `${r > 0 ? "+" : ""}${r} semi`;
    }
    case "oct": {
      const r = Math.round(v);
      return `${r > 0 ? "+" : ""}${r} oct`;
    }
    case "voices":
      return `${Math.round(v)} ${Math.round(v) === 1 ? "voice" : "voices"}`;
    default: {
      // Unitless floats: percent, signed when the range is bipolar.
      if (meta.min < 0) {
        const pct = Math.round(v * 100);
        return `${pct > 0 ? "+" : ""}${pct}%`;
      }
      if (meta.max <= 1) return `${Math.round(v * 100)}%`;
      return v.toFixed(2);
    }
  }
}
