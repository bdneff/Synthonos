/**
 * Synthonos engine, M0 state: accepts the full parameter surface and note
 * events, outputs exact silence. Real synthesis lands module by module in
 * Phase 1 (feature/dsp-engine), each module with its spectral tests.
 *
 * Hard rules for this directory (see CLAUDE.md):
 * - No imports of any kind. This file must remain mechanically portable to
 *   Rust, so it speaks only in numbers, strings, and Float32Array.
 * - process() never allocates, logs, throws, or awaits.
 * - The sample rate is whatever the constructor was given. Never assume 44100.
 * - Parameter values arrive in engine units: floats and ints as-is, enums as
 *   their option index. Mapping from preset files happens outside the engine
 *   via the generated toEngineValue().
 */

export class SynthEngine {
  readonly sampleRate: number;

  /** Engine-unit value per parameter id. Populated by setParam. */
  private params: { [id: string]: number };

  /** MIDI notes currently held, for the voice manager that arrives in M1. */
  private heldNotes: Int32Array;
  private heldCount: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.params = {};
    this.heldNotes = new Int32Array(128);
    this.heldCount = 0;
  }

  /**
   * Set a parameter in engine units. Unknown ids are ignored here; validation
   * happens at the boundary (preset load, NL edit) before values reach the
   * audio thread. Smoothing is applied inside the engine once it synthesizes.
   */
  setParam(id: string, value: number): void {
    this.params[id] = value;
  }

  getParam(id: string): number {
    const v = this.params[id];
    return v === undefined ? 0 : v;
  }

  noteOn(midiNote: number, velocity: number): void {
    if (midiNote < 0 || midiNote > 127 || velocity <= 0) return;
    if (this.heldCount < this.heldNotes.length) {
      this.heldNotes[this.heldCount] = midiNote;
      this.heldCount += 1;
    }
  }

  noteOff(midiNote: number): void {
    for (let i = 0; i < this.heldCount; i += 1) {
      if (this.heldNotes[i] === midiNote) {
        // Compact the held list. Order does not matter yet.
        this.heldNotes[i] = this.heldNotes[this.heldCount - 1];
        this.heldCount -= 1;
        return;
      }
    }
  }

  /**
   * Render one block into the given stereo buffers. Runs on the audio thread:
   * no allocation, no logging, no throwing, no async.
   */
  process(outLeft: Float32Array, outRight: Float32Array): void {
    const n = outLeft.length < outRight.length ? outLeft.length : outRight.length;
    for (let i = 0; i < n; i += 1) {
      outLeft[i] = 0.0;
      outRight[i] = 0.0;
    }
  }
}
