# VisiMark CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `visimark` CLI — `check`, `fmt`, `eval`, `explain` — that parses a Markdown document with `vmark` formula blocks, evaluates it in decimal arithmetic, and proves stored numbers agree with their formulas.

**Architecture:** Seven pure-ish modules in dependency order: `lang` (tokenizer + Pratt parser for the expression grammar), `parse` (remark/remark-gfm → located tables, blocks, anchors with byte offsets), `model` (sheets, columns, bindings, scopes), `eval` (cross-sheet dependency graph, topological evaluation, decimal semantics, findings), `write` (byte-offset splicer over the original source — never re-stringifies), `report` (finding formatting + did-you-mean), `cli` (command surface). No module imports `vscode`. Never `eval()`.

**Tech Stack:** TypeScript (ESM), Bun as dev runtime + test runner (`bun test`), `decimal.js` for decimal arithmetic, `unified` + `remark-parse` + `remark-gfm` for Markdown parsing. Package ships with a `bin` so `npx visimark` works for consumers; `tsc --noEmit` for typecheck.

**Spec:** [`doc/2026-09-03-visimark-design.md`](../../../doc/2026-09-03-visimark-design.md). Worked examples [`doc/example-invoice.md`](../../../doc/example-invoice.md) (clean, normative) and [`doc/example-invoice-drift.md`](../../../doc/example-invoice-drift.md) (broken, its fenced `console` block is normative).

## Global Constraints

- **Renders unmodified.** The tool never changes anything except computed table cells and anchored values. `fmt --fix-dates` is the sole exception and writes only *decidable* non-ISO dates in input cells.
- **Writing splices the original source buffer by byte offset.** Never round-trip through `remark-stringify`. A one-cell change must touch one line.
- **Ambiguity is an error, never a guess.** `11/12/2026` is refused with no override. `15.10.2026` is refused but offered a fix.
- **Dates are ISO 8601 calendar dates only:** `YYYY-MM-DD`, exactly ten characters. Anything else is a `DATE` finding.
- **Arithmetic is decimal**, never binary float. No document may contain `0.30000000000000004`.
- **Rounding happens at every name binding (column cell or named scalar) and nowhere else.** Sub-expressions carry full precision. Rounding mode: half-up.
- **Write precision is inferred:** a computed column takes the decimal-place count of its existing cells; a scalar takes it from its anchor's current text; both fall back to the document-scope `precision` constant, default 2.
- **Functions, v1, exactly nine:** `SUM MIN MAX COUNT AVG ROUND ABS IF MOD`.
- **Operators:** `+ - * / ^`, comparison `== != < <= > >=`, logical `and or not`. `=` is binding only. `%` is postfix-only (`23%` ≡ `0.23`). No `|`. Use `MOD()` for modulo.
- **Exit codes:** `0` clean, `1` findings, `2` usage or parse failure.
- **Acceptance:** `check doc/example-invoice.md` → zero findings, exit 0. `fmt doc/example-invoice.md` → byte-for-byte identical. `check doc/example-invoice-drift.md` → output equals the fenced `console` block in that file (26 problems: 21 stale, 5 errors, plus one suppression NOTE), exit 1. `fmt` is idempotent.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `src/index.ts`, `bin/visimark.js`
- Create: `.git/` (via `git init`)

**Interfaces:**
- Produces: package name `visimark`, `"type": "module"`, `"bin": { "visimark": "bin/visimark.js" }`, scripts `test` (`bun test`), `typecheck` (`tsc --noEmit`). Dev deps: `typescript`, `@types/node`, `decimal.js`, `unified`, `remark-parse`, `remark-gfm`, `mdast-util-*` as pulled transitively.

- [ ] **Step 1:** `git init`; write `.gitignore` (`node_modules`, `dist`).
- [ ] **Step 2:** Write `package.json` with deps above; `bun install`.
- [ ] **Step 3:** Write `tsconfig.json` — `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `strict true`, `noEmit true` (dev), `types ["bun-types"]` optional, `lib ["ES2023"]`.
- [ ] **Step 4:** `bin/visimark.js` — `#!/usr/bin/env node` shim that imports `../src/cli/main.ts` via a built `dist/` for publish; in dev, a `bin/visimark` that runs `bun src/cli/main.ts`. Keep it a one-liner delegating to `runCli(process.argv.slice(2))`.
- [ ] **Step 5:** Smoke test `test/scaffold.test.ts`: `expect(1).toBe(1)`; run `bun test`; commit.

---

## Task 1: `lang/` — tokenizer

**Files:**
- Create: `src/lang/token.ts`, `src/lang/lexer.ts`
- Test: `test/lang/lexer.test.ts`

**Interfaces:**
- Produces:
  - `type TokenKind = "number" | "percent" | "date" | "string" | "bool" | "ident" | "op" | "lparen" | "rparen" | "comma" | "eof"`
  - `interface Token { kind: TokenKind; value: string; start: number; end: number }` — offsets relative to the expression string.
  - `function lex(src: string): Token[]` — throws `LangError { message, start, end }` on an unrecognised character or malformed literal.
  - Number literal: `/-?\d+(\.\d+)?/` — **no** thousands separators; a `,` inside a number region (e.g. `1,800`) is a `LangError` "thousands separators are not allowed".
  - `percent`: a number immediately followed by `%` → one token, `value` is the numeric part.
  - `date`: `/\d{4}-\d{2}-\d{2}/` when exactly that shape stands as a token — 10 chars. `2026-9-3` does not match the date rule and lexes as `number(2026) op(-) number(9) op(-) number(3)`; date *validity* (month ≤ 12 etc.) is checked in the parser/evaluator, not the lexer.
  - `string`: double-quoted, no escapes needed for v1 (`"net 30"`).
  - `bool`: `true` / `false` keywords (lex as `bool`, not `ident`).
  - `op`: longest-match from `** ^ * / + - == != <= >= < > = and or not`. (`and or not` are word operators — lexed from ident position.)
  - `#` starts a line comment — the lexer is called per-expression so comment stripping happens in the block splitter (Task 3); lexer treats `#` as a `LangError` if it reaches one.

- [ ] **Step 1:** Failing test: `lex("Price * Qty")` → `[ident Price, op *, ident Qty, eof]` with correct offsets.
- [ ] **Step 2:** Failing test: `lex("23%")` → `[percent "23", eof]`; `lex("2026-09-03")` → `[date "2026-09-03", eof]`; `lex("2026-9-3")` → number/op/number/op/number.
- [ ] **Step 3:** Failing test: `lex('"net 30"')` → `[string "net 30"]`; `lex("true")` → `[bool "true"]`.
- [ ] **Step 4:** Failing test: `lex("1,800")` throws `LangError` matching /thousands/.
- [ ] **Step 5:** Failing test: `lex("a and not b")` → `ident, op(and), op(not), ident`.
- [ ] **Step 6:** Implement `lexer.ts`. Run tests green. Commit.

---

## Task 2: `lang/` — Pratt parser + AST

**Files:**
- Create: `src/lang/ast.ts`, `src/lang/parser.ts`
- Test: `test/lang/parser.test.ts`

**Interfaces:**
- Produces:
  - AST nodes (discriminated union `Expr`): `NumberLit {value: string}`, `DateLit {value: string}`, `StrLit {value: string}`, `BoolLit {value: boolean}`, `Ref {name: string, qualifier?: string}` (from `sheet.name` or bare `name`), `Unary {op: "-" | "not", operand}`, `Binary {op, left, right}`, `Call {name: string, args: Expr[]}`. Every node carries `{start, end}`.
  - `function parseExpr(src: string): Expr` — throws `LangError` with offset on syntax error.
  - `function parseBinding(line: string): { name: string; expr: Expr; nameStart: number; nameEnd: number }` — splits on the first top-level `=` that is not `==`.
  - Precedence (low→high): `or`; `and`; `not` (prefix); comparison `== != < <= > >=` (non-associative — `a < b < c` is a `LangError`); `+ -`; `* /`; unary `-` (prefix); `^` (right-assoc); call / parens / atom. `.` binds tightest, only `ident.ident`.
  - `23%` parses to `NumberLit` with value `"0.23"` (percent folded at parse time — exact).

- [ ] **Step 1:** Failing test: `parseExpr("Price * Qty + 1")` → `Binary(+, Binary(*, Ref Price, Ref Qty), NumberLit 1)`.
- [ ] **Step 2:** Failing test: `parseExpr("2 ^ 3 ^ 2")` right-assoc; `parseExpr("-Net * 2")` → `Binary(*, Unary(-, Ref Net), 2)`.
- [ ] **Step 3:** Failing test: `parseExpr("SUM(schedule.Amount)")` → `Call("SUM", [Ref{qualifier:"schedule", name:"Amount"}])`.
- [ ] **Step 4:** Failing test: `parseExpr("lines.gross_total * (1 - early_pay_disc)")` shape.
- [ ] **Step 5:** Failing test: `parseExpr("23%")` → `NumberLit "0.23"`; `parseExpr("a == b")` → `Binary(==)`; `parseExpr("a = b")` throws.
- [ ] **Step 6:** Failing test: `parseBinding("early_pay_total = lines.gross_total * (1 - early_pay_disc)")` → name `early_pay_total`, expr Binary.
- [ ] **Step 7:** Failing test: `parseBinding("Days   = Due - issued")` → name `Days`.
- [ ] **Step 8:** Implement. Green. Commit.

---

## Task 3: `parse/` — Markdown location

**Files:**
- Create: `src/parse/document.ts`, `src/parse/blocks.ts`
- Test: `test/parse/document.test.ts`

**Interfaces:**
- Produces:
  - `interface RawBlock { sheetId: string | null; bindingsText: string; node position; bodyStart: number }` — one per ` ```vmark ` fenced code block. `sheetId` from `node.meta` (`#lines` → `"lines"`; empty/absent meta → `null`). `bindingsText` is the fence body verbatim.
  - `interface RawBinding { raw: string; name: string; exprText: string; lineStart: number; lineEnd: number }` — from splitting `bindingsText` on newlines, stripping `#` comments (a `#` outside a string starts a comment to end of line), dropping blank lines. Byte offsets are absolute into the source.
  - `interface RawTable { headers: {text: string; start: number; end: number}[]; rows: {cells: {text: string; start: number; end: number}[]}[]; node position }` — GFM table with per-cell byte offsets (trimmed inner text span, so the splicer can replace just the value).
  - `interface RawAnchor { target: {sheetId: string; name: string}; htmlNode position; precedingInline: {kind: "strong"|"emphasis"|"inlineCode"|"text"; valueStart: number; valueEnd: number} | null }` — from inline `html` nodes matching `/^<!--vmark=([a-z_]+)\.([a-z_]+)-->$/`. `precedingInline` locates the rewrite target span (for `text`, the trailing numeric token only); `null` → `ANCHOR` finding later.
  - `interface LocatedDoc { source: string; blocks: RawBlock[]; tables: RawTable[]; anchors: RawAnchor[]; tableBeforeBlock: Map<RawBlock, RawTable | null> }`
  - `function locate(source: string): LocatedDoc`
  - Table association: for each block, walk mdast siblings backwards skipping blank-line gaps; if the immediately preceding sibling node is a `table`, associate it. Uses mdast node order, not raw offsets.
  - `function positionToOffset` helper — remark positions give `offset` directly on `node.position.start/end`; assert they exist (remark-parse provides them).

- [ ] **Step 1:** Failing test: `locate` on a 1-table + 1-block fixture returns one `RawBlock` with `sheetId: "lines"`, one `RawTable` with 7 headers, `tableBeforeBlock` links them.
- [ ] **Step 2:** Failing test: id-less block → `sheetId: null`.
- [ ] **Step 3:** Failing test: block preceded by a paragraph (not a table) → `tableBeforeBlock.get(block) === null`.
- [ ] **Step 4:** Failing test: `# comment` lines and blank lines in the fence body are dropped; offsets of surviving bindings are correct (slice `source` by them and compare).
- [ ] **Step 5:** Failing test: anchor `**28659.00**<!--vmark=lines.gross_total-->` → target `{sheetId:"lines", name:"gross_total"}`, `precedingInline.kind === "strong"`, and `source.slice(valueStart, valueEnd) === "28659.00"`.
- [ ] **Step 6:** Failing test: bare-number text anchor `approximately 6719.58<!--vmark=terms.eur_total-->` → `precedingInline.kind === "text"`, value span is just `6719.58`.
- [ ] **Step 7:** Implement using `unified().use(remarkParse).use(remarkGfm)`. Green. Commit.

---

## Task 4: `model/` — sheets and scopes

**Files:**
- Create: `src/model/build.ts`, `src/model/types.ts`
- Test: `test/model/build.test.ts`

**Interfaces:**
- Consumes: `LocatedDoc`, `parseBinding`/`parseExpr` from `lang`.
- Produces:
  - `interface Binding { id: string /* "sheet.name" */; sheetId: string; name: string; expr: Expr; kind: "column" | "scalar"; raw: RawBinding; parseError?: LangError }`
  - `interface Sheet { id: string; table: RawTable | null; columns: Map<string, Binding>; scalars: Map<string, Binding>; inputColumns: Set<string> /* header names with no rule */ }`
  - `interface DocModel { sheets: Map<string, Sheet>; docScope: Map<string, Binding>; anchors: RawAnchor[]; findings: Finding[] /* structural: SHEET, and lang parse errors */; source: string; located: LocatedDoc }`
  - `function build(doc: LocatedDoc): DocModel`
  - A binding whose `name` equals (case-sensitive) a header of the associated table → `kind: "column"`. Else `kind: "scalar"`.
  - **`SHEET` finding** when a block has ≥1 binding whose name would be a column rule *but the block owns no table* — spec §3. (Detect: block has table `null` and ... we can't know it's "meant" to be a column; spec says "A block that declares column rules but owns no table is a `SHEET` error". Interpretation: any block with `sheetId != null`, no table, and a binding whose name is Capitalized/looks columnar is ambiguous — instead use the concrete rule: it's only knowable if a table exists. So `SHEET` fires when a table exists earlier in the doc but a paragraph was inserted between it and the block. Implement: if block has no associated table BUT the nearest preceding table (any distance, before the next block) exists and none of this block's names match doc/other scope as scalars... **Simplify to spec's literal case**: fire `SHEET` when block sheetId != null, tableBeforeBlock is null, and there is a `table` mdast node between the previous block and this block. Cover with the fixture from §3.)
  - Document scope: merge all `sheetId === null` blocks' bindings into `docScope`. Duplicate name across doc-scope blocks → last wins is wrong; spec says "merge" — treat duplicate as `UNDEF`-adjacent? No finding specified; make duplicate doc-scope name a `TYPE`-free hard error is overkill. **Decision:** duplicate doc-scope binding → keep first, emit no finding (not exercised by examples); revisit if needed.
  - `inputColumns` = table headers minus column-rule names.

- [ ] **Step 1:** Failing test: build on `example-invoice.md`'s `#lines` region → sheet `lines` has columns `{Net, VAT, Gross}`, scalars `{net_total, vat_total, gross_total}`, `inputColumns` ⊇ `{Item, Unit, Qty, Rate}`.
- [ ] **Step 2:** Failing test: id-less block → `docScope` has `vat` (=`0.23`), `early_pay_disc`, `fx_eur`.
- [ ] **Step 3:** Failing test: table-less `#terms` block → sheet with 0 columns, 3 scalars, `table === null`, no `SHEET` finding.
- [ ] **Step 4:** Failing test: fixture with `table`, then paragraph, then `\`\`\`vmark #x\n Y = Z\n\`\`\`` → one `SHEET` finding.
- [ ] **Step 5:** Failing test: a binding with a syntax error → `Binding.parseError` set, one lang finding in `findings`.
- [ ] **Step 6:** Implement. Green. Commit.

---

## Task 5: `eval/` — dependency graph + topological order

**Files:**
- Create: `src/eval/graph.ts`
- Test: `test/eval/graph.test.ts`

**Interfaces:**
- Consumes: `DocModel`.
- Produces:
  - `function resolve(model, fromSheetId, ref: {qualifier?, name}): { kind: "column"|"scalar"|"input-column"|"doc-scalar"|"unknown"; binding?: Binding; sheetId?: string; suggestion?: string }` — resolution order for a bare name: own columns → own scalars → doc scope. Qualified `sheet.name`: that sheet's columns then scalars. `input-column` = resolves to a table header with no rule. `unknown` carries `suggestion` (closest name by Levenshtein ≤ 2 across the candidate set).
  - `function dependencies(model, binding): { refs: ResolvedRef[]; vectorRefs: ResolvedRef[] }` — walks the `Expr`. A `Ref` with a `qualifier` naming another sheet's *column*, used **outside** an aggregate call, is a `vectorRef` (→ `VECTOR` finding). Inside `SUM/MIN/MAX/COUNT/AVG` it's a legal vector consumption.
  - `function topoOrder(model): { order: Binding[]; cycles: Binding[][] }` — Tarjan or Kahn; each non-trivial SCC (or self-loop) is one `cycles` entry with the node path. Column bindings depend on: their same-row input cells + any scalars/doc names they reference + (row-wise) other column rules of the same sheet. Scalars depend on the bindings they reference (a column ref inside an aggregate depends on *all* rows of that column).
  - `interface ResolvedRef { ref; resolution }`

- [ ] **Step 1:** Failing test: `resolve(model, "lines", {name:"vat"})` → `doc-scalar`. `resolve(model,"lines",{name:"Qty"})` → `input-column`. `resolve(model,"schedule",{qualifier:"lines",name:"gross_total"})` → `scalar`, sheetId `lines`.
- [ ] **Step 2:** Failing test: `resolve(model,"terms",{name:"fx_rate"})` → `unknown`, `suggestion: "fx_eur"`.
- [ ] **Step 3:** Failing test: `dependencies` for `recon.variance = lines.gross_total - schedule.Amount` → `vectorRefs` contains `schedule.Amount`.
- [ ] **Step 4:** Failing test: `dependencies` for `recon.scheduled = SUM(schedule.Amount)` → no vectorRefs; depends on all `schedule.Amount` rows.
- [ ] **Step 5:** Failing test: `topoOrder` on the `late_fees` cycle fixture → one `cycles` entry `[base, fee, total]` (rotate so path reads `base → fee → total → base`).
- [ ] **Step 6:** Failing test: `topoOrder` on `example-invoice.md` → `order` places `lines.*` before `schedule.*` before `terms.*` before `recon.*`; no cycles.
- [ ] **Step 7:** Implement. Green. Commit.

---

## Task 6: `eval/` — values, dates, decimal semantics

**Files:**
- Create: `src/eval/value.ts`, `src/eval/dates.ts`, `src/eval/evaluate.ts`
- Test: `test/eval/value.test.ts`, `test/eval/dates.test.ts`

**Interfaces:**
- Produces:
  - `type Value = { t: "num"; d: Decimal } | { t: "date"; iso: string } | { t: "str"; s: string } | { t: "bool"; b: boolean }`
  - `function parseIsoDate(text: string): { ok: true; iso: string } | { ok: false; decidable?: string; reason: string }` — `decidable` set when exactly one interpretation is possible (`15.10.2026` → `2026-10-15`; day/month/year separated by `.` or `-` with a component > 12 that can only be the day and a 4-digit year). `11/12/2026` and any `/`-separated form with both first components ≤ 12 → not decidable. Also rejects `1.800` style, thousands.
  - `function daysBetween(a iso, b iso): Decimal` (a − b, in days, proleptic Gregorian).
  - `function evalExpr(expr, env: (ref) => Value | VectorValue, ctx): Value` — decimal math at full precision; `^` via `Decimal.pow`; comparisons return `bool`; `and/or/not` boolean; date arithmetic per spec (`date - date → num days`; `date ± num → date`; else `TYPE`). Percent already folded. Aggregates receive a `VectorValue` (array of `Value`).
  - `function roundToPlaces(d: Decimal, places: number): Decimal` — `ROUND_HALF_UP`.
  - Functions: `SUM` (num sum, empty → 0), `MIN`/`MAX` (num or date), `COUNT` (non-empty count), `AVG` (SUM/COUNT, full precision), `ROUND(x, n)`, `ABS`, `IF(cond, a, b)`, `MOD(a, b)`.
  - `class EvalError extends Error { code: "TYPE" }`

- [ ] **Step 1:** Failing test: `parseIsoDate("2026-09-03")` ok. `parseIsoDate("15.10.2026")` → `{ok:false, decidable:"2026-10-15"}`. `parseIsoDate("11/12/2026")` → `{ok:false}` no `decidable`. `parseIsoDate("2026-13-01")` → not ok, not decidable (invalid month).
- [ ] **Step 2:** Failing test: `daysBetween("2026-09-10","2026-09-03")` → `7`. `daysBetween("2026-03-01","2026-02-01")` → `28`.
- [ ] **Step 3:** Failing test: `evalExpr` for `Qty * Rate` with env `{Qty:20, Rate:260}` → `num 5200`. Full-precision: `(1/3)*3` → exactly `1`.
- [ ] **Step 4:** Failing test: `roundToPlaces(30593.052, 2)` → `30593.05`; `roundToPlaces(2.5, 0)` → `3` (half-up); `roundToPlaces(6719.5779..., 2)` → `6719.58`.
- [ ] **Step 5:** Failing test: date `-` date via evalExpr → num; date `+` num → date; date `*` num → `EvalError TYPE`.
- [ ] **Step 6:** Failing test: `SUM([3600,14080,2500,5200])` → `25380`; `AVG` full precision.
- [ ] **Step 7:** Implement. Green. Commit.

---

## Task 7: `eval/` — the checker (findings)

**Files:**
- Create: `src/eval/check.ts`
- Test: `test/eval/check.test.ts`

**Interfaces:**
- Consumes: `DocModel`, `graph`, `value`.
- Produces:
  - `type FindingCode = "STALE" | "DATE" | "UNDEF" | "VECTOR" | "CYCLE" | "TYPE" | "SHEET" | "ANCHOR" | "WARN" | "NOTE"`
  - `interface Finding { code: FindingCode; sheetId?: string; name?: string; rowLabel?: string; stored?: string; computed?: string; formula?: string; message?: string; suggestion?: string; suppressedCount?: number; anchorGroup?: boolean; sourceOffset?: number }`
  - `interface CheckResult { findings: Finding[]; values: Map<string /* binding id */, Value>; rowValues: Map<string /* "sheet.Col" */, (Value|null)[]>; exitCode: 0 | 1 }`
  - `function check(model: DocModel): CheckResult`
  - Algorithm:
    1. Structural findings from `model` (SHEET, lang parse errors → `TYPE`/`UNDEF` as appropriate).
    2. `topoOrder`; every SCC → one `CYCLE` finding, path formatted `a → b → c → a`. Mark all cycle members *unevaluable* (suppressed).
    3. Evaluate bindings in `order`. For each:
       - Resolve refs. Unknown → `UNDEF` (with suggestion), mark unevaluable, suppress downstream.
       - `vectorRef` outside aggregate → `VECTOR`, mark unevaluable.
       - Input date cell that fails `parseIsoDate` → `DATE` finding (message includes decidable fix or the ambiguity spread in days). The dependent column value for that row is unevaluable.
       - `TYPE` from evalExpr → `TYPE` finding.
       - If evaluable and this is a **column rule**: compare each row's computed (rounded to the row cell's inferred precision) to the stored cell text (parsed as Decimal). Mismatch → `STALE` with `rowLabel` (first cell of the row), `stored`, `computed`, `formula` (the raw expr text).
       - If evaluable and a **scalar**: compare rounded computed to the value in its anchor(s); mismatch → `STALE` (scalar form, no rowLabel).
    4. **Suppression:** a binding whose inputs include an unevaluable binding does not itself emit `STALE`/`TYPE`; instead, if it's a column with N unevaluable rows, emit one `NOTE` `sheet.Col · N rows not verified (upstream <CODE> errors)`.
    5. **Anchor staleness collapse:** count anchors whose bound scalar is `STALE` (the scalar itself already emitted a `STALE`); emit a single synthetic `STALE` finding `anchorGroup: true` with `suppressedCount = <n>` rendered as `<n> prose anchors bound to the values above`. Anchors bound to a *suppressed* scalar (UNDEF/VECTOR) do not count.
    6. `ANCHOR` finding when `RawAnchor.precedingInline === null`.
    7. **`WARN`:** a scalar (not doc-scope constant that's obviously a config? — no: spec says any scalar) never referenced by any other binding *and* not bound to any anchor → `WARN` "defined and never read", with did-you-mean. Suppressed for any binding already carrying a finding (the three `#late_fees` scalars in the cycle are reported once as the cycle).
  - **Finding order** for rendering (Task 9 formats, this fn returns them already ordered):
    1. All `STALE` findings, clustered: within a sheet, column-cell staleness before scalar staleness; multiple stale cells of the same table row are grouped and anchored at the row's first detected finding; sheets in evaluation order (`lines`, `schedule`, `terms`, ...). Then the single collapsed anchor-group `STALE` line.
    2. Remaining findings in evaluation order, each `NOTE` immediately following the finding that caused it.
    3. `CYCLE` findings last.
  - `exitCode` = `findings.length ? 1 : 0` (NOTE and WARN count as findings for exit? spec: "exit 1 if any finding". `check` on the clean example yields zero of *everything*. Treat WARN and NOTE as findings → exit 1. The drift example exits 1 regardless.)

- [ ] **Step 1:** Failing test: `check(build(locate(read("doc/example-invoice.md"))))` → `findings` is empty, `exitCode` 0.
- [ ] **Step 2:** Failing test: on `example-invoice-drift.md` → exactly these STALE finding identities in this order: `lines.Net`/On-call, `lines.VAT`/On-call, `lines.Gross`/On-call, `lines.Gross`/Discovery workshop, `lines.net_total`, `lines.vat_total`, `lines.gross_total`, `schedule.Amount`/Signature, `schedule.Amount`/Delivery of backend, `schedule.Amount`/Acceptance, `schedule.covered`, `terms.early_pay_total`, `terms.early_pay_saved`, then anchorGroup with `suppressedCount === 8`.
- [ ] **Step 3:** Failing test: drift → two `DATE` findings (`15.10.2026` with `decidable`, `11/12/2026` with ambiguity `29` days), one `NOTE` for `schedule.Days` (`suppressedCount === 2`) positioned right after the DATE findings.
- [ ] **Step 4:** Failing test: drift → one `UNDEF` (`fx_rate` → suggest `fx_eur`), one `VECTOR` (`recon.variance`), one `CYCLE` (`late_fees.base → late_fees.fee → late_fees.total → late_fees.base`), and CYCLE is last.
- [ ] **Step 5:** Failing test: drift → total findings count reconciles to "26 problems (21 stale, 5 errors)": 13 individual STALE + 1 anchorGroup(8) = 21 stale; DATE×2 + UNDEF + VECTOR + CYCLE = 5 errors; NOTE not counted in the 26.
- [ ] **Step 6:** Failing test: no double-report — `late_fees` scalars produce only the CYCLE, no WARN, no STALE.
- [ ] **Step 7:** Implement. Iterate against the two examples until identities/counts match. Commit.

---

## Task 8: `write/` — offset splicer

**Files:**
- Create: `src/write/splice.ts`, `src/write/precision.ts`, `src/write/fmt.ts`
- Test: `test/write/splice.test.ts`, `test/write/fmt.test.ts`

**Interfaces:**
- Consumes: `CheckResult`, `LocatedDoc`, `DocModel`.
- Produces:
  - `function inferColumnPrecision(table: RawTable, colIndex: number, fallback: number): number` — max decimal places among existing non-empty cells of that column; `7` → 0 places, `5200.00` → 2. Empty column → `fallback`.
  - `function inferScalarPrecision(anchor: RawAnchor, fallback: number): number` — decimal places in the anchor's current text.
  - `function formatDecimal(d: Decimal, places: number): string` — fixed notation, exactly `places` digits after `.` (or none if 0). No thousands separators. No sign for `-0`.
  - `interface Edit { start: number; end: number; text: string }`
  - `function planFmt(model, check, opts: { fixDates: boolean }): Edit[]` — one edit per stale computed cell (replace the trimmed inner-text span), one per stale anchor value, and — only if `fixDates` — one per *decidable* `DATE` input cell. Edits are non-overlapping; sorted descending by `start` for application.
  - `function applyEdits(source: string, edits: Edit[]): string` — splice by offset, right-to-left. Never touches anything else.
  - `function fmt(source, opts): { output: string; changed: boolean; unfixable: Finding[] }`
  - Column-cell replacement preserves the cell's existing leading/trailing padding: replace only the non-space run, let the table stay visually aligned only if the new string is the same width — spec/examples: the clean example round-trips byte-identical, and stale replacements in drift are not width-checked by tests. **Replace the trimmed value run only; do not re-pad.** (If a value grows, the pipe table becomes slightly misaligned — acceptable per §9 "Writing must not reformat the document".)

- [ ] **Step 1:** Failing test: `applyEdits("abcdef", [{start:2,end:4,text:"XY"}])` → `"abXYef"`; two edits applied right-to-left don't shift each other.
- [ ] **Step 2:** Failing test: `inferColumnPrecision` on the drift `Days` column (`7`, blank, blank) → `0`; on `Net` column → `2`.
- [ ] **Step 3:** Failing test: `formatDecimal(new Decimal("7"), 0)` → `"7"`; `formatDecimal(new Decimal("5200"), 2)` → `"5200.00"`.
- [ ] **Step 4:** Failing test (**acceptance**): `fmt(read("doc/example-invoice.md"), {})` → `output === input`, `changed === false`.
- [ ] **Step 5:** Failing test: `fmt` on drift → `check(fmt output)` has zero `STALE` findings; the two `DATE`, `UNDEF`, `VECTOR`, `CYCLE` remain; `unfixable` lists them.
- [ ] **Step 6:** Failing test: `fmt(drift, {fixDates:true})` rewrites `15.10.2026` → `2026-10-15`, leaves `11/12/2026` untouched.
- [ ] **Step 7:** Failing test (**property**): `fmt(fmt(x)) === fmt(x)` for both examples and a handful of fixtures (idempotence).
- [ ] **Step 8:** Failing test (**golden / minimal diff**): take the clean example, corrupt one cell, `fmt`, diff → exactly one changed line.
- [ ] **Step 9:** Implement. Green. Commit.

---

## Task 9: `report/` — formatting

**Files:**
- Create: `src/report/format.ts`, `src/report/levenshtein.ts`
- Test: `test/report/format.test.ts`

**Interfaces:**
- Consumes: `Finding[]`, file path.
- Produces:
  - `function levenshtein(a, b): number` (already used in Task 5 — put it here, import from Task 5; move if ordering is awkward).
  - `function formatCheck(path: string, findings: Finding[]): string` — reproduces the drift example's `console` block body exactly:
    - Header line: the file path, then a blank line.
    - Each finding indented two spaces, code left-padded to a fixed column (`STALE  `, `DATE   `, `NOTE   `, `UNDEF  `, `VECTOR `, `CYCLE  ` — 6-char code field + space).
    - `STALE` row form: `STALE   <sheet>.<name><pad> · <rowLabel><pad> <stored> ≠ <computed><pad> <formula>`. Column widths chosen to match the example (align `·`, align `≠`, align the formula column). Scalar form omits ` · <rowLabel>`.
    - Collapsed anchors line: `STALE   <n> prose anchors bound to the values above`.
    - Blank line between category groups.
    - `DATE` multi-line: line 1 `DATE    <sheet>.<col>    · <rowLabel><pad> "<raw>"`; then indented continuation lines: `Dates must be ISO 8601 calendar dates: YYYY-MM-DD.` and either `Unambiguous — \`visimark fmt --fix-dates\` rewrites it to <iso>.` or `Ambiguous: <isoA> or <isoB>, <n> days apart. Fix by hand.`
    - `NOTE` form: `NOTE    <sheet>.<name>   · <n> rows not verified (upstream DATE errors)`.
    - `UNDEF` form: line 1 `UNDEF   <sheet>.<name>   unknown name \`<bad>\``; line 2 indented `did you mean \`<suggestion>\`?`
    - `VECTOR` form: line 1 `VECTOR  <sheet>.<name>    \`<ref>\` is a column, not a value.`; line 2 indented `Wrap it in an aggregate: SUM(<ref>)`
    - `CYCLE` form: `CYCLE   <a> → <b> → <c> → <a>`
    - Footer: blank line, then `  <N> problems (<S> stale, <E> errors)` where `N = S + E`, `S` = individual stale + collapsed-anchor count, `E` = DATE+UNDEF+VECTOR+CYCLE+TYPE+SHEET+ANCHOR count. `NOTE`/`WARN` excluded from the tally line but still printed.
  - `function formatExplain(...)`, `function formatEval(...)` — simpler, defined in Task 10.

- [ ] **Step 1:** Failing test: `levenshtein("fx_rate","fx_eur")` ≤ 2.
- [ ] **Step 2:** Failing test (**acceptance**): `formatCheck("doc/example-invoice-drift.md", check(...).findings)` equals the text inside the fenced ` ```console ` block of `example-invoice-drift.md` (extract lines 102–137, i.e. everything after the `$ visimark check ...` line up to and including the `26 problems` line). Store the expected string as a fixture read from the doc itself so the doc stays the source of truth.
- [ ] **Step 3:** Implement, tuning column widths until byte-equal. Commit.

---

## Task 10: `cli/` — command surface

**Files:**
- Create: `src/cli/main.ts`, `src/cli/commands.ts`
- Test: `test/cli/cli.test.ts`

**Interfaces:**
- Consumes: everything.
- Produces:
  - `function runCli(argv: string[]): Promise<number>` — returns exit code; `main.ts` calls `process.exit(await runCli(...))`.
  - `visimark check FILE...` — locate+build+check each file; print `formatCheck` per file; exit `1` if any file has findings, `2` on read/parse failure, else `0`.
  - `visimark fmt FILE... [--fix-dates]` — `fmt` each file in place (write back only if `changed`); print a one-line summary per file (`<path>: <n> cells, <m> anchors updated` or `<path>: unchanged`); print remaining `unfixable` findings via `formatCheck`; exit `1` if unfixable findings remain, `2` on failure, else `0`.
  - `visimark eval FILE [--get NAME] [--json]` — evaluate; with `--get sheet.name` print that one value; `--json` prints `{ "<id>": <value>, ... }` (numbers as strings to preserve precision, dates as ISO strings); no `--get` prints a table of every binding id and value. Exit `2` on parse failure, else `0` (eval reports values, not findings).
  - `visimark explain FILE [#sheet]` — print, per sheet (or just the named one): the sheet id, its table's input columns, its column rules (`name = expr`), its scalars, and the topological evaluation order of its bindings (`formatExplain`). Cross-sheet dependencies noted inline. Exit `0`, `2` on parse failure.
  - Arg parsing: hand-rolled, no dep. Unknown command or missing FILE → usage to stderr, exit `2`.

- [ ] **Step 1:** Failing test: `runCli(["check","doc/example-invoice.md"])` → resolves `0`, stdout contains the path and no `problems` line (or `0 problems`? — clean file: print just the path or nothing; match nothing extra). Decide: clean check prints `<path>\n\n  no findings` — **no**, keep it silent-ish: print `<path>` then `  clean`. Not spec-constrained; keep minimal: print nothing on a clean file, exit 0. Revisit.
- [ ] **Step 2:** Failing test: `runCli(["check","doc/example-invoice-drift.md"])` → resolves `1`, stdout equals `formatCheck` output.
- [ ] **Step 3:** Failing test: `runCli(["eval","doc/example-invoice.md","--get","lines.gross_total"])` → `0`, stdout `28659.00` (scalar precision from anchor) or `28659` (raw) — **decide: raw decimal string, `28659`**. `--json` wraps.
- [ ] **Step 4:** Failing test: `runCli(["fmt","<tmp copy of drift>"])` mutates the file; a second run reports `unchanged` for the cells.
- [ ] **Step 5:** Failing test: `runCli(["explain","doc/example-invoice.md","#schedule"])` → `0`, output names `Amount = Share * lines.gross_total`, `covered = SUM(Amount)`, lists `lines.gross_total` as external, shows order `Amount` before `covered`.
- [ ] **Step 6:** Failing test: `runCli([])` → `2`, usage on stderr.
- [ ] **Step 7:** Implement. Green. Commit.

---

## Task 11: acceptance + packaging

**Files:**
- Create: `test/acceptance.test.ts`, `README` badge/usage tweak (only if inaccurate), `dist` build script
- Modify: `package.json` (add `build` = `bun build src/cli/main.ts --target node --outdir dist`, `prepublishOnly`)

- [ ] **Step 1:** `test/acceptance.test.ts` consolidating the four normative checks (clean → 0 findings + byte-identical fmt; drift → exact transcript + 26/21/5 tally; fmt idempotent on both).
- [ ] **Step 2:** `bun run typecheck` clean; fix any `strict` errors.
- [ ] **Step 3:** `bun build` produces a runnable `dist/main.js`; `node dist/main.js check doc/example-invoice.md` exits 0.
- [ ] **Step 4:** Update `README.md` "Status" section from "nothing implemented" to reflect the CLI shipping, only the one paragraph.
- [ ] **Step 5:** Full `bun test` green. Commit. `superpowers:finishing-a-development-branch`.

---

## Self-Review notes

- **Spec §3 SHEET rule** is under-specified for the "no table anywhere" case; the plan pins it to the concrete "paragraph inserted between table and block" scenario the spec describes, which is the only one exercised. Flag for the author if a broader rule is wanted.
- **Finding order** in Task 7 is reverse-engineered from the drift transcript (cluster stale-by-row, anchor at first detection; NOTE trails its cause; CYCLE last). If a future example contradicts it, revisit.
- **`eval` output precision** (`--get`): plan chooses raw decimal string. If the author wants anchor-formatted output, that's a one-line change in Task 10.
- **markdown-it `html:false`** cosmetic anchor failure (spec §16) is out of scope — no code needed.
- Deferred per spec §14: month type, joins, per-column precision syntax, incremental reparse, VS Code extension — no tasks.
