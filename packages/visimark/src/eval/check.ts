import { Decimal } from "decimal.js";
import type { Expr, Ref } from "../lang/ast.js";
import type { RawTable, Span } from "../parse/document.js";
import type { Binding, DocModel, Finding, Sheet } from "../model/types.js";
import { closest } from "../report/levenshtein.js";
import { parseIsoDate } from "./dates.js";
import { evalExpr, type EvalEnv } from "./evaluate.js";
import { describeCallProblem, FUNCTIONS, isReduce } from "./functions.js";
import { dependencies, refText, resolve, topoOrder } from "./graph.js";
import {
  applyUnit,
  inferColumnUnit,
  numericValue,
  parseDecorated,
  type Unit,
} from "./units.js";
import {
  date,
  EvalError,
  num,
  roundToPlaces,
  str,
  type Value,
  valueEquals,
} from "./value.js";

/** a misspelling this far from a builtin is a different word, not a typo */
const MAX_FN_SUGGESTION_DISTANCE = 2;

/**
 * A boolean lives only between the comparison that produces it and the `IF()`
 * that consumes it. A binding is a storage point — a column cell or an
 * anchored scalar — so a boolean reaching one is an error, not a value to
 * render. See the design doc, section 4.
 */
const BOOLEAN_BINDING_MESSAGE =
  "a boolean cannot be stored; wrap it in `IF()` to produce a number or a string";

export interface CheckOptions {
  /**
   * Fail a document that has zero `vmark` rules anywhere in it — the exact
   * gap the SKILL.md warning describes: `check` reports 0 problems on a
   * document with nothing to disagree with. Checked document-wide, not
   * per-sheet, so a reference sheet that is legitimately all-input never
   * trips it as long as some other sheet in the document carries a rule.
   */
  requireFormulas?: boolean;
}

export interface CheckResult {
  findings: Finding[];
  values: Map<string, Value>;
  cells: Map<string, (Value | null)[]>;
  columnPrecision: Map<string, number>;
  scalarPrecision: Map<string, number>;
  /** inferred display decoration per column, keyed `sheet.Column` */
  columnUnits: Map<string, Unit | null>;
  /** inferred display decoration per anchored scalar, keyed by binding id */
  scalarUnits: Map<string, Unit | null>;
  /** column ids whose cells disagree about their decoration */
  unitConflicts: Set<string>;
  exitCode: 0 | 1;
}

class Unevaluable extends Error {}

const PERCENT_RE = /^(\d+(?:\.\d+)?)%$/;
const DATEISH_RE = /^\d{1,4}[./-]\d{1,4}[./-]\d{1,4}$/;

export function check(model: DocModel, opts: CheckOptions = {}): CheckResult {
  const { order, cycles } = topoOrder(model);

  const values = new Map<string, Value>();
  const cells = new Map<string, (Value | null)[]>();
  const unevaluable = new Set<string>();
  const columnPrecision = new Map<string, number>();
  const scalarPrecision = new Map<string, number>();
  const columnUnits = new Map<string, Unit | null>();
  const scalarUnits = new Map<string, Unit | null>();
  const unitConflicts = new Set<string>();
  const staleScalars = new Set<string>();
  const dateErrorRows = new Set<string>(); // `${sheet}.${col}#${row}` already reported

  interface Entry {
    f: Finding;
    det: number;
    sheetId?: string;
    rowIndex?: number;
    isColumnCell?: boolean;
  }
  const entries: Entry[] = [];
  let det = 0;
  const emit = (f: Finding, extra: Omit<Entry, "f" | "det"> = {}): void => {
    entries.push({ f, det: det++, ...extra });
  };

  // structural findings carried from the model (SHEET, binding parse errors)
  for (const f of model.findings) emit(f);

  if (opts.requireFormulas && countBindings(model) === 0) {
    emit({
      code: "COVERAGE",
      message:
        "document has no `vmark` rules; --require-formulas needs at least one",
    });
  }

  const fallbackPrecision = docPrecision(model);

  // A column's decoration is inferred from its own cells, exactly as write
  // precision is. Input columns count too: a computed neighbour never inherits
  // their decoration, but a reader still sees it.
  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, idx] of sheet.columnIndex) {
      const colId = `${sheet.id}.${name}`;
      const texts = table.rows.map((r) => r.cells[idx]?.text);

      const bothSidesRow = texts.findIndex(
        (t) => parseDecorated(t ?? "").kind === "both-sides",
      );
      if (bothSidesRow !== -1) {
        const cell = table.rows[bothSidesRow]!.cells[idx];
        unitConflicts.add(colId);
        columnUnits.set(colId, null);
        emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, bothSidesRow),
            raw: texts[bothSidesRow],
            message: `\`${texts[bothSidesRow]}\` is decorated on both sides; a unit sits before the number or after it, not both`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
        continue;
      }

      const inferred = inferColumnUnit(texts);
      columnUnits.set(colId, inferred.unit);
      if (inferred.conflict) {
        unitConflicts.add(colId);
        const row = inferred.firstDeviantRow!;
        const cell = table.rows[row]!.cells[idx];
        emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, row),
            raw: texts[row],
            message: `column mixes units: ${inferred.forms.join(" and ")}`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
      }
    }
  }

  const sheetSeen: string[] = [];

  for (const binding of order) {
    const sheet = model.sheets.get(binding.sheetId);
    if (binding.sheetId && !sheetSeen.includes(binding.sheetId)) {
      sheetSeen.push(binding.sheetId);
    }
    const dep = dependencies(model, binding);

    if (dep.callErrors.length > 0) {
      for (const { call, problem } of dep.callErrors) {
        emit(
          {
            code: "TYPE",
            sheetId: binding.sheetId,
            name: binding.name,
            message: describeCallProblem(call.name, problem),
            suggestion:
              problem.kind === "unknown"
                ? closest(
                    call.name,
                    FUNCTIONS.keys(),
                    MAX_FN_SUGGESTION_DISTANCE,
                  ) ?? undefined
                : undefined,
            sourceOffset: call.start,
            span: { start: call.start, end: call.end },
          },
          { sheetId: binding.sheetId },
        );
      }
      unevaluable.add(binding.id);
      continue;
    }

    if (dep.undefRefs.length > 0) {
      for (const ref of dep.undefRefs) {
        const r = resolve(model, binding.sheetId, ref);
        emit(
          {
            code: "UNDEF",
            sheetId: binding.sheetId,
            name: binding.name,
            raw: refText(ref),
            suggestion: r.kind === "unknown" ? r.suggestion ?? undefined : undefined,
            sourceOffset: ref.start,
            span: { start: ref.start, end: ref.end },
          },
          { sheetId: binding.sheetId },
        );
      }
      unevaluable.add(binding.id);
      continue;
    }
    if (dep.vectorRefs.length > 0) {
      for (const ref of dep.vectorRefs) {
        emit(
          {
            code: "VECTOR",
            sheetId: binding.sheetId,
            name: binding.name,
            raw: refText(ref),
            sourceOffset: ref.start,
            span: { start: ref.start, end: ref.end },
          },
          { sheetId: binding.sheetId },
        );
      }
      unevaluable.add(binding.id);
      continue;
    }
    if ([...dep.deps].some((d) => unevaluable.has(d))) {
      unevaluable.add(binding.id);
      continue;
    }

    // a rule whose operands are in conflict is unverifiable too
    if (
      [...dep.deps].some((d) => unitConflicts.has(d)) ||
      dep.refs.some(
        (r) =>
          r.res.kind === "input-column" &&
          unitConflicts.has(`${r.res.sheetId}.${r.res.column}`),
      )
    ) {
      unitConflicts.add(binding.id);
    }

    if (binding.kind === "column" && sheet?.table) {
      evalColumn(binding, sheet, sheet.table);
    } else {
      evalScalar(binding);
    }
  }

  // cycles reported last
  for (const cyc of cycles) {
    emit({
      code: "CYCLE",
      sheetId: cyc[0]?.sheetId,
      cyclePath: cyc.map((b) => b.id),
      span: cyc[0]?.span,
    });
    for (const b of cyc) unevaluable.add(b.id);
  }

  // anchors: collapse staleness, flag rewrite-less anchors
  let staleAnchorCount = 0;
  for (const a of model.anchors) {
    const id = `${a.sheetId}.${a.name}`;
    if (staleScalars.has(id)) staleAnchorCount++;
    if (a.value === null) {
      emit({
        code: "ANCHOR",
        sheetId: a.sheetId,
        name: a.name,
        sourceOffset: a.commentSpan.start,
        span: a.commentSpan,
      });
    }
  }
  if (staleAnchorCount > 0) {
    emit({ code: "STALE", anchorGroup: true, suppressedCount: staleAnchorCount });
  }

  // WARN: a scalar defined, never read, never anchored, and otherwise clean
  const referenced = collectReferenced(model);
  const anchored = new Set(model.anchors.map((a) => `${a.sheetId}.${a.name}`));
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.scalars.values()) {
      if (referenced.has(b.id) || anchored.has(b.id)) continue;
      if (unevaluable.has(b.id)) continue;
      if (entries.some((e) => e.f.sheetId === b.sheetId && e.f.name === b.name)) {
        continue;
      }
      emit({
        code: "WARN",
        sheetId: b.sheetId,
        name: b.name,
        suggestion: closest(b.name, [...referenced].map(idName)) ?? undefined,
        span: b.span,
      });
    }
  }

  const findings = orderFindings(entries, sheetSeen);
  return {
    findings,
    values,
    cells,
    columnPrecision,
    scalarPrecision,
    columnUnits,
    scalarUnits,
    unitConflicts,
    exitCode: findings.length > 0 ? 1 : 0,
  };

  // ---- helpers bound to the closures above ----

  function evalColumn(binding: Binding, sheet: Sheet, table: RawTable): void {
    const colId = `${sheet.id}.${binding.name}`;
    const idx = sheet.columnIndex.get(binding.name)!;
    const prec = inferColumnPrecision(table, idx, fallbackPrecision);
    columnPrecision.set(colId, prec);
    const unit = columnUnits.get(colId) ?? null;
    const suppressed = unitConflicts.has(colId);
    const out: (Value | null)[] = [];

    for (let r = 0; r < table.rows.length; r++) {
      try {
        const v0 = evalExpr(binding.expr, rowEnv(binding, sheet, r));
        if (v0.t === "bool") {
          emit(
            {
              code: "TYPE",
              sheetId: sheet.id,
              name: binding.name,
              message: BOOLEAN_BINDING_MESSAGE,
              span: binding.span,
            },
            { sheetId: sheet.id },
          );
          unevaluable.add(binding.id);
          return;
        }
        const v = roundValue(v0, prec);
        out.push(v);
        const cell = table.rows[r]!.cells[idx];
        const storedText = cell?.text ?? "";
        if (
          !suppressed &&
          storedText !== "" &&
          !matchesStored(v, storedText, prec)
        ) {
          emit(
            {
              code: "STALE",
              sheetId: sheet.id,
              name: binding.name,
              rowLabel: rowLabel(table, r),
              stored: storedText,
              computed: applyUnit(showValue(v, prec), unit),
              formula: formulaText(model, binding),
              span: cell ? { start: cell.start, end: cell.end } : undefined,
            },
            { sheetId: sheet.id, rowIndex: r, isColumnCell: true },
          );
        }
      } catch (e) {
        if (e instanceof Unevaluable) {
          out.push(null);
        } else if (e instanceof EvalError) {
          out.push(null);
          const cell = table.rows[r]?.cells[idx];
          emit(
            {
              code: "TYPE",
              sheetId: sheet.id,
              name: binding.name,
              rowLabel: rowLabel(table, r),
              message: e.message,
              span: cell ? { start: cell.start, end: cell.end } : undefined,
            },
            { sheetId: sheet.id },
          );
        } else throw e;
      }
    }

    cells.set(colId, out);

    const missing = out.filter((v) => v === null).length;
    if (missing > 0) {
      emit(
        {
          code: "NOTE",
          sheetId: sheet.id,
          name: binding.name,
          suppressedCount: missing,
          message: `${missing} row${missing === 1 ? "" : "s"} not verified (upstream DATE errors)`,
        },
        { sheetId: sheet.id },
      );
    }
  }

  function evalScalar(binding: Binding): void {
    try {
      const v0 = evalExpr(binding.expr, scalarEnv(binding));
      if (v0.t === "bool") {
        emit(
          {
            code: "TYPE",
            sheetId: binding.sheetId,
            name: binding.name,
            message: BOOLEAN_BINDING_MESSAGE,
            span: binding.span,
          },
          { sheetId: binding.sheetId },
        );
        unevaluable.add(binding.id);
        return;
      }
      const anchorText = anchorValueText(model, binding.id);
      const anchorUnit =
        anchorText !== undefined
          ? (() => {
              const d = parseDecorated(anchorText);
              return d.kind === "number" ? d.unit : null;
            })()
          : null;
      scalarUnits.set(binding.id, anchorUnit);
      // A scalar rounds only where it has a materialised value to match; an
      // anchor-less constant (e.g. `fx_eur = 4.2650`) keeps full precision.
      const prec =
        anchorText !== undefined
          ? decimalPlaces(anchorText, fallbackPrecision)
          : undefined;
      if (prec !== undefined) scalarPrecision.set(binding.id, prec);
      const v = prec !== undefined ? roundValue(v0, prec) : v0;
      values.set(binding.id, v);

      if (
        anchorText !== undefined &&
        prec !== undefined &&
        !matchesStored(v, anchorText, prec)
      ) {
        staleScalars.add(binding.id);
        if (!isCrossSheetAggregate(model, binding)) {
          emit(
            {
              code: "STALE",
              sheetId: binding.sheetId,
              name: binding.name,
              stored: anchorText,
              computed: applyUnit(showValue(v, prec), anchorUnit),
              formula: formulaText(model, binding),
              span: anchorValueSpanOf(model, binding.id) ?? binding.span,
            },
            { sheetId: binding.sheetId },
          );
        }
      }
    } catch (e) {
      if (e instanceof Unevaluable) {
        unevaluable.add(binding.id);
      } else if (e instanceof EvalError) {
        unevaluable.add(binding.id);
        emit(
          {
            code: "TYPE",
            sheetId: binding.sheetId,
            name: binding.name,
            message: e.message,
            span: binding.span,
          },
          { sheetId: binding.sheetId },
        );
      } else throw e;
    }
  }

  function scalarEnv(binding: Binding): EvalEnv {
    return {
      scalar: (ref) => lookupScalar(binding, ref, null),
      vector: (ref) => lookupVector(binding, ref, null),
    };
  }

  function rowEnv(binding: Binding, sheet: Sheet, row: number): EvalEnv {
    return {
      scalar: (ref) => lookupScalar(binding, ref, { sheet, row }),
      vector: (ref) => lookupVector(binding, ref, { sheet, row }),
    };
  }

  function lookupScalar(
    binding: Binding,
    ref: Ref,
    ctx: { sheet: Sheet; row: number } | null,
  ): Value {
    const res = resolve(model, binding.sheetId, ref);
    if (res.kind === "unknown") throw new Unevaluable();
    if (res.kind === "doc-scalar" || res.kind === "scalar") {
      if (unevaluable.has(res.binding.id)) throw new Unevaluable();
      const v = values.get(res.binding.id);
      if (!v) throw new Unevaluable();
      return v;
    }
    if (res.kind === "column") {
      // row-wise use of a sibling column rule
      if (!ctx) throw new Unevaluable();
      const col = cells.get(res.binding.id);
      const v = col?.[ctx.row];
      if (v == null) throw new Unevaluable();
      return v;
    }
    // input-column
    if (!ctx) throw new Unevaluable();
    const colIdx = ctx.sheet.columnIndex.get(res.column)!;
    const cell = ctx.sheet.table?.rows[ctx.row]?.cells[colIdx];
    return coerceInput(cell?.text ?? "", ctx.sheet.id, res.column, ctx.row, cell);
  }

  function lookupVector(
    binding: Binding,
    ref: Ref,
    _ctx: unknown,
  ): Value[] {
    const res = resolve(model, binding.sheetId, ref);
    if (res.kind === "column") {
      const col = cells.get(res.binding.id);
      if (!col || col.some((v) => v === null)) throw new Unevaluable();
      return col as Value[];
    }
    if (res.kind === "input-column") {
      const sheet = model.sheets.get(res.sheetId)!;
      const colIdx = sheet.columnIndex.get(res.column)!;
      return (sheet.table?.rows ?? []).map((row, r) => {
        const cell = row.cells[colIdx];
        return coerceInput(cell?.text ?? "", sheet.id, res.column, r, cell);
      });
    }
    throw new Unevaluable();
  }

  function coerceInput(
    text: string,
    sheetId: string,
    column: string,
    row: number,
    cell: { start: number; end: number } | undefined,
  ): Value {
    const t = text.trim();
    const n = numericValue(t);
    if (n !== null) return num(n);
    const iso = parseIsoDate(t);
    if (iso.ok) return date(iso.iso);
    if (DATEISH_RE.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const key = `${sheetId}.${column}#${row}`;
      if (!dateErrorRows.has(key)) {
        dateErrorRows.add(key);
        const table = model.sheets.get(sheetId)!.table!;
        emit(
          {
            code: "DATE",
            sheetId,
            name: column,
            rowLabel: rowLabel(table, row),
            raw: t,
            isoFix: iso.ok ? undefined : iso.decidable,
            altA: iso.ok ? undefined : iso.ambiguous?.a,
            altB: iso.ok ? undefined : iso.ambiguous?.b,
            daysApart: iso.ok ? undefined : iso.ambiguous?.daysApart,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId },
        );
      }
      throw new Unevaluable();
    }
    return str(t);
  }
}

// ---------------------------------------------------------------------------

function orderFindings(
  entries: {
    f: Finding;
    det: number;
    sheetId?: string;
    rowIndex?: number;
    isColumnCell?: boolean;
  }[],
  sheetOrder: string[],
): Finding[] {
  const staleCells = entries.filter(
    (e) => e.f.code === "STALE" && e.isColumnCell,
  );
  const staleScalars = entries.filter(
    (e) => e.f.code === "STALE" && !e.isColumnCell && !e.f.anchorGroup,
  );
  const anchorGroup = entries.find((e) => e.f.anchorGroup);
  const rest = entries.filter((e) => e.f.code !== "STALE");

  const sheetRank = (s: string | undefined): number => {
    const i = s ? sheetOrder.indexOf(s) : -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const sectionA: Finding[] = [];
  const sheets = [
    ...new Set([...staleCells, ...staleScalars].map((e) => e.sheetId ?? "")),
  ].sort((a, b) => sheetRank(a) - sheetRank(b));

  for (const sh of sheets) {
    const cellsHere = staleCells.filter((e) => (e.sheetId ?? "") === sh);
    const byRow = new Map<number, typeof cellsHere>();
    for (const e of cellsHere) {
      const arr = byRow.get(e.rowIndex!) ?? [];
      arr.push(e);
      byRow.set(e.rowIndex!, arr);
    }
    const rowGroups = [...byRow.entries()].sort(
      (a, b) =>
        Math.min(...a[1].map((e) => e.det)) - Math.min(...b[1].map((e) => e.det)),
    );
    for (const [, group] of rowGroups) {
      group.sort((a, b) => a.det - b.det);
      for (const e of group) sectionA.push(e.f);
    }
    staleScalars
      .filter((e) => (e.sheetId ?? "") === sh)
      .sort((a, b) => a.det - b.det)
      .forEach((e) => sectionA.push(e.f));
  }
  if (anchorGroup) sectionA.push(anchorGroup.f);

  const CODE_RANK: Record<string, number> = {
    COVERAGE: 0,
    SHEET: 0,
    TYPE: 0,
    DATE: 1,
    UNIT: 1,
    NOTE: 1,
    UNDEF: 1,
    DUP: 1,
    VECTOR: 1,
    CYCLE: 2,
    ANCHOR: 3,
    WARN: 4,
  };
  const sectionB = rest
    .slice()
    .sort(
      (a, b) =>
        (CODE_RANK[a.f.code] ?? 9) - (CODE_RANK[b.f.code] ?? 9) ||
        a.det - b.det,
    )
    .map((e) => e.f);

  return [...sectionA, ...sectionB];
}

export function inferColumnPrecision(
  table: RawTable,
  colIndex: number,
  fallback: number,
): number {
  let max = -1;
  for (const row of table.rows) {
    const text = row.cells[colIndex]?.text ?? "";
    const dec = parseDecorated(text);
    if (dec.kind !== "number") continue;
    max = Math.max(max, decimalPlaces(dec.num, fallback));
  }
  return max === -1 ? fallback : max;
}

export function decimalPlaces(text: string, fallback: number): number {
  const dec = parseDecorated(text);
  const t = (dec.kind === "number" ? dec.num : text).trim();
  const m = /\.(\d+)\s*$/.exec(t);
  if (m) return m[1]!.length;
  if (/^-?\d+$/.test(t)) return 0;
  return fallback;
}

export function roundValue(v: Value, places: number): Value {
  return v.t === "num" ? num(roundToPlaces(v.d, places)) : v;
}

export function matchesStored(v: Value, storedText: string, places: number): boolean {
  const t = storedText.trim();
  if (v.t === "num") {
    const dec = parseDecorated(t);
    if (dec.kind === "number") {
      return roundToPlaces(new Decimal(dec.num), places).equals(
        roundToPlaces(v.d, places),
      );
    }
    if (!PERCENT_RE.test(t)) return false;
    const stored = new Decimal(PERCENT_RE.exec(t)![1]!).div(100);
    return roundToPlaces(stored, places).equals(roundToPlaces(v.d, places));
  }
  if (v.t === "date") return t === v.iso;
  // Unreachable: a boolean never reaches a binding, so it is never stored.
  if (v.t === "bool") return t === String(v.b);
  return t === v.s;
}

export function showValue(v: Value, places: number): string {
  if (v.t === "num") return v.d.toFixed(places);
  if (v.t === "date") return v.iso;
  // Unreachable, as above; the branch keeps the formatter total over `Value`.
  if (v.t === "bool") return String(v.b);
  return v.s;
}

function rowLabel(table: RawTable, row: number): string {
  return table.rows[row]?.cells[0]?.text ?? `row ${row + 1}`;
}

export function countBindings(model: DocModel): number {
  let n = model.docScope.size;
  for (const sheet of model.sheets.values()) {
    n += sheet.columns.size + sheet.scalars.size;
  }
  return n;
}

function docPrecision(model: DocModel): number {
  const p = model.docScope.get("precision");
  if (p && p.expr.type === "num") return Number(p.expr.value);
  return 2;
}

function formulaText(model: DocModel, binding: Binding): string | undefined {
  const isAggregateCall =
    binding.expr.type === "call" && isReduce(binding.expr.name);
  if (binding.kind !== "column" && !isAggregateCall) return undefined;
  return model.source.slice(binding.expr.start, binding.expr.end);
}

function isCrossSheetAggregate(model: DocModel, binding: Binding): boolean {
  const e = binding.expr;
  if (e.type !== "call" || !isReduce(e.name)) return false;
  const arg = e.args[0];
  if (!arg || arg.type !== "ref") return false;
  const res = resolve(model, binding.sheetId, arg);
  return (
    (res.kind === "column" || res.kind === "input-column") &&
    res.sheetId !== binding.sheetId
  );
}

function anchorValueSpanOf(model: DocModel, id: string): Span | undefined {
  for (const a of model.anchors) {
    if (`${a.sheetId}.${a.name}` === id && a.value) {
      return { start: a.value.start, end: a.value.end };
    }
  }
  return undefined;
}

function anchorValueText(model: DocModel, id: string): string | undefined {
  for (const a of model.anchors) {
    if (`${a.sheetId}.${a.name}` === id && a.value) {
      return model.source.slice(a.value.start, a.value.end);
    }
  }
  return undefined;
}

function collectReferenced(model: DocModel): Set<string> {
  const out = new Set<string>();
  const visit = (e: Expr, sheetId: string): void => {
    if (e.type === "ref") {
      const r = resolve(model, sheetId, e);
      if (r.kind === "scalar" || r.kind === "doc-scalar" || r.kind === "column") {
        out.add(r.binding.id);
      }
    } else if (e.type === "unary") visit(e.operand, sheetId);
    else if (e.type === "binary") {
      visit(e.left, sheetId);
      visit(e.right, sheetId);
    } else if (e.type === "call") for (const a of e.args) visit(a, sheetId);
  };
  for (const b of model.docScope.values()) visit(b.expr, b.sheetId);
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.columns.values()) visit(b.expr, b.sheetId);
    for (const b of sheet.scalars.values()) visit(b.expr, b.sheetId);
  }
  return out;
}

function idName(id: string): string {
  const i = id.lastIndexOf(".");
  return i === -1 ? id : id.slice(i + 1);
}
