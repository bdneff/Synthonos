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

  return (
    <section className="macro-panel panel">
      <div className="panel-title">
        Shape the sound
        <span className="panel-subtitle">Eight knobs, plain words. Watch the advanced panel move with them.</span>
      </div>
      <div className="macro-row">
        {MACROS.map((def) => (
          <Knob
            key={def.id}
            size="large"
            label={def.name}
            tooltip={def.description}
            spec={MACRO_SPEC}
            value={store.macros[def.id]}
            format={(v) => `${Math.round(v * 100)}%`}
            onGestureStart={() => beginGesture(def)}
            onChange={(v) => moveMacro(def, v)}
            onGestureEnd={endGesture}
          />
        ))}
      </div>
    </section>
  );
}
