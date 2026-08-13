/**
 * Codegen: params.schema.json is the single source of truth for every synth
 * parameter. This script emits everything downstream of it:
 *
 *   1. src/generated/params.ts        TypeScript types, metadata table, validator
 *   2. src/generated/default-preset.json
 *   3. src/generated/ui-manifest.json UI control list, grouped, with tooltips
 *   4. src/generated/llm-schema.json  JSON Schema handed to Claude for NL control
 *   5. src/generated/optimizer-bounds.json  bounds vector for the audio matcher
 *
 * Run:   npm run codegen          (writes files)
 *        npm run codegen:check    (fails if any generated file is out of date)
 *
 * If a parameter exists in five places, parallel agents will drift. Generate
 * everything. CI runs the check on every push.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = resolve(ROOT, "params.schema.json");
const OUT_DIR = resolve(ROOT, "src/generated");

interface SchemaEntry {
  label: string;
  group: string;
  type: "float" | "int" | "enum";
  values?: string[];
  min: number;
  max: number;
  default: number;
  curve: "linear" | "log";
  unit: string;
  nl_aliases: string[];
  nl_direction: string;
}

interface Schema {
  params: Record<string, SchemaEntry>;
}

const HEADER =
  "GENERATED FILE. Do not edit by hand.\n" +
  "Source of truth: params.schema.json. Regenerate with: npm run codegen";

function fail(msg: string): never {
  console.error(`codegen: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load and sanity check the schema. A bad schema entry should fail loudly
// here, not surface later as a knob with an impossible range.
// ---------------------------------------------------------------------------

function loadSchema(): Schema {
  const raw = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Schema;
  if (!raw.params || typeof raw.params !== "object") {
    fail("schema has no `params` object");
  }
  for (const [id, p] of Object.entries(raw.params)) {
    const where = `param "${id}"`;
    if (!/^[a-z][a-z0-9_]*$/.test(id)) fail(`${where}: id must be snake_case`);
    for (const field of [
      "label",
      "group",
      "type",
      "min",
      "max",
      "default",
      "curve",
      "unit",
      "nl_aliases",
      "nl_direction",
    ] as const) {
      if (p[field] === undefined) fail(`${where}: missing field "${field}"`);
    }
    if (!["float", "int", "enum"].includes(p.type)) fail(`${where}: bad type`);
    if (!["linear", "log"].includes(p.curve)) fail(`${where}: bad curve`);
    if (!(p.min < p.max)) fail(`${where}: min must be < max`);
    if (p.default < p.min || p.default > p.max) {
      fail(`${where}: default ${p.default} outside [${p.min}, ${p.max}]`);
    }
    if (p.curve === "log" && p.min <= 0) {
      fail(`${where}: log curve requires min > 0`);
    }
    if (p.type === "enum") {
      if (!Array.isArray(p.values) || p.values.length < 2) {
        fail(`${where}: enum needs a values array of length >= 2`);
      }
      if (p.min !== 0 || p.max !== p.values.length - 1) {
        fail(`${where}: enum min/max must be 0 and values.length - 1`);
      }
      if (!Number.isInteger(p.default)) fail(`${where}: enum default must be an index`);
    }
    if (p.type === "int" || p.type === "enum") {
      for (const v of [p.min, p.max, p.default]) {
        if (!Number.isInteger(v)) fail(`${where}: ${p.type} bounds must be integers`);
      }
    }
    if (p.nl_aliases.length === 0) fail(`${where}: nl_aliases must not be empty`);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Emitters. Each returns the full text of one generated file.
// ---------------------------------------------------------------------------

function jsonFile(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function emitParamsTs(schema: Schema): string {
  const ids = Object.keys(schema.params);
  const lines: string[] = [];
  lines.push("/**");
  for (const h of HEADER.split("\n")) lines.push(` * ${h}`);
  lines.push(" */");
  lines.push("");
  lines.push("/* eslint-disable */");
  lines.push("");
  lines.push(`export type ParamId =`);
  for (const id of ids) lines.push(`  | ${JSON.stringify(id)}`);
  lines.push(`;`);
  lines.push("");
  lines.push(`export type ParamType = "float" | "int" | "enum";`);
  lines.push(`export type ParamCurve = "linear" | "log";`);
  lines.push("");
  lines.push(`export interface ParamMeta {`);
  lines.push(`  readonly id: ParamId;`);
  lines.push(`  readonly label: string;`);
  lines.push(`  readonly group: string;`);
  lines.push(`  readonly type: ParamType;`);
  lines.push(`  /** Present only for enum params: the ordered option names. */`);
  lines.push(`  readonly values?: readonly string[];`);
  lines.push(`  readonly min: number;`);
  lines.push(`  readonly max: number;`);
  lines.push(`  readonly default: number;`);
  lines.push(`  readonly curve: ParamCurve;`);
  lines.push(`  readonly unit: string;`);
  lines.push(`  readonly nlAliases: readonly string[];`);
  lines.push(`  readonly nlDirection: string;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export const PARAM_IDS = [`);
  for (const id of ids) lines.push(`  ${JSON.stringify(id)},`);
  lines.push(`] as const;`);
  lines.push("");
  lines.push(`export const PARAMS: Readonly<Record<ParamId, ParamMeta>> = {`);
  for (const id of ids) {
    const p = schema.params[id]!;
    const fields: string[] = [
      `id: ${JSON.stringify(id)}`,
      `label: ${JSON.stringify(p.label)}`,
      `group: ${JSON.stringify(p.group)}`,
      `type: ${JSON.stringify(p.type)}`,
    ];
    if (p.type === "enum") {
      fields.push(`values: ${JSON.stringify(p.values)}`);
    }
    fields.push(
      `min: ${p.min}`,
      `max: ${p.max}`,
      `default: ${p.default}`,
      `curve: ${JSON.stringify(p.curve)}`,
      `unit: ${JSON.stringify(p.unit)}`,
      `nlAliases: ${JSON.stringify(p.nl_aliases)}`,
      `nlDirection: ${JSON.stringify(p.nl_direction)}`,
    );
    lines.push(`  ${JSON.stringify(id)}: { ${fields.join(", ")} },`);
  }
  lines.push(`};`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Preset file value: numbers for float/int params, option name strings`);
  lines.push(` * for enum params. The engine itself only ever sees numbers; use`);
  lines.push(` * toEngineValue to convert.`);
  lines.push(` */`);
  lines.push(`export type ParamValue = number | string;`);
  lines.push("");
  lines.push(`export interface Patch {`);
  lines.push(`  name: string;`);
  lines.push(`  params: Record<ParamId, ParamValue>;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`/** A partial edit, e.g. the result of a natural language request. */`);
  lines.push(`export type PatchEdit = Partial<Record<ParamId, ParamValue>>;`);
  lines.push("");
  lines.push(`export interface ValidationIssue {`);
  lines.push(`  param: string;`);
  lines.push(`  message: string;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Validate a patch params object. Out of bounds values are REJECTED,`);
  lines.push(` * never clamped silently. mode "full" requires every parameter to be`);
  lines.push(` * present; mode "partial" allows any subset (used for NL edits).`);
  lines.push(` */`);
  lines.push(`export function validatePatchParams(`);
  lines.push(`  params: unknown,`);
  lines.push(`  mode: "full" | "partial",`);
  lines.push(`): ValidationIssue[] {`);
  lines.push(`  const issues: ValidationIssue[] = [];`);
  lines.push(`  if (typeof params !== "object" || params === null || Array.isArray(params)) {`);
  lines.push(`    return [{ param: "", message: "params must be a plain object" }];`);
  lines.push(`  }`);
  lines.push(`  const rec = params as Record<string, unknown>;`);
  lines.push(`  const known = new Set<string>(PARAM_IDS);`);
  lines.push(`  for (const key of Object.keys(rec)) {`);
  lines.push(`    if (!known.has(key)) issues.push({ param: key, message: "unknown parameter" });`);
  lines.push(`  }`);
  lines.push(`  for (const id of PARAM_IDS) {`);
  lines.push(`    const meta = PARAMS[id];`);
  lines.push(`    if (!Object.prototype.hasOwnProperty.call(rec, id)) {`);
  lines.push(`      if (mode === "full") issues.push({ param: id, message: "missing parameter" });`);
  lines.push(`      continue;`);
  lines.push(`    }`);
  lines.push(`    const v = rec[id];`);
  lines.push(`    if (meta.type === "enum") {`);
  lines.push(`      const values = meta.values ?? [];`);
  lines.push(`      if (typeof v !== "string" || !values.includes(v)) {`);
  lines.push(`        issues.push({`);
  lines.push(`          param: id,`);
  lines.push(`          message: \`must be one of: \${values.join(", ")}\`,`);
  lines.push(`        });`);
  lines.push(`      }`);
  lines.push(`      continue;`);
  lines.push(`    }`);
  lines.push(`    if (typeof v !== "number" || !Number.isFinite(v)) {`);
  lines.push(`      issues.push({ param: id, message: "must be a finite number" });`);
  lines.push(`      continue;`);
  lines.push(`    }`);
  lines.push(`    if (v < meta.min || v > meta.max) {`);
  lines.push(`      issues.push({`);
  lines.push(`        param: id,`);
  lines.push(`        message: \`\${v} outside [\${meta.min}, \${meta.max}]\`,`);
  lines.push(`      });`);
  lines.push(`      continue;`);
  lines.push(`    }`);
  lines.push(`    if (meta.type === "int" && !Number.isInteger(v)) {`);
  lines.push(`      issues.push({ param: id, message: "must be an integer" });`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  return issues;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Convert a validated preset value to the number the engine consumes.`);
  lines.push(` * Enum option names become their index. Throws on invalid input; call`);
  lines.push(` * validatePatchParams first.`);
  lines.push(` */`);
  lines.push(`export function toEngineValue(id: ParamId, value: ParamValue): number {`);
  lines.push(`  const meta = PARAMS[id];`);
  lines.push(`  if (meta.type === "enum") {`);
  lines.push(`    const values = meta.values ?? [];`);
  lines.push(`    const idx = typeof value === "string" ? values.indexOf(value) : -1;`);
  lines.push(`    if (idx === -1) throw new Error(\`invalid enum value for \${id}: \${String(value)}\`);`);
  lines.push(`    return idx;`);
  lines.push(`  }`);
  lines.push(`  if (typeof value !== "number" || !Number.isFinite(value)) {`);
  lines.push(`    throw new Error(\`invalid value for \${id}: \${String(value)}\`);`);
  lines.push(`  }`);
  lines.push(`  return value;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`/** Default value in engine units (enums as indices), keyed by id. */`);
  lines.push(`export const ENGINE_DEFAULTS: Readonly<Record<ParamId, number>> = {`);
  for (const id of ids) {
    lines.push(`  ${JSON.stringify(id)}: ${schema.params[id]!.default},`);
  }
  lines.push(`};`);
  lines.push("");
  return lines.join("\n");
}

function presetValue(p: SchemaEntry): number | string {
  return p.type === "enum" ? p.values![p.default]! : p.default;
}

function emitDefaultPreset(schema: Schema): string {
  const params: Record<string, number | string> = {};
  for (const [id, p] of Object.entries(schema.params)) {
    params[id] = presetValue(p);
  }
  return jsonFile({
    $comment: HEADER.replace("\n", " "),
    name: "Init",
    params,
  });
}

function emitUiManifest(schema: Schema): string {
  const groups: {
    name: string;
    controls: Record<string, unknown>[];
  }[] = [];
  for (const [id, p] of Object.entries(schema.params)) {
    let group = groups.find((g) => g.name === p.group);
    if (!group) {
      group = { name: p.group, controls: [] };
      groups.push(group);
    }
    group.controls.push({
      id,
      label: p.label,
      type: p.type,
      ...(p.type === "enum" ? { values: p.values } : {}),
      min: p.min,
      max: p.max,
      default: presetValue(p),
      curve: p.curve,
      unit: p.unit,
      // Plain language hover text, straight from the schema. UI must not
      // hardcode its own explanations.
      tooltip: capitalize(p.nl_direction) + ".",
    });
  }
  return jsonFile({ $comment: HEADER.replace("\n", " "), groups });
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function emitLlmSchema(schema: Schema): string {
  const properties: Record<string, unknown> = {};
  for (const [id, p] of Object.entries(schema.params)) {
    const aliasText = p.nl_aliases.join(", ");
    const description =
      `${p.group} / ${p.label}` +
      (p.unit ? ` (${p.unit})` : "") +
      `. ${capitalize(p.nl_direction)}. Related words: ${aliasText}.`;
    if (p.type === "enum") {
      properties[id] = { type: "string", enum: p.values, description };
    } else {
      properties[id] = {
        type: p.type === "int" ? "integer" : "number",
        minimum: p.min,
        maximum: p.max,
        description,
      };
    }
  }
  return jsonFile({
    $comment: HEADER.replace("\n", " "),
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "SynthonosPatchEdit",
    description:
      "A partial patch edit. Include ONLY the parameters that should change. Values outside the stated bounds are rejected, not clamped.",
    type: "object",
    properties: {
      explanation: {
        type: "string",
        description:
          "One sentence, in plain musician language, describing what changed and why. Example: 'Lowered the filter cutoff and slowed the attack for a darker, softer pad.'",
      },
      suggested_name: {
        type: "string",
        description: "A short evocative name for the edited patch.",
      },
      params: {
        type: "object",
        properties,
        additionalProperties: false,
      },
    },
    required: ["explanation", "params"],
    additionalProperties: false,
  });
}

function emitOptimizerBounds(schema: Schema): string {
  const order = Object.keys(schema.params);
  return jsonFile({
    $comment: HEADER.replace("\n", " "),
    order,
    // Engine units: enums are integer indices. The optimizer treats int and
    // enum dimensions as integers and floats as continuous, traversing log
    // curved dimensions in log space.
    bounds: order.map((id) => [schema.params[id]!.min, schema.params[id]!.max]),
    type: order.map((id) => schema.params[id]!.type),
    curve: order.map((id) => schema.params[id]!.curve),
    default: order.map((id) => schema.params[id]!.default),
  });
}

// ---------------------------------------------------------------------------
// Write or check.
// ---------------------------------------------------------------------------

function main(): void {
  const check = process.argv.includes("--check");
  const schema = loadSchema();

  const outputs: Record<string, string> = {
    "params.ts": emitParamsTs(schema),
    "default-preset.json": emitDefaultPreset(schema),
    "ui-manifest.json": emitUiManifest(schema),
    "llm-schema.json": emitLlmSchema(schema),
    "optimizer-bounds.json": emitOptimizerBounds(schema),
  };

  mkdirSync(OUT_DIR, { recursive: true });

  const stale: string[] = [];
  for (const [name, content] of Object.entries(outputs)) {
    const path = resolve(OUT_DIR, name);
    let current: string | null = null;
    try {
      current = readFileSync(path, "utf8");
    } catch {
      current = null;
    }
    if (current === content) continue;
    if (check) {
      stale.push(name);
    } else {
      writeFileSync(path, content);
      console.log(`codegen: wrote src/generated/${name}`);
    }
  }

  if (check && stale.length > 0) {
    fail(
      `generated files are out of date with params.schema.json: ${stale.join(", ")}. Run: npm run codegen`,
    );
  }
  if (check) {
    console.log("codegen: all generated files are up to date");
  } else {
    console.log("codegen: done");
  }
}

main();
