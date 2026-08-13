/**
 * "Match a sound": upload a short clip, watch the search converge, land the
 * best patch into the synth as one undoable preset load. Talks to the local
 * python/synthmatch service through src/ui/match.ts.
 *
 * Honest framing everywhere: the result is the closest sound this engine
 * can make, a starting point, not a copy.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSynth } from "./store";
import {
  MatchError,
  checkHealth,
  matchServiceUrl,
  matchStream,
} from "./match";
import type { MatchProgress } from "./match";
import "./match.css";

const HEALTH_POLL_MS = 3000;

/** C1..C6 in the C3=48 convention the matcher uses. */
const NOTE_OPTIONS: ReadonlyArray<{ label: string; midi: number }> = [
  { label: "C1", midi: 24 },
  { label: "C2", midi: 36 },
  { label: "C3", midi: 48 },
  { label: "C4", midi: 60 },
  { label: "C5", midi: 72 },
  { label: "C6", midi: 84 },
];

type Phase = "idle" | "searching" | "done" | "error";

function drawSparkline(canvas: HTMLCanvasElement, losses: readonly number[]) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (losses.length === 0) return;

  let min = Infinity;
  let max = -Infinity;
  for (const v of losses) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const pad = 4;
  const innerH = height - pad * 2;
  const x = (i: number) =>
    losses.length === 1
      ? width - pad
      : pad + (i / (losses.length - 1)) * (width - pad * 2);
  // Loss falls as the search improves; map lower loss lower on the strip so
  // the line visibly descends toward the floor.
  const yOf = (v: number) =>
    span <= 0 ? height / 2 : pad + ((v - min) / span) * innerH;

  ctx.strokeStyle = "#4fd8c4";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(79, 216, 196, 0.4)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  losses.forEach((v, i) => {
    if (i === 0) ctx.moveTo(x(i), yOf(v));
    else ctx.lineTo(x(i), yOf(v));
  });
  ctx.stroke();
  // A small marker on the latest point.
  const last = losses.length - 1;
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#86e8d9";
  ctx.beginPath();
  ctx.arc(x(last), yOf(losses[last]), 2, 0, Math.PI * 2);
  ctx.fill();
}

export function MatchPanel() {
  const store = useSynth();
  const [serviceUp, setServiceUp] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(48);
  const [progress, setProgress] = useState<MatchProgress | null>(null);
  const [losses, setLosses] = useState<readonly number[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Health probe on an interval, paused while a search runs.
  useEffect(() => {
    if (phase === "searching") return;
    let cancelled = false;
    const probe = () => {
      void checkHealth(matchServiceUrl()).then((up) => {
        if (!cancelled) setServiceUp(up);
      });
    };
    probe();
    const id = window.setInterval(probe, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [phase]);

  // Abort a running search if the panel unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Redraw the sparkline whenever a generation lands.
  useEffect(() => {
    if (phase !== "searching") return;
    const canvas = canvasRef.current;
    if (canvas !== null) drawSparkline(canvas, losses);
  }, [phase, losses]);

  const startMatch = useCallback(() => {
    if (file === null || phase === "searching") return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLosses([]);
    setProgress(null);
    setPhase("searching");
    void (async () => {
      try {
        const outcome = await matchStream({
          file,
          filename: file.name,
          note,
          baseUrl: matchServiceUrl(),
          signal: controller.signal,
          onProgress: (p) => {
            setProgress(p);
            setLosses((prev) => [...prev, p.bestLoss]);
          },
        });
        // One preset load = one undo step back to the previous patch.
        const issues = store.loadPreset(`Matched: ${file.name}`, outcome.params);
        if (issues.length > 0) {
          setErrorMsg("The matched patch failed validation. Nothing was changed.");
          setPhase("error");
          return;
        }
        setPhase("done");
      } catch (err) {
        if (controller.signal.aborted) {
          setPhase("idle");
          return;
        }
        setErrorMsg(
          err instanceof MatchError
            ? err.message
            : "The match could not be completed. Check the analysis service and try again.",
        );
        setPhase("error");
      } finally {
        abortRef.current = null;
      }
    })();
  }, [file, phase, note, store]);

  const cancelMatch = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setErrorMsg("");
  }, []);

  // The done and error notices survive a service drop; only the idle state
  // swaps to the start-the-service hint.
  const offline = !serviceUp && phase === "idle";

  return (
    <section className="match-panel panel" aria-label="Match a sound">
      <div className="panel-title match-title">
        <span className="match-tick" aria-hidden="true" />
        Match a sound
      </div>

      {offline ? (
        <div className="match-body">
          <p className="match-hint">
            Start the analysis service to match sounds from audio
          </p>
          <code className="match-cmd">cd python && uvicorn synthmatch.service:app</code>
        </div>
      ) : phase === "searching" ? (
        <div className="match-body">
          <canvas ref={canvasRef} className="match-scope" />
          <div className="match-readout">
            {progress === null
              ? "preparing the search"
              : `generation ${progress.generation + 1}, distance ${progress.bestLoss.toFixed(3)}`}
          </div>
          <div className="match-row">
            <button type="button" className="button" onClick={cancelMatch}>
              Cancel
            </button>
          </div>
        </div>
      ) : phase === "done" ? (
        <div className="match-body">
          <p className="match-hint">
            This is the closest sound this engine can make, a starting point,
            not a copy. Describe what to change.
          </p>
          <div className="match-row">
            <button type="button" className="button" onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      ) : phase === "error" ? (
        <div className="match-body">
          <p className="match-hint match-error">{errorMsg}</p>
          <div className="match-row">
            <button type="button" className="button" onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="match-body">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,audio/wav"
            className="match-file-input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="button match-file-button"
            onClick={() => fileInputRef.current?.click()}
            title="Pick a short WAV clip of the sound to match"
          >
            {file === null ? "Choose a .wav file" : file.name}
          </button>
          <div className="match-row">
            <label className="match-note-label">
              note
              <select
                className="match-note-select"
                value={note}
                onChange={(e) => setNote(Number(e.target.value))}
                title="The pitch the clip plays. C3 if you are not sure."
              >
                {NOTE_OPTIONS.map((opt) => (
                  <option key={opt.midi} value={opt.midi}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button primary match-go"
              disabled={file === null}
              onClick={startMatch}
            >
              Match
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
