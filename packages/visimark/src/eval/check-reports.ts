import type { CheckState } from "./check-state.js";
import { refText, resolve } from "./graph.js";

/**
 * Resolves every `REF` a `report` statement names. A report reads a scalar: a
 * ref that resolves to nothing is `UNDEF` (with the same did-you-mean an
 * expression's unknown name gets), and a ref that resolves to a column is
 * `TYPE`. Findings carry the sheet and no `name`, as `chart` findings do. A
 * report is not a graph node, so this pass adds no dependency edge and cannot
 * introduce a cycle. See
 * docs/design/lattice-on-param-and-report-statements-spec.md §3.3 and §4.2.
 *
 * A bare `deltas` (no `on`) reads the scalars of its own sheet that are not
 * params; in a sheet with none it has nothing to read and is `TYPE`. The rule
 * stays silent for a sheet that lost a line to a parse error, which may have
 * been that scalar. See docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md.
 *
 * It emits findings, so it keeps its position in the phase sequence —
 * `orderFindings` sorts on emit order.
 */
export function checkReports(st: Pick<CheckState, "model" | "emit">): void {
  for (const sheet of st.model.sheets.values()) {
    for (const report of sheet.reports) {
      if (
        report.options.kind === "deltas" &&
        report.options.on.length === 0 &&
        !sheet.droppedLines &&
        ![...sheet.scalars.values()].some((b) => b.param === undefined)
      ) {
        st.emit(
          {
            code: "TYPE",
            sheetId: report.sheetId,
            message:
              "`report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …`",
            sourceOffset: report.span.start,
            span: report.span,
          },
          { sheetId: report.sheetId },
        );
      }
      for (const ref of report.refs) {
        const res = resolve(st.model, report.sheetId, ref);
        if (res.kind === "unknown") {
          st.emit(
            {
              code: "UNDEF",
              sheetId: report.sheetId,
              raw: refText(ref),
              suggestion: res.suggestion ?? undefined,
              sourceOffset: ref.start,
              span: { start: ref.start, end: ref.end },
            },
            { sheetId: report.sheetId },
          );
        } else if (res.kind === "column" || res.kind === "input-column") {
          st.emit(
            {
              code: "TYPE",
              sheetId: report.sheetId,
              message: `a report reads a scalar; ${refText(ref)} is a column`,
              sourceOffset: ref.start,
              span: { start: ref.start, end: ref.end },
            },
            { sheetId: report.sheetId },
          );
        }
      }
    }
  }
}
