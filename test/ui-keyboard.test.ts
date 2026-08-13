/**
 * Computer keyboard note mapping: the letter row is chromatic from C,
 * octave shifting clamps, MIDI numbers come out right. Pure logic, no DOM.
 */

import { describe, expect, it } from "vitest";
import {
  KEY_ROW,
  OCTAVE_DEFAULT,
  OCTAVE_MAX,
  OCTAVE_MIN,
  clampOctave,
  isBlackKey,
  keySemitone,
  midiForKey,
  midiToName,
  octaveBaseMidi,
} from "../src/ui/keyboard-map";

describe("keyboard mapping", () => {
  it("maps the full letter row chromatically from C", () => {
    expect(KEY_ROW).toEqual([
      "a", "w", "s", "e", "d", "f", "t", "g", "y",
      "h", "u", "j", "k", "o", "l", "p", ";",
    ]);
    KEY_ROW.forEach((key, index) => {
      expect(keySemitone(key)).toBe(index);
    });
  });

  it("produces correct MIDI notes at the default octave (C4 = 60)", () => {
    expect(octaveBaseMidi(OCTAVE_DEFAULT)).toBe(60);
    expect(midiForKey("a", 4)).toBe(60); // C4
    expect(midiForKey("w", 4)).toBe(61); // C#4
    expect(midiForKey("s", 4)).toBe(62); // D4
    expect(midiForKey("h", 4)).toBe(69); // A4
    expect(midiForKey("k", 4)).toBe(72); // C5
    expect(midiForKey(";", 4)).toBe(76); // E5
  });

  it("is case insensitive and rejects unmapped keys", () => {
    expect(midiForKey("A", 4)).toBe(60);
    expect(midiForKey("q", 4)).toBeNull();
    expect(midiForKey("z", 4)).toBeNull(); // octave key, not a note
    expect(midiForKey("x", 4)).toBeNull();
    expect(midiForKey("1", 4)).toBeNull();
    expect(midiForKey("", 4)).toBeNull();
  });

  it("shifts by exactly one octave per step", () => {
    const at4 = midiForKey("a", 4);
    const at3 = midiForKey("a", 3);
    const at5 = midiForKey("a", 5);
    expect(at4).not.toBeNull();
    expect(at3).toBe((at4 as number) - 12);
    expect(at5).toBe((at4 as number) + 12);
  });

  it("clamps the octave range", () => {
    expect(clampOctave(OCTAVE_MIN - 5)).toBe(OCTAVE_MIN);
    expect(clampOctave(OCTAVE_MAX + 5)).toBe(OCTAVE_MAX);
    expect(clampOctave(OCTAVE_DEFAULT)).toBe(OCTAVE_DEFAULT);
  });

  it("stays inside the MIDI range at the clamped extremes", () => {
    for (const key of KEY_ROW) {
      const low = midiForKey(key, OCTAVE_MIN);
      const high = midiForKey(key, OCTAVE_MAX);
      expect(low).not.toBeNull();
      expect(high).not.toBeNull();
      expect(low as number).toBeGreaterThanOrEqual(0);
      expect(high as number).toBeLessThanOrEqual(127);
    }
  });

  it("names notes with the C4 = 60 convention", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(61)).toBe("C#4");
    expect(midiToName(69)).toBe("A4");
    expect(midiToName(59)).toBe("B3");
    expect(midiToName(0)).toBe("C-1");
  });

  it("knows which keys are black", () => {
    const blackInOctave = [61, 63, 66, 68, 70];
    for (let midi = 60; midi < 72; midi += 1) {
      expect(isBlackKey(midi)).toBe(blackInOctave.includes(midi));
    }
  });
});
