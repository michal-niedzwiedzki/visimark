import type { Ref } from "../lang/ast.js";
import { latticePoints } from "../lang/lattice.js";
import type { DocumentFile } from "../fs/reader.js";
import { build } from "../model/build.js";
import {
  type Binding,
  type DocModel,
  DOC_SCOPE,
  type Finding,
  type Report,
} from "../model/types.js";
import { locate } from "../parse/document.js";
import { formatUnit } from "../lang/unit-expr.js";
import { check, type CheckResult } from "./check.js";
import { dependencies, resolve } from "./graph.js";
import { applyScenario, listParams, type ParamInfo } from "./scenario.js";
import type { Value } from "./value.js";

/**
 * `visimark simulate`: ask a document every question its lattices declare,
 * plus the base, once each, and keep what the reports read. Every rule here
 * is docs/design/add-a-simulate-command-spec.md §3. Nothing is written and no
 * clock is read.
 */

/** a `param` with a `lattice` clause, as the grid sees it */
export interface LatticeParam {
  /** qualified id, `sheet.name`, or the bare name at document scope */
  id: string;
  /** the bare name, or `sheet.name` when two lattice params share one */
  label: string;
  percent: boolean;
  /** the declared width; a percent param's width is of its decimal value */
  precision: number;
  /** canonical decimals, ascending */
  points: string[];
}

export interface Question {
  /** `base`, or the 1-based position in grid order */
  index: number | "base";
  /** lattice param id → the canonical decimal it takes here */
  values: Map<string, string>;
}

export interface Answer {
  question: Question;
  /** every scalar binding id → its value; absent when it was not evaluated */
  scalars: Map<string, Value>;
  /** one per `assert`, document order; `null` when it could not be verified */
  holds: (boolean | null)[];
  faulted: boolean;
}

export interface Blocked {
  sheetId: string;
  /** the first blocking finding, in `check`'s order */
  first: Finding;
  /** how many more block it */
  more: number;
}

export interface Simulation {
  params: LatticeParam[];
  /** N: the grid's questions, not counting the base */
  gridSize: number;
  /** false when a lattice finding stops the grid being built (spec §3.4) */
  gridBuilt: boolean;
  /** the params that declare a lattice, whether or not the grid could be built */
  latticeCount: number;
  /** sheets with at least one `report`, document order */
  reportSheets: string[];
  reports: Map<string, Report[]>;
  blocked: Blocked[];
  /** one per `assert`, document order; `key` is its source after `assert` */
  assertions: { sheetId: string; key: string }[];
  /** binding id → the width it writes at, from the base evaluation */
  scalarPrecision: Map<string, number>;
  /** binding id → its unit as eval prints it, `EUR`; absent when it has none */
  units: Map<string, string>;
  /** non-param scalar ids of each sheet, declaration order (for `deltas` with no `on`) */
  sheetScalars: Map<string, string[]>;
  /** each report's `REF`s, resolved to scalar ids, keyed by report id */
  refIds: Map<string, string[]>;
  /** [base, 1…N]; empty when nothing can start */
  answers: Answer[];
}

export interface SimulateOptions {
  doc?: DocumentFile;
  /** called once the grid and the blocked sheets are known, before any grid question */
  onPlan?: (sim: Simulation) => void;
  /** called after each question is evaluated, `i` of `n` (base counted) */
  onQuestion?: (i: number, n: number) => void;
  /** the evaluator; tests wrap `check` to count calls */
  evaluate?: (model: DocModel, doc?: DocumentFile) => CheckResult;
}

/** findings that do not stop a sheet: the run recomputes, writes nothing, and reads an assertion */
const NOT_BLOCKING = new Set(["STALE", "ASSERT", "ARTIFACT", "COVERAGE", "WARN", "NOTE"]);

function bindingsById(model: DocModel): Map<string, Binding> {
  const out = new Map<string, Binding>();
  for (const b of model.docScope.values()) out.set(b.id, b);
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.columns.values()) out.set(b.id, b);
    for (const b of sheet.scalars.values()) out.set(b.id, b);
  }
  return out;
}

function findingBindingId(f: Finding): string | undefined {
  if (f.name === undefined) return undefined;
  const sheet = f.sheetId ?? DOC_SCOPE;
  return sheet === DOC_SCOPE ? f.name : `${sheet}.${f.name}`;
}

function scalarId(model: DocModel, sheetId: string, ref: Ref): string | undefined {
  const res = resolve(model, sheetId, ref);
  return res.kind === "scalar" || res.kind === "doc-scalar" ? res.binding.id : undefined;
}

function assertionKey(source: string): string {
  return source
    .replace(/^\s*assert\b/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function latticeParams(params: ParamInfo[]): LatticeParam[] {
  const swept = params.filter((p) => p.lattice !== undefined);
  const count = new Map<string, number>();
  for (const p of swept) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  return swept.map((p) => ({
    id: p.id,
    label: count.get(p.name)! > 1 ? `${p.sheetId}.${p.name}` : p.name,
    percent: p.percent,
    precision: p.precision ?? 0,
    points: latticePoints({
      name: p.name,
      ...(p.domain === undefined ? {} : { domain: p.domain }),
      step: p.lattice!.step,
      stepText: p.lattice!.literal.text,
      percent: p.percent,
    }),
  }));
}

/** the grid, in grid order: the last param changes fastest */
function gridQuestions(params: LatticeParam[]): Question[] {
  if (params.length === 0) return [];
  const out: Question[] = [];
  const idx = params.map(() => 0);
  for (let n = 1; ; n++) {
    out.push({ index: n, values: new Map(params.map((p, k) => [p.id, p.points[idx[k]!]!])) });
    let k = params.length - 1;
    while (k >= 0 && idx[k] === params[k]!.points.length - 1) idx[k--] = 0;
    if (k < 0) return out;
    idx[k]!++;
  }
}

export function simulate(source: string, opts: SimulateOptions = {}): Simulation {
  const evaluate =
    opts.evaluate ?? ((m: DocModel, doc?: DocumentFile) => check(m, doc ? { doc } : {}));
  const located = locate(source);
  const model = build(located);
  const byId = bindingsById(model);
  const allParams = listParams(model);
  const latticeIds = new Set(allParams.filter((p) => p.lattice !== undefined).map((p) => p.id));

  const reportSheets: string[] = [];
  const reports = new Map<string, Report[]>();
  const sheetScalars = new Map<string, string[]>();
  for (const sheet of model.sheets.values()) {
    sheetScalars.set(
      sheet.id,
      [...sheet.scalars.values()].filter((b) => b.param === undefined).map((b) => b.id),
    );
    if (sheet.reports.length > 0) {
      reportSheets.push(sheet.id);
      reports.set(sheet.id, sheet.reports);
    }
  }

  const empty: Simulation = {
    params: [],
    gridSize: 0,
    gridBuilt: false,
    latticeCount: latticeIds.size,
    reportSheets,
    reports,
    blocked: [],
    assertions: [],
    scalarPrecision: new Map(),
    units: new Map(),
    sheetScalars,
    refIds: new Map(),
    answers: [],
  };
  // a file with no report is not evaluated at all
  if (reportSheets.length === 0) return empty;
  const base = evaluate(model, opts.doc);

  // each report's REFs, and the scalars `deltas` with no `on` reads
  const refIds = new Map<string, string[]>();
  for (const sheetId of reportSheets) {
    for (const r of reports.get(sheetId)!) {
      const ids =
        r.options.kind === "deltas" && r.options.on.length === 0
          ? sheetScalars.get(sheetId)!
          : r.refs.map((ref) => scalarId(model, sheetId, ref)).filter((x): x is string => !!x);
      refIds.set(r.id, ids);
    }
  }

  // spec §3.4: which report sheets cannot start
  const blocking = base.findings.filter((f) => !NOT_BLOCKING.has(f.code));
  const gridFault = blocking.find((f) => {
    const id = findingBindingId(f);
    return id !== undefined && latticeIds.has(id);
  });
  const closure = (ids: string[]): Set<string> => {
    const seen = new Set<string>();
    const todo = [...ids];
    while (todo.length > 0) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const b = byId.get(id);
      if (b) for (const d of dependencies(model, b).deps) todo.push(d);
    }
    return seen;
  };
  const blocked: Blocked[] = [];
  for (const sheetId of reportSheets) {
    const rs = reports.get(sheetId)!;
    let hits: Finding[];
    if (gridFault) {
      hits = [gridFault, ...blocking.filter((f) => f !== gridFault)];
    } else {
      const reach = closure(rs.flatMap((r) => refIds.get(r.id)!));
      const reachSheets = new Set([...reach].map((id) => byId.get(id)?.sheetId));
      hits = blocking.filter((f) => {
        const at = f.span?.start ?? f.sourceOffset;
        if (at !== undefined && rs.some((r) => at >= r.span.start && at < r.span.end)) return true;
        const id = findingBindingId(f);
        if (id !== undefined) return reach.has(id);
        return f.sheetId !== undefined && reachSheets.has(f.sheetId);
      });
    }
    if (hits.length > 0) blocked.push({ sheetId, first: hits[0]!, more: hits.length - 1 });
  }

  const assertions = base.assertions.map((a) => ({
    sheetId: a.sheetId,
    key: assertionKey(a.source),
  }));
  const units = new Map<string, string>();
  for (const [k, u] of base.unitMaps) units.set(k, formatUnit(u.map));

  const params = gridFault ? [] : latticeParams(allParams);
  const grid = gridQuestions(params);
  const sim: Simulation = {
    params,
    gridSize: grid.length,
    gridBuilt: !gridFault,
    latticeCount: latticeIds.size,
    reportSheets,
    reports,
    blocked,
    assertions,
    scalarPrecision: base.scalarPrecision,
    units,
    sheetScalars,
    refIds,
    answers: [],
  };
  opts.onPlan?.(sim);
  if (blocked.length === reportSheets.length) return sim;

  const readIds = new Set([...refIds.values()].flat());
  const questions: Question[] = [{ index: "base", values: new Map() }, ...grid];
  const n = questions.length;
  questions.forEach((q, i) => {
    // the base is the evaluation that already decided blocking: one per question
    let r = base;
    if (q.index !== "base") {
      const m = build(located);
      applyScenario(m, q.values);
      r = evaluate(m, opts.doc);
    }
    const scalars = new Map<string, Value>();
    for (const [k, v] of r.values) scalars.set(k, v);
    const holds = r.assertions.map((a) => a.holds);
    const faulted = holds.some((h) => h === null) || [...readIds].some((id) => !scalars.has(id));
    sim.answers.push({ question: q, scalars, holds, faulted });
    opts.onQuestion?.(i + 1, n);
  });
  return sim;
}
