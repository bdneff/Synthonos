/**
 * CLI wrapper around the offline harness: render the default preset playing a
 * note, write a WAV to test/output/, and run the always-applicable assertions
 * on the result. Usage:
 *
 *   npm run render                # 2 seconds, middle C
 *   npm run render -- 4 69       # 4 seconds, A4
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOffline } from "../test/harness/render";
import { encodeWavFloat32 } from "../test/harness/wav";
import {
  assertFinite,
  assertNoDenormals,
  assertDcOffsetBelow,
  measureDcOffset,
  findWorstStep,
} from "../test/harness/assertions";

const durationSec = Number(process.argv[2] ?? "2");
const note = Number(process.argv[3] ?? "60");

const audio = renderOffline({
  durationSec,
  events: [
    { timeSec: 0.05, type: "on", note, velocity: 1 },
    { timeSec: durationSec * 0.75, type: "off", note },
  ],
});

for (const [buf, label] of [
  [audio.left, "left"],
  [audio.right, "right"],
] as const) {
  assertFinite(buf, label);
  assertNoDenormals(buf, label);
  assertDcOffsetBelow(buf, 0.01, label);
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../test/output");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `render-note${note}.wav`);
writeFileSync(
  outPath,
  encodeWavFloat32({
    sampleRate: audio.sampleRate,
    channels: [audio.left, audio.right],
  }),
);

let peak = 0;
for (let i = 0; i < audio.left.length; i += 1) {
  peak = Math.max(peak, Math.abs(audio.left[i]), Math.abs(audio.right[i]));
}
console.log(`rendered ${durationSec}s of note ${note} at ${audio.sampleRate} Hz`);
console.log(`peak: ${peak.toFixed(4)}  dc(left): ${measureDcOffset(audio.left).toExponential(2)}  worst step: ${findWorstStep(audio.left).step.toFixed(4)}`);
console.log(`wrote ${outPath}`);
console.log("assertions passed: finite, no denormals, DC within bounds");
