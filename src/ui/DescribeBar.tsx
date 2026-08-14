/**
 * Layer 1: the text box. Always visible at the top of the window. Submits
 * to the natural language handler (a canned stub until Phase 2), renders
 * the explanation gracefully, and applies any returned parameter edit as
 * one undoable gesture so the knobs animate to their new positions.
 */

import { useCallback, useEffect, useState } from "react";
import { describeSound } from "../nl";
import { useSynth } from "./store";

export function DescribeBar() {
  const store = useSynth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  // While the machine shapes a sound, the rainbow band runs a light
  // chase: the signature is the machine's spine. The flag rides the
  // document root so the band (in the keys deck) can see it.
  useEffect(() => {
    if (busy) document.documentElement.setAttribute("data-shaping", "true");
    else document.documentElement.removeAttribute("data-shaping");
    return () => document.documentElement.removeAttribute("data-shaping");
  }, [busy]);

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
      <div className={`describe-slot${busy ? " busy" : ""}`}>
        {/* Words in, waveform out: the lane's own glyph. */}
        <svg className="describe-prompt" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M2 4 H9 M2 8 H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M8.5 12 C9.6 9 10.4 9 11.2 12 C12 15 12.8 15 13.9 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform="translate(0,-3.5)"
          />
        </svg>
        <input
          className="describe-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={'Describe a sound: "a warm wide pad", "more bite", "same but plucky"'}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <button
          type="button"
          className={`button primary shape-switch describe-submit${busy ? " lit" : ""}`}
          disabled={busy || text.trim() === ""}
          onClick={() => void submit()}
        >
          {/* The one red LED on the front door: on when armed, blinking
              while the machine thinks. */}
          <i className="switch-led" aria-hidden="true" />
          {busy ? "Shaping..." : "Shape"}
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
