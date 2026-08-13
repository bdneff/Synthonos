/**
 * Schroeder reverb (last stage of the fixed chain): the impulse response
 * decays roughly monotonically, its -60 dB time tracks reverb_decay within
 * a factor of 2, size changes the modal density/length, and mix 0 is a
 * bit-exact passthrough.
 */

import { describe, it, expect } from "vitest";
import { Reverb } from "../src/dsp/reverb";
import { renderOffline } from "./harness/render";
import { rms } from "./harness/fixtures";
import { assertFinite, assertNoDenormals } from "./harness/assertions";

const SR = 48000;

/** Impulse response of the wet path, length seconds. */
function impulseResponse(decaySec: number, size: number, seconds: number): Float32Array {
  const rv = new Reverb(SR);
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    rv.tick(i === 0 ? 1 : 0, i === 0 ? 1 : 0, size, decaySec);
    out[i] = rv.wetL;
  }
  return out;
}

/** Time (s) at which windowed RMS first stays 60 dB below the loudest window. */
function t60(ir: Float32Array): number {
  const win = Math.round(0.05 * SR);
  const levels: number[] = [];
  for (let i = 0; i + win <= ir.length; i += win) {
    levels.push(rms(ir, i, i + win));
  }
  const peak = Math.max(...levels);
  const target = peak / 1000; // -60 dB
  for (let w = 0; w < levels.length; w += 1) {
    if (levels[w] < target) {
      let held = true;
      for (let j = w; j < Math.min(levels.length, w + 4); j += 1) {
        if (levels[j] >= target) {
          held = false;
          break;
        }
      }
      if (held) return (w * win) / SR;
    }
  }
  return ir.length / SR;
}

describe("reverb unit (module)", () => {
  it("-60 dB time tracks reverb_decay within a factor of 2", () => {
    for (const decay of [0.5, 1.5, 4]) {
      const ir = impulseResponse(decay, 0.5, decay * 2.5 + 1);
      const measured = t60(ir);
      expect(measured, `decay ${decay}`).toBeGreaterThan(decay / 2);
      expect(measured, `decay ${decay}`).toBeLessThan(decay * 2);
    }
  });

  it("decays roughly monotonically (windowed RMS never grows by more than 3 dB)", () => {
    const ir = impulseResponse(1.5, 0.5, 3);
    const win = Math.round(0.1 * SR);
    let prev = Infinity;
    for (let i = win; i + win <= ir.length; i += win) {
      const level = rms(ir, i, i + win);
      if (prev > 0) expect(level).toBeLessThan(prev * 1.41); // +3 dB slack
      prev = level;
    }
    assertFinite(ir, "reverb IR");
    assertNoDenormals(ir, "reverb IR");
  });

  it("longer decay leaves more late energy than shorter decay", () => {
    const short = impulseResponse(0.3, 0.5, 2);
    const long = impulseResponse(3, 0.5, 2);
    const from = Math.round(1.0 * SR);
    const to = Math.round(1.5 * SR);
    expect(rms(long, from, to)).toBeGreaterThan(rms(short, from, to) * 10);
  });

  it("size scales the comb lengths: bigger size, sparser early reflections", () => {
    const small = impulseResponse(2, 0, 0.5);
    const large = impulseResponse(2, 1, 0.5);
    // First nonzero output arrives later for the larger room.
    const firstAt = (ir: Float32Array) => {
      for (let i = 0; i < ir.length; i += 1) {
        if (ir[i] !== 0) return i;
      }
      return ir.length;
    };
    expect(firstAt(large)).toBeGreaterThan(firstAt(small) * 2);
  });

  it("left and right channels are decorrelated", () => {
    const rv = new Reverb(SR);
    const n = Math.round(1.5 * SR);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      rv.tick(i === 0 ? 1 : 0, i === 0 ? 1 : 0, 0.5, 1.5);
      l[i] = rv.wetL;
      r[i] = rv.wetR;
    }
    let dot = 0;
    let ml = 0;
    let mr = 0;
    for (let i = 0; i < n; i += 1) {
      dot += l[i] * r[i];
      ml += l[i] * l[i];
      mr += r[i] * r[i];
    }
    expect(Math.abs(dot / Math.sqrt(ml * mr))).toBeLessThan(0.5);
  });
});

describe("reverb through the engine", () => {
  it("mix 0 is a bit-exact passthrough", () => {
    const patch: Record<string, number> = {
      osc1_waveform: 2,
      amp_attack: 0.002,
      amp_decay: 0.1,
      amp_sustain: 0.5,
      amp_release: 0.1,
      amp_velocity: 0,
      master_volume: 0.7,
    };
    const events = [
      { timeSec: 0.02, type: "on" as const, note: 55, velocity: 1 },
      { timeSec: 0.4, type: "off" as const, note: 55 },
    ];
    const a = renderOffline({ durationSec: 1, sampleRate: SR, params: patch, events });
    const b = renderOffline({
      durationSec: 1,
      sampleRate: SR,
      params: { ...patch, reverb_size: 1, reverb_decay: 8, reverb_mix: 0 },
      events,
    });
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`reverb mix 0 differs at sample ${i}`);
      }
    }
  });

  it("adds an audible tail after the dry note has released", () => {
    const patch: Record<string, number> = {
      osc1_waveform: 2,
      amp_attack: 0.002,
      amp_decay: 0.05,
      amp_sustain: 0,
      amp_release: 0.05,
      amp_velocity: 0,
      master_volume: 0.7,
    };
    const events = [
      { timeSec: 0.02, type: "on" as const, note: 60, velocity: 1 },
      { timeSec: 0.1, type: "off" as const, note: 60 },
    ];
    const dry = renderOffline({ durationSec: 1.2, sampleRate: SR, params: patch, events });
    const wet = renderOffline({
      durationSec: 1.2,
      sampleRate: SR,
      params: { ...patch, reverb_mix: 0.5, reverb_decay: 2 },
      events,
    });
    const from = Math.round(0.5 * SR);
    const to = Math.round(0.9 * SR);
    expect(rms(wet.left, from, to)).toBeGreaterThan(rms(dry.left, from, to) * 10 + 1e-6);
    assertFinite(wet.left, "wet left");
    assertNoDenormals(wet.left, "wet left");
  });
});
