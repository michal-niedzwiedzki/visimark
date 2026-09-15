import { closest } from "../report/levenshtein.js";
import type { AssertionLedger, CheckState, Entry } from "./check-state.js";
import type { Binding, DocModel } from "../model/types.js";
import { resolve } from "./graph.js";
import type { Expr } from "../lang/ast.js";

/**
 * The terminal passes: everything that only reports, after every value that
 * could be computed has been. None of them writes anything a later phase
 * reads, so their order among themselves is the order the findings come out
 * in and nothing more.
 */

/** cycles are reported last so the bindings on them are already marked */
export function reportCycles(
  st: Pick<CheckState, "unevaluable" | "emit">,
  cycles: Binding[][],
): void {
  for (const cyc of cycles) {
    st.emit({
      code: "CYCLE",
      sheetId: cyc[0]?.sheetId,
      cyclePath: cyc.map((b) => b.id),
      span: cyc[0]?.span,
    });
    for (const b of cyc) st.unevaluable.add(b.id);
  }
}

/**
 * Assertions the topological sort could not reach — a dependency is on a
 * cycle, or otherwise never evaluated. One NOTE per sheet, like a column rule.
 */
export function reportUnreachableAssertions(
  st: Pick<CheckState, "emit">,
  ledger: AssertionLedger,
  assertionIds: Set<string>,
): void {
  for (const id of assertionIds) {
    if (ledger.handled.has(id)) continue;
    const a = ledger.byId.get(id)!;
    ledger.results.set(id, {
      sheetId: a.sheetId,
      source: a.source,
      holds: null,
      operands: {},
      substituted: a.source.replace(/^assert\s+/, ""),
    });
    ledger.bumpSuppressed(a.sheetId);
  }
  for (const [sheetId, n] of ledger.suppressed) {
    if (n > 0) {
      st.emit(
        {
          code: "NOTE",
          sheetId,
          suppressedCount: n,
          message: `${n} assertion${n === 1 ? "" : "s"} not verified (upstream errors)`,
        },
        { sheetId },
      );
    }
  }
}

/** anchors: collapse staleness, flag rewrite-less anchors */
export function reportAnchors(st: Pick<CheckState, "model" | "staleScalars" | "emit">): void {
  const chartIdSet = new Set<string>();
  for (const sheet of st.model.sheets.values()) {
    for (const c of sheet.charts) chartIdSet.add(`${c.sheetId}.${c.name}`);
  }
  let staleAnchorCount = 0;
  for (const a of st.model.anchors) {
    const id = `${a.sheetId}.${a.name}`;
    if (st.staleScalars.has(id)) staleAnchorCount++;
    const anchorFinding = (message?: string) =>
      st.emit({
        code: "ANCHOR",
        sheetId: a.sheetId,
        name: a.name,
        sourceOffset: a.commentSpan.start,
        span: a.commentSpan,
        ...(message ? { message } : {}),
      });
    if (a.value === null) {
      anchorFinding();
      continue;
    }
    const isChart = chartIdSet.has(id);
    if (a.value.kind === "image" && !isChart) {
      // an image holds no value to rewrite; only a chart may be anchored to one
      anchorFinding("an image anchor must name a chart");
      continue;
    }
    if (a.value.kind !== "image" && isChart) {
      anchorFinding("a chart must be anchored to an image");
    }
  }
  if (staleAnchorCount > 0) {
    st.emit({ code: "STALE", anchorGroup: true, suppressedCount: staleAnchorCount });
  }
}

/**
 * WARN: a scalar defined, never read, never anchored, and otherwise clean; and
 * an `is` alias declared and never used anywhere.
 *
 * Takes the emitted entries read-only because the scalar warning suppresses
 * itself when some earlier phase already said something about that binding —
 * the one place a terminal pass depends on what came before it.
 */
export function reportUnused(
  st: Pick<CheckState, "model" | "unevaluable" | "emit">,
  entries: readonly Entry[],
): void {
  const { referenced, usedAliases } = collectReferenced(st.model);
  const anchored = new Set(st.model.anchors.map((a) => `${a.sheetId}.${a.name}`));
  for (const sheet of st.model.sheets.values()) {
    for (const b of sheet.scalars.values()) {
      if (referenced.has(b.id) || anchored.has(b.id)) continue;
      if (st.unevaluable.has(b.id)) continue;
      if (entries.some((e) => e.f.sheetId === b.sheetId && e.f.name === b.name)) {
        continue;
      }
      st.emit({
        code: "WARN",
        sheetId: b.sheetId,
        name: b.name,
        suggestion: closest(b.name, [...referenced].map(idName)) ?? undefined,
        span: b.span,
      });
    }
  }

  // WARN: an `is` alias declared and never used anywhere
  for (const sheet of st.model.sheets.values()) {
    for (const [symbol, entry] of sheet.aliases) {
      if (usedAliases.has(`${sheet.id}.${symbol}`)) continue;
      st.emit({ code: "WARN", sheetId: sheet.id, name: symbol, span: entry.span });
    }
  }
}

function collectReferenced(model: DocModel): { referenced: Set<string>; usedAliases: Set<string> } {
  const out = new Set<string>();
  const usedAliases = new Set<string>();
  const markAlias = (sheetId: string, name: string): void => {
    const sheet = model.sheets.get(sheetId);
    if (sheet?.aliases.has(name)) usedAliases.add(`${sheetId}.${name}`);
  };
  const visit = (e: Expr, sheetId: string): void => {
    if (e.type === "ref") {
      markAlias(e.qualifier ?? sheetId, e.name);
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
    for (const a of sheet.assertions) visit(a.expr, a.sheetId);
    for (const c of sheet.charts) {
      for (const full of [...c.series, c.labels]) {
        const dot = full.indexOf(".");
        if (dot === -1) markAlias(c.sheetId, full);
        else markAlias(full.slice(0, dot), full.slice(dot + 1));
      }
    }
  }
  return { referenced: out, usedAliases };
}

function idName(id: string): string {
  const i = id.lastIndexOf(".");
  return i === -1 ? id : id.slice(i + 1);
}
