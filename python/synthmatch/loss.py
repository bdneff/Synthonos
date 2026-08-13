"""Multi-resolution STFT loss for audio-to-patch matching.

Per SYNTH_BUILD_PLAN.md section 4, tier 2: compare magnitude spectrograms at
FFT sizes 512, 1024, 2048 and 4096 (hop = fft/4, Hann window) and sum the L1
distances. Raw waveform MSE is deliberately avoided: phase differences would
dominate and the optimizer would chase noise.

Each resolution's linear-magnitude L1 term is normalized by the target's
magnitude sum, so the scale is comparable across resolutions and across
targets of different loudness. A log-magnitude L1 term is added per standard
practice; see Yamamoto, Song & Kim, "Parallel WaveGAN: A fast waveform
generation model based on generative adversarial networks with
multi-resolution spectrogram" (ICASSP 2020), whose multi-resolution STFT
auxiliary loss combines a spectral-convergence term with a log-magnitude L1
term. We use the same magnitude/log-magnitude pairing with an L1 spectral
term as the plan specifies.

numpy + scipy only. Framing and rfft are done directly with numpy so the
loss has no dependency on scipy.signal's evolving STFT APIs.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import resample_poly

FFT_SIZES: tuple[int, ...] = (512, 1024, 2048, 4096)
_EPS = 1e-8


def _frame(x: np.ndarray, frame_len: int, hop: int) -> np.ndarray:
    """Slice x into overlapping frames, shape (n_frames, frame_len)."""
    if len(x) < frame_len:
        x = np.pad(x, (0, frame_len - len(x)))
    n_frames = 1 + (len(x) - frame_len) // hop
    strides = (x.strides[0] * hop, x.strides[0])
    return np.lib.stride_tricks.as_strided(
        x, shape=(n_frames, frame_len), strides=strides, writeable=False
    )


def magnitude_spectrogram(x: np.ndarray, fft_size: int) -> np.ndarray:
    """Hann-windowed magnitude spectrogram, hop = fft_size / 4."""
    hop = fft_size // 4
    frames = _frame(np.ascontiguousarray(x, dtype=np.float64), fft_size, hop)
    window = np.hanning(fft_size)
    return np.abs(np.fft.rfft(frames * window, axis=1))


def _match_length(candidate: np.ndarray, target: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = max(len(candidate), len(target))
    if len(candidate) < n:
        candidate = np.pad(candidate, (0, n - len(candidate)))
    if len(target) < n:
        target = np.pad(target, (0, n - len(target)))
    return candidate, target


def resample_to(x: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    """Polyphase resample x from sr_from to sr_to."""
    if sr_from == sr_to:
        return x
    from math import gcd

    g = gcd(sr_from, sr_to)
    return resample_poly(x, sr_to // g, sr_from // g)


def multi_resolution_stft_loss(
    candidate: np.ndarray,
    target: np.ndarray,
    candidate_sr: int | None = None,
    target_sr: int | None = None,
    fft_sizes: tuple[int, ...] = FFT_SIZES,
    log_weight: float = 0.1,
) -> float:
    """Multi-resolution STFT distance between two mono signals.

    Zero if and only if the magnitude spectrograms are identical (in
    particular, loss(x, x) == 0). If sample rates are provided and differ,
    the candidate is resampled to the target's rate. Signals are zero-padded
    to equal length.
    """
    candidate = np.asarray(candidate, dtype=np.float64).ravel()
    target = np.asarray(target, dtype=np.float64).ravel()
    if candidate_sr is not None and target_sr is not None and candidate_sr != target_sr:
        candidate = resample_to(candidate, candidate_sr, target_sr)
    candidate, target = _match_length(candidate, target)

    total = 0.0
    for fft_size in fft_sizes:
        mc = magnitude_spectrogram(candidate, fft_size)
        mt = magnitude_spectrogram(target, fft_size)
        # Linear-magnitude L1, normalized by target energy so each
        # resolution contributes on a comparable scale.
        lin = float(np.abs(mc - mt).sum()) / (float(mt.sum()) + _EPS)
        # Log-magnitude L1 (mean), the Parallel WaveGAN pairing. Weighted
        # down so the linear term dominates but quiet spectral detail still
        # pulls the optimizer.
        log = float(np.abs(np.log(mc + _EPS) - np.log(mt + _EPS)).mean())
        total += lin + log_weight * log
    return total
