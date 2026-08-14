/**
 * Live magnitude spectrum drawn on the left side of the shared
 * instrument glass. The canvas paints no background of its own: the
 * glass surface belongs to the display deck, and this component draws
 * the grid, the silkscreened scale (dB down the left edge, Hz decades
 * along the bottom), the calibration fine print, and the amber phosphor
 * trace. The data source is a callback returning bin magnitudes in
 * 0..1; with the stub bridge it renders a calm idle floor.
 */

import { useEffect, useRef } from "react";

export interface SpectrumAnalyzerProps {
  /** Returns the latest magnitude spectrum, values 0..1 per bin. */
  source(): Float32Array;
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

const SILK = "rgba(214, 206, 188, 0.48)";
const SILK_DIM = "rgba(214, 206, 188, 0.3)";
const GRID = "rgba(226, 220, 205, 0.055)";
const GRID_FAINT = "rgba(226, 220, 205, 0.03)";

export function SpectrumAnalyzer({ source }: SpectrumAnalyzerProps) {
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

      // Plot area: the 0 dB line clears the SPECTRUM silkscreen at the
      // top; room for the Hz scale under the floor.
      const plotTop = 19;
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
        ctx.strokeStyle = `rgba(255, 179, 92, ${0.04 + 0.06 * breath})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, floor - 1);
        ctx.lineTo(w, floor - 1);
        ctx.stroke();
      }

      // Filled curve.
      ctx.beginPath();
      ctx.moveTo(0, floor);
      for (let i = 0; i < n; i += 1) {
        const x = (i / (n - 1)) * w;
        const magnitude = data[i];
        const y = floor - Math.max(0, Math.min(1, magnitude)) * plotH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, floor);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, "rgba(255, 179, 92, 0.2)");
      fill.addColorStop(0.7, "rgba(255, 179, 92, 0.05)");
      fill.addColorStop(1, "rgba(255, 179, 92, 0.012)");
      ctx.fillStyle = fill;
      ctx.fill();

      // Trace: a wide soft halo pass, then the crisp line.
      const trace = (width: number, style: string, blur: number) => {
        ctx.beginPath();
        for (let i = 0; i < n; i += 1) {
          const x = (i / (n - 1)) * w;
          const magnitude = data[i];
          const y = floor - Math.max(0, Math.min(1, magnitude)) * plotH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.shadowColor = "rgba(255, 179, 92, 0.5)";
        ctx.shadowBlur = blur;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      trace(4, "rgba(255, 179, 92, 0.08)", 0);
      trace(1.5, "rgba(255, 179, 92, 0.92)", 7);

      // Silkscreened scales on the glass. dB down the left edge.
      ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
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
      ctx.font = "500 7.5px 'IBM Plex Mono', monospace";
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
