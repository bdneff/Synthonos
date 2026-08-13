# Synthonos

A natural language controlled virtual analog synthesizer that runs locally as
a desktop app. Type "make it darker and wider" and watch the knobs move.
Built for people who have never opened a DAW.

Status: **Phase 0 complete (M0)**. Foundation only: parameter schema, code
generation, offline spectral test harness, CI, and an engine that renders
verified, exact silence. Synthesis lands in Phase 1.

## What this is

- A Sylenth-class subtractive synth (plus a wavetable mode later), engine in
  dependency-free TypeScript running in an AudioWorklet, UI in React,
  desktop shell in Tauri.
- Natural language patch editing via schema-constrained JSON, never free
  text, with every edit animated and undoable.
- Audio-to-patch matching that finds the closest sound in our parameter
  space. Match, not Clone: it approximates, it does not recover the original
  preset.

Read SYNTH_BUILD_PLAN.md for the full plan and reasoning, CLAUDE.md for the
hard rules, and docs/TESTING.md for how the audio is kept honest.

## Getting started

```
npm install
npm test              # full suite, including harness self-tests
npm run typecheck
npm run codegen       # regenerate everything from params.schema.json
npm run codegen:check # what CI runs; fails on drift
npm run render        # render the default preset to test/output/*.wav
npm run dev           # Vite dev server (UI shell)
```

## Layout

```
params.schema.json    single source of truth for every parameter
scripts/codegen.ts    emits types, presets, UI manifest, LLM schema, bounds
src/dsp/              the engine; imports nothing, portable to Rust
src/generated/        codegen output; never edit by hand
src/                  React UI shell
src-tauri/            desktop shell
test/harness/         offline renderer, hand-written FFT, WAV, assertions
test/golden/          reference renders; changes must be deliberate
docs/TESTING.md       what each assertion catches and why
```
