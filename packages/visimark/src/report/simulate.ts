import { Decimal } from "decimal.js";
import type { Ref, ReportAmong } from "../lang/ast.js";
import type { Answer, LatticeParam, Simulation } from "../eval/simulate.js";
import { roundToPlaces, type Value } from "../eval/value.js";
import type { Report } from "../model/types.js";

/**
 * The five shipped readings of a simulation, as text. Every line and rule is
 * docs/design/add-a-simulate-command-spec.md §3.3 and §4. This module only
 * formats: the questions were asked by `eval/simulate.ts`.
 */

const NO_GRID = "no grid: no param declares a lattice";

/** a table: each column padded to its widest cell, numbers right-aligned, two-space gaps */
function table(rows: string[][], numeric: boolean[]): string[] {
  const widths = numeric.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? "").length)));
  return rows.map((r) =>
    r
      .map((cell, c) => (numeric[c] ? cell.padStart(widths[c]!) : cell.padEnd(widths[c]!)))
      .join("  ")
      .trimEnd(),
  );
}

function fixed(d: Decimal, places: number | undefined): string {
  return places === undefined ? d.toString() : roundToPlaces(d, places).toFixed(places);
}

function signed(d: Decimal, places: number | undefined): string {
  const s = fixed(d, places);
  return d.gt(0) && !/^0(\.0*)?$/.test(s) ? `+${s}` : s;
}

function refText(r: Ref): string {
  return r.qualifier ? `${r.qualifier}.${r.name}` : r.name;
}

/** `412 ms`, `3.4 s`, `2 min 05 s`: elapsed wall time, to a reader's precision */
export function elapsedText(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

export function renderBlocked(sheetId: string): string[] {
  return [`#${sheetId}`, "  (cannot start)"];
}

export function renderSheet(sim: Simulation, sheetId: string): string[] {
  const out = [`#${sheetId}`];
  for (const r of sim.reports.get(sheetId) ?? []) {
    out.push("", r.text, "");
    for (const line of body(sim, r)) out.push(line === "" ? "" : `  ${line}`);
  }
  return out;
}

class View {
  readonly grid: Answer[];
  readonly base: Answer;
  constructor(readonly sim: Simulation) {
    this.base = sim.answers[0]!;
    this.grid = sim.answers.slice(1);
  }

  numOf(a: Answer, id: string): Decimal | undefined {
    const v: Value | undefined = a.scalars.get(id);
    return v && v.t === "num" ? v.d : undefined;
  }

  /** a scalar at the width it writes at */
  show(id: string, d: Decimal): string {
    return fixed(d, this.sim.scalarPrecision.get(id));
  }

  delta(id: string, d: Decimal): string {
    return signed(d, this.sim.scalarPrecision.get(id));
  }

  /** a lattice param's value: a percent as a percent, at its width */
  param(p: LatticeParam, d: Decimal): string {
    return p.percent
      ? `${fixed(d.times(100), Math.max(p.precision - 2, 0))}%`
      : fixed(d, p.precision);
  }

  paramValue(p: LatticeParam, a: Answer): string {
    const d = this.numOf(a, p.id);
    return d === undefined ? "?" : this.param(p, d);
  }

  prose(a: Answer): string {
    if (a.question.index === "base") return "base";
    return this.sim.params.map((p) => `${p.label}=${this.paramValue(p, a)}`).join(" ");
  }

  named(name: string, id: string): string {
    const u = this.sim.units.get(id);
    return u ? `${name} [${u}]` : name;
  }

  feasible(a: Answer): boolean {
    return !a.faulted && a.holds.every((h) => h === true);
  }

  infeasible(a: Answer): boolean {
    return !a.faulted && a.holds.some((h) => h === false);
  }

  inPopulation(a: Answer, among: ReportAmong): boolean {
    if (among === "feasible") return this.feasible(a);
    if (among === "infeasible") return this.infeasible(a);
    return !a.faulted;
  }

  emptyPopulation(among: ReportAmong): string {
    if (among === "feasible") return "no feasible question";
    if (among === "infeasible") return "no infeasible question";
    return "no question evaluated";
  }
}

function body(sim: Simulation, r: Report): string[] {
  const v = new View(sim);
  switch (r.options.kind) {
    case "ledger":
      return ledger(v, r.options.assertionsBroken);
    case "deltas": {
      const ids = sim.refIds.get(r.id) ?? [];
      const names = r.options.on.length > 0 ? r.options.on.map(refText) : ids.map((id) => id);
      return deltas(v, ids, names, r.options.among);
    }
    case "gates":
      return gates(v);
    case "best": {
      const id = sim.refIds.get(r.id)?.[0];
      return id === undefined
        ? []
        : best(v, id, refText(r.options.scalar), r.options.direction, r.options.among);
    }
    case "forbidden":
      return forbidden(v);
  }
}

function ledger(v: View, broken: boolean): string[] {
  const { sim } = v;
  const head = [
    "question",
    ...sim.params.map((p) => v.named(p.label, p.id)),
    "feasible",
    ...(broken ? ["broken"] : []),
  ];
  const rows = sim.answers.map((a) => [
    a.question.index === "base" ? "base" : String(a.question.index),
    ...sim.params.map((p) => v.paramValue(p, a)),
    a.faulted ? "faulted" : v.feasible(a) ? "yes" : "no",
    ...(broken
      ? [
          a.holds
            .map((h, i) => (h === false ? sim.assertions[i]!.key : null))
            .filter((k): k is string => k !== null)
            .join("; "),
        ]
      : []),
  ]);
  const numeric = [false, ...sim.params.map(() => true), false, ...(broken ? [false] : [])];
  return table([head, ...rows], numeric);
}

function deltas(v: View, ids: string[], names: string[], among: ReportAmong): string[] {
  if (v.sim.gridSize === 0) return [NO_GRID];
  const population = v.grid.filter((a) => v.inPopulation(a, among));
  if (population.length === 0) return [v.emptyPopulation(among)];
  const out: string[] = [];
  ids.forEach((id, k) => {
    const base = v.numOf(v.base, id);
    const head = v.named(names[k]!, id);
    out.push(`${head}  base ${base === undefined ? "?" : v.show(id, base)}`);
    let low: Answer | undefined;
    let high: Answer | undefined;
    for (const a of population) {
      const d = v.numOf(a, id);
      if (d === undefined) continue;
      if (low === undefined || d.lt(v.numOf(low, id)!)) low = a;
      if (high === undefined || d.gt(v.numOf(high, id)!)) high = a;
    }
    const row = (label: string, a: Answer): string[] => {
      const d = v.numOf(a, id)!;
      const delta = base === undefined ? "?" : v.delta(id, d.minus(base));
      return [label, v.show(id, d), `(${delta})`, v.prose(a)];
    };
    if (low && high) {
      for (const line of table([row("low", low), row("high", high)], [false, true, true, false])) {
        out.push(`  ${line}`);
      }
    }
  });
  const ranked = population.filter((a) => ids.some((id) => v.numOf(a, id) !== undefined)).length;
  out.push(
    among === "all"
      ? `over ${ranked} questions`
      : `over ${ranked} ${among} of ${v.sim.gridSize} questions`,
  );
  return out;
}

function gates(v: View): string[] {
  const { sim } = v;
  const rows = sim.assertions.map((a, i) => {
    let holds = 0;
    let fails = 0;
    let faulted = 0;
    let first: Answer | undefined;
    for (const q of v.grid) {
      const h = q.holds[i];
      if (h === true) holds++;
      else if (h === false) {
        fails++;
        first ??= q;
      } else faulted++;
    }
    const b = v.base.holds[i];
    return [
      a.key,
      String(holds),
      String(fails),
      String(faulted),
      b === true ? "holds" : b === false ? "fails" : "faulted",
      first ? v.prose(first) : "",
    ];
  });
  const head = ["assert", "holds", "fails", "faulted", "base", "first failure"];
  return [
    `${sim.gridSize} questions`,
    ...table([head, ...rows], [false, true, true, true, false, false]),
  ];
}

function best(
  v: View,
  id: string,
  name: string,
  direction: "max" | "min",
  among: ReportAmong,
): string[] {
  if (v.sim.gridSize === 0) return [NO_GRID];
  const candidates = v.grid.filter((a) => v.inPopulation(a, among) && v.numOf(a, id) !== undefined);
  if (candidates.length === 0) return [v.emptyPopulation(among)];
  let win = candidates[0]!;
  for (const a of candidates) {
    const d = v.numOf(a, id)!;
    const w = v.numOf(win, id)!;
    if (direction === "max" ? d.gt(w) : d.lt(w)) win = a;
  }
  const value = v.numOf(win, id)!;
  const ties = candidates.filter((a) => v.numOf(a, id)!.eq(value)).length;
  const base = v.numOf(v.base, id);
  const delta = base === undefined ? "?" : v.delta(id, value.minus(base));
  const out = [
    v.prose(win),
    `${v.named(name, id)}  ${v.show(id, value)}  (${delta} against base)`,
    among === "all"
      ? `chosen from ${candidates.length} questions`
      : `chosen from ${candidates.length} ${among} of ${v.sim.gridSize} questions`,
  ];
  if (ties > 1) out.push(`${ties} questions tie; the first in grid order is shown`);
  return out;
}

function forbidden(v: View): string[] {
  const { sim } = v;
  if (sim.gridSize === 0) return [NO_GRID];
  const rows: string[][] = [];
  for (const p of sim.params) {
    for (const point of p.points) {
      const at = v.grid.filter((a) => a.question.values.get(p.id) === point);
      if (at.length > 0 && at.every((a) => !v.feasible(a))) {
        rows.push([
          `${p.label} = ${v.param(p, new Decimal(point))}`,
          "every question with it breaks an assertion",
        ]);
      }
    }
  }
  const infeasible = v.grid.filter((a) => v.infeasible(a)).length;
  return [
    ...(rows.length > 0 ? table(rows, [false, false]) : ["nothing is forbidden"]),
    `${infeasible} of ${sim.gridSize} questions are infeasible`,
  ];
}
