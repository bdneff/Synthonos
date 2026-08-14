---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/ui/styles.css"]
---

Scope: the whole Synthonos shell (src/App.tsx and src/ui/**), one fixed-viewport instrument surface. Visitor mode: Operate.

Audience and job: a DAW-newcomer at a laptop who wants the sound in their head; the describe lane is the front door, the eight macros are where they live, the rack is where they grow.

Task and states: type words -> knobs move (machine-glow in each macro's ink, the rainbow band runs a light chase while the machine shapes); play from the computer keyboard; load/save presets as patch-bank caps; match from a WAV via the bank's Match drawer when the local service is up; everything undoable; knobs operable from the keyboard (arrows, Home/End).

Constraints: fits 1280x800 with rack closed, no page scroll (min-width 1140); advanced rack is 100% manifest-generated with group-level styling only; no new runtime deps; bundled OFL fonts only; plain musician words, no engineering abbreviations.

Chosen direction: The Jupiter Panel (direction seed 10f477f8, code-led) — Roland Jupiter-8 front-panel grammar: painted steel, silkscreen frames, machine-speaks-in-light, eight indexed inks under one rainbow signature. See DESIGN.md.

Composition: The Symmetric Console (surface seed be120ee0, owner delegated the pick): mirrored 2x2 macro banks flank the center instrument cluster (spectrum over green-phosphor scope, patch LED window, spec print); rack drawer below compresses the console when open (.rack-open); patch bank strip of named switch caps with category inks; keys under the full-width rainbow band. The old five-zone sidebar layout is retired.

Memorable moment: power-on — panels seat, the rainbow wipes in, the LED displays flicker alive — then describe a sound and watch the knobs burn their inks while the band chases.

Ratified amendments: the rainbow band lives over the keybed (the JP-8's own placement); the describe sentence speaks in Barlow at 15px warmth, deliberately no italic serif in the silkscreen world.

Unresolved: per-macro stripe bloom on the rainbow band (machine-glow -> stripe) is designed but unwired; mobile/narrow layouts out of scope for this desktop instrument.
