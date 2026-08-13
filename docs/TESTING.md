# Testing Synthonos

Audio DSP fails silently. A wrong filter coefficient does not throw; it
produces sound, slightly wrong sound: aliasing, DC offset, denormal stalls,
clicks at note boundaries. All of it is runnable code that looks correct. The
offline harness exists so that wrong sound fails CI instead of shipping.

No DSP module is considered done without spectral tests. That rule is in
CLAUDE.md and it is not negotiable.

## How the harness works

`test/harness/render.ts` instantiates the engine from `src/dsp/engine.ts`
outside the browser, applies the generated default patch, feeds it scored
note events, and renders block by block into stereo Float32Arrays, exactly
the way the AudioWorklet will drive it in production. `scripts/render.ts`
wraps the same path in a CLI that writes a WAV you can listen to.

The measurement tools (FFT, WAV codec) are hand written and dependency free
on purpose: the harness's job is to distrust the DSP code, so it must not
share code with it. The harness itself is tested in
`test/harness-selftest.test.ts`, where every assertion is required to pass a
known-good signal and fail a known-bad one. An assertion that never fails
proves nothing.

## The assertions and why each exists

### Silence test (`assertSilent`)

With no note playing, output must be exactly 0.0, not merely quiet. Catches
leaking envelopes, stuck voices, and denormal tails that keep a voice
technically alive. Exact zero matters: "very quiet" hides bugs that
accumulate.

### Aliasing test (`assertAliasingBelow`, `assertSweepAliasFree`)

For a periodic tone at a known fundamental, every legitimate component sits
on a harmonic. Energy anywhere else is aliasing. The sweep helper steps log
spaced fundamentals from 20 Hz to 8 kHz and asserts all non-harmonic energy
stays below -60 dBFS. This is the test that forces correct PolyBLEP or
wavetable mipmapping; a naive oscillator fails it loudly (demonstrated
permanently by the negative control test in the self-test suite).

Two measurement subtleties, learned the hard way in Phase 0:

- Test fundamentals are snapped to FFT bins so Hann window leakage stays
  confined and cannot read as false aliasing.
- If the fundamental divides the sample rate exactly (3000 Hz at 48 kHz),
  every aliased image folds precisely onto a legitimate harmonic and the bug
  becomes invisible. The sweep helper nudges such fundamentals off the
  pathological spot automatically; hand-picked test frequencies must avoid
  them by hand.
- Resolution limit: with 8192-sample frames the harmonic grid gets denser
  than the tolerance window below roughly 60 Hz, so discrimination starts
  there. Aliasing is worst at high fundamentals, so this is acceptable; the
  low end is still covered indirectly because high harmonics of low notes
  fold audibly.

### Click test (`assertNoClicks`)

No sample-to-sample discontinuity above threshold at note on, note off, and
voice steal. Catches missing envelope ramps and abrupt voice reassignment.
The threshold (0.25 by default) allows legitimate high frequency content
while flagging hard edges; a full-scale sine at 8 kHz moves about 0.05 per
sample at 48 kHz, a hard gate edge moves near 1.0.

### DC offset test (`assertDcOffsetBelow`)

Mean of a rendered buffer stays near zero. DC eats headroom, pops on
start/stop, and betrays asymmetric waveform bugs and broken filter
topologies.

### NaN and denormal guards (`assertFinite`, `assertNoDenormals`)

Every sample must be finite; one NaN in a feedback path silences a voice
forever. Denormals (values below 2^-126) make the CPU fall off its fast path
during quiet passages; the engine must flush them to zero in filter state.
The harness rejects any subnormal output.

### Filter response test (`assertLowpassCutoffNear`, `measurePeakAboveTargetDb`)

Feed deterministic white noise through the filter, average magnitude spectra
over many frames, smooth across bins, and find the first sustained -3 dB
crossing relative to the passband. Asserts the knee lands within a
multiplicative tolerance of the requested cutoff, and (once the SVF lands)
that the resonance peak has the expected gain. Statistical estimates need the
smoothing and the sustained-crossing rule; without them the knee reads
systematically low on noise dips. The one-pole calibration fixture in the
self-tests keeps the measurement honest.

### Real-time safety (`test/rt-safety.test.ts`)

A static scan of `src/dsp/` source, because a runtime test cannot prove a
code path never allocates; the path might simply not run under test. Module
wide: no imports of any kind, no console, no async/await/Promise, no timers,
no DOM. Inside `process()` additionally: no `new`, no array/object literal
allocation, no `throw`, no `.push`, no string building. The scanner has its
own self-test with a deliberately unsafe module.

### Golden renders (`compareToGolden`)

Every factory preset renders a reference WAV checked into `test/golden/`
(32-bit float, compared bit-exactly). Any commit that changes one fails CI
until you inspect the new render, regenerate with `UPDATE_GOLDEN=1 npm test`,
and commit the change deliberately. This catches the "small refactor silently
changed the sound of everything" class of bug, which is otherwise nearly
invisible. Goldens are small enough for plain git today; move `test/golden/`
to git-lfs when real synthesis makes them heavier.

## Schema drift (`npm run codegen:check`)

Not an audio test, but the same philosophy: every parameter is defined once
in `params.schema.json`, and CI fails if any generated file is stale. If a
parameter existed in five places, parallel agents would drift and the UI knob
would say 12000 while the engine heard 0.6.

## Writing tests for a new DSP module

1. Land the module and its tests in the same commit.
2. Positive case: the module under correct settings passes the relevant
   assertions (sweep for oscillators, knee/peak for filters, click for
   envelopes and voice management).
3. Negative case where practical: show the assertion would catch the
   module's most likely failure mode.
4. If the module changes any factory preset's sound on purpose, regenerate
   goldens in the same commit and say why in the message.
