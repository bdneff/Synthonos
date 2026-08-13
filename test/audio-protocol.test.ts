/**
 * The worklet message protocol, driven against the real engine in Node. The
 * AudioWorklet shell itself cannot run outside a browser; everything it does
 * beyond this dispatch is buffer mirroring, verified at integration by hand.
 */

import { describe, it, expect } from "vitest";
import { SynthEngine } from "../src/dsp/engine";
import { dispatchToEngine } from "../src/audio/protocol";
import { DEFAULT_PATCH_PARAMS_ENGINE } from "./harness/patch";
import { rmsDb } from "./harness/fixtures";
import { assertSilent } from "./harness/assertions";

describe("worklet protocol", () => {
  it("param, noteOn, and noteOff messages drive the engine", () => {
    const engine = new SynthEngine(48000);
    for (const [id, v] of Object.entries(DEFAULT_PATCH_PARAMS_ENGINE)) {
      dispatchToEngine(engine, { t: "param", id, v });
    }
    dispatchToEngine(engine, { t: "param", id: "filter_cutoff", v: 5000 });
    expect(engine.getParam("filter_cutoff")).toBe(5000);

    const left = new Float32Array(128);
    const right = new Float32Array(128);
    const render = (blocks: number, into?: Float32Array) => {
      for (let b = 0; b < blocks; b += 1) {
        engine.process(left, right);
        into?.set(left.subarray(0, 128), 0);
      }
    };

    // Exact silence before any note.
    render(4);
    assertSilent(left, "pre-note");

    dispatchToEngine(engine, { t: "on", n: 60, v: 1 });
    const held = new Float32Array(128);
    render(200, held); // ~0.5 s, well past the attack
    expect(rmsDb(held, 0, held.length)).toBeGreaterThan(-40);

    dispatchToEngine(engine, { t: "off", n: 60 });
    render(400); // ~1 s, past release and voice kill
    assertSilent(left, "post-release");
  });
});
