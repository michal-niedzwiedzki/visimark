import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { type RawBinding, splitBindings } from "./blocks.js";
import { parseFenceInfo } from "./fence-info.js";

export type { RawBinding };

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  lang?: string | null;
  meta?: string | null;
  children?: MdNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface Span {
  start: number;
  end: number;
}

/**
 * A `from <path> [delimited <char>] [labelled <col>,...] [at sha256:<digest>]`
 * clause parsed out of a `vmark` fence info string — see
 * `docs/design/declared-local-data-imports-spec.md` §2. Non-null on
 * `RawBlock.importDecl` marks a sheet as a **declared input**: read-only, its
 * table sourced from a local file rather than an inline GFM table.
 */
export interface ImportDecl {
  path: string;
  pathSpan: Span;
  /** single-character CSV field delimiter; `","` when no `delimited` clause */
  delimiter: string;
  /** the `labelled` or `unlabelled` name list, in order, or null if neither
   *  clause is present */
  labels: string[] | null;
  labelsSpan: Span | null;
  /** which of the two mutually-exclusive clauses supplied `labels` — null
   *  when neither is present, in which case the CSV's own header row is
   *  taken unasserted, exactly as before this field existed */
  labelsMode: "labelled" | "unlabelled" | null;
  /** the `at` clause's prefix token verbatim (before the `:`), or null if the
   *  clause is absent. Anything other than `"sha256"` is unrecognised. */
  stampPrefix: string | null;
  /** the digest text after `sha256:`, verbatim — validity is not checked here */
  stampDigest: string | null;
  /** span of the whole `at ...` clause; `fmt` replaces this span to update a
   *  stamp, or inserts at `declSpan.end` when there is no `at` clause at all */
  stampSpan: Span | null;
  /** span of the entire declaration tail after the sheet id — the fallback
   *  site for a finding with nowhere more specific to point */
  declSpan: Span;
}

export interface RawBlock {
  /** sheet id from the fence info string (`#lines` -> `"lines"`); `null` for a document-scope block */
  sheetId: string | null;
  /** parsed `from ...` clause, or null for an ordinary sheet */
  importDecl: ImportDecl | null;
  /** a fence-info clause the `from` grammar rejected (bad order, repeated
   *  clause, malformed token, unrecognised trailing token) */
  grammarError: { message: string; span: Span } | null;
  bindings: RawBinding[];
  /** span of the whole fenced code block, including fences */
  span: Span;
}

export interface RawCell extends Span {
  text: string;
}

export interface RawRow {
  cells: RawCell[];
}

export interface RawTable {
  headers: RawCell[];
  rows: RawRow[];
  span: Span;
}

/** `image` is the odd one out: it is never rewritten. A chart anchor names
 *  the artifact's location rather than a value to splice. */
export type AnchorTargetKind = "strong" | "emphasis" | "inlineCode" | "text" | "image";

export interface RawAnchor {
  sheetId: string;
  name: string;
  /** span of the `<!--vmark=...-->` comment itself */
  commentSpan: Span;
  /** the rewritable value span in the preceding inline node, or null if there is none.
   *  A `kind: "image"` span is **not** rewritable — see `imageUrl`. */
  value: (Span & { kind: AnchorTargetKind }) | null;
  /** the image's URL when the anchor follows an image node — the artifact path a
   *  chart declaration writes to. Absent for every other anchor kind. */
  imageUrl?: string;
}

/**
 * A numeric literal in prose — outside every table and every `vmark` block.
 * `infer` treats these as the sites a scalar could be anchored at; nothing
 * else reads them, so a document with no inference run behaves as before.
 */
export interface ProseFigure {
  /** the literal as written: `23300.00`, `23%`, `$5.50` */
  text: string;
  /** the span an anchor would rewrite, and the inline kind holding it */
  value: Span & { kind: AnchorTargetKind };
  /** offset just after the inline node an anchor comment would follow, or
   *  `null` when the literal sits where no anchor can bind it */
  anchorAt: number | null;
  /** true when an anchor comment already binds this literal */
  anchored: boolean;
}

export interface LocatedDoc {
  source: string;
  blocks: RawBlock[];
  tables: RawTable[];
  anchors: RawAnchor[];
  /**
   * Spans of HTML comments that announce themselves as a value anchor
   * (`<!--vmark=…-->`) but do not fully match `ANCHOR_RE` — a bad sheet id,
   * a stray space, an empty name. These never became a `RawAnchor`; `build`
   * turns each into an `ANCHOR` finding instead of letting it pass as an
   * ordinary, silently-ignored HTML comment.
   */
  malformedAnchors: Span[];
  /** numeric literals in prose, in document order */
  figures: ProseFigure[];
  /**
   * Span of the `<!--vmark:no-formulas-->` marker, or `null`. The author
   * saying, in the document itself, that its tables have no arithmetic to
   * derive — the one thing that answers a `COVERAGE` finding. Only a
   * top-level comment counts, so a marker shown inside a fenced example is
   * documentation rather than an assertion.
   */
  noFormulas: Span | null;
  /** for each block, the GFM table it owns (immediately precedes it), or null */
  tableBeforeBlock: Map<RawBlock, RawTable | null>;
  /** true when a block owns no table but a table appears between it and the previous block/heading */
  detachedTableBlocks: Set<RawBlock>;
}

const ANCHOR_RE = /^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*-->$/;
/** loose enough to catch "this was meant to be a value anchor" without
 *  matching the `vmark:no-formulas` marker (`:`, not `=`) or an unrelated
 *  comment. Anything that matches this but not the full `ANCHOR_RE` above
 *  is a malformed anchor, not an ordinary HTML comment. */
const ANCHOR_LOOSE_RE = /^<!--\s*vmark\s*=/;
export const NO_FORMULAS_MARKER = "<!--vmark:no-formulas-->";
const NO_FORMULAS_RE = /^<!--\s*vmark\s*:\s*no-formulas\s*-->$/;
const TRAILING_NUMBER_RE = /(-?\d+(?:\.\d+)?)\s*$/;

const off = (n: MdNode, which: "start" | "end"): number => {
  const v = n.position?.[which].offset;
  if (v === undefined) {
    throw new Error(`mdast node ${n.type} is missing a byte offset`);
  }
  return v;
};

export function locate(source: string): LocatedDoc {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source) as unknown as MdNode;

  const top = tree.children ?? [];
  const blocks: RawBlock[] = [];
  const tables: RawTable[] = [];
  const anchors: RawAnchor[] = [];
  const malformedAnchors: Span[] = [];
  const tableBeforeBlock = new Map<RawBlock, RawTable | null>();
  const detachedTableBlocks = new Set<RawBlock>();

  // index tables by their span start so a block can find the sibling before it
  const tableBySpanStart = new Map<number, RawTable>();

  let noFormulas: Span | null = null;

  for (let i = 0; i < top.length; i++) {
    const node = top[i]!;
    if (node.type === "table") {
      const t = readTable(node, source);
      tables.push(t);
      tableBySpanStart.set(t.span.start, t);
    }
    if (
      node.type === "html" &&
      noFormulas === null &&
      NO_FORMULAS_RE.test((node.value ?? "").trim())
    ) {
      noFormulas = { start: off(node, "start"), end: off(node, "end") };
    }
  }

  for (let i = 0; i < top.length; i++) {
    const node = top[i]!;
    if (node.type === "code" && node.lang === "vmark") {
      const span: Span = { start: off(node, "start"), end: off(node, "end") };
      const bodyStart = source.indexOf("\n", span.start) + 1;
      const meta = node.meta ?? null;
      const metaStart = meta ? firstLine(source, span.start).indexOf(meta) : -1;
      const rebaseAbs = metaStart === -1 ? 0 : span.start + metaStart;
      const parsed = parseFenceInfo(meta);
      const block: RawBlock = {
        sheetId: parsed.sheetId,
        importDecl: parsed.importDecl ? rebaseImportDecl(parsed.importDecl, rebaseAbs) : null,
        grammarError: parsed.grammarError
          ? {
              message: parsed.grammarError.message,
              span: {
                start: rebaseAbs + parsed.grammarError.span.start,
                end: rebaseAbs + parsed.grammarError.span.end,
              },
            }
          : null,
        bindings: splitBindings(node.value ?? "", bodyStart),
        span,
      };
      blocks.push(block);

      const prev = top[i - 1];
      if (prev && prev.type === "table") {
        tableBeforeBlock.set(block, tableBySpanStart.get(off(prev, "start")) ?? null);
      } else {
        tableBeforeBlock.set(block, null);
        // a table sits between this block and the previous block/heading boundary
        for (let j = i - 1; j >= 0; j--) {
          const t = top[j]!;
          if (t.type === "code" && t.lang === "vmark") break;
          if (t.type === "heading") break;
          if (t.type === "table") {
            detachedTableBlocks.add(block);
            break;
          }
        }
      }
    }
  }

  collectAnchors(tree, source, anchors, malformedAnchors);

  const figures: ProseFigure[] = [];
  collectFigures(tree, source, figures);
  const anchoredSpans = new Set(
    anchors.filter((a) => a.value).map((a) => `${a.value!.start}:${a.value!.end}`),
  );
  for (const f of figures) {
    f.anchored = anchoredSpans.has(`${f.value.start}:${f.value.end}`);
  }

  return {
    source,
    blocks,
    tables,
    anchors,
    malformedAnchors,
    figures,
    noFormulas,
    tableBeforeBlock,
    detachedTableBlocks,
  };
}

/** the code fence's opening line, from `span.start` up to (not including) the newline */
function firstLine(source: string, spanStart: number): string {
  const nl = source.indexOf("\n", spanStart);
  return nl === -1 ? source.slice(spanStart) : source.slice(spanStart, nl);
}

function rebaseImportDecl(
  decl: NonNullable<ReturnType<typeof parseFenceInfo>["importDecl"]>,
  delta: number,
): ImportDecl {
  const shift = (s: { start: number; end: number }): Span => ({
    start: s.start + delta,
    end: s.end + delta,
  });
  return {
    path: decl.path,
    pathSpan: shift(decl.pathSpan),
    delimiter: decl.delimiter,
    labels: decl.labels,
    labelsSpan: decl.labelsSpan ? shift(decl.labelsSpan) : null,
    labelsMode: decl.labelsMode,
    stampPrefix: decl.stampPrefix,
    stampDigest: decl.stampDigest,
    stampSpan: decl.stampSpan ? shift(decl.stampSpan) : null,
    declSpan: shift(decl.declSpan),
  };
}

function readTable(node: MdNode, source: string): RawTable {
  const rows = (node.children ?? []).map((row) =>
    (row.children ?? []).map((cell) => readCell(cell, source)),
  );
  const [headers = [], ...body] = rows;
  return {
    headers,
    rows: body.map((cells) => ({ cells })),
    span: { start: off(node, "start"), end: off(node, "end") },
  };
}

function readCell(cell: MdNode, source: string): RawCell {
  const child = cell.children?.[0];
  if (child) {
    const span = innerValueSpan(child);
    if (span) return { ...span, text: source.slice(span.start, span.end) };
  }
  // empty cell: point span just inside the trimmed cell body
  const rawStart = off(cell, "start");
  const rawEnd = off(cell, "end");
  const raw = source.slice(rawStart, rawEnd);
  const inner = raw.replace(/^\|?\s*/, "");
  const lead = raw.length - inner.length;
  const trimmed = inner.replace(/\s*\|?\s*$/, "");
  return {
    start: rawStart + lead,
    end: rawStart + lead + trimmed.length,
    text: trimmed,
  };
}

/** value span for a strong/emphasis/inlineCode/text inline node */
function innerValueSpan(node: MdNode): (Span & { kind: AnchorTargetKind }) | null {
  if (node.type === "strong" || node.type === "emphasis") {
    const t = node.children?.[0];
    if (t && t.type === "text") {
      return {
        start: off(t, "start"),
        end: off(t, "end"),
        kind: node.type,
      };
    }
    return null;
  }
  if (node.type === "inlineCode") {
    return {
      start: off(node, "start") + 1,
      end: off(node, "end") - 1,
      kind: "inlineCode",
    };
  }
  if (node.type === "text") {
    return { start: off(node, "start"), end: off(node, "end"), kind: "text" };
  }
  return null;
}

function collectAnchors(
  root: MdNode,
  source: string,
  out: RawAnchor[],
  malformedOut: Span[],
): void {
  walk(root, (node) => {
    const kids = node.children;
    if (!kids) return;
    for (let i = 0; i < kids.length; i++) {
      const child = kids[i]!;
      if (child.type !== "html") continue;
      const trimmed = (child.value ?? "").trim();
      const m = ANCHOR_RE.exec(trimmed);
      if (!m) {
        if (ANCHOR_LOOSE_RE.test(trimmed)) {
          malformedOut.push({ start: off(child, "start"), end: off(child, "end") });
        }
        continue;
      }
      const commentSpan: Span = {
        start: off(child, "start"),
        end: off(child, "end"),
      };
      const prev = kids[i - 1];
      out.push({
        sheetId: m[1]!,
        name: m[2]!,
        commentSpan,
        value: prev ? anchorValueSpan(prev) : null,
        ...(prev?.type === "image" && prev.url !== undefined ? { imageUrl: prev.url } : {}),
      });
    }
  });
}

function anchorValueSpan(prev: MdNode): (Span & { kind: AnchorTargetKind }) | null {
  if (prev.type === "image") {
    // an artifact reference, not a value: the span exists so the anchor is not
    // reported as targetless, but nothing ever splices it
    return { start: off(prev, "start"), end: off(prev, "end"), kind: "image" };
  }
  if (prev.type === "strong" || prev.type === "emphasis" || prev.type === "inlineCode") {
    return innerValueSpan(prev);
  }
  if (prev.type === "text") {
    const value = prev.value ?? "";
    const m = TRAILING_NUMBER_RE.exec(value);
    if (!m) return null;
    const start = off(prev, "start") + m.index;
    return { start, end: start + m[1]!.length, kind: "text" };
  }
  return null;
}

function walk(node: MdNode, visit: (n: MdNode) => void): void {
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}

/**
 * A whole inline node that is nothing but a number, decorated or not, so a
 * prose `**$28659.00**` is as much a figure as a bare one. This is permissive
 * on purpose: `parseDecorated` reads any leading run of non-digits as a unit,
 * so `#unnamed1` lands here too. Deciding which figures actually state a value
 * is the matcher's job, not the scanner's — see `infer/verify.ts`.
 */
const WHOLE_NUMBER_RE = /^-?\s*[^\d\s.\-%]*\s*\d+(?:\.\d+)?\s*(?:%|[^\d\s.\-%]*)$/;
/** every numeric run inside a text node, for the ones that cannot be anchored */
const ANY_NUMBER_RE = /\d+(?:\.\d+)?%?/g;
/** a character that makes an adjacent digit run part of something else —
 *  a date, an identifier, a document number — rather than a figure */
const GLUE_RE = /[\w./\-:%]/;

function collectFigures(node: MdNode, source: string, out: ProseFigure[]): void {
  if (node.type === "table" || node.type === "code" || node.type === "html") {
    return;
  }
  const kids = node.children;
  if (!kids) return;
  for (const child of kids) {
    switch (child.type) {
      case "strong":
      case "emphasis": {
        const t = child.children?.[0];
        if (
          child.children?.length === 1 &&
          t?.type === "text" &&
          WHOLE_NUMBER_RE.test((t.value ?? "").trim())
        ) {
          const span = innerValueSpan(t);
          if (span) {
            out.push({
              text: source.slice(span.start, span.end),
              value: { ...span, kind: child.type },
              anchorAt: off(child, "end"),
              anchored: false,
            });
            continue;
          }
        }
        collectFigures(child, source, out);
        continue;
      }
      case "inlineCode": {
        const v = (child.value ?? "").trim();
        if (WHOLE_NUMBER_RE.test(v)) {
          const span = innerValueSpan(child)!;
          out.push({
            text: source.slice(span.start, span.end),
            value: span,
            anchorAt: off(child, "end"),
            anchored: false,
          });
        }
        continue;
      }
      case "text": {
        textFigures(child, source, out);
        continue;
      }
      default:
        collectFigures(child, source, out);
    }
  }
}

/**
 * Numbers inside a text node. Only the trailing one can carry an anchor, and
 * it is found with the very regex the anchor reader uses, so a figure this
 * function calls anchorable is one `anchorValueSpan` will read back.
 */
function textFigures(node: MdNode, source: string, out: ProseFigure[]): void {
  const value = node.value ?? "";
  const base = off(node, "start");
  const trailing = TRAILING_NUMBER_RE.exec(value);
  const trailingStart = trailing ? trailing.index : -1;

  ANY_NUMBER_RE.lastIndex = 0;
  for (let m = ANY_NUMBER_RE.exec(value); m; m = ANY_NUMBER_RE.exec(value)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = value[start - 1] ?? " ";
    const after = value[end] ?? " ";
    if (GLUE_RE.test(before) || GLUE_RE.test(after)) continue;
    const isTrailing = start === trailingStart && !m[0].endsWith("%");
    out.push({
      text: m[0],
      value: { start: base + start, end: base + end, kind: "text" },
      anchorAt: isTrailing ? off(node, "end") : null,
      anchored: false,
    });
  }
}
