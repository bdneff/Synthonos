/**
 * Glide (portamento): the sounding pitch approaches the target note
 * exponentially in semitone space with time constant glide_time. Pitch is
 * tracked with a sliding zero-crossing estimator on a sine render, which is
 * plenty accurate for octave-scale trajectories.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { assertFinite, assertNoClicks } from "./harness/assertions";

const SR = 48000;

const GLIDE_PATCH: Record<string, number> = {
  osc1_waveform: 0, // sine, for clean zero-crossing pitch tracking
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_type: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.003,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.05,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

/** Estimated frequency (Hz) in a window via rising zero-crossing spacing. */
function pitchInWindow(buf: Float32Array, from: number, to: number): number {
  let first = -1;
  let last = -1;
  let count = 0;
  for (let i = from + 1; i < to; i += 1) {
    if (buf[i - 1] <= 0 && buf[i] > 0) {
      if (first < 0) first = i;
      last = i;
      count += 1;
    }
  }
  if (count < 2 || last <= first) return 0;
  return ((count - 1) * SR) / (last - first);
}

function renderTwoNotes(glideTime: number, overlap = false) {
  // Note A at 0.05s, note B (an octave up) at 0.6s. In the overlap case A is
  // held through B's start (B still glides from A's pitch); otherwise A is
  // released just before B starts.
  return renderOffline({
    durationSec: 2.4,
    sampleRate: SR,
    params: { ...GLIDE_PATCH, glide_time: glideTime },
    events: [
      { timeSec: 0.05, type: "on", note: 48, velocity: 1 },
      { timeSec: overlap ? 0.59 : 0.55, type: "off", note: 48 },
      { timeSec: 0.6, type: "on", note: 60, velocity: 1 },
      { timeSec: 2.3, type: "off", note: 60 },
    ],
  });
}

describe("glide", () => {
  it("pitch trajectory is monotonic and reaches the target within ~5x glide_time", () => {
    const glide = 0.2;
    const { left } = renderTwoNotes(glide, true);
    const noteOnAt = 0.6;
    const win = Math.round(0.03 * SR);
    const pitches: number[] = [];
    for (let t = noteOnAt + 0.05; t < noteOnAt + 5 * glide + 0.1; t += 0.05) {
      const from = Math.round(t * SR);
      pitches.push(pitchInWindow(left, from, from + win));
    }
    // Monotonic (allow 1% jitter from the estimator).
    for (let i = 1; i < pitches.length; i += 1) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1] * 0.99);
    }
    // Starts near the old pitch, ends on the new one.
    const fStart = 440 * Math.pow(2, (48 - 69) / 12); // ~130.8 Hz
    const fEnd = 440 * Math.pow(2, (60 - 69) / 12); // ~261.6 Hz
    expect(pitches[0]).toBeLessThan(fStart * 1.5);
    const settled = pitches[pitches.length - 1];
    expect(Math.abs(settled - fEnd) / fEnd).toBeLessThan(0.02);
    assertFinite(left, "glide render");
    assertNoClicks(left, 0.25, "glide render");
  });

  it("glide at the schema minimum starts the new note exactly on pitch", () => {
    const { left } = renderTwoNotes(0.001);
    const from = Math.round(0.65 * SR);
    const fEnd = 440 * Math.pow(2, (60 - 69) / 12);
    const p = pitchInWindow(left, from, from + Math.round(0.05 * SR));
    expect(Math.abs(p - fEnd) / fEnd).toBeLessThan(0.01);
  });

  it("the very first note (nothing sounding before) starts on pitch even with glide up", () => {
    const { left } = renderOffline({
      durationSec: 0.6,
      sampleRate: SR,
      params: { ...GLIDE_PATCH, glide_time: 1 },
      events: [{ timeSec: 0.05, type: "on", note: 60, velocity: 1 }],
    });
    const from = Math.round(0.12 * SR);
    const fEnd = 440 * Math.pow(2, (60 - 69) / 12);
    const p = pitchInWindow(left, from, from + Math.round(0.05 * SR));
    expect(Math.abs(p - fEnd) / fEnd).toBeLessThan(0.01);
  });

  it("non-overlapping notes also glide from the previous note's pitch", () => {
    const { left } = renderTwoNotes(0.3, false);
    const from = Math.round(0.66 * SR);
    const p = pitchInWindow(left, from, from + Math.round(0.03 * SR));
    const fStart = 440 * Math.pow(2, (48 - 69) / 12);
    const fEnd = 440 * Math.pow(2, (60 - 69) / 12);
    // Shortly after note-on the pitch is still much closer to the old note.
    expect(p).toBeGreaterThan(fStart * 0.9);
    expect(p).toBeLessThan(fStart * 1.5);
    expect(p).toBeLessThan(fEnd * 0.8);
  });

  it("renders are deterministic with glide engaged", () => {
    const a = renderTwoNotes(0.15, true);
    const b = renderTwoNotes(0.15, true);
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`glide render differs at sample ${i}`);
      }
    }
  });
});
