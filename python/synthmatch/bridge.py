"""Subprocess bridge to the real TypeScript engine.

Spawns ``npx tsx scripts/render-batch.ts`` (cwd = repo root) once and keeps
it alive, streaming JSON-line render requests in and base64 float32 audio
out. One response line per request line, in order, so a whole
differential-evolution population renders through a single process with no
per-generation Node startup cost.

Any protocol violation, per-render engine error, or process death raises
RuntimeError with the subprocess's stderr attached. Silent failure is not an
option here: a bridge that returns wrong audio would make the optimizer
converge to garbage without any visible error.
"""

from __future__ import annotations

import base64
import json
import subprocess
import threading
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import numpy as np

from .params import find_repo_root


@dataclass(frozen=True)
class RenderRequest:
    """One candidate render: engine-unit params on top of the default patch."""

    id: str
    params: dict[str, float]
    note: int = 60
    duration_sec: float = 1.0
    sample_rate: int = 44100

    def to_json_line(self) -> str:
        return json.dumps(
            {
                "id": self.id,
                "params": self.params,
                "note": self.note,
                "durationSec": self.duration_sec,
                "sampleRate": self.sample_rate,
            }
        )


@dataclass
class RenderResult:
    id: str
    sample_rate: int
    samples: np.ndarray = field(repr=False)  # float32 mono


class RenderBridge:
    """Persistent render subprocess. Use as a context manager or call close()."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = find_repo_root(root)
        script = self.root / "scripts" / "render-batch.ts"
        if not script.is_file():
            raise FileNotFoundError(f"render-batch script not found: {script}")
        self._proc = subprocess.Popen(
            ["npx", "tsx", "scripts/render-batch.ts"],
            cwd=self.root,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._stderr_tail: deque[str] = deque(maxlen=50)
        self._stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._stderr_thread.start()
        self._lock = threading.Lock()
        self.renders_completed = 0

    def _drain_stderr(self) -> None:
        assert self._proc.stderr is not None
        for line in self._proc.stderr:
            self._stderr_tail.append(line.rstrip("\n"))

    def _stderr_context(self) -> str:
        tail = "\n".join(self._stderr_tail)
        return f"; stderr tail:\n{tail}" if tail else " (no stderr output)"

    def _check_alive(self) -> None:
        code = self._proc.poll()
        if code is not None:
            raise RuntimeError(
                f"render-batch subprocess exited with code {code}{self._stderr_context()}"
            )

    def render(self, requests: Iterable[RenderRequest]) -> list[RenderResult]:
        """Render a batch. Returns results in request order. Raises loudly."""
        reqs = list(requests)
        if not reqs:
            return []
        with self._lock:
            self._check_alive()
            assert self._proc.stdin is not None and self._proc.stdout is not None
            payload = "".join(r.to_json_line() + "\n" for r in reqs)

            # Write on a helper thread so a full stdin pipe cannot deadlock
            # against us while we wait to read stdout.
            write_error: list[BaseException] = []

            def _write() -> None:
                try:
                    self._proc.stdin.write(payload)  # type: ignore[union-attr]
                    self._proc.stdin.flush()  # type: ignore[union-attr]
                except BaseException as exc:  # noqa: BLE001 - reported below
                    write_error.append(exc)

            writer = threading.Thread(target=_write, daemon=True)
            writer.start()

            results: list[RenderResult] = []
            for req in reqs:
                line = self._proc.stdout.readline()
                if line == "":
                    self._check_alive()
                    raise RuntimeError(
                        f"render-batch closed stdout after {len(results)} of "
                        f"{len(reqs)} results{self._stderr_context()}"
                    )
                obj = json.loads(line)
                if obj.get("id") != req.id:
                    raise RuntimeError(
                        f"render-batch protocol error: expected id {req.id!r}, "
                        f"got {obj.get('id')!r}{self._stderr_context()}"
                    )
                if "error" in obj:
                    raise RuntimeError(
                        f"render failed for {req.id!r}: {obj['error']}{self._stderr_context()}"
                    )
                raw = base64.b64decode(obj["samples_b64"])
                samples = np.frombuffer(raw, dtype="<f4")
                if not np.all(np.isfinite(samples)):
                    raise RuntimeError(f"render {req.id!r} produced non-finite samples")
                results.append(
                    RenderResult(id=req.id, sample_rate=int(obj["sampleRate"]), samples=samples)
                )
            writer.join(timeout=10)
            if write_error:
                raise RuntimeError(
                    f"failed writing to render-batch stdin: {write_error[0]}{self._stderr_context()}"
                )
            self.renders_completed += len(results)
            return results

    def render_one(self, request: RenderRequest) -> RenderResult:
        return self.render([request])[0]

    @property
    def alive(self) -> bool:
        return self._proc.poll() is None

    def close(self) -> None:
        if self._proc.poll() is None:
            try:
                if self._proc.stdin is not None:
                    self._proc.stdin.close()
                self._proc.wait(timeout=10)
            except Exception:
                self._proc.kill()

    def __enter__(self) -> "RenderBridge":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
