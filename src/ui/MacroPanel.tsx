/**
 * Layer 2: the eight macro knobs, mounted as two mirrored 2x2 banks
 * flanking the center console (Bank A left, Bank B right), the way the
 * flagship split its panel around the display cluster.
 *
 * Dragging a macro nudges its whole parameter bundle relative to the
 * patch as it was when the gesture started, and the advanced knobs
 * animate along so the user can watch what the macro really does.
 */

import { useRef } from "react";
import type { CSSProperties } from "react";
import { MACROS, MACRO_DEFAULT, computeMacroEdit } from "./macros";
import type { MacroDef, MacroId } from "./macros";
import { Knob } from "./Knob";
import type { KnobSpec } from "./Knob";
import { useSynth } from "./store";
import type { PatchParams } from "./store";

const MACRO_SPEC: KnobSpec = {
  min: 0,
  max: 1,
  default: MACRO_DEFAULT,
  curve: "linear",
  integer: false,
};

interface MacroGesture {
  id: MacroId;
  baseParams: PatchParams;
  from: number;
}

/** Bank A holds the four macros a beginner reaches for first. */
const BANK_IDS: Record<"a" | "b", readonly MacroId[]> = {
  a: ["brightness", "space", "grit", "width"],
  b: ["thickness", "movement", "attack", "character"],
};

export function MacroBank({ bank }: { bank: "a" | "b" }) {
  const store = useSynth();
  const gestureRef = useRef<MacroGesture | null>(null);

  const beginGesture = (def: MacroDef) => {
    gestureRef.current = {
      id: def.id,
      baseParams: store.params,
      from: store.macros[def.id],
    };
  };

  const moveMacro = (def: MacroDef, value: number) => {
    let gesture = gestureRef.current;
    if (gesture === null || gesture.id !== def.id) {
      // Double-click reset arrives without a drag; treat the current
      // state as the gesture base.
      gesture = { id: def.id, baseParams: store.params, from: store.macros[def.id] };
      gestureRef.current = gesture;
    }
    const edit = computeMacroEdit(def, gesture.baseParams, gesture.from, value);
    store.setMacroLive(def.id, value, { ...gesture.baseParams, ...edit });
  };

  const endGesture = () => {
    gestureRef.current = null;
    store.commitGesture();
  };

  const defs = BANK_IDS[bank].map(
    (id) => MACROS.find((def) => def.id === id) as MacroDef,
  );

  return (
    <section
      className={`macro-block bank-${bank}`}
      aria-label={`Performance controls, bank ${bank.toUpperCase()}`}
    >
      <div className="silk-rule">
        <span className="silk-title">Performance</span>
        <span className="silk-fine">Bank {bank.toUpperCase()}</span>
      </div>
      <div className="macro-grid">
        {defs.map((def) => (
          <div
            key={def.id}
            className="macro-station"
            style={{ "--knob-hue": MACRO_HUES[def.id] } as CSSProperties}
          >
            <Knob
              size="large"
              label={def.name}
              tooltip={def.description}
              spec={MACRO_SPEC}
              value={store.macros[def.id]}
              format={(v) => `${Math.round(v * 100)} %`}
              onGestureStart={() => beginGesture(def)}
              onChange={(v) => moveMacro(def, v)}
              onGestureEnd={endGesture}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Law 3 of the visual world: every macro owns one of the eight inks. */
const MACRO_HUES: Record<MacroId, string> = {
  brightness: "var(--m-brightness)",
  thickness: "var(--m-thickness)",
  movement: "var(--m-movement)",
  attack: "var(--m-attack)",
  space: "var(--m-space)",
  grit: "var(--m-grit)",
  width: "var(--m-width)",
  character: "var(--m-character)",
};
