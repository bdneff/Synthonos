/**
 * Single source of truth for the current patch. React context, no
 * dependencies beyond React itself.
 *
 * State model:
 * - params: the full patch, enums as option-name strings. This is what
 *   presets serialize and what the validator understands.
 * - macros: the eight macro knob positions (pure UI state; they reset to
 *   center on preset load).
 * - Conversion to engine units happens exactly once, here, at the bridge
 *   boundary via the generated toEngineValue().
 *
 * Gestures: live moves call the *Live setters (no history); a completed
 * gesture calls commitGesture(), which pushes one undo entry. Programmatic
 * edits (preset load, natural language) apply and commit in one call.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import defaultPresetJson from "../generated/default-preset.json";
import {
  PARAM_IDS,
  toEngineValue,
  validatePatchParams,
} from "../generated/params";
import type {
  ParamId,
  ParamValue,
  PatchEdit,
  ValidationIssue,
} from "../generated/params";
import { MACROS, MACRO_DEFAULT } from "./macros";
import type { MacroId } from "./macros";
import { StubEngineBridge } from "./engine-bridge";
import type { EngineBridge } from "./engine-bridge";
import { UndoStack } from "./undo";

export type PatchParams = Record<ParamId, ParamValue>;
export type MacroValues = Record<MacroId, number>;

interface SynthSnapshot {
  readonly params: PatchParams;
  readonly macros: MacroValues;
  readonly presetName: string;
}

export const INIT_PRESET_NAME: string = defaultPresetJson.name;
export const INIT_PARAMS: PatchParams =
  defaultPresetJson.params as unknown as PatchParams;

function centeredMacros(): MacroValues {
  const macros = {} as MacroValues;
  for (const def of MACROS) macros[def.id] = MACRO_DEFAULT;
  return macros;
}

function initialSnapshot(): SynthSnapshot {
  return {
    params: { ...INIT_PARAMS },
    macros: centeredMacros(),
    presetName: INIT_PRESET_NAME,
  };
}

function snapshotsEqual(a: SynthSnapshot, b: SynthSnapshot): boolean {
  if (a.presetName !== b.presetName) return false;
  for (const id of PARAM_IDS) {
    if (a.params[id] !== b.params[id]) return false;
  }
  for (const def of MACROS) {
    if (a.macros[def.id] !== b.macros[def.id]) return false;
  }
  return true;
}

export interface SynthStore {
  readonly params: PatchParams;
  readonly macros: MacroValues;
  readonly presetName: string;
  readonly activeNotes: ReadonlySet<number>;
  readonly bridge: EngineBridge;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Live (uncommitted) single parameter move, e.g. during a knob drag. */
  setParamLive(id: ParamId, value: ParamValue): void;
  /** Live macro move: new macro position plus the full recomputed patch. */
  setMacroLive(id: MacroId, value: number, nextParams: PatchParams): void;
  /** Commit the current state as one undo entry. Call on gesture release. */
  commitGesture(): void;
  /**
   * Apply a validated partial edit as a single committed gesture (used by
   * enum selectors and the natural language layer). Returns validation
   * issues; on any issue nothing is applied.
   */
  applyEdit(edit: PatchEdit, presetName?: string): ValidationIssue[];
  /** Replace the whole patch (preset load). Macros recenter. */
  loadPreset(name: string, params: PatchParams): ValidationIssue[];
  undo(): void;
  redo(): void;
  noteOn(midiNote: number): void;
  noteOff(midiNote: number): void;
}

const SynthContext = createContext<SynthStore | null>(null);

export function SynthProvider({ children }: { children: ReactNode }) {
  // Start on the stub, then swap in the real AudioWorklet bridge once its
  // module loads (browser and Tauri only; Node test runs stay on the stub).
  // The dynamic import keeps worklet asset handling out of non-browser
  // bundles, and the param-push effect below replays the full patch into
  // whichever bridge is current.
  const [bridge, setBridge] = useState<EngineBridge>(
    () => new StubEngineBridge(),
  );
  useEffect(() => {
    if (
      typeof AudioContext === "undefined" ||
      typeof AudioWorkletNode === "undefined"
    ) {
      return;
    }
    let cancelled = false;
    void import("../audio/worklet-bridge").then(({ WorkletEngineBridge }) => {
      if (cancelled) return;
      pushedRef.current.clear();
      setBridge(new WorkletEngineBridge());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [state, setState] = useState<SynthSnapshot>(initialSnapshot);
  const [activeNotes, setActiveNotes] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [historyTick, setHistoryTick] = useState(0);

  const undoRef = useRef<UndoStack<SynthSnapshot> | null>(null);
  if (undoRef.current === null) {
    undoRef.current = new UndoStack<SynthSnapshot>(initialSnapshot());
  }
  const history = undoRef.current;

  // Render-time mirror so gesture commits read the freshest state.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Push parameter changes across the bridge, in engine units, diffing so
  // only real changes cross the boundary.
  const pushedRef = useRef<Map<ParamId, number>>(new Map());
  useEffect(() => {
    for (const id of PARAM_IDS) {
      const engineValue = toEngineValue(id, state.params[id]);
      if (pushedRef.current.get(id) !== engineValue) {
        pushedRef.current.set(id, engineValue);
        bridge.setParam(id, engineValue);
      }
    }
  }, [state.params, bridge]);

  const setParamLive = useCallback((id: ParamId, value: ParamValue) => {
    setState((prev) =>
      prev.params[id] === value
        ? prev
        : { ...prev, params: { ...prev.params, [id]: value } },
    );
  }, []);

  const setMacroLive = useCallback(
    (id: MacroId, value: number, nextParams: PatchParams) => {
      setState((prev) => ({
        ...prev,
        params: nextParams,
        macros: { ...prev.macros, [id]: value },
      }));
    },
    [],
  );

  const commitSnapshot = useCallback(
    (snapshot: SynthSnapshot) => {
      if (snapshotsEqual(history.current, snapshot)) return;
      history.push(snapshot);
      setHistoryTick((t) => t + 1);
    },
    [history],
  );

  const commitGesture = useCallback(() => {
    commitSnapshot(stateRef.current);
  }, [commitSnapshot]);

  const applyEdit = useCallback(
    (edit: PatchEdit, presetName?: string): ValidationIssue[] => {
      const issues = validatePatchParams(edit, "partial");
      if (issues.length > 0) return issues;
      const prev = stateRef.current;
      const next: SynthSnapshot = {
        ...prev,
        params: { ...prev.params, ...edit },
        presetName: presetName ?? prev.presetName,
      };
      setState(next);
      commitSnapshot(next);
      return [];
    },
    [commitSnapshot],
  );

  const loadPreset = useCallback(
    (name: string, params: PatchParams): ValidationIssue[] => {
      const issues = validatePatchParams(params, "full");
      if (issues.length > 0) return issues;
      const next: SynthSnapshot = {
        params: { ...params },
        macros: centeredMacros(),
        presetName: name,
      };
      setState(next);
      commitSnapshot(next);
      return [];
    },
    [commitSnapshot],
  );

  const undo = useCallback(() => {
    const snapshot = history.undo();
    if (snapshot === null) return;
    setState(snapshot);
    setHistoryTick((t) => t + 1);
  }, [history]);

  const redo = useCallback(() => {
    const snapshot = history.redo();
    if (snapshot === null) return;
    setState(snapshot);
    setHistoryTick((t) => t + 1);
  }, [history]);

  const noteOn = useCallback(
    (midiNote: number) => {
      bridge.noteOn(midiNote, 0.8);
      setActiveNotes((prev) => {
        if (prev.has(midiNote)) return prev;
        const next = new Set(prev);
        next.add(midiNote);
        return next;
      });
    },
    [bridge],
  );

  const noteOff = useCallback(
    (midiNote: number) => {
      bridge.noteOff(midiNote);
      setActiveNotes((prev) => {
        if (!prev.has(midiNote)) return prev;
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
    },
    [bridge],
  );

  // historyTick is what makes canUndo/canRedo re-render; the value itself
  // is read straight off the stack.
  void historyTick;
  const canUndo = history.canUndo();
  const canRedo = history.canRedo();

  const store = useMemo<SynthStore>(
    () => ({
      params: state.params,
      macros: state.macros,
      presetName: state.presetName,
      activeNotes,
      bridge,
      canUndo,
      canRedo,
      setParamLive,
      setMacroLive,
      commitGesture,
      applyEdit,
      loadPreset,
      undo,
      redo,
      noteOn,
      noteOff,
    }),
    [
      state,
      activeNotes,
      bridge,
      canUndo,
      canRedo,
      setParamLive,
      setMacroLive,
      commitGesture,
      applyEdit,
      loadPreset,
      undo,
      redo,
      noteOn,
      noteOff,
    ],
  );

  return <SynthContext.Provider value={store}>{children}</SynthContext.Provider>;
}

export function useSynth(): SynthStore {
  const store = useContext(SynthContext);
  if (store === null) {
    throw new Error("useSynth must be used inside a SynthProvider");
  }
  return store;
}
