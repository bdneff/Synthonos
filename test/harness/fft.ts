/**
 * Hand-written radix-2 FFT for the offline test harness.
 *
 * Deliberately dependency-free: the whole point of the harness is to distrust
 * the DSP code, so the measurement tools must not share code or dependencies
 * with it. Accuracy is verified by the harness self-tests in
 * test/harness-selftest.test.ts.
 */

/** In-place iterative radix-2 Cooley-Tukey FFT. Lengths must be powers of 2. */
export function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n !== imag.length) throw new Error("fft: real/imag length mismatch");
  if (n === 0 || (n & (n - 1)) !== 0) throw new Error("fft: length must be a power of 2");

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k += 1) {
        const evenRe = real[i + k];
        const evenIm = imag[i + k];
        const oddRe = real[i + k + half] * curRe - imag[i + k + half] * curIm;
        const oddIm = real[i + k + half] * curIm + imag[i + k + half] * curRe;
        real[i + k] = evenRe + oddRe;
        imag[i + k] = evenIm + oddIm;
        real[i + k + half] = evenRe - oddRe;
        imag[i + k + half] = evenIm - oddIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Hann window, applied in place. */
export function hannWindow(frame: Float64Array): void {
  const n = frame.length;
  for (let i = 0; i < n; i += 1) {
    frame[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
}

/**
 * Magnitude spectrum of a real signal frame, Hann windowed, normalized so a
 * full-scale (amplitude 1.0) sine that falls exactly on a bin reads 1.0
 * (0 dBFS). Returns length/2 + 1 bins.
 */
export function magnitudeSpectrum(frame: Float32Array | Float64Array): Float64Array {
  const n = frame.length;
  const real = new Float64Array(n);
  for (let i = 0; i < n; i += 1) real[i] = frame[i];
  hannWindow(real);
  const imag = new Float64Array(n);
  fftInPlace(real, imag);
  const half = n / 2;
  const mags = new Float64Array(half + 1);
  // Hann window coherent gain is 0.5. A one-sided sine peak of amplitude A
  // shows up as A * (n/2) * 0.5 in the raw FFT, so normalize by n/4.
  const norm = 4 / n;
  for (let k = 0; k <= half; k += 1) {
    mags[k] = Math.hypot(real[k], imag[k]) * norm;
  }
  return mags;
}

export function db(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-12));
}

/** Frequency in Hz of FFT bin k for the given frame size and sample rate. */
export function binFrequency(k: number, frameSize: number, sampleRate: number): number {
  return (k * sampleRate) / frameSize;
}
