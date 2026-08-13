/**
 * Golden render comparison. Every factory preset renders a reference WAV
 * checked into test/golden/. A commit that changes any of them fails CI until
 * the diff is inspected and the golden regenerated on purpose. This catches
 * the "small refactor silently changed the sound of everything" class of bug.
 *
 * Regenerate deliberately with: UPDATE_GOLDEN=1 npm test
 *
 * Note: goldens are currently small enough for plain git. Once real synthesis
 * makes them heavier, move test/golden/ to git-lfs per the build plan.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeWavFloat32, decodeWavFloat32 } from "./wav";
import type { RenderedAudio } from "./render";

const GOLDEN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../golden");

export function compareToGolden(name: string, audio: RenderedAudio): void {
  const path = resolve(GOLDEN_DIR, `${name}.wav`);
  const encoded = encodeWavFloat32({
    sampleRate: audio.sampleRate,
    channels: [audio.left, audio.right],
  });

  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(path)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(path, encoded);
    if (process.env.UPDATE_GOLDEN !== "1") {
      throw new Error(
        `golden "${name}" did not exist and was created at ${path}. ` +
          `Inspect it, commit it, and re-run.`,
      );
    }
    return;
  }

  const golden = decodeWavFloat32(new Uint8Array(readFileSync(path)));
  if (golden.sampleRate !== audio.sampleRate) {
    throw new Error(
      `golden "${name}": sample rate ${audio.sampleRate} != golden ${golden.sampleRate}`,
    );
  }
  const channels = [audio.left, audio.right];
  if (golden.channels.length !== channels.length) {
    throw new Error(`golden "${name}": channel count changed`);
  }
  for (let c = 0; c < channels.length; c += 1) {
    const got = channels[c];
    const want = golden.channels[c];
    if (got.length !== want.length) {
      throw new Error(
        `golden "${name}" ch${c}: length ${got.length} != golden ${want.length}`,
      );
    }
    for (let i = 0; i < got.length; i += 1) {
      if (got[i] !== want[i]) {
        throw new Error(
          `golden "${name}" ch${c}: first difference at sample ${i} ` +
            `(${want[i]} -> ${got[i]}). If this change is intentional, ` +
            `regenerate with UPDATE_GOLDEN=1 npm test and review the new WAV.`,
        );
      }
    }
  }
}
