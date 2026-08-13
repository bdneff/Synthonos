/**
 * Rotary knob. SVG, drag vertically to change, hold Shift for fine
 * control, double-click to reset to default. Honors the schema curve so
 * log parameters (cutoff, envelope times) feel right under the finger.
 *
 * Programmatic changes ANIMATE: when a macro, a preset load, undo, or
 * (later) the natural language layer moves this knob, the pointer sweeps
 * to the new position over ~300 ms. That animation is a core product
 * feature: beginners learn the synth by watching it operate itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  size?: "small" | "large";
}

const ANGLE_MIN = -135;
const ANGLE_MAX = 135;
const ANIMATION_MS = 300;

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

  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);
  const animRef = useRef<number | null>(null);

  const cancelAnimation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
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
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ANIMATION_MS);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      setDisplayNorm(from + (targetNorm - from) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
    return cancelAnimation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNorm]);

  useEffect(() => cancelAnimation, [cancelAnimation]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      cancelAnimation();
      dragRef.current = {
        startY: e.clientY,
        startNorm: normalizeValue(spec, value),
      };
      onGestureStart?.();
    },
    [spec, value, onGestureStart, cancelAnimation],
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

  const view = 100;
  const c = view / 2;
  const r = 38;
  const [px0, py0] = polar(c, c, 16, angle);
  const [px1, py1] = polar(c, c, 31, angle);

  return (
    <div
      className={`knob knob-${size}${tooltip ? " has-tooltip" : ""}`}
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
          <path
            className="knob-track"
            d={arcPath(c, c, r, ANGLE_MIN, ANGLE_MAX)}
          />
          {Math.abs(angle - anchorAngle) > 0.5 ? (
            <path
              className="knob-fill"
              d={arcPath(c, c, r, anchorAngle, angle)}
            />
          ) : null}
          <circle className="knob-body" cx={c} cy={c} r={27} />
          <line
            className="knob-pointer"
            x1={px0}
            y1={py0}
            x2={px1}
            y2={py1}
          />
        </svg>
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value">{readout}</div>
    </div>
  );
}
