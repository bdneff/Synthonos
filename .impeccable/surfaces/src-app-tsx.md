---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/ui/styles.css"]
---

Scope: the whole Synthonos shell (src/App.tsx and src/ui/**), one fixed-viewport instrument surface. Visitor mode: Operate.

Audience and job: a DAW-newcomer at a laptop who wants the sound in their head; the describe lane is the front door, the eight macros are where they live, the rack is where they grow.

Task and states: type words -> knobs move (machine-glow in each macro's hue); play from the computer keyboard; load/save presets in the crate; match from a WAV when the local service is up; everything undoable.

Constraints: zone layout is user-approved and fixed (describe top, display strip, macros center, crate left, keys deck bottom, rack behind toggle); fits 1280x800 with rack closed, no page scroll; advanced rack is 100% manifest-generated with group-level styling only; no new runtime deps; bundled OFL fonts only.

Chosen direction: Deck Grammar (seed dec7a09b, code-led) — DJ-software slate decks where color is information: tri-band spectrum, hot-cue macro hues, function-colored rack groups. See DESIGN.md.

Memorable moment: describe a sound and watch each knob burn its own color as the machine obeys, while the tri-band hairline sweeps under the sentence.

Unresolved: loaded-sound readout could grow into a bigger deck-style numeric block; mobile/narrow layouts are out of scope for this desktop instrument.
