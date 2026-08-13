"""Multi-resolution STFT loss tests. Pure numpy, no bridge needed."""

from __future__ import annotations

import numpy as np

from synthmatch.loss import multi_resolution_stft_loss

SR = 44100


def sine(freq: float, duration_sec: float = 0.5, sr: int = SR) -> np.ndarray:
    t = np.arange(int(duration_sec * sr)) / sr
    return np.sin(2 * np.pi * freq * t)


def test_identical_signals_have_zero_loss() -> None:
    x = sine(440.0)
    assert multi_resolution_stft_loss(x, x) == 0.0


def test_loss_increases_with_pitch_distance() -> None:
    target = sine(440.0)
    near = multi_resolution_stft_loss(sine(445.0), target)
    far = multi_resolution_stft_loss(sine(880.0), target)
    assert 0.0 < near < far


def test_loss_finite_positive_for_noise_vs_sine() -> None:
    rng = np.random.default_rng(0)
    noise = rng.standard_normal(int(0.5 * SR)) * 0.3
    loss = multi_resolution_stft_loss(noise, sine(440.0))
    assert np.isfinite(loss)
    assert loss > 0.0


def test_loss_is_symmetric_in_length_padding() -> None:
    # Different lengths are zero-padded to the longer one, not an error.
    a = sine(440.0, duration_sec=0.5)
    b = sine(440.0, duration_sec=0.4)
    loss = multi_resolution_stft_loss(a, b)
    assert np.isfinite(loss)
    assert loss > 0.0


def test_resampling_path_produces_small_loss_for_same_tone() -> None:
    a = sine(440.0, sr=48000)
    b = sine(440.0, sr=44100, duration_sec=0.5)
    loss = multi_resolution_stft_loss(a, b, candidate_sr=48000, target_sr=44100)
    # Same tone after resampling should be much closer than an octave error.
    octave = multi_resolution_stft_loss(sine(880.0), sine(440.0))
    assert loss < 0.25 * octave


def test_silence_vs_sine_is_bounded_by_normalization() -> None:
    target = sine(440.0)
    silent = np.zeros_like(target)
    loss = multi_resolution_stft_loss(silent, target)
    assert np.isfinite(loss)
    assert loss > 0.0
