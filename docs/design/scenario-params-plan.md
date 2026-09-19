# Scenario parameters — Implementation Plan

**Goal:** ship `param NAME precision N = default LITERAL` and
`visimark eval --scenario FILE|-` as specified, with the motivating example
converted and every CLI surface covered by tests.

**Spec:** [`scenario-params-spec.md`](scenario-params-spec.md) (approved on
[#119](https://github.com/michal-niedzwiedzki/visimark/issues/119)).

**Architecture:** a `param` is parsed into an ordinary scalar `Binding` whose
expression is the default's number literal, plus a `param` marker carrying the
default as written and whether it is a percent. Every command then treats it as
the constant binding it is on the defaults, with no evaluator change. A
scenario is applied *to the model* before `check` runs: the CLI resolves and
validates the scenario against the model's params, then replaces each supplied
param's literal with the scenario value. Width, percent-form and key checks all
happen in one module, `eval/scenario.ts`, before anything is evaluated. The
"holds on defaults" report comes from a second `check` on a fresh model built
from the same source.

**Tech Stack:** TypeScript, Bun test runner, `decimal.js`; no new dependency.

## Global Constraints

- Every commit carries the `Co-Authored-By:` trailer from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md)
  for the agent writing it.
- Plain `eval`, `check`, `fmt`, `infer` and `explain` output on documents with
  no `param` stays byte-identical. Every existing test passes unchanged.
- `param` and `default` stay contextual: no lexer token kinds are added, and
  `param = 5` / `default = 3` keep parsing as bindings.
- Before each push: `bun test`, `bun run typecheck`, `bun run build`,
  `bun run lint`, `bun run format:check`, and
  `bun run --filter visimark build:playground` with the resulting
  `docs/vendor/` diff committed.

---

### Task 1 — Parse `param`

- [ ] **Files:** `packages/visimark/src/lang/parser.ts`,
  `packages/visimark/test/lang/parser.test.ts`.
- **Interfaces:** `Binding` (parser) gains
  `param?: { text: string; percent: boolean }`. `text` is the default literal
  as written (`"19%"`, `"-3"`, `"2.00"`).
- **Steps:**
  1. In `parseStatementInner`, before the `precision`-position check: when the
     first token is `ident` `param` and the second is `ident` or `string`,
     parse `param NAME [precision N] = default LITERAL`.
  2. A quoted NAME is a `LangError`:
     `a param name must be an identifier, not a quoted header`.
  3. A missing `precision` clause is not a parse error: `precision` stays
     undefined, and check reports `PRECISION` (Task 3).
  4. After `=`, the next token must be `ident` `default`, else
     `expected \`default\` after \`=\` in a param`.
  5. LITERAL is an optional `op -` followed by `number` or `percent`, then
     `eof`. Anything else is
     `a param default must be a number literal`. The expression is a `num`
     literal holding the folded value (`19%` → `0.19`; `-` negates).
  6. Tests: every form in spec §2 and §4.1, plus `param = 5`,
     `param precision 2 = x / y`, `default = 3`, `x = param + default`.

### Task 2 — Model

- [ ] **Files:** `packages/visimark/src/model/types.ts`,
  `packages/visimark/src/model/build.ts`,
  `packages/visimark/src/import/resolve.ts`,
  `packages/visimark/test/model/*` (a new `param.test.ts`).
- **Interfaces:** model `Binding` gains the same `param?` field.
- **Steps:**
  1. `parseOne` copies `param`.
  2. In a sheet, a `param` whose name is a header of the block's table is
     `DUP` on the param (`relatedSpan` = the header), whatever the order. The
     column keeps its data and rule. A header added by a later block of the
     same sheet is covered by also checking every param against
     `sheet.columnIndex` after all blocks are built.
  3. In `resolve.ts`, a `param` shadowing an imported column is `DUP`, not
     `IMPORT`.
  4. Document scope: params are ordinary doc-scope scalars.

### Task 3 — Check

- [ ] **Files:** `packages/visimark/src/eval/check.ts`,
  `packages/visimark/test/eval/param.test.ts`.
- **Steps:**
  1. At the top of `evalScalar`, for a `param`: no `precision` → `PRECISION`
     with message `param NAME declares no width` and suggestion
     `write \`param NAME precision N = default …\``. A default with more
     significant decimals than the width →
     `PRECISION`, `default TEXT has D decimals; param NAME declares N`. Both
     mark the binding unevaluable, so dependants are suppressed under `NOTE`.
  2. Make sure the formatter renders the suggestion (check how `PRECISION`
     prints in `report/format.ts`).
  3. Tests: spec §4.1 rows; `12.5%` at `precision 3` is `0.125` and clean.

### Task 4 — Scenario module

- [ ] **Files:** `packages/visimark/src/eval/scenario.ts` (new),
  `packages/visimark/test/eval/scenario.test.ts`.
- **Interfaces:**
  - `parseScenarioJson(text: string, file: string): Map<string, ScenarioEntry> | ScenarioError`
    reads a flat object and detects duplicate keys. `JSON.parse` keeps the last
    duplicate silently, so a small scanner walks the top-level keys first.
  - `listParams(model): ParamInfo[]` gives the id, sheet, name, precision,
    default text and percent flag of every param, in document order.
  - `resolveScenario(model, entries): Resolved | ScenarioError` applies the
    key rules and value rules of spec §3.3 and returns the id → decimal-string
    map.
  - `applyScenario(model, resolved)` replaces each param's `expr` with a `num`
    literal holding the scenario value, keeping the span.
  - `ScenarioError` carries the exact stderr message from spec §4.2.
- **Steps:** implement, then table-test every row of spec §3.3's worked cases
  and every §4.2 message.

### Task 5 — CLI

- [ ] **Files:** `packages/visimark/src/cli/commands.ts`,
  `packages/visimark/src/report/json.ts`,
  `packages/visimark/test/cli/scenario.test.ts` (new),
  `packages/visimark/test/fixtures/scenario/*` (new).
- **Steps:**
  1. `parseArgs` treats `--scenario` as a value option. A missing value, or a
     following token that starts with `--`, is recorded as missing.
  2. `check`, `fmt`, `infer`, `explain` and `ref` refuse `--scenario`: exit
     `2`, `visimark: --scenario is only valid with eval`, and under `--json`
     the error envelope with code `SCENARIO`. `errorEnvelope` accepts
     `"SCENARIO"`.
  3. `eval --scenario`: read the file, or stdin for `-`. Build the model,
     resolve the scenario, and exit `2` with the message on any error, printing
     nothing on stdout. Otherwise apply the scenario, run `check`, and run
     `check` again on a fresh model for the defaults.
  4. Text: after the value lines, the `scenario:` block (spec §5.3). ASSERT
     lines on stderr end `is false under scenario (holds on defaults)` /
     `(also false on defaults)` / `(unverified on defaults)`.
  5. JSON: a `scenario` key after `file`; `defaults` on each assertion with
     `holds: false`; no `state` on charts.
  6. `--get` under a scenario: bare value in text, no `scenario:` block; JSON
     keeps `scenario`.
  7. Tests: spec §6 CLI list, including the round trip and byte-identity of
     the file under a refused `--scenario`.

### Task 6 — Explain

- [ ] **Files:** `packages/visimark/src/report/explain.ts`,
  `packages/visimark/src/playground/browser-entry.ts` (its copy of the text
  renderer), `packages/visimark/test/report/*`.
- **Steps:** a `params:` section per sheet after `scalars:`, with params
  removed from `scalars:`; document-scope params likewise. JSON `params` per
  sheet and top-level `documentScopeParams`. Columns are aligned as
  `name   precision N   default TEXT`.

### Task 7 — Motivating document

- [ ] **Files:** `docs/example-agent-budget.md`,
  `packages/visimark/test/fixtures/scenario/tight.json` and friends,
  `packages/visimark/test/cli/scenario.test.ts`.
- **Steps:** `budget = 2.00` → `param budget precision 2 = default 2.00`.
  Add a "What-if runs" section after "The gate" that shows the `tight.json`
  run and its output, in a `console` block that is not a `vmark` block. Assert
  the exact spec §6 output in the CLI test, and check that `check` is clean
  and `fmt` is byte-stable on the example.

### Task 8 — Documentation

- [ ] **Files:** `docs/visimark-design.md`, `docs/cli-reference.md`,
  `docs/design/structured-output-json-spec.md`, `docs/tutorial.md`,
  `skills/visimark/SKILL.md` (or its reference file), `CHANGELOG.md`,
  `docs/vocabulary-catalogue.md`.
- **Steps:**
  1. `visimark-design.md`:
     - the constraint-4 sentence in §2;
     - §4 names `param`/`default` as contextual keywords and points to a new
       section;
     - a new **§20 Scenario parameters** summarising the statement and
       `eval --scenario`, linking the spec;
     - a sentence in §7 that a `param` default is the one literal a declared
       precision may not narrow;
     - the §11 CLI block gains `[--scenario FILE|-]`;
     - §14 points at the spec's non-goals.
  2. `cli-reference.md`: `--scenario` in the options table, its refusal on
     other commands, and the `SCENARIO` error.
  3. `structured-output-json-spec.md`: the `scenario` key, `defaults` on
     assertions, `SCENARIO` in the error codes, and `params` /
     `documentScopeParams` on `explain`.
  4. `tutorial.md` and the `visimark` skill: a short "What-if runs" section
     saying when to declare a `param`.
  5. `CHANGELOG.md` under `## Unreleased` → `### Added`: the `param`
     statement and `eval --scenario`, noting that no word is newly reserved.
     `editors/vscode/CHANGELOG.md` gets nothing: the extension surface is
     unchanged.
  6. `vocabulary-catalogue.md`: move the #119 row out of section E into the
     Shipped register as `UNRELEASED` (Name, Kind `language feature`, Request
     #119, Landed = this PR, Released `—`, Decision = the deciding comment).
