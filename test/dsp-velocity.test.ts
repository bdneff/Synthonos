/**
 * amp_velocity: per-voice level = mix(1, velocity, amp_velocity) at note-on.
 * amp_velocity 1 reproduces the raw velocity scaling; 0 ignores velocity.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { rms } from "./harness/fixtures";

const SR = 48000;

const PATCH: Record<string, number> = {
  osc1_waveform: 2,
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.003,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.1,
  lfo_depth: 0,
  master_volume: 0.7,
};

function steadyRms(velocity: number, ampVelocity: number): number {
  const { left } = renderOffline({
    durationSec: 0.6,
    sampleRate: SR,
    params: { ...PATCH, amp_velocity: ampVelocity },
    events: [{ timeSec: 0.02, type: "on", note: 60, velocity }],
  });
  return rms(left, Math.round(0.25 * SR), Math.round(0.55 * SR));
}

describe("amp_velocity", () => {
  it("amp_velocity 1: velocity 0.5 is half the level of velocity 1.0", () => {
    const full = steadyRms(1.0, 1);
    const half = steadyRms(0.5, 1);
    expect(full).toBeGreaterThan(0.001);
    expect(half / full).toBeGreaterThan(0.48);
    expect(half / full).toBeLessThan(0.52);
  });

  it("amp_velocity 0: velocity 0.5 and 1.0 are equally loud", () => {
    const full = steadyRms(1.0, 0);
    const half = steadyRms(0.5, 0);
    expect(full).toBeGreaterThan(0.001);
    expect(half / full).toBeGreaterThan(0.999);
    expect(half / full).toBeLessThan(1.001);
  });

  it("intermediate sensitivity interpolates: gain = 1 + a * (v - 1)", () => {
    // a = 0.4, v = 0.5 -> gain 0.8 relative to full velocity.
    const full = steadyRms(1.0, 0.4);
    const half = steadyRms(0.5, 0.4);
    expect(half / full).toBeGreaterThan(0.78);
    expect(half / full).toBeLessThan(0.82);
  });

  it("velocity 1 is unaffected by the sensitivity setting", () => {
    const a = steadyRms(1.0, 0);
    const b = steadyRms(1.0, 1);
    expect(Math.abs(a - b) / a).toBeLessThan(1e-6);
  });
});
