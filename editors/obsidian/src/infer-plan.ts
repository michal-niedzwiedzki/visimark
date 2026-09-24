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
 * **`planInfer` never rewrites an existing byte — with one exception.** Most
 * edits have `start === end`, so accepting them cannot touch a byte the
 * reader typed. The exception is a document already carrying
 * `<!--vmark:no-formulas-->` that this same plan gives its first rules: that
 * marker is now false, and `planInfer` deletes it (`start < end`, `text:
 * ""`) in the same pass. `offerInfer` in `infer-modal.ts` has to apply both
 * endpoints of every insert, not assume every one is a zero-width insertion.
 * Manual test §2.7 and `infer-plan.test.ts` verify the no-rewrite property by
 * reconstructing the original out of the result, deletions included.
 */

export interface InferPreview {
  /** the insertions, in document order */
  inserts: PlannedInsert[];
  /** the ```vmark blocks this would add, as they would appear */
  blocks: string[];
  /**
   * The `<!--vmark:no-formulas-->` comment this would add, trimmed — or
   * `null`. Set only for the CLI's negative result: nothing anywhere `infer`
   * asked about has arithmetic to derive. When set, it is the *only* insert;
   * `blocks` is empty.
   */
  marker: string | null;
  /** whether this plan deletes a stale marker — a table that had none is about to get some */
  removesMarker: boolean;
  /** the note as it would be */
  result: string;
  /** how many of each kind of thing would be proposed */
  counts: { columns: number; scalars: number; aliases: number; anchors: number };
}

/** `true` when there is nothing to propose — the command's "nothing to do". */
export function isEmpty(preview: InferPreview): boolean {
  return preview.inserts.length === 0;
}

function emptyPreview(source: string): InferPreview {
  return {
    inserts: [],
    blocks: [],
    marker: null,
    removesMarker: false,
    result: source,
    counts: { columns: 0, scalars: 0, aliases: 0, anchors: 0 },
  };
}

/**
 * Plan the insertions for `source`.
 *
 * `selection` narrows the proposals to the tables it touches, which is what
 * makes "run it on the table I just pasted" mean something in a note that
 * already has others. Narrowing is by **table**, not by the selection's own
 * bounds: a proposal is about a whole table, and half a table is not a smaller
 * proposal, it is a wrong one.
 *
 * **A narrowed selection that finds nothing is not "nothing anywhere".**
 * `proposalsFor` answers `[]` when the selection touches no table, or only
 * tables `infer` had nothing writable for. `planInfer(source, [])` reads an
 * empty array as proof the *whole document* has no arithmetic — the CLI's
 * unscoped result — and plans a document-wide `no-formulas` marker. That is
 * right when `infer` genuinely found nothing anywhere (the selection's own
 * emptiness just happens to agree with the document's), and wrong when some
 * other table the selection did not touch has real proposals — marking the
 * whole document would be a claim the selection never made. So the marker
 * path is only reached when `infer(source)` itself is empty; otherwise an
 * empty `only` is answered directly, without calling `planInfer` at all.
 */
export function previewInfer(source: string, selection?: Span): InferPreview {
  const all = infer(source);
  const only = proposalsFor(all, selection);
  if (only !== undefined && only.length === 0 && all.length > 0) return emptyPreview(source);

  const inserts = planInfer(source, only);
  const counts = { columns: 0, scalars: 0, aliases: 0, anchors: 0 };
  const blocks: string[] = [];
  let marker: string | null = null;
  let removesMarker = false;

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
    if (insert.kind === "marker") {
      if (insert.text.length > 0) marker = insert.text.trim();
      else removesMarker = true;
    }
  }

  return { inserts, blocks, marker, removesMarker, result: applyEdits(source, inserts), counts };
}

/** What the reader is told before they accept, in their own words. */
export function describePreview(preview: InferPreview): string {
  if (preview.marker !== null) {
    return "VisiMark cannot find any arithmetic here, and will mark this table as having none to check.";
  }
  const { columns, scalars, aliases, anchors } = preview.counts;
  const parts: string[] = [];
  if (columns > 0) parts.push(`${columns} ${columns === 1 ? "column" : "columns"}`);
  if (scalars > 0) parts.push(`${scalars} ${scalars === 1 ? "total" : "totals"}`);
  if (aliases > 0) parts.push(`${aliases} ${aliases === 1 ? "name" : "names"}`);
  if (parts.length === 0 && anchors === 0) return "There is nothing here to work out.";
  const found = parts.length === 0 ? "the formulas" : joinWithAnd(parts);
  const bound =
    anchors === 0
      ? ""
      : `, and bind ${anchors} ${anchors === 1 ? "number" : "numbers"} in your text to ${anchors === 1 ? "it" : "them"}`;
  return `VisiMark can work out ${found}${bound}. Nothing you have written is changed.`;
}

/** "a", "a and b", "a, b and c" — never an Oxford comma before the last item. */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The proposals a selection asks about, out of `all`, or all of them.
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
function proposalsFor(all: Proposal[], selection?: Span): Proposal[] | undefined {
  if (selection === undefined || selection.start >= selection.end) return undefined;
  const touches = (span: Span): boolean => span.start < selection.end && selection.start < span.end;
  const tables = new Set<string>();
  for (const p of all)
    if (touches(p.tableSpan)) tables.add(`${p.tableSpan.start}:${p.tableSpan.end}`);
  return all.filter((p) => tables.has(`${p.tableSpan.start}:${p.tableSpan.end}`));
}
