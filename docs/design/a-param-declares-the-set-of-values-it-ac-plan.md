# Declared domain on `param` — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** A `param` header may add a domain clause — a range (`in [lo, hi]`, half-open ends allowed), a finite set (`in { v1, v2, … }`), and/or a closed-list preset (`integer`/`ℤ`, `natural`/`ℕ`, `positive`, `positive integer`/`ℤ⁺`), intersected. A default outside the domain, or a domain with no legal value, is a new `DOMAIN` finding (exit `1`). An out-of-domain `eval --scenario` value is refused before evaluation under the existing `SCENARIO` usage-error code (exit `2`), distinct from an in-domain value that later fails an `assert` (exit `1`, unchanged). `eval` and `explain` (text and `--json`) report the domain; `fmt` never writes one. Per [`docs/design/a-param-declares-the-set-of-values-it-ac-spec.md`](a-param-declares-the-set-of-values-it-ac-spec.md).

**Architecture:** A domain clause is parsed inside `parseParamInner` (`packages/visimark/src/lang/parser.ts`), between the existing precision clause and the `=`. Its in-memory shape is a new pure module, `packages/visimark/src/lang/domain.ts`, holding the `Intersection`-of-`Leaf` structure the maintainer specified: a leaf is either a finite decimal list or a two-ended interval (each end independently `closed`, `undefined` meaning unbounded and always open); `parts` is the intersection in source order; `effective` is a leaf cached only when the fold is exact. `Binding` (`model/types.ts`) grows an optional `domain?: Domain` alongside the existing `param?: { text, percent }`. Static checks — default-in-domain and domain-emptiness — join `paramWidthOk` in `eval/check.ts`, which already validates the default against `precision`; both live under the new `DOMAIN` finding code. The scenario path's `checkValue` in `eval/scenario.ts` grows one more check, after the existing width/percent checks, throwing the existing `ScenarioError`/`SCENARIO` machinery with the four message shapes from the spec. Reporting is additive in three places: `report/params.ts` (`paramLines`, shared by `explain` and the playground), `report/explain.ts` (`paramJson`), and `cli/commands.ts` (`scenarioText`/`scenarioJson` for `eval`, plus a new always-checked `params:`/`params` block independent of `--scenario`). New glyphs (`ℤ`, `ℕ`, `∈`) join `lang/notation.ts`'s closed `GLYPH_IDENTS` table; `ℤ⁺` is a two-codepoint sequence handled in the lexer as a unit that emits the two identifier tokens `positive` `integer` in that order, so the parser never special-cases it beyond reading two preset words. `fmt` (`write/fmt.ts`) is untouched — it has no domain write-back path today and gains none.

**Tech Stack:** TypeScript; `decimal.js` (exact-decimal comparisons, `precision: 40`); Bun test runner; engine package `packages/visimark`. No LSP or VS Code changes — a domain clause reports through the existing engine `FindingCode` channel the LSP already maps generically; confirm in Task 8 whether `packages/visimark-lsp` needs a `DOMAIN` message case (precedent: `declared-precision-plan.md` Task on LSP mapping) and add one only if the generic mapping does not already cover an unrecognised code gracefully.

**Spec:** [`docs/design/a-param-declares-the-set-of-values-it-ac-spec.md`](a-param-declares-the-set-of-values-it-ac-spec.md)

## Global Constraints

- Work on branch `issue/241-a-param-declares-the-set-of-values-it-ac-impl`. One PR (#246, already open as a draft); do not open a second.
- Every commit ends with the `Co-Authored-By` trailer resolved from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the work. Do not hardcode a vendor name into this plan or copy a trailer from another plan.
- New `FindingCode` value **`DOMAIN`**, added to `ERROR_CODES` in `packages/visimark/src/model/types.ts` **and** to any hardcoded error-code set a test asserts against (check `packages/visimark/test/acceptance.test.ts` and any `errorCodes`-shaped constant — the declared-precision plan's own note that omitting the second lets a drift-count assertion silently under-count still applies).
- Grammar: `param NAME precision N [PRESET] [in DOMAIN-EXPR] = default LITERAL`. `PRESET` is `integer` | `positive` | `natural` | `positive integer` (keyword) or `ℤ` | `ℕ` | `ℤ⁺` (glyph, `positive` has none). `DOMAIN-EXPR` is `[LO, HI]`/`[LO, HI)`/`(LO, HI]`/`(LO, HI)` (either literal omittable, but an omitted end's bracket **must be open** — `[0,]` is a `TYPE` malformed-clause error, not unbounded) or `{ V1, V2, … }` (at least one member; `{ }` is `DOMAIN`, empty). `in`/`∈` are interchangeable; brackets themselves do not vary (no `⟨⟩`). At most one preset clause and one `in` clause per param — their intersection.
- `fmt` never writes a domain clause: no adding, removing, or normalizing a spelling (`in`↔`∈`, `integer`↔`ℤ`, `natural`↔`ℕ`, `positive integer`↔`ℤ⁺`). Verify this with a fixture round-trip, not by inspection alone.
- Every domain literal (range end or set member) is independently checked against the param's declared `precision` (`PRECISION`, widened) and percent-ness (`TYPE`, widened) — the same two checks `paramWidthOk` already runs against `default`.
- Emptiness of a domain is checked only where decidable per the spec §3: a reversed or degenerate-open range, an empty set literal, and a preset (`integer`/`natural`/`positive integer`) intersected with a range that contains no lattice point. A `positive` range narrower than the declared `precision` is **not** checked for emptiness — do not add general precision-grid emptiness detection; it is an explicit non-goal.
- `explain --json` gains `domain` on a `params`/`documentScopeParams` entry only when that param declares one — a document with no domain-bearing param must be byte-for-byte unchanged, verified by running the branch CLI on an existing example document with no domain clause before and after each task.
- `visimark ref` is **not** touched. It reads no document and never reported params in the first place; this was a factual error inherited from the issue and corrected in the spec (`ref` §6 note). Do not add domain reporting to `cmdRef` or `describeFunction`.
- After each task: `bun test`, `bun run typecheck`, `bun run build` from the repo root, plus `bun run packages/visimark/src/cli/main.ts check` on every `docs/example-*.md` and on the new domain fixture. Loop check → fix → check until green. Never `bunx visimark` (that runs the published build, not this branch).

---

### Task 1: lexer and glyph notation

**Files:**
- Edit: `packages/visimark/src/lang/token.ts` — add token kinds `lbracket` (`[`), `rbracket` (`]`), `lbrace` (`{`), `rbrace` (`}`); add `"in"` as a token kind (contextual, see Task 2) if not representable as an `ident` check alone.
- Edit: `packages/visimark/src/lang/lexer.ts` — emit the four new punctuation tokens beside the existing `(`/`)`/`,` cases. Add lexing for `∈` (single codepoint) and for the two-codepoint `ℤ⁺` sequence (`ℤ` U+2124 followed by `⁺` U+207A) as a unit.
- Edit: `packages/visimark/src/lang/notation.ts` — add `ℤ: "integer"`, `ℕ: "natural"` to `GLYPH_IDENTS`; add `∈` to a new `GLYPH_OPS`-style table (or extend `GLYPH_IDENTS` if `in` can be represented as an identifier the parser already special-cases — check how `in` will be tokenised in Task 2 first). Document the `ℤ⁺` two-token emission in a comment beside `GLYPH_IDENTS`, matching the file's existing "closed set, not a general symbol-notation system" framing.
- Test: `packages/visimark/test/lang/lexer.test.ts`.

**Interfaces:**
- Produces: `lex("[0, 80]")` → `lbracket`, `number(0)`, `comma`, `number(80)`, `rbracket`, `eof`. `lex("∈")` → the same token `in` would produce. `lex("ℤ⁺")` → two `ident` tokens, `"positive"` then `"integer"`, positioned to span the whole two-codepoint sequence for error reporting.
- Consumes: nothing new; extends the existing `push`/`SYMBOL_OPS` machinery.

- [ ] **Step 1 (RED):** lexer tests for `[`, `]`, `{`, `}`, `∈`, `ℤ`, `ℕ`, `ℤ⁺` in isolation and inside a `param` line. Then implement.
- [ ] **Step 2:** full verification loop.

---

### Task 2: the in-memory domain shape

**Files:**
- Add: `packages/visimark/src/lang/domain.ts` — `Leaf` (finite decimal list, or `{ lo?, loClosed, hi?, hiClosed }` with an omitted end always `closed: false`/absent), `Intersection` (`parts: Leaf[]`, `effective?: Leaf` cached only when the fold is exact), `testDomain(d, value): boolean`, `isEmptyDomain(d): boolean` (decidable cases only, per Global Constraints), `foldDomain(d): string[] | undefined` (exact enumeration when possible).
- Test: `packages/visimark/test/lang/domain.test.ts` — every row of the spec's §3 semantics table (closed/half-open/unbounded ranges, finite sets, percent normalization, each preset alone and intersected, the three empty-domain cases, and at least one narrow `positive` range confirming it is **not** flagged empty).

**Interfaces:**
- Produces: `testDomain({ parts: [{kind:"preset", name:"integer"}, {kind:"range", lo:"0", loClosed:true, hi:"80", hiClosed:true}] }, "40.5")` → `false`. `isEmptyDomain({ parts: [{kind:"range", lo:"10", loClosed:true, hi:"0", hiClosed:true}] })` → `true`.
- Consumes: `decimal.js` for exact comparison; no dependency on the parser or model.

- [ ] **Step 1 (RED):** the full semantics-table test suite against a hand-built `Intersection` (no parser yet).
- [ ] **Step 2:** implement `domain.ts`.
- [ ] **Step 3:** full verification loop.

---

### Task 3: parsing the domain clause on `param`

**Files:**
- Edit: `packages/visimark/src/lang/parser.ts` — extend `parseParamInner` (~L459-517): after `takePrecisionClause` returns `nameToks`/`precision`, look for an optional preset (one or two `ident` tokens from the closed list) and an optional `in`/`∈` clause (range or set) before requiring `=`. Emit `LangError`s for: an unrecognised preset word, a malformed clause (`in` with nothing after, mismatched delimiter), a non-number-literal domain bound, a closed bracket on an omitted end. Build the `Domain`/`Intersection` from `lang/domain.ts` and attach it to the returned `Binding`.
- Edit: `packages/visimark/src/lang/ast.ts` / wherever the parser's `Binding` shape is declared — add `domain?: Domain`.
- Test: `packages/visimark/test/lang/param.test.ts` — every example in spec §2 (all five worked params), every malformed case in spec §4.1's `TYPE` rows, and the `PARAM_DEFAULT_MESSAGE`-style exported constants for the new messages (`unrecognised param domain preset`, `malformed param domain clause`, `a param domain bound must be a number literal`) so tests assert on the constant, not a duplicated string.

**Interfaces:**
- Produces: `parseStatement("param x precision 0 integer in [0, 80] = default 0")` → `Binding` with `domain` set; `parseStatement("param x precision 0 in [0,] = default 0")` throws the malformed-clause message; `parseStatement("param x precision 0 nonsense = default 0")` throws the unrecognised-preset message.
- Consumes: `lang/domain.ts` (Task 2), the new lexer tokens (Task 1).

- [ ] **Step 1 (RED):** parser tests for every grammar case above. Then implement.
- [ ] **Step 2:** full verification loop.

---

### Task 4: `Binding.domain` through the model, and the `DOMAIN` finding

**Files:**
- Edit: `packages/visimark/src/model/types.ts` — add `domain?: Domain` to `interface Binding`; add `"DOMAIN"` to `FindingCode` and `ERROR_CODES`.
- Edit: wherever the parsed binding is lifted into the model binding (find via `grep -n "param:" packages/visimark/src/model/build.ts` — the same site that already carries `param` through) — carry `domain` alongside it.
- Edit: `packages/visimark/src/eval/check.ts` — extend `paramWidthOk` (~L353-382) or add a sibling `paramDomainOk(binding)`: for each domain literal, run the existing precision/percent checks (widened `PRECISION`/`TYPE`, see spec §4.1 messages); check `isEmptyDomain` once per domain-bearing param and emit `DOMAIN` with the "declares an empty domain" message; check the default against `testDomain` and emit `DOMAIN` with the "is not in the domain of" message. Call this alongside the existing `paramWidthOk` call site.
- Test: `packages/visimark/test/eval/param.test.ts` — one case per §4.1 row (empty domain via reversed range, empty domain via preset∩range, empty set literal, default outside a range, default outside a set, a domain literal too wide for `precision`, a domain literal percent-mismatched, unrecognised preset, malformed clause) plus the `NOTE`-suppression case (a `DOMAIN`-broken param's dependants suppressed, mirroring the existing `PRECISION` suppression test).

**Interfaces:**
- Produces: `check(doc-with-out-of-domain-default)` → one `DOMAIN` finding, exit `1`; dependants of that param report `NOTE`.
- Consumes: `lang/domain.ts`'s `testDomain`/`isEmptyDomain`.

- [ ] **Step 1 (RED):** the finding tests above. Then implement.
- [ ] **Step 2:** full verification loop.

---

### Task 5: the `SCENARIO` domain check

**Files:**
- Edit: `packages/visimark/src/eval/scenario.ts` — `ParamInfo` gains `domain?: Domain` (populated in `listParams`, reading `b.domain`); `checkValue` gains one more check, after the existing width check (~L227-231) and before returning: if `param.domain` is set and `!testDomain(param.domain, d.toString())`, throw `ScenarioError` with the message built per spec §4.2 (branch on range / finite-set-≤10 / finite-set->10 / preset, matching the domain's declared spelling in the message).
- Test: `packages/visimark/test/eval/scenario.test.ts` — one case per §4.2 message shape (range, small set, large set >10 members, each of the four presets), plus the unchanged case (in-domain scenario value that fails an `assert`, confirming exit `1` not `2`).

**Interfaces:**
- Produces: `resolveScenario(model, [{key: "prepay_share", raw: '"70%"'}])` on a domain `{ 30%, 40%, 45%, 50% }` throws `ScenarioError` with the small-set message.
- Consumes: `lang/domain.ts`'s `testDomain`.

- [ ] **Step 1 (RED):** the message-shape tests. Then implement.
- [ ] **Step 2:** full verification loop, plus `packages/visimark/test/cli/scenario.test.ts` for the exit-code-2 end-to-end case.

---

### Task 6: CLI reporting — `eval`

**Files:**
- Edit: `packages/visimark/src/cli/commands.ts` — add a domain-to-clause-text formatter (used by both the new `params:` text block and JSON `domain.clauses`); add the always-on `params:` text block (after the value lines and, under `--scenario`, after the existing `scenario:` block) listing every domain-bearing param, gated on at least one existing; add the JSON `params` object (keyed by qualified name, `value`/`default`/`source`/`domain`), gated the same way, placed per spec §6's example. Reuse `scenarioJson`'s `source`-computation pattern for the plain-`eval` case (`source` is always `"default"` without `--scenario`).
- Test: `packages/visimark/test/cli/scenario.test.ts` and a new/extended `packages/visimark/test/cli/eval.test.ts` (check which exists first) — the exact text and JSON shapes from spec §6, including the "absent, not null" rule for `domain.fold` and the "unchanged stdout when no param has a domain" case.

**Interfaces:**
- Produces: `eval` text output containing `params:\n  levers.extra_hours   integer in [0, 80]\n  ...`; `eval --json` output containing `"params": { "levers.extra_hours": { "value": "40", "default": "0", "source": "default", "domain": { "clauses": [...], "fold": [...] } } }`.
- Consumes: `lang/domain.ts`'s `foldDomain`.

- [ ] **Step 1 (RED):** the text/JSON shape tests. Then implement.
- [ ] **Step 2:** full verification loop.

---

### Task 7: CLI reporting — `explain`

**Files:**
- Edit: `packages/visimark/src/report/params.ts` — `paramLines` gains a fourth aligned column, `domain <clause text>`, appended only for a row whose binding has `domain` set (existing rows without one are byte-identical).
- Edit: `packages/visimark/src/report/explain.ts` — `paramJson` (~L78-82) gains `domain: domainJson(b.domain) | undefined` (absent key, not `null`, matching spec §6), reusing the formatter from Task 6.
- Test: `packages/visimark/test/report/` or wherever `explain` is tested — the text and `--json` shapes from spec §6, and the byte-identical-when-absent case for both `params` and `documentScopeParams`.

**Interfaces:**
- Produces: `explain` text containing `extra_hours    precision 0   default 0   domain integer in [0, 80]`; `explain --json`'s `params`/`documentScopeParams` entries gaining `domain` only when declared.
- Consumes: the shared formatter from Task 6 (factor it into a small shared helper, e.g. `report/domain-format.ts`, if `cli/commands.ts` and `report/explain.ts` would otherwise duplicate it).

- [ ] **Step 1 (RED):** the tests above. Then implement.
- [ ] **Step 2:** full verification loop.

---

### Task 8: `fmt`, `infer`, and the LSP — confirm no change, prove it

**Files:**
- Test only: extend the `fmt` round-trip test suite (wherever `write/fmt.ts` is tested) with a case that has a domain clause in five spellings (`in`/`∈`, `integer`/`ℤ`, `natural`/`ℕ`, `positive integer`/`ℤ⁺`, a finite set) and asserts `fmt` is a byte-for-byte no-op on all five, run twice (idempotence).
- Test only: confirm `infer` never proposes a domain clause and never rewrites an existing one (extend `packages/visimark/src/infer/` tests with a document that has an un-domained param `infer` would otherwise touch).
- Investigate: `packages/visimark-lsp` — read how it maps engine `FindingCode`s to diagnostics. If the mapping is a generic `code → message` pass-through, no change is needed; if it's an explicit switch that would silently drop an unknown code, add the `DOMAIN` case. Report which case applies before editing anything.

**Interfaces:**
- Produces: no new production code unless the LSP mapping is exhaustive-switch shaped.
- Consumes: existing `fmt`, `infer`, and LSP modules, unmodified unless the investigation finds a gap.

- [ ] **Step 1:** write and run the `fmt`/`infer` tests above (should pass with zero production changes if Tasks 1-7 were scoped correctly — this task is a proof, not new behavior).
- [ ] **Step 2:** investigate and, only if needed, patch the LSP mapping; add its own test.
- [ ] **Step 3:** full verification loop.

---

### Task 9: acceptance fixture

**Files:**
- Add: `packages/visimark/test/fixtures/domain/levers.md` — a non-normative fixture (precedent: `test/fixtures/import/benchmark.md`) covering: a closed range, a half-open range, a finite set, `natural`/`ℕ` and `positive integer`/`ℤ⁺` on two different params, `in` and `∈` spellings of the same clause, one default outside its domain, and one in-domain scenario value that still fails an `assert`.
- Add: `packages/visimark/test/fixtures/domain/` — companion scenario JSON files (precedent: `test/fixtures/scenario/tight.json`) exercising each of the four `SCENARIO` message shapes from spec §4.2 (range, ≤10-member set, >10-member set — needs a param with an 11+-member set literal, preset).
- Add: `packages/visimark/test/domain-acceptance.test.ts` — asserts `check` output and `eval --scenario --json` output against fixed expectations, transcript-style (precedent: `test/import-acceptance.test.ts`). **Not** added to the `fmt`-byte-stability suite beyond its own transcript.

**Interfaces:**
- Produces: a passing transcript test exercising every notation and message shape named in the spec.
- Consumes: the full stack from Tasks 1-7.

- [ ] **Step 1 (RED):** write the fixture and the transcript test with expected output left as a clearly-marked placeholder.
- [ ] **Step 2:** run `bun run packages/visimark/src/cli/main.ts check`/`eval --scenario` on the fixture, capture real output, and fill in the transcript from that run (never hand-typed).
- [ ] **Step 3:** full verification loop.

---

### Task 10: documentation (final task — every merged PR needs this)

- [ ] `docs/visimark-design.md` — extend §10's error-taxonomy table with the `DOMAIN` row (not auto-fixable); extend §20 (Scenario parameters) with a short paragraph on declared domains, pointing at `docs/design/scenario-params-spec.md` the way it already does, and a second pointer at this feature's spec. Confirm whether §4 (Syntax) needs a domain-clause mention alongside the existing `param`/`precision` grammar summary.
- [ ] `docs/design/scenario-params-spec.md` — add a short cross-reference note in §2 (Syntax) and §4.2 (Scenario faults) pointing at the domain spec, since this feature extends both without editing their normative text.
- [ ] `CHANGELOG.md` — one entry under `## Unreleased` → `### Added`, in the file's established style (see the browser-bundle-size and smoke-node entries for the expected length and citation format), naming issue #241 and linking the spec.
- [ ] `docs/vocabulary-catalogue.md` — move the `#241` row out of the section-E table (added by the decide step) into the [Shipped register](../vocabulary-catalogue.md#shipped) as `UNRELEASED`: `Name` = "Declared domain on `param`", `Kind` = "language feature", `Request` = `#241`, `Landed` = this PR (#246, once merged — fill the number when known), `Released` = `—`, `Decision` = the deciding-comment link from the spec header.
- [ ] `docs/cli-reference.md` — extend the `eval` and `explain` rows (or their surrounding prose) to mention the new `params:`/`params` domain-reporting surface, matching the file's existing terse table style.
- [ ] `.github/ISSUE_TEMPLATE/language-feature.yml` — check whether its questions still elicit a sufficient proposal now that a "declared domain" precedent exists (e.g. does a future language-feature issue that touches `param` need a prompt about domain interaction?). Only edit if a real gap is found; do not add a domain-specific question that would misfire on unrelated `param` proposals.
- [ ] Confirm no `editors/vscode/CHANGELOG.md` entry is needed — the LSP surface changes only if Task 8 found the exhaustive-switch case; if it did, add the one-line entry there too.
