/**
 * The seam between the interface and the audio engine.
 *
 * The UI never talks to the engine directly. It talks to an EngineBridge,
 * and in Phase 1 that bridge is a stub: it remembers parameter values,
 * tracks held notes, and hands back silent scope buffers. The real
 * AudioWorklet bridge replaces StubEngineBridge at integration time
 * without any other UI file changing.
 *
 * Values crossing this boundary are ENGINE units: floats and ints as-is,
 * enums already converted to their option index via the generated
 * toEngineValue(). The store does that conversion; nothing else should.
 */

import type { ParamId } from "../generated/params";

export interface EngineBridge {
  /** Set a parameter in engine units (enums as option index). */
  setParam(id: ParamId, engineValue: number): void;
  /** Start a note. midiNote 0..127, velocity 0..1. */
  noteOn(midiNote: number, velocity: number): void;
  /** Release a note. */
  noteOff(midiNote: number): void;
  /** Latest time-domain frame for the oscilloscope, samples in -1..1. */
  getScopeData(): Float32Array;
  /** Latest magnitude spectrum for the analyzer, bins in 0..1. */
  getSpectrumData(): Float32Array;
}

/**
 * Phase 1 stand-in. Echoes parameters (getParam returns what you set),
 * tracks held notes, and returns silent buffers so the scopes render a
 * calm idle state.
 */
export class StubEngineBridge implements EngineBridge {
  private readonly params = new Map<ParamId, number>();
  private readonly held = new Set<number>();
  private readonly scope = new Float32Array(512);
  private readonly spectrum = new Float32Array(256);

  setParam(id: ParamId, engineValue: number): void {
    this.params.set(id, engineValue);
  }

  /** Echo back the last value set, for tests and debugging. */
  getParam(id: ParamId): number | undefined {
    return this.params.get(id);
  }

  noteOn(midiNote: number, velocity: number): void {
    if (midiNote < 0 || midiNote > 127 || velocity <= 0) return;
    this.held.add(midiNote);
  }

  noteOff(midiNote: number): void {
    this.held.delete(midiNote);
  }

  /** Notes currently held, for tests. */
  heldNotes(): readonly number[] {
    return [...this.held];
  }

  getScopeData(): Float32Array {
    return this.scope;
  }

  getSpectrumData(): Float32Array {
    return this.spectrum;
  }
}
