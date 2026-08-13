/**
 * Batch render bridge for the Python audio-match service (Phase 2, tier 2).
 *
 * Reads JSON lines from stdin, one render request per line:
 *
 *   {"id": "gen3-cand12", "params": {"filter_cutoff": 2000, ...},
 *    "note": 60, "durationSec": 1.5, "sampleRate": 48000}
 *
 * `params` are engine-unit overrides (numbers only, enums as indices) applied
 * on top of the default patch, exactly what renderOffline expects. Each
 * request renders through the offline harness with a note-on at 0.02 s and a
 * note-off at 70% of the duration, then the L/R channels are averaged to mono.
 *
 * For each input line, exactly one JSON line is written to stdout, in input
 * order:
 *
 *   {"id": "gen3-cand12", "sampleRate": 48000, "samples_b64": "<base64 of
 *    little-endian float32 samples>"}
 *
 * A request that fails produces {"id": ..., "error": "<message>"} instead, so
 * the Python side can fail loudly per candidate without losing the batch.
 *
 * Batching a whole differential-evolution population through one invocation
 * amortizes Node + tsx startup, which would otherwise dominate the search.
 *
 * Run with: npx tsx scripts/render-batch.ts
 */

import { createInterface } from "node:readline";
import { renderOffline } from "../test/harness/render";

interface BatchRequest {
  id: string;
  params: Record<string, number>;
  note: number;
  durationSec: number;
  sampleRate: number;
}

const NOTE_ON_SEC = 0.02;
const NOTE_OFF_FRACTION = 0.7;

function renderOne(req: BatchRequest): string {
  const audio = renderOffline({
    durationSec: req.durationSec,
    sampleRate: req.sampleRate,
    params: req.params,
    events: [
      { timeSec: NOTE_ON_SEC, type: "on", note: req.note, velocity: 1 },
      { timeSec: req.durationSec * NOTE_OFF_FRACTION, type: "off", note: req.note },
    ],
  });
  const mono = new Float32Array(audio.left.length);
  for (let i = 0; i < mono.length; i += 1) {
    mono[i] = 0.5 * (audio.left[i] + audio.right[i]);
  }
  const b64 = Buffer.from(mono.buffer, mono.byteOffset, mono.byteLength).toString("base64");
  return JSON.stringify({ id: req.id, sampleRate: audio.sampleRate, samples_b64: b64 });
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let id = "";
    let out: string;
    try {
      const req = JSON.parse(trimmed) as BatchRequest;
      id = req.id;
      if (
        typeof req.id !== "string" ||
        typeof req.note !== "number" ||
        typeof req.durationSec !== "number" ||
        typeof req.sampleRate !== "number" ||
        typeof req.params !== "object" ||
        req.params === null
      ) {
        throw new Error("request must have id, params, note, durationSec, sampleRate");
      }
      out = renderOne(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      out = JSON.stringify({ id, error: message });
    }
    process.stdout.write(out + "\n");
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`render-batch: fatal: ${String(err)}\n`);
  process.exit(1);
});
