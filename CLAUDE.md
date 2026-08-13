# Synthonos

Natural language controlled virtual analog synthesizer. Runs locally in Tauri.
Target user has never opened a DAW.

Read SYNTH_BUILD_PLAN.md before starting any session. It is the project
constitution: phases, milestones, architecture decisions, and the reasoning
behind them.

## Hard rules

- All parameters are defined ONLY in params.schema.json. Never hardcode a
  parameter name, range, or default anywhere else. Run `npm run codegen` after
  schema edits; CI fails on drift.
- DSP code in src/dsp/ imports nothing external. Relative imports of sibling
  src/dsp modules are the only imports allowed: no React, no DOM, no npm
  packages, no node builtins, no async, nothing from outside src/dsp. It must
  remain mechanically portable to Rust. A static scan in
  test/rt-safety.test.ts enforces this.
- Nothing in the audio callback (`process()`) allocates, logs, throws, or
  awaits. The same scan enforces this on the source, not just at runtime.
- No DSP module is done without spectral tests. See docs/TESTING.md. The
  offline harness in test/harness/ renders the engine outside the browser and
  asserts on the audio.
- Sample rate is never assumed to be 44100. Read it from the context; the
  engine takes it as a constructor argument.
- Every parameter change is smoothed. No stepped values reach the audio
  thread.
- Out-of-bounds parameter values are rejected, never clamped silently. The
  generated validator in src/generated/params.ts is the only gatekeeper.
- Golden renders in test/golden/ only change deliberately: inspect the diff,
  regenerate with `UPDATE_GOLDEN=1 npm test`, and say so in the commit message.

## Commands

- `npm run codegen` regenerate everything from params.schema.json
- `npm run codegen:check` fail if generated files are stale (CI runs this)
- `npm run typecheck` strict TypeScript, no emit
- `npm test` full suite including harness self-tests
- `npm run render` render the default preset to test/output/ and assert on it

## Style

- TypeScript strict mode, no `any`.
- Prose in docs and UI copy: plain language, no em dashes, no marketing voice.
- Explain synth concepts the way you would to a musician, not an engineer.
- UI tooltips and control labels come from the schema (`nl_direction`,
  `label`), never hardcoded strings.

## Design discipline (anti AI slop)

Any session touching src/ui must follow this. The rubric of record is
Anthropic's frontend-design skill:
https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
(read it before designing; a local snapshot may exist in the session
scratchpad but the repo link is canonical). Impeccable
(https://impeccable.style) is a reported collection of design skills for
AI harnesses; it was unreachable from the build environment and is noted
here unverified. Key process from the skill: work in two passes (token
plan first: 4-6 named colors, type roles, layout concept, one signature
element; self-critique it against the skill's three "calibration default"
looks before writing code), spend all boldness in ONE signature element,
apply the Chanel rule before finishing, and critique from screenshots,
never from memory of what you wrote.

Lessons this project paid for, do not relearn them:

- Slop is structural before it is chromatic. Two full restyles failed
  because they changed palette and fonts on an unchanged wireframe. The
  tells that read as AI regardless of color: nested rounded-rectangle
  cards with per-card headers; identical controls evenly spaced in a
  large empty panel; uniform gaps and uniform 9-13px labels everywhere;
  decorative numbering that encodes no real sequence; small-caps label
  confetti on every zone; glow spread evenly over everything.
- Build interfaces for hardware the way hardware is built: one
  continuous panel surface; regions drawn by engraved rules with
  silkscreen titles interrupting them, not by cards; recessed wells only
  where a physical instrument would have glass or a slot; staged control
  sizes (primary knobs visibly larger); real scale markings, units, and
  fine print (model plate, calibration text) as the texture of realness.
- One accent with a semantic rule beats two accents used decoratively.
  Current rule: signal orange means the machine is live or acting
  (focus, active key, machine-driven knob motion, busy state, enabled
  primary action). Never use the accent as decoration.
- The signature element is the describe lane, where language becomes
  sound: Instrument Serif italic for the human sentence and the reply.
  Everything else stays quiet and disciplined.
- Verify with a screenshot loop (headless Chromium, playwright-core is a
  devDependency) and, for large passes, a fresh-context critic agent that
  reviews the screenshots against the skill before anything ships.
  Design fit constraint: 1280x800 with no scrolling, advanced closed.

## What this project is not

- Not a Nexus or Omnisphere clone. Those are sample based. We are virtual
  analog plus wavetable, in the Sylenth1 and Vital family.
- The audio matching feature approximates a target within our parameter
  space. It does not recover the original preset. UI copy must not promise
  otherwise. Call it Match, not Clone.
- Not a DAW. Timeline, arrangement, and plugin hosting are permanently out of
  scope.

## Phase discipline

- Phase 0 (done): scaffold, schema, codegen, offline test harness, CI.
- Phase 0.5: research deliverable, docs/SYNTH_REFERENCE.md and
  docs/SOUND_VOCABULARY.md. No code.
- Phase 1: DSP engine (feature/dsp-engine) and UI shell (feature/ui-shell) in
  parallel worktrees. DSP sessions do not touch src/ui/; UI sessions do not
  touch src/dsp/. Neither modifies params.schema.json without stopping to ask.
- Phase 2: natural language control (feature/nl-control) and audio match
  (feature/audio-match).
- Phase 3: polish, presets, packaging.
