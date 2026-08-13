/**
 * Layer 1: the text box. Always visible at the top of the window. Submits
 * to the natural language handler (a canned stub until Phase 2), renders
 * the explanation gracefully, and applies any returned parameter edit as
 * one undoable gesture so the knobs animate to their new positions.
 */

import { useCallback, useState } from "react";
import { describeSound } from "./nl-stub";
import { useSynth } from "./store";

export function DescribeBar() {
  const store = useSynth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed === "" || busy) return;
    setBusy(true);
    try {
      const result = await describeSound(trimmed, store.params);
      const hasChanges = Object.keys(result.params).length > 0;
      if (hasChanges) {
        const issues = store.applyEdit(result.params, result.suggestedName);
        if (issues.length > 0) {
          setResponse(
            `That request produced an out of range change (${issues[0].param}), so nothing was touched.`,
          );
          return;
        }
      }
      setResponse(result.explanation);
    } catch {
      setResponse("Something went wrong understanding that. Try again.");
    } finally {
      setBusy(false);
    }
  }, [text, busy, store]);

  return (
    <div className="describe-bar">
      <div className="describe-input-row">
        <input
          className="describe-input"
          type="text"
          placeholder="Describe a sound"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <button
          type="button"
          className="button primary describe-submit"
          disabled={busy || text.trim() === ""}
          onClick={() => void submit()}
        >
          {busy ? "Listening..." : "Shape it"}
        </button>
      </div>
      {response !== null ? (
        <div className="describe-response" role="status">
          <span>{response}</span>
          <button
            type="button"
            className="describe-dismiss"
            aria-label="Dismiss"
            onClick={() => setResponse(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
