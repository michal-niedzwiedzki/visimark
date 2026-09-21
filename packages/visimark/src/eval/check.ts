import { Decimal } from "decimal.js";
import type { Expr, Ref } from "../lang/ast.js";
import { NO_FORMULAS_MARKER, type RawTable, type Span } from "../parse/document.js";
import {
  type Assertion,
  type Binding,
  type DocModel,
  type Finding,
  isProblem,
  type Sheet,
} from "../model/types.js";
import { closest } from "../report/levenshtein.js";
import { evalExpr, type EvalEnv } from "./evaluate.js";
import { describeCallProblem, FUNCTIONS, isReduce } from "./functions.js";
import { dependencies, refText, resolve, topoOrder } from "./graph.js";
import { resolveImports } from "../import/resolve.js";
import type { ImportStatus } from "../model/types.js";
import { derivePrecision, type Width } from "./precision.js";
import { applyUnit, cellPrecision, parseDecorated, type Unit } from "./units.js";
import {
  EvalError,
  exceedsWorkingPrecision,
  MAX_SIGNIFICANT_DIGITS,
  num,
  roundToPlaces,
  type Value,
} from "./value.js";
import { coerceInput, lookupVector, rowLabel, Unevaluable } from "./check-lookup.js";
import { checkCharts } from "./check-charts.js";
import { inferDecoration } from "./check-decoration.js";
import {
  reportAnchors,
  reportCycles,
  reportUnreachableAssertions,
  reportUnused,
} from "./check-report.js";
import {
  type AssertionResult,
  type CheckOptions,
  type Entry,
  newAssertionLedger,
  newCheckState,
} from "./check-state.js";

import type { ChartResult } from "./check-state.js";

export type { AssertionResult, CheckOptions, ChartResult } from "./check-state.js";
// `fmt` and the chart pass both need this; it lives with the decoration parser
// it depends on, and is re-exported here because callers have always found it here.
export { decimalPlaces } from "./units.js";

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
  /** one entry per `assert` statement, in document order */
  assertions: AssertionResult[];
  /** one entry per `chart` declaration, in document order */
  charts: ChartResult[];
  /** resolution outcome of every imported (`from`) sheet, keyed by sheet id */
  imports: Map<string, ImportStatus>;
  exitCode: 0 | 1;
}

const PERCENT_RE = /^(\d+(?:\.\d+)?)%$/;

export function check(model: DocModel, opts: CheckOptions = {}): CheckResult {
  // Imported sheets must be resolved — their table, column index, and input
  // columns populated from the CSV — before the dependency graph is built,
  // since every binding that reads an imported column needs that column to
  // already be visible to name resolution (graph.ts).
  const imported = resolveImports(model, opts.doc);

  const { order, cycles, assertionIds, chartIds } = topoOrder(model);

  const ledger = newAssertionLedger(model);

  const entries: Entry[] = [];
  const st = newCheckState(model, opts, entries);
  // Phases still reach these by their old names. Each is the object living in
  // `st`, not a copy — `CheckResult` hands the same instances to the caller.
  const {
    values,
    cells,
    unevaluable,
    columnPrecision,
    scalarPrecision,
    columnUnits,
    scalarUnits,
    unitConflicts,
    staleScalars,
    buildableCharts,
  } = st;
  const emit = st.emit;

  // structural findings carried from the model (SHEET, binding parse errors)
  for (const f of model.findings) emit(f);
  for (const f of imported.findings) emit(f, { sheetId: f.sheetId });

  emitCoverage(model, emit);

  inferDecoration(st);
  // An input column's precision is its cells' — they are the visible values, so
  // the inference is exact. It has to land before the dependency walk, since a
  // rule reading the column derives its own width from this.
  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, idx] of sheet.columnIndex) {
      if (sheet.columns.has(name)) continue; // a rule column takes its own
      const prec = inferColumnPrecision(table, idx);
      if (prec !== null) columnPrecision.set(`${sheet.id}.${name}`, prec);
    }
  }

  const sheetSeen: string[] = [];

  for (const binding of order) {
    const sheet = model.sheets.get(binding.sheetId);
    if (binding.sheetId && !sheetSeen.includes(binding.sheetId)) {
      sheetSeen.push(binding.sheetId);
    }
    const dep = dependencies(model, binding);

    if (assertionIds.has(binding.id)) {
      evalAssertion(ledger.byId.get(binding.id)!, binding, dep);
      continue;
    }

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
                ? (closest(call.name, FUNCTIONS.keys(), MAX_FN_SUGGESTION_DISTANCE) ?? undefined)
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
            suggestion: r.kind === "unknown" ? (r.suggestion ?? undefined) : undefined,
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

    // A chart's operands have now been checked for resolution and shape. Its
    // synthetic expression is never evaluated — the artifact is built on its
    // own branch, after this loop.
    if (chartIds.has(binding.id)) {
      buildableCharts.add(binding.id);
      continue;
    }

    // a rule whose operands are in conflict is unverifiable too
    if (
      [...dep.deps].some((d) => unitConflicts.has(d)) ||
      dep.refs.some(
        (r) =>
          r.res.kind === "input-column" && unitConflicts.has(`${r.res.sheetId}.${r.res.column}`),
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

  reportCycles(st, cycles);
  reportUnreachableAssertions(st, ledger, assertionIds);

  // ---- generated artifacts -------------------------------------------------
  // Emits findings, so it runs here and not later: orderFindings sorts on the
  // order phases emitted in.
  const charts = checkCharts(st);

  reportAnchors(st);
  reportUnused(st, entries);

  // An import that was never *attempted* — `state: "skipped"`, meaning no
  // reader was supplied, which is the browser's situation — leaves its sheet
  // with no table at all. Every binding reading a column the CSV would have
  // supplied then fails with UNDEF, and `did you mean` runs its suggestion
  // over a name set missing exactly those columns: on the tutorial's imports
  // chapter that proposed `grand_total` refer to itself, on a document the CLI
  // passes clean (review 2026-09-16 §3.1 row 4 / §4.3).
  //
  // Those findings are consequences of a check that did not happen, so they
  // are dropped here — `checkCharts` already does the same for a `skipped`
  // chart, and this is the suppression that mirrors it. `resolveImports`
  // stays silent about the cause; this is the consequence.
  //
  // **Only "skipped".** An import that genuinely failed has already reported
  // its own IMPORT finding, and its sheet's UNDEFs are real information about
  // a real document; suppressing those would hide a broken import. `state` is
  // the discriminant that keeps the two apart, and it is the reason this is
  // safe. Unreachable from the CLI, which always supplies a reader.
  const neverAttempted = new Set(
    [...imported.statuses.values()].filter((s) => s.state === "skipped").map((s) => s.sheetId),
  );
  const surviving =
    neverAttempted.size === 0
      ? entries
      : entries.filter(
          (e) =>
            !(
              (e.f.code === "UNDEF" || e.f.code === "VECTOR") &&
              e.f.sheetId !== undefined &&
              neverAttempted.has(e.f.sheetId)
            ),
        );

  const findings = orderFindings(surviving, sheetSeen);
  const assertions: AssertionResult[] = [];
  for (const sheet of model.sheets.values()) {
    for (const a of sheet.assertions) {
      const r = ledger.results.get(a.id);
      if (r) assertions.push(r);
    }
  }
  return {
    findings,
    values,
    cells,
    columnPrecision,
    scalarPrecision,
    columnUnits,
    scalarUnits,
    unitConflicts,
    assertions,
    charts,
    imports: imported.statuses,
    exitCode: findings.some(isProblem) ? 1 : 0,
  };

  // ---- helpers bound to the closures above ----

  /**
   * A binding's write precision: declared on the head, else derived from its own
   * expression. `null` means neither — the caller emits `PRECISION`, because no
   * width follows from the formula and only the author can supply one.
   *
   * A binding's *cells* and *anchors* are outputs and are never consulted here.
   * That is the whole point: precision used to come from an anchor's text, which
   * made prose an input to arithmetic. See
   * docs/design/declared-precision-spec.md section 3.
   */
  function governingPrecision(binding: Binding): number | null {
    if (binding.precision !== undefined) return binding.precision;
    const w = derivePrecision(binding.expr, (ref) => refPrecision(binding.sheetId, ref));
    return typeof w === "number" ? w : null;
  }

  function refPrecision(fromSheetId: string, ref: Ref): Width {
    const res = resolve(model, fromSheetId, ref);
    switch (res.kind) {
      case "column":
        return columnPrecision.get(`${res.sheetId}.${res.binding.name}`) ?? null;
      case "input-column":
        return (
          columnPrecision.get(`${res.sheetId}.${res.column}`) ??
          (isDateColumn(model, res.sheetId, res.column) ? "date" : null)
        );
      case "scalar":
      case "doc-scalar":
        return (
          scalarPrecision.get(res.binding.id) ??
          (values.get(res.binding.id)?.t === "date" ? "date" : null)
        );
      default:
        return null;
    }
  }

  /**
   * A `param` must declare its width, and its default must fit it: a value
   * arriving from outside has no width the document can derive, and a default
   * the declaration would round is not the value the reader sees. Emits the
   * `PRECISION` finding and returns false otherwise. See
   * docs/design/scenario-params-spec.md §3.1 and §4.1.
   */
  function paramWidthOk(binding: Binding): boolean {
    const param = binding.param!;
    if (binding.precision === undefined) {
      emit(
        {
          code: "PRECISION",
          sheetId: binding.sheetId,
          name: binding.name,
          message: `param ${binding.name} declares no width`,
          suggestion: `param ${binding.name} precision N = default …`,
          span: binding.span,
        },
        { sheetId: binding.sheetId },
      );
      return false;
    }
    const value = binding.expr.type === "num" ? new Decimal(binding.expr.value) : null;
    const places = value?.decimalPlaces() ?? 0;
    if (places > binding.precision) {
      emit(
        {
          code: "PRECISION",
          sheetId: binding.sheetId,
          name: binding.name,
          message: `default ${param.text} has ${places} decimal${places === 1 ? "" : "s"}; param ${binding.name} declares ${binding.precision}`,
          span: binding.span,
        },
        { sheetId: binding.sheetId },
      );
      return false;
    }
    return true;
  }

  /** the `PRECISION` finding: no declared width, and none follows from the formula */
  function emitNotDerivable(binding: Binding): void {
    emit(
      {
        code: "PRECISION",
        sheetId: binding.sheetId,
        name: binding.name,
        raw: formulaSource(model, binding),
        span: binding.span,
      },
      { sheetId: binding.sheetId },
    );
  }

  /**
   * The `PRECISION` finding's other trigger: the width is known, but honouring
   * it here would print digits the engine never computed. Reported rather than
   * padded — a fabricated tail is exactly the claim this feature removes.
   */
  function emitCeiling(binding: Binding, places: number, rowLabel?: string): void {
    emit(
      {
        code: "PRECISION",
        sheetId: binding.sheetId,
        name: binding.name,
        ...(rowLabel === undefined ? {} : { rowLabel }),
        message: `this value is too large to carry ${places} decimal${places === 1 ? "" : "s"}: ${places} decimals past its integer digits exceeds the ${MAX_SIGNIFICANT_DIGITS}-significant-digit working precision`,
        span: binding.span,
      },
      { sheetId: binding.sheetId },
    );
  }

  function evalColumn(binding: Binding, sheet: Sheet, table: RawTable): void {
    const colId = `${sheet.id}.${binding.name}`;
    const idx = sheet.columnIndex.get(binding.name)!;
    // A rule column's cells are outputs, so they cannot be its precision source.
    // `null` means no width follows from the formula — but that is only a
    // problem if the column actually produces numbers. A date or string column
    // has no width to declare, so the finding waits until a row proves one is
    // needed.
    const prec = governingPrecision(binding);
    if (prec !== null) columnPrecision.set(colId, prec);
    let needsWidth = false;
    const unit = columnUnits.get(colId) ?? null;
    const suppressed = unitConflicts.has(colId);
    const out: (Value | null)[] = [];
    // rows left unevaluable by an *upstream* dependency error, not by a row's
    // own error (which already carries its per-row finding)
    let suppressedUpstream = 0;

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
        if (prec === null && v0.t === "num") needsWidth = true;
        if (prec !== null && v0.t === "num" && exceedsWorkingPrecision(v0.d, prec)) {
          emitCeiling(binding, prec, rowLabel(table, r));
          unevaluable.add(binding.id);
          return;
        }
        const v = prec === null ? v0 : roundValue(v0, prec);
        out.push(v);
        const cell = table.rows[r]!.cells[idx];
        const storedText = cell?.text ?? "";
        if (
          !suppressed &&
          prec !== null &&
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
          suppressedUpstream++;
        } else if (e instanceof EvalError) {
          out.push(null);
          const cell = table.rows[r]?.cells[idx];
          emit(
            {
              code: e.code,
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

    if (needsWidth) {
      emitNotDerivable(binding);
      unevaluable.add(binding.id);
      return;
    }

    if (suppressedUpstream > 0) {
      emit(
        {
          code: "NOTE",
          sheetId: sheet.id,
          name: binding.name,
          suppressedCount: suppressedUpstream,
          message: `${suppressedUpstream} row${suppressedUpstream === 1 ? "" : "s"} not verified (upstream DATE errors)`,
        },
        { sheetId: sheet.id },
      );
    }
  }

  function evalScalar(binding: Binding): void {
    if (binding.param !== undefined && !paramWidthOk(binding)) {
      unevaluable.add(binding.id);
      return;
    }
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
      // The anchor supplies the *unit* and nothing else. Its text used to supply
      // the precision too, which made a `0` placeholder in prose round the
      // stored value and move every figure downstream of it.
      const prec = governingPrecision(binding);
      if (prec !== null) scalarPrecision.set(binding.id, prec);
      // A scalar rounds only where it materialises. An unanchored working value
      // — `Lmax = SQRT(...)`, feeding an anchored `ROUND(Lmax, 2)` — is never
      // written, so it has no write precision to declare and nothing to
      // disagree with; it keeps full precision, as it always has. Requiring a
      // declaration there would round an intermediate for no reader's benefit.
      if (prec === null && anchorText !== undefined && v0.t === "num") {
        emitNotDerivable(binding);
        unevaluable.add(binding.id);
        return;
      }
      if (prec !== null && v0.t === "num" && exceedsWorkingPrecision(v0.d, prec)) {
        emitCeiling(binding, prec);
        unevaluable.add(binding.id);
        return;
      }
      const v = prec === null ? v0 : roundValue(v0, prec);
      values.set(binding.id, v);

      if (anchorText !== undefined && prec !== null && !matchesStored(v, anchorText, prec)) {
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
            code: e.code,
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
      vector: (ref) => lookupVector(st, binding, ref),
    };
  }

  function evalAssertion(a: Assertion, node: Binding, dep: ReturnType<typeof dependencies>): void {
    ledger.handled.add(a.id);
    const base = { sheetId: a.sheetId, source: a.source, span: a.span } as const;
    const record = (holds: boolean | null): void => {
      ledger.results.set(a.id, {
        sheetId: a.sheetId,
        source: a.source,
        holds,
        operands: holds === null ? {} : operandMap(node),
        substituted: holds === null ? payloadOf(a) : substituteOperands(node),
      });
    };

    if (dep.callErrors.length > 0) {
      record(null);
      for (const { call, problem } of dep.callErrors) {
        emit(
          {
            ...base,
            code: "TYPE",
            message: describeCallProblem(call.name, problem),
            suggestion:
              problem.kind === "unknown"
                ? (closest(call.name, FUNCTIONS.keys(), MAX_FN_SUGGESTION_DISTANCE) ?? undefined)
                : undefined,
            span: { start: call.start, end: call.end },
          },
          { sheetId: a.sheetId },
        );
      }
      return;
    }
    if (dep.undefRefs.length > 0) {
      record(null);
      for (const ref of dep.undefRefs) {
        const r = resolve(model, a.sheetId, ref);
        emit(
          {
            ...base,
            code: "UNDEF",
            raw: refText(ref),
            suggestion: r.kind === "unknown" ? (r.suggestion ?? undefined) : undefined,
            span: { start: ref.start, end: ref.end },
          },
          { sheetId: a.sheetId },
        );
      }
      return;
    }
    if (dep.vectorRefs.length > 0) {
      record(null);
      for (const ref of dep.vectorRefs) {
        emit(
          { ...base, code: "VECTOR", raw: refText(ref), span: { start: ref.start, end: ref.end } },
          { sheetId: a.sheetId },
        );
      }
      return;
    }
    if ([...dep.deps].some((d) => unevaluable.has(d))) {
      record(null);
      ledger.bumpSuppressed(a.sheetId);
      return;
    }

    try {
      const v = evalExpr(node.expr, scalarEnv(node));
      if (v.t !== "bool") {
        record(null);
        emit(
          {
            ...base,
            code: "TYPE",
            message: `assert needs a boolean; \`${payloadOf(a)}\` is ${typeWord(v)}`,
          },
          { sheetId: a.sheetId },
        );
        return;
      }
      record(v.b);
      if (v.b === false) {
        emit(
          { ...base, code: "ASSERT", message: substituteOperands(node) },
          { sheetId: a.sheetId },
        );
      }
    } catch (e) {
      if (e instanceof Unevaluable) {
        record(null);
        ledger.bumpSuppressed(a.sheetId);
      } else if (e instanceof EvalError) {
        record(null);
        emit({ ...base, code: e.code, message: e.message }, { sheetId: a.sheetId });
      } else throw e;
    }
  }

  function operandMap(node: Binding): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (n: Expr): void => {
      if (n.type === "ref") out[refText(n)] = operandText(node, n);
      else if (n.type === "unary") walk(n.operand);
      else if (n.type === "binary") {
        walk(n.left);
        walk(n.right);
      } else if (n.type === "call") n.args.forEach(walk);
    };
    walk(node.expr);
    return out;
  }

  /** the assertion source with the leading `assert` keyword stripped */
  function payloadOf(a: Assertion): string {
    return a.source.replace(/^assert\s+/, "");
  }

  function typeWord(v: Value): string {
    return v.t === "num" ? "a number" : v.t === "date" ? "a date" : "a string";
  }

  /** the assertion expression as written, each named ref replaced by its value */
  function substituteOperands(node: Binding): string {
    const from = node.expr.start;
    let text = model.source.slice(node.expr.start, node.expr.end);
    const subs: { at: number; to: number; text: string }[] = [];
    const walk = (n: Expr): void => {
      switch (n.type) {
        case "ref": {
          subs.push({ at: n.start - from, to: n.end - from, text: operandText(node, n) });
          break;
        }
        case "unary":
          walk(n.operand);
          break;
        case "binary":
          walk(n.left);
          walk(n.right);
          break;
        case "call":
          n.args.forEach(walk);
          break;
      }
    };
    walk(node.expr);
    subs.sort((x, y) => y.at - x.at);
    for (const s of subs) text = text.slice(0, s.at) + s.text + text.slice(s.to);
    return text;
  }

  function operandText(node: Binding, ref: Ref): string {
    let v: Value;
    try {
      v = lookupScalar(node, ref, null);
    } catch {
      return refText(ref);
    }
    if (v.t === "date") return v.iso;
    if (v.t === "str") return v.s;
    if (v.t === "bool") return String(v.b);
    const res = resolve(model, node.sheetId, ref);
    const pid = res.kind === "scalar" || res.kind === "doc-scalar" ? res.binding.id : undefined;
    // no document default to fall back on: render the value's own scale
    const prec = (pid !== undefined ? scalarPrecision.get(pid) : undefined) ?? v.d.decimalPlaces();
    return showValue(v, prec);
  }

  function rowEnv(binding: Binding, sheet: Sheet, row: number): EvalEnv {
    return {
      scalar: (ref) => lookupScalar(binding, ref, { sheet, row }),
      vector: (ref) => lookupVector(st, binding, ref),
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
    return coerceInput(st, cell?.text ?? "", ctx.sheet.id, res.column, ctx.row, cell);
  }
}

// ---------------------------------------------------------------------------

function orderFindings(entries: Entry[], sheetOrder: string[]): Finding[] {
  const staleCells = entries.filter((e) => e.f.code === "STALE" && e.isColumnCell);
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
  const sheets = [...new Set([...staleCells, ...staleScalars].map((e) => e.sheetId ?? ""))].sort(
    (a, b) => sheetRank(a) - sheetRank(b),
  );

  for (const sh of sheets) {
    const cellsHere = staleCells.filter((e) => (e.sheetId ?? "") === sh);
    const byRow = new Map<number, typeof cellsHere>();
    for (const e of cellsHere) {
      const arr = byRow.get(e.rowIndex!) ?? [];
      arr.push(e);
      byRow.set(e.rowIndex!, arr);
    }
    const rowGroups = [...byRow.entries()].sort(
      (a, b) => Math.min(...a[1].map((e) => e.det)) - Math.min(...b[1].map((e) => e.det)),
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
    IMPORT: 0,
    DATE: 1,
    UNIT: 1,
    NOTE: 1,
    UNDEF: 1,
    DUP: 1,
    VECTOR: 1,
    CYCLE: 2,
    ASSERT: 2,
    ANCHOR: 3,
    WARN: 4,
  };
  const sectionB = rest
    .slice()
    .sort((a, b) => (CODE_RANK[a.f.code] ?? 9) - (CODE_RANK[b.f.code] ?? 9) || a.det - b.det)
    .map((e) => e.f);

  return [...sectionA, ...sectionB];
}

/**
 * A column's precision read off its own cells — the widest any cell shows.
 * `null` where there is nothing to read: with the document-scope fallback gone,
 * an empty column has no width to invent, and the caller reports that.
 */
export function inferColumnPrecision(table: RawTable, colIndex: number): number | null {
  let max = -1;
  for (const row of table.rows) {
    // The decimals the cell shows, with a percent cell counted by its value —
    // see `cellPrecision`.
    const p = cellPrecision(row.cells[colIndex]?.text ?? "");
    if (p === null) continue;
    max = Math.max(max, p);
  }
  return max === -1 ? null : max;
}

export function roundValue(v: Value, places: number): Value {
  return v.t === "num" ? num(roundToPlaces(v.d, places)) : v;
}

export function matchesStored(v: Value, storedText: string, places: number): boolean {
  const t = storedText.trim();
  if (v.t === "num") {
    const dec = parseDecorated(t);
    if (dec.kind === "number") {
      return roundToPlaces(new Decimal(dec.num), places).equals(roundToPlaces(v.d, places));
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

export function countBindings(model: DocModel): number {
  let n = model.docScope.size;
  for (const sheet of model.sheets.values()) {
    n += sheet.columns.size + sheet.scalars.size + sheet.assertions.length;
  }
  return n;
}

/**
 * A table with no rule attached to it anywhere is the one thing `check` cannot
 * otherwise see: `0 problems` on a document with nothing to disagree with.
 *
 * Two deliberate limits. It is keyed on a table being present, so prose — a
 * README, a changelog, a design note — is never asked for arithmetic it does
 * not have. And it is counted document-wide rather than per-sheet, so a
 * reference table that is legitimately all-input passes as long as some other
 * table in the document carries a rule.
 *
 * The way out is `<!--vmark:no-formulas-->`: the author saying in the document
 * that there is nothing here to derive. That claim is checked like any other —
 * a marked document that has since grown rules is reported, so the marker
 * cannot quietly outlive the state it was written for.
 */
function emitCoverage(model: DocModel, emit: (f: Finding) => void): void {
  const bindings = countBindings(model);
  const marked = model.located.noFormulas !== null;

  if (marked && bindings > 0) {
    emit({
      code: "COVERAGE",
      message: `marked \`${NO_FORMULAS_MARKER}\`, but the document has ${bindings} rule${bindings === 1 ? "" : "s"}`,
      suggestion: "delete the marker — those rules are checked either way",
      span: model.located.noFormulas ?? undefined,
    });
    return;
  }

  if (!marked && bindings === 0 && model.located.tables.length > 0) {
    emit({
      code: "COVERAGE",
      message: "a table with no `vmark` rules — nothing in this document is checked",
      suggestion: `run \`visimark infer\` to derive them, or mark it \`${NO_FORMULAS_MARKER}\``,
    });
  }
}

/**
 * A column that holds dates: at least one cell is an ISO date and none is a
 * number. A malformed date does not disqualify it — `15.10.2026` is reported as
 * a `DATE` error in its own right, and a column of dates with one typo in it is
 * still a column of dates, so a rule reading it still derives `date - date` as
 * a whole number of days.
 */
function isDateColumn(model: DocModel, sheetId: string, name: string): boolean {
  const sheet = model.sheets.get(sheetId);
  const table = sheet?.table;
  const idx = sheet?.columnIndex.get(name);
  if (!table || idx === undefined) return false;
  let seenDate = false;
  for (const row of table.rows) {
    const t = (row.cells[idx]?.text ?? "").trim();
    if (t === "") continue;
    if (cellPrecision(t) !== null) return false; // a number lives here
    if (ISO_DATE_RE.test(t)) seenDate = true;
  }
  return seenDate;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** the binding's expression as written, for a finding that must name it */
function formulaSource(model: DocModel, binding: Binding): string {
  return model.source.slice(binding.expr.start, binding.expr.end);
}

function formulaText(model: DocModel, binding: Binding): string | undefined {
  const isAggregateCall = binding.expr.type === "call" && isReduce(binding.expr.name);
  if (binding.kind !== "column" && !isAggregateCall) return undefined;
  return model.source.slice(binding.expr.start, binding.expr.end);
}

function isCrossSheetAggregate(model: DocModel, binding: Binding): boolean {
  const e = binding.expr;
  if (e.type !== "call" || !isReduce(e.name)) return false;
  const arg = e.args[0];
  if (!arg || arg.type !== "ref") return false;
  const res = resolve(model, binding.sheetId, arg);
  return (res.kind === "column" || res.kind === "input-column") && res.sheetId !== binding.sheetId;
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
