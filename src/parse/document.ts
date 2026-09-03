import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { type RawBinding, splitBindings } from "./blocks.js";

export type { RawBinding };

interface MdNode {
  type: string;
  value?: string;
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

export interface RawBlock {
  /** sheet id from the fence info string (`#lines` -> `"lines"`); `null` for a document-scope block */
  sheetId: string | null;
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

export type AnchorTargetKind =
  | "strong"
  | "emphasis"
  | "inlineCode"
  | "text";

export interface RawAnchor {
  sheetId: string;
  name: string;
  /** span of the `<!--vmark=...-->` comment itself */
  commentSpan: Span;
  /** the rewritable value span in the preceding inline node, or null if there is none */
  value: (Span & { kind: AnchorTargetKind }) | null;
}

export interface LocatedDoc {
  source: string;
  blocks: RawBlock[];
  tables: RawTable[];
  anchors: RawAnchor[];
  /** for each block, the GFM table it owns (immediately precedes it), or null */
  tableBeforeBlock: Map<RawBlock, RawTable | null>;
  /** true when a block owns no table but a table appears between it and the previous block/heading */
  detachedTableBlocks: Set<RawBlock>;
}

const ANCHOR_RE =
  /^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*-->$/;
const TRAILING_NUMBER_RE = /(-?\d+(?:\.\d+)?)\s*$/;

const off = (n: MdNode, which: "start" | "end"): number => {
  const v = n.position?.[which].offset;
  if (v === undefined) {
    throw new Error(`mdast node ${n.type} is missing a byte offset`);
  }
  return v;
};

export function locate(source: string): LocatedDoc {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(source) as unknown as MdNode;

  const top = tree.children ?? [];
  const blocks: RawBlock[] = [];
  const tables: RawTable[] = [];
  const anchors: RawAnchor[] = [];
  const tableBeforeBlock = new Map<RawBlock, RawTable | null>();
  const detachedTableBlocks = new Set<RawBlock>();

  // index tables by their span start so a block can find the sibling before it
  const tableBySpanStart = new Map<number, RawTable>();

  for (let i = 0; i < top.length; i++) {
    const node = top[i]!;
    if (node.type === "table") {
      const t = readTable(node, source);
      tables.push(t);
      tableBySpanStart.set(t.span.start, t);
    }
  }

  for (let i = 0; i < top.length; i++) {
    const node = top[i]!;
    if (node.type === "code" && node.lang === "vmark") {
      const span: Span = { start: off(node, "start"), end: off(node, "end") };
      const bodyStart = source.indexOf("\n", span.start) + 1;
      const block: RawBlock = {
        sheetId: parseSheetId(node.meta ?? null),
        bindings: splitBindings(node.value ?? "", bodyStart),
        span,
      };
      blocks.push(block);

      const prev = top[i - 1];
      if (prev && prev.type === "table") {
        tableBeforeBlock.set(
          block,
          tableBySpanStart.get(off(prev, "start")) ?? null,
        );
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

  collectAnchors(tree, source, anchors);

  return {
    source,
    blocks,
    tables,
    anchors,
    tableBeforeBlock,
    detachedTableBlocks,
  };
}

function parseSheetId(meta: string | null): string | null {
  if (!meta) return null;
  const m = /^#(\S+)/.exec(meta.trim());
  return m ? m[1]! : null;
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
function innerValueSpan(
  node: MdNode,
): (Span & { kind: AnchorTargetKind }) | null {
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

function collectAnchors(root: MdNode, source: string, out: RawAnchor[]): void {
  walk(root, (node) => {
    const kids = node.children;
    if (!kids) return;
    for (let i = 0; i < kids.length; i++) {
      const child = kids[i]!;
      if (child.type !== "html") continue;
      const m = ANCHOR_RE.exec((child.value ?? "").trim());
      if (!m) continue;
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
      });
    }
  });
}

function anchorValueSpan(
  prev: MdNode,
): (Span & { kind: AnchorTargetKind }) | null {
  if (
    prev.type === "strong" ||
    prev.type === "emphasis" ||
    prev.type === "inlineCode"
  ) {
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
