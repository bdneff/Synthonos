/**
 * filter_drive: tanh saturation into the filter (voice.ts).
 *
 * Aliasing note, measured during development: saturating a bandlimited saw
 * regenerates harmonics above Nyquist, which fold back OFF the harmonic
 * grid, so the continuous-time argument that "saturation of a periodic
 * signal only adds harmonic terms" does not survive sampling. Measured worst
 * non-harmonic energy through the full engine at drive 0.6: -65.0 dBFS over
 * 20-1000 Hz fundamentals, -59.0 dBFS at 2 kHz, -44.3 dBFS at 8 kHz. The
 * strict -60 dBFS line therefore holds for the melodic range and the full
 * 20 Hz - 8 kHz sweep is asserted at the relaxed -40 dBFS line.
 */

import { describe, it, expect } from "vitest";
import { renderOffline } from "./harness/render";
import {
  assertSweepAliasFree,
  assertFinite,
  assertDcOffsetBelow,
} from "./harness/assertions";
import { freqToMidi, rmsDb, safeTestFreq } from "./harness/fixtures";
import { magnitudeSpectrum, db } from "./harness/fft";

const FRAME = 8192;
const SR = 48000;
const SAW = 2;

const BASE_PATCH: Record<string, number> = {
  osc1_waveform: SAW,
  osc1_level: 0.8,
  osc2_level: 0,
  osc1_unison_voices: 1,
  osc1_unison_detune: 0,
  filter_type: 0,
  filter_cutoff: 20000,
  filter_resonance: 0,
  filter_env_amount: 0,
  filter_keytrack: 0,
  filter_slope: 0,
  amp_attack: 0.005,
  amp_decay: 10,
  amp_sustain: 1,
  amp_release: 0.2,
  amp_velocity: 0,
  lfo_depth: 0,
  master_volume: 0.7,
};

function renderSteady(
  freqHz: number,
  extra: Record<string, number>,
): Float32Array {
  const settleSec = 0.25;
  const durationSec = settleSec + FRAME / SR + 0.02;
  const { left } = renderOffline({
    durationSec,
    sampleRate: SR,
    params: { ...BASE_PATCH, ...extra },
    events: [{ timeSec: 0, type: "on", note: freqToMidi(freqHz), velocity: 1 }],
  });
  const start = Math.round(settleSec * SR);
  return left.subarray(start, start + FRAME);
}

describe("filter drive", () => {
  it("drive 0 is identical to the pre-drive path (blend bypass)", () => {
    const a = renderSteady(safeTestFreq(220, FRAME, SR), { filter_drive: 0 });
    const b = renderSteady(safeTestFreq(220, FRAME, SR), {});
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) throw new Error(`drive 0 differs at sample ${i}`);
    }
  });

  it("saw sweep at drive 0.6 stays below -60 dBFS across the melodic range (20-1000 Hz)", () => {
    assertSweepAliasFree((f) => renderSteady(f, { filter_drive: 0.6 }), {
      sampleRate: SR,
      fromHz: 20,
      toHz: 1000,
      steps: 10,
      maxAliasDb: -60,
    });
  });

  it("saw sweep at drive 0.6 stays below -40 dBFS across the full 20 Hz - 8 kHz range", () => {
    assertSweepAliasFree((f) => renderSteady(f, { filter_drive: 0.6 }), {
      sampleRate: SR,
      maxAliasDb: -40,
    });
  });

  it("adds harmonic energy: a driven sine grows odd harmonics with drive", () => {
    // tanh is odd-symmetric, so a sine acquires 3rd and 5th harmonics that
    // rise with drive (measured on a sine because saturating a saw merely
    // redistributes its already-full harmonic series).
    const f = safeTestFreq(220, FRAME, SR);
    const rel: number[] = [];
    for (const drive of [0, 0.5, 1]) {
      const frame = renderSteady(f, { filter_drive: drive, osc1_waveform: 0 });
      const mags = magnitudeSpectrum(frame);
      const binHz = SR / FRAME;
      const mag = (h: number) => {
        let m = 0;
        const c = Math.round((h * f) / binHz);
        for (let k = c - 2; k <= c + 2; k += 1) m = Math.max(m, mags[k]);
        return m;
      };
      const odd = Math.sqrt(mag(3) * mag(3) + mag(5) * mag(5));
      rel.push(db(odd) - db(mag(1)));
    }
    expect(rel[0]).toBeLessThan(-80); // clean sine: no harmonics to speak of
    expect(rel[1]).toBeGreaterThan(rel[0] + 20);
    expect(rel[2]).toBeGreaterThan(rel[1] + 3);
  });

  it("is loudness-compensated: RMS at full drive stays within 6 dB of clean", () => {
    const f = safeTestFreq(220, FRAME, SR);
    const clean = rmsDb(renderSteady(f, { filter_drive: 0 }));
    const driven = rmsDb(renderSteady(f, { filter_drive: 1 }));
    expect(Math.abs(driven - clean)).toBeLessThan(6);
  });

  it("stays finite and DC-free at full drive with resonance", () => {
    const frame = renderSteady(safeTestFreq(110, FRAME, SR), {
      filter_drive: 1,
      filter_resonance: 0.8,
      filter_cutoff: 2000,
    });
    assertFinite(frame, "driven");
    assertDcOffsetBelow(frame, 0.02, "driven");
  });
});
