import { countBindings } from "../eval/check.js";
import { build } from "../model/build.js";
import { locate, type LocatedDoc, NO_FORMULAS_MARKER } from "../parse/document.js";
import type { Edit } from "../write/splice.js";
import { buildContext, type InferSheet } from "./context.js";
import { infer, type Proposal } from "./propose.js";

export type PlannedInsert = Edit &
  (
    | {
        /** a `vmark` block, or the comment anchor that binds a scalar into prose */
        kind: "block" | "anchor";
        /** the proposal this insert carries; the first of `proposals` for a block */
        proposal: Proposal;
        /** every proposal this insert carries — a block holds a sheet's whole set */
        proposals: Proposal[];
      }
    | {
        /** the `no-formulas` marker, which carries no proposal by definition */
        kind: "marker";
        proposal?: undefined;
        proposals?: undefined;
      }
  );

/**
 * `--write` only ever inserts. It never rewrites an existing byte, so input
 * columns, prose, headings and existing blocks are untouched by construction —
 * a stronger guarantee than `fmt` makes, and worth keeping.
 */
export function planInfer(source: string, only?: Proposal[]): PlannedInsert[] {
  const proposals = only ?? infer(source);
  const ctx = buildContext(source);
  const sheetById = new Map(ctx.sheets.map((s) => [s.id, s]));
  const doc = locate(source);
  const figures = doc.figures;

  const marker = planMarker(source, doc, proposals);
  if (marker) return [marker];

  const writable = proposals.filter(
    (p) => !p.weak && (p.kind === "column" || (p.kind === "scalar" && p.anchorSite !== undefined)),
  );

  const out: PlannedInsert[] = [];

  for (const sheet of ctx.sheets) {
    const here = writable.filter((p) => p.sheetId === sheet.id);
    if (here.length === 0) continue;
    const columns = here.filter((p) => p.kind === "column");
    const scalars = here.filter((p) => p.kind === "scalar");
    const body = [align(columns), align(scalars)].filter((g) => g.length > 0).join("\n\n");
    out.push({
      ...blockEdit(source, sheet, body),
      kind: "block",
      proposal: here[0]!,
      proposals: here,
    });
  }

  for (const p of writable) {
    if (p.kind !== "scalar" || !p.anchorSite) continue;
    const sheet = sheetById.get(p.sheetId);
    if (!sheet) continue;
    const figure = figures.find(
      (f) => f.value.start === p.anchorSite!.start && f.value.end === p.anchorSite!.end,
    );
    if (!figure || figure.anchorAt === null) continue;
    out.push({
      start: figure.anchorAt,
      end: figure.anchorAt,
      text: `<!--vmark=${sheet.id}.${p.name}-->`,
      kind: "anchor",
      proposal: p,
      proposals: [p],
    });
  }

  return out;
}

/**
 * The negative result, written down. A document whose tables have no rules
 * fails `check`, and the only honest answer for one that has no arithmetic to
 * recover is to say so in the document itself.
 *
 * `infer` must have found *nothing whatsoever* first. A near-miss or an
 * ambiguity means the document does have arithmetic — one wrong row, or two
 * rules it refuses to choose between — and marking it would silence exactly
 * the document that most needs a reader.
 */
function planMarker(source: string, doc: LocatedDoc, proposals: Proposal[]): PlannedInsert | null {
  if (proposals.length > 0) return null;
  if (doc.tables.length === 0 || doc.noFormulas !== null) return null;
  if (countBindings(build(doc)) > 0) return null;

  const lead = source.endsWith("\n\n") ? "" : source.endsWith("\n") ? "\n" : "\n\n";
  return {
    start: source.length,
    end: source.length,
    text: `${lead}${NO_FORMULAS_MARKER}\n`,
    kind: "marker",
  };
}

/**
 * A new block goes immediately after its table, because `tableBeforeBlock`
 * requires adjacency. An existing one is extended in place, at the end of its
 * body — still an insertion, still no byte rewritten.
 */
function blockEdit(source: string, sheet: InferSheet, body: string): Edit {
  if (sheet.block) {
    const at = source.lastIndexOf("\n", sheet.block.span.end - 1);
    return { start: at, end: at, text: `\n${body}` };
  }
  const at = sheet.table.span.end;
  return {
    start: at,
    end: at,
    text: `\n\n\`\`\`vmark #${sheet.id}\n${body}\n\`\`\``,
  };
}

/** `=` aligned within a group, the way a person writing the block would */
function align(group: Proposal[]): string {
  const w = Math.max(0, ...group.map((p) => p.name.length));
  return group
    .map((p) => `${p.name.padEnd(w)} = ${p.rule.slice(p.rule.indexOf("=") + 2)}`)
    .join("\n");
}
