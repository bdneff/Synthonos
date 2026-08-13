/**
 * Engine contract tests. The M0 assertions (exact silence with no note, no
 * NaNs, no denormals, no DC, no clicks) are extended, never removed, now that
 * Phase 1 synthesis is in place: determinism, a battery of patch shapes, and
 * a golden render with loudness and exact-zero-tail sanity checks.
 */

import { describe, it, expect } from "vitest";
import { renderOffline, type RenderOptions } from "./harness/render";
import {
  assertSilent,
  assertFinite,
  assertNoDenormals,
  assertDcOffsetBelow,
  assertNoClicks,
} from "./harness/assertions";
import { compareToGolden } from "./harness/golden";
import { rmsDb } from "./harness/fixtures";

describe("engine", () => {
  it("outputs exact silence when no note is playing", () => {
    const { left, right } = renderOffline({ durationSec: 1 });
    assertSilent(left, "left");
    assertSilent(right, "right");
  });

  it("stays finite, denormal-free, DC-free, and click-free across note events", () => {
    const { left, right } = renderOffline({
      durationSec: 1,
      events: [
        { timeSec: 0.1, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.5, type: "off", note: 60 },
        { timeSec: 0.6, type: "on", note: 67, velocity: 0.5 },
        { timeSec: 0.9, type: "off", note: 67 },
      ],
    });
    for (const [buf, label] of [
      [left, "left"],
      [right, "right"],
    ] as const) {
      assertFinite(buf, label);
      assertNoDenormals(buf, label);
      assertDcOffsetBelow(buf, 0.01, label);
      assertNoClicks(buf, 0.25, label);
    }
  });

  it("returns to exact zero after the release completes", () => {
    const { left, right } = renderOffline({
      durationSec: 1.2,
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.35, type: "off", note: 60 },
      ],
    });
    // Default release is 0.2 s; the voice kill threshold must snap the tail
    // to hard zero well before 0.9 s.
    const tailStart = Math.round(0.9 * 48000);
    assertSilent(left.subarray(tailStart), "left tail");
    assertSilent(right.subarray(tailStart), "right tail");
  });

  it("renders at a non-44100 sample rate without assuming otherwise", () => {
    const { left, sampleRate } = renderOffline({
      durationSec: 0.25,
      sampleRate: 96000,
    });
    if (sampleRate !== 96000) throw new Error("sample rate not respected");
    if (left.length !== 24000) throw new Error("frame count wrong for 96 kHz");
    assertFinite(left);
  });

  it("full note lifecycle behaves at 44100 and 96000", () => {
    for (const sampleRate of [44100, 96000]) {
      const { left, right } = renderOffline({
        durationSec: 1.2,
        sampleRate,
        events: [
          { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
          { timeSec: 0.4, type: "off", note: 60 },
        ],
      });
      for (const [buf, label] of [
        [left, `left@${sampleRate}`],
        [right, `right@${sampleRate}`],
      ] as const) {
        assertFinite(buf, label);
        assertNoDenormals(buf, label);
        assertDcOffsetBelow(buf, 0.01, label);
        assertNoClicks(buf, 0.25, label);
      }
      // Note sounded and release completed to exact zero.
      expect(rmsDb(left, Math.round(0.15 * sampleRate), Math.round(0.35 * sampleRate))).toBeGreaterThan(-40);
      assertSilent(left.subarray(Math.round(1.05 * sampleRate)), `tail@${sampleRate}`);
    }
  });

  it("renders bit-identically for the same patch and events", () => {
    const opts: RenderOptions = {
      durationSec: 1,
      params: {
        osc1_waveform: 3,
        osc1_unison_voices: 6,
        osc1_unison_detune: 30,
        osc2_level: 0.5,
        osc2_waveform: 0,
        osc2_semitone: 7,
        filter_type: 2,
        filter_cutoff: 3000,
        filter_resonance: 0.6,
        lfo_waveform: 4,
        lfo_target: 1,
        lfo_depth: 0.7,
        lfo_rate: 9,
      },
      events: [
        { timeSec: 0.05, type: "on", note: 52, velocity: 0.9 },
        { timeSec: 0.3, type: "on", note: 59, velocity: 0.7 },
        { timeSec: 0.6, type: "off", note: 52 },
        { timeSec: 0.8, type: "off", note: 59 },
      ],
    };
    const a = renderOffline(opts);
    const b = renderOffline(opts);
    expect(a.left.length).toBe(b.left.length);
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`renders diverge at sample ${i}`);
      }
    }
  });

  it("a variety of patches stay finite, denormal-free, DC-free, and click-free", () => {
    const patches: Record<string, number>[] = [
      // supersaw
      {
        osc1_waveform: 2,
        osc1_unison_voices: 8,
        osc1_unison_detune: 40,
        filter_cutoff: 8000,
        filter_resonance: 0.3,
      },
      // two-oscillator layered square + sub sine, plucky filter envelope
      {
        osc1_waveform: 3,
        osc2_waveform: 0,
        osc2_level: 0.6,
        osc2_octave: -1,
        filter_cutoff: 900,
        filter_env_amount: 0.8,
        fenv_decay: 0.12,
        fenv_sustain: 0,
      },
      // highpass, high resonance, sample-and-hold cutoff wobble
      {
        filter_type: 1,
        filter_cutoff: 1200,
        filter_resonance: 0.9,
        lfo_waveform: 4,
        lfo_target: 1,
        lfo_depth: 1,
        lfo_rate: 8,
      },
      // bandpass with square tremolo
      {
        filter_type: 2,
        filter_cutoff: 2000,
        filter_resonance: 0.5,
        lfo_waveform: 3,
        lfo_target: 3,
        lfo_depth: 1,
        lfo_rate: 5,
      },
      // triangle with vibrato and negative filter envelope
      {
        osc1_waveform: 1,
        filter_cutoff: 6000,
        filter_env_amount: -0.6,
        lfo_target: 2,
        lfo_depth: 0.5,
        lfo_rate: 6,
      },
    ];
    for (let p = 0; p < patches.length; p += 1) {
      const { left, right } = renderOffline({
        durationSec: 1,
        params: patches[p],
        events: [
          { timeSec: 0.05, type: "on", note: 48, velocity: 1 },
          { timeSec: 0.3, type: "on", note: 64, velocity: 0.8 },
          { timeSec: 0.6, type: "off", note: 48 },
          { timeSec: 0.75, type: "off", note: 64 },
        ],
      });
      for (const [buf, label] of [
        [left, `patch ${p} left`],
        [right, `patch ${p} right`],
      ] as const) {
        assertFinite(buf, label);
        assertNoDenormals(buf, label);
        assertDcOffsetBelow(buf, 0.01, label);
        assertNoClicks(buf, 0.25, label);
      }
    }
  });

  it("tail gate: with reverb and delay engaged, the tail snaps to exact zero within bounded time", () => {
    // Reverb decay 0.5 s at mix 0.5 plus a short low-feedback delay: the
    // audible tail dies in well under 2 s, and the chain-level tail gate
    // must then flush every effect memory so the output is EXACT 0.0 (the
    // silence invariant), not a -300 dB recirculating residue. Bound: exact
    // zero within 4 s of the release.
    const sr = 48000;
    const releaseAt = 0.35;
    const { left, right } = renderOffline({
      durationSec: releaseAt + 4.0,
      sampleRate: sr,
      params: {
        reverb_mix: 0.5,
        reverb_decay: 0.5,
        reverb_size: 0.5,
        delay_mix: 0.5,
        delay_time: 0.15,
        delay_feedback: 0.2,
      },
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: releaseAt, type: "off", note: 60 },
      ],
    });
    // The wet tail audibly exists right after the release...
    expect(rmsDb(left, Math.round(0.45 * sr), Math.round(0.7 * sr))).toBeGreaterThan(-60);
    // ...and the last stretch is exact digital zero.
    const tailStart = Math.round((releaseAt + 4.0 - 0.25) * sr);
    assertSilent(left.subarray(tailStart), "gated tail left");
    assertSilent(right.subarray(tailStart), "gated tail right");
    // Report-grade bound: find when exact zero becomes permanent.
    let lastNonZero = -1;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== 0 || right[i] !== 0) lastNonZero = i;
    }
    expect(lastNonZero / sr - releaseAt).toBeLessThan(4.0);
  });

  it("matches the golden render for the Init preset, at a sane loudness, ending in exact zero", () => {
    const audio = renderOffline({
      durationSec: 1.0,
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.35, type: "off", note: 60 },
      ],
    });
    // Listen-check is not possible in CI; assert the render is audibly there
    // (RMS between -40 and -3 dBFS during the held note) and that the tail
    // after the release is exact digital zero.
    const noteRms = rmsDb(audio.left, Math.round(0.1 * 48000), Math.round(0.3 * 48000));
    expect(noteRms).toBeGreaterThan(-40);
    expect(noteRms).toBeLessThan(-3);
    assertSilent(audio.left.subarray(Math.round(0.9 * 48000)), "golden tail left");
    assertSilent(audio.right.subarray(Math.round(0.9 * 48000)), "golden tail right");
    compareToGolden("init-preset", audio);
  });
});
