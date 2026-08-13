/**
 * The live NL handler the describe bar uses. Resolves the user's settings
 * at call time, so saving an API key in Settings takes effect on the next
 * request with no reload.
 */

import { createNlHandler, loadNlSettings } from "./client";
import type { NlHandler } from "../ui/nl-stub";

export const describeSound: NlHandler = async (text, currentParams) => {
  const settings = loadNlSettings();
  if (settings === null) {
    return {
      explanation:
        "To describe sounds in words, add your Anthropic API key under Settings (top right). The key stays on this machine and talks only to the Anthropic API.",
      params: {},
    };
  }
  const handler = createNlHandler(settings);
  return handler(text, currentParams);
};
