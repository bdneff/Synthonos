/**
 * The AudioWorklet processor: a thin shell that runs SynthEngine on the audio
 * thread. All synthesis lives in src/dsp; all message handling lives in
 * protocol.ts; this file only wires them to the Web Audio API.
 *
 * Scope frames: output is mirrored into a preallocated ring buffer and a
 * copy is posted to the UI roughly every 43 ms. The postMessage copy is the
 * one allocation this file makes on the audio thread; it is small, periodic,
 * and outside src/dsp (whose no-allocation rule the static scanner enforces).
 */

import { SynthEngine } from "../dsp/engine";
import { dispatchToEngine } from "./protocol";
import type { ToWorkletMessage } from "./protocol";

export const SCOPE_FRAME_SIZE = 2048;
const POST_INTERVAL_BLOCKS = 16; // 16 * 128 samples = ~43 ms at 48 kHz

class SynthonosProcessor extends AudioWorkletProcessor {
  private readonly engine = new SynthEngine(sampleRate);
  private readonly ring = new Float32Array(SCOPE_FRAME_SIZE);
  private ringPos = 0;
  private blocksSincePost = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<ToWorkletMessage>) => {
      dispatchToEngine(this.engine, event.data);
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const left = out[0];
    const right = out.length > 1 ? out[1] : out[0];
    this.engine.process(left, right);

    // Mirror the mono mix into the scope ring.
    for (let i = 0; i < left.length; i += 1) {
      this.ring[this.ringPos] = 0.5 * (left[i] + right[i]);
      this.ringPos = (this.ringPos + 1) % SCOPE_FRAME_SIZE;
    }

    this.blocksSincePost += 1;
    if (this.blocksSincePost >= POST_INTERVAL_BLOCKS) {
      this.blocksSincePost = 0;
      // Unroll the ring so the frame is in chronological order.
      const frame = new Float32Array(SCOPE_FRAME_SIZE);
      const tail = SCOPE_FRAME_SIZE - this.ringPos;
      frame.set(this.ring.subarray(this.ringPos), 0);
      frame.set(this.ring.subarray(0, this.ringPos), tail);
      this.port.postMessage({ t: "scope", samples: frame }, [frame.buffer]);
    }
    return true;
  }
}

registerProcessor("synthonos-engine", SynthonosProcessor);
