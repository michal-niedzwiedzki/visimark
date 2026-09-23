import type { AssertionResult, ChartResult, CheckResult } from "../eval/check.js";
import type { Value } from "../eval/value.js";
import type { Proposal } from "../infer/propose.js";
import { ERROR_CODES, isProblem, type Finding } from "../model/types.js";
import { precisionPhrase, type FnEntry } from "../lang/reference.js";

export type JsonWriter = (line: string) => void;
export type CommandName = "check" | "fmt" | "infer" | "eval" | "explain" | "ref";

export function emitJson(out: JsonWriter, doc: object): void {
  out(JSON.stringify(doc, null, 2));
}

export function statusFromExit(code: 0 | 1 | 2): "ok" | "problems" | "error" {
  return code === 0 ? "ok" : code === 1 ? "problems" : "error";
}

// `errorEnvelope` used to be here. It moved to `report/envelope.ts` because it
// is the only function in this file that reads the engine's own version, and
// `readVersion()` imports `node:module` — which kept this entire module, and
// therefore every public piece of the `--json` envelope, out of any browser
// build. Issue #204. Everything below is pure and bundles anywhere.

export function findingSummary(findings: Finding[]): {
  problems: number;
  stale: number;
  errors: number;
} {
  let stale = 0;
  let errors = 0;
  for (const f of findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  return { problems: stale + errors, stale, errors };
}

export function publicFinding(file: string, f: Finding): object {
  const location: Record<string, string> = { file };
  if (f.sheetId) location.sheet = f.sheetId;
  if (f.name) location.name = f.name;
  if (f.rowLabel) location.row = f.rowLabel;
  const details: Record<string, unknown> = {};
  if (f.code === "STALE" && f.anchorGroup) {
    details.suppressedCount = f.suppressedCount ?? 0;
  } else if (f.code === "STALE" && f.artifact !== undefined) {
    details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else if (f.code === "STALE") {
    if (f.stored !== undefined) details.stored = f.stored;
    if (f.computed !== undefined) details.computed = f.computed;
    if (f.formula !== undefined) details.formula = f.formula;
  } else if (f.code === "DATE") {
    if (f.raw !== undefined) details.raw = f.raw;
    if (f.isoFix !== undefined) details.isoFix = f.isoFix;
    if (f.altA !== undefined) details.altA = f.altA;
    if (f.altB !== undefined) details.altB = f.altB;
    if (f.daysApart !== undefined) details.daysApart = f.daysApart;
  } else if (f.code === "PRECISION") {
    // the formula that has no derivable width, or the ceiling message
    if (f.raw !== undefined) details.formula = f.raw;
    if (f.message) details.message = f.message;
    if (f.suggestion) details.suggestion = f.suggestion;
  } else if (f.code === "CYCLE") {
    details.cyclePath = f.cyclePath ?? [];
  } else if (f.code === "ASSERT") {
    if (f.source !== undefined) details.source = f.source;
    if (f.message !== undefined) details.substituted = f.message;
  } else if (f.code === "ARTIFACT") {
    if (f.artifact !== undefined) details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else {
    if (f.message) details.message = f.message;
    if (f.suggestion) details.suggestion = f.suggestion;
    if (f.code === "NOTE" && f.suppressedCount !== undefined) {
      details.suppressedCount = f.suppressedCount;
    }
  }
  return {
    code: f.code,
    class: isProblem(f) ? "problem" : "advice",
    location,
    details,
  };
}

function jsonShowValue(v: Value): string {
  if (v.t === "num") return v.d.toString();
  if (v.t === "date") return v.iso;
  if (v.t === "bool") return String(v.b);
  return v.s;
}

export type JsonValue = string | (string | null)[];

export function evalValues(result: CheckResult): Record<string, JsonValue> {
  const values: Record<string, JsonValue> = {};
  for (const [k, v] of result.values) values[k] = jsonShowValue(v);
  for (const [k, col] of result.cells) {
    values[k] = col.map((v) => (v ? jsonShowValue(v) : null));
  }
  return values;
}

/** how a failed assertion fares on the document's defaults, under a scenario */
export type OnDefaults = "pass" | "fail" | "unverified";

/**
 * `defaults`, when given, carries one entry per assertion (same order): its
 * result on the defaults. It is attached only to entries that are false —
 * scenario-params-spec.md §5.3.
 */
export function publicAssertions(
  assertions: AssertionResult[],
  defaults?: (OnDefaults | undefined)[],
): object[] {
  return assertions.map((a, i) => ({
    sheet: a.sheetId,
    source: a.source,
    holds: a.holds,
    operands: a.operands,
    substituted: a.substituted,
    ...(a.holds === false && defaults?.[i] !== undefined ? { defaults: defaults[i] } : {}),
  }));
}

/** `withState: false` under a scenario: the artifact on disk was drawn from
 *  the defaults, so its state says nothing about this evaluation */
export function publicCharts(charts: ChartResult[], withState = true): object[] {
  return charts.map((c) => ({
    sheet: c.sheetId,
    name: c.name,
    engine: c.engine,
    series: c.series,
    labels: c.labels,
    path: c.path,
    ...(withState ? { state: c.state } : {}),
  }));
}

export function publicProposal(p: Proposal): object {
  const out: Record<string, unknown> = {
    kind: p.kind,
    sheet: p.sheetId,
    name: p.name,
    rule: p.rule,
    fits: p.fits,
    rows: p.rows,
    weak: p.weak ?? false,
  };
  if (p.reason) out.reason = p.reason;
  if (p.alternatives) out.alternatives = p.alternatives;
  if (p.disagreement) {
    out.disagreement = {
      rowLabel: p.disagreement.rowLabel,
      stored: p.disagreement.stored,
      computed: p.disagreement.computed,
    };
  }
  return out;
}

export function inferSummary(proposals: Proposal[]): {
  rules: number;
  scalars: number;
  anchors: number;
} {
  return {
    rules: proposals.filter((p) => p.kind === "column" && !p.weak).length,
    scalars: proposals.filter((p) => p.kind === "scalar").length,
    anchors: proposals.filter((p) => p.kind === "scalar" && p.anchorSite).length,
  };
}

/** `NAME(a, b)` — the one rendering of a builtin's shape, text and JSON alike. */
export function signature(e: FnEntry): string {
  return `${e.name}(${e.params.map((p) => p.name).join(", ")})`;
}

/**
 * `ref`'s public entry. It lives here beside the other public shapes rather
 * than in the CLI, because `visimark-mcp` serves the same command over the
 * same envelope and a second copy of this would be a second contract.
 */
export function publicFnEntry(e: FnEntry): object {
  return {
    name: e.name,
    kind: e.kind,
    arity: e.arity,
    signature: signature(e),
    summary: e.summary,
    params: e.params.map((p) => ({ name: p.name, type: p.type, note: p.note })),
    returns: e.returns,
    precision: { ...e.precision, text: precisionPhrase(e.precision) },
    ...(e.rounding ? { rounding: e.rounding } : {}),
    errors: e.errors.map((x) => ({ when: x.when, code: x.code })),
    examples: e.examples.map((x) => ({ expr: x.expr, is: x.is })),
    ...(e.see ? { see: [...e.see] } : {}),
  };
}
