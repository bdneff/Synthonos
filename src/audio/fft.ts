/**
 * Small radix-2 FFT for the spectrum analyzer display.
 *
 * Deliberately a separate implementation from test/harness/fft.ts: the test
 * harness must not share code with the production audio path, so that a bug
 * here cannot hide itself from the tests (docs/TESTING.md). This one is
 * display-only; the harness one is the measurement instrument.
 */

export function magnitudeSpectrumForDisplay(frame: Float32Array): Float32Array {
  // Round down to a power of two.
  let n = 1;
  while (n * 2 <= frame.length) n *= 2;

  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    // Hann window.
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    real[i] = frame[i] * w;
  }

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
        const oddRe = real[i + k + half] * curRe - imag[i + k + half] * curIm;
        const oddIm = real[i + k + half] * curIm + imag[i + k + half] * curRe;
        real[i + k + half] = real[i + k] - oddRe;
        imag[i + k + half] = imag[i + k] - oddIm;
        real[i + k] += oddRe;
        imag[i + k] += oddIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  const half = n / 2;
  const mags = new Float32Array(half);
  const norm = 4 / n; // full-scale on-bin sine reads ~1.0 under Hann
  for (let k = 0; k < half; k += 1) {
    mags[k] = Math.hypot(real[k], imag[k]) * norm;
  }
  return mags;
}
