import type { CheckResult, DocModel, Span } from "visimark";

/**
 * Where the plugin marks a value, and how — v1 row 2 of #176, and the row it
 * calls "the moment the product explains itself". Obsidian is a reading
 * surface first, so this outranks anything in source mode.
 *
 * **What is marked is what the document computes**, and the document says so
 * in two places and only two: a cell of a column that has a rule, and a value
 * in prose with a `<!--vmark=…-->` comment behind it. Everything else a
 * reader sees — input columns, headings, ordinary numbers — is theirs, and
 * marking it would be the plugin claiming authorship of text it did not write.
 *
 * **Every mark is a source span**, because that is the one currency both
 * renderers can take: Live Preview is CodeMirror over the source and wants
 * offsets, and reading mode has `getSectionInfo` to map a rendered element
 * back to the lines it came from. Nothing here knows what a decoration looks
 * like, which is why the part that can be wrong is testable and the part that
 * is drawn is not.
 *
 * **Nothing here writes.** A decoration is a thing the reader sees and the
 * file does not have — manual test §2.2's pass condition is that a note
 * copied out of the vault renders on GitHub exactly as it did before the
 * plugin existed, and the way that is guaranteed is that no code path from
 * this file reaches an editor.
 */

/** `disagrees` is the strong claim: the stored text is not what the rule gives. */
export type Mark = "computed" | "disagrees";

export interface Decoration {
  readonly span: Span;
  readonly mark: Mark;
  /** the qualified name this value belongs to, for the hover that row 3 adds */
  readonly name: string;
  /** a cell of a computed column, or a value bound into a sentence */
  readonly kind: "cell" | "anchor";
}

const key = (span: Span): string => `${span.start}:${span.end}`;

/**
 * Every value in `model` the plugin marks, in document order.
 *
 * A finding whose span is exactly a value's span is what makes that value
 * `disagrees` — matched by span rather than by name, because a name can be
 * anchored in several places and only some of them may have drifted.
 */
export function decorationsFor(model: DocModel, result: CheckResult): Decoration[] {
  const stale = new Set<string>();
  for (const finding of result.findings) {
    if (finding.code === "STALE" && finding.span !== undefined) stale.add(key(finding.span));
  }
  const markFor = (span: Span): Mark => (stale.has(key(span)) ? "disagrees" : "computed");

  const out: Decoration[] = [];

  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (table === null) continue;
    for (const name of sheet.columns.keys()) {
      const index = sheet.columnIndex.get(name);
      if (index === undefined) continue;
      for (const row of table.rows) {
        const cell = row.cells[index];
        // a ragged row is the author's, not ours to mark
        if (cell === undefined) continue;
        out.push({
          span: { start: cell.start, end: cell.end },
          mark: markFor(cell),
          name: `${sheet.id}.${name}`,
          kind: "cell",
        });
      }
    }
  }

  for (const anchor of model.located.anchors) {
    // an image anchor names an artifact's location rather than a value, and
    // there is nothing in it to mark
    if (anchor.value === null || anchor.value.kind === "image") continue;
    out.push({
      span: { start: anchor.value.start, end: anchor.value.end },
      mark: markFor(anchor.value),
      name: anchor.sheetId === "" ? anchor.name : `${anchor.sheetId}.${anchor.name}`,
      kind: "anchor",
    });
  }

  return out.sort((a, b) => a.span.start - b.span.start);
}

/** The decorations that fall inside a source range — one rendered section. */
export function decorationsIn(all: readonly Decoration[], from: number, to: number): Decoration[] {
  return all.filter((d) => d.span.start >= from && d.span.end <= to);
}
