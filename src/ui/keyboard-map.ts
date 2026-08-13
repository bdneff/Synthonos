/**
 * Computer keyboard to MIDI note mapping. Pure logic, no DOM.
 *
 * The middle letter row plays chromatically from C, the way most soft
 * synths do it: a w s e d f t g y h u j k o l p ;
 * (a = C, w = C sharp, s = D, ... k = the next C up).
 * z shifts the octave down, x shifts it up.
 */

/** Keys in chromatic order starting at C of the current octave. */
export const KEY_ROW: readonly string[] = [
  "a",
  "w",
  "s",
  "e",
  "d",
  "f",
  "t",
  "g",
  "y",
  "h",
  "u",
  "j",
  "k",
  "o",
  "l",
  "p",
  ";",
];

export const OCTAVE_MIN = 1;
export const OCTAVE_MAX = 6;
export const OCTAVE_DEFAULT = 4;

const KEY_TO_SEMITONE: ReadonlyMap<string, number> = new Map(
  KEY_ROW.map((key, index) => [key, index]),
);

/** Semitone offset from C for a mapped key, or null if the key is not mapped. */
export function keySemitone(key: string): number | null {
  const semi = KEY_TO_SEMITONE.get(key.toLowerCase());
  return semi === undefined ? null : semi;
}

export function clampOctave(octave: number): number {
  if (octave < OCTAVE_MIN) return OCTAVE_MIN;
  if (octave > OCTAVE_MAX) return OCTAVE_MAX;
  return Math.round(octave);
}

/** MIDI note number for the C of an octave (C4 = 60 convention). */
export function octaveBaseMidi(octave: number): number {
  return 12 * (octave + 1);
}

/**
 * MIDI note for a computer key at the given base octave, or null when the
 * key is unmapped or the result leaves the MIDI range.
 */
export function midiForKey(key: string, baseOctave: number): number | null {
  const semi = keySemitone(key);
  if (semi === null) return null;
  const midi = octaveBaseMidi(baseOctave) + semi;
  if (midi < 0 || midi > 127) return null;
  return midi;
}

const NOTE_NAMES: readonly string[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** "C4" style name for a MIDI note (C4 = 60). */
export function midiToName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** True for the black keys of the piano. */
export function isBlackKey(midi: number): boolean {
  const semi = ((midi % 12) + 12) % 12;
  return semi === 1 || semi === 3 || semi === 6 || semi === 8 || semi === 10;
}
