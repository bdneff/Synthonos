"""Synthonos audio-to-patch matching service (Phase 2, feature/audio-match).

Tier 2 of SYNTH_BUILD_PLAN.md section 4: differential evolution over the
schema parameter space with a multi-resolution STFT loss, rendering
candidates through the real TypeScript engine via scripts/render-batch.ts.

Tier 1 retrieval and tier 3 learned inverse are stubbed in optimize.py;
Demucs separation and basic-pitch transcription are stubbed in
preprocess.py.
"""

from .bridge import RenderBridge, RenderRequest, RenderResult
from .loss import multi_resolution_stft_loss
from .optimize import MatchResult, match_audio
from .params import ParamSpace
from .preprocess import PreprocessResult, preprocess

__all__ = [
    "MatchResult",
    "ParamSpace",
    "PreprocessResult",
    "RenderBridge",
    "RenderRequest",
    "RenderResult",
    "match_audio",
    "multi_resolution_stft_loss",
    "preprocess",
]
