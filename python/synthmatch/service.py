"""FastAPI service for audio-to-patch matching. Localhost only.

Run from the repo root (or anywhere inside the repo):

    python3 -m uvicorn synthmatch.service:app --host 127.0.0.1 --port 8765

Endpoints:

- GET  /health        liveness probe
- POST /match         multipart WAV upload -> best-matching patch (blocks
                      until the search finishes)
- POST /match/stream  same inputs, but streams per-generation progress as
                      server-sent events, ending with the final result

The input clip should be a reasonably isolated synth stem: Demucs source
separation is not wired in yet (see preprocess.py), and transcription is
stubbed to a single fixed note (the ``note`` form field). This service
approximates the target within our parameter space; it does not recover the
original preset. Match, not Clone.
"""

from __future__ import annotations

import io
import json
import queue
import threading
from typing import Iterator

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from scipy.io import wavfile

from .bridge import RenderBridge
from .optimize import MatchResult, match_audio
from .params import ParamSpace
from .preprocess import preprocess

app = FastAPI(
    title="Synthonos Match",
    description=(
        "Tier 2 audio-to-patch matching. Upload a short, reasonably "
        "isolated synth stem; get back the closest patch in the synth's "
        "parameter space. Approximation, not inversion."
    ),
)

# One space and one persistent render bridge per process. The bridge is
# internally locked, so concurrent requests serialize through it; fine for a
# localhost single-user service.
_space: ParamSpace | None = None
_bridge: RenderBridge | None = None
_init_lock = threading.Lock()


def _get_space_and_bridge() -> tuple[ParamSpace, RenderBridge]:
    global _space, _bridge
    with _init_lock:
        if _space is None:
            _space = ParamSpace()
        if _bridge is None or not _bridge.alive:
            _bridge = RenderBridge(_space.root)
    return _space, _bridge


def _decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    try:
        sample_rate, audio = wavfile.read(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"could not decode WAV: {exc}") from exc
    audio = np.asarray(audio)
    if np.issubdtype(audio.dtype, np.integer):
        audio = audio.astype(np.float64) / float(np.iinfo(audio.dtype).max)
    else:
        audio = audio.astype(np.float64)
    if audio.size == 0:
        raise HTTPException(status_code=400, detail="WAV contains no samples")
    return audio, int(sample_rate)


def _run_match(
    data: bytes,
    note: int,
    duration_sec: float | None,
    maxiter: int,
    popsize: int,
    seed: int | None,
    progress=None,
) -> MatchResult:
    audio, sample_rate = _decode_wav(data)
    pre = preprocess(audio, sample_rate, note=note, duration_sec=duration_sec)
    space, bridge = _get_space_and_bridge()
    midi_note, _start, note_dur = pre.notes[0]
    return match_audio(
        pre.audio,
        pre.sample_rate,
        note=midi_note,
        duration_sec=note_dur,
        space=space,
        bridge=bridge,
        maxiter=maxiter,
        popsize=popsize,
        seed=seed,
        progress=progress,
    )


def _result_payload(result: MatchResult) -> dict:
    return {
        "params": result.params_preset,
        "loss": result.loss,
        "initial_median_loss": result.initial_median_loss,
        "history": result.history,
        "n_renders": result.n_renders,
        "wall_seconds": result.wall_seconds,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/match")
def match(
    file: UploadFile = File(...),
    note: int = Form(60),
    duration_sec: float | None = Form(None),
    maxiter: int = Form(20),
    popsize: int = Form(4),
    seed: int | None = Form(None),
) -> dict:
    if maxiter < 1 or maxiter > 200 or popsize < 1 or popsize > 32:
        raise HTTPException(status_code=400, detail="budget out of range")
    data = file.file.read()
    try:
        result = _run_match(data, note, duration_sec, maxiter, popsize, seed)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"match failed: {exc}") from exc
    return _result_payload(result)


@app.post("/match/stream")
def match_stream(
    file: UploadFile = File(...),
    note: int = Form(60),
    duration_sec: float | None = Form(None),
    maxiter: int = Form(20),
    popsize: int = Form(4),
    seed: int | None = Form(None),
) -> StreamingResponse:
    """Like /match, but emits SSE: one ``progress`` event per generation,
    then a single ``result`` (or ``error``) event."""
    if maxiter < 1 or maxiter > 200 or popsize < 1 or popsize > 32:
        raise HTTPException(status_code=400, detail="budget out of range")
    data = file.file.read()
    events: queue.Queue = queue.Queue()

    def worker() -> None:
        try:
            result = _run_match(
                data, note, duration_sec, maxiter, popsize, seed,
                progress=lambda entry: events.put(("progress", entry)),
            )
            events.put(("result", _result_payload(result)))
        except Exception as exc:  # noqa: BLE001 - reported to the client
            events.put(("error", {"detail": str(exc)}))
        finally:
            events.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def sse() -> Iterator[str]:
        while True:
            item = events.get()
            if item is None:
                break
            kind, payload = item
            yield f"event: {kind}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765)
