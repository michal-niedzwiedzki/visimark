import type { Expr } from "../lang/ast.js";
import { parseStatement } from "../lang/parser.js";
import { LangError } from "../lang/token.js";
import type { LocatedDoc, RawBlock } from "../parse/document.js";
import {
  type Assertion,
  type Chart,
  type Binding,
  type DocModel,
  DOC_SCOPE,
  type Finding,
  type Sheet,
} from "./types.js";

export function build(doc: LocatedDoc): DocModel {
  const sheets = new Map<string, Sheet>();
  const docScope = new Map<string, Binding>();
  const findings: Finding[] = [];
  const blockOfSheet = new Map<string, RawBlock>();

  for (const block of doc.blocks) {
    if (block.sheetId === null) {
      for (const rb of block.bindings) {
        const stmt = parseOne(rb, doc.source, findings, DOC_SCOPE);
        if (!stmt) continue;
        if (stmt.kind === "assert") {
          findings.push({
            code: "SHEET",
            message: "`assert` must be in a `#id` sheet block",
            sourceOffset: stmt.assertion.span.start,
            span: stmt.assertion.span,
          });
          continue;
        }
        if (stmt.kind === "chart") {
          findings.push({
            code: "SHEET",
            message: "`chart` must be in a `#id` sheet block",
            sourceOffset: stmt.chart.span.start,
            span: stmt.chart.span,
          });
          continue;
        }
        const parsed = stmt.binding;
        const first = docScope.get(parsed.name);
        if (first) {
          findings.push({
            code: "DUP",
            name: parsed.name,
            span: parsed.span,
            relatedSpan: first.span,
          });
          continue;
        }
        docScope.set(parsed.name, parsed);
      }
      continue;
    }

    const sheetId = block.sheetId;
    blockOfSheet.set(sheetId, block);
    const table = doc.tableBeforeBlock.get(block) ?? null;
    const sheet = ensureSheet(sheets, sheetId, table);

    if (doc.detachedTableBlocks.has(block)) {
      findings.push({
        code: "SHEET",
        sheetId,
        message: "this block declares column rules but no table immediately precedes it",
        sourceOffset: block.span.start,
        span: block.span,
      });
    }

    const headerIndex = new Map<string, number>();
    (table?.headers ?? []).forEach((h, i) => headerIndex.set(h.text, i));

    for (const rb of block.bindings) {
      const stmt = parseOne(rb, doc.source, findings, sheetId);
      if (!stmt) continue;
      if (stmt.kind === "assert") {
        sheet.assertions.push(stmt.assertion);
        continue;
      }
      if (stmt.kind === "chart") {
        // a chart reads columns, so a sheet with no table cannot carry one —
        // the same rule column rules already follow
        if (table === null) {
          findings.push({
            code: "SHEET",
            sheetId,
            message: "a chart needs a table",
            sourceOffset: stmt.chart.span.start,
            span: stmt.chart.span,
          });
          continue;
        }
        const clash =
          sheet.columns.get(stmt.chart.name) ??
          sheet.scalars.get(stmt.chart.name) ??
          sheet.charts.find((c) => c.name === stmt.chart.name);
        if (clash) {
          findings.push({
            code: "DUP",
            sheetId,
            name: stmt.chart.name,
            span: stmt.chart.span,
            relatedSpan: clash.span,
          });
          continue;
        }
        sheet.charts.push(stmt.chart);
        continue;
      }
      const parsed = stmt.binding;
      const first = sheet.columns.get(parsed.name) ?? sheet.scalars.get(parsed.name);
      if (first) {
        findings.push({
          code: "DUP",
          sheetId,
          name: parsed.name,
          span: parsed.span,
          relatedSpan: first.span,
        });
        continue;
      }
      const isColumn = table !== null && headerIndex.has(parsed.name);
      parsed.kind = isColumn ? "column" : "scalar";
      if (isColumn) {
        sheet.columns.set(parsed.name, parsed);
        sheet.columnIndex.set(parsed.name, headerIndex.get(parsed.name)!);
      } else {
        sheet.scalars.set(parsed.name, parsed);
      }
    }

    for (const [name, idx] of headerIndex) {
      if (!sheet.columns.has(name)) {
        sheet.inputColumns.add(name);
        sheet.columnIndex.set(name, idx);
      }
    }
  }

  return {
    sheets,
    docScope,
    anchors: doc.anchors,
    findings,
    source: doc.source,
    located: doc,
    blockOfSheet,
  };
}

function ensureSheet(sheets: Map<string, Sheet>, id: string, table: Sheet["table"]): Sheet {
  let s = sheets.get(id);
  if (!s) {
    s = {
      id,
      table,
      columns: new Map(),
      scalars: new Map(),
      columnIndex: new Map(),
      inputColumns: new Set(),
      assertions: [],
      charts: [],
    };
    sheets.set(id, s);
  } else if (s.table === null && table !== null) {
    s.table = table;
  }
  return s;
}

type Stmt =
  | { kind: "binding"; binding: Binding }
  | { kind: "assert"; assertion: Assertion }
  | { kind: "chart"; chart: Chart };

function parseOne(
  rb: { raw: string; start: number; end: number },
  source: string,
  findings: Finding[],
  sheetId: string,
): Stmt | null {
  try {
    const s = parseStatement(rb.raw);
    if ("type" in s && s.type === "chart") {
      return {
        kind: "chart",
        chart: {
          id: `${sheetId}::chart@${rb.start}`,
          sheetId,
          name: s.name,
          engine: s.engine,
          series: s.series,
          labels: s.labels,
          aspect: s.aspect,
          span: { start: rb.start, end: rb.end },
          source: rb.raw,
        },
      };
    }
    if ("type" in s) {
      rebase(s.expr, rb.start);
      return {
        kind: "assert",
        assertion: {
          sheetId,
          expr: s.expr,
          span: { start: rb.start, end: rb.end },
          source: rb.raw,
          id: `${sheetId}::assert@${rb.start}`,
        },
      };
    }
    rebase(s.expr, rb.start);
    return {
      kind: "binding",
      binding: {
        id: sheetId === DOC_SCOPE ? s.name : `${sheetId}.${s.name}`,
        sheetId,
        name: s.name,
        expr: s.expr,
        kind: "scalar",
        span: { start: rb.start, end: rb.end },
      },
    };
  } catch (e) {
    if (e instanceof LangError) {
      findings.push({
        code: "TYPE",
        sheetId: sheetId || undefined,
        name: e.bindingName,
        message: e.message,
        raw: rb.raw,
        sourceOffset: rb.start + e.start,
        span: { start: rb.start + e.start, end: rb.start + e.end },
      });
      return null;
    }
    throw e;
  }
}

function rebase(expr: Expr, delta: number): void {
  expr.start += delta;
  expr.end += delta;
  switch (expr.type) {
    case "unary":
      rebase(expr.operand, delta);
      break;
    case "binary":
      rebase(expr.left, delta);
      rebase(expr.right, delta);
      break;
    case "call":
      for (const a of expr.args) rebase(a, delta);
      break;
  }
}
