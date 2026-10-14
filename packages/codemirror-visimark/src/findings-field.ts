import { StateEffect, StateField } from "@codemirror/state";
import type { Finding } from "visimark";

/**
 * The finding set the last recompute produced, for `visimarkLint()` to read.
 *
 * `null` means "nothing to show yet": the document has an imported sheet and
 * no snapshot-backed check has landed (a reader-less check would report every
 * imported column as UNDEF — a wrong error, not a missing one).
 *
 * One module-level field shared by `index.js` and `lint.js` — the published
 * build splits them into a common chunk so there is exactly one.
 */
export type FindingSet = readonly LintFinding[] | null;

/**
 * A finding plus, for a `STALE` with a span, the text `fmt` would write over
 * that span — the lint quick fix's replacement (#384). Internal: the field's
 * type is not exported from the package, so this adds no public surface.
 * The span mapping below carries `fix` across edits unchanged.
 */
export type LintFinding = Finding & { readonly fix?: string };

export const setFindings = StateEffect.define<FindingSet>();

export const findingsField = StateField.define<FindingSet>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFindings)) return effect.value;
    if (value === null || !tr.docChanged) return value;
    // carry each span across the edit, as RangeSet.map carries the marks
    return value.map((f) => {
      if (f.span === undefined) return f;
      const start = tr.changes.mapPos(f.span.start, 1);
      const end = Math.max(start, tr.changes.mapPos(f.span.end, -1));
      return { ...f, span: { start, end } };
    });
  },
});
