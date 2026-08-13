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

      // Panel well with a faint top-down falloff.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08090c");
      bg.addColorStop(1, "#0b0e11");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Fine grid: eighths vertically, sixteenths horizontally, with
      // brighter quarter lines over them.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(122, 138, 160, 0.05)";
      ctx.beginPath();
      for (let i = 1; i < 8; i += 1) {
        const y = (h * i) / 8;
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      for (let i = 1; i < 16; i += 1) {
        const x = (w * i) / 16;
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(122, 138, 160, 0.1)";
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
      ctx.strokeStyle = "rgba(122, 138, 160, 0.22)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2 + 0.5);
      ctx.lineTo(w, h / 2 + 0.5);
      ctx.stroke();

      // Phosphor trace: soft wide halo pass, then the crisp line.
      const data = source();
      const n = data.length;

      // Idle life: when the signal is silent the trace rests on the axis
      // with a slow breathing glow, so the display looks powered rather
      // than dead. Calm, no motion, no fake waveform.
      let peak = 0;
      for (let i = 0; i < n; i += 1) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
      }
      if (peak < 0.004) {
        const breath = 0.5 + 0.5 * Math.sin(performance.now() / 1400);
        ctx.strokeStyle = `rgba(232, 161, 63, ${0.05 + 0.07 * breath})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, h / 2 + 0.5);
        ctx.lineTo(w, h / 2 + 0.5);
        ctx.stroke();
      }
      const trace = (width: number, style: string, blur: number) => {
        ctx.beginPath();
        for (let i = 0; i < n; i += 1) {
          const x = (i / (n - 1)) * w;
          const sample = Math.max(-1, Math.min(1, data[i]));
          const y = h / 2 - sample * (h / 2 - 5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.shadowColor = "rgba(232, 161, 63, 0.5)";
        ctx.shadowBlur = blur;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      trace(5, "rgba(232, 161, 63, 0.08)", 0);
      trace(1.5, "rgba(245, 188, 107, 0.9)", 7);

      // Amplitude scale in the right margin.
      ctx.fillStyle = "rgba(140, 155, 175, 0.38)";
      ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("+1.0", w - 8, 12);
      ctx.fillText("0.0", w - 8, h / 2 - 5);
      ctx.fillText("-1.0", w - 8, h - 6);
      ctx.textAlign = "left";

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [source]);

  return (
    <div className="scope has-tooltip" data-tooltip="The waveform itself, moment by moment, like a heartbeat monitor for the sound.">
      <span className="scope-label">Waveform</span>
      <canvas ref={canvasRef} className="scope-canvas" />
    </div>
  );
}
