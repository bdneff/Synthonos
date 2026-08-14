/**
 * Live magnitude spectrum drawn on the left side of the shared display
 * strip. The canvas paints no background of its own: the screen surface
 * belongs to the display deck, and this component draws the grid, the
 * printed scale (dB down the left edge, Hz decades along the bottom),
 * the calibration fine print, and the trace. The trace carries law 1 of
 * the visual world: frequency is color, low red through mid green to
 * high blue, because here the x axis IS frequency, so the gradient is
 * information, not decoration. Data source returns bin magnitudes in
 * 0..1; with the stub bridge it renders a calm idle floor.
 */

import { useEffect, useRef } from "react";

export interface SpectrumAnalyzerProps {
  /** Returns the latest magnitude spectrum, values 0..1 per bin. */
  source(): Float32Array;
  /** Returns the engine's real sample rate in Hz (from the context). */
  sampleRate(): number;
}

/** dB lines silkscreened on the glass: 0 at the top of the plot. */
const DB_MARKS = [0, -12, -24, -36] as const;
const DB_RANGE = 48;

/**
 * Hz decade marks on a 20 Hz .. 20 kHz log axis:
 * position = log10(f / 20) / log10(20000 / 20).
 */
const HZ_MARKS: ReadonlyArray<{ label: string; frac: number }> = [
  { label: "100", frac: Math.log10(100 / 20) / 3 },
  { label: "1K", frac: Math.log10(1000 / 20) / 3 },
  { label: "10K", frac: Math.log10(10000 / 20) / 3 },
];

const SILK = "rgba(234, 232, 225, 0.5)";
const SILK_DIM = "rgba(234, 232, 225, 0.32)";
const GRID = "rgba(234, 232, 225, 0.06)";
const GRID_FAINT = "rgba(234, 232, 225, 0.03)";

/**
 * The tri-band gradient across the log frequency axis. Band edges sit
 * at 250 Hz and 4 kHz (the mix engineer's low / mid / high), blended
 * so the trace reads as one voice, not three segments.
 */
function triBandGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  alpha: number,
): CanvasGradient {
  const lowEdge = Math.log10(250 / 20) / 3;
  const highEdge = Math.log10(4000 / 20) / 3;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, `rgba(239, 74, 62, ${alpha})`);
  g.addColorStop(Math.max(0, lowEdge - 0.09), `rgba(239, 74, 62, ${alpha})`);
  g.addColorStop(lowEdge + 0.09, `rgba(85, 194, 106, ${alpha})`);
  g.addColorStop(Math.max(0, highEdge - 0.09), `rgba(85, 194, 106, ${alpha})`);
  g.addColorStop(Math.min(1, highEdge + 0.09), `rgba(79, 149, 232, ${alpha})`);
  g.addColorStop(1, `rgba(79, 149, 232, ${alpha})`);
  return g;
}

export function SpectrumAnalyzer({ source, sampleRate }: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Plot area: the 0 dB line clears the SPECTRUM label at the top;
      // room for the Hz scale under the floor.
      const plotTop = 27;
      const floor = h - 15;
      const plotH = floor - plotTop;

      // Grid, aligned to the real scale marks.
      ctx.lineWidth = 1;
      ctx.strokeStyle = GRID_FAINT;
      ctx.beginPath();
      for (let db = -6; db > -DB_RANGE; db -= 12) {
        const y = plotTop + (-db / DB_RANGE) * plotH;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      for (const db of DB_MARKS) {
        const y = plotTop + (-db / DB_RANGE) * plotH;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      for (const mark of HZ_MARKS) {
        const x = Math.round(mark.frac * w) + 0.5;
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, floor);
      }
      ctx.stroke();

      const data = source();
      const n = data.length;

      // Idle life: with no signal the baseline keeps a slow breathing
      // glow, so the analyzer looks powered rather than dead.
      let peak = 0;
      for (let i = 0; i < n; i += 1) {
        if (data[i] > peak) peak = data[i];
      }
      if (peak < 0.01) {
        const breath = 0.5 + 0.5 * Math.sin(performance.now() / 1400);
        ctx.strokeStyle = triBandGradient(ctx, w, 0.05 + 0.07 * breath);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, floor - 1);
        ctx.lineTo(w, floor - 1);
        ctx.stroke();
      }

      // The meter honors its own silkscreen: linear bins are mapped
      // onto the printed log-Hz axis (20 Hz .. 20 kHz), peak-held per
      // pixel column, and magnitudes go through 20*log10 against the
      // printed 48 dB window. A flagship's meter never lies about its
      // own scale, and the bin width comes from the context's real
      // rate, never an assumed one.
      const binHz = sampleRate() / 2 / (n - 1);
      const step = 2;
      const points: Array<[number, number]> = [];
      for (let px = 0; px <= w; px += step) {
        const f0 = 20 * Math.pow(10, (3 * px) / w);
        const f1 = 20 * Math.pow(10, (3 * Math.min(px + step, w)) / w);
        const lo = Math.max(0, Math.floor(f0 / binHz));
        const hi = Math.min(n - 1, Math.max(lo, Math.ceil(f1 / binHz)));
        let mag = 0;
        for (let b = lo; b <= hi; b += 1) {
          if (data[b] > mag) mag = data[b];
        }
        const db = mag > 0 ? 20 * Math.log10(mag) : -DB_RANGE;
        const frac = Math.max(0, Math.min(1, -db / DB_RANGE));
        points.push([px, plotTop + frac * plotH]);
      }

      // Filled curve, fading downward under the tri-band trace.
      ctx.beginPath();
      ctx.moveTo(0, floor);
      for (const [x, y] of points) ctx.lineTo(x, y);
      ctx.lineTo(w, floor);
      ctx.closePath();
      ctx.fillStyle = triBandGradient(ctx, w, 0.12);
      ctx.fill();

      // Trace: a wide soft halo pass, then the crisp tri-band line.
      const trace = (width: number, alpha: number, blur: number) => {
        ctx.beginPath();
        for (let i = 0; i < points.length; i += 1) {
          const [x, y] = points[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = triBandGradient(ctx, w, alpha);
        ctx.lineWidth = width;
        ctx.shadowColor = "rgba(234, 232, 225, 0.5)";
        ctx.shadowBlur = blur;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      trace(4, 0.1, 0);
      trace(1.5, 0.95, 5);

      // Silkscreened scales on the glass. dB down the left edge.
      ctx.font = "500 8.5px 'Spline Sans Mono', monospace";
      ctx.fillStyle = SILK;
      ctx.strokeStyle = SILK_DIM;
      ctx.lineWidth = 1;
      ctx.textAlign = "left";
      ctx.beginPath();
      for (const db of DB_MARKS) {
        const y = plotTop + (-db / DB_RANGE) * plotH;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(4, Math.round(y) + 0.5);
        ctx.fillText(db === 0 ? "0 dB" : String(db), 7, y + 3);
      }
      ctx.stroke();

      // Hz decades along the bottom.
      ctx.textAlign = "center";
      ctx.beginPath();
      for (const mark of HZ_MARKS) {
        const x = Math.round(mark.frac * w) + 0.5;
        ctx.moveTo(x, floor);
        ctx.lineTo(x, floor + 4);
        ctx.fillText(mark.label, x, h - 3);
      }
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = SILK_DIM;
      ctx.font = "500 7.5px 'Spline Sans Mono', monospace";
      ctx.fillText("Hz", 6, h - 3);

      // Calibration fine print, top right corner of the glass.
      ctx.textAlign = "right";
      ctx.fillText("REF 0 dBFS · LOG", w - 8, 11);
      ctx.textAlign = "left";

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [source]);

  return (
    <div className="scope has-tooltip" data-tooltip="The frequency content of the sound, low notes on the left, sparkle on the right.">
      <span className="scope-label">Spectrum</span>
      <canvas ref={canvasRef} className="scope-canvas" />
    </div>
  );
}
