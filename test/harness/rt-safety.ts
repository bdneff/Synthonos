/**
 * Static real-time safety scan of src/dsp/. The audio callback must never
 * allocate, log, throw, await, or touch the outside world, and DSP modules
 * must import nothing at all so they stay mechanically portable to Rust.
 * Asserting on the source catches violations that runtime tests cannot,
 * because a code path that allocates might simply not run during a test.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface SourceViolation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** Rules that apply to every line of every file in src/dsp/. */
const MODULE_RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "no require()", pattern: /\brequire\s*\(/ },
  { rule: "no console usage", pattern: /\bconsole\s*\./ },
  { rule: "no async functions", pattern: /\basync\b/ },
  { rule: "no await", pattern: /\bawait\b/ },
  { rule: "no Promises", pattern: /\bPromise\b/ },
  { rule: "no timers", pattern: /\bset(Timeout|Interval)\s*\(/ },
  { rule: "no DOM access", pattern: /\b(document|window|navigator)\s*[.(]/ },
  { rule: "no fetch", pattern: /\bfetch\s*\(/ },
];

/** Additional rules for the body of process() specifically. */
const PROCESS_RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "no allocation in process()", pattern: /\bnew\b/ },
  { rule: "no array literal allocation in process()", pattern: /=\s*\[\]/ },
  { rule: "no object literal allocation in process()", pattern: /=\s*\{\}/ },
  { rule: "no throw in process()", pattern: /\bthrow\b/ },
  { rule: "no push (allocates) in process()", pattern: /\.push\s*\(/ },
  { rule: "no string building in process()", pattern: /`|\.toString\s*\(|String\s*\(/ },
];

function stripComments(source: string): string {
  // Preserve line count so violation line numbers stay accurate.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/**
 * Extract the body of every method literally named process, by brace
 * matching from its opening brace.
 */
export function extractProcessBodies(source: string): { startLine: number; body: string }[] {
  const bodies: { startLine: number; body: string }[] = [];
  const re = /\bprocess\s*\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const startLine = source.slice(0, open).split("\n").length;
    bodies.push({ startLine, body: source.slice(open + 1, end) });
  }
  return bodies;
}

export function scanDspSource(dspDir: string): SourceViolation[] {
  const violations: SourceViolation[] = [];
  const files = readdirSync(dspDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(dspDir, f))
    .filter((f) => statSync(f).isFile());

  for (const file of files) {
    const source = stripComments(readFileSync(file, "utf8"));
    // Imports: only relative imports of sibling src/dsp modules are allowed.
    // React, npm packages, node builtins, and anything outside src/dsp would
    // break the mechanical-port-to-Rust guarantee.
    for (const m of source.matchAll(
      /import\b[\s\S]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g,
    )) {
      const spec = m[1] ?? m[2] ?? "";
      const line = source.slice(0, m.index).split("\n").length;
      if (!spec.startsWith("./")) {
        violations.push({
          file,
          line,
          rule: "only relative src/dsp imports allowed",
          text: spec,
        });
      } else if (spec.includes("..")) {
        violations.push({
          file,
          line,
          rule: "dsp imports must not reach outside src/dsp",
          text: spec,
        });
      }
    }
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      for (const { rule, pattern } of MODULE_RULES) {
        if (pattern.test(lines[i])) {
          violations.push({ file, line: i + 1, rule, text: lines[i].trim() });
        }
      }
    }
    for (const { startLine, body } of extractProcessBodies(source)) {
      const bodyLines = body.split("\n");
      for (let i = 0; i < bodyLines.length; i += 1) {
        for (const { rule, pattern } of PROCESS_RULES) {
          if (pattern.test(bodyLines[i])) {
            violations.push({
              file,
              line: startLine + i,
              rule,
              text: bodyLines[i].trim(),
            });
          }
        }
      }
    }
  }
  return violations;
}
