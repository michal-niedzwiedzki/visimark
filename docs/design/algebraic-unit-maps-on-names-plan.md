# Algebraic unit maps on names — implementation plan

**Goal:** Implement [#317](https://github.com/michal-niedzwiedzki/visimark/issues/317)
as specified: every value carries a static unit map, declared in a bracket
after a name, checked by a static pass before evaluation, and reported by
every command.

**Architecture:** A pure unit-expression module in `lang/` (grammar, map
algebra, expansion, normalised print) underpins everything. The lexer gains a
raw `unit` token; the parser attaches units to binding heads, `param` heads and
number literals, and parses document-scope definitions. The model layer splits
a header's source text into a name and a unit (`model/header-name.ts`) and keys
columns by name. A new static pass, `eval/dimensions.ts`, runs inside `check()`
before the binding loop, records a unit map per binding on `CheckResult`, and
marks failing bindings unevaluable so the existing suppression turns their
dependents into `NOTE`. Reports, `infer`, `fmt --fix-units` and the LSP read
the pass's result; none recomputes units.

**Tech Stack:** TypeScript, Bun (`bun test`, `bun run typecheck`,
`bun run build`), decimal.js. No new dependency.

**Spec:** [`algebraic-unit-maps-on-names-spec.md`](algebraic-unit-maps-on-names-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer that
  [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md)
  names for the session doing the work. Git author stays the maintainer.
- All work lands on `issue/317-algebraic-unit-maps-on-names-impl`, PR #322,
  which stays a **draft** until the plan is complete and CI is green. One
  commit per task.
- Test first: each task's first step adds failing tests; the task ends with
  `bun test`, `bun run typecheck` and `bun run build` green from the repo root.
  No `.skip`, no `.only`, no loosened assertion.
- Use the development CLI, `bun run packages/visimark/src/cli/main.ts`, never
  `bunx visimark` (that runs the published build).
- Every message string in spec §4 is reproduced **verbatim**; tests assert the
  exact text.
- The existing decoration module `eval/units.ts` keeps its name and meaning
  (inert cell decorations). New unit-map state is named `unitMaps` /
  `dimensions`, never `columnUnits` or `scalarUnits`, which already mean
  decorations.
- Every document under `docs/` that passes `check` on `master` keeps passing
  after every task (Task 15 makes this a test).
- Tests follow the repo's style: inline documents run through `runCli` or the
  module API, as `test/cli/dup-units.test.ts` does. The §4 acceptance is one
  table-driven file, `test/cli/units.test.ts`.

---

## Task 1 — Unit expressions and map algebra

- [ ] **Files:** create `packages/visimark/src/lang/unit-expr.ts`; create
  `packages/visimark/test/lang/unit-expr.test.ts`.
- **Interfaces:**

  ```ts
  /** atom → non-zero integer exponent; never holds a 0 */
  export type UnitMap = ReadonlyMap<string, number>;
  export const DIMENSIONLESS: UnitMap;

  export type UnitParse =
    | { ok: true; map: UnitMap }
    | { ok: false; message: string }; // spec §4 grammar messages, verbatim

  export function parseUnit(text: string): UnitParse;   // bracket content, no brackets
  export function mulUnits(a: UnitMap, b: UnitMap): UnitMap;
  export function divUnits(a: UnitMap, b: UnitMap): UnitMap;
  export function powUnit(a: UnitMap, n: number): UnitMap;
  export function halveUnit(a: UnitMap): UnitMap | null;  // null if any exponent is odd
  export function isDimensionless(a: UnitMap): boolean;
  export function expandUnit(a: UnitMap, defs: UnitDefs): UnitMap;
  export function sameUnit(a: UnitMap, b: UnitMap, defs: UnitDefs): boolean; // after expansion
  export function formatUnit(a: UnitMap): string;        // normalised print, spec §3
  export function unitJson(a: UnitMap): Record<string, number>; // code-point-sorted keys
  export type UnitDefs = ReadonlyMap<string, UnitMap>;   // atom → definition
  ```
- **Steps:**
  1. Write tests for the grammar (spec §2.1): atoms of Unicode letters;
     `°` prefix; `degC`/`°C`/`℃` → `℃` and `degF`/`°F`/`℉` → `℉`; `^n` and
     superscripts; `a/b/c` chains; `1/s`; spaces around `mul` and `/`. Write
     tests for each refusal and its exact message: `[]`, `[1]`, `[node/node]`
     (`declares no unit`), `[100km]`, `[N m]`, `[a/b⋅c]`, `[%]`, `^0`.
     `parseUnit` returns the message without the `[…]` wrapper's context;
     callers prefix the bracketed text exactly as spec §4 shows.
  2. Write tests for the algebra (`m*m = m²`, `USD/node/month * node =
     USD/month`, `PLN / (PLN/EUR) = EUR`, cancellation removes atoms),
     `halveUnit` (even and odd), expansion through chained definitions, and
     `formatUnit` (code-point order, chained divisors, `1/s`, superscripts):
     `kg⋅m²/s²`, `USD/month/node`, `N⋅m`, `1/s`, `EUR`, `PLN²/EUR`.
  3. Implement. Keep the module pure: no imports from `eval/`, `model/` or `report/`.
  4. Run the checks; commit `feat(units): unit expressions and map algebra (#317)`.

## Task 2 — Unit signatures on every builtin, and `ref`

- [ ] **Files:** modify `packages/visimark/src/lang/reference.ts`,
  `packages/visimark/src/cli/commands.ts` (the `ref` printer),
  `packages/visimark/src/report/json.ts` (the `ref --json` body),
  `scripts/gen-function-reference.ts` and `scripts/gen-docs.ts` if they render
  `FnDoc` fields; create `packages/visimark/test/lang/unit-signatures.test.ts`;
  extend `packages/visimark/test/lang/reference.test.ts`.
- **Interfaces:**

  ```ts
  export type UnitSig =
    | { kind: "dimensionless" }                    // printed `1`
    | { kind: "any" }
    | { kind: "type"; type: "bool" | "date" | "string" }
    | { kind: "var"; name: "U" | "V"; pow?: number }; // `U`, `U²`
  export interface FnUnits { params: Readonly<Record<string, UnitSig>>; returns: UnitSig }
  // FnDoc gains:  units: FnUnits;   (required — every builtin states it)
  export function unitSigText(fn: string, d: FnDoc): string; // `SUM(col: U) → U`
  ```
- **Steps:**
  1. Test that every `FnDoc` has `units`, that each param name in `units.params`
     matches `params`, and that `unitSigText` produces the sixteen signatures
     in spec §3 verbatim.
  2. Add the field and the sixteen entries. `ABS`, `SQRT`, `FLOOR` and `CEILING`
     aliases need nothing; they share their function's entry.
  3. `ref NAME` prints a `units` line after the precision line; `ref --json`
     gains `"units": { "params": {…}, "returns": "…" }` (the printed `unitSigText`
     pieces as strings). Test both with `runCli`.
  4. Run `bun run gen:docs` so `docs/function-reference.md` and the generated
     §4 table carry the signature; the `generated-docs` CI job checks this.
  5. Run the checks; commit `feat(units): unit signatures on builtins and ref (#317)`.

## Task 3 — Lexer, parser and AST

- [ ] **Files:** modify `packages/visimark/src/lang/lexer.ts`,
  `packages/visimark/src/lang/token.ts`, `packages/visimark/src/lang/ast.ts`,
  `packages/visimark/src/lang/parser.ts`; create
  `packages/visimark/test/lang/unit-syntax.test.ts`.
- **Interfaces:**

  ```ts
  // token.ts
  type TokenKind = … | "unit";      // value = raw text between [ and ], start/end span the brackets
  class LangError { code?: "TYPE" | "UNIT"; … }  // absent means TYPE, as today
  // ast.ts
  interface UnitText { text: string; start: number; end: number }
  interface NumberLit { …; unit?: UnitText; percent?: boolean }   // percent: written with `%`
  interface UnitDef extends Pos { type: "unitdef"; atom: UnitText; unit: UnitText }
  // parser.ts
  interface Binding { …; unit?: UnitText }
  parseStatement(line): Binding | Assertion | ChartDecl | AliasDecl | UnitDef
  ```
- **Lexing rule.** A `[` begins a raw `unit` token running to the next `]`,
  unless the previous significant token is the contextual word `in`, where the
  existing `lbracket` domain lexing is kept. `⋅` (U+22C5) lexes as the `*`
  operator. `×` and `·` outside a unit token stay lexer errors, as today.
- **Steps:**
  1. Tests: `x [m/s] precision 2 = a / b` (unit then precision);
     `x precision 2 [m] = 1` → `TYPE` `the unit comes before precision: name
     [unit] precision N`; `param rate [PLN/EUR] precision 4 in [4.0, 4.5] =
     default 4.2650` (unit and domain both parsed); `10 [PLN]`; `-10 [PLN]` is
     unary minus over the literal; `2 * 10 [PLN]`; `width ⋅ height` is a `*`
     binary; `[J] = [N⋅m]` is a `UnitDef`. These raise `LangError` with
     `code: "UNIT"`: a unit on a ref operand (`x [PLN]`), on a string or date
     literal, on a `%` literal (`23% [PLN]`), on a `param` default or domain
     bound, and a `UnitDef` whose left side is not one atom. Messages follow
     spec §4 verbatim.
  2. Implement. The unit text is **not** parsed here; Task 5 and Task 7 call
     `parseUnit` so that a grammar failure is a `UNIT` finding with a span,
     not a parse failure of the whole line.
  3. Extend `test/lang/roundtrip.test.ts` if it round-trips source spans, so
     the new spans are covered.
  4. Run the checks; commit `feat(units): unit brackets in the lexer and parser (#317)`.

## Task 4 — `LangError.code` reaches the finding

- [ ] **Files:** modify `packages/visimark/src/model/build.ts` (where a
  `LangError` becomes a finding); extend `packages/visimark/test/model/build.test.ts`.
- **Steps:**
  1. Test: a line failing with `code: "UNIT"` produces a `UNIT` finding, not
     `TYPE`; every existing parse failure still produces `TYPE`.
  2. Implement: `code: e.code ?? "TYPE"`.
  3. Run the checks; commit `feat(units): carry a parse error's finding code (#317)`.

## Task 5 — Header names, definitions and the model

- [ ] **Files:** create `packages/visimark/src/model/header-name.ts` and
  `packages/visimark/test/model/header-name.test.ts`; modify
  `packages/visimark/src/model/types.ts`, `packages/visimark/src/model/build.ts`,
  `packages/visimark/src/eval/graph.ts` (the `UNDEF` hint); create
  `packages/visimark/test/model/units-build.test.ts`.
- **Interfaces:**

  ```ts
  // header-name.ts — spec §2.3 steps 1–4
  export type HeaderName =
    | { name: string; unit: null }
    | { name: string; unit: UnitText }                // unit text not yet parsed
    | { error: string; span: Span };                  // empty stem / two clauses
  export function splitHeader(source: string, plainText: string, offset: number): HeaderName;
  // types.ts
  interface Sheet { …; headerUnits: Map<string, { unit: UnitMap; text: UnitText }> } // by column name
  interface DocModel { …; unitDefs: UnitDefs; unitDefSpans: Map<string, Span> }
  interface Binding { …; unit?: { map: UnitMap; text: UnitText } }    // parsed declaration
  ```
- **Steps:**
  1. `splitHeader` tests, one per spec §2.3 case: trailing bracket; whitespace
     before the bracket optional; escaped `\[1\]` keeps `Revenue [1]` as the
     name; `[^1]`; `[text][ref]`; `[x](url)`; parentheses; `**Weight** [kg]` →
     name `Weight`; empty stem; `Speed [m] [s]`. The name comes from the plain
     text with the trailing clause removed; detection reads the source text.
  2. Build tests:
     - `columnIndex`, `inputColumns` and `columns` are keyed by name.
     - A quoted head and an `is` alias match a header's name. `"Weight [kg]"`
       is `UNDEF` with the suggestion replaced by the hint
       `the header's name is Weight; [kg] is its unit`.
     - `Weight` beside `Weight [kg]`, and `[kg]` beside `[lb]`, is `DUP` on
       the existing duplicate-header path.
     - A header bracket failing `parseUnit` is `UNIT` with the §4 message,
       spanning the bracket.
     - A unit on a column rule's head is `UNIT`
       `Net's unit is declared on its header, not on its rule`.
     - A binding's unit is parsed into `Binding.unit`. An empty map is
       `UNIT … declares no unit`.
  3. Definition tests:
     - A `UnitDef` in a document-scope block is collected into `unitDefs`.
     - In a `#id` block it is `SHEET`
       `a unit definition belongs in a document-scope block`.
     - A redefinition is `DUP` `[J] is already defined at line N`.
     - `[x] = [1]` is `UNIT` `a unit cannot be defined as dimensionless`.
     - A cycle or self-reference is `CYCLE` with the path `[a] → [b] → [a]`.
       It is reported once, and the atoms on it are dropped from `unitDefs`,
       so anything expanding through them is suppressed in Task 7.
     - An unused definition is `WARN` `[J] is defined and never used`. This
       one is emitted by Task 7, which knows what was used; here, only
       record the spans.
  4. Implement; keep `parse/document.ts` unit-agnostic.
  5. Run the checks; commit `feat(units): header names, declarations and definitions in the model (#317)`.

## Task 6 — Units in import declarations

- [ ] **Files:** modify `packages/visimark/src/parse/fence-info.ts`,
  `packages/visimark/src/import/resolve.ts` (or wherever an imported sheet's
  headers become columns); extend `packages/visimark/test/parse/fence-info.test.ts`
  and `packages/visimark/test/import-acceptance.test.ts`.
- **Steps:**
  1. Tests:
     - `labelled Item, Qty, Price [USD]` asserts the names `Item, Qty, Price`
       and declares `Price` as `USD`. `unlabelled` works the same way.
     - A CSV header `Price [USD]` is split by `splitHeader`.
     - Different units from `labelled` and the CSV header are `UNIT`
       `Price is declared USD in labelled but EUR in the CSV header`. Either
       one alone applies.
     - A malformed bracket in the list is `UNIT` with the §4 grammar message.
     - The import stamp is unaffected, since it covers the file and not the
       declaration.
  2. Implement by reusing `splitHeader` and `parseUnit`; the `labelled` list
     splitter must not split inside a bracket.
  3. Run the checks; commit `feat(units): units in import declarations (#317)`.

## Task 7 — The static unit pass

- [ ] **Files:** create `packages/visimark/src/eval/dimensions.ts` and
  `packages/visimark/test/eval/dimensions.test.ts`.
- **Interfaces:**

  ```ts
  export type Dim =
    | { kind: "num"; map: UnitMap; unitFree: boolean; zeroLiteral: boolean }
    | { kind: "date" } | { kind: "string" } | { kind: "bool" };
  export interface UnitInfo { map: UnitMap; source: "declared" | "derived" }
  export interface DimensionResult {
    unitMaps: Map<string, UnitInfo>;     // binding id or `sheet.Column` → non-empty map only
    failed: Set<string>;                 // ids whose unit check failed
    usedDefs: Set<string>;
  }
  export function checkDimensions(
    model: DocModel,
    order: readonly string[],            // topo order from graph.ts
    columnKind: (sheetId: string, name: string) => "num" | "date" | "string",
    emit: (f: Finding) => void,
  ): DimensionResult;
  ```
- **Rules implemented** (spec §3, all static, no value read):
  - **Leaves.** Literals, literal-only scalars and params are dimensionless
    (`unitFree`). An input column is its header unit, or dimensionless. A
    bracketed literal is its unit (not `unitFree`). `zeroLiteral` marks a
    literal `0` in any spelling.
  - **Operators.**
    - `+`, `-`, comparisons and `IF` branches need equal maps after expansion;
      a `zeroLiteral` side matches anything.
    - `*` multiplies maps, `/` divides them; `⋅` is the same as `*`.
    - `^`: a unit-bearing base needs a literal non-negative integer exponent
      (`^ needs a literal exponent when its base has a unit (m)`), and the map
      is raised to it. A dimensionless base takes any exponent.
    - `-x` keeps the map; `%` literals are dimensionless; `and`/`or`/`not` are
      `bool`.
  - **Builtins.**
    - Each call is checked against its `FnDoc.units`. `U`/`V` unify across
      arguments; `1` requires a dimensionless argument; `any` drops its unit.
    - `SQRT` uses `halveUnit`.
    - `⌊x⌋`/`⌈x⌉`: the parser lowers them to `FLOOR(x, 1)`/`CEILING(x, 1)`.
      Mark that synthetic step (by its span, or a flag added in Task 3) so it
      takes `x`'s unit. An explicit `1` does not.
    - The messages are the §4 rows for tied arguments, `1` arguments, `IF`
      branches and `SQRT`.
  - **Dates and strings.** `date - date` is dimensionless; `date ± n` drops
    `n`'s unit. A declared unit on a date or string binding or column is
    `UNIT` `a date cannot carry a unit` / `a string cannot carry a unit`.
  - **Ascription.**
    - A declared binding whose right side is `unitFree` takes the declared map.
    - Otherwise it must `sameUnit`, failing with
      `<name> declares <D> but its formula derives <M>`, where `<M>` is
      `formatUnit(M)` or `dimensionless`.
    - A right side that is exactly a `%` literal under a declared head is
      `UNIT` `23% is a ratio and cannot carry a unit` (the literal as written).
  - **Undeclared computed bindings.** They carry their derived map as
    `source: "derived"`.
  - **Messages.** `dimensionless` is the printed name of the empty map in
    every message.
  - **Failures.** A failed binding goes into `failed`, and every binding that
    reads it is skipped silently; its suppression is Task 8's job. Unused
    definitions emit `WARN` here.
- **Steps:**
  1. Write `dimensions.test.ts` against built models: each rule above, the
     cancellation case (`share [PLN] = part / total` is a mismatch), the
     literal-`0` exemption and its limit (`a - a` gets no exemption), `⌊Weight⌋`
     → `kg`, `FLOOR(Weight, 1)` is a mismatch, `Days [day]` added to a date
     passes, and definition expansion (`work [J] = force ⋅ distance`).
  2. Implement, walking `order` so that every operand's unit is known before
     its reader's.
  3. Run the checks; commit `feat(units): static unit pass (#317)`.

## Task 8 — Wire the pass into `check()`: suppression, charts, display rules

- [ ] **Files:** modify `packages/visimark/src/eval/check.ts`,
  `packages/visimark/src/eval/check-state.ts`,
  `packages/visimark/src/eval/check-charts.ts`,
  `packages/visimark/src/eval/display-rules.ts`; extend
  `packages/visimark/test/eval/check.test.ts`, `check-charts.test.ts`,
  `display-rules.test.ts`.
- **Interfaces:** `CheckResult` gains `unitMaps: Map<string, UnitInfo>`.
- **Steps:**
  1. Tests:
     - A mismatched binding has no value, and its anchors are not rewritten.
     - Its dependents, asserts and charts fold into the existing `NOTE`
       suppression, so one root cause gives one finding.
     - Chart value columns with different maps are `UNIT`
       `chart cost needs one unit across its columns: Net is PLN, Hours is h`
       on the chart statement, and the `labelled` column is ignored.
     - `|percent` (and `|nbsp`) on a unit-bearing value is `TYPE`
       `|percent cannot render a value with a unit (PLN)`.
     - `--scenario` values are ascribed the param's unit and change no map.
  2. Call `checkDimensions` after `topoOrder` and before the binding loop. Add
     `failed` to `CheckState.unevaluable`, which is the existing mechanism
     that makes readers emit `NOTE`. Store `unitMaps` on the result.
  3. Run the checks; commit `feat(units): run the unit pass in check (#317)`.

## Task 9 — Cell decorations under a header unit

- [ ] **Files:** modify `packages/visimark/src/eval/check-decoration.ts` and
  `packages/visimark/src/eval/units.ts`; extend
  `packages/visimark/test/eval/unit-check.test.ts` and
  `packages/visimark/test/cli/dup-units.test.ts`.
- **Steps:**
  1. Tests, one per row of the spec §3 decoration table:
     - A bare cell passes.
     - A matching suffix passes, with or without a space.
     - `5 m²` under `[m^2]` passes.
     - These are `UNIT` with the §4 messages: `40 lbs` under `[kg]`,
       `5 kilogram`, `5 pcs.`, any prefix (`$40.00`), and `5%` (as a ratio cell).
     - Mixed and two-sided cells stay `UNIT`, as today.
     - A column with no header unit is unchanged; the existing tests must pass
       untouched.
     - The same rules apply to an anchored span of a scalar with a declared
       unit.
  2. Implement in the decoration pass. It needs the header units and
     definitions from the model; it does not need Task 7's result. Write-back
     still re-applies a uniform decoration.
  3. Run the checks; commit `feat(units): cell decorations under a header unit (#317)`.

## Task 10 — `eval` text and `eval --json`

- [ ] **Files:** modify `packages/visimark/src/cli/commands.ts` (eval text, around the
  `padEnd(width)` value printer) and `packages/visimark/src/report/json.ts`
  (`evalValues` and the eval body); extend `packages/visimark/test/cli/json.test.ts`
  and add eval cases to `packages/visimark/test/cli/units.test.ts`.
- **Steps:**
  1. Tests:
     - Text output prints `name [unit]` in the label column, with the width
       computed over the bracketed labels. Dimensionless names print as today.
     - `--get` prints the bare value.
     - JSON has `units` always present (`{}` when empty), with one entry per
       non-empty `unitMaps` key, including declared input columns.
     - Keys follow `values` order, then input columns in sheet order. Values
       come from `unitJson`.
     - Bracketed columns are keyed by name (`s.Weight`). Aliases are absent.
  2. Implement.
  3. Run the checks; commit `feat(units): units in eval output (#317)`.

## Task 11 — `explain`

- [ ] **Files:** modify `packages/visimark/src/report/explain.ts`; extend
  `packages/visimark/test/report/` (the explain tests) or `test/cli/cli.test.ts`.
- **Steps:**
  1. Tests:
     - `inputs:` lists `Rate [PLN]`.
     - Each rule and scalar line gains ` [PLN] (declared)` or
       ` [PLN] (derived)` after its precision annotation, omitted when
       dimensionless.
     - Document scope lists definitions as `[J] = [N⋅m]`.
     - `explain --json` gains `unit: { map, source }` on each unit-bearing
       binding.
  2. Implement.
  3. Run the checks; commit `feat(units): units in explain (#317)`.

## Task 12 — `infer` and `infer --write`

- [ ] **Files:** modify `packages/visimark/src/infer/propose.ts`,
  `packages/visimark/src/infer/aliases.ts`, `packages/visimark/src/infer/write.ts`,
  `packages/visimark/src/report/infer.ts`; extend `packages/visimark/test/infer/`
  and `packages/visimark/test/cli/infer.test.ts`.
- **Steps:**
  1. Tests:
     - A computed column `Speed = Distance / Duration`, with `Distance [m]` and
       `Duration [s]`, gets the proposal `Speed  [m/s]  header`.
       `infer --write` rewrites the header cell to `Speed [m/s]` (a splice at
       the end of the header cell's text, nothing else).
     - A scalar `speed = …` gets `speed [m/s]` inserted after the name and
       before any `precision`.
     - A second run writes nothing.
     - No proposal is made for an input column, a declared binding, or a
       dimensionless or failed binding.
     - `infer --json` gains
       `units: [{ name, unit, target: "header" | "head" }]`.
     - No acronym is offered for `Weight [kg]`. `Worker cost [USD/node/month]`
       gets an alias proposal for `"Worker cost"`.
     - An imported sheet gets no write.
  2. Implement, reading `CheckResult.unitMaps`.
  3. Run the checks; commit `feat(units): infer proposes and writes derived units (#317)`.

## Task 13 — `fmt --fix-units`

- [ ] **Files:** modify `packages/visimark/src/cli/args.ts`,
  `packages/visimark/src/cli/commands.ts`, `packages/visimark/src/write/fmt.ts`;
  extend `packages/visimark/test/cli/args.test.ts` and add
  `packages/visimark/test/write/fix-units.test.ts`.
- **Steps:**
  1. Tests:
     - `fmt --fix-units` rewrites `[kg*m^2/s^2]` → `[kg⋅m²/s²]`,
       `[node⋅USD/month]` → `[USD⋅node/month]`, `[degC]` → `[℃]` and
       `[°F]` → `[℉]`, in headers, binding heads, literal brackets,
       definitions and import lists.
     - A bracket failing the grammar, cell decorations and prose are
       untouched. No definition is expanded or contracted.
     - Plain `fmt` leaves all of it alone.
     - `--fix-units` on any other command exits `2` with the existing
       unknown-option message.
     - `--fix-units` composes with `--fix-dates`.
  2. Implement as planned splices over the spans recorded in Tasks 3, 5 and 6,
     each replaced by `formatUnit` of that bracket's own unexpanded map.
  3. Run the checks; commit `feat(units): fmt --fix-units (#317)`.

## Task 14 — LSP hover

- [ ] **Files:** modify `packages/visimark-lsp/src/hover.ts` (and
  `analysis.ts` if it needs `unitMaps`); extend the LSP's hover tests.
- **Steps:**
  1. Tests:
     - Hover on a binding or column shows `[PLN] (declared)` or
       `[PLN] (derived)` beside its precision.
     - Hover on a builtin shows `unitSigText`.
  2. Implement.
  3. Run the checks; commit `feat(lsp): unit hover (#317)`.

## Task 15 — Acceptance: the invoice, the §4 table, no regression

- [ ] **Files:** modify `docs/example-invoice.md`; create
  `packages/visimark/test/cli/units.test.ts` (or complete it, if earlier tasks
  seeded it); extend `packages/visimark/test/acceptance.test.ts`; run
  `bun run gen:mcp` and `bun run gen:examples` if their outputs copy the
  invoice (`packages/visimark-mcp/docs/example-invoice.md`).
- **Steps:**
  1. Edit the invoice:
     - Change the `Rate` header to `Rate [PLN]`, re-padding that column by hand.
     - Change `fx_eur` to `fx_eur [PLN/EUR] = 4.2650`.
     - Change `eur_total` to `eur_total [EUR] precision 2 = lines.gross_total / fx_eur`.
     - Update the invoice's own explanatory prose where it describes its
       blocks.
  2. Assert spec §6 item 1 literally: `check` exits `0`, the full `eval` text
     transcript, the `units` object, and the `PLN²/EUR` mismatch after swapping
     `/` for `*`.
  3. `units.test.ts`: one table row per §4 finding, as
     `{ doc, code, location, message }`, run through `runCli check`, plus spec
     §6 items 3–5.
  4. Test that every `docs/**/*.md` that passes `check` on `master` still exits
     `0`. Pin the list in the test so a regression names the file.
  5. Run the checks; commit `test(units): acceptance for #317`.

## Task 16 — Documentation

- [ ] **Files and changes:**
  - `docs/visimark-design.md`:
    - **§3:** header names with a unit clause; the decoration rules under a
      header unit.
    - **§4:** binding-head and `param`-head clause order; literal units and
      their precedence; definitions; `⋅` as an operator; the operator unit
      rules; the generated builtin table (regenerated in Task 2).
    - **§6:** names by stem; alias and quoted head match the name; the
      `UNDEF` hint.
    - **§7:** the inert-unit paragraph replaced by the §15 paragraph from
      #317; `%` is still not a unit.
    - **§8:** the static unit pass and its suppression.
    - **§9:** `infer --write` on headers and `fmt --fix-units` named beside
      `--fix-dates`.
    - **§10:** the widened `UNIT` meaning; `DUP`, `SHEET`, `CYCLE`, `WARN`
      and `TYPE` widenings.
    - **§14:** strike "Units, beyond the inferred decoration".
    - **§15:** the replacement compromise paragraph.
    - **§19:** units in `labelled`/`unlabelled` and CSV headers.
    - **§20:** units on `param` heads.
  - `docs/cli-reference.md`:
    - the `eval` text and `units` JSON;
    - `fmt --fix-units` in the options table;
    - the `UNIT` row of the findings table.

    Then regenerate the copy in `packages/visimark-mcp/docs/` with
    `bun run gen:mcp`.
  - `docs/tutorial.md`:
    - a section on a header `Weight [kg]` used as `Weight` with no `is` line,
      showing that `"Weight [kg]"` does not resolve;
    - a section on `metabolic_rate [kcal] precision 0 = 1600` and a checked
      quotient;
    - the operator table lists `⋅`;
    - a currency example with `[USD]`, `precision 2` written out, `$` left in
      the prose, and no row adding `$` to `USD`.
  - Column-alias documentation (wherever `is` is taught, including
    `packages/visimark-mcp/skill.md` via `gen:mcp`): a bracket suffix is the
    column's name and unit, and `is` stays the path for every other header.
  - `docs/function-reference.md`: regenerated (Task 2).
  - `CHANGELOG.md`, under `## Unreleased` → `### Added`: algebraic unit maps;
    plus, as pre-1.0 changes:
    - a header ending in `[…]` is now a name plus a unit;
    - `"Header [u]"` no longer resolves;
    - `eval --json` keys bracketed columns by name and adds `units`;
    - `Weight` beside `Weight [kg]` is `DUP`;
    - `Revenue [1]` needs escaping as `Revenue \[1\]`.
  - `editors/vscode/CHANGELOG.md`: one line on unit hover and the new `UNIT`
    diagnostics.
  - `docs/vocabulary-catalogue.md`:
    - move the #317 row out of section E into the Shipped register as
      `UNRELEASED`, condensed to `Name` / `Kind` (`language feature`) /
      `Request` / `Landed` (#322) / `Released` (`—`) / `Decision` (the
      deciding comment);
    - update the section E footnote sentence that lists what shipped.
  - `.github/ISSUE_TEMPLATE/vocabulary-request.yml`: add a required
    **Unit behaviour** field beside **Precision behaviour**, asking for the
    primitive's `FnUnits` signature in the `1` / `any` / `U` notation.
    `.agents/commands/issue-review.md` §2V.1 then maps it to `FnDoc.units` in
    its field table.
  - `README.md`: only if it states that units are inert.
- **Steps:**
  1. Make the edits. Run `bun run gen:docs`, `bun run gen:mcp` and
     `bun run gen:examples`.
  2. Run `bun run packages/visimark/src/cli/main.ts check` on every changed
     Markdown file, plus the full checks.
  3. Commit `docs: algebraic unit maps (#317)`.

<!--vmark:no-formulas-->
