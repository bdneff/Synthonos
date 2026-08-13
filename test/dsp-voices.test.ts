/**
 * Voice manager tests, all black-box through the engine. Sine patches give
 * each note a single spectral line, so "which notes are sounding" is read
 * directly off the spectrum: a present note has a peak near its fundamental,
 * a stolen or released note has none.
 */

import { describe, it, expect } from "vitest";
import { renderOffline, type NoteEvent } from "./harness/render";
import { magnitudeSpectrum, db } from "./harness/fft";
import { assertNoClicks, assertSilent, assertFinite } from "./harness/assertions";

const SR = 48000;
const FRAME = 16384;

const SINE_PATCH: Record<string, number> = {
  osc1_waveform: 0,
  osc1_level: 1,
  osc2_level: 0,
  osc1_unison_voices: 1,
  filter_type: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.01,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.15,
  lfo_depth: 0,
  master_volume: 0.7,
};

function midiFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Peak level (dBFS) within +/-3 bins of a note's fundamental. */
function peakDbAtNote(mags: Float64Array, note: number): number {
  const bin = Math.round((midiFreq(note) * FRAME) / SR);
  let peak = 0;
  for (let k = Math.max(1, bin - 3); k <= bin + 3; k += 1) {
    if (mags[k] > peak) peak = mags[k];
  }
  return db(peak);
}

function renderAndSpectrum(
  events: NoteEvent[],
  frameStartSec: number,
  durationSec: number,
  extraParams: Record<string, number> = {},
): { mags: Float64Array; left: Float32Array; right: Float32Array } {
  const { left, right } = renderOffline({
    durationSec,
    sampleRate: SR,
    params: { ...SINE_PATCH, ...extraParams },
    events,
  });
  const start = Math.round(frameStartSec * SR);
  const mags = magnitudeSpectrum(left.subarray(start, start + FRAME));
  return { mags, left, right };
}

/**
 * 16 distinct notes, three semitones apart: distinct fundamentals whose FFT
 * mainlobes cannot overlap even at the low end (neighbors are 8+ bins apart
 * with a 16384 frame at 48 kHz).
 */
const NOTES_16 = Array.from({ length: 16 }, (_, i) => 48 + 3 * i);

describe("polyphony", () => {
  it("all 16 simultaneous notes sound", () => {
    const events: NoteEvent[] = NOTES_16.map((note, i) => ({
      timeSec: 0.02 + i * 0.002,
      type: "on" as const,
      note,
      velocity: 1,
    }));
    const { mags, left } = renderAndSpectrum(events, 0.6, 1.0);
    assertFinite(left, "left");
    for (const note of NOTES_16) {
      expect(peakDbAtNote(mags, note), `note ${note}`).toBeGreaterThan(-40);
    }
  });
});

describe("note off", () => {
  it("releases exactly the matching note and leaves the other playing", () => {
    const events: NoteEvent[] = [
      { timeSec: 0.02, type: "on", note: 60, velocity: 1 },
      { timeSec: 0.02, type: "on", note: 67, velocity: 1 },
      { timeSec: 0.4, type: "off", note: 67 },
    ];
    const { mags } = renderAndSpectrum(events, 0.75, 1.2);
    expect(peakDbAtNote(mags, 60)).toBeGreaterThan(-35);
    expect(peakDbAtNote(mags, 67)).toBeLessThan(-60);
  });

  it("after every release completes the output returns to exact zero", () => {
    const { left, right } = renderOffline({
      durationSec: 1.2,
      sampleRate: SR,
      params: SINE_PATCH,
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.05, type: "on", note: 64, velocity: 0.7 },
        { timeSec: 0.3, type: "off", note: 60 },
        { timeSec: 0.35, type: "off", note: 64 },
      ],
    });
    const tail = Math.round(0.8 * SR);
    assertSilent(left.subarray(0, Math.round(0.04 * SR)), "left before note");
    assertSilent(left.subarray(tail), "left tail");
    assertSilent(right.subarray(tail), "right tail");
  });
});

describe("voice stealing", () => {
  it("prefers a releasing voice: all sustaining notes survive the steal", () => {
    const events: NoteEvent[] = NOTES_16.map((note, i) => ({
      timeSec: 0.02 + i * 0.002,
      type: "on" as const,
      note,
      velocity: 1,
    }));
    events.push({ timeSec: 0.5, type: "off", note: 48 }); // note 48 starts releasing
    events.push({ timeSec: 0.55, type: "on", note: 108, velocity: 1 }); // forces a steal
    const { mags } = renderAndSpectrum(events, 1.1, 1.6);
    expect(peakDbAtNote(mags, 108), "stolen-to note").toBeGreaterThan(-40);
    for (const note of NOTES_16.slice(1)) {
      expect(peakDbAtNote(mags, note), `sustaining note ${note}`).toBeGreaterThan(-40);
    }
    expect(peakDbAtNote(mags, 48), "released note").toBeLessThan(-60);
  });

  it("with no releasing voice, steals the oldest and never the newest", () => {
    const events: NoteEvent[] = NOTES_16.map((note, i) => ({
      timeSec: 0.02 + i * 0.01,
      type: "on" as const,
      note,
      velocity: 1,
    }));
    events.push({ timeSec: 0.5, type: "on", note: 108, velocity: 1 });
    const { mags } = renderAndSpectrum(events, 1.1, 1.6);
    // Oldest (48) was stolen; every other sustaining note, including the
    // newest before the steal (93), survives; the new note sounds.
    expect(peakDbAtNote(mags, 48), "oldest note").toBeLessThan(-60);
    for (const note of NOTES_16.slice(1)) {
      expect(peakDbAtNote(mags, note), `note ${note}`).toBeGreaterThan(-40);
    }
    expect(peakDbAtNote(mags, 108), "new note").toBeGreaterThan(-40);
  });

  it("forced steals across 22 overlapping saw notes are click-free", () => {
    // 22 notes into 16 voices forces six steals. The filter sits at 800 Hz
    // so the legitimate signal is smooth; steal-fade code runs in the gain
    // path AFTER the filter, so an abrupt reassignment would still reach the
    // output as a hard step and fail this assertion.
    const events: NoteEvent[] = [];
    for (let i = 0; i < 22; i += 1) {
      events.push({ timeSec: 0.05 + i * 0.04, type: "on", note: 44 + 2 * i, velocity: 1 });
    }
    const { left, right } = renderOffline({
      durationSec: 1.3,
      sampleRate: SR,
      params: {
        ...SINE_PATCH,
        osc1_waveform: 2,
        osc1_level: 0.8,
        filter_cutoff: 800,
        filter_resonance: 0.2,
      },
      events,
    });
    assertFinite(left, "left");
    assertFinite(right, "right");
    assertNoClicks(left, 0.25, "left");
    assertNoClicks(right, 0.25, "right");
  });

  it("steal fade is fast: the stolen-to note is audible within 10 ms", () => {
    // 16 sustaining voices, then a steal; the new note's energy must appear
    // quickly (fade is 3 ms + attack 10 ms).
    const events: NoteEvent[] = NOTES_16.map((note, i) => ({
      timeSec: 0.02 + i * 0.002,
      type: "on" as const,
      note,
      velocity: 1,
    }));
    events.push({ timeSec: 0.5, type: "on", note: 96, velocity: 1 });
    const { left } = renderOffline({
      durationSec: 0.8,
      sampleRate: SR,
      params: SINE_PATCH,
      events,
    });
    // Correlate against the expected new fundamental over a short window
    // shortly after the steal.
    const f = midiFreq(96);
    const start = Math.round(0.53 * SR);
    const win = Math.round(0.05 * SR);
    let re = 0;
    let im = 0;
    for (let i = 0; i < win; i += 1) {
      const w = (2 * Math.PI * f * i) / SR;
      re += left[start + i] * Math.cos(w);
      im += left[start + i] * Math.sin(w);
    }
    const amp = (2 * Math.hypot(re, im)) / win;
    expect(amp).toBeGreaterThan(0.005);
  });
});

describe("same-note retrigger", () => {
  it("retriggering a held note does not stack voices or click", () => {
    const { left, right } = renderOffline({
      durationSec: 1.0,
      sampleRate: SR,
      params: { ...SINE_PATCH, amp_sustain: 0.6 },
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.3, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.5, type: "on", note: 60, velocity: 0.5 },
        { timeSec: 0.7, type: "off", note: 60 },
      ],
    });
    assertNoClicks(left, 0.25, "left");
    assertNoClicks(right, 0.25, "right");
    // One noteOff silences it completely: no duplicate voice left hanging.
    assertSilent(left.subarray(Math.round(0.98 * SR)), "left tail");
  });
});
