/**
 * Live magnitude spectrum, styled like a pro plugin analyzer: dark
 * background, faint grid, filled curve with a soft glow. The data source
 * is a callback returning bin magnitudes in 0..1; with the stub bridge it
 * renders a calm idle floor.
 */

import { useEffect, useRef } from "react";

export interface SpectrumAnalyzerProps {
  /** Returns the latest magnitude spectrum, values 0..1 per bin. */
  source(): Float32Array;
}

const DB_LINES = 4;
const FREQ_LINES = 6;

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

      // Panel well with a faint top-down falloff.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08090c");
      bg.addColorStop(1, "#0b0e11");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Fine grid, minor and major lines.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(122, 138, 160, 0.05)";
      ctx.beginPath();
      for (let i = 1; i <= DB_LINES * 2 + 1; i += 1) {
        const y = (h * i) / (DB_LINES * 2 + 2);
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      for (let i = 1; i <= FREQ_LINES * 2 + 1; i += 1) {
        const x = (w * i) / (FREQ_LINES * 2 + 2);
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(122, 138, 160, 0.1)";
      ctx.beginPath();
      for (let i = 1; i <= DB_LINES; i += 1) {
        const y = (h * i) / (DB_LINES + 1);
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      for (let i = 1; i <= FREQ_LINES; i += 1) {
        const x = (w * i) / (FREQ_LINES + 1);
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();

      const data = source();
      const n = data.length;
      const floor = h - 2;

      // Idle life: with no signal the baseline keeps a slow breathing
      // glow, so the analyzer looks powered rather than dead.
      let peak = 0;
      for (let i = 0; i < n; i += 1) {
        if (data[i] > peak) peak = data[i];
      }
      if (peak < 0.01) {
        const breath = 0.5 + 0.5 * Math.sin(performance.now() / 1400);
        ctx.strokeStyle = `rgba(79, 216, 196, ${0.04 + 0.06 * breath})`;
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
        const y = floor - Math.max(0, Math.min(1, magnitude)) * (h - 10);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, floor);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, "rgba(79, 216, 196, 0.32)");
      fill.addColorStop(0.7, "rgba(79, 216, 196, 0.08)");
      fill.addColorStop(1, "rgba(79, 216, 196, 0.02)");
      ctx.fillStyle = fill;
      ctx.fill();

      // Trace: a wide soft halo pass, then the crisp line.
      const trace = (width: number, style: string, blur: number) => {
        ctx.beginPath();
        for (let i = 0; i < n; i += 1) {
          const x = (i / (n - 1)) * w;
          const magnitude = data[i];
          const y = floor - Math.max(0, Math.min(1, magnitude)) * (h - 10);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.shadowColor = "rgba(79, 216, 196, 0.55)";
        ctx.shadowBlur = blur;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      trace(4, "rgba(79, 216, 196, 0.10)", 0);
      trace(1.5, "rgba(134, 232, 217, 0.9)", 7);

      // Scale hints, small caps in the corners.
      ctx.fillStyle = "rgba(140, 155, 175, 0.38)";
      ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("0 DB", w - 8, 12);
      ctx.textAlign = "left";
      ctx.fillText("LOW", 8, h - 6);
      ctx.textAlign = "right";
      ctx.fillText("HIGH", w - 8, h - 6);
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
