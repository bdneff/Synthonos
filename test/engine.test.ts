/**
 * M0 engine contract: the empty engine accepts the full parameter surface and
 * note events, and its output is exact digital silence with no NaNs, no
 * denormals, no DC, and no clicks. As synthesis lands in Phase 1 these tests
 * are extended, never removed.
 */

import { describe, it } from "vitest";
import { renderOffline } from "./harness/render";
import {
  assertSilent,
  assertFinite,
  assertNoDenormals,
  assertDcOffsetBelow,
  assertNoClicks,
} from "./harness/assertions";
import { compareToGolden } from "./harness/golden";

describe("engine (M0 stub)", () => {
  it("outputs exact silence when no note is playing", () => {
    const { left, right } = renderOffline({ durationSec: 1 });
    assertSilent(left, "left");
    assertSilent(right, "right");
  });

  it("stays finite, denormal-free, DC-free, and click-free across note events", () => {
    const { left, right } = renderOffline({
      durationSec: 1,
      events: [
        { timeSec: 0.1, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.5, type: "off", note: 60 },
        { timeSec: 0.6, type: "on", note: 67, velocity: 0.5 },
        { timeSec: 0.9, type: "off", note: 67 },
      ],
    });
    for (const [buf, label] of [
      [left, "left"],
      [right, "right"],
    ] as const) {
      assertFinite(buf, label);
      assertNoDenormals(buf, label);
      assertDcOffsetBelow(buf, 0.01, label);
      assertNoClicks(buf, 0.25, label);
    }
  });

  it("renders at a non-44100 sample rate without assuming otherwise", () => {
    const { left, sampleRate } = renderOffline({
      durationSec: 0.25,
      sampleRate: 96000,
    });
    if (sampleRate !== 96000) throw new Error("sample rate not respected");
    if (left.length !== 24000) throw new Error("frame count wrong for 96 kHz");
    assertFinite(left);
  });

  it("matches the golden render for the Init preset", () => {
    const audio = renderOffline({
      durationSec: 0.5,
      events: [
        { timeSec: 0.05, type: "on", note: 60, velocity: 1 },
        { timeSec: 0.35, type: "off", note: 60 },
      ],
    });
    compareToGolden("init-preset", audio);
  });
});
