/**
 * The natural language patch editor: Claude behind the describe bar.
 *
 * Flow per request: system prompt (rules + vocabulary, cached) + current
 * patch + user text -> structured JSON constrained by the generated schema
 * -> parsed -> validated by the generated validator (reject, never clamp).
 * One retry with the validator's feedback if the first response is out of
 * bounds. The store applies the surviving edit as a single undoable
 * gesture, which is what makes the knobs animate.
 *
 * Key handling: bring-your-own Anthropic API key, stored locally, sent
 * directly from this machine to the Anthropic API. Nothing else sees it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { validatePatchParams } from "../generated/params";
import type { PatchEdit } from "../generated/params";
import type { NlHandler, NlResult } from "../ui/nl-stub";
import { SYSTEM_PROMPT, buildUserMessage, responseFormat } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 2000;

export interface NlSettings {
  apiKey: string;
  model?: string;
}

const API_KEY_STORAGE = "synthonos.anthropic_api_key";
const MODEL_STORAGE = "synthonos.nl_model";

export function loadNlSettings(storage: Pick<Storage, "getItem"> = localStorage): NlSettings | null {
  const apiKey = storage.getItem(API_KEY_STORAGE);
  if (!apiKey) return null;
  return { apiKey, model: storage.getItem(MODEL_STORAGE) ?? undefined };
}

export function saveNlSettings(
  settings: { apiKey: string; model?: string },
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
): void {
  if (settings.apiKey.trim() === "") {
    storage.removeItem(API_KEY_STORAGE);
  } else {
    storage.setItem(API_KEY_STORAGE, settings.apiKey.trim());
  }
  if (settings.model && settings.model.trim() !== "" && settings.model !== DEFAULT_MODEL) {
    storage.setItem(MODEL_STORAGE, settings.model.trim());
  } else {
    storage.removeItem(MODEL_STORAGE);
  }
}

interface ParsedResponse {
  explanation: string;
  suggested_name?: string;
  params: Record<string, unknown>;
}

function extractJson(content: Anthropic.ContentBlock[]): ParsedResponse {
  const textBlock = content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock) throw new Error("empty model response");
  const parsed = JSON.parse(textBlock.text) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as ParsedResponse).explanation !== "string" ||
    typeof (parsed as ParsedResponse).params !== "object"
  ) {
    throw new Error("model response missing explanation or params");
  }
  return parsed as ParsedResponse;
}

/**
 * One round trip to the model. Exported for tests; use createNlHandler for
 * the UI-facing handler with validation retry.
 */
export async function requestPatchEdit(
  client: Anthropic,
  model: string,
  userMessage: string,
  validationFeedback?: string,
): Promise<ParsedResponse> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];
  if (validationFeedback) {
    messages.push({
      role: "user",
      content:
        `Your previous edit was rejected by validation and nothing was applied: ${validationFeedback}. ` +
        `Send a corrected edit that stays inside every parameter's allowed range.`,
    });
  }
  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    output_config: {
      effort: "low",
      format: responseFormat(),
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined that request.");
  }
  return extractJson(response.content);
}

/**
 * Build the NlHandler the describe bar consumes. Matches the stub's
 * contract exactly, so the UI does not change shape.
 */
export function createNlHandler(settings: NlSettings): NlHandler {
  const client = new Anthropic({
    apiKey: settings.apiKey,
    // BYO-key desktop app: the key lives on this machine and requests go
    // straight from the local webview to the Anthropic API.
    dangerouslyAllowBrowser: true,
  });
  const model = settings.model ?? DEFAULT_MODEL;

  return async (text, currentParams): Promise<NlResult> => {
    const userMessage = buildUserMessage(text, currentParams);

    let parsed = await requestPatchEdit(client, model, userMessage);
    let issues = validatePatchParams(parsed.params, "partial");
    if (issues.length > 0) {
      const feedback = issues
        .map((issue) => `${issue.param}: ${issue.message}`)
        .join("; ");
      parsed = await requestPatchEdit(client, model, userMessage, feedback);
      issues = validatePatchParams(parsed.params, "partial");
      if (issues.length > 0) {
        // Reject, never clamp: the patch stays untouched.
        return {
          explanation:
            "That request kept producing out of range settings, so nothing was changed. Try describing it a little differently.",
          params: {},
        };
      }
    }

    const result: NlResult = {
      explanation: parsed.explanation,
      params: parsed.params as PatchEdit,
    };
    if (parsed.suggested_name) result.suggestedName = parsed.suggested_name;
    return result;
  };
}
