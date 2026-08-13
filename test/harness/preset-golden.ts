/**
 * Golden renders for the factory preset bank. Each preset renders MONO
 * (the average of L and R) for 0.5 s at 48 kHz and is checked bit-exactly
 * against test/golden/presets/<slug>.wav, with the same UPDATE_GOLDEN=1
 * regeneration flow as the main golden mechanism in golden.ts.
 *
 * Float32 mono at 0.5 s is ~94 KB per file, ~3.8 MB for the 40-preset bank.
 * That is accepted in plain git for now; when the bank grows or renders get
 * longer, move test/golden/ to git-lfs per build plan section 6.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParamId, ParamValue } from "../../src/generated/params";
import { encodeWavFloat32, decodeWavFloat32 } from "./wav";
import { renderOffline } from "./render";
import { patchParamsToEngine } from "./patch";

const PRESET_GOLDEN_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../golden/presets",
);

export const PRESET_GOLDEN_SAMPLE_RATE = 48000;
export const PRESET_GOLDEN_DURATION_SEC = 0.5;
const NOTE_ON_SEC = 0.02;
const NOTE_OFF_SEC = 0.35;

/**
 * Category-appropriate audition note, shared by the golden renders and the
 * factory character tests: basses at C2, pads at A3, everything else at C4.
 */
export function presetTestNote(category: string): number {
  if (category === "Basses") return 36;
  if (category === "Pads") return 57;
  return 60;
}

/** Filesystem-safe slug for a preset name: "Warm Pad" -> "warm-pad". */
export function presetSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") throw new Error(`preset slug: empty for "${name}"`);
  return slug;
}

export interface PresetLike {
  readonly name: string;
  readonly category: string;
  readonly params: Record<ParamId, ParamValue>;
}

/** Render a factory preset to the mono golden format (average of L and R). */
export function renderPresetForGolden(preset: PresetLike): Float32Array {
  const note = presetTestNote(preset.category);
  const audio = renderOffline({
    durationSec: PRESET_GOLDEN_DURATION_SEC,
    sampleRate: PRESET_GOLDEN_SAMPLE_RATE,
    params: patchParamsToEngine(preset.params),
    events: [
      { timeSec: NOTE_ON_SEC, type: "on", note, velocity: 1 },
      { timeSec: NOTE_OFF_SEC, type: "off", note },
    ],
  });
  const mono = new Float32Array(audio.left.length);
  for (let i = 0; i < mono.length; i += 1) {
    // Float32 rounding keeps this bit-exact across runs: same inputs, same op.
    mono[i] = Math.fround((audio.left[i] + audio.right[i]) / 2);
  }
  return mono;
}

/**
 * Compare a mono preset render against test/golden/presets/<slug>.wav.
 * Missing goldens are created (then the test fails once, asking for a commit,
 * exactly like compareToGolden); UPDATE_GOLDEN=1 rewrites deliberately.
 */
export function compareToPresetGolden(slug: string, mono: Float32Array): void {
  const path = resolve(PRESET_GOLDEN_DIR, `${slug}.wav`);
  const encoded = encodeWavFloat32({
    sampleRate: PRESET_GOLDEN_SAMPLE_RATE,
    channels: [mono],
  });

  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(path)) {
    mkdirSync(PRESET_GOLDEN_DIR, { recursive: true });
    writeFileSync(path, encoded);
    if (process.env.UPDATE_GOLDEN !== "1") {
      throw new Error(
        `preset golden "${slug}" did not exist and was created at ${path}. ` +
          `Inspect it, commit it, and re-run.`,
      );
    }
    return;
  }

  const golden = decodeWavFloat32(new Uint8Array(readFileSync(path)));
  if (golden.sampleRate !== PRESET_GOLDEN_SAMPLE_RATE) {
    throw new Error(
      `preset golden "${slug}": sample rate ${golden.sampleRate} != ${PRESET_GOLDEN_SAMPLE_RATE}`,
    );
  }
  if (golden.channels.length !== 1) {
    throw new Error(`preset golden "${slug}": expected mono, got ${golden.channels.length} channels`);
  }
  const want = golden.channels[0];
  if (want.length !== mono.length) {
    throw new Error(
      `preset golden "${slug}": length ${mono.length} != golden ${want.length}`,
    );
  }
  for (let i = 0; i < mono.length; i += 1) {
    if (mono[i] !== want[i]) {
      throw new Error(
        `preset golden "${slug}": first difference at sample ${i} ` +
          `(${want[i]} -> ${mono[i]}). If this change is intentional, ` +
          `regenerate with UPDATE_GOLDEN=1 npm test and review the new WAV.`,
      );
    }
  }
}
