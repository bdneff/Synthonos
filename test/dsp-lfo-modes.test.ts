/**
 * lfo_retrigger and lfo_fade (voice.ts per-voice LFO handling).
 *
 * "note" mode gives every voice its own LFO, phase-reset at note start, so
 * a note rendered alone sounds the same no matter when it starts. "free"
 * mode keeps one global free-running LFO, so start time matters. lfo_fade
 * ramps the modulation depth from zero over the given time from each
 * voice's own start, in both modes.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { assertFinite, assertNoClicks } from "./harness/assertions";
import { rms } from "./harness/fixtures";

const SR = 48000;

const TREMOLO_PATCH: Record<string, number> = {
  osc1_waveform: 0,
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
  amp_velocity: 0,
  lfo_waveform: 0,
  lfo_target: 3, // amp -> tremolo, easy to read off the envelope
  lfo_depth: 1,
  lfo_rate: 2,
  master_volume: 0.7,
};

/** Render one note starting at startSec, return its amplitude envelope
 *  sampled as short-window RMS every 10 ms from note start. */
function tremoloEnvelope(
  startSec: number,
  retrigger: number,
  extra: Record<string, number> = {},
): number[] {
  const hold = 1.5;
  const { left } = renderOffline({
    durationSec: startSec + hold + 0.2,
    sampleRate: SR,
    params: { ...TREMOLO_PATCH, lfo_retrigger: retrigger, ...extra },
    events: [
      { timeSec: startSec, type: "on", note: 60, velocity: 1 },
      { timeSec: startSec + hold, type: "off", note: 60 },
    ],
  });
  const win = Math.round(0.01 * SR);
  const env: number[] = [];
  const from = Math.round((startSec + 0.05) * SR);
  const to = Math.round((startSec + hold - 0.05) * SR);
  for (let i = from; i + win < to; i += win) {
    env.push(rms(left, i, i + win));
  }
  return env;
}

function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let dot = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) * (a[i] - ma);
    vb += (b[i] - mb) * (b[i] - mb);
  }
  return dot / Math.sqrt(va * vb);
}

describe("lfo_retrigger", () => {
  it("note mode: staggered notes rendered alone have identical LFO phase", () => {
    // 2 Hz LFO: a 0.13 s stagger shifts a free-running LFO by ~94 degrees,
    // decorrelating the envelopes; note mode must keep them aligned.
    const a = tremoloEnvelope(0.1, 1);
    const b = tremoloEnvelope(0.23, 1);
    expect(correlation(a, b)).toBeGreaterThan(0.99);
  });

  it("free mode: the same stagger de-phases the tremolo (control case)", () => {
    const a = tremoloEnvelope(0.1, 0);
    const b = tremoloEnvelope(0.23, 0);
    expect(correlation(a, b)).toBeLessThan(0.9);
  });

  it("note-mode pitch vibrato is click-free and finite", () => {
    const { left, right } = renderOffline({
      durationSec: 1.2,
      sampleRate: SR,
      params: {
        ...TREMOLO_PATCH,
        lfo_retrigger: 1,
        lfo_target: 2,
        lfo_depth: 0.5,
        lfo_rate: 6,
      },
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.5, type: "on", note: 67, velocity: 1 },
        { timeSec: 1.0, type: "off", note: 60 },
        { timeSec: 1.05, type: "off", note: 67 },
      ],
    });
    assertFinite(left, "left");
    assertNoClicks(left, 0.25, "left");
    assertFinite(right, "right");
    assertNoClicks(right, 0.25, "right");
  });
});

describe("lfo_fade", () => {
  it("tremolo depth grows over lfo_fade seconds from note start", () => {
    const fade = 1.0;
    const env = tremoloEnvelope(0.05, 1, { lfo_fade: fade, lfo_rate: 8 });
    // Peak-to-trough swing inside a window measures effective LFO depth.
    const swing = (fromIdx: number, toIdx: number) => {
      let mn = Infinity;
      let mx = 0;
      for (let i = fromIdx; i < toIdx && i < env.length; i += 1) {
        mn = Math.min(mn, env[i]);
        mx = Math.max(mx, env[i]);
      }
      return (mx - mn) / (mx + mn);
    };
    const early = swing(0, 25); // ~first 0.25 s
    const late = swing(100, 140); // after the fade completes
    expect(late).toBeGreaterThan(0.5); // full-depth tremolo swings hard
    expect(early).toBeLessThan(late * 0.5); // early swing is much smaller
  });

  it("lfo_fade 0 starts at full depth immediately", () => {
    const env = tremoloEnvelope(0.05, 1, { lfo_fade: 0, lfo_rate: 8 });
    let mn = Infinity;
    let mx = 0;
    for (let i = 0; i < 25 && i < env.length; i += 1) {
      mn = Math.min(mn, env[i]);
      mx = Math.max(mx, env[i]);
    }
    expect((mx - mn) / (mx + mn)).toBeGreaterThan(0.5);
  });
});
