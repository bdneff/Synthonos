/**
 * Factory preset bank tests: shape (40 valid, unique, categorized), audio
 * health (every preset renders clean at a consistent loudness), and
 * objective per-category character assertions so a "pad" cannot silently
 * become a pluck in a refactor.
 */

import { describe, it, expect } from "vitest";
import { FACTORY_CATEGORIES, FACTORY_PRESETS } from "../src/presets";
import type { FactoryPreset } from "../src/presets";
import { validatePatchParams } from "../src/generated/params";
import { renderOffline } from "./harness/render";
import type { RenderedAudio } from "./harness/render";
import { patchParamsToEngine } from "./harness/patch";
import { assertFinite, assertNoDenormals } from "./harness/assertions";
import { magnitudeSpectrum, binFrequency } from "./harness/fft";
import { presetTestNote } from "./harness/preset-golden";

const SR = 48000;
const DUR = 0.6;
const NOTE_ON = 0.02;
const NOTE_OFF = 0.42;
// Held-portion measurement window: after the note-on transient, before the
// release. Slow-attack pads are still rising here, which the wide RMS band
// below allows for.
const WIN_FROM = Math.round(0.05 * SR);
const WIN_TO = Math.round(0.3 * SR);

function renderPreset(preset: FactoryPreset): RenderedAudio {
  const note = presetTestNote(preset.category);
  return renderOffline({
    durationSec: DUR,
    sampleRate: SR,
    params: patchParamsToEngine(preset.params),
    events: [
      { timeSec: NOTE_ON, type: "on", note, velocity: 1 },
      { timeSec: NOTE_OFF, type: "off", note },
    ],
  });
}

// Rendering all 40 presets takes a while; do it once and share.
const renderCache = new Map<string, RenderedAudio>();
function rendered(preset: FactoryPreset): RenderedAudio {
  let audio = renderCache.get(preset.name);
  if (audio === undefined) {
    audio = renderPreset(preset);
    renderCache.set(preset.name, audio);
  }
  return audio;
}

function heldRmsDb(audio: RenderedAudio): number {
  let sum = 0;
  for (let i = WIN_FROM; i < WIN_TO; i += 1) {
    sum += (audio.left[i] * audio.left[i] + audio.right[i] * audio.right[i]) / 2;
  }
  const rms = Math.sqrt(sum / (WIN_TO - WIN_FROM));
  return 20 * Math.log10(Math.max(rms, 1e-12));
}

function peakOf(audio: RenderedAudio): number {
  let peak = 0;
  for (let i = 0; i < audio.left.length; i += 1) {
    const l = Math.abs(audio.left[i]);
    const r = Math.abs(audio.right[i]);
    if (l > peak) peak = l;
    if (r > peak) peak = r;
  }
  return peak;
}

/** Spectral centroid (Hz) of a mono 4096-sample frame from the held note. */
function centroidHz(audio: RenderedAudio): number {
  const frameSize = 4096;
  const frame = new Float32Array(frameSize);
  const start = Math.round(0.15 * SR);
  for (let i = 0; i < frameSize; i += 1) {
    frame[i] = (audio.left[start + i] + audio.right[start + i]) / 2;
  }
  const mags = magnitudeSpectrum(frame);
  let num = 0;
  let den = 0;
  for (let k = 1; k < mags.length; k += 1) {
    num += binFrequency(k, frameSize, SR) * mags[k];
    den += mags[k];
  }
  return den > 0 ? num / den : 0;
}

function byCategory(category: string): FactoryPreset[] {
  return FACTORY_PRESETS.filter((p) => p.category === category);
}

describe("factory preset bank shape", () => {
  it("has exactly 40 presets", () => {
    expect(FACTORY_PRESETS.length).toBe(40);
  });

  it("every preset passes full validation", () => {
    for (const preset of FACTORY_PRESETS) {
      const issues = validatePatchParams(preset.params, "full");
      expect(issues, `${preset.name}: ${JSON.stringify(issues)}`).toEqual([]);
    }
  });

  it("names are unique and nonempty", () => {
    const names = FACTORY_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.trim()).not.toBe("");
  });

  it("every preset has a nonempty category and the category list matches", () => {
    for (const preset of FACTORY_PRESETS) {
      expect(preset.category.trim(), preset.name).not.toBe("");
      expect(FACTORY_CATEGORIES).toContain(preset.category);
    }
    // No category header would ever render empty.
    for (const category of FACTORY_CATEGORIES) {
      expect(byCategory(category).length).toBeGreaterThan(0);
    }
  });
});

describe("factory preset renders", () => {
  it(
    "every preset renders finite, denormal-free, non-clipping audio at a consistent loudness",
    { timeout: 120_000 },
    () => {
      for (const preset of FACTORY_PRESETS) {
        const audio = rendered(preset);
        assertFinite(audio.left, `${preset.name} left`);
        assertFinite(audio.right, `${preset.name} right`);
        assertNoDenormals(audio.left, `${preset.name} left`);
        assertNoDenormals(audio.right, `${preset.name} right`);
        const peak = peakOf(audio);
        expect(peak, `${preset.name} peak`).toBeLessThan(0.99);
        const rmsDb = heldRmsDb(audio);
        expect(rmsDb, `${preset.name} held RMS dB`).toBeGreaterThan(-34);
        expect(rmsDb, `${preset.name} held RMS dB`).toBeLessThan(-14);
      }
    },
  );

  it("rendering the same preset twice is bit-identical", { timeout: 30_000 }, () => {
    const preset = FACTORY_PRESETS.find((p) => p.name === "Supersaw Sunrise");
    expect(preset).toBeDefined();
    const a = renderPreset(preset as FactoryPreset);
    const b = renderPreset(preset as FactoryPreset);
    expect(
      Buffer.from(a.left.buffer, a.left.byteOffset, a.left.byteLength).equals(
        Buffer.from(b.left.buffer, b.left.byteOffset, b.left.byteLength),
      ),
    ).toBe(true);
    expect(
      Buffer.from(a.right.buffer, a.right.byteOffset, a.right.byteLength).equals(
        Buffer.from(b.right.buffer, b.right.byteOffset, b.right.byteLength),
      ),
    ).toBe(true);
  });
});

describe("factory preset character", () => {
  it("pads fade in and ring out (attack >= 0.05 s, release >= 0.3 s)", () => {
    const pads = byCategory("Pads");
    expect(pads.length).toBeGreaterThan(0);
    for (const pad of pads) {
      expect(pad.params.amp_attack as number, pad.name).toBeGreaterThanOrEqual(0.05);
      expect(pad.params.amp_release as number, pad.name).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("plucks die away (sustain <= 0.25, filter env decay <= 0.5 s)", () => {
    const plucks = byCategory("Plucks");
    expect(plucks.length).toBeGreaterThan(0);
    for (const pluck of plucks) {
      expect(pluck.params.amp_sustain as number, pluck.name).toBeLessThanOrEqual(0.25);
      expect(pluck.params.fenv_decay as number, pluck.name).toBeLessThanOrEqual(0.5);
    }
  });

  it(
    "basses are spectrally darker than leads on average",
    { timeout: 120_000 },
    () => {
      const basses = byCategory("Basses");
      const leads = byCategory("Leads");
      expect(basses.length).toBeGreaterThan(0);
      expect(leads.length).toBeGreaterThan(0);
      const avg = (presets: FactoryPreset[]) =>
        presets.reduce((sum, p) => sum + centroidHz(rendered(p)), 0) /
        presets.length;
      const bassCentroid = avg(basses);
      const leadCentroid = avg(leads);
      expect(bassCentroid).toBeLessThan(leadCentroid);
    },
  );

  it("at least 12 presets use an effect (any effect mix > 0)", () => {
    const withEffects = FACTORY_PRESETS.filter(
      (p) =>
        (p.params.distortion_mix as number) > 0 ||
        (p.params.chorus_mix as number) > 0 ||
        (p.params.delay_mix as number) > 0 ||
        (p.params.reverb_mix as number) > 0,
    );
    expect(withEffects.length).toBeGreaterThanOrEqual(12);
  });

  it("at least 6 presets stack unison (4 or more voices on either oscillator)", () => {
    const withUnison = FACTORY_PRESETS.filter(
      (p) =>
        (p.params.osc1_unison_voices as number) >= 4 ||
        (p.params.osc2_unison_voices as number) >= 4,
    );
    expect(withUnison.length).toBeGreaterThanOrEqual(6);
  });
});
