import type { Expr, UnitText } from "../lang/ast.js";
import { parseUnit, type UnitDefs, type UnitMap } from "../lang/unit-expr.js";
import { headerNameList, headerNames } from "./header-name.js";
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
  type Report,
  type Sheet,
  type UnitDefinition,
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
  unitDefinitions: UnitDefinition[],
): void {
  for (const rb of block.bindings) {
    const stmt = parseOne(rb, source, findings, DOC_SCOPE);
    if (!stmt) continue;
    if (stmt.kind === "unitdef") {
      unitDefinitions.push(stmt.def);
      continue;
    }
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
    if (stmt.kind === "report") {
      findings.push({
        code: "SHEET",
        message: "`report` must be in a `#id` sheet block",
        sourceOffset: stmt.report.span.start,
        span: stmt.report.span,
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
    declareUnit(parsed, findings);
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
  const unitDefinitions: UnitDefinition[] = [];

  for (const block of doc.blocks) {
    if (block.sheetId === null) {
      buildDocScope(block, doc.source, docScope, findings, unitDefinitions);
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
    // A header's name is its text with any trailing unit clause removed, so
    // `Weight` and `Weight [kg]` collide here exactly as two `Weight`s would
    // (algebraic-unit-maps-on-names-spec.md §2.3).
    const headerIndex = new Map<string, number>();
    const firstHeaderSeen = new Map<string, Span>();
    /** full header text → its name, for headers whose text a unit clause changes */
    const bracketedHeaders = new Map<string, string>();
    const split = table ? headerNames(table, doc.source) : [];
    (table?.headers ?? []).forEach((h, i) => {
      const hn = split[i]!;
      const cellSpan = h.cellSpan ?? { start: h.start, end: h.end };
      if (hn.error) {
        findings.push({
          code: "UNIT",
          sheetId,
          ...(hn.name === null ? {} : { name: hn.name }),
          message: hn.error.message,
          sourceOffset: hn.error.span.start,
          span: hn.error.span,
        });
      }
      if (hn.name === null) return;
      const name = hn.name;
      if (hn.unit) bracketedHeaders.set(doc.source.slice(cellSpan.start, cellSpan.end), name);
      const first = firstHeaderSeen.get(name);
      if (first) {
        findings.push({
          code: "DUP",
          sheetId,
          name,
          span: { start: h.start, end: h.end },
          relatedSpan: first,
        });
        headerIndex.delete(name);
        sheet.headerUnits.delete(name);
        return;
      }
      firstHeaderSeen.set(name, { start: h.start, end: h.end });
      headerIndex.set(name, i);
      if (hn.unit) {
        const parsed = parseUnit(hn.unit.text);
        if (parsed.ok) {
          sheet.headerUnits.set(name, { map: parsed.map, text: hn.unit });
        } else {
          findings.push({
            code: "UNIT",
            sheetId,
            name,
            message: parsed.message,
            sourceOffset: hn.unit.start,
            span: { start: hn.unit.start, end: hn.unit.end },
          });
        }
      }
    });
    const bracketHint = (text: string): string | undefined => {
      const name = bracketedHeaders.get(text);
      if (name === undefined) return undefined;
      const unit = text.slice(text.lastIndexOf("["));
      return `the header's name is ${name}; ${unit} is its unit`;
    };

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
        const hint = bracketHint(header);
        findings.push({
          code: "UNDEF",
          sheetId,
          name: symbol,
          raw: header,
          ...(hint ? { hint } : { suggestion: closest(header, headerIndex.keys()) ?? undefined }),
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
      if (stmt.kind === "unitdef") {
        // a unit is global, so its definition lives where global names do
        findings.push({
          code: "SHEET",
          sheetId,
          message: "a unit definition belongs in a document-scope block",
          sourceOffset: stmt.def.span.start,
          span: stmt.def.span,
        });
        continue;
      }
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
      if (stmt.kind === "report") {
        const first = sheet.reports.find((r) => r.text === stmt.report.text);
        if (first) {
          findings.push({
            code: "DUP",
            sheetId,
            message: `${stmt.report.text} is declared twice in sheet ${sheetId}`,
            sourceOffset: stmt.report.span.start,
            span: stmt.report.span,
            relatedSpan: first.span,
          });
          continue;
        }
        sheet.reports.push(stmt.report);
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
        refuseRuleUnit(parsed, sheetId, findings);
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
        const hint = bracketHint(parsed.name);
        findings.push({
          code: "UNDEF",
          sheetId,
          // the quoted header text is the only name this binding has; without
          // it the report renders a bare `sheetId.`
          name: parsed.name,
          raw: parsed.name,
          ...(hint
            ? { hint }
            : { suggestion: closest(parsed.name, headerIndex.keys()) ?? undefined }),
          span: parsed.span,
        });
        continue;
      }
      const isColumn = table !== null && headerIndex.has(parsed.name);
      parsed.kind = isColumn ? "column" : "scalar";
      if (isColumn) {
        refuseRuleUnit(parsed, sheetId, findings);
      } else {
        declareUnit(parsed, findings);
      }
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
      const at = sheet.table ? headerNameList(sheet.table, doc.source).indexOf(name) : -1;
      const header = at === -1 ? undefined : sheet.table!.headers[at];
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
      message:
        "malformed anchor comment — expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name|rule-->`",
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
    unitDefinitions,
    unitDefs: resolveUnitDefinitions(unitDefinitions, doc.source, findings),
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
      headerUnits: new Map(),
      aliases: new Map(),
      assertions: [],
      charts: [],
      reports: [],
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
  | { kind: "report"; report: Report }
  | { kind: "alias"; alias: { header: string; symbol: string; span: Span } }
  | { kind: "unitdef"; def: { atom: UnitText; unit: UnitText; span: Span } };

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
    if ("type" in s && s.type === "report") {
      for (const r of s.refs) rebase(r, rb.start);
      return {
        kind: "report",
        report: {
          id: `${sheetId}::report@${rb.start}`,
          sheetId,
          name: s.name,
          refs: s.refs,
          text: s.text,
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
    if ("type" in s && s.type === "unitdef") {
      return {
        kind: "unitdef",
        def: {
          atom: shiftUnit(s.atom, rb.start),
          unit: shiftUnit(s.unit, rb.start),
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
        ...(s.domain === undefined ? {} : { domain: s.domain }),
        ...(s.lattice === undefined ? {} : { lattice: s.lattice }),
        ...(s.unit === undefined ? {} : { unitText: shiftUnit(s.unit, rb.start) }),
        span: { start: rb.start, end: rb.end },
      },
    };
  } catch (e) {
    if (e instanceof LangError) {
      findings.push({
        code: e.code ?? "TYPE",
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

function shiftUnit(u: UnitText, delta: number): UnitText {
  return { text: u.text, start: u.start + delta, end: u.end + delta };
}

function rebase(expr: Expr, delta: number): void {
  expr.start += delta;
  expr.end += delta;
  switch (expr.type) {
    case "num":
      if (expr.unit) expr.unit = shiftUnit(expr.unit, delta);
      break;
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

/** a column's unit lives on its header; a bracket on its rule's head is refused */
function refuseRuleUnit(b: Binding, sheetId: string, findings: Finding[]): void {
  if (!b.unitText) return;
  findings.push({
    code: "UNIT",
    sheetId,
    name: b.name,
    message: `${b.name}'s unit is declared on its header, not on its rule`,
    sourceOffset: b.unitText.start,
    span: { start: b.unitText.start, end: b.unitText.end },
  });
}

/** parse a scalar's or a param's head bracket into `unit`, or report why not */
function declareUnit(b: Binding, findings: Finding[]): void {
  if (!b.unitText) return;
  const parsed = parseUnit(b.unitText.text);
  if (parsed.ok) {
    b.unit = { map: parsed.map, text: b.unitText };
    return;
  }
  findings.push({
    code: "UNIT",
    ...(b.sheetId ? { sheetId: b.sheetId } : {}),
    name: b.name,
    message: parsed.message,
    sourceOffset: b.unitText.start,
    span: { start: b.unitText.start, end: b.unitText.end },
  });
}

export const DIMENSIONLESS_DEFINITION_MESSAGE = "a unit cannot be defined as dimensionless";

/**
 * Turn the document's `[atom] = [unit]` lines into the map the unit pass
 * expands through. A definition that does not parse, redefines an atom, or
 * sits on a cycle is reported and left out, so nothing expands through it.
 * See docs/design/algebraic-unit-maps-on-names-spec.md §2.5, §4.
 */
function resolveUnitDefinitions(
  defs: UnitDefinition[],
  source: string,
  findings: Finding[],
): UnitDefs {
  const parsedDefs = new Map<string, { map: UnitMap; span: Span }>();
  for (const d of defs) {
    const atomParse = parseUnit(d.atom.text);
    const atom = atomParse.ok ? [...atomParse.map.keys()][0]! : d.atom.text.trim();
    const first = parsedDefs.get(atom);
    if (first) {
      findings.push({
        code: "DUP",
        name: `[${atom}]`,
        message: `[${atom}] is already defined at line ${lineOf(source, first.span.start)}`,
        span: d.span,
        relatedSpan: first.span,
      });
      continue;
    }
    const rhs = parseUnit(d.unit.text);
    if (!rhs.ok) {
      const dimensionless = rhs.message.endsWith("declares no unit");
      findings.push({
        code: "UNIT",
        name: `[${atom}]`,
        message: dimensionless ? DIMENSIONLESS_DEFINITION_MESSAGE : rhs.message,
        sourceOffset: d.unit.start,
        span: { start: d.unit.start, end: d.unit.end },
      });
      continue;
    }
    parsedDefs.set(atom, { map: rhs.map, span: d.span });
  }

  // an atom whose expansion reaches itself is on a cycle
  const onCycle = new Set<string>();
  const reported = new Set<string>();
  for (const start of parsedDefs.keys()) {
    const path: string[] = [];
    const walk = (atom: string): string[] | null => {
      const at = path.indexOf(atom);
      if (at !== -1) return [...path.slice(at), atom];
      const def = parsedDefs.get(atom);
      if (!def) return null;
      path.push(atom);
      for (const next of def.map.keys()) {
        const found = walk(next);
        if (found) return found;
      }
      path.pop();
      return null;
    };
    const cycle = walk(start);
    if (!cycle) continue;
    for (const a of cycle) onCycle.add(a);
    const key = [...new Set(cycle)].sort().join(" ");
    if (reported.has(key)) continue;
    reported.add(key);
    const def = parsedDefs.get(cycle[0]!)!;
    findings.push({
      code: "CYCLE",
      cyclePath: cycle.map((a) => `[${a}]`),
      span: def.span,
    });
  }

  const out = new Map<string, UnitMap>();
  for (const [atom, d] of parsedDefs) {
    if (onCycle.has(atom)) continue;
    if ([...d.map.keys()].some((a) => onCycle.has(a))) continue;
    out.set(atom, d.map);
  }
  return out;
}

function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === "\n") line++;
  return line;
}
