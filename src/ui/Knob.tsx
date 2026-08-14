/**
 * Rotary knob. SVG, drag vertically to change, hold Shift for fine
 * control, double-click to reset to default. Honors the schema curve so
 * log parameters (cutoff, envelope times) feel right under the finger.
 *
 * Programmatic changes ANIMATE: when a macro, a preset load, undo, or
 * the natural language layer moves this knob, the pointer sweeps to the
 * new position over ~300 ms. That animation is a core product feature:
 * beginners learn the synth by watching it operate itself.
 *
 * One knob family across the whole instrument, mounted in three staged
 * sizes: "large" primary macros, "medium" secondary macros, "small"
 * rack knobs. Ivory cap in a machined recess, a single signal-orange
 * index line from center to cap edge (the knob's signature), and
 * silkscreen around it: an engraved tick ring, min and max dots at the
 * ends of the throw, and on the large caps the 0 and 10 dial numerals.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ParamCurve } from "../generated/params";
import { clamp01, denormalizeValue, normalizeValue } from "./param-utils";

export interface KnobSpec {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly curve: ParamCurve;
  /** True for int parameters: values snap to whole numbers. */
  readonly integer: boolean;
}

export interface KnobProps {
  label: string;
  spec: KnobSpec;
  value: number;
  /** Live value change during a drag (or on double-click reset). */
  onChange(value: number): void;
  /** Called when a drag starts (pointer down or just before a reset). */
  onGestureStart?(): void;
  /** Called when the gesture completes; commit one undo entry here. */
  onGestureEnd?(): void;
  /** Formats the readout under the knob. Defaults to two decimals. */
  format?(value: number): string;
  tooltip?: string;
  size?: "small" | "medium" | "large";
}

const ANGLE_MIN = -135;
const ANGLE_MAX = 135;
const ANIMATION_MS = 300;
const GLOW_LINGER_MS = 400;

/** Angle in degrees, 0 at 12 o'clock, clockwise positive. */
function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [lo, hi] = a0 <= a1 ? [a0, a1] : [a1, a0];
  const [x0, y0] = polar(cx, cy, r, lo);
  const [x1, y1] = polar(cx, cy, r, hi);
  const large = hi - lo > 180 ? 1 : 0;
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

export function Knob({
  label,
  spec,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  format,
  tooltip,
  size = "small",
}: KnobProps) {
  const targetNorm = normalizeValue(spec, value);

  const [displayNorm, setDisplayNorm] = useState(targetNorm);
  const displayRef = useRef(displayNorm);
  displayRef.current = displayNorm;

  // True while a programmatic tween is running (plus a short linger), so
  // the arc can turn signal orange while the machine turns the knob.
  const [machineGlow, setMachineGlow] = useState(false);
  const glowTimerRef = useRef<number | null>(null);

  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);
  const animRef = useRef<number | null>(null);

  const cancelAnimation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const clearGlowTimer = useCallback(() => {
    if (glowTimerRef.current !== null) {
      window.clearTimeout(glowTimerRef.current);
      glowTimerRef.current = null;
    }
  }, []);

  // Follow programmatic value changes with a short tween; snap while the
  // user is actively dragging (their finger is the animation).
  useEffect(() => {
    if (dragRef.current !== null) {
      cancelAnimation();
      setDisplayNorm(targetNorm);
      return;
    }
    const from = displayRef.current;
    if (Math.abs(targetNorm - from) < 0.0005) {
      cancelAnimation();
      setDisplayNorm(targetNorm);
      return;
    }
    cancelAnimation();
    clearGlowTimer();
    setMachineGlow(true);
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ANIMATION_MS);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      setDisplayNorm(from + (targetNorm - from) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        glowTimerRef.current = window.setTimeout(() => {
          glowTimerRef.current = null;
          setMachineGlow(false);
        }, GLOW_LINGER_MS);
      }
    };
    animRef.current = requestAnimationFrame(step);
    return cancelAnimation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNorm]);

  useEffect(() => cancelAnimation, [cancelAnimation]);
  useEffect(() => clearGlowTimer, [clearGlowTimer]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      cancelAnimation();
      clearGlowTimer();
      setMachineGlow(false);
      dragRef.current = {
        startY: e.clientY,
        startNorm: normalizeValue(spec, value),
      };
      onGestureStart?.();
    },
    [spec, value, onGestureStart, cancelAnimation, clearGlowTimer],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;
      const pixelsForFullTurn = e.shiftKey ? 1200 : 200;
      const norm = clamp01(
        drag.startNorm + (drag.startY - e.clientY) / pixelsForFullTurn,
      );
      setDisplayNorm(norm);
      onChange(denormalizeValue(spec, norm, spec.integer));
    },
    [spec, onChange],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current === null) return;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onGestureEnd?.();
    },
    [onGestureEnd],
  );

  const handleDoubleClick = useCallback(() => {
    onGestureStart?.();
    onChange(spec.default);
    onGestureEnd?.();
  }, [spec, onChange, onGestureStart, onGestureEnd]);

  const angle = ANGLE_MIN + displayNorm * (ANGLE_MAX - ANGLE_MIN);
  // Bipolar parameters (pan, env amount) fill from 12 o'clock; the rest
  // fill from the left stop.
  const bipolar = spec.min < 0 && spec.max > 0;
  const anchorAngle = bipolar
    ? ANGLE_MIN + normalizeValue(spec, 0) * (ANGLE_MAX - ANGLE_MIN)
    : ANGLE_MIN;

  const displayValue = denormalizeValue(spec, displayNorm, spec.integer);
  const readout = format ? format(displayValue) : displayValue.toFixed(2);

  const defaultNorm = normalizeValue(spec, spec.default);
  const offDefault = Math.abs(targetNorm - defaultNorm) > 0.001;

  const view = 100;
  const c = view / 2;
  const arcRadius = 40;
  // The index line: one crisp stroke from just off center to the cap
  // edge. This full-radius pointer is the knob's signature.
  const [px0, py0] = polar(c, c, 8, angle);
  const [px1, py1] = polar(c, c, 24.6, angle);

  // Unique, url()-safe gradient ids per knob instance.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const capId = `knob-cap-${uid}`;
  const rimId = `knob-rim-${uid}`;
  const wellId = `knob-well-${uid}`;
  const dimpleId = `knob-dimple-${uid}`;

  const tickCount = size === "small" ? 7 : 11;
  const ticks = [];
  for (let i = 0; i < tickCount; i += 1) {
    const tickAngle = ANGLE_MIN + (i / (tickCount - 1)) * (ANGLE_MAX - ANGLE_MIN);
    const [tx0, ty0] = polar(c, c, 45, tickAngle);
    const [tx1, ty1] = polar(c, c, 48.5, tickAngle);
    const major = i === 0 || i === tickCount - 1 || i * 2 === tickCount - 1;
    ticks.push(
      <line
        key={i}
        className={`knob-tick${major ? " major" : ""}`}
        x1={tx0}
        y1={ty0}
        x2={tx1}
        y2={ty1}
      />,
    );
  }

  // Silkscreen min and max dots just past the ends of the throw.
  const [dotMinX, dotMinY] = polar(c, c, 46.5, ANGLE_MIN - 13);
  const [dotMaxX, dotMaxY] = polar(c, c, 46.5, ANGLE_MAX + 13);

  const hotClass = offDefault ? " knob-hot" : "";
  const glowClass = machineGlow ? " knob-glowing" : "";

  return (
    <div
      className={`knob knob-${size}${hotClass}${glowClass}${tooltip ? " has-tooltip" : ""}`}
      data-tooltip={tooltip}
    >
      <div
        className="knob-hit"
        role="slider"
        aria-label={label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={displayValue}
        aria-valuetext={readout}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <svg viewBox={`0 0 ${view} ${view}`} className="knob-svg">
          <defs>
            <radialGradient id={capId} cx="0.36" cy="0.28" r="0.85">
              <stop offset="0%" stopColor="#fbf8f1" />
              <stop offset="55%" stopColor="#eae6dc" />
              <stop offset="100%" stopColor="#d3cfc4" />
            </radialGradient>
            <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(62,57,47,0.5)" />
            </linearGradient>
            <linearGradient id={wellId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5a196" />
              <stop offset="70%" stopColor="#c0bcb1" />
              <stop offset="100%" stopColor="#d7d3c9" />
            </linearGradient>
            <radialGradient id={dimpleId} cx="0.4" cy="0.35" r="1">
              <stop offset="0%" stopColor="#4f4b42" />
              <stop offset="100%" stopColor="#26241e" />
            </radialGradient>
          </defs>
          {ticks}
          <circle className="knob-dot" cx={dotMinX} cy={dotMinY} r={1.6} />
          <circle className="knob-dot" cx={dotMaxX} cy={dotMaxY} r={1.6} />
          {size === "large" ? (
            <>
              <text className="knob-dial-num" x={dotMinX - 8} y={97}>
                0
              </text>
              <text className="knob-dial-num" x={dotMaxX + 8} y={97}>
                10
              </text>
            </>
          ) : null}
          <path
            className="knob-track"
            d={arcPath(c, c, arcRadius, ANGLE_MIN, ANGLE_MAX)}
          />
          {Math.abs(angle - anchorAngle) > 0.5 ? (
            <path
              className="knob-fill"
              d={arcPath(c, c, arcRadius, anchorAngle, angle)}
            />
          ) : null}
          <circle className="knob-well" cx={c} cy={c} r={33} fill={`url(#${wellId})`} />
          <circle cx={c} cy={c} r={26} fill={`url(#${capId})`} />
          <circle
            className="knob-cap-rim"
            cx={c}
            cy={c}
            r={25.5}
            stroke={`url(#${rimId})`}
          />
          <line
            className="knob-pointer"
            x1={px0}
            y1={py0}
            x2={px1}
            y2={py1}
          />
          <circle cx={c} cy={c} r={3.2} fill={`url(#${dimpleId})`} />
        </svg>
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value">{readout}</div>
    </div>
  );
}
