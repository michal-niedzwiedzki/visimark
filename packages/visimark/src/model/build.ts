import type { Expr } from "../lang/ast.js";
import { parseStatement } from "../lang/parser.js";
import { LangError } from "../lang/token.js";
import type { LocatedDoc, RawBlock, Span } from "../parse/document.js";
import { closest } from "../report/levenshtein.js";
import {
  type Assertion,
  type Chart,
  type Binding,
  type DocModel,
  DOC_SCOPE,
  type Finding,
  type Sheet,
} from "./types.js";

/** the identifier grammar `ANCHOR_RE` and the expression lexer already use —
 *  a sheet id must be spellable by both, or it is unanchorable and
 *  unreferenceable no matter how it looks in the fence info string. */
const SHEET_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** the characters in `id` that `SHEET_ID_RE` would reject, unique and in
 *  order of first appearance — `a/b..c` names `/` and `.` once each. A
 *  leading digit is itself invalid (identifiers may not start with one),
 *  even though the same digit is fine elsewhere in the id. */
function invalidSheetIdChars(id: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const note = (ch: string): void => {
    if (seen.has(ch)) return;
    seen.add(ch);
    out.push(ch);
  };
  if (/[0-9]/.test(id[0] ?? "")) note(id[0]!);
  for (const ch of id) {
    if (/[A-Za-z0-9_]/.test(ch)) continue;
    note(ch);
  }
  return out;
}

/**
 * A document-scope block carries bare scalar bindings and nothing else: `assert`,
 * `chart`, `is` and quoted headers all name something that exists only relative to
 * a sheet's table, so each gets a SHEET finding rather than an unnameable binding.
 */
function buildDocScope(
  block: RawBlock,
  source: string,
  docScope: Map<string, Binding>,
  findings: Finding[],
): void {
  for (const rb of block.bindings) {
    const stmt = parseOne(rb, source, findings, DOC_SCOPE);
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
    if (stmt.kind === "alias") {
      // both quoted forms name a column of the sheet's own table, so
      // neither means anything in a table-less document-scope block
      // (spec §2) — say so rather than inventing an unnameable binding.
      findings.push({
        code: "SHEET",
        message: "`is` must be in a `#id` sheet block",
        sourceOffset: stmt.alias.span.start,
        span: stmt.alias.span,
      });
      continue;
    }
    if (stmt.quoted) {
      findings.push({
        code: "SHEET",
        message: "a quoted column header must be in a `#id` sheet block",
        sourceOffset: stmt.binding.span.start,
        span: stmt.binding.span,
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
}

export function build(doc: LocatedDoc): DocModel {
  const sheets = new Map<string, Sheet>();
  const docScope = new Map<string, Binding>();
  const findings: Finding[] = [];
  const blockOfSheet = new Map<string, RawBlock>();

  for (const block of doc.blocks) {
    if (block.sheetId === null) {
      buildDocScope(block, doc.source, docScope, findings);
      continue;
    }

    const sheetId = block.sheetId;
    blockOfSheet.set(sheetId, block);
    const table = doc.tableBeforeBlock.get(block) ?? null;
    const sheet = ensureSheet(sheets, sheetId, table, block.importDecl);

    if (block.grammarError) {
      findings.push({
        code: "TYPE",
        sheetId,
        message: block.grammarError.message,
        sourceOffset: block.grammarError.span.start,
        span: block.grammarError.span,
      });
    }

    if (block.importDecl && table !== null) {
      findings.push({
        code: "SHEET",
        sheetId,
        message: "an imported sheet may not also own an inline table",
        sourceOffset: block.importDecl.declSpan.start,
        span: block.importDecl.declSpan,
      });
    }

    if (!SHEET_ID_RE.test(sheetId)) {
      const bad = invalidSheetIdChars(sheetId);
      const label = bad.length === 1 ? "invalid character" : "invalid characters";
      const chars = bad.map((c) => "`" + c + "`").join(", ");
      findings.push({
        code: "SHEET",
        sheetId,
        message: `sheet id \`${sheetId}\` is not a valid identifier — ${label} ${chars}`,
        sourceOffset: block.span.start,
        span: block.span,
      });
    }

    if (doc.detachedTableBlocks.has(block)) {
      findings.push({
        code: "SHEET",
        sheetId,
        message: "this block declares column rules but no table immediately precedes it",
        sourceOffset: block.span.start,
        span: block.span,
      });
    }

    // --- header index, with duplicate-text detection -------------------
    // A duplicate header text is ambiguous for every kind of reference to
    // it — bare identifier or quoted — so neither instance becomes usable
    // as a name at all. This was a silent last-write-wins collision before
    // this feature (see docs/design/human-readable-column-aliases-spec.md
    // §3); closing it is not scoped to quoted references.
    const headerIndex = new Map<string, number>();
    const firstHeaderSeen = new Map<string, Span>();
    (table?.headers ?? []).forEach((h, i) => {
      const first = firstHeaderSeen.get(h.text);
      if (first) {
        findings.push({
          code: "DUP",
          sheetId,
          name: h.text,
          span: { start: h.start, end: h.end },
          relatedSpan: first,
        });
        headerIndex.delete(h.text);
        return;
      }
      firstHeaderSeen.set(h.text, { start: h.start, end: h.end });
      headerIndex.set(h.text, i);
    });

    // --- parse every statement in the block once ------------------------
    const stmts: Stmt[] = [];
    for (const rb of block.bindings) {
      const stmt = parseOne(rb, doc.source, findings, sheetId);
      if (stmt) stmts.push(stmt);
    }
    const chartNamesInBlock = new Set(
      stmts.flatMap((s) => (s.kind === "chart" ? [s.chart.name] : [])),
    );

    // --- pass 1: alias declarations, order-independent -------------------
    // An alias is resolved before any binding is classified, so `x = expr`
    // anywhere in the same block can already tell whether `x` means "assign a
    // rule to the header `x` aliases" rather than "define a new scalar `x`".
    for (const stmt of stmts) {
      if (stmt.kind !== "alias") continue;
      const { header, symbol, span } = stmt.alias;
      if (!headerIndex.has(header)) {
        findings.push({
          code: "UNDEF",
          sheetId,
          name: symbol,
          raw: header,
          suggestion: closest(header, headerIndex.keys()) ?? undefined,
          span,
        });
        continue;
      }
      // An alias symbol joins the sheet's one name space, so it collides with
      // a column rule, an input column (a header is a name too), a scalar,
      // another alias, or a chart — the same DUP every other name gets.
      const headerSpan = headerIndex.has(symbol) ? firstHeaderSeen.get(symbol) : undefined;
      const clash =
        sheet.columns.get(symbol)?.span ??
        sheet.scalars.get(symbol)?.span ??
        sheet.aliases.get(symbol)?.span ??
        sheet.charts.find((c) => c.name === symbol)?.span ??
        headerSpan ??
        (chartNamesInBlock.has(symbol) ? span : undefined);
      if (clash) {
        findings.push({ code: "DUP", sheetId, name: symbol, span, relatedSpan: clash });
        continue;
      }
      sheet.aliases.set(symbol, { header, span });
    }

    // --- pass 2: bindings and charts, in declaration order ----------------
    for (const stmt of stmts) {
      if (stmt.kind === "alias") continue; // handled in pass 1
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
          sheet.columns.get(stmt.chart.name)?.span ??
          sheet.scalars.get(stmt.chart.name)?.span ??
          sheet.charts.find((c) => c.name === stmt.chart.name)?.span ??
          sheet.aliases.get(stmt.chart.name)?.span;
        if (clash) {
          findings.push({
            code: "DUP",
            sheetId,
            name: stmt.chart.name,
            span: stmt.chart.span,
            relatedSpan: clash,
          });
          continue;
        }
        sheet.charts.push(stmt.chart);
        continue;
      }

      const parsed = stmt.binding;
      const alias = stmt.quoted ? undefined : sheet.aliases.get(parsed.name);
      if (alias) {
        // Writing through an alias's short name: the canonical key is the
        // header text, not the symbol — this is a rename, not a new binding.
        const existingRule = sheet.columns.get(alias.header);
        if (existingRule) {
          findings.push({
            code: "DUP",
            sheetId,
            name: parsed.name,
            span: parsed.span,
            relatedSpan: existingRule.span,
          });
          continue;
        }
        parsed.name = alias.header;
        parsed.id = `${sheetId}.${alias.header}`;
        parsed.kind = "column";
        sheet.columns.set(alias.header, parsed);
        // the alias may have been declared in an earlier block of this sheet,
        // whose table this block does not see — fall back to the index that
        // block already recorded rather than storing `undefined`.
        const idx = headerIndex.get(alias.header) ?? sheet.columnIndex.get(alias.header);
        if (idx !== undefined) sheet.columnIndex.set(alias.header, idx);
        sheet.inputColumns.delete(alias.header); // it has a rule now
        continue;
      }

      // A param is never a column: one named like a header of this sheet is a
      // DUP on the param, whatever the order of table and block. The column
      // keeps its data and its rule. See docs/design/scenario-params-spec.md §4.
      const headerClash = parsed.param !== undefined ? firstHeaderSeen.get(parsed.name) : undefined;
      if (headerClash) {
        findings.push({
          code: "DUP",
          sheetId,
          name: parsed.name,
          span: parsed.span,
          relatedSpan: headerClash,
        });
        continue;
      }
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
      if (stmt.quoted && !headerIndex.has(parsed.name)) {
        // A quoted binding never falls back to becoming a scalar — an
        // unresolved quoted header is unambiguously a mistake (spec §3).
        findings.push({
          code: "UNDEF",
          sheetId,
          // the quoted header text is the only name this binding has; without
          // it the report renders a bare `sheetId.`
          name: parsed.name,
          raw: parsed.name,
          suggestion: closest(parsed.name, headerIndex.keys()) ?? undefined,
          span: parsed.span,
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

  // A param named like a header that a *different* block of its sheet brings
  // in is caught here, after every block has contributed its table: the same
  // DUP the in-block check reports, whatever the order.
  for (const sheet of sheets.values()) {
    for (const [name, b] of sheet.scalars) {
      if (b.param === undefined || !sheet.columnIndex.has(name)) continue;
      const header = sheet.table?.headers.find((h) => h.text === name);
      sheet.scalars.delete(name);
      findings.push({
        code: "DUP",
        sheetId: sheet.id,
        name,
        span: b.span,
        ...(header ? { relatedSpan: { start: header.start, end: header.end } } : {}),
      });
    }
  }

  for (const span of doc.malformedAnchors) {
    findings.push({
      code: "ANCHOR",
      message: "malformed anchor comment — expected `<!--vmark=sheet.name-->`",
      sourceOffset: span.start,
      span,
    });
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

function ensureSheet(
  sheets: Map<string, Sheet>,
  id: string,
  table: Sheet["table"],
  imported: Sheet["imported"] = null,
): Sheet {
  let s = sheets.get(id);
  if (!s) {
    s = {
      id,
      table,
      columns: new Map(),
      scalars: new Map(),
      columnIndex: new Map(),
      inputColumns: new Set(),
      aliases: new Map(),
      assertions: [],
      charts: [],
      imported,
    };
    sheets.set(id, s);
  } else {
    if (s.table === null && table !== null) s.table = table;
    if (s.imported === null && imported !== null) s.imported = imported;
  }
  return s;
}

type Stmt =
  | { kind: "binding"; binding: Binding; quoted: boolean }
  | { kind: "assert"; assertion: Assertion }
  | { kind: "chart"; chart: Chart }
  | { kind: "alias"; alias: { header: string; symbol: string; span: Span } };

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
    if ("type" in s && s.type === "alias") {
      return {
        kind: "alias",
        alias: {
          header: s.header,
          symbol: s.symbol,
          span: { start: rb.start, end: rb.end },
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
      quoted: s.quoted,
      binding: {
        id: sheetId === DOC_SCOPE ? s.name : `${sheetId}.${s.name}`,
        sheetId,
        name: s.name,
        expr: s.expr,
        kind: "scalar",
        ...(s.precision === undefined ? {} : { precision: s.precision }),
        ...(s.param === undefined ? {} : { param: s.param }),
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
