/**
 * Offline render harness: instantiates the engine outside the browser and
 * renders scored note events to stereo Float32Arrays, block by block, the
 * same way the AudioWorklet will drive it.
 */

import { SynthEngine } from "../../src/dsp/engine";
import {
  DEFAULT_PATCH_PARAMS_ENGINE,
} from "./patch";

export interface NoteEvent {
  timeSec: number;
  type: "on" | "off";
  note: number;
  velocity?: number;
}

export interface RenderOptions {
  durationSec: number;
  sampleRate?: number;
  blockSize?: number;
  /** Engine-unit overrides applied on top of the default patch. */
  params?: Record<string, number>;
  events?: NoteEvent[];
}

export interface RenderedAudio {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_BLOCK_SIZE = 128;

export function renderOffline(opts: RenderOptions): RenderedAudio {
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const blockSize = opts.blockSize ?? DEFAULT_BLOCK_SIZE;
  const totalFrames = Math.round(opts.durationSec * sampleRate);

  const engine = new SynthEngine(sampleRate);
  for (const [id, value] of Object.entries(DEFAULT_PATCH_PARAMS_ENGINE)) {
    engine.setParam(id, value);
  }
  for (const [id, value] of Object.entries(opts.params ?? {})) {
    engine.setParam(id, value);
  }

  const events = [...(opts.events ?? [])].sort((a, b) => a.timeSec - b.timeSec);
  let nextEvent = 0;

  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);
  const blockL = new Float32Array(blockSize);
  const blockR = new Float32Array(blockSize);

  for (let start = 0; start < totalFrames; start += blockSize) {
    const blockStartSec = start / sampleRate;
    while (nextEvent < events.length && events[nextEvent].timeSec <= blockStartSec) {
      const ev = events[nextEvent];
      if (ev.type === "on") {
        engine.noteOn(ev.note, ev.velocity ?? 1);
      } else {
        engine.noteOff(ev.note);
      }
      nextEvent += 1;
    }
    engine.process(blockL, blockR);
    const n = Math.min(blockSize, totalFrames - start);
    for (let i = 0; i < n; i += 1) {
      left[start + i] = blockL[i];
      right[start + i] = blockR[i];
    }
  }

  return { sampleRate, left, right };
}
