/**
 * The natural language layer: prompt assembly carries all four required
 * context pieces, responses are validated by the generated validator with
 * one feedback retry, and out-of-bounds edits are rejected, never clamped.
 * The Anthropic API is mocked at the fetch boundary.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { SYSTEM_PROMPT, buildUserMessage, responseFormat } from "../src/nl/prompt";
import {
  createNlHandler,
  loadNlSettings,
  saveNlSettings,
  DEFAULT_MODEL,
} from "../src/nl/client";
import defaultPreset from "../src/generated/default-preset.json";
import type { ParamId, ParamValue } from "../src/generated/params";

const CURRENT = defaultPreset.params as Record<ParamId, ParamValue>;

function apiResponse(body: {
  explanation: string;
  params: Record<string, unknown>;
  suggested_name?: string;
}) {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: DEFAULT_MODEL,
      content: [{ type: "text", text: JSON.stringify(body) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prompt assembly", () => {
  it("system prompt embeds the sound vocabulary and the honesty rules", () => {
    expect(SYSTEM_PROMPT).toContain("SOUND VOCABULARY");
    expect(SYSTEM_PROMPT).toContain("supersaw");
    expect(SYSTEM_PROMPT).toContain("(future:");
    expect(SYSTEM_PROMPT).toContain("rejected");
  });

  it("user message carries the current patch and the request", () => {
    const msg = buildUserMessage("make it darker", CURRENT);
    expect(msg).toContain("make it darker");
    expect(msg).toContain("filter_cutoff");
    expect(msg).toContain("12000");
  });

  it("response format is the generated schema with ranges in descriptions", () => {
    const format = responseFormat();
    expect(format.type).toBe("json_schema");
    const schema = format.schema as {
      properties: {
        params: { properties: Record<string, { description?: string; minimum?: number }> };
      };
    };
    const cutoff = schema.properties.params.properties.filter_cutoff;
    expect(cutoff.description).toContain("20 to 20000");
    // Structured outputs reject numeric bounds; they must not be present.
    expect(cutoff.minimum).toBeUndefined();
  });
});

describe("NL handler", () => {
  const settings = { apiKey: "sk-ant-test" };

  it("applies a valid edit and passes through the explanation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      apiResponse({
        explanation: "Lowered the filter cutoff for a darker sound.",
        params: { filter_cutoff: 900 },
        suggested_name: "Dusk Pad",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createNlHandler(settings);
    const result = await handler("darker", CURRENT);

    expect(result.params).toEqual({ filter_cutoff: 900 });
    expect(result.explanation).toContain("Lowered the filter cutoff");
    expect(result.suggestedName).toBe("Dusk Pad");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.model).toBe(DEFAULT_MODEL);
    expect(requestBody.system[0].text).toContain("SOUND VOCABULARY");
    expect(requestBody.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(requestBody.output_config.format.type).toBe("json_schema");
  });

  it("retries once with validator feedback, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse({ explanation: "x", params: { filter_cutoff: 99999 } }),
      )
      .mockResolvedValueOnce(
        apiResponse({ explanation: "Opened the filter fully.", params: { filter_cutoff: 20000 } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createNlHandler(settings);
    const result = await handler("as bright as possible", CURRENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const retryMessages = retryBody.messages as { content: string }[];
    expect(retryMessages[retryMessages.length - 1].content).toContain("filter_cutoff");
    expect(result.params).toEqual({ filter_cutoff: 20000 });
  });

  it("rejects twice-invalid edits without touching the patch", async () => {
    const bad = apiResponse({ explanation: "x", params: { mystery_knob: 1 } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(bad.clone())
      .mockResolvedValueOnce(bad.clone());
    vi.stubGlobal("fetch", fetchMock);

    const handler = createNlHandler(settings);
    const result = await handler("do something weird", CURRENT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.params).toEqual({});
    expect(result.explanation).toContain("nothing was changed");
  });

  it("surfaces API failures as thrown errors for the UI to catch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "authentication_error", message: "invalid x-api-key" },
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const handler = createNlHandler(settings);
    await expect(handler("darker", CURRENT)).rejects.toThrow();
  });
});

describe("settings storage", () => {
  function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    };
  }

  it("round-trips the key, omits default model, and clears on empty key", () => {
    const storage = memoryStorage();
    saveNlSettings({ apiKey: " sk-ant-abc ", model: DEFAULT_MODEL }, storage);
    expect(loadNlSettings(storage)).toEqual({ apiKey: "sk-ant-abc", model: undefined });

    saveNlSettings({ apiKey: "sk-ant-abc", model: "claude-sonnet-5" }, storage);
    expect(loadNlSettings(storage)?.model).toBe("claude-sonnet-5");

    saveNlSettings({ apiKey: "" }, storage);
    expect(loadNlSettings(storage)).toBeNull();
  });
});
