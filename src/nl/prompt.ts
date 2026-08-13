/**
 * Prompt assembly for the natural language control feature. Per the build
 * plan (section 5), every request carries four things: the parameter schema
 * (via structured output), the sound vocabulary, the current patch state,
 * and the user's text. The model never emits free text: its response is
 * forced through the generated JSON schema and then through the generated
 * validator, where anything out of bounds is rejected, not clamped.
 *
 * Caching note: the system prompt (rules + vocabulary) is stable across
 * requests and carries a cache_control breakpoint; the volatile parts
 * (current patch, user text) live in the user message after it.
 */

import vocabulary from "../../docs/SOUND_VOCABULARY.md?raw";
import llmSchema from "../generated/llm-schema.json";
import type { ParamId, ParamValue } from "../generated/params";

export const SYSTEM_PROMPT: string = [
  "You are the sound design brain inside Synthonos, a virtual analog synthesizer for people who have never opened a DAW.",
  "The user describes a sound or a change in plain words. You translate that into a partial patch edit: only the parameters that should change.",
  "",
  "Rules:",
  "- Edits are relative to the current patch, which is provided with every request. \"Darker\" means darker than it is now.",
  "- Change as few parameters as achieve the request. A one-word request usually moves one to four parameters.",
  "- Stay inside each parameter's allowed range, stated in its description. Out of range values are rejected outright, and the user sees nothing happen.",
  "- The explanation field is one or two sentences in a musician's words, naming what changed and why it serves the request. Say \"lowered the filter cutoff\", never \"set filter_cutoff to 800\". No em dashes.",
  "- Parameters marked (future: ...) in the vocabulary below do not exist yet. Never invent parameter names; use only what the schema offers, and if the request needs a missing capability, do the best available approximation and say so honestly in the explanation.",
  "- suggested_name: a short evocative name for the resulting sound, offered when the request meaningfully reshapes the patch; omit it for small tweaks.",
  "",
  "The vocabulary reference below maps producer slang to parameter moves. Prefer its guidance when the user's words appear in it.",
  "",
  "--- SOUND VOCABULARY ---",
  vocabulary,
].join("\n");

/** The volatile half of the request: current patch state plus the ask. */
export function buildUserMessage(
  text: string,
  currentParams: Readonly<Record<ParamId, ParamValue>>,
): string {
  return [
    "Current patch (enums as option names):",
    JSON.stringify(currentParams),
    "",
    "Request:",
    text,
  ].join("\n");
}

/**
 * The generated response schema, passed to structured outputs. Numeric
 * bounds live in the descriptions (backends reject minimum/maximum);
 * the generated validator enforces them after parsing.
 */
export function responseFormat(): { type: "json_schema"; schema: Record<string, unknown> } {
  // Strip the $comment/$schema headers; backends only want the schema body.
  const { $comment, $schema, ...schema } = llmSchema as Record<string, unknown>;
  void $comment;
  void $schema;
  return { type: "json_schema", schema };
}
