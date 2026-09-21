# Human-readable column references and aliases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a quoted GFM header stand in as a column-rule left-hand side, and let `"Header" is symbol` give that column a short formula-facing name — closing the gap where a header with spaces, units, or punctuation can never be a column rule's target or a formula operand.

**Architecture:** Extend the existing lexer/parser to accept a string literal as a binding's left-hand side and to recognise a new `is` keyword statement. Resolve `is` aliases in `model/build.ts` as pure name translation (an alias is never a second binding, node, or vector — it is a second key that resolves to the same column). Everything downstream — the dependency graph, evaluation, write-back, `fmt` — needs no awareness that a name came from an alias, because `sheet.columns` / `sheet.scalars` / `sheet.inputColumns` stay keyed by canonical header text; the one place that learns about aliases is `eval/graph.ts`'s `resolve()`, which translates an alias symbol to its header before doing the lookup any other name already goes through.

**Tech Stack:** TypeScript, Bun test runner, the existing hand-written Pratt parser (`lang/`), `decimal.js` for arithmetic (untouched by this feature).

**Spec:** [`docs/design/human-readable-column-aliases-spec.md`](human-readable-column-aliases-spec.md)

## Global Constraints

- Every commit ends with the trailer from `.claude/rules/ai-attribution.md` for this session — resolve it at commit time, never hardcode a vendor name in this plan.
- Header matching is byte-for-byte against the header cell's raw source text (`RawCell.text`) — no trimming, case-folding, or punctuation normalisation, anywhere in this feature.
- `is` applies to columns only, never scalars (spec §7 non-goals).
- Neither the quoted-LHS form nor `is` may create a table column or rewrite a header — both are pure lookups against headers that already exist in the sheet's table (spec §3, §4).
- No cross-sheet quoted references or cross-sheet `is` aliasing in this feature (spec §7 non-goals).
- Run `bun test`, `bun run typecheck`, and `bun run build` from the repo root after every task; all three must be green before moving on.

---

## Task 1: Lexer and AST — the `is` keyword and the `AliasDecl` node

**Files:**
- Modify: `packages/visimark/src/lang/token.ts` (add `"is"` to `TokenKind`)
- Modify: `packages/visimark/src/lang/lexer.ts:136-147` (recognise `is` as a keyword, beside `chart`/`assert`)
- Modify: `packages/visimark/src/lang/ast.ts` (add `AliasDecl`)
- Test: `packages/visimark/test/lang/lexer.test.ts`

**Interfaces:**
- Produces: `Token { kind: "is"; value: "is"; start; end }`, and `AliasDecl { type: "alias"; header: string; symbol: string; start; end }` (exported from `ast.ts`), for Task 2 to consume.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/visimark/test/lang/lexer.test.ts — add
test("`is` lexes as a keyword, not an identifier", () => {
  const toks = lex("is");
  expect(toks[0]).toMatchObject({ kind: "is", value: "is" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/visimark/test/lang/lexer.test.ts -t "is.*lexes as a keyword"`
Expected: FAIL — `toks[0].kind` is `"ident"`.

- [ ] **Step 3: Write minimal implementation**

In `token.ts`, add `"is"` to the `TokenKind` union (next to `"assert"` / `"chart"`).

In `lexer.ts`, extend the identifier-classification `if`/`else if` chain (around line 136):

```typescript
      } else if (text === "chart") {
        // `chart` is a statement keyword, like `assert`. See the design doc,
        // section 4 and the generated-artifacts section.
        push("chart", text, start, i);
      } else if (text === "assert") {
        // `assert` is a statement keyword — recognised anywhere it is written,
        // rejected by the parser wherever a statement is not expected. See the
        // design doc, section 17.
        push("assert", text, start, i);
      } else if (text === "is") {
        // `is` introduces a column-alias declaration: `"Header" is symbol`.
        // Reserved everywhere, like `chart`/`assert`. See
        // docs/design/human-readable-column-aliases-spec.md.
        push("is", text, start, i);
      } else {
        push("ident", text, start, i);
      }
```

In `ast.ts`, append:

```typescript
/** A `"<header>" is <symbol>` statement. Binds no expression; declares that
 *  `symbol` is a second, formula-facing name for the column whose GFM header
 *  is `header`, exactly as `header` itself would be if it were an identifier.
 *  See docs/design/human-readable-column-aliases-spec.md. */
export interface AliasDecl extends Pos {
  type: "alias";
  header: string;
  symbol: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/visimark/test/lang/lexer.test.ts`
Expected: PASS, and every existing lexer test still passes (no `is`-named fixture exists yet in the suite).

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/lang/token.ts packages/visimark/src/lang/lexer.ts packages/visimark/src/lang/ast.ts packages/visimark/test/lang/lexer.test.ts
git commit -m "feat: lex \`is\` as a reserved keyword"
```

---

## Task 2: Parser — quoted binding LHS and the alias statement

**Files:**
- Modify: `packages/visimark/src/lang/parser.ts` (`parseBindingInner`, `parseStatementInner`, new `parseAlias`)
- Test: `packages/visimark/test/lang/parser.test.ts`

**Interfaces:**
- Consumes: `AliasDecl` from Task 1.
- Produces: `parseStatement(line: string): Binding | Assertion | ChartDecl | AliasDecl` (widened return type); `Binding` (parser-level, in `parser.ts`) gains `quoted: boolean` — `true` when the binding's left-hand side was a string literal rather than an identifier. Task 3/4 (model/build.ts) consume both.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/lang/parser.test.ts — add
test("a quoted string is legal as a binding's left-hand side", () => {
  const b = parseBinding('"Bandwidth per Unit (TB/s, full-duplex)" = ROUND(x, 2)');
  expect(b.name).toBe("Bandwidth per Unit (TB/s, full-duplex)");
  expect(b.quoted).toBe(true);
});

test("a plain identifier binding is not marked quoted", () => {
  const b = parseBinding("Net = Price * Qty");
  expect(b.quoted).toBe(false);
});

test("`is` parses as an alias declaration", () => {
  const s = parseStatement('"Bandwidth per Unit (TB/s, full-duplex)" is bpu');
  expect(s).toMatchObject({
    type: "alias",
    header: "Bandwidth per Unit (TB/s, full-duplex)",
    symbol: "bpu",
  });
});

test("`is` with no symbol after it is a parse error", () => {
  expect(() => parseStatement('"Header" is')).toThrow(/expected a name after `is`/);
});

test("`is` used outside the alias shape is rejected as a keyword", () => {
  expect(() => parseStatement("is = 1")).toThrow(/`is` is a keyword/);
  expect(() => parseStatement("x = is")).toThrow(/`is` is a keyword/);
});

test("a quoted binding with trailing junk after `is symbol` is a parse error", () => {
  expect(() => parseStatement('"Header" is bpu extra')).toThrow(/unexpected/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/visimark/test/lang/parser.test.ts -t "is\\b"`
Expected: FAIL — `parseBinding` rejects a string LHS today ("the left of `=` must be a single name"); `parseStatement` has no alias branch; `is` currently lexes as `ident` before Task 1 lands, or as a bare `is` token with no parser handling after it.

- [ ] **Step 3: Write minimal implementation**

In `parser.ts`, widen the LHS check in `parseBindingInner` (replace the block around line 260):

```typescript
function parseBindingInner(line: string): Binding {
  const toks = lex(line);
  const eqIndex = toks.findIndex((t) => t.kind === "op" && t.value === "=");
  if (eqIndex === -1) {
    throw new LangError("binding has no `=`", 0, line.length);
  }
  const lhs = toks.slice(0, eqIndex);
  const nameToks = lhs.filter((t) => t.kind !== "eof");
  if (nameToks.length !== 1 || (nameToks[0]!.kind !== "ident" && nameToks[0]!.kind !== "string")) {
    const start = nameToks[0]?.start ?? 0;
    const end = nameToks[nameToks.length - 1]?.end ?? line.length;
    throw new LangError("the left of `=` must be a name or a quoted column header", start, end);
  }
  const nameTok = nameToks[0]!;
  const rhs = toks.slice(eqIndex + 1); // keeps the trailing eof
  const expr = new Parser(rhs).parseTopLevel();
  return {
    name: nameTok.value,
    expr,
    nameStart: nameTok.start,
    nameEnd: nameTok.end,
    quoted: nameTok.kind === "string",
  };
}
```

Update the `Binding` interface just above it:

```typescript
export interface Binding {
  name: string;
  expr: Expr;
  nameStart: number;
  nameEnd: number;
  /** true when the left-hand side was a quoted column header, not an identifier */
  quoted: boolean;
}
```

Add `parseAlias` (near `parseChart`, after it):

```typescript
/** `"<header>" is <symbol>` — see docs/design/human-readable-column-aliases-spec.md */
function parseAlias(toks: Token[], headerTok: Token, isTok: Token): AliasDecl {
  let i = toks.indexOf(isTok) + 1;
  const at = (): Token => toks[i] ?? toks[toks.length - 1]!;

  const symTok = at();
  if (symTok.kind !== "ident") {
    throw new LangError("expected a name after `is`", symTok.start, symTok.end);
  }
  i++;

  const end = at();
  if (end.kind !== "eof") {
    throw new LangError(
      `unexpected ${end.kind === "op" ? `operator \`${end.value}\`` : end.kind}`,
      end.start,
      end.end,
    );
  }
  return {
    type: "alias",
    header: headerTok.value,
    symbol: symTok.value,
    start: headerTok.start,
    end: symTok.end,
  };
}
```

Import `AliasDecl` at the top of `parser.ts` alongside the other `ast.js` imports.

Update `parseStatementInner` (insert the string/`is` branch after the `assert`-anywhere-else check, before the final `return parseBinding(line)`):

```typescript
function parseStatementInner(line: string): Binding | Assertion | ChartDecl | AliasDecl {
  const toks = lex(line);
  const first = toks.find((t) => t.kind !== "eof");
  if (first?.kind === "chart") {
    return parseChart(toks, first);
  }
  if (toks.some((t) => t.kind === "chart")) {
    const at = toks.find((t) => t.kind === "chart")!;
    throw new LangError("`chart` is a keyword", at.start, at.end);
  }
  if (first?.kind === "assert") {
    const rest = toks.slice(toks.indexOf(first) + 1);
    if (rest[0]?.kind === "op" && rest[0].value === "=") {
      throw new LangError("`assert` is a keyword", first.start, first.end);
    }
    if (rest.length === 1 && rest[0]!.kind === "eof") {
      throw new LangError("assert needs an expression", first.start, first.end);
    }
    const expr = new Parser(rest).parseTopLevel();
    return { type: "assert", expr, start: first.start, end: expr.end };
  }
  if (toks.some((t) => t.kind === "assert")) {
    const at = toks.find((t) => t.kind === "assert")!;
    throw new LangError("`assert` is a keyword", at.start, at.end);
  }
  if (first?.kind === "string") {
    const afterIdx = toks.indexOf(first) + 1;
    const after = toks[afterIdx];
    if (after?.kind === "is") {
      return parseAlias(toks, first, after);
    }
  }
  if (toks.some((t) => t.kind === "is")) {
    const at = toks.find((t) => t.kind === "is")!;
    throw new LangError("`is` is a keyword", at.start, at.end);
  }
  return parseBinding(line);
}
```

Update `parseStatement`'s exported signature to widen its return type to include `AliasDecl` (the function body is unchanged — it already delegates to `parseStatementInner`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/visimark/test/lang/parser.test.ts`
Expected: PASS, and every existing parser test still passes.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/lang/parser.ts packages/visimark/test/lang/parser.test.ts
git commit -m "feat: parse quoted column-rule left-hand sides and \`is\` alias declarations"
```

---

## Task 3: Model types — `Sheet.aliases`

**Files:**
- Modify: `packages/visimark/src/model/types.ts` (`Sheet` interface)
- Modify: `packages/visimark/src/model/build.ts` (`ensureSheet` — the one place `build()` constructs a `Sheet`)
- Modify: `packages/visimark/src/infer/context.ts` (`provisional()` and `cloneSheet()` — two more places that construct a `Sheet` object literal, for `infer`'s candidate-verification machinery; grep confirms these are the *only* other construction sites: `grep -rn "columnIndex: new Map\|inputColumns: new Set" packages/visimark/src --include="*.ts"`)
- Test: none (a type-only change; exercised by Task 4's tests)

**Interfaces:**
- Produces: `Sheet.aliases: Map<string, { header: string; span: Span }>` — keyed by the alias symbol, for Task 4 (build), Task 5 (resolution), Task 6 (WARN), Task 7 (explain), Task 8 (infer) to consume. `provisional()`'s and `cloneSheet()`'s synthetic sheets carry an accurate `aliases` map too (copied from the real sheet, or empty for a freshly-minted one) even though nothing in this feature exercises `infer`'s numeric-fit verification path through an alias — the field must exist and be correctly populated for these to typecheck and for `cloneSheet()` to round-trip a sheet faithfully.

- [ ] **Step 1: Add the field**

In `types.ts`, extend the `Sheet` interface (after `inputColumns`):

```typescript
  /** header names with no rule — human-owned inputs */
  inputColumns: Set<string>;
  /** `"<header>" is <symbol>` declarations, keyed by `symbol`. An alias is
   *  never a second binding or a second column — `resolve()` in eval/graph.ts
   *  translates a reference to `symbol` into a reference to `header` before
   *  doing any lookup, so `columns` / `scalars` / `inputColumns` / `columnIndex`
   *  stay keyed by canonical header text only. See
   *  docs/design/human-readable-column-aliases-spec.md. */
  aliases: Map<string, { header: string; span: Span }>;
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `bun run typecheck`
Expected: FAIL — three `Sheet` object-literal construction sites are now missing a required field: `model/build.ts`'s `ensureSheet`, and `infer/context.ts`'s `provisional()` (the freshly-minted-sheet branch) and `cloneSheet()`.

- [ ] **Step 3: Fix all three call sites**

In `build.ts`'s `ensureSheet`, add `aliases: new Map()` to the object literal alongside `inputColumns: new Set()`.

In `infer/context.ts`'s `provisional()`, the branch that constructs a `Sheet` for a table with no existing block (around the `if (!sheets.has(s.id))` block) gets `aliases: new Map()` alongside `inputColumns: new Set(s.index.keys())` — a freshly-minted sheet has no aliases yet.

In `infer/context.ts`'s `cloneSheet()`, add `aliases: new Map(s.aliases)` alongside `inputColumns: new Set(s.inputColumns)` — this one **must** copy the source sheet's real aliases (not an empty map), since `cloneSheet()` exists to round-trip a sheet the document already declares, aliases included.

- [ ] **Step 4: Run typecheck to verify it passes**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/model/types.ts packages/visimark/src/model/build.ts packages/visimark/src/infer/context.ts
git commit -m "feat: add Sheet.aliases for column-alias declarations"
```

---

## Task 4: Model build — header-duplicate detection and alias resolution

This is the core of the feature: duplicate-header `DUP`, quoted/alias `UNDEF`, and alias name translation feeding the existing `DUP` and column/scalar classification logic unchanged.

**Files:**
- Modify: `packages/visimark/src/model/build.ts`
- Test: `packages/visimark/test/model/dup.test.ts` (extend), `packages/visimark/test/model/build.test.ts` (extend), new `packages/visimark/test/model/aliases.test.ts`

**Interfaces:**
- Consumes: `Sheet.aliases` (Task 3), `AliasDecl` and `Binding.quoted` (Tasks 1–2).
- Produces: `sheet.aliases` populated after `build()`; `sheet.columns` / `sheet.scalars` / `sheet.columnIndex` / `sheet.inputColumns` stay keyed by canonical header text only (an alias symbol never appears as a key in any of them) — Task 5 depends on this invariant.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/model/dup.test.ts — add
const duplicateHeaders = `
| Rate | Rate |
|-----:|-----:|
| 0.23 | 0.19 |

\`\`\`vmark #tax
x = 1
\`\`\`
`;

test("two header cells sharing identical text is DUP", () => {
  const r = build(locate(duplicateHeaders));
  const dups = r.findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]).toMatchObject({ sheetId: "tax", name: "Rate" });
});

test("a duplicated header name is unusable as a column rule target", () => {
  const withRule = `
| Rate | Rate |
|-----:|-----:|
| 0.23 | 0.19 |

\`\`\`vmark #tax
"Rate" = 1
\`\`\`
`;
  const r = build(locate(withRule));
  expect(r.findings.some((f) => f.code === "UNDEF")).toBe(true);
});
```

```typescript
// packages/visimark/test/model/aliases.test.ts — new file
import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";

const run = (s: string) => build(locate(s));

const withAlias = (rule: string) => `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
${rule}
\`\`\`
`;

test("an alias to an input column resolves with no rule", () => {
  const r = run(withAlias("peak = bpu"));
  expect(r.findings).toEqual([]);
  expect(r.sheets.get("network")!.aliases.get("bpu")).toMatchObject({
    header: "Bandwidth per Unit (TB/s, full-duplex)",
  });
});

test("assigning through the alias's short name is a column rule for the header", () => {
  const r = run(withAlias("bpu = GPUs * 2"));
  expect(r.findings).toEqual([]);
  const sheet = r.sheets.get("network")!;
  expect(sheet.columns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(true);
  expect(sheet.columns.has("bpu")).toBe(false); // canonical key is the header text
});

test("assigning through the alias when the header already has a rule is DUP", () => {
  const twoRules = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"Bandwidth per Unit (TB/s, full-duplex)" = GPUs
bpu = GPUs * 2
\`\`\`
`;
  const r = run(twoRules);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "network", name: "bpu" });
});

test("an alias whose header matches no column is UNDEF", () => {
  const r = run(withAlias("").replace('"Bandwidth per Unit (TB/s, full-duplex)" is bpu', '"Bandwidth per Unyt (TB/s)" is bpu'));
  const undef = r.findings.find((f) => f.code === "UNDEF");
  expect(undef).toMatchObject({ sheetId: "network", name: "bpu", raw: "Bandwidth per Unyt (TB/s)" });
  expect(undef!.suggestion).toBe("Bandwidth per Unit (TB/s, full-duplex)");
});

test("two aliases with the same symbol is DUP, first wins", () => {
  const twoAliases = `
| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is x
"B" is x
\`\`\`
`;
  const r = run(twoAliases);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s", name: "x" });
});

test("an alias symbol colliding with a chart name is DUP", () => {
  const clash = `
| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is chart1
chart chart1 as pie of B labelled A
\`\`\`
`;
  const r = run(clash);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/model/aliases.test.ts packages/visimark/test/model/dup.test.ts`
Expected: FAIL — `"H" is x` throws today wherever it's attempted (before Task 4, aliases were only parsed, never processed by `build`), duplicate headers silently last-write-wins with no `DUP`.

- [ ] **Step 3: Write the implementation**

Replace the sheet-processing body of `build()` in `build.ts` (the block from `const headerIndex = new Map...` at line 133 through the end of the `for (const rb of block.bindings)` loop at line 193) with:

```typescript
    // --- header index, with duplicate-text detection -------------------
    // A duplicate header text is ambiguous for every kind of reference to
    // it — bare identifier or quoted — so neither instance becomes usable
    // as a name at all. This was a silent last-write-wins collision before
    // this feature (see docs/design/human-readable-column-aliases-spec.md
    // §3); closing it is not scoped to quoted references.
    const headerIndex = new Map<string, number>();
    const firstHeaderSeen = new Map<string, { start: number; end: number }>();
    const blockedHeaderNames = new Set<string>();
    (table?.headers ?? []).forEach((h, i) => {
      if (blockedHeaderNames.has(h.text) || firstHeaderSeen.has(h.text)) {
        findings.push({
          code: "DUP",
          sheetId,
          name: h.text,
          span: { start: h.start, end: h.end },
          relatedSpan: firstHeaderSeen.get(h.text)!,
        });
        blockedHeaderNames.add(h.text);
        headerIndex.delete(h.text);
        return;
      }
      firstHeaderSeen.set(h.text, { start: h.start, end: h.end });
      headerIndex.set(h.text, i);
    });

    // --- parse every statement in the block once ------------------------
    const stmts = block.bindings
      .map((rb) => ({ rb, stmt: parseOne(rb, doc.source, findings, sheetId) }))
      .filter((x): x is { rb: (typeof block.bindings)[number]; stmt: Stmt } => x.stmt !== null);

    const chartNamesInBlock = new Set(
      stmts.filter((x) => x.stmt.kind === "chart").map((x) => (x.stmt as { chart: Chart }).chart.name),
    );

    // --- pass 1: alias declarations, order-independent -------------------
    // An alias is resolved before any binding is classified, so `x = expr`
    // later in this same loop can already tell whether `x` means "assign a
    // rule to the header `x` aliases" rather than "define a new scalar `x`".
    for (const { stmt } of stmts) {
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
      const clash =
        sheet.columns.get(symbol) ??
        sheet.scalars.get(symbol) ??
        (sheet.aliases.has(symbol) ? { span: sheet.aliases.get(symbol)!.span } : undefined) ??
        (chartNamesInBlock.has(symbol) ? { span } : undefined);
      if (clash) {
        findings.push({ code: "DUP", sheetId, name: symbol, span, relatedSpan: clash.span });
        continue;
      }
      sheet.aliases.set(symbol, { header, span });
    }

    // --- pass 2: bindings and charts, in declaration order ----------------
    for (const { stmt } of stmts) {
      if (stmt.kind === "alias") continue; // handled in pass 1
      if (stmt.kind === "assert") {
        sheet.assertions.push(stmt.assertion);
        continue;
      }
      if (stmt.kind === "chart") {
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
          sheet.charts.find((c) => c.name === stmt.chart.name) ??
          (sheet.aliases.has(stmt.chart.name)
            ? { span: sheet.aliases.get(stmt.chart.name)!.span }
            : undefined);
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
      const alias = !stmt.quoted ? sheet.aliases.get(parsed.name) : undefined;
      const targetName = alias ? alias.header : parsed.name;

      if (targetName !== parsed.name) {
        // Writing through an alias's short name: the canonical key is the
        // header text, not the symbol — this is a rename, not a new binding.
        const existingRule = sheet.columns.get(targetName);
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
        parsed.name = targetName;
        parsed.kind = "column";
        sheet.columns.set(targetName, parsed);
        sheet.columnIndex.set(targetName, headerIndex.get(targetName)!);
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
```

Add the `closest` import at the top of `build.ts`: `import { closest } from "../report/levenshtein.js";` (already used by `eval/check.ts` and `eval/graph.ts` for the identical did-you-mean shape — check its exact export signature there and match it, e.g. `closest(target: string, candidates: Iterable<string>, maxDistance?: number): string | null`).

Update the `Stmt` union and `parseOne` (both in `build.ts`) to add the alias case:

```typescript
type Stmt =
  | { kind: "binding"; binding: Binding; quoted: boolean }
  | { kind: "assert"; assertion: Assertion }
  | { kind: "chart"; chart: Chart }
  | { kind: "alias"; alias: { header: string; symbol: string; span: Span } };
```

(`Span` is already imported into `types.ts`; import it into `build.ts` too, or inline `{ start: number; end: number }`.)

In `parseOne`, add a branch before the existing `"type" in s && s.type === "chart"` check:

```typescript
    if ("type" in s && s.type === "alias") {
      return {
        kind: "alias",
        alias: { header: s.header, symbol: s.symbol, span: { start: rb.start + s.start, end: rb.start + s.end } },
      };
    }
```

and update the final `"binding"` return to carry `quoted: s.quoted` from the parser-level `Binding`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/visimark/test/model/aliases.test.ts packages/visimark/test/model/dup.test.ts packages/visimark/test/model/build.test.ts`
Expected: PASS. Then run the **full** suite once — this task touches the shared sheet-processing loop:

Run: `bun test`
Expected: PASS, no regressions in `example-invoice.md` / `example-invoice-drift.md` / `example-charts.md` acceptance tests (none of them use quoted bindings or `is`, so their finding counts must be unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/model/build.ts packages/visimark/test/model/aliases.test.ts packages/visimark/test/model/dup.test.ts
git commit -m "feat: resolve column aliases and quoted column rules in the model builder"
```

---

## Task 5: Name resolution — `resolve()` learns about aliases

**Files:**
- Modify: `packages/visimark/src/eval/graph.ts` (`resolve()`)
- Test: `packages/visimark/test/eval/graph.test.ts`

**Interfaces:**
- Consumes: `Sheet.aliases` (Task 3/4).
- Produces: `resolve(model, sheetId, ref)` now returns the same `Resolution` it always did for an aliased name — `{kind: "column", ...}` or `{kind: "input-column", ...}` — indistinguishable from resolving the header's own (identifier) name. Task 6 (WARN) and Task 8 (`infer`) do not depend on this task directly, but every evaluation and write-back path does transitively, since this is the only place alias translation happens for *reading*.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/eval/graph.test.ts — add
const doc = () => `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
peak = bpu
\`\`\`
`;

test("a bare alias resolves as an input-column, same as its header would", () => {
  const model = build(locate(doc()));
  const r = resolve(model, "network", { name: "bpu" });
  expect(r).toMatchObject({ kind: "input-column", sheetId: "network", column: "Bandwidth per Unit (TB/s, full-duplex)" });
});

test("a foreign reference through an alias is a vector outside an aggregate", () => {
  const twoSheets = `
${doc()}
\`\`\`vmark #other
x = network.bpu
\`\`\`
`;
  const r = build(locate(twoSheets));
  const checkResult = check(r);
  expect(checkResult.findings.some((f) => f.code === "VECTOR" && f.raw === "network.bpu")).toBe(true);
});

test("a typo'd alias suggests the real alias via did-you-mean", () => {
  const model = build(locate(doc()));
  const r = resolve(model, "network", { name: "bpuu" });
  expect(r.kind).toBe("unknown");
  if (r.kind === "unknown") expect(r.suggestion).toBe("bpu");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/eval/graph.test.ts -t "alias"`
Expected: FAIL — `resolve()` today has no notion of `sheet.aliases`, so `bpu` resolves as `unknown` with no useful suggestion.

- [ ] **Step 3: Write the implementation**

In `graph.ts`'s `resolve()`, translate the name through the sheet's aliases at the top of each branch, before any lookup. Replace the qualified branch's body:

```typescript
  if (ref.qualifier) {
    const sheet = model.sheets.get(ref.qualifier);
    if (!sheet) {
      return {
        kind: "unknown",
        badName: `${ref.qualifier}.${ref.name}`,
        suggestion: closest(ref.qualifier, model.sheets.keys()),
      };
    }
    const alias = sheet.aliases.get(ref.name);
    const name = alias ? alias.header : ref.name;
    const col = sheet.columns.get(name);
    if (col) return { kind: "column", binding: col, sheetId: sheet.id };
    if (sheet.inputColumns.has(name)) {
      return { kind: "input-column", sheetId: sheet.id, column: name };
    }
    const sc = sheet.scalars.get(name);
    if (sc) return { kind: "scalar", binding: sc, sheetId: sheet.id };
    return {
      kind: "unknown",
      badName: `${ref.qualifier}.${ref.name}`,
      suggestion: closest(ref.name, [
        ...sheet.columns.keys(),
        ...sheet.inputColumns,
        ...sheet.scalars.keys(),
        ...sheet.aliases.keys(),
      ]),
    };
  }
```

and, in the unqualified branch immediately below it, apply the same translation (`const alias = sheet.aliases.get(ref.name); const name = alias ? alias.header : ref.name;`) before its own `sheet.columns.get` / `sheet.inputColumns.has` / `sheet.scalars.get` calls, and add `...sheet.aliases.keys()` to that branch's did-you-mean candidate list too. (Read the rest of `resolve()` past line 100, not shown above, to apply the same edit — the structure mirrors the qualified branch exactly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/visimark/test/eval/graph.test.ts`
Expected: PASS.

Run: `bun test`
Expected: PASS, full suite green — this is the change most likely to have a distant ripple (every `SUM(sheet.col)`, `IF`, anchor, and write-back path calls `resolve()`).

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/graph.ts packages/visimark/test/eval/graph.test.ts
git commit -m "feat: resolve column aliases in name resolution"
```

---

## Task 6: `WARN` for an alias declared and never used

**Files:**
- Modify: `packages/visimark/src/eval/check.ts` (`collectReferenced`, and the WARN loop around line 582)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: `Sheet.aliases` (Task 3/4).
- Produces: one `WARN` finding per unused alias, `{code: "WARN", sheetId, name: symbol, span}` — the exact shape `format.ts`'s existing `WARN` renderer already prints with no changes to `format.ts`.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/eval/check.test.ts — add
const unusedAlias = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
peak = 1
\`\`\`
`;

test("an alias declared and never referenced is WARN", () => {
  const r = run(unusedAlias);
  expect(r.findings).toEqual([{ code: "WARN", sheetId: "network", name: "bpu", span: expect.anything() }]);
});

const usedInExpr = unusedAlias.replace("peak = 1", "peak = bpu");
test("an alias referenced in an expression is not WARN", () => {
  const r = run(usedInExpr);
  expect(r.findings.filter((f) => f.code === "WARN")).toEqual([]);
});

const usedInChart = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
chart bw as pie of bpu labelled GPUs
\`\`\`
`;
test("an alias referenced only in a chart's series is not WARN", () => {
  const r = run(usedInChart);
  expect(r.findings.filter((f) => f.code === "WARN")).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/eval/check.test.ts -t "alias"`
Expected: FAIL — `check()` has no WARN loop for aliases at all yet, so the first test sees zero findings instead of one `WARN`.

- [ ] **Step 3: Write the implementation**

Extend `collectReferenced` in `check.ts` to also return which aliases were used. Rename it to build both sets in one traversal:

```typescript
function collectReferenced(model: DocModel): { referenced: Set<string>; usedAliases: Set<string> } {
  const out = new Set<string>();
  const usedAliases = new Set<string>();
  const markAlias = (sheetId: string, name: string): void => {
    const sheet = model.sheets.get(sheetId);
    if (sheet?.aliases.has(name)) usedAliases.add(`${sheetId}.${name}`);
  };
  const visit = (e: Expr, sheetId: string): void => {
    if (e.type === "ref") {
      markAlias(e.qualifier ?? sheetId, e.name);
      const r = resolve(model, sheetId, e);
      if (r.kind === "scalar" || r.kind === "doc-scalar" || r.kind === "column") {
        out.add(r.binding.id);
      }
    } else if (e.type === "unary") visit(e.operand, sheetId);
    else if (e.type === "binary") {
      visit(e.left, sheetId);
      visit(e.right, sheetId);
    } else if (e.type === "call") for (const a of e.args) visit(a, sheetId);
  };
  for (const b of model.docScope.values()) visit(b.expr, b.sheetId);
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.columns.values()) visit(b.expr, b.sheetId);
    for (const b of sheet.scalars.values()) visit(b.expr, b.sheetId);
    for (const a of sheet.assertions) visit(a.expr, a.sheetId);
    for (const c of sheet.charts) {
      for (const full of [...c.series, c.labels]) {
        const dot = full.indexOf(".");
        if (dot === -1) markAlias(c.sheetId, full);
        else markAlias(full.slice(0, dot), full.slice(dot + 1));
      }
    }
  }
  return { referenced: out, usedAliases };
}
```

Update the one call site (around line 583):

```typescript
  const { referenced, usedAliases } = collectReferenced(model);
```

(the existing scalar-WARN loop right after it already uses `referenced` unchanged).

Add the alias-WARN loop immediately after that existing scalar-WARN loop:

```typescript
  // WARN: an `is` alias declared and never used anywhere
  for (const sheet of model.sheets.values()) {
    for (const [symbol, entry] of sheet.aliases) {
      if (usedAliases.has(`${sheet.id}.${symbol}`)) continue;
      emit({ code: "WARN", sheetId: sheet.id, name: symbol, span: entry.span });
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: PASS.

Run: `bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/eval/check.ts packages/visimark/test/eval/check.test.ts
git commit -m "feat: WARN an is alias that is declared and never used"
```

---

## Task 7: `explain` — show the alias mapping

**Files:**
- Modify: `packages/visimark/src/cli/commands.ts` (both the `--json` branch around line 436-457, and the plain-text branch around line 496-500)
- Test: `packages/visimark/test/cli/cli.test.ts`, `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: `Sheet.aliases` (Task 3/4).
- Produces: `explain --json`'s per-sheet object gains `aliases: { symbol: string; header: string }[]`; the plain-text renderer gains an `aliases:` block.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/cli/cli.test.ts — add
const withAlias = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
peak = bpu
\`\`\`
`;

test("explain lists an aliased column's header", () => {
  const { stdout } = runCli(["explain", writeTemp(withAlias)]);
  expect(stdout).toContain('aliases:');
  expect(stdout).toContain('bpu → "Bandwidth per Unit (TB/s, full-duplex)"');
});
```

```typescript
// packages/visimark/test/cli/json.test.ts — add
test("explain --json lists an aliased column's header", () => {
  const env = runJson(["explain", writeTemp(withAlias), "--json"]);
  expect(env.sheets[0].aliases).toEqual([
    { symbol: "bpu", header: "Bandwidth per Unit (TB/s, full-duplex)" },
  ]);
});
```

(Match `runCli` / `writeTemp` / `runJson` helper names to whatever `test/support/` already exports — read `test/cli/cli.test.ts`'s existing imports before writing this step, and use the same helpers the file already uses rather than the names guessed here.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/cli/cli.test.ts packages/visimark/test/cli/json.test.ts -t "alias"`
Expected: FAIL — neither renderer mentions aliases yet.

- [ ] **Step 3: Write the implementation**

In `commands.ts`'s `--json` branch, add `aliases` to the per-sheet object (alongside `inputs`):

```typescript
          inputs: [...sheet.inputColumns],
          aliases: [...sheet.aliases].map(([symbol, entry]) => ({ symbol, header: entry.header })),
```

In the plain-text branch, add a block right after the existing `inputs:` block:

```typescript
    if (sheet.inputColumns.size > 0) {
      out(`  inputs:  ${[...sheet.inputColumns].join(", ")}`);
    }
    if (sheet.aliases.size > 0) {
      out("  aliases:");
      for (const [symbol, entry] of sheet.aliases) out(`    ${symbol} → "${entry.header}"`);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/visimark/test/cli/cli.test.ts packages/visimark/test/cli/json.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/cli/commands.ts packages/visimark/test/cli/cli.test.ts packages/visimark/test/cli/json.test.ts
git commit -m "feat: show column aliases in explain output"
```

---

## Task 8: `infer` — propose an alias for a non-identifier header

**Files:**
- Create: `packages/visimark/src/infer/aliases.ts`
- Modify: `packages/visimark/src/infer/context.ts` (`InferSheet` gains an `aliasedHeaders` field — see below; `buildContext` populates it)
- Modify: `packages/visimark/src/infer/propose.ts` (merge alias proposals into `infer()`'s result)
- Modify: `packages/visimark/src/report/infer.ts` (`formatInfer` — print the new bucket)
- Modify: `packages/visimark/src/infer/write.ts` (`planInfer` — write `"<header>" is <symbol>` lines under `--write`)
- Test: `packages/visimark/test/infer/aliases.test.ts` (new), extend `packages/visimark/test/infer/infer.test.ts` and `packages/visimark/test/infer/write.test.ts` if that file exists (check `test/infer/` for its actual write-path test filename first)

**Interfaces:**
- Consumes: `InferContext` / `InferSheet` from `infer/context.ts`. `infer` re-parses the whole document independently of `model/build.ts` for its own candidate-fitting search (`buildContext` in `context.ts` calls `build(doc)` once, into `ctx.base`, purely to know what a sheet already declares — `InferSheet` itself is `context.ts`'s own lighter view, built straight from the raw table). Concretely: `InferSheet.table.headers` is `RawCell[]` (each with `.text`); `InferSheet.index: Map<string, number>` is header text → column index; `InferSheet.managed: Set<string>` is header names that already carry a rule (derived from `ctx.base.sheets.get(id).columns.keys()`, which — per Task 4's design — is keyed by canonical header text only, so `managed` needs no change for this feature).
- Produces: `InferSheet` gains `aliasedHeaders: Set<string>` — header texts that already carry an `is` alias, so `proposeAliases` skips them. Populate it in `buildContext`, next to `managed`: `aliasedHeaders: new Set([...(existing?.aliases.values() ?? [])].map((a) => a.header))`. `Proposal` (in `propose.ts`) gains `kind: "alias"` with `name` (the proposed symbol) and a new field `header: string` (the header text it aliases). `infer/aliases.ts` exports `proposeAliases(sheet: InferSheet, taken: Set<string>): Proposal[]` where `taken` is every name already spoken for in that sheet (columns, scalars, existing aliases, builtins, keywords) — Task 8 computes `taken` in `infer()` (in `propose.ts`) from `sheet.index.keys()`, `ctx.base.sheets.get(sheet.id)?.scalars.keys() ?? []`, `ctx.base.sheets.get(sheet.id)?.aliases.keys() ?? []`, and the fixed keyword/builtin list (`is`, `assert`, `chart`, plus the thirteen builtin function names in `eval/functions.ts`'s `FUNCTIONS` map).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/visimark/test/infer/aliases.test.ts — new file
import { expect, test } from "bun:test";
import { proposeAliases } from "../../src/infer/aliases.js";

test("generates an acronym from non-stopword tokens, lowercased", () => {
  const name = generateAliasName("Bandwidth per Unit (TB/s, full-duplex)");
  expect(name).toBe("butsfd");
});

test("drops a fixed, closed stopword list", () => {
  expect(generateAliasName("Rate of the Discount")).not.toContain("o"); // "of" dropped
});

test("prefixes an underscore when the result would start with a digit", () => {
  expect(generateAliasName("3D Printer Cost")).toMatch(/^_/);
});

test("a header already reachable as an identifier gets no alias proposal", () => {
  // "Net" needs no alias — it is already a legal identifier
  const proposals = proposeAliases(sheetWithHeaders(["Net", "Qty"]), new Set());
  expect(proposals).toEqual([]);
});

test("a collision with an existing name falls back to no proposal", () => {
  const proposals = proposeAliases(sheetWithHeaders(["Net Total"]), new Set(["nt"]));
  expect(proposals).toEqual([]);
});
```

(`generateAliasName` should be exported from `infer/aliases.ts` alongside `proposeAliases` so the naming rule is independently testable; `sheetWithHeaders` is a small local test helper you write, constructing a minimal `InferSheet` — `{ id, minted: false, table: { headers: names.map((text) => ({ text, start: 0, end: 0 })), rows: [], span: { start: 0, end: 0 } }, block: null, index: new Map(names.map((n, i) => [n, i])), numeric: [], managed: new Set(), filled: new Map(), constant: new Set(), aliasedHeaders: new Set() }` — the last field only exists once this task's `context.ts` edit lands, so write this helper after that edit, not before.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/infer/aliases.test.ts`
Expected: FAIL — the module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `infer/aliases.ts`:

```typescript
import type { InferSheet } from "./context.js";
import type { Proposal } from "./propose.js";

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const STOPWORDS = new Set([
  "a", "an", "the", "of", "per", "in", "on", "for", "and", "or", "to", "at", "by",
]);

/**
 * A stopword-aware, first-letter acronym of a header. Deterministic and
 * document-independent — no locale, no config. See
 * docs/design/human-readable-column-aliases-spec.md §5.
 */
export function generateAliasName(header: string): string {
  const tokens = header.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const kept = tokens.filter((t) => !STOPWORDS.has(t.toLowerCase()));
  let name = kept.map((t) => t[0]!.toLowerCase()).join("");
  if (name === "" || /^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

/**
 * Proposes an `is` alias for every header in `sheet` that is not already an
 * identifier and has no rule or alias yet. `taken` is every name already
 * spoken for in this sheet (columns, scalars, existing aliases, builtins,
 * keywords) — a colliding proposal is dropped rather than emitted, exactly
 * like `infer`'s existing near-miss/ambiguous fallback (spec §5).
 */
export function proposeAliases(sheet: InferSheet, taken: Set<string>): Proposal[] {
  const out: Proposal[] = [];
  const seen = new Set(taken);
  for (const header of sheet.table.headers.map((h) => h.text)) {
    if (IDENT_RE.test(header)) continue;
    if (sheet.managed.has(header)) continue; // already has a rule
    if (sheet.aliasedHeaders.has(header)) continue; // already has an alias
    const name = generateAliasName(header);
    if (seen.has(name)) continue; // collision — infer.ts's `ambiguous` bucket prints it, not this function
    seen.add(name);
    out.push({
      kind: "alias",
      stage: 1,
      sheetId: sheet.id,
      name,
      header,
      rule: `"${header}" is ${name}`,
      fits: 0,
      rows: 0,
      tableSpan: sheet.table.span,
    });
  }
  return out;
}
```

In `infer/context.ts`, add the `aliasedHeaders` field to the `InferSheet` interface (next to `managed`):

```typescript
  /** headers that already carry a rule; inference never proposes for these */
  managed: Set<string>;
  /** headers that already carry an `is` alias; inference never proposes a second one */
  aliasedHeaders: Set<string>;
```

and populate it in `buildContext`'s sheet-construction loop, next to `managed: new Set(existing?.columns.keys() ?? [])`:

```typescript
      managed: new Set(existing?.columns.keys() ?? []),
      aliasedHeaders: new Set([...(existing?.aliases.values() ?? [])].map((a) => a.header)),
```

(`existing` is `base.sheets.get(id)` — already in scope at that point in `buildContext`, a few lines above.)

Add `kind: "alias"` to `ProposalKind` in `propose.ts`, and a `header?: string` field to `Proposal`. In `infer()`, after the existing column/scalar proposal search for each sheet, compute `taken` (every column name, scalar name, alias symbol, and the 13 builtin names plus `is`/`assert`/`chart`) and call `proposeAliases`, appending the result to the returned list.

In `report/infer.ts`'s `formatInfer`, add a new section between `rules` and `constants`:

```typescript
    section(lines, "column aliases", aliasProposals(group));
```

with a `aliasProposals` renderer parallel to `rules()`:

```typescript
function aliasProposals(group: Proposal[]): string[] {
  const ps = group.filter((p) => p.kind === "alias");
  const w = field(ps.map((p) => p.name));
  return ps.map((p) => `    ${p.name.padEnd(w)}for "${p.header}"`);
}
```

In `infer/write.ts`'s `planInfer`, extend the `writable` filter to include `p.kind === "alias"`, and extend the per-sheet body assembly to render alias proposals as their own group above the column-rule group (`"<header>" is <name>`, not `<name> = <rule>`) — add an `alignAliases()` helper alongside the existing `align()` if `align()`'s `name = rule` shape does not fit an alias line (read `align()`'s implementation before deciding whether to reuse or fork it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/visimark/test/infer/`
Expected: PASS.

Run: `bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/infer/aliases.ts packages/visimark/src/infer/context.ts packages/visimark/src/infer/propose.ts packages/visimark/src/report/infer.ts packages/visimark/src/infer/write.ts packages/visimark/test/infer/aliases.test.ts
git commit -m "feat: infer proposes is aliases for non-identifier headers"
```

---

## Task 9: Acceptance — the worked example and hard-error fixtures

**Files:**
- Create: `docs/example-bandwidth.md`
- Create: `packages/visimark/test/fixtures/column-alias-undef.md`, `column-alias-dup-header.md`, `column-alias-dup-target.md`, `column-alias-unused.md`, `column-alias-quoted-string-header.md`
- Modify: `packages/visimark/test/acceptance.test.ts` (add `example-bandwidth.md` to the set of normative examples it checks)
- Test: the fixtures above, exercised via `packages/visimark/test/eval/check.test.ts` or a new `packages/visimark/test/model/aliases-fixtures.test.ts`

**Interfaces:**
- Consumes: the whole feature (Tasks 1–8).
- Produces: nothing new — this task is the end-to-end proof, not a code change.

- [ ] **Step 1: Write `docs/example-bandwidth.md`**

```markdown
# GPU network bandwidth

| GPUs | Bandwidth per Unit (TB/s, full-duplex) | GPU-to-GPU Bandwidth (GB/s, full-duplex) |
|-----:|----------------------------------------:|------------------------------------------:|
|    8 |                                      3.2 |                                        400 |
|   16 |                                      3.2 |                                        400 |

```vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"GPU-to-GPU Bandwidth (GB/s, full-duplex)" is gpu_bw

gpu_bw = ROUND(bpu / GPUs * 1000, 0)
peak = MAX(gpu_bw)
```

Peak GPU-to-GPU bandwidth: **400**<!--vmark=network.peak-->

<!--vmark:no-formulas-->
```

Compute `gpu_bw` by hand first and confirm it matches the table's stored `400` in both rows before treating this as done — `ROUND(3.2 / 8 * 1000, 0)` = `400`, `ROUND(3.2 / 16 * 1000, 0)` = `200`. **The two rows do not agree on `400`** — fix the second row's stored `GPU-to-GPU Bandwidth` cell to `200` (or change `GPUs` in row 2 to `8` if two identical rows are wanted instead) before running `check`, or `check` will correctly report a `STALE` finding on that cell. Pick whichever fix keeps the table meaningful as a two-row example (two different `GPUs` counts producing two different bandwidths is more illustrative — use `200` in row 2).

- [ ] **Step 2: Verify against the CLI directly**

Run: `bun run packages/visimark/src/cli/main.ts check docs/example-bandwidth.md`
Expected: `0 problems (0 stale, 0 errors)`. If not, fix the document (not the engine) until it is.

Run: `bun run packages/visimark/src/cli/main.ts fmt docs/example-bandwidth.md` then re-check it is byte-identical (`git diff --stat docs/example-bandwidth.md` shows nothing).

Run: `bun run packages/visimark/src/cli/main.ts explain docs/example-bandwidth.md`
Confirm the output's `aliases:` block names both `bpu` and `gpu_bw` against their headers.

- [ ] **Step 3: Add it to the acceptance suite**

Read `packages/visimark/test/acceptance.test.ts` first to see exactly how `example-invoice.md` / `example-charts.md` are wired in (file path, expected exit code, expected `0 problems` line), then add `docs/example-bandwidth.md` the same way.

- [ ] **Step 4: Write the fixtures and their tests**

```markdown
<!-- packages/visimark/test/fixtures/column-alias-undef.md -->
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

```vmark #network
"Bandwidth per Unyt (TB/s)" is bpu
```
```

```typescript
// packages/visimark/test/model/aliases-fixtures.test.ts — new file
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

test("column-alias-undef.md: UNDEF naming the alias and the header text", () => {
  const r = check(build(locate(fixture("column-alias-undef.md"))));
  expect(r.findings).toEqual([
    {
      code: "UNDEF",
      sheetId: "network",
      name: "bpu",
      raw: "Bandwidth per Unyt (TB/s)",
      suggestion: "Bandwidth per Unit (TB/s, full-duplex)",
      span: expect.anything(),
    },
  ]);
});
```

Write the remaining four fixtures (`column-alias-dup-header.md`, `column-alias-dup-target.md`, `column-alias-unused.md`, `column-alias-quoted-string-header.md`) matching the shapes already proven in Task 4's and Task 6's unit tests, and add one assertion each to `aliases-fixtures.test.ts` in the same style — reuse the exact source text from those earlier tests rather than inventing new tables, so the fixture and the unit test that first proved the behaviour stay in lockstep.

For `column-alias-quoted-string-header.md`, the header must contain a literal `"` (e.g. `Length ("inch")`), proving no quoted reference or alias can name it — assert that `infer(source)` proposes no alias for that header (it should surface only in the plain "no rule found — treating as inputs" bucket).

- [ ] **Step 5: Run the full suite and commit**

Run: `bun test && bun run typecheck && bun run build`
Expected: all green.

```bash
git add docs/example-bandwidth.md packages/visimark/test/fixtures/column-alias-*.md packages/visimark/test/model/aliases-fixtures.test.ts packages/visimark/test/acceptance.test.ts
git commit -m "test: acceptance example and hard-error fixtures for column aliases"
```

---

## Task 10: Documentation

**Files:**
- Modify: `docs/visimark-design.md` (§3, §4, §6, §10 — see below)
- Modify: `CHANGELOG.md`
- Modify: `docs/vocabulary-catalogue.md`
- Modify: `docs/cli-reference.md` (if it documents `explain`'s output shape or the keyword list)
- Modify: `editors/vscode/CHANGELOG.md` (the LSP surface changes: `is` becomes a reserved word, so a document using it as an identifier now gets a diagnostic where it previously didn't)

- [ ] **Step 1: `docs/visimark-design.md`**

- §3 (Document model): note that a binding's left-hand side may be a quoted string as well as an identifier, matched against a header's raw source text; a duplicate header text is a `DUP` finding, closing what was previously an unremarked last-write-wins collision.
- §4 (Syntax): add the `is` statement next to `chart`/`assert` in the keyword list, and describe the quoted binding form and its "never falls back to a scalar" rule.
- §6 (Name resolution and scoping): note that an alias is resolved before any other name lookup and is indistinguishable from its header's own identifier name everywhere after that.
- §10 (Error taxonomy): the `DUP` row's "Meaning" cell gains "or two header cells sharing text" and the `WARN` row's gains "or an alias declared and never used" — follow the exact prose style `STALE`'s row already uses for "widened again."

- [ ] **Step 2: `CHANGELOG.md`**

Under `## Unreleased` → `### Added`:

```markdown
- A quoted GFM header (`"Header" = expr`) is now a legal column-rule left-hand side, and `"Header" is symbol` gives that column a short formula-facing name — closes #86.
```

- [ ] **Step 3: `docs/vocabulary-catalogue.md`**

Move the section-E row for #86 out of its section table and into the Shipped register (see the register's own format for an already-shipped row), `Status` = `UNRELEASED`, `Landed` = this PR, `Released` = `—`, `Decision` = the deciding comment link. Read the Shipped register's header row first to match its exact column set.

- [ ] **Step 4: `docs/cli-reference.md`**

If it enumerates `explain`'s per-sheet output fields or lists reserved words, add `aliases` and `is` respectively. If it does not go into that level of detail today, skip this file — do not add a section that does not match the rest of the document's granularity.

- [ ] **Step 5: `editors/vscode/CHANGELOG.md`**

One line: `is` is now a reserved word — a document that used it as a column or scalar name will start getting a diagnostic.

- [ ] **Step 6: Commit**

```bash
git add docs/visimark-design.md CHANGELOG.md docs/vocabulary-catalogue.md docs/cli-reference.md editors/vscode/CHANGELOG.md
git commit -m "docs: document human-readable column references and aliases"
```
