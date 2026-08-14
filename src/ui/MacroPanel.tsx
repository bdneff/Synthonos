/**
 * Layer 2: the eight macro knobs. Dragging a macro nudges its whole
 * parameter bundle relative to the patch as it was when the gesture
 * started, and the advanced knobs animate along so the user can watch
 * what the macro really does.
 */

import { useRef } from "react";
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

export function MacroPanel() {
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

  const renderKnob = (def: MacroDef, size: "medium" | "large") => (
    <Knob
      key={def.id}
      size={size}
      label={def.name}
      tooltip={def.description}
      spec={MACRO_SPEC}
      value={store.macros[def.id]}
      format={(v) => `${Math.round(v * 100)} %`}
      onGestureStart={() => beginGesture(def)}
      onChange={(v) => moveMacro(def, v)}
      onGestureEnd={endGesture}
    />
  );

  // Presentation staging only: the four macros a beginner reaches for
  // first are mounted large, the shading macros one size down. Macro
  // behavior is defined in macros.ts and unchanged by this ordering.
  const primary = PRIMARY_IDS.map(
    (id) => MACROS.find((def) => def.id === id) as MacroDef,
  );
  const secondary = MACROS.filter((def) => !PRIMARY_IDS.includes(def.id));

  return (
    <section className="macro-zone" aria-label="Performance controls">
      <div className="silk-rule">
        <span className="silk-title">Performance</span>
        <i className="silk-line" aria-hidden="true" />
        <span className="silk-fine">MACRO CONTROL</span>
      </div>
      <div className="macro-row">
        <div className="macro-group macro-primary">
          {primary.map((def) => renderKnob(def, "large"))}
        </div>
        <i className="macro-divider" aria-hidden="true" />
        <div className="macro-group macro-secondary">
          {secondary.map((def) => renderKnob(def, "medium"))}
        </div>
      </div>
    </section>
  );
}

const PRIMARY_IDS: readonly MacroId[] = ["brightness", "space", "grit", "width"];
