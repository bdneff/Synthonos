/**
 * Chorus (second stage of the fixed chain): time-varying fractional delay.
 * A pure sine through a modulated delay acquires FM sidebands around the
 * carrier; mix 0 must be a bit-exact passthrough, and the two channels'
 * modulators run in quadrature so the effect decorrelates left from right.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import { magnitudeSpectrum, binFrequency, db } from "./harness/fft";
import { freqToMidi, safeTestFreq } from "./harness/fixtures";
import { assertFinite, assertNoClicks } from "./harness/assertions";

const SR = 48000;
const FRAME = 8192;

const SINE_PATCH: Record<string, number> = {
  osc1_waveform: 0,
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  amp_attack: 0.005,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.2,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

function renderSteady(freqHz: number, extra: Record<string, number>, seconds = 1.2) {
  return renderOffline({
    durationSec: seconds,
    sampleRate: SR,
    params: { ...SINE_PATCH, ...extra },
    events: [{ timeSec: 0, type: "on", note: freqToMidi(freqHz), velocity: 1 }],
  });
}

/** Energy in a band excluding +/- tolBins around the carrier bin. */
function sidebandDb(frame: Float32Array, carrierHz: number, spanHz: number): number {
  const mags = magnitudeSpectrum(frame);
  const binHz = SR / FRAME;
  const carrierBin = Math.round(carrierHz / binHz);
  let sum = 0;
  for (let k = 1; k < mags.length; k += 1) {
    const f = binFrequency(k, FRAME, SR);
    if (Math.abs(f - carrierHz) > spanHz) continue;
    if (Math.abs(k - carrierBin) <= 3) continue; // the carrier itself
    sum += mags[k] * mags[k];
  }
  return db(Math.sqrt(sum));
}

describe("chorus", () => {
  it("mix 0 is a bit-exact passthrough at any depth/rate", () => {
    const f = safeTestFreq(440, FRAME, SR);
    const a = renderSteady(f, {});
    const b = renderSteady(f, { chorus_rate: 3, chorus_depth: 1, chorus_mix: 0 });
    for (let i = 0; i < a.left.length; i += 1) {
      if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) {
        throw new Error(`chorus mix 0 differs at sample ${i}`);
      }
    }
  });

  it("produces a time-varying delay: a sine acquires sidebands", () => {
    const f = safeTestFreq(1000, FRAME, SR);
    const start = Math.round(0.3 * SR);
    const dry = renderSteady(f, {}).left.subarray(start, start + FRAME);
    const wet = renderSteady(f, {
      chorus_rate: 2,
      chorus_depth: 0.8,
      chorus_mix: 1,
    }).left.subarray(start, start + FRAME);
    const drySb = sidebandDb(dry, f, 400);
    const wetSb = sidebandDb(wet, f, 400);
    expect(wetSb).toBeGreaterThan(drySb + 20);
    expect(wetSb).toBeGreaterThan(-60);
  });

  it("depth 0 leaves the pitch unmodulated (static delay, no sidebands)", () => {
    const f = safeTestFreq(1000, FRAME, SR);
    const start = Math.round(0.3 * SR);
    const wet = renderSteady(f, {
      chorus_rate: 2,
      chorus_depth: 0,
      chorus_mix: 1,
    }).left.subarray(start, start + FRAME);
    expect(sidebandDb(wet, f, 400)).toBeLessThan(-60);
  });

  it("decorrelates the channels (quadrature LFO phases)", () => {
    const f = safeTestFreq(500, FRAME, SR);
    const audio = renderSteady(f, {
      chorus_rate: 1.5,
      chorus_depth: 1,
      chorus_mix: 1,
    });
    const from = Math.round(0.3 * SR);
    const to = Math.round(1.1 * SR);
    let dot = 0;
    let magL = 0;
    let magR = 0;
    for (let i = from; i < to; i += 1) {
      dot += audio.left[i] * audio.right[i];
      magL += audio.left[i] * audio.left[i];
      magR += audio.right[i] * audio.right[i];
    }
    expect(dot / Math.sqrt(magL * magR)).toBeLessThan(0.98);
  });

  it("stays finite and click-free at extreme settings", () => {
    const audio = renderSteady(safeTestFreq(220, FRAME, SR), {
      chorus_rate: 8,
      chorus_depth: 1,
      chorus_mix: 1,
    });
    assertFinite(audio.left, "left");
    assertFinite(audio.right, "right");
    assertNoClicks(audio.left, 0.25, "left");
    assertNoClicks(audio.right, 0.25, "right");
  });
});
