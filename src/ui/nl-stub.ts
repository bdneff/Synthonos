/**
 * Layer 1 handler stub. The real natural language mapping lands in Phase 2
 * (feature/nl-control); the signature below is the contract it will fill:
 * it receives the user's text plus the current patch (so relative requests
 * like "darker" work), and resolves to a partial patch edit, a plain
 * language explanation, and an optional suggested preset name.
 */

import type { ParamId, ParamValue, PatchEdit } from "../generated/params";

export interface NlResult {
  /** One or two sentences in the user's words, e.g. "Lowered the cutoff". */
  explanation: string;
  /** Only the changed parameters. Validated before it touches the patch. */
  params: PatchEdit;
  /** A name for the sound, offered when the user saves. */
  suggestedName?: string;
}

export type NlHandler = (
  text: string,
  currentParams: Readonly<Record<ParamId, ParamValue>>,
) => Promise<NlResult>;

/**
 * Phase 1 canned response. The short delay makes the request feel real so
 * the busy state in the describe bar gets exercised.
 */
export const describeSound: NlHandler = async (_text, _currentParams) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 400);
  });
  return {
    explanation:
      "Describing a sound in words arrives in Phase 2. Until then, the eight big knobs shape the sound, and everything under Advanced explains itself when you hover.",
    params: {},
  };
};
