/**
 * Oscillator and unison spectral tests, rendered through the full engine:
 * filter wide open, resonance 0, LFO off, single unison voice, sustain 1,
 * measurement frames taken from the steady portion after the attack.
 *
 * The oscillator is bandlimited (mipmapped wavetables per SYNTH_REFERENCE
 * 5.4); the sweep enforces all non-harmonic energy below -60 dBFS from 20 Hz
 * to 8 kHz for every waveform, at 48 kHz and at non-default sample rates.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import {
  assertSweepAliasFree,
  assertAliasingBelow,
  assertDcOffsetBelow,
  assertFinite,
} from "./harness/assertions";
import { freqToMidi, rms, safeTestFreq } from "./harness/fixtures";

const FRAME = 8192;

/** Waveform indices mirroring the schema enum (pinned by dsp-constants test). */
const SINE = 0;
const TRIANGLE = 1;
const SAW = 2;
const SQUARE = 3;

const STEADY_PATCH: Record<string, number> = {
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_type: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.005,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.2,
  lfo_depth: 0,
  master_volume: 0.7,
};

/** Render a steady tone and return one FFT frame from well after the attack. */
function renderSteadyFrame(
  waveform: number,
  freqHz: number,
  sampleRate: number,
  extraParams: Record<string, number> = {},
): Float32Array {
  const settleSec = 0.25;
  const durationSec = settleSec + FRAME / sampleRate + 0.02;
  const { left } = renderOffline({
    durationSec,
    sampleRate,
    params: { ...STEADY_PATCH, osc1_waveform: waveform, ...extraParams },
    events: [{ timeSec: 0, type: "on", note: freqToMidi(freqHz), velocity: 1 }],
  });
  const start = Math.round(settleSec * sampleRate);
  return left.subarray(start, start + FRAME);
}

describe("oscillator aliasing (through the full engine)", () => {
  it("saw sweep 20 Hz - 8 kHz stays below -60 dBFS at 48 kHz", () => {
    assertSweepAliasFree((f) => renderSteadyFrame(SAW, f, 48000), {
      sampleRate: 48000,
    });
  });

  it("square sweep 20 Hz - 8 kHz stays below -60 dBFS at 48 kHz", () => {
    assertSweepAliasFree((f) => renderSteadyFrame(SQUARE, f, 48000), {
      sampleRate: 48000,
    });
  });

  it("triangle sweep 20 Hz - 8 kHz stays below -60 dBFS at 48 kHz", () => {
    assertSweepAliasFree((f) => renderSteadyFrame(TRIANGLE, f, 48000), {
      sampleRate: 48000,
    });
  });

  it("sine is pure at low, mid, high, and very high registers", () => {
    for (const raw of [55, 440, 3520, 7040]) {
      const f = safeTestFreq(raw, FRAME, 48000);
      const frame = renderSteadyFrame(SINE, f, 48000);
      assertAliasingBelow(
        frame,
        { sampleRate: 48000, fundamental: f, frameSize: FRAME },
        `sine at ${f.toFixed(1)} Hz`,
      );
    }
  });

  it("saw sweep is alias-free at 44100 Hz too", () => {
    assertSweepAliasFree((f) => renderSteadyFrame(SAW, f, 44100), {
      sampleRate: 44100,
    });
  });

  it("saw and square sweeps are alias-free at 96000 Hz", () => {
    assertSweepAliasFree((f) => renderSteadyFrame(SAW, f, 96000), {
      sampleRate: 96000,
      steps: 9,
    });
    assertSweepAliasFree((f) => renderSteadyFrame(SQUARE, f, 96000), {
      sampleRate: 96000,
      steps: 9,
    });
  });
});

describe("oscillator DC and shape sanity", () => {
  it("triangle and square carry no DC in the steady state", () => {
    for (const wave of [TRIANGLE, SQUARE, SAW]) {
      const f = safeTestFreq(220, FRAME, 48000);
      const frame = renderSteadyFrame(wave, f, 48000);
      assertFinite(frame, `wave ${wave}`);
      assertDcOffsetBelow(frame, 0.01, `wave ${wave}`);
    }
  });
});

describe("unison", () => {
  function renderUnison(
    voiceCount: number,
    detuneCents: number,
    pan = 0,
  ): { left: Float32Array; right: Float32Array; sampleRate: number } {
    return renderOffline({
      durationSec: 0.6,
      sampleRate: 48000,
      params: {
        ...STEADY_PATCH,
        osc1_waveform: SAW,
        osc1_unison_voices: voiceCount,
        osc1_unison_detune: detuneCents,
        osc1_pan: pan,
      },
      events: [{ timeSec: 0, type: "on", note: 57, velocity: 1 }],
    });
  }

  it("equal-power compensation keeps 1 and 8 voices at comparable loudness", () => {
    const a = renderUnison(1, 15);
    const b = renderUnison(8, 15);
    const from = Math.round(0.3 * 48000);
    const to = Math.round(0.58 * 48000);
    const rmsA = rms(a.left, from, to) + rms(a.right, from, to);
    const rmsB = rms(b.left, from, to) + rms(b.right, from, to);
    expect(rmsA).toBeGreaterThan(0);
    const ratio = rmsB / rmsA;
    // Within +/- 6 dB; detuned partial cancellation makes exact equality
    // impossible and undesirable.
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  it("unison spreads across the stereo field; a single center voice does not", () => {
    const wide = renderUnison(8, 30);
    const from = Math.round(0.3 * 48000);
    const to = Math.round(0.58 * 48000);
    // Normalized correlation between channels drops when spread.
    let dot = 0;
    let magL = 0;
    let magR = 0;
    for (let i = from; i < to; i += 1) {
      dot += wide.left[i] * wide.right[i];
      magL += wide.left[i] * wide.left[i];
      magR += wide.right[i] * wide.right[i];
    }
    const corr = dot / Math.sqrt(magL * magR);
    expect(corr).toBeLessThan(0.98);
    expect(rms(wide.left, from, to)).toBeGreaterThan(0.001);
    expect(rms(wide.right, from, to)).toBeGreaterThan(0.001);

    const mono = renderUnison(1, 0);
    let maxDiff = 0;
    for (let i = 0; i < mono.left.length; i += 1) {
      const d = Math.abs(mono.left[i] - mono.right[i]);
      if (d > maxDiff) maxDiff = d;
    }
    expect(maxDiff).toBeLessThan(1e-9);
  });

  it("hard pan sends the oscillator to one side", () => {
    const panned = renderUnison(1, 0, -1);
    const from = Math.round(0.3 * 48000);
    const to = Math.round(0.58 * 48000);
    expect(rms(panned.left, from, to)).toBeGreaterThan(0.01);
    expect(rms(panned.right, from, to)).toBeLessThan(1e-9);
  });

  it("unison renders are deterministic (fixed phases, no randomness)", () => {
    const a = renderUnison(8, 25);
    const b = renderUnison(8, 25);
    expect(a.left.length).toBe(b.left.length);
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`unison render differs at sample ${i}`);
      }
    }
  });
});
