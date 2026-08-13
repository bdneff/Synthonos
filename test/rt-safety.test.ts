/**
 * Real-time safety, asserted on the source. src/dsp/ must import nothing and
 * process() must not allocate, log, throw, or await. A runtime test cannot
 * prove this (the offending path might not execute), so we scan the code.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDspSource, extractProcessBodies } from "./harness/rt-safety";

const DSP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/dsp");

describe("real-time safety scan", () => {
  it("src/dsp has no violations", () => {
    const violations = scanDspSource(DSP_DIR);
    const report = violations
      .map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`)
      .join("\n");
    expect(violations, report).toEqual([]);
  });

  it("catches a deliberately unsafe module (scanner self-test)", () => {
    const dir = mkdtempSync(join(tmpdir(), "synthonos-rt-"));
    try {
      writeFileSync(
        join(dir, "bad.ts"),
        [
          `import { readFileSync } from "node:fs";`,
          `export class Bad {`,
          `  process(out: Float32Array): void {`,
          `    const scratch = new Float32Array(out.length);`,
          `    console.log(readFileSync, scratch);`,
          `    throw new Error("boom");`,
          `  }`,
          `}`,
          ``,
        ].join("\n"),
      );
      const rules = scanDspSource(dir).map((v) => v.rule);
      expect(rules).toContain("only relative src/dsp imports allowed");
      expect(rules).toContain("no console usage");
      expect(rules).toContain("no allocation in process()");
      expect(rules).toContain("no throw in process()");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows relative sibling imports but not escapes or externals", () => {
    const dir = mkdtempSync(join(tmpdir(), "synthonos-rt-"));
    try {
      writeFileSync(
        join(dir, "ok.ts"),
        `import { Osc } from "./osc";\nexport const x = Osc;\n`,
      );
      writeFileSync(join(dir, "osc.ts"), `export const Osc = 1;\n`);
      expect(scanDspSource(dir)).toEqual([]);
      writeFileSync(
        join(dir, "escape.ts"),
        `import { PARAMS } from "./../generated/params";\nexport const y = PARAMS;\n`,
      );
      const rules = scanDspSource(dir).map((v) => v.rule);
      expect(rules).toContain("dsp imports must not reach outside src/dsp");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts process() bodies by brace matching", () => {
    const bodies = extractProcessBodies(
      `class A { process(x: number): void { if (x) { x += 1; } } other() { return 1; } }`,
    );
    expect(bodies.length).toBe(1);
    expect(bodies[0].body).toContain("x += 1");
    expect(bodies[0].body).not.toContain("return 1");
  });
});
