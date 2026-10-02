import { Decimal } from "decimal.js";
import type { Expr, NumberLit } from "../lang/ast.js";
import { describeFunction, type UnitSig } from "../lang/reference.js";
import {
  DIMENSIONLESS,
  divUnits,
  formatUnit,
  halveUnit,
  isDimensionless,
  mulUnits,
  parseUnit,
  powUnit,
  sameUnit,
  showUnitMap,
  type UnitMap,
} from "../lang/unit-expr.js";
import type { Binding, Chart, DocModel, Finding, Sheet } from "../model/types.js";
import { resolve } from "./graph.js";
import { numericValue } from "./units.js";

/**
 * The static unit pass. Every binding, column and literal has a unit map —
 * atom to integer exponent — computed once, from the formula, before anything
 * is evaluated; no value is ever read. A binding whose unit check fails gets
 * no value, and the caller marks it unevaluable so its readers fold into the
 * usual suppression. See docs/design/algebraic-unit-maps-on-names-spec.md §3–§4.
 */

/** what an expression is, for the unit pass */
export type Dim =
  | {
      kind: "num";
      map: UnitMap;
      /** no operand anywhere below carries a unit — only then is a
       *  declaration ascribed rather than checked */
      unitFree: boolean;
      /** the literal `0`, which matches any unit where two must agree */
      zeroLiteral: boolean;
      /** the step `⌊x⌋`/`⌈x⌉` supply, which takes `x`'s unit */
      implicitStep: boolean;
    }
  | { kind: "date" }
  | { kind: "string" }
  | { kind: "bool" };

export interface UnitInfo {
  map: UnitMap;
  source: "declared" | "derived";
}

class DimError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
  }
}

const num = (map: UnitMap, unitFree: boolean): Dim => ({
  kind: "num",
  map,
  unitFree,
  zeroLiteral: false,
  implicitStep: false,
});

type ColumnKind = "num" | "date" | "string";

export class DimensionChecker {
  /** every name with a non-empty unit, by binding id or `sheet.Column` */
  readonly unitMaps = new Map<string, UnitInfo>();
  /** what each checked binding is, so readers see their operands' units */
  private readonly dims = new Map<string, Dim>();
  /** atoms written anywhere a unit is parsed, for the unused-definition WARN */
  private readonly atomsSeen = new Set<string>();

  constructor(
    private readonly model: DocModel,
    private readonly emit: (f: Finding) => void,
  ) {
    for (const sheet of model.sheets.values()) {
      for (const [name, u] of sheet.headerUnits) {
        for (const a of u.map.keys()) this.atomsSeen.add(a);
        if (!sheet.columns.has(name)) {
          this.unitMaps.set(`${sheet.id}.${name}`, { map: u.map, source: "declared" });
        }
      }
    }
    const heads = [...model.docScope.values()];
    for (const sheet of model.sheets.values()) heads.push(...sheet.scalars.values());
    for (const b of heads) for (const a of b.unit?.map.keys() ?? []) this.atomsSeen.add(a);
  }

  /** a declared unit on an input column of dates or words is refused once */
  checkInputColumns(): void {
    for (const sheet of this.model.sheets.values()) {
      for (const [name, u] of sheet.headerUnits) {
        if (sheet.columns.has(name)) continue;
        const kind = this.columnKind(sheet, name);
        if (kind === "num") continue;
        this.unitMaps.delete(`${sheet.id}.${name}`);
        this.emit({
          code: "UNIT",
          sheetId: sheet.id,
          name,
          message: `a ${kind} cannot carry a unit`,
          sourceOffset: u.text.start,
          span: { start: u.text.start, end: u.text.end },
        });
      }
    }
  }

  /**
   * Check one binding — a column rule or a scalar — in dependency order.
   * Returns false, having emitted the one `UNIT` finding, when it fails.
   */
  checkBinding(b: Binding): boolean {
    try {
      const d = this.dimOf(b.expr, b.sheetId);
      const declared = this.declaredUnit(b);
      if (!declared) {
        this.dims.set(b.id, d);
        if (d.kind === "num" && !isDimensionless(d.map)) {
          this.unitMaps.set(b.id, { map: d.map, source: "derived" });
        }
        return true;
      }
      const span = declared.span;
      // a boolean is never stored; evaluation reports that as TYPE
      if (d.kind === "bool") return true;
      if (d.kind !== "num") {
        throw new DimError(`a ${d.kind} cannot carry a unit`, span.start, span.end);
      }
      if (b.expr.type === "num" && b.expr.percent) {
        throw new DimError(this.percentMessage(b.expr), b.expr.start, b.expr.end);
      }
      if (!d.unitFree && !sameUnit(d.map, declared.map, this.model.unitDefs)) {
        throw new DimError(
          `${b.name} declares ${formatUnit(declared.map)} but its formula derives ${showUnitMap(d.map)}`,
          b.expr.start,
          b.expr.end,
        );
      }
      this.dims.set(b.id, { ...num(declared.map, false) });
      this.unitMaps.set(b.id, { map: declared.map, source: "declared" });
      return true;
    } catch (e) {
      if (!(e instanceof DimError)) throw e;
      this.fail(b, e);
      return false;
    }
  }

  /** an `assert`'s expression: its comparisons need matching units */
  checkAssertion(node: Binding): boolean {
    try {
      this.dimOf(node.expr, node.sheetId);
      return true;
    } catch (e) {
      if (!(e instanceof DimError)) throw e;
      this.fail({ ...node, name: "" }, e);
      return false;
    }
  }

  /** a chart's value columns must share one unit */
  checkChart(chart: Chart): boolean {
    const units = chart.series.map((col) => {
      const d = this.refDim(chart.sheetId, { name: col });
      return { col, map: d.kind === "num" ? d.map : DIMENSIONLESS };
    });
    const first = units[0];
    if (!first || units.every((u) => sameUnit(u.map, first.map, this.model.unitDefs))) return true;
    this.emit({
      code: "UNIT",
      sheetId: chart.sheetId,
      name: chart.name,
      message:
        `chart ${chart.name} needs one unit across its columns: ` +
        units.map((u) => `${u.col} is ${showUnitMap(u.map)}`).join(", "),
      sourceOffset: chart.span.start,
      span: chart.span,
    });
    return false;
  }

  /** the unit map of a binding the pass has seen, for reports and display rules */
  unitOf(id: string): UnitMap {
    return this.unitMaps.get(id)?.map ?? DIMENSIONLESS;
  }

  /** report definitions no unit anywhere reaches */
  reportUnusedDefinitions(): void {
    const used = new Set<string>();
    const visit = (atom: string): void => {
      if (used.has(atom)) return;
      used.add(atom);
      for (const a of this.model.unitDefs.get(atom)?.keys() ?? []) visit(a);
    };
    for (const a of this.atomsSeen) visit(a);
    for (const d of this.model.unitDefinitions) {
      const p = parseUnit(d.atom.text);
      const atom = p.ok ? [...p.map.keys()][0]! : d.atom.text.trim();
      if (!this.model.unitDefs.has(atom) || used.has(atom)) continue;
      this.emit({
        code: "WARN",
        name: `[${atom}]`,
        message: `[${atom}] is defined and never used`,
        sourceOffset: d.span.start,
        span: d.span,
      });
    }
  }

  // ---- internals ---------------------------------------------------------

  private fail(b: Pick<Binding, "sheetId" | "name">, e: DimError): void {
    this.emit({
      code: "UNIT",
      ...(b.sheetId ? { sheetId: b.sheetId } : {}),
      ...(b.name ? { name: b.name } : {}),
      message: e.message,
      sourceOffset: e.start,
      span: { start: e.start, end: e.end },
    });
  }

  private declaredUnit(b: Binding): { map: UnitMap; span: { start: number; end: number } } | null {
    if (b.kind === "column") {
      const u = this.model.sheets.get(b.sheetId)?.headerUnits.get(b.name);
      return u ? { map: u.map, span: u.text } : null;
    }
    return b.unit ? { map: b.unit.map, span: b.unit.text } : null;
  }

  private percentMessage(lit: NumberLit): string {
    return `${this.model.source.slice(lit.start, lit.end)} is a ratio and cannot carry a unit`;
  }

  private columnKind(sheet: Sheet, name: string): ColumnKind {
    const idx = sheet.columnIndex.get(name);
    const table = sheet.table;
    if (!table || idx === undefined) return "num";
    let kind: ColumnKind | null = null;
    for (const row of table.rows) {
      const t = (row.cells[idx]?.text ?? "").trim();
      if (t === "") continue;
      if (numericValue(t) !== null) return "num";
      kind = /^\d{4}-\d{2}-\d{2}$/.test(t) ? (kind ?? "date") : "string";
    }
    return kind ?? "num";
  }

  private refDim(sheetId: string, ref: { qualifier?: string; name: string }): Dim {
    const r = resolve(this.model, sheetId, ref);
    switch (r.kind) {
      case "column":
      case "scalar":
      case "doc-scalar":
        return this.dims.get(r.binding.id) ?? num(DIMENSIONLESS, true);
      case "input-column": {
        const sheet = this.model.sheets.get(r.sheetId)!;
        const kind = this.columnKind(sheet, r.column);
        if (kind !== "num") return { kind };
        const u = sheet.headerUnits.get(r.column);
        return u ? num(u.map, false) : num(DIMENSIONLESS, true);
      }
      case "unknown":
        return num(DIMENSIONLESS, true);
    }
  }

  private literalDim(e: NumberLit): Dim {
    if (e.unit) {
      const p = parseUnit(e.unit.text);
      if (!p.ok) throw new DimError(p.message, e.unit.start, e.unit.end);
      for (const a of p.map.keys()) this.atomsSeen.add(a);
      return num(p.map, false);
    }
    return {
      kind: "num",
      map: DIMENSIONLESS,
      unitFree: true,
      zeroLiteral: !e.percent && new Decimal(e.value).isZero(),
      implicitStep: e.implicitStep === true,
    };
  }

  dimOf(e: Expr, sheetId: string): Dim {
    switch (e.type) {
      case "num":
        return this.literalDim(e);
      case "date":
        return { kind: "date" };
      case "str":
        return { kind: "string" };
      case "ref":
        return this.refDim(sheetId, e);
      case "unary": {
        const d = this.dimOf(e.operand, sheetId);
        if (e.op === "not") return { kind: "bool" };
        return d.kind === "num" ? { ...d, zeroLiteral: d.zeroLiteral, implicitStep: false } : d;
      }
      case "binary":
        return this.binaryDim(e.op, e.left, e.right, sheetId, e);
      case "call":
        return this.callDim(e.name, e.args, sheetId);
    }
  }

  private binaryDim(op: string, left: Expr, right: Expr, sheetId: string, at: Expr): Dim {
    if (op === "and" || op === "or") {
      this.dimOf(left, sheetId);
      this.dimOf(right, sheetId);
      return { kind: "bool" };
    }
    const l = this.dimOf(left, sheetId);
    if (op === "^") return this.powerDim(l, right, sheetId);
    const r = this.dimOf(right, sheetId);

    if (op === "==" || op === "!=" || op === "<" || op === "<=" || op === ">" || op === ">=") {
      if (l.kind === "num" && r.kind === "num") this.matching(op, l, r, at);
      return { kind: "bool" };
    }
    if (op === "+" || op === "-") {
      // date arithmetic is closed and typed: a number added to a date is a
      // count of days whose unit is not checked (spec §3 "Dates")
      if (l.kind === "date" && r.kind === "date") return num(DIMENSIONLESS, true);
      if (l.kind === "date" || r.kind === "date") return { kind: "date" };
      if (l.kind !== "num" || r.kind !== "num") return l.kind !== "num" ? l : r;
      const map = this.matching(op, l, r, at);
      return num(map, l.unitFree && r.unitFree);
    }
    if (l.kind !== "num" || r.kind !== "num") return l.kind !== "num" ? l : r;
    if (op === "*") return num(mulUnits(l.map, r.map), l.unitFree && r.unitFree);
    if (op === "/") return num(divUnits(l.map, r.map), l.unitFree && r.unitFree);
    return num(DIMENSIONLESS, l.unitFree && r.unitFree);
  }

  /** two maps that must agree; a literal `0` agrees with anything */
  private matching(
    op: string,
    l: Dim & { kind: "num" },
    r: Dim & { kind: "num" },
    at: Expr,
  ): UnitMap {
    if (l.zeroLiteral) return r.map;
    if (r.zeroLiteral) return l.map;
    if (sameUnit(l.map, r.map, this.model.unitDefs)) return l.map;
    throw new DimError(
      `${op} needs matching units: ${showUnitMap(l.map)} and ${showUnitMap(r.map)}`,
      at.start,
      at.end,
    );
  }

  private powerDim(base: Dim, exponent: Expr, sheetId: string): Dim {
    const ex = this.dimOf(exponent, sheetId);
    if (base.kind !== "num") return base;
    if (ex.kind === "num" && !isDimensionless(ex.map)) {
      throw new DimError(
        `^ needs a dimensionless exponent, not ${formatUnit(ex.map)}`,
        exponent.start,
        exponent.end,
      );
    }
    if (isDimensionless(base.map))
      return num(DIMENSIONLESS, base.unitFree && ex.kind === "num" && ex.unitFree);
    const lit = exponent.type === "num" && !exponent.unit && !exponent.percent ? exponent : null;
    const n = lit ? new Decimal(lit.value) : null;
    if (!n || !n.isInteger() || n.isNegative()) {
      throw new DimError(
        `^ needs a literal exponent when its base has a unit (${formatUnit(base.map)})`,
        exponent.start,
        exponent.end,
      );
    }
    return num(powUnit(base.map, n.toNumber()), false);
  }

  private callDim(name: string, args: Expr[], sheetId: string): Dim {
    const entry = describeFunction(name);
    const ds = args.map((a) => this.dimOf(a, sheetId));
    if (!entry) return num(DIMENSIONLESS, true);
    const unitFree = ds.every((d) => d.kind !== "num" || d.unitFree);
    const vars = new Map<string, { map: UnitMap; from: Dim }>();
    let carried: Dim | null = null; // a date or string passing through a `U` slot

    entry.params.forEach((p, i) => {
      const sig: UnitSig | undefined = entry.units.params[p.name];
      const d = ds[i];
      const at = args[i];
      if (!sig || !d || !at) return;
      if (sig.kind === "any" || sig.kind === "type") return;
      if (d.kind !== "num") {
        if (sig.kind === "var") carried ??= d;
        return;
      }
      if (sig.kind === "dimensionless") {
        if (!isDimensionless(d.map)) {
          throw new DimError(
            `${name}'s ${p.name} must be dimensionless, not ${formatUnit(d.map)}`,
            at.start,
            at.end,
          );
        }
        return;
      }
      // a `U` slot: unify, raising to `pow` first
      if (d.zeroLiteral || d.implicitStep) return;
      let map = d.map;
      if (sig.pow && sig.pow !== 1) {
        const root = sig.pow === 2 ? halveUnit(d.map) : null;
        if (!root) {
          const odd = new Map([...d.map].filter(([, e]) => e % 2 !== 0));
          throw new DimError(
            `${name} needs even exponents; ${formatUnit(odd)} has an odd one`,
            at.start,
            at.end,
          );
        }
        map = root;
      }
      const seen = vars.get(sig.name);
      if (!seen) {
        vars.set(sig.name, { map, from: d });
        return;
      }
      if (!sameUnit(seen.map, map, this.model.unitDefs)) {
        const what = name === "IF" ? "IF's branches need" : `${name} needs`;
        throw new DimError(
          `${what} matching units: ${showUnitMap(seen.map)} and ${showUnitMap(map)}`,
          at.start,
          at.end,
        );
      }
    });

    const ret = entry.units.returns;
    switch (ret.kind) {
      case "dimensionless":
        return num(DIMENSIONLESS, unitFree);
      case "type":
        return { kind: ret.type };
      case "any":
        return num(DIMENSIONLESS, unitFree);
      case "var": {
        const v = vars.get(ret.name);
        if (!v && carried) return carried;
        const map = v
          ? ret.pow && ret.pow !== 1
            ? powUnit(v.map, ret.pow)
            : v.map
          : DIMENSIONLESS;
        return num(map, unitFree);
      }
    }
  }
}
