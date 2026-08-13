/**
 * Client for the local audio-to-patch matching service (python/synthmatch).
 * Pure logic, no React. The service speaks standard server-sent events over
 * a POSTed multipart form: one "progress" event per search generation, then
 * a single "result" or "error" event.
 *
 * The final result's params must pass validatePatchParams in full mode
 * before anything is handed back to the caller; an invalid patch is a hard
 * failure, never applied.
 */

import { validatePatchParams } from "../generated/params";
import type { ParamId, ParamValue } from "../generated/params";

export type MatchParams = Record<ParamId, ParamValue>;

/** Default service address: uvicorn's default port on localhost. */
export const DEFAULT_MATCH_URL = "http://127.0.0.1:8000";

/** localStorage key that overrides the service address. */
export const MATCH_URL_STORAGE_KEY = "synthonos.match_url";

/** The slice of the Storage interface we need; injectable for tests. */
export interface StorageLike {
  getItem(key: string): string | null;
}

/**
 * Resolve the service base URL. An override stored under
 * MATCH_URL_STORAGE_KEY wins; blank or missing falls back to the default.
 * Trailing slashes are trimmed so paths can be appended directly.
 */
export function matchServiceUrl(storage?: StorageLike | null): string {
  const source =
    storage !== undefined
      ? storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;
  let raw: string | null = null;
  try {
    raw = source?.getItem(MATCH_URL_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return DEFAULT_MATCH_URL;
  return trimmed.replace(/\/+$/, "");
}

/** GET /health with a short timeout. Never throws. */
export async function checkHealth(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetchImpl(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- SSE parsing ---------- */

export interface SseEvent {
  /** Event type; "message" when the stream did not name one. */
  event: string;
  /** Data payload; multi-line data fields are joined with newlines. */
  data: string;
}

/**
 * Incremental server-sent-events parser. Feed it decoded text chunks in any
 * split; it emits one SseEvent per blank-line-terminated block. Comment
 * lines and lines without a field separator are skipped.
 */
export class SseParser {
  private buffer = "";
  private eventType = "";
  private dataLines: string[] = [];

  constructor(private readonly onEvent: (event: SseEvent) => void) {}

  push(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      let line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.handleLine(line);
    }
  }

  /** Flush at end of stream: a final unterminated block still dispatches. */
  end(): void {
    if (this.buffer !== "") {
      let line = this.buffer;
      this.buffer = "";
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.handleLine(line);
    }
    this.dispatch();
  }

  private handleLine(line: string): void {
    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return; // comment
    const colon = line.indexOf(":");
    if (colon === -1) return; // malformed line: skip
    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") this.eventType = value;
    else if (field === "data") this.dataLines.push(value);
    // id, retry, and unknown fields are ignored.
  }

  private dispatch(): void {
    if (this.dataLines.length === 0) {
      this.eventType = "";
      return;
    }
    const event: SseEvent = {
      event: this.eventType === "" ? "message" : this.eventType,
      data: this.dataLines.join("\n"),
    };
    this.eventType = "";
    this.dataLines = [];
    this.onEvent(event);
  }
}

/* ---------- Event payloads ---------- */

export interface MatchProgress {
  generation: number;
  bestLoss: number;
  medianLoss: number;
  renders: number;
  elapsedSec: number;
}

/** Parse a progress event payload. Returns null on anything malformed. */
export function parseProgress(data: string): MatchProgress | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const num = (key: string): number | null => {
    const v = rec[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const generation = num("generation");
  const bestLoss = num("best_loss");
  if (generation === null || bestLoss === null) return null;
  return {
    generation: Math.round(generation),
    bestLoss,
    medianLoss: num("median_loss") ?? bestLoss,
    renders: num("renders") ?? 0,
    elapsedSec: num("elapsed_sec") ?? 0,
  };
}

export interface MatchOutcome {
  params: MatchParams;
  loss: number;
  nRenders: number;
  wallSeconds: number;
}

export type ResultValidation =
  | { ok: true; outcome: MatchOutcome }
  | { ok: false; message: string };

/**
 * Parse and validate a result event payload. The params must pass the
 * generated validator in full mode; otherwise the whole result is rejected.
 */
export function validateMatchResult(data: string): ResultValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return { ok: false, message: "The service sent a result that could not be read." };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "The service sent a result that could not be read." };
  }
  const rec = raw as Record<string, unknown>;
  const issues = validatePatchParams(rec["params"], "full");
  if (issues.length > 0) {
    const first = issues[0];
    return {
      ok: false,
      message: `The matched patch failed validation (${first.param}: ${first.message}). Nothing was changed.`,
    };
  }
  const num = (key: string): number => {
    const v = rec[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return {
    ok: true,
    outcome: {
      params: rec["params"] as MatchParams,
      loss: num("loss"),
      nRenders: num("n_renders"),
      wallSeconds: num("wall_seconds"),
    },
  };
}

/* ---------- The streaming match call ---------- */

/** A readable failure from the match service or its response. */
export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchError";
  }
}

export interface MatchStreamOptions {
  file: Blob;
  filename?: string;
  /** MIDI note the clip is assumed to play. Default 48 (C3). */
  note?: number;
  baseUrl?: string;
  signal?: AbortSignal;
  onProgress?: (progress: MatchProgress) => void;
  fetchImpl?: typeof fetch;
}

function parseErrorDetail(data: string): string {
  try {
    const raw = JSON.parse(data) as unknown;
    if (typeof raw === "object" && raw !== null) {
      const detail = (raw as Record<string, unknown>)["detail"];
      if (typeof detail === "string" && detail !== "") return detail;
    }
  } catch {
    // fall through
  }
  return "The match failed inside the analysis service.";
}

/**
 * POST the clip to /match/stream and follow the SSE stream. Progress events
 * are forwarded to onProgress; the promise resolves with the validated
 * final patch or rejects with a MatchError (or the abort reason).
 */
export async function matchStream(
  options: MatchStreamOptions,
): Promise<MatchOutcome> {
  const baseUrl = options.baseUrl ?? matchServiceUrl();
  const fetchImpl = options.fetchImpl ?? fetch;

  const form = new FormData();
  form.append("file", options.file, options.filename ?? "target.wav");
  form.append("note", String(options.note ?? 48));

  const res = await fetchImpl(`${baseUrl}/match/stream`, {
    method: "POST",
    body: form,
    signal: options.signal,
  });
  if (!res.ok) {
    let detail = `The analysis service returned an error (${res.status}).`;
    try {
      const body = (await res.json()) as unknown;
      if (typeof body === "object" && body !== null) {
        const d = (body as Record<string, unknown>)["detail"];
        if (typeof d === "string" && d !== "") detail = d;
      }
    } catch {
      // keep the status-based message
    }
    throw new MatchError(detail);
  }
  if (res.body === null) {
    throw new MatchError("The analysis service sent an empty response.");
  }

  // Holder object so assignments made inside the parser callback are
  // visible to the read loop without narrowing surprises.
  const state: { outcome: MatchOutcome | null; failure: string | null } = {
    outcome: null,
    failure: null,
  };

  const parser = new SseParser((event) => {
    if (state.outcome !== null || state.failure !== null) return; // terminal already seen
    if (event.event === "progress") {
      const progress = parseProgress(event.data);
      if (progress !== null) options.onProgress?.(progress);
    } else if (event.event === "result") {
      const validated = validateMatchResult(event.data);
      if (validated.ok) state.outcome = validated.outcome;
      else state.failure = validated.message;
    } else if (event.event === "error") {
      state.failure = parseErrorDetail(event.data);
    }
    // Unknown event types are ignored.
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (state.outcome !== null || state.failure !== null) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  parser.end();

  if (state.failure !== null) throw new MatchError(state.failure);
  if (state.outcome === null) {
    throw new MatchError("The analysis service closed the stream before sending a result.");
  }
  return state.outcome;
}
