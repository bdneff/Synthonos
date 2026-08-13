/**
 * Time-domain oscilloscope. Data source returns samples in -1..1; with
 * the stub bridge that is a flat line resting calmly on the center axis,
 * which is exactly what silence should look like.
 */

import { useEffect, useRef } from "react";

export interface OscilloscopeProps {
  /** Returns the latest time-domain frame, samples -1..1. */
  source(): Float32Array;
}

export function Oscilloscope({ source }: OscilloscopeProps) {
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

      // Grid: quarters vertically, eighths horizontally.
      ctx.strokeStyle = "rgba(120, 140, 170, 0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 4; i += 1) {
        const y = (h * i) / 4;
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      for (let i = 1; i < 8; i += 1) {
        const x = (w * i) / 8;
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();

      // Center axis, slightly brighter.
      ctx.strokeStyle = "rgba(120, 140, 170, 0.22)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2 + 0.5);
      ctx.lineTo(w, h / 2 + 0.5);
      ctx.stroke();

      const data = source();
      const n = data.length;
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = (i / (n - 1)) * w;
        const sample = Math.max(-1, Math.min(1, data[i]));
        const y = h / 2 - sample * (h / 2 - 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(140, 255, 190, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(140, 255, 190, 0.55)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [source]);

  return (
    <div className="scope has-tooltip" data-tooltip="The waveform itself, moment by moment, like a heartbeat monitor for the sound.">
      <div className="scope-title">Waveform</div>
      <canvas ref={canvasRef} className="scope-canvas" />
    </div>
  );
}
