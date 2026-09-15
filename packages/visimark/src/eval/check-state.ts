import type { DocumentFile } from "../fs/reader.js";
import type { Assertion, DocModel, Finding } from "../model/types.js";
import type { Unit } from "./units.js";
import type { Value } from "./value.js";

/**
 * `doc` is where the document lives *and* the `ReaderPort` that reaches the
 * files around it — required to resolve and compare artifacts, and to read
 * declared imports. Without it charts are still validated and imports are
 * still accepted, but nothing on disk can be looked at, so staleness cannot be
 * judged and no import is read.
 *
 * It is one field, not a path plus an optional reader, so that "this document
 * is not on a filesystem" is a single condition every phase branches on the
 * same way. The browser playground is the caller that leaves it out; see
 * `fs/reader.ts`.
 */
export interface CheckOptions {
  doc?: DocumentFile;
}

/** one entry per `chart` declaration, in document order */
export interface ChartResult {
  sheetId: string;
  name: string;
  engine: string;
  series: string[];
  labels: string;
  /** the path as the document wrote it, or null when there is no image line */
  path: string | null;
  state: "current" | "stale" | "missing" | "error" | "skipped";
  /** absolute target, present when the path passed the gate */
  target?: string;
  /** the rendered artifact, present when it built — `fmt` writes this */
  svg?: string;
}

/**
 * The assertion bookkeeping, which the binding loop fills in and the
 * unreachable-assertion pass finishes. It is its own object rather than four
 * more `CheckState` fields because no other phase has any business in it.
 */
export interface AssertionLedger {
  /** every assertion by binding id, so an unreached one can still be reported */
  readonly byId: Map<string, Assertion>;
  /** assertions the binding loop actually evaluated */
  readonly handled: Set<string>;
  readonly results: Map<string, AssertionResult>;
  /** per-sheet count of assertions not evaluated because a dependency failed */
  readonly suppressed: Map<string, number>;
  bumpSuppressed(sheetId: string): void;
}

export interface AssertionResult {
  sheetId: string;
  /** the `assert …` line verbatim */
  source: string;
  /** `true` / `false`, or `null` when a dependency stopped it being evaluated */
  holds: boolean | null;
  /** each named operand in the expression → its evaluated value */
  operands: Record<string, string>;
  /** the expression as written with each named operand replaced by its value;
   *  equals the bare expression when `holds` is `null` */
  substituted: string;
}

export function newAssertionLedger(model: DocModel): AssertionLedger {
  const byId = new Map<string, Assertion>();
  for (const sheet of model.sheets.values()) {
    for (const a of sheet.assertions) byId.set(a.id, a);
  }
  const suppressed = new Map<string, number>();
  return {
    byId,
    handled: new Set(),
    results: new Map(),
    suppressed,
    bumpSuppressed(sheetId) {
      suppressed.set(sheetId, (suppressed.get(sheetId) ?? 0) + 1);
    },
  };
}

/**
 * Routing hints carried alongside a finding. They are not part of the finding
 * itself because they exist only to let `orderFindings` sort a flat list back
 * into document order; nothing downstream of `check()` ever sees them.
 */
export interface EmitExtra {
  sheetId?: string;
  rowIndex?: number;
  isColumnCell?: boolean;
}

/** one emitted finding plus the tie-breaker that keeps ordering deterministic */
export interface Entry extends EmitExtra {
  f: Finding;
  /** monotonic emit counter — `orderFindings` sorts on it, so it is the record
   *  of the order phases actually ran in. Never reassign it. */
  det: number;
}

/**
 * The accumulator set `check()` fills in, passed between its phases.
 *
 * Every field is `readonly` in the sense that the *binding* never moves — the
 * maps and sets themselves stay mutable, because `CheckResult` hands these very
 * objects out to callers rather than copying them. Reassigning one here would
 * silently detach it from the result.
 *
 * A phase never takes this whole type. It takes a `Pick<>` of exactly what it
 * reads and writes, so its signature states its reach; passing the full state
 * around would make every boundary nominal, since all of it is mutable and
 * shared.
 */
export interface CheckState {
  readonly model: DocModel;
  readonly opts: CheckOptions;
  /** document-level write precision, the fallback when a column infers none */
  readonly fallbackPrecision: number;

  // --- the accumulators CheckResult is built from ---
  readonly values: Map<string, Value>;
  readonly cells: Map<string, (Value | null)[]>;
  readonly columnPrecision: Map<string, number>;
  readonly scalarPrecision: Map<string, number>;
  /** inferred display decoration per column, keyed `sheet.Column` */
  readonly columnUnits: Map<string, Unit | null>;
  /** inferred display decoration per anchored scalar, keyed by binding id */
  readonly scalarUnits: Map<string, Unit | null>;
  /** column ids whose cells disagree about their decoration */
  readonly unitConflicts: Set<string>;

  // --- private to evaluation ---
  /** bindings whose formula could not be evaluated, so readers must not try */
  readonly unevaluable: Set<string>;
  readonly staleScalars: Set<string>;
  /** `sheet.Column#row` keys already reported, so one bad date is one finding */
  readonly dateErrorRows: Set<string>;
  /** charts whose operands resolved — the artifact pass picks these up */
  readonly buildableCharts: Set<string>;

  emit(f: Finding, extra?: EmitExtra): void;
}

/** the mutable list `emit` appends to, kept out of `CheckState` so no phase can
 *  reorder or rewrite what an earlier phase emitted */
export function newCheckState(
  model: DocModel,
  opts: CheckOptions,
  fallbackPrecision: number,
  entries: Entry[],
): CheckState {
  let det = 0;
  return {
    model,
    opts,
    fallbackPrecision,
    values: new Map(),
    cells: new Map(),
    columnPrecision: new Map(),
    scalarPrecision: new Map(),
    columnUnits: new Map(),
    scalarUnits: new Map(),
    unitConflicts: new Set(),
    unevaluable: new Set(),
    staleScalars: new Set(),
    dateErrorRows: new Set(),
    buildableCharts: new Set(),
    emit(f, extra = {}) {
      entries.push({ f, det: det++, ...extra });
    },
  };
}
