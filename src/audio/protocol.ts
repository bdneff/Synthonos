/**
 * Message protocol between the UI thread and the AudioWorklet processor.
 * Kept as pure data + a dispatcher so the protocol is unit-testable in Node
 * without AudioWorklet globals; the processor is a thin shell around this.
 */

export type ToWorkletMessage =
  | { t: "param"; id: string; v: number }
  | { t: "on"; n: number; v: number }
  | { t: "off"; n: number };

/** Frame of time-domain samples the processor posts back for the scopes. */
export interface ScopeFrame {
  t: "scope";
  samples: Float32Array;
}

/** The subset of the engine the protocol drives (matches SynthEngine). */
export interface EngineLike {
  setParam(id: string, value: number): void;
  noteOn(midiNote: number, velocity: number): void;
  noteOff(midiNote: number): void;
}

export function dispatchToEngine(engine: EngineLike, msg: ToWorkletMessage): void {
  switch (msg.t) {
    case "param":
      engine.setParam(msg.id, msg.v);
      break;
    case "on":
      engine.noteOn(msg.n, msg.v);
      break;
    case "off":
      engine.noteOff(msg.n);
      break;
  }
}
