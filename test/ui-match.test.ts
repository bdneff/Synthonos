/**
 * Pure-logic tests for the audio match client (src/ui/match.ts): the SSE
 * parser, the streaming match call against a mocked fetch, result
 * validation, and the service URL override. No DOM.
 */

import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MATCH_URL,
  MATCH_URL_STORAGE_KEY,
  MatchError,
  SseParser,
  checkHealth,
  matchServiceUrl,
  matchStream,
  parseProgress,
  validateMatchResult,
} from "../src/ui/match";
import type { SseEvent, StorageLike } from "../src/ui/match";
import defaultPreset from "../src/generated/default-preset.json";

const VALID_PARAMS = defaultPreset.params as Record<string, unknown>;

/* ---------- helpers ---------- */

function collectEvents(chunks: string[]): SseEvent[] {
  const events: SseEvent[] = [];
  const parser = new SseParser((e) => events.push(e));
  for (const chunk of chunks) parser.push(chunk);
  parser.end();
  return events;
}

function progressEvent(generation: number, bestLoss: number): string {
  const payload = {
    generation,
    best_loss: bestLoss,
    median_loss: bestLoss * 2,
    renders: 64,
    elapsed_sec: generation + 0.5,
  };
  return `event: progress\ndata: ${JSON.stringify(payload)}\n\n`;
}

function resultEvent(params: unknown): string {
  const payload = {
    params,
    loss: 0.12,
    initial_median_loss: 1.4,
    history: [],
    n_renders: 512,
    wall_seconds: 33.1,
  };
  return `event: result\ndata: ${JSON.stringify(payload)}\n\n`;
}

/** A fetch mock that streams the given SSE text in fixed-size chunks. */
function sseFetch(body: string, chunkSize = 7): typeof fetch {
  return (async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < body.length; i += chunkSize) {
          controller.enqueue(encoder.encode(body.slice(i, i + chunkSize)));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
}

function memoryStorage(entries: Record<string, string>): StorageLike {
  return {
    getItem: (key) => (key in entries ? entries[key] : null),
  };
}

/* ---------- SSE parser ---------- */

describe("SseParser", () => {
  it("accumulates progress events split across arbitrary chunks", () => {
    const text =
      progressEvent(0, 1.5) + progressEvent(1, 1.1) + progressEvent(2, 0.9);
    for (const chunkSize of [1, 3, 1000]) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      const events = collectEvents(chunks);
      expect(events).toHaveLength(3);
      expect(events.every((e) => e.event === "progress")).toBe(true);
      const generations = events.map(
        (e) => (JSON.parse(e.data) as { generation: number }).generation,
      );
      expect(generations).toEqual([0, 1, 2]);
    }
  });

  it("skips malformed and comment lines without derailing the stream", () => {
    const events = collectEvents([
      "garbage line with no field separator\n",
      ": a comment\n",
      "event: progress\n",
      "another stray line\n",
      'data: {"generation": 0, "best_loss": 1.0}\n',
      "\n",
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("progress");
    expect(JSON.parse(events[0].data)).toMatchObject({ generation: 0 });
  });

  it("joins multi-line data, handles CRLF, defaults to message type", () => {
    const events = collectEvents([
      "data: first\r\ndata: second\r\n\r\n",
      "event: result\ndata: {}\n\n",
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: "message", data: "first\nsecond" });
    expect(events[1]).toEqual({ event: "result", data: "{}" });
  });

  it("dispatches a final unterminated block on end()", () => {
    const events = collectEvents(["event: error\ndata: {\"detail\": \"x\"}"]);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("error");
  });

  it("emits nothing for a block with no data lines", () => {
    const events = collectEvents(["event: progress\n\n"]);
    expect(events).toHaveLength(0);
  });
});

/* ---------- payload parsing and validation ---------- */

describe("parseProgress", () => {
  it("reads the service's per-generation entry", () => {
    const p = parseProgress(
      '{"generation": 3.0, "best_loss": 0.42, "median_loss": 0.8, "renders": 128.0, "elapsed_sec": 9.7}',
    );
    expect(p).toEqual({
      generation: 3,
      bestLoss: 0.42,
      medianLoss: 0.8,
      renders: 128,
      elapsedSec: 9.7,
    });
  });

  it("returns null for malformed payloads", () => {
    expect(parseProgress("not json")).toBeNull();
    expect(parseProgress("[1,2]")).toBeNull();
    expect(parseProgress('{"best_loss": 1}')).toBeNull();
    expect(parseProgress('{"generation": 1, "best_loss": "hot"}')).toBeNull();
  });
});

describe("validateMatchResult", () => {
  it("accepts a result whose params pass full validation", () => {
    const v = validateMatchResult(
      JSON.stringify({ params: VALID_PARAMS, loss: 0.2, n_renders: 10, wall_seconds: 5 }),
    );
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.outcome.params).toEqual(VALID_PARAMS);
      expect(v.outcome.loss).toBe(0.2);
    }
  });

  it("rejects out-of-range and incomplete params", () => {
    const broken = { ...VALID_PARAMS, master_volume: 99999 };
    const v = validateMatchResult(JSON.stringify({ params: broken, loss: 0.2 }));
    expect(v.ok).toBe(false);

    const partial = validateMatchResult(
      JSON.stringify({ params: { master_volume: 0.5 }, loss: 0.2 }),
    );
    expect(partial.ok).toBe(false);

    const missing = validateMatchResult(JSON.stringify({ loss: 0.2 }));
    expect(missing.ok).toBe(false);

    const garbage = validateMatchResult("not json at all");
    expect(garbage.ok).toBe(false);
  });
});

/* ---------- matchStream against a mocked fetch ---------- */

describe("matchStream", () => {
  const file = new Blob(["RIFFfake"], { type: "audio/wav" });

  it("forwards progress in order and resolves with the validated result", async () => {
    const body =
      progressEvent(0, 2.0) +
      progressEvent(1, 1.2) +
      progressEvent(2, 0.7) +
      resultEvent(VALID_PARAMS);
    const seen: number[] = [];
    const outcome = await matchStream({
      file,
      filename: "pad.wav",
      note: 48,
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl: sseFetch(body),
      onProgress: (p) => seen.push(p.bestLoss),
    });
    expect(seen).toEqual([2.0, 1.2, 0.7]);
    expect(outcome.params).toEqual(VALID_PARAMS);
    expect(outcome.loss).toBe(0.12);
    expect(outcome.nRenders).toBe(512);
  });

  it("posts multipart form fields the service expects", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: unknown, init: unknown) => {
      captured = { url: String(url), init: init as RequestInit };
      return new Response(resultEvent(VALID_PARAMS), { status: 200 });
    }) as unknown as typeof fetch;
    await matchStream({
      file,
      filename: "bass.wav",
      note: 36,
      baseUrl: "http://localhost:9999",
      fetchImpl,
    });
    expect(captured).not.toBeNull();
    const { url, init } = captured!;
    expect(url).toBe("http://localhost:9999/match/stream");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("note")).toBe("36");
    const sent = form.get("file");
    expect(sent).toBeInstanceOf(Blob);
    expect((sent as File).name).toBe("bass.wav");
  });

  it("terminates on the result event and ignores anything after it", async () => {
    const body =
      progressEvent(0, 1.0) +
      resultEvent(VALID_PARAMS) +
      progressEvent(1, 0.5); // must never reach onProgress
    const seen: number[] = [];
    const outcome = await matchStream({
      file,
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl: sseFetch(body, 100000), // one chunk: all events arrive together
      onProgress: (p) => seen.push(p.bestLoss),
    });
    expect(outcome.loss).toBe(0.12);
    expect(seen).toEqual([1.0]);
  });

  it("rejects when the final params fail validation, applying nothing", async () => {
    const broken = { ...VALID_PARAMS, filter_cutoff: -1 };
    const seen: number[] = [];
    await expect(
      matchStream({
        file,
        baseUrl: "http://127.0.0.1:8000",
        fetchImpl: sseFetch(progressEvent(0, 1.0) + resultEvent(broken)),
        onProgress: (p) => seen.push(p.bestLoss),
      }),
    ).rejects.toBeInstanceOf(MatchError);
    // Progress still streamed before the bad result; the rejection is the
    // only signal, no params object ever escapes matchStream.
    expect(seen).toEqual([1.0]);
  });

  it("rejects with the service's detail on an error event", async () => {
    const body = 'event: error\ndata: {"detail": "could not decode WAV: bad header"}\n\n';
    await expect(
      matchStream({ file, baseUrl: "http://x", fetchImpl: sseFetch(body) }),
    ).rejects.toThrow("could not decode WAV: bad header");
  });

  it("rejects when the stream closes without a result", async () => {
    await expect(
      matchStream({
        file,
        baseUrl: "http://x",
        fetchImpl: sseFetch(progressEvent(0, 1.0)),
      }),
    ).rejects.toThrow(/closed the stream/);
  });

  it("rejects with the HTTP detail on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ detail: "budget out of range" }), {
        status: 400,
      })) as unknown as typeof fetch;
    await expect(
      matchStream({ file, baseUrl: "http://x", fetchImpl }),
    ).rejects.toThrow("budget out of range");
  });
});

/* ---------- URL override and health ---------- */

describe("matchServiceUrl", () => {
  it("defaults to the local service when storage is empty", () => {
    expect(matchServiceUrl(null)).toBe(DEFAULT_MATCH_URL);
    expect(matchServiceUrl(memoryStorage({}))).toBe(DEFAULT_MATCH_URL);
  });

  it("honors the storage override and trims trailing slashes", () => {
    const storage = memoryStorage({
      [MATCH_URL_STORAGE_KEY]: "http://127.0.0.1:8765/",
    });
    expect(matchServiceUrl(storage)).toBe("http://127.0.0.1:8765");
  });

  it("falls back to the default when the override is blank", () => {
    const storage = memoryStorage({ [MATCH_URL_STORAGE_KEY]: "   " });
    expect(matchServiceUrl(storage)).toBe(DEFAULT_MATCH_URL);
  });
});

describe("checkHealth", () => {
  it("is true for an ok response, false for errors and network failures", async () => {
    const ok = (async () => new Response("{\"status\":\"ok\"}", { status: 200 })) as unknown as typeof fetch;
    const bad = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(checkHealth("http://x", ok)).resolves.toBe(true);
    await expect(checkHealth("http://x", bad)).resolves.toBe(false);
    await expect(checkHealth("http://x", down)).resolves.toBe(false);
  });

  it("requests the /health path on the given base", async () => {
    const fetchImpl = vi.fn(
      async (_url: unknown) => new Response("{}", { status: 200 }),
    );
    await checkHealth("http://127.0.0.1:8000", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("http://127.0.0.1:8000/health");
  });
});
