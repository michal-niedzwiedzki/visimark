import { parseBinding } from "../lang/parser.js";
import { build } from "../model/build.js";
import { type Binding, type DocModel, type Sheet } from "../model/types.js";
import { locate, type LocatedDoc, type RawBlock, type RawTable } from "../parse/document.js";
import { numericValue } from "../eval/units.js";

/**
 * A table as inference sees it. Inference runs on documents whose tables are
 * not sheets at all — a sheet requires a block, and the documents this command
 * exists for have none — so the pairing of table to sheet id is made here and
 * `build()` is left alone.
 */
export interface InferSheet {
  id: string;
  /** true when `id` was minted because the table had no block */
  minted: boolean;
  table: RawTable;
  /** the block this table already owns, if any */
  block: RawBlock | null;
  /** header name -> column index, in header order */
  index: Map<string, number>;
  /** headers whose every non-empty cell parses as a number */
  numeric: string[];
  /** headers that already carry a rule; inference never proposes for these */
  managed: Set<string>;
  /** rows with a non-empty cell, per header */
  filled: Map<string, number>;
  /** numeric headers whose non-empty cells all hold the same value */
  constant: Set<string>;
}

export interface InferContext {
  source: string;
  doc: LocatedDoc;
  /** the document as it stands, with whatever sheets it already declares */
  base: DocModel;
  sheets: InferSheet[];
}

export function buildContext(source: string): InferContext {
  const doc = locate(source);
  const base = build(doc);

  const blockOfTable = new Map<RawTable, RawBlock>();
  for (const [block, table] of doc.tableBeforeBlock) {
    if (table) blockOfTable.set(table, block);
  }

  const used = new Set(base.sheets.keys());
  let next = 1;
  const mint = (): string => {
    for (;;) {
      const id = `unnamed${next++}`;
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
  };

  const sheets = doc.tables.map((table) => {
    const block = blockOfTable.get(table) ?? null;
    const minted = block?.sheetId == null;
    const id = block?.sheetId ?? mint();
    const existing = base.sheets.get(id);

    const index = new Map<string, number>();
    table.headers.forEach((h, i) => index.set(h.text, i));

    const numeric: string[] = [];
    const filled = new Map<string, number>();
    const constant = new Set<string>();
    for (const [name, i] of index) {
      const texts = table.rows.map((r) => r.cells[i]?.text ?? "").filter((t) => t.trim() !== "");
      filled.set(name, texts.length);
      if (texts.length === 0) continue;
      const values = texts.map((t) => numericValue(t));
      if (values.some((v) => v === null)) continue;
      numeric.push(name);
      if (values.every((v) => v!.equals(values[0]!))) constant.add(name);
    }

    return {
      id,
      minted,
      table,
      block,
      index,
      numeric,
      managed: new Set(existing?.columns.keys() ?? []),
      filled,
      constant,
    } satisfies InferSheet;
  });

  return { source, doc, base, sheets };
}

/**
 * The document with `extra` bindings added — the model a candidate is verified
 * against. Everything the document already declares is carried over unchanged,
 * so a partially adopted document keeps its own rules while inference tries
 * one more on top.
 */
export function provisional(ctx: InferContext, extra: Binding[]): DocModel {
  const sheets = new Map<string, Sheet>();
  for (const [id, s] of ctx.base.sheets) sheets.set(id, cloneSheet(s));
  for (const s of ctx.sheets) {
    if (!sheets.has(s.id)) {
      sheets.set(s.id, {
        id: s.id,
        table: s.table,
        columns: new Map(),
        scalars: new Map(),
        columnIndex: new Map(s.index),
        inputColumns: new Set(s.index.keys()),
      });
    }
  }

  for (const b of extra) {
    const sheet = sheets.get(b.sheetId);
    if (!sheet) continue;
    if (b.kind === "column") {
      sheet.columns.set(b.name, b);
      sheet.inputColumns.delete(b.name);
    } else {
      sheet.scalars.set(b.name, b);
    }
  }

  return {
    sheets,
    docScope: ctx.base.docScope,
    anchors: ctx.base.anchors,
    // Structural findings belong to the document, not to the candidate; a
    // verification run reports on the candidate alone.
    findings: [],
    source: ctx.source,
    located: ctx.doc,
    blockOfSheet: ctx.base.blockOfSheet,
  };
}

function cloneSheet(s: Sheet): Sheet {
  return {
    id: s.id,
    table: s.table,
    columns: new Map(s.columns),
    scalars: new Map(s.scalars),
    columnIndex: new Map(s.columnIndex),
    inputColumns: new Set(s.inputColumns),
  };
}

/**
 * A binding built from rule text rather than from a document. Its spans point
 * into the rule text, which is all the evaluator needs; every span inference
 * reports comes from the real document instead.
 */
export function makeBinding(sheet: InferSheet, text: string): Binding {
  const parsed = parseBinding(text);
  return {
    id: `${sheet.id}.${parsed.name}`,
    sheetId: sheet.id,
    name: parsed.name,
    expr: parsed.expr,
    kind: sheet.index.has(parsed.name) ? "column" : "scalar",
    span: { start: 0, end: text.length },
  };
}
