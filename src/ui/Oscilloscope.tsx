/**
 * Time-domain oscilloscope on the right side of the shared instrument
 * glass. Paints no background of its own; draws the graticule, the
 * silkscreened +1 / 0 / -1 amplitude scale, sweep-rate fine print, and
 * the amber phosphor trace. Data source returns samples in -1..1; with
 * the stub bridge that is a flat line resting calmly on the center
 * axis, which is exactly what silence should look like.
 */

import { useEffect, useRef } from "react";

export interface OscilloscopeProps {
  /** Returns the latest time-domain frame, samples -1..1. */
  source(): Float32Array;
}

const SILK = "rgba(214, 206, 188, 0.48)";
const SILK_DIM = "rgba(214, 206, 188, 0.3)";
const GRID = "rgba(226, 220, 205, 0.055)";
const GRID_FAINT = "rgba(226, 220, 205, 0.03)";

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
      ctx.clearRect(0, 0, w, h);

      const plotTop = 8;
      const plotBottom = h - 15;
      const mid = (plotTop + plotBottom) / 2;
      const amp = (plotBottom - plotTop) / 2;

      // Graticule.
      ctx.lineWidth = 1;
      ctx.strokeStyle = GRID_FAINT;
      ctx.beginPath();
      for (let i = 1; i < 8; i += 1) {
        const y = plotTop + ((plotBottom - plotTop) * i) / 8;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      for (let i = 1; i < 12; i += 1) {
        const x = (w * i) / 12;
        ctx.moveTo(Math.round(x) + 0.5, plotTop);
        ctx.lineTo(Math.round(x) + 0.5, plotBottom);
      }
      ctx.stroke();
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      for (const f of [0, 0.5, 1]) {
        const y = plotTop + (plotBottom - plotTop) * f;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();

      // Center axis, slightly brighter.
      ctx.strokeStyle = "rgba(226, 220, 205, 0.12)";
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(w, Math.round(mid) + 0.5);
      ctx.stroke();

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
        ctx.strokeStyle = `rgba(255, 179, 92, ${0.05 + 0.07 * breath})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, mid + 0.5);
        ctx.lineTo(w, mid + 0.5);
        ctx.stroke();
      }

      // Phosphor trace: soft wide halo pass, then the crisp line.
      const trace = (width: number, style: string, blur: number) => {
        ctx.beginPath();
        for (let i = 0; i < n; i += 1) {
          const x = (i / (n - 1)) * w;
          const sample = Math.max(-1, Math.min(1, data[i]));
          const y = mid - sample * (amp - 2);
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
      trace(5, "rgba(255, 179, 92, 0.08)", 0);
      trace(1.5, "rgba(255, 179, 92, 0.92)", 7);

      // Silkscreened amplitude scale on the right edge of the glass.
      ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
      ctx.fillStyle = SILK;
      ctx.strokeStyle = SILK_DIM;
      ctx.lineWidth = 1;
      ctx.textAlign = "right";
      ctx.beginPath();
      for (const [f, label] of [
        [0, "+1"],
        [0.5, "0"],
        [1, "-1"],
      ] as const) {
        const y = plotTop + (plotBottom - plotTop) * f;
        ctx.moveTo(w - 4, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.fillText(label, w - 7, y + 3);
      }
      ctx.stroke();

      // Calibration fine print, bottom left corner.
      ctx.textAlign = "left";
      ctx.fillStyle = SILK_DIM;
      ctx.font = "500 7.5px 'IBM Plex Mono', monospace";
      ctx.fillText("5 ms/DIV · AC", 6, h - 3);

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
