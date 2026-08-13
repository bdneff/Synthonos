/**
 * Bandlimited mipmapped wavetables for the classic waveforms.
 *
 * Why wavetables and not plain PolyBLEP: the harness demands all non-harmonic
 * energy below -60 dBFS across a 20 Hz to 8 kHz sweep. Measured against that
 * harness, 2-point PolyBLEP tops out around -28 dBFS and even a 4-point
 * B-spline BLEP only reaches about -45 dBFS through the midrange, because the
 * polynomial correction's error is broadband. Mipmapped bandlimited tables
 * (the "Serum-class quality" path in docs/SYNTH_REFERENCE.md 5.4) measure
 * below -105 dBFS worst case with Catmull-Rom playback, so that is what the
 * oscillator uses. Same idea, built from the exact Fourier series of each
 * waveform instead of a polynomial patch on the naive one.
 *
 * Tables are sample-rate independent: mip selection is by phase increment
 * dt = f / fs, and each mip is bandlimited for the top of its octave band so
 * no harmonic can cross Nyquist anywhere inside the band. Built once per
 * process and cached at module level; generation is deterministic.
 */

export const TABLE_SIZE = 2048;
export const TABLE_MASK = TABLE_SIZE - 1;

/** dt at the bottom of mip band 0. Bands are octaves: band m covers
 *  dt in [2^m / INV_DT0, 2^(m+1) / INV_DT0). */
export const INV_DT0 = 16384;
export const NUM_MIPS = 13;

/** Highest harmonic stored in mip m: bandlimited for the TOP of band m. */
export function mipMaxHarmonic(m: number): number {
  const h = Math.floor(INV_DT0 / 2 / Math.pow(2, m + 1));
  const cap = TABLE_SIZE / 2 - 1;
  return h < 1 ? 1 : h > cap ? cap : h;
}

/** Mip index for a phase increment (dt = frequency / sampleRate). */
export function mipForDt(dt: number): number {
  if (dt <= 0) return 0;
  const m = Math.floor(Math.log2(dt * INV_DT0));
  return m < 0 ? 0 : m >= NUM_MIPS ? NUM_MIPS - 1 : m;
}

/**
 * Fourier amplitude of harmonic k for waveform index w (mirrors of the schema
 * enum: 0 sine, 1 triangle, 2 saw, 3 square). Returns 0 for absent harmonics.
 * Phases are chosen so each table matches the naive shape convention:
 * saw rises 2t-1, square is +1 for t < 0.5, triangle peaks +1 at t = 0.5.
 * Triangle uses cosines (flagged by the second slot of the returned pair).
 */
function harmonicAmp(w: number, k: number): number {
  if (w === 0) {
    return k === 1 ? 1 : 0;
  }
  if (w === 1) {
    // triangle: odd cosines, -8/(pi^2 k^2)
    return k % 2 === 1 ? -8 / (Math.PI * Math.PI * k * k) : 0;
  }
  if (w === 2) {
    // saw (2t-1): -2/(pi k) sines
    return -2 / (Math.PI * k);
  }
  // square: odd sines, 4/(pi k)
  return k % 2 === 1 ? 4 / (Math.PI * k) : 0;
}

function buildMip(w: number, maxH: number): Float32Array {
  const out = new Float32Array(TABLE_SIZE);
  const useCos = w === 1;
  for (let k = 1; k <= maxH; k += 1) {
    const amp = harmonicAmp(w, k);
    if (amp === 0) continue;
    const step = (2 * Math.PI * k) / TABLE_SIZE;
    for (let i = 0; i < TABLE_SIZE; i += 1) {
      out[i] += amp * (useCos ? Math.cos(step * i) : Math.sin(step * i));
    }
  }
  return out;
}

let cache: Float32Array[][] | null = null;

/**
 * Tables indexed [waveformIndex][mip]. Sine reuses one single-harmonic table
 * for every mip so all four waveforms share one playback path. Mips with the
 * same harmonic count share the same array.
 */
export function getWavetables(): Float32Array[][] {
  if (cache !== null) return cache;
  const all: Float32Array[][] = [];
  for (let w = 0; w < 4; w += 1) {
    const mips: Float32Array[] = [];
    let prevH = -1;
    let prev: Float32Array | null = null;
    for (let m = 0; m < NUM_MIPS; m += 1) {
      const h = w === 0 ? 1 : mipMaxHarmonic(m);
      if (h === prevH && prev !== null) {
        mips.push(prev);
      } else {
        prev = buildMip(w, h);
        prevH = h;
        mips.push(prev);
      }
    }
    all.push(mips);
  }
  cache = all;
  return all;
}

/**
 * 4-point Catmull-Rom read at phase t in [0, 1). Allocation-free; safe for
 * the audio path.
 */
export function readWavetable(tbl: Float32Array, t: number): number {
  const pos = t * TABLE_SIZE;
  const i1 = Math.floor(pos);
  const frac = pos - i1;
  const y0 = tbl[(i1 - 1) & TABLE_MASK];
  const y1 = tbl[i1 & TABLE_MASK];
  const y2 = tbl[(i1 + 1) & TABLE_MASK];
  const y3 = tbl[(i1 + 2) & TABLE_MASK];
  const a = (3 * (y1 - y2) - y0 + y3) * 0.5;
  const b = 2 * y2 + y0 - (5 * y1 + y3) * 0.5;
  const c = (y2 - y0) * 0.5;
  return ((a * frac + b) * frac + c) * frac + y1;
}
