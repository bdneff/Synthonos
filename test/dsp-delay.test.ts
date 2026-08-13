/**
 * Stereo feedback delay (third stage of the fixed chain): echoes appear at
 * delay_time spacing with feedback-governed decay, mix 0 is a bit-exact
 * passthrough, and time changes crossfade instead of pitch-shifting.
 */

import { describe, it, expect } from "vitest";
import { StereoDelay } from "../src/dsp/delay";
import { renderOffline } from "./harness/render";
import { rms, safeTestFreq } from "./harness/fixtures";
import { assertFinite } from "./harness/assertions";

const SR = 48000;

const PLUCK_PATCH: Record<string, number> = {
  osc1_waveform: 2,
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.002,
  amp_decay: 0.05,
  amp_sustain: 0,
  amp_release: 0.05,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

describe("delay unit (module)", () => {
  it("echoes an impulse at exactly the delay spacing, decaying by the feedback ratio", () => {
    const d = new StereoDelay(SR, 0.1);
    const delaySamples = Math.round(0.1 * SR);
    const fb = 0.5;
    const n = delaySamples * 4 + 16;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      d.tick(i === 0 ? 1 : 0, 0, delaySamples, fb);
      out[i] = d.outL;
    }
    // Echo 1 at delaySamples with unit gain, echo k at k*delaySamples with
    // fb^(k-1).
    expect(out[delaySamples]).toBeCloseTo(1, 6);
    expect(out[2 * delaySamples]).toBeCloseTo(fb, 6);
    expect(out[3 * delaySamples]).toBeCloseTo(fb * fb, 6);
    // Nothing between echoes.
    expect(Math.abs(out[Math.round(1.5 * delaySamples)])).toBeLessThan(1e-9);
  });

  it("clamps feedback at 0.9 so the loop can never run away", () => {
    const d = new StereoDelay(SR, 0.01);
    const delaySamples = Math.round(0.01 * SR);
    let peak = 0;
    for (let i = 0; i < SR; i += 1) {
      d.tick(i === 0 ? 1 : 0, 0, delaySamples, 5); // absurd request
      peak = Math.max(peak, Math.abs(d.outL));
    }
    expect(peak).toBeLessThanOrEqual(1);
    // After 20 loop times the echo has decayed to at most 0.9^19.
    const late = new StereoDelay(SR, 0.01);
    let lateMax = 0;
    for (let i = 0; i < delaySamples * 30; i += 1) {
      late.tick(i === 0 ? 1 : 0, 0, delaySamples, 5);
      if (i > delaySamples * 20) lateMax = Math.max(lateMax, Math.abs(late.outL));
    }
    expect(lateMax).toBeLessThanOrEqual(Math.pow(0.9, 19) + 1e-9);
  });

  it("a time change crossfades: output contains no sample outside the input's range", () => {
    // Feed a steady sine; move the delay from 100 ms to 50 ms mid-stream.
    // A slewed read pointer would resample (pitch up) and a hard switch
    // would click; a crossfade keeps every output sample a convex blend of
    // two delayed copies, so |out| never exceeds the sine's amplitude and
    // there is no discontinuity bigger than the sine's own slope allows.
    const d = new StereoDelay(SR, 0.1);
    const f = 200;
    const n = SR;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = Math.sin((2 * Math.PI * f * i) / SR);
      const delaySamples = i < SR / 2 ? Math.round(0.1 * SR) : Math.round(0.05 * SR);
      d.tick(x, x, delaySamples, 0);
      out[i] = d.outL;
    }
    let worstStep = 0;
    for (let i = Math.round(0.15 * SR) + 1; i < n; i += 1) {
      out[i - 1] !== 0 && (worstStep = Math.max(worstStep, Math.abs(out[i] - out[i - 1])));
      expect(Math.abs(out[i])).toBeLessThanOrEqual(1 + 1e-6);
    }
    // A 200 Hz unit sine moves at most 2*pi*200/48000 ~ 0.026 per sample;
    // the crossfade of two such sines can double that but no more.
    expect(worstStep).toBeLessThan(0.06);
  });
});

describe("delay through the engine", () => {
  it("mix 0 is a bit-exact passthrough", () => {
    const events = [
      { timeSec: 0.02, type: "on" as const, note: 60, velocity: 1 },
      { timeSec: 0.4, type: "off" as const, note: 60 },
    ];
    const a = renderOffline({ durationSec: 1, sampleRate: SR, params: PLUCK_PATCH, events });
    const b = renderOffline({
      durationSec: 1,
      sampleRate: SR,
      params: { ...PLUCK_PATCH, delay_time: 0.1, delay_feedback: 0.8, delay_mix: 0 },
      events,
    });
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`delay mix 0 differs at sample ${i}`);
      }
    }
  });

  it("a pluck repeats at delay_time spacing with decaying echo energy", () => {
    const delayTime = 0.3;
    const { left } = renderOffline({
      durationSec: 2.0,
      sampleRate: SR,
      params: {
        ...PLUCK_PATCH,
        delay_time: delayTime,
        delay_feedback: 0.5,
        delay_mix: 0.5,
      },
      events: [
        { timeSec: 0.02, type: "on", note: safeTestFreq(300, 8192, SR) > 0 ? 60 : 60, velocity: 1 },
        { timeSec: 0.1, type: "off", note: 60 },
      ],
    });
    assertFinite(left, "delayed");
    const win = Math.round(0.12 * SR);
    const echoRms = (k: number) =>
      rms(left, Math.round((0.02 + k * delayTime) * SR), Math.round((0.02 + k * delayTime) * SR) + win);
    const gapRms = rms(
      left,
      Math.round((0.02 + 1.5 * delayTime) * SR),
      Math.round((0.02 + 1.5 * delayTime) * SR) + Math.round(0.05 * SR),
    );
    const e0 = echoRms(0); // the dry pluck
    const e1 = echoRms(1);
    const e2 = echoRms(2);
    const e3 = echoRms(3);
    expect(e1).toBeGreaterThan(gapRms * 3); // echoes land on the grid
    expect(e1).toBeLessThan(e0); // quieter than the dry hit
    expect(e2).toBeLessThan(e1); // and decaying
    expect(e3).toBeLessThan(e2);
    // Feedback ratio shows up between successive echoes (loosely).
    expect(e2 / e1).toBeGreaterThan(0.2);
    expect(e2 / e1).toBeLessThan(0.9);
  });
});
