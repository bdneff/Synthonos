/**
 * The real EngineBridge: SynthEngine running in an AudioWorklet.
 *
 * Lifecycle: constructed synchronously and handed to the store like the stub,
 * but the AudioContext cannot start until a user gesture (browser autoplay
 * policy). Every setParam/note call before start() resolves is cached and
 * flushed the moment the worklet is live, so no state is lost and the UI
 * never has to care.
 */

import workletUrl from "./worklet-processor.ts?worker&url";
import { magnitudeSpectrumForDisplay } from "./fft";
import type { EngineBridge } from "../ui/engine-bridge";
import type { ParamId } from "../generated/params";
import type { ScopeFrame, ToWorkletMessage } from "./protocol";

const SCOPE_DISPLAY_SIZE = 2048;

export class WorkletEngineBridge implements EngineBridge {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private starting: Promise<void> | null = null;

  /** Latest engine-unit value per param, replayed on (re)start. */
  private readonly cachedParams = new Map<ParamId, number>();
  /** Notes held before the worklet was live, replayed on start. */
  private readonly pendingNotes = new Map<number, number>();

  private scope: Float32Array = new Float32Array(SCOPE_DISPLAY_SIZE);
  private spectrum: Float32Array | null = null;
  private spectrumDirty = true;

  /** True once the audio graph is running. */
  get live(): boolean {
    return this.node !== null;
  }

  /**
   * Start (or resume) the audio graph. Must be called from a user gesture
   * the first time. Safe to call repeatedly.
   */
  start(): Promise<void> {
    if (this.node !== null) {
      // Context can be suspended by the browser; nudge it.
      void this.context?.resume();
      return Promise.resolve();
    }
    this.starting ??= this.doStart().catch((err) => {
      // Leave the bridge in cached mode; a later gesture retries.
      this.starting = null;
      throw err;
    });
    return this.starting;
  }

  private async doStart(): Promise<void> {
    const context = new AudioContext();
    await context.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(context, "synthonos-engine", {
      numberOfInputs: 0,
      outputChannelCount: [2],
    });
    node.port.onmessage = (event: MessageEvent<ScopeFrame>) => {
      if (event.data.t === "scope") {
        this.scope = event.data.samples;
        this.spectrumDirty = true;
      }
    };
    node.connect(context.destination);
    await context.resume();

    this.context = context;
    this.node = node;

    // Replay everything that happened while we were not live.
    for (const [id, v] of this.cachedParams) {
      this.post({ t: "param", id, v });
    }
    for (const [n, v] of this.pendingNotes) {
      this.post({ t: "on", n, v });
    }
    this.pendingNotes.clear();
  }

  private post(msg: ToWorkletMessage): void {
    this.node?.port.postMessage(msg);
  }

  setParam(id: ParamId, engineValue: number): void {
    this.cachedParams.set(id, engineValue);
    this.post({ t: "param", id, v: engineValue });
  }

  noteOn(midiNote: number, velocity: number): void {
    if (this.node === null) {
      this.pendingNotes.set(midiNote, velocity);
      return;
    }
    this.post({ t: "on", n: midiNote, v: velocity });
  }

  noteOff(midiNote: number): void {
    if (this.node === null) {
      this.pendingNotes.delete(midiNote);
      return;
    }
    this.post({ t: "off", n: midiNote });
  }

  getScopeData(): Float32Array {
    return this.scope;
  }

  getSpectrumData(): Float32Array {
    if (this.spectrumDirty || this.spectrum === null) {
      this.spectrum = magnitudeSpectrumForDisplay(this.scope);
      this.spectrumDirty = false;
    }
    return this.spectrum;
  }

  getSampleRate(): number {
    // Read, never assumed: the context decides (44.1k on many devices).
    // Before the first gesture there is no context yet; 48000 is only
    // the pre-start placeholder and is replaced the moment audio runs.
    return this.context?.sampleRate ?? 48000;
  }
}

/**
 * Pick the real bridge when the environment can run it (browser, Tauri
 * webview), the stub otherwise (Node test runs, server rendering).
 */
export function canRunAudioWorklet(): boolean {
  return (
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined"
  );
}
