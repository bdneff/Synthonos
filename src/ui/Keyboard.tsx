/**
 * On-screen piano plus computer keyboard input.
 *
 * Mouse: click a key, or hold and slide across keys. Computer keyboard:
 * the middle letter row plays chromatically from C (a w s e d f t g y h
 * u j k o l p ;), z and x shift the octave. Held keys never retrigger on
 * key repeat. The letter for each mapped key is printed subtly on the
 * piano so the mapping teaches itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSynth } from "./store";
import {
  KEY_ROW,
  OCTAVE_DEFAULT,
  OCTAVE_MAX,
  OCTAVE_MIN,
  clampOctave,
  isBlackKey,
  midiForKey,
  midiToName,
  octaveBaseMidi,
} from "./keyboard-map";

const VISIBLE_KEYS = 25; // two octaves plus the top C

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Keyboard() {
  const { noteOn, noteOff, activeNotes } = useSynth();
  const [baseOctave, setBaseOctave] = useState(OCTAVE_DEFAULT);

  // Computer-keyboard notes held right now: physical key -> midi note at
  // the octave that was active when it was pressed, so an octave shift
  // mid-hold still releases the right note.
  const heldKeysRef = useRef<Map<string, number>>(new Map());
  // The note currently held by the mouse, if any.
  const mouseNoteRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntryTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        setBaseOctave((o) => clampOctave(o - 1));
        return;
      }
      if (key === "x") {
        setBaseOctave((o) => clampOctave(o + 1));
        return;
      }
      if (heldKeysRef.current.has(key)) return;
      const midi = midiForKey(key, baseOctave);
      if (midi === null) return;
      heldKeysRef.current.set(key, midi);
      noteOn(midi);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = heldKeysRef.current.get(key);
      if (midi === undefined) return;
      heldKeysRef.current.delete(key);
      noteOff(midi);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [baseOctave, noteOn, noteOff]);

  // Release the mouse note wherever the pointer goes up.
  useEffect(() => {
    const handleUp = () => {
      const midi = mouseNoteRef.current;
      if (midi !== null) {
        mouseNoteRef.current = null;
        noteOff(midi);
      }
    };
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [noteOff]);

  const pressWithMouse = useCallback(
    (midi: number) => {
      const previous = mouseNoteRef.current;
      if (previous === midi) return;
      if (previous !== null) noteOff(previous);
      mouseNoteRef.current = midi;
      noteOn(midi);
    },
    [noteOn, noteOff],
  );

  const start = octaveBaseMidi(baseOctave);
  const notes: number[] = [];
  for (let i = 0; i < VISIBLE_KEYS; i += 1) notes.push(start + i);
  const whiteNotes = notes.filter((n) => !isBlackKey(n));
  const whiteCount = whiteNotes.length;
  const whiteWidthPct = 100 / whiteCount;
  const blackWidthPct = whiteWidthPct * 0.62;

  const letterFor = (midi: number): string | null => {
    const semi = midi - start;
    return semi >= 0 && semi < KEY_ROW.length ? KEY_ROW[semi] : null;
  };

  return (
    <div className="keyboard-strip">
      <div className="deck-frame">
      <div className="keyboard-side">
        <span className="deck-label">Keys</span>
        <div className="octave-controls">
          <button
            type="button"
            className="octave-button"
            onClick={() => setBaseOctave((o) => clampOctave(o - 1))}
            disabled={baseOctave <= OCTAVE_MIN}
            title="Octave down (Z)"
          >
            Z
          </button>
          <div className="octave-readout">
            <span className="octave-label">Octave</span>
            <span className="octave-value">{midiToName(start)}</span>
          </div>
          <button
            type="button"
            className="octave-button"
            onClick={() => setBaseOctave((o) => clampOctave(o + 1))}
            disabled={baseOctave >= OCTAVE_MAX}
            title="Octave up (X)"
          >
            X
          </button>
        </div>
        <div className="keyboard-hint">Play with your computer keyboard. Z and X change octave.</div>
      </div>
      <div className="piano-bed">
      <div className="piano" role="group" aria-label="On-screen piano">
        {whiteNotes.map((midi) => {
          const letter = letterFor(midi);
          return (
            <div
              key={midi}
              className={`piano-key white${activeNotes.has(midi) ? " active" : ""}`}
              style={{ width: `${whiteWidthPct}%` }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                pressWithMouse(midi);
              }}
              onPointerEnter={(e) => {
                if ((e.buttons & 1) === 1) pressWithMouse(midi);
              }}
            >
              {midi % 12 === 0 ? <span className="piano-c-label">{midiToName(midi)}</span> : null}
              {letter !== null ? <span className="piano-letter">{letter}</span> : null}
            </div>
          );
        })}
        {notes.filter(isBlackKey).map((midi) => {
          const whitesBefore = whiteNotes.filter((w) => w < midi).length;
          const left = whitesBefore * whiteWidthPct - blackWidthPct / 2;
          const letter = letterFor(midi);
          return (
            <div
              key={midi}
              className={`piano-key black${activeNotes.has(midi) ? " active" : ""}`}
              style={{ left: `${left}%`, width: `${blackWidthPct}%` }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                pressWithMouse(midi);
              }}
              onPointerEnter={(e) => {
                if ((e.buttons & 1) === 1) pressWithMouse(midi);
              }}
            >
              {letter !== null ? <span className="piano-letter">{letter}</span> : null}
            </div>
          );
        })}
      </div>
      </div>
      </div>
    </div>
  );
}
