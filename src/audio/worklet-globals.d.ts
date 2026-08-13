/**
 * TypeScript's DOM lib covers the main-thread half of the Web Audio API but
 * not the AudioWorkletGlobalScope the processor runs in. Just enough ambient
 * declarations for our processor; no implementation leaks from here.
 */

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor,
): void;

/** Sample rate of the AudioContext this worklet belongs to. */
declare const sampleRate: number;
