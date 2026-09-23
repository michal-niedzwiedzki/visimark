import {
  applyEdits,
  infer,
  planInfer,
  type PlannedInsert,
  type Proposal,
  type Span,
} from "visimark";

/**
 * What **Infer** would add to a note, computed before anything is added.
 *
 * Row 5 of #176 calls this the on-ramp, and probably *the* entry point for
 * audience B: Obsidian is where AI-written budgets and pasted CSVs land, and
 * a table that arrives with numbers in it is one command away from being a
 * table whose numbers are checked.
 *
 * **`planInfer` only inserts, and that is the property the preview rests on.**
 * Every edit it returns has `start === end`, so accepting one cannot rewrite a
 * byte the reader typed — manual test §2.7 verifies that with `git diff`
 * rather than by eye, and `infer-plan.test.ts` verifies it by reconstructing
 * the original out of the result. A tool that silently rewrote a pasted table
 * would be unusable here for the same reason a tool that silently rewrote a
 * prose paragraph would be.
 */

export interface InferPreview {
  /** the insertions, in document order */
  inserts: PlannedInsert[];
  /** the ```vmark blocks this would add, as they would appear */
  blocks: string[];
  /** the note as it would be */
  result: string;
  /** how many of each kind of thing would be proposed */
  counts: { columns: number; scalars: number; aliases: number; anchors: number };
}

/** `true` when there is nothing to propose — the command's "nothing to do". */
export function isEmpty(preview: InferPreview): boolean {
  return preview.inserts.length === 0;
}

/**
 * Plan the insertions for `source`.
 *
 * `selection` narrows the proposals to the tables it touches, which is what
 * makes "run it on the table I just pasted" mean something in a note that
 * already has others. Narrowing is by **table**, not by the selection's own
 * bounds: a proposal is about a whole table, and half a table is not a smaller
 * proposal, it is a wrong one.
 */
export function previewInfer(source: string, selection?: Span): InferPreview {
  const inserts = planInfer(source, proposalsFor(source, selection));
  const counts = { columns: 0, scalars: 0, aliases: 0, anchors: 0 };
  const blocks: string[] = [];

  for (const insert of inserts) {
    if (insert.kind === "anchor") counts.anchors++;
    if (insert.kind === "block") {
      blocks.push(insert.text);
      for (const proposal of insert.proposals) {
        if (proposal.kind === "column") counts.columns++;
        else if (proposal.kind === "scalar") counts.scalars++;
        else if (proposal.kind === "alias") counts.aliases++;
      }
    }
  }

  return { inserts, blocks, result: applyEdits(source, inserts), counts };
}

/** What the reader is told before they accept, in their own words. */
export function describePreview(preview: InferPreview): string {
  const { columns, scalars, anchors } = preview.counts;
  const parts: string[] = [];
  if (columns > 0) parts.push(`${columns} ${columns === 1 ? "column" : "columns"}`);
  if (scalars > 0) parts.push(`${scalars} ${scalars === 1 ? "total" : "totals"}`);
  if (parts.length === 0 && anchors === 0) return "There is nothing here to work out.";
  const found = parts.length === 0 ? "the formulas" : parts.join(" and ");
  const bound =
    anchors === 0
      ? ""
      : `, and bind ${anchors} ${anchors === 1 ? "number" : "numbers"} in your text to ${anchors === 1 ? "it" : "them"}`;
  return `VisiMark can work out ${found}${bound}. Nothing you have written is changed.`;
}

/**
 * The proposals a selection asks about, or all of them.
 *
 * `planInfer(source)` with no second argument infers everything; passing a
 * filtered set is how a selection narrows it. An absent or empty selection
 * returns `undefined` rather than an empty array — deliberately, because
 * "propose nothing" and "propose everything" must not be one keystroke apart.
 *
 * Narrowing is by **table**: a proposal is about a whole table, so a selection
 * that touches one at all asks about all of it. Half a table is not a smaller
 * proposal; it is a wrong one.
 */
function proposalsFor(source: string, selection?: Span): Proposal[] | undefined {
  if (selection === undefined || selection.start >= selection.end) return undefined;
  const touches = (span: Span): boolean => span.start < selection.end && selection.start < span.end;
  const tables = new Set<string>();
  const all = infer(source);
  for (const p of all)
    if (touches(p.tableSpan)) tables.add(`${p.tableSpan.start}:${p.tableSpan.end}`);
  return all.filter((p) => tables.has(`${p.tableSpan.start}:${p.tableSpan.end}`));
}
