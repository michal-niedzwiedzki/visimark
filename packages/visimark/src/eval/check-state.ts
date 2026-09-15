import type { DocModel, Finding } from "../model/types.js";
import type { Unit } from "./units.js";
import type { Value } from "./value.js";

/** the document's own path — required to resolve and compare artifacts.
 *  Without it charts are still validated, but staleness cannot be judged. */
export interface CheckOptions {
  docPath?: string;
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
