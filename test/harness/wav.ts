/**
 * Minimal WAV encode/decode for the offline harness. 32-bit float PCM
 * (format 3) so rendered audio round-trips bit-exactly, which the golden
 * render comparison depends on.
 */

export interface WavData {
  sampleRate: number;
  channels: Float32Array[];
}

export function encodeWavFloat32(data: WavData): Uint8Array {
  const numChannels = data.channels.length;
  if (numChannels === 0) throw new Error("wav: need at least one channel");
  const frames = data.channels[0].length;
  for (const ch of data.channels) {
    if (ch.length !== frames) throw new Error("wav: channel length mismatch");
  }
  const bytesPerSample = 4;
  const dataBytes = frames * numChannels * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); // IEEE float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, data.sampleRate, true);
  view.setUint32(28, data.sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 32, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      view.setFloat32(offset, data.channels[c][i], true);
      offset += 4;
    }
  }
  return new Uint8Array(buf);
}

export function decodeWavFloat32(bytes: Uint8Array): WavData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readStr = (offset: number, len: number) => {
    let s = "";
    for (let i = 0; i < len; i += 1) s += String.fromCharCode(view.getUint8(offset + i));
    return s;
  };
  if (readStr(0, 4) !== "RIFF" || readStr(8, 4) !== "WAVE") {
    throw new Error("wav: not a RIFF/WAVE file");
  }
  if (readStr(12, 4) !== "fmt " || view.getUint16(20, true) !== 3) {
    throw new Error("wav: expected 32-bit float format written by this harness");
  }
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  if (readStr(36, 4) !== "data") throw new Error("wav: expected single data chunk at offset 36");
  const dataBytes = view.getUint32(40, true);
  const frames = dataBytes / (4 * numChannels);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c += 1) channels.push(new Float32Array(frames));
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      channels[c][i] = view.getFloat32(offset, true);
      offset += 4;
    }
  }
  return { sampleRate, channels };
}
