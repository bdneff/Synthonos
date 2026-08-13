"""Preprocessing seam for audio-to-patch matching.

SYNTH_BUILD_PLAN.md section 4 calls for two preprocessing steps shared by
all tiers:

1. Source separation with Demucs, so the synth stem is isolated from the
   rest of the mix.
2. Melody transcription with basic-pitch, recovering notes and timings so
   candidates are rendered playing the same notes as the target.

Both need multi-GB models and are OUT OF SCOPE for this MVP. Until they land:

- the input is assumed to be a reasonably isolated synth stem already
  (the API says so), and
- transcription is stubbed: matching happens at a single fixed note
  (configurable, default middle C) for the clip's duration.

This module is the seam. When Demucs and basic-pitch are added, only
``preprocess`` changes; the optimizer and service already consume its output
shape.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DEFAULT_NOTE = 60  # middle C
MIN_DURATION_SEC = 0.25
MAX_DURATION_SEC = 4.0


@dataclass(frozen=True)
class PreprocessResult:
    """Target audio ready for matching, plus the note events to render.

    ``notes`` is a list of (midi_note, start_sec, duration_sec). The MVP
    always returns exactly one note starting at 0 covering the clip.
    """

    audio: np.ndarray  # float64 mono
    sample_rate: int
    notes: list[tuple[int, float, float]]
    duration_sec: float


def preprocess(
    audio: np.ndarray,
    sample_rate: int,
    note: int | None = None,
    duration_sec: float | None = None,
) -> PreprocessResult:
    """Pass-through preprocessing (MVP).

    TODO(tier-2 full): run Demucs source separation here and keep the
        "other"/synth stem before matching.
    TODO(tier-2 full): run basic-pitch transcription here and return the
        real note list instead of a single fixed note, so the candidate is
        rendered playing the same melody as the target.
    """
    mono = np.asarray(audio, dtype=np.float64)
    if mono.ndim == 2:
        mono = mono.mean(axis=1)
    elif mono.ndim != 1:
        raise ValueError(f"expected 1-D or 2-D audio, got shape {mono.shape}")

    clip_sec = len(mono) / sample_rate
    dur = duration_sec if duration_sec is not None else clip_sec
    dur = float(min(MAX_DURATION_SEC, max(MIN_DURATION_SEC, dur)))
    n = min(len(mono), int(round(dur * sample_rate)))
    mono = mono[:n]

    midi_note = int(note) if note is not None else DEFAULT_NOTE
    if not (0 <= midi_note <= 127):
        raise ValueError(f"note must be a MIDI note number 0..127, got {midi_note}")

    return PreprocessResult(
        audio=mono,
        sample_rate=sample_rate,
        notes=[(midi_note, 0.0, dur)],
        duration_sec=dur,
    )
