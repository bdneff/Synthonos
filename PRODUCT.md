# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who have never opened a DAW but hear a sound in their head and want to
make it. They arrive wanting a sound, not a signal path. Secondary audience:
curious beginners who will grow into the advanced panel by watching the
machine operate itself.

## Product Purpose

Synthonos is a natural-language-controlled virtual analog synthesizer that
runs locally (web dev build today, Tauri desktop next). Type "make it darker
and wider" and watch the knobs move. Success: a stranger installs it and gets
a sound they like in under two minutes, and learns the instrument by watching
it play itself.

## Positioning

A Sylenth-class 16-voice subtractive engine (bandlimited wavetable
oscillators, worst-case aliasing -119 dBFS, TPT state variable filter,
exponential envelopes) whose front door is a sentence, not a patch panel.
Natural language edits are schema-constrained JSON — never free text, out-of-
range edits rejected, every edit animated and undoable. Audio-to-patch is
scoped honestly as Match, not Clone.

## Operating Context

Desktop use, on a laptop or studio machine, usually with headphones or
monitors. Playable immediately from the computer keyboard (A S D F G H J K
L ; — Z/X shift octave); no MIDI controller required. BYO Anthropic API key
in Settings; key stays on the machine. The audio matcher is a localhost
Python service the user starts themselves.

## Capabilities and Constraints

- Layered interface doctrine (fixed): describe bar always visible as the
  front door; eight macro knobs in human words (Brightness, Thickness,
  Movement, Attack, Space, Grit, Width, Character); the full engine behind
  an Advanced toggle. Live spectrum analyzer + oscilloscope. Presets are
  starting points, not endpoints.
- The advanced panel is 100% generated from params.schema.json's UI
  manifest; styling may act at group level only.
- 53 parameters, 40 factory presets organized by vibe ("Warm Pad", not
  "2-osc LP24 pad"). Undo stack covers everything, NL edits are one entry.
- UI layout zones are user-approved and fixed: describe lane top, full-width
  scope display, macros center, library left with match drawer, keys deck
  bottom, advanced rack behind toggle.
- Must fit 1280x800 with the advanced rack closed, no scrolling.
- No new npm runtime dependencies; fonts must be bundled woff2 (OFL).
- Copy doctrine: plain language a musician would use. "Lowered the filter
  cutoff and added a touch of reverb" teaches; "Set filter_cutoff to 800"
  does not. Real words, never three-letter abbreviations.

## Brand Commitments

Name: Synthonos. Register (user-pinned, 2026-08): must read as professional
real-world music software with genuine personality — the tools producers
respect (Ableton, Bitwig, Teenage Engineering territory) — never
"designed by AI". Three prior visual worlds are rejected anti-references:
(1) near-black + bright teal machined plugin, (2) warm umber + VU amber +
serif language lane, (3) light Braun enamel + signal orange + engraved
hardware. Mono-accent minimalism, cream+serif+terracotta, and
near-black+single-acid-accent are all burned.

## Evidence on Hand

Real: the working engine, 40 factory presets, live scope data, the schema and
its generated UI manifest, docs/assets/ui-guide.png. The describe interaction
(type words, knobs move) is real and demonstrable — it is the product's soul.
Do not fabricate: benchmark claims, testimonial users, DAW-plugin builds that
do not exist yet (VST3/CLAP is future work).

## Product Principles

1. The sentence is the front door; the knobs are the education. Beginners
   learn by watching the machine operate itself.
2. Production-grade look, beginner-grade logic: keep pro density and craft,
   replace engineering abbreviations with human words.
3. Never lie about capability: Match, not Clone; rejected, not clamped.
4. Every state is recoverable: undo everything, presets as starting points.
5. The engine stays portable and dependency-free; the interface never leaks
   complexity upward into the first two layers.

<!-- Facts above are drawn from README.md, SYNTH_BUILD_PLAN.md, and the
     invoking brief; the register commitment under Brand Commitments was
     stated by the project owner in the redesign brief. No structured
     question tool exists in this session's tool surface; no material gaps
     required interview. -->
