import { locate, type DocModel } from "visimark";

/**
 * What name is the cursor on?
 *
 * **Explain needs an answer and the document gives three kinds of it.** A
 * caret can be inside the binding line that *declares* a name
 * (`net_total = SUM(Net)`), inside a prose anchor that *reads* one
 * (`**23300**<!--vmark=lines.net_total-->`), or inside a table cell that a
 * column rule computes. The first two are spans the engine already records;
 * the third is not, and this file does not guess at it — a caret in a cell
 * answers with the column only when the cell's row can be identified from the
 * table's span, which it cannot be cheaply, so it answers `null` and Explain
 * says what to do.
 *
 * Answering `null` rather than "the nearest thing" is deliberate. Explain
 * shows one name and its formula; showing the wrong one confidently is worse
 * than asking the person to put the caret on the number they meant.
 */

/** The binding the caret is inside, qualified, or `null`. */
export function nameAt(model: DocModel, offset: number): string | null {
  const inside = (span: { start: number; end: number }): boolean =>
    offset >= span.start && offset <= span.end;

  // A prose anchor first: it is the narrowest thing a caret can be in, and the
  // number in the sentence is what a reader is most likely looking at when
  // they ask. Both halves count — the value the anchor binds and the comment
  // that binds it — because in reading mode the comment is invisible and in
  // Live Preview it is not, so a caret "on the number" lands in either.
  for (const anchor of locate(model.source).anchors) {
    const qualified = anchor.sheetId === "" ? anchor.name : `${anchor.sheetId}.${anchor.name}`;
    if (inside(anchor.commentSpan)) return qualified;
    if (anchor.value !== null && inside(anchor.value)) return qualified;
  }

  for (const [name, binding] of model.docScope) {
    if (inside(binding.span)) return name;
  }

  for (const sheet of model.sheets.values()) {
    for (const [name, binding] of sheet.columns) {
      if (inside(binding.span)) return `${sheet.id}.${name}`;
    }
    for (const [name, binding] of sheet.scalars) {
      if (inside(binding.span)) return `${sheet.id}.${name}`;
    }
  }

  return null;
}
