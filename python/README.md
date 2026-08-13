# synthmatch: audio-to-patch matching service

Tier 2 of the audio match feature (SYNTH_BUILD_PLAN.md section 4): given a
target audio clip, find the patch in the synth's parameter space that sounds
closest to it. Differential evolution over the schema parameter space, with a
multi-resolution STFT loss, rendering every candidate through the real
TypeScript engine.

This is approximation, not inversion. The service finds the closest sound our
engine can reach; it does not recover the original preset. Match, not Clone.

## What the MVP does

- `POST /match`: upload a WAV, get back the best-matching patch in preset
  format (enums as option names), the final loss, and the per-generation loss
  history.
- `POST /match/stream`: same, but streams progress as server-sent events (one
  `progress` event per generation, then one `result` event).
- The optimizer routes each whole differential-evolution population through a
  single persistent `npx tsx scripts/render-batch.ts` subprocess, so Node
  startup is paid once per service process, not per candidate.
- Log-curve parameters (cutoff, envelope times, LFO rate) are searched in log
  space; ints and enums round to valid values. Bounds come from the generated
  `src/generated/optimizer-bounds.json`, never hardcoded.

## What the MVP does not do (and where it slots in later)

- **No Demucs source separation, no basic-pitch transcription.** Both need
  multi-GB models. The input should already be a reasonably isolated synth
  stem, and matching happens at a single fixed note (the `note` form field,
  default 60 = middle C). The seam is `synthmatch/preprocess.py`:
  `preprocess()` currently passes audio through and returns one fixed note;
  when separation and transcription land, only that function changes.
- **No tier 1 retrieval.** Needs the factory preset bank, which does not
  exist yet (Phase 3). Stub: `optimize.tier1_retrieval_initial_guess`.
- **No tier 3 learned inverse.** Stub:
  `optimize.tier3_learned_inverse_initial_guess`.

## Setup

Node dependencies must already be installed at the repo root (`npm ci`),
because rendering goes through `npx tsx`. Then:

```
pip install -r python/requirements.txt
```

## Run the service (localhost only)

From the repo root:

```
cd python
python3 -m uvicorn synthmatch.service:app --host 127.0.0.1 --port 8765
```

Example request:

```
curl -s http://127.0.0.1:8765/match \
  -F file=@target.wav -F note=60 -F maxiter=20 -F popsize=4 -F seed=1
```

`maxiter` (generations) and `popsize` (scipy multiplier; population is
popsize x free dimensions, rounded up to a power of 2 by the Sobol init) are
the budget. The defaults land a full-space match in the tens of seconds on a
laptop-class machine.

## Run the tests

From the repo root:

```
python3 -m pytest python/tests -x -q
```

The suite is offline and deterministic (fixed seeds). The recovery test
renders a target with known parameters through the real engine, searches a
small free subspace, and asserts convergence toward the target; it is the
slowest test at a couple of minutes.
