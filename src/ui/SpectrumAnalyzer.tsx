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

      ctx.fillStyle = "#0b0d11";
      ctx.fillRect(0, 0, w, h);

      // Grid.
      ctx.strokeStyle = "rgba(120, 140, 170, 0.10)";
      ctx.lineWidth = 1;
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

      // Filled curve with glow.
      ctx.beginPath();
      ctx.moveTo(0, floor);
      for (let i = 0; i < n; i += 1) {
        const x = (i / (n - 1)) * w;
        const magnitude = data[i];
        const y = floor - Math.max(0, Math.min(1, magnitude)) * (h - 8);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, floor);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, "rgba(94, 210, 255, 0.35)");
      fill.addColorStop(1, "rgba(94, 210, 255, 0.04)");
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = (i / (n - 1)) * w;
        const magnitude = data[i];
        const y = floor - Math.max(0, Math.min(1, magnitude)) * (h - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(120, 220, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(94, 210, 255, 0.6)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Scale hints.
      ctx.fillStyle = "rgba(140, 160, 190, 0.35)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("0 dB", 4, 10);
      ctx.fillText("low", 4, h - 4);
      ctx.textAlign = "right";
      ctx.fillText("high", w - 4, h - 4);
      ctx.textAlign = "left";

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [source]);

  return (
    <div className="scope has-tooltip" data-tooltip="The frequency content of the sound, low notes on the left, sparkle on the right.">
      <div className="scope-title">Spectrum</div>
      <canvas ref={canvasRef} className="scope-canvas" />
    </div>
  );
}
