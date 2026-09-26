import type { CheckResult, DocModel } from "visimark";
import { decorationsFor } from "./decorations.js";

/**
 * What name is the cursor on?
 *
 * **Explain needs an answer and the document gives three kinds of it.** A
 * caret can be inside the binding line that *declares* a name
 * (`net_total = SUM(Net)`), inside a prose anchor that *reads* one
 * (`**23300**<!--vmark=lines.net_total-->`), or inside a table cell that a
 * column rule computes. All three are spans the engine already records:
 * the first two directly, and the third through `decorationsFor`
 * (`decorations.ts`), which already pairs every computed cell's span with its
 * `name` and `row` for the marks. This file just resolves the caret against
 * whichever span contains it.
 *
 * An input cell — one with no column rule — still answers `null`. A table
 * needs a column of known provenance before "which row" is an answerable
 * question at all, and `decorationsFor` only emits a `cell` decoration for a
 * ruled column (`sheet.columns`), never for `sheet.inputColumns`.
 *
 * Answering `null` rather than "the nearest thing" is deliberate. Explain
 * shows one name and its formula; showing the wrong one confidently is worse
 * than asking the person to put the caret on the number they meant.
 */

/** The name the caret is on, and which row when it is a table cell. */
export interface NameAtResult {
  readonly name: string;
  /** the table row a computed cell belongs to; absent for every other case */
  readonly row?: number;
}

/** The binding the caret is inside, qualified, or `null`. */
export function nameAt(model: DocModel, result: CheckResult, offset: number): NameAtResult | null {
  const inside = (span: { start: number; end: number }): boolean =>
    offset >= span.start && offset <= span.end;

  // A prose anchor first: it is the narrowest thing a caret can be in, and the
  // number in the sentence is what a reader is most likely looking at when
  // they ask. Both halves count — the value the anchor binds and the comment
  // that binds it — because in reading mode the comment is invisible and in
  // Live Preview it is not, so a caret "on the number" lands in either.
  for (const anchor of model.located.anchors) {
    const qualified = anchor.sheetId === "" ? anchor.name : `${anchor.sheetId}.${anchor.name}`;
    if (inside(anchor.commentSpan)) return { name: qualified };
    if (anchor.value !== null && inside(anchor.value)) return { name: qualified };
  }

  for (const [name, binding] of model.docScope) {
    if (inside(binding.span)) return { name };
  }

  for (const sheet of model.sheets.values()) {
    for (const [name, binding] of sheet.columns) {
      if (inside(binding.span)) return { name: `${sheet.id}.${name}` };
    }
    for (const [name, binding] of sheet.scalars) {
      if (inside(binding.span)) return { name: `${sheet.id}.${name}` };
    }
  }

  // Last, a table cell: decorationsFor only marks a computed column's cells
  // (kind: "cell"), so an input cell falls through to null below, same as
  // today.
  for (const decoration of decorationsFor(model, result)) {
    if (decoration.kind === "cell" && inside(decoration.span)) {
      return { name: decoration.name, row: decoration.row };
    }
  }

  return null;
}
