import { Decimal } from "decimal.js";
import { type Binding, type DocModel, DOC_SCOPE } from "../model/types.js";
import { closest } from "../report/levenshtein.js";

/**
 * Scenario parameters: reading a scenario file, checking it against a
 * document's declared params, and applying it to the model before `check`
 * runs. Every rule here is from docs/design/scenario-params-spec.md §3.3 and
 * every message from §4.2. A scenario never reaches a writer: only `eval`
 * calls this.
 */

/** a scenario fault — a usage error (exit 2), never a finding about the document */
export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioError";
  }
}

/** one top-level `"key": value` pair, the value still as its JSON source text */
export interface ScenarioEntry {
  key: string;
  raw: string;
}

/** a declared `param`, as the scenario and the output see it */
export interface ParamInfo {
  /** qualified id — `sheet.name`, or the bare name at document scope */
  id: string;
  sheetId: string;
  name: string;
  precision: number | undefined;
  /** the default literal as written, `19%` */
  text: string;
  percent: boolean;
  /** the default's value, canonical (`2.00` → `2`) */
  defaultValue: string;
  binding: Binding;
}

/** the checked scenario: param id → the decimal string it takes */
export type Resolved = Map<string, string>;

const LITERAL_RE = /^-?\d+(?:\.\d+)?%?$/;

/**
 * Read a scenario's text into its top-level entries. It must be a JSON object.
 * `JSON.parse` keeps the last of two equal keys without a word, so the
 * top-level keys are walked from the source to catch a duplicate.
 */
export function parseScenarioJson(text: string, file: string): ScenarioEntry[] {
  const notObject = new ScenarioError(`visimark: scenario ${file} is not a JSON object`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw notObject;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw notObject;
  return topLevelEntries(text);
}

/**
 * The key and raw value text of each top-level pair of a string already known
 * to be a valid JSON object. A small scanner: it only has to track strings and
 * nesting depth, because `JSON.parse` has already vouched for the grammar.
 */
function topLevelEntries(text: string): ScenarioEntry[] {
  const out: ScenarioEntry[] = [];
  let i = text.indexOf("{") + 1;
  const skipWs = (): void => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  const readString = (): string => {
    const start = i;
    i++; // opening quote
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++; // closing quote
    return JSON.parse(text.slice(start, i)) as string;
  };
  const readValue = (): string => {
    const start = i;
    let depth = 0;
    while (i < text.length) {
      const c = text[i]!;
      if (c === '"') {
        readString();
        continue;
      }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        if (depth === 0) break;
        depth--;
      } else if (c === "," && depth === 0) break;
      i++;
    }
    return text.slice(start, i).trim();
  };
  for (;;) {
    skipWs();
    if (text[i] === "}") break;
    const key = readString();
    skipWs();
    i++; // colon
    skipWs();
    out.push({ key, raw: readValue() });
    skipWs();
    if (text[i] === ",") i++;
  }
  return out;
}

/** every declared param, in document order */
export function listParams(model: DocModel): ParamInfo[] {
  const out: ParamInfo[] = [];
  const add = (b: Binding, sheetId: string): void => {
    if (b.param === undefined) return;
    out.push({
      id: sheetId === DOC_SCOPE ? b.name : `${sheetId}.${b.name}`,
      sheetId,
      name: b.name,
      precision: b.precision,
      text: b.param.text,
      percent: b.param.percent,
      defaultValue: b.expr.type === "num" ? new Decimal(b.expr.value).toString() : b.param.text,
      binding: b,
    });
  };
  for (const b of model.docScope.values()) add(b, DOC_SCOPE);
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.scalars.values()) add(b, sheet.id);
  }
  return out.sort((a, b) => a.binding.span.start - b.binding.span.start);
}

/** Resolve every key and check every value. The first fault throws. */
export function resolveScenario(model: DocModel, entries: ScenarioEntry[]): Resolved {
  const params = listParams(model);
  const byId = new Map(params.map((p) => [p.id, p]));
  const resolved: Resolved = new Map();
  const seenKeys = new Set<string>();

  for (const { key, raw } of entries) {
    if (seenKeys.has(key)) throw new ScenarioError(`visimark: scenario key ${key} is given twice`);
    seenKeys.add(key);

    const param = resolveKey(model, params, byId, key);
    if (resolved.has(param.id)) {
      throw new ScenarioError(`visimark: scenario key ${param.name} is given twice`);
    }
    resolved.set(param.id, checkValue(param, key, raw));
  }
  return resolved;
}

function resolveKey(
  model: DocModel,
  params: ParamInfo[],
  byId: Map<string, ParamInfo>,
  key: string,
): ParamInfo {
  const direct = byId.get(key);
  if (direct) return direct;

  if (!key.includes(".")) {
    const matches = params.filter((p) => p.name === key);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      throw new ScenarioError(
        `visimark: scenario key ${key} is ambiguous: ${matches.map((p) => p.id).join(", ")}`,
      );
    }
  }

  const other = otherBinding(model, key);
  if (other !== null) {
    throw new ScenarioError(`visimark: scenario key ${key} is a ${other}, not a param`);
  }
  const candidates = new Set<string>();
  for (const p of params) {
    candidates.add(p.id);
    candidates.add(p.name);
  }
  const guess = closest(key, candidates, 3);
  throw new ScenarioError(
    `visimark: scenario key ${key} names no param` + (guess ? `; did you mean ${guess}?` : ""),
  );
}

/** what a key names when it names something that is not a param, or null */
function otherBinding(model: DocModel, key: string): "rule" | "column" | null {
  const dot = key.indexOf(".");
  const lookup = (sheetId: string, name: string): "rule" | "column" | null => {
    if (sheetId === DOC_SCOPE) return model.docScope.has(name) ? "rule" : null;
    const sheet = model.sheets.get(sheetId);
    if (!sheet) return null;
    if (sheet.scalars.has(name)) return "rule";
    if (sheet.columns.has(name) || sheet.inputColumns.has(name)) return "column";
    return null;
  };
  if (dot !== -1) return lookup(key.slice(0, dot), key.slice(dot + 1));
  const inDoc = lookup(DOC_SCOPE, key);
  if (inDoc) return inDoc;
  for (const sheetId of model.sheets.keys()) {
    const found = lookup(sheetId, key);
    if (found) return found;
  }
  return null;
}

/** one value, checked against its param: a string number literal that fits */
function checkValue(param: ParamInfo, key: string, raw: string): string {
  const value: unknown = JSON.parse(raw);
  if (typeof value === "number") {
    throw new ScenarioError(`visimark: scenario value for ${key} must be a string: write "${raw}"`);
  }
  if (typeof value !== "string" || !LITERAL_RE.test(value)) {
    throw new ScenarioError(`visimark: scenario value for ${key} is not a number: ${raw}`);
  }
  const percent = value.endsWith("%");
  if (param.percent && !percent) {
    throw new ScenarioError(`visimark: ${key} is a percent; write "${value}%"`);
  }
  const d = percent ? new Decimal(value.slice(0, -1)).div(100) : new Decimal(value);
  const places = d.decimalPlaces();
  if (param.precision !== undefined && places > param.precision) {
    throw new ScenarioError(
      `visimark: scenario value for ${key} has ${places} decimal${places === 1 ? "" : "s"}; ${param.name} declares ${param.precision}`,
    );
  }
  return d.toString();
}

/**
 * Give each supplied param its scenario value in place of its default. The
 * model is the caller's own copy, built for this one evaluation.
 */
export function applyScenario(model: DocModel, resolved: Resolved): void {
  for (const p of listParams(model)) {
    const value = resolved.get(p.id);
    if (value === undefined) continue;
    const { start, end } = p.binding.expr;
    p.binding.expr = { type: "num", value, start, end };
  }
}
