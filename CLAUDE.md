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
- DSP code in src/dsp/ imports nothing. No React, no DOM, no npm packages, no
  async, not even other project files. It must remain mechanically portable to
  Rust. A static scan in test/rt-safety.test.ts enforces this.
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
