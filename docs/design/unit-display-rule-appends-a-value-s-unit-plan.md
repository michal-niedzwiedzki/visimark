# `|unit` display rule — implementation plan

**Spec:** [`docs/design/unit-display-rule-appends-a-value-s-unit-spec.md`](unit-display-rule-appends-a-value-s-unit-spec.md)

## Goal

Add `unit` as the third entry in the closed display-rule registry, exactly as
the spec defines it, and teach `parseDecorated` the whole unit grammar. The
work has five parts:

- a decoration parser that reads `5 m^2` and `50 1/s` as numbers with a suffix
  unit, and a `unitKey` that compares a parsable suffix by its unit map (spec
  §2.3);
- a numeric rule that renders `<number> <unit>`, with a `needsUnit` flag and a
  unit argument on `render` (spec §2.1–§2.2);
- `check`: the `TYPE` gate for a dimensionless value, the narrowed blanket unit
  block, rule-less decoration inference, and a byte-for-byte `STALE` comparison
  (spec §4, §5.1);
- `fmt`: render with the unit and rewrite on a byte difference (spec §5.1);
- the fixtures, the invoice's adoption on all six PLN anchors, and the
  documentation, including a §3 table of display rules guarded by a drift test.

## Architecture

- **`packages/visimark/src/eval/units.ts`** owns decoration parsing.
  `parseDecorated` gains a second pattern tried only when the first fails;
  `unitKey` keys a suffix that parses as a unit by `formatUnit` of its map.
- **`packages/visimark/src/eval/display-rules.ts`** owns the registry. It gets
  the `needsUnit` field, the third `render` parameter, the `unitDisplay`
  renderer and the `unit` entry. `displayRuleTypeMessage()` needs no change: it
  already builds the message from each entry's `accepted`.
- **`packages/visimark/src/eval/check.ts`** owns every finding. All changes sit
  in the scalar-evaluation block (the per-anchor pre-loop is untouched: a bare
  `|unit` seed is already the generic display-rule `ANCHOR`).
- **`packages/visimark/src/write/fmt.ts`** owns write-back. It reads the unit
  map from `CheckResult.unitMaps`, which `check` already exports, so
  `CheckResult` gains no field.
- Nothing in `parse/`, `ANCHOR_RE`, `cli/`, `report/`, `infer/` (beyond what it
  reads through `parseDecorated`), `lang/unit-expr.ts`, `eval/dimensions.ts` or
  the LSP source changes.

## Tech Stack

TypeScript, the Bun test runner, `decimal.js`, and the repo's own CLI via
`bun run packages/visimark/src/cli/main.ts` for acceptance sessions. Do not use
`bunx visimark`, which runs the published build. No new dependency.

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer that
  `.agents/rules/ai-attribution.md` resolves to for the session doing the work.
  Do not hardcode a vendor name.
- `bun test`, `bun run typecheck` and `bun run build` stay green after every
  task.
- `bun run packages/visimark/src/cli/main.ts check` exits `0` on every
  document in `.github/workflows/dogfood.yml`'s `files:` list and on every
  `packages/visimark/test/fixtures/display-rule-*.md` that is not an `-errors`
  fixture.
- `matchesStored` is **not** modified (spec §5.1). `percentDisplay`,
  `nbspDisplay`, `isPercentText`, the round-trip proof and every `percent` or
  `nbsp` finding are unchanged, except the shared `TYPE` parenthetical, which
  gains `; unit: numeric with a unit`.
- `eval`, `explain`, `infer`, `--json` and the did-you-mean list gain no option,
  key or output (spec §5.3).
- `fmt --fix-units` is not extended to decorations (spec §7).
- No `.skip` or `.only` is left in tests, and no assertion is loosened to pass.
  Where an existing test pins the old `TYPE` text or the old invoice text, the
  expectation is updated to the new literal, never weakened to `toContain` of a
  fragment.

---

## Task 1: `parseDecorated` reads the unit grammar

**Files:** `packages/visimark/src/eval/units.ts`,
`packages/visimark/test/eval/units.test.ts`.

**Interfaces:**

```ts
// unchanged signature; one more accepted shape
export function parseDecorated(text: string): Decorated;
// unchanged signature; a parsable suffix keys by its normalised map
export function unitKey(u: Unit | null): string;
```

- [ ] **Step 1 — failing tests** in `units.test.ts`:
  - `parseDecorated("5 m^2")` → `{ kind: "number", num: "5", unit: { text: "m^2", side: "suffix" } }`.
  - `parseDecorated("50 1/s")` → suffix `1/s`; `parseDecorated("-3.50 kg")`
    and `parseDecorated("6.0 N⋅m/s²")` → suffix units, `num` `-3.50` and `6.0`.
  - Still `not-a-number`: `"2026-09-10"`, `"5 1/2"`, `"3 x 4"`, `"5m^2"` (no
    whitespace before the rest), `"items sold"`.
  - Every text that parsed before parses identically: `"$5.50"`, `"12 N"`,
    `"23300.00 PLN"`, `"-$3"`, `"$5 USD"` (still `both-sides`), `"40%"` (still
    `not-a-number`).
  - `unitKey` equal for suffix `m^2` and suffix `m²`; different for `m²` and
    `kg`; a prefix `$` keys `prefix:$` as today; a suffix that is not a unit
    (`"pcs."` if it parses through the first pattern but not `parseUnit`) keys
    by its text.
  - `inferColumnUnit(["12 m^2", "30 m²"])` → `conflict: false`;
    `inferColumnUnit(["12 m^2", "30 m²", "4 kg"])` → `conflict: true`, and
    `forms` lists the author spellings `m^2`, `kg` (first spelling of a key wins).
  - `decorationProblem("5 m^2", <map m:2>, defs, "anchor", "area")` → `null`.
- [ ] **Step 2 — implement.** After `DECORATED` fails, try
  `^(?<sign>-?)(?<num>\d+(?:\.\d+)?)\s+(?<rest>.+)$` and accept only when
  `parseUnit(rest).ok`. Return `{ kind: "number", num: sign + num, unit: { text: rest, side: "suffix" } }`.
  The author's text is kept. In `unitKey`, for a suffix, `parseUnit(u.text)`;
  on success key `suffix~` + `formatUnit(map)` (no `defs`: `J` and `N⋅m` stay
  two decorations), otherwise `suffix:` + text as today. `inferColumnUnit`'s
  `forms` keep the first-seen spelling per key.
- [ ] **Step 3** — `bun test packages/visimark/test/eval/units.test.ts`, then
  the full suite. Commit: `feat(units): read the whole unit grammar in a decoration (#323)`.

## Task 2: Registry — `needsUnit`, the unit argument, the `unit` entry

**Files:** `packages/visimark/src/eval/display-rules.ts`,
`packages/visimark/test/eval/display-rules.test.ts`, and every test pinning the
old shared `TYPE` text: `packages/visimark/test/eval/check.test.ts` (4 sites),
`packages/visimark/test/eval/display-rules.test.ts`,
`packages/visimark/test/cli/cli.test.ts`.

**Interfaces:**

```ts
export interface DisplayRule {
  accepts(v: Value): boolean;
  render(v: Value, places: number, unit?: UnitMap): string;
  accepted: string;
  inlineCode: boolean;
  /** true when the rule renders the value's unit and refuses a dimensionless value */
  needsUnit: boolean;
}
export function unitDisplay(v: Value, places: number, unit?: UnitMap): string;
// DISPLAY_RULES order: percent, nbsp, unit
// unit: { accepts: v => v.t === "num", render: unitDisplay,
//         accepted: "numeric with a unit", inlineCode: true, needsUnit: true }
// percent, nbsp: needsUnit: false
```

- [ ] **Step 1 — failing tests** in `display-rules.test.ts`:
  - `unitDisplay` at the spec §3 table: `23300` @2 `PLN` → `23300.00 PLN`;
    `-3.5` @2 `kg` → `-3.50 kg`; `5` @0 `m²` → `5 m²`; `50` @0 `s⁻¹` map →
    `50 1/s`; `6` @1 `{N:1,m:1,s:-2}` → `6.0 N⋅m/s²`; `-0.001` @2 `PLN` →
    `0.00 PLN` (never `-0.00`); a `J` map → `J`.
  - `unitDisplay` throws on a non-number, on `undefined` and on an empty map.
  - The registry test becomes `["percent", "nbsp", "unit"]`.
  - `DISPLAY_RULES.unit.accepts` true for a number, false for a date and a
    string; `needsUnit` true for `unit`, false for the other two.
  - `displayRuleTypeMessage()` →
    `a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)`.
- [ ] **Step 2 — implement.** `unitDisplay` rounds with `roundToPlaces(v.d, places)`,
  prints with `toFixed(places)`, strips a lone `-` from a zero result as
  `percentDisplay` does, and appends `" " + formatUnit(unit)`. Import
  `formatUnit`, `isDimensionless` and `UnitMap` from `../lang/unit-expr.js`.
- [ ] **Step 3** — replace the old message literal in every pinned test with
  the new one. Run the suite. Commit: `feat(display-rules): register |unit (#323)`.

## Task 3: `check` — `TYPE`, the unit block, inference, the byte comparison

**Files:** `packages/visimark/src/eval/check.ts`,
`packages/visimark/test/eval/check.test.ts`.

**Interfaces:** none new. Behaviour changes inside the scalar block that today
begins `const mine = valueAnchorsOf(model, binding.id);`.

- [ ] **Step 1 — failing tests** in `check.test.ts`, one per spec §4 row and
  §3 comparison case, using the existing `check(parse(src))` helpers:
  - `|unit` on `bare precision 2 = 3`, on `ratio precision 2 = 6 [PLN] / 2 [PLN]`,
    on a string and on a date → one `TYPE` each with the shared message.
  - `|percent` on a `[PLN]` scalar → still `|percent cannot render a value with a unit (PLN)`.
  - `|unit` on a `[PLN]` scalar: seeds `23300.00 PLN` clean; `23300`,
    `23300.00`, `23300.00  PLN`, `$23300.00`, `[PLN] 23300.00`,
    `23300.00 EUR`, `23300.00 pln`, `_`, `0` → one `STALE` each, with
    `computed` `23300.00 PLN`. None of them produces `UNIT`.
  - The same `$3.50` and `3.50 EUR` seeds on a **plain** anchor → `UNIT`, as
    today (the classification pair, spec §4 last row).
  - A scalar with a `|unit` anchor seeded `**$3.50**` and a plain sibling
    `**3.50 PLN**` → `STALE` on the rule anchor only; the plain sibling's
    inferred decoration is `PLN`.
  - `|unit` on a scalar whose evaluation fails upstream → no `STALE`, no
    finding on the anchor (spec §3, upstream error).
- [ ] **Step 2 — implement**, in this order:
  1. **Inference.** Split `anchorValueText`'s use: the existence test that
     drives `emitNotDerivable` keeps reading the first anchor of any kind (so
     percent-only scalars behave as today); the decoration read for
     `anchorUnit`, `scalarUnits` and `decorationProblem` takes the first anchor
     **without** a `displayRule`. Add `plainAnchorValueText(model, id)` beside
     `anchorValueText`; do not change the existing function.
  2. **`TYPE`.** `const unitMap = dimensions.unitOf(binding.id)` moves above
     `wrongTypeMine`. `wrongTypeMine` = rule rejects `v`, **or** the rule
     `needsUnit` and `isDimensionless(unitMap)`.
  3. **Unit block.** `unitBlocked` filters to rules with `needsUnit === false`.
     The message text is unchanged.
  4. **`STALE`.** In the numeric `STALE` loop, for an anchor whose rule
     `needsUnit`, compute `rendered = rule.render(v, prec, unitMap)` and
     `continue` only when `text === rendered`; every other anchor keeps
     `matchesStored`. `computed` for every rule passes `unitMap` as the third
     argument.
  5. The `percentMine` "cannot mix a unit with a display rule" loop is
     unchanged; it never sees a `|unit` anchor.
- [ ] **Step 3** — suite green, every dogfood document clean. Commit:
  `feat(check): |unit TYPE gate and byte-for-byte STALE (#323)`.

## Task 4: `fmt` — the unit write-back

**Files:** `packages/visimark/src/write/fmt.ts`,
`packages/visimark/test/write/fmt.test.ts`, beside the existing `|percent`
write-back tests.

**Interfaces:** none new.

- [ ] **Step 1 — failing tests:** `fmt` on a `|unit` anchor seeded `_`, `$3.50`,
  `3.50 EUR`, `3.50  PLN` and `5 m^2` (for a `[m²]` scalar) writes exactly the
  rendering; a second `fmt` is a no-op; a `|unit` anchor on a dimensionless
  scalar is not touched; a plain `**5 m^2**` anchor whose value moves to 6 is
  rewritten `6 m^2`, and one decorated `50 1/s` becomes `51 1/s`, never a bare
  number (the baseline-3 regression).
- [ ] **Step 2 — implement.** In the anchored-scalar loop, look up
  `const unitMap = result.unitMaps.get(id)?.map`. Pass it to `rule.render`.
  The rewrite test becomes: `rule?.needsUnit` → `current !== wanted`; otherwise
  the existing percent / `matchesStored` test. `sigilBlocked` is unchanged.
- [ ] **Step 3** — suite green. Commit: `feat(fmt): write |unit spans (#323)`.

## Task 5: Fixtures and CLI acceptance

**Files:** new `packages/visimark/test/fixtures/display-rule-unit.md`,
`display-rule-unit-errors.md`, `decoration-unit-spelling.md` (contents verbatim
from spec §6); `packages/visimark/test/cli/cli.test.ts`.

- [ ] **Step 1** — write the three fixtures exactly as spec §6 gives them.
- [ ] **Step 2** — CLI tests in `cli.test.ts`, beside the `nbsp` block, in the
  same `capture()` / `runCli` style:
  - `check` on `display-rule-unit.md` exits `0` with `0 problems`; `fmt`
    reports `unchanged`; `eval --json` reports `s.total` as `23300` with no
    new key.
  - Drift (`23300` → `24000`): exit `1`, output contains
    `23300.00 PLN ≠ 24000.00 PLN` and `2 problems (2 stale, 0 errors)`; `fmt`
    rewrites to `**24000.00 PLN**`; `check` then exits `0`.
  - Declaration `PLN` → `EUR` (head and literal): one `STALE`
    `23300.00 PLN ≠ 23300.00 EUR`; after `fmt` the diff against the original
    is exactly one changed span.
  - `area` → `6 [m²]`: `fmt` writes `6 m²` in the rule anchor and `6 m^2` in
    the plain sibling.
  - `display-rule-unit-errors.md`: exit `1`, and the set of
    `(code, scalar, message)` lines equals the six in spec §6.
  - `decoration-unit-spelling.md`: exit `0`; with `hall` at `13 m^2`, one
    `STALE`, and `fmt` writes `43 m^2`; with a `4 kg` row added, `UNIT`.
- [ ] **Step 3** — suite green. Commit: `test: |unit fixtures and CLI acceptance (#323)`.

## Task 6: The invoice adopts `|unit`

**Files:** `docs/example-invoice.md`, its generated copy
`packages/visimark-mcp/docs/example-invoice.md` (via `bun run gen:mcp`),
whatever `bun run gen:docs` regenerates from it, and every test that pins the
invoice's text or anchor offsets — at least
`packages/visimark/test/acceptance.test.ts`,
`packages/visimark/test/report/explain.test.ts`,
`packages/visimark/test/cli/units-acceptance.test.ts`,
`packages/visimark-lsp/test/{diagnostics,formatting,resilience}.test.ts`,
`editors/obsidian/test/{snapshot,gate,api,infer-plan}.test.ts`,
`packages/visimark-mcp/test/*.test.ts`.

- [ ] **Step 1** — `check` the invoice before the edit and save the output.
- [ ] **Step 2** — move `PLN` inside the delimiter and add `|unit` on all six
  anchors: lines 33–35 (`net_total`, `vat_total`, `gross_total`) and lines
  77–79 (`recon.scheduled`, `lines.gross_total`, `recon.variance`). Example:
  `**23300.00 PLN**<!--vmark=lines.net_total|unit-->.` Replace the paragraph
  ending "The anchored numbers stay bare — `PLN` and `EUR` stay in the prose,
  where a reader expects them." with one that says the anchors carry `|unit`,
  so `fmt` writes the unit from the declaration and a changed declaration
  rewrites it.
- [ ] **Step 3** — `check` and `fmt` on the invoice: `0 problems`, `unchanged`.
  Run `bun run gen:mcp` and `bun run gen:docs`; commit what they regenerate.
- [ ] **Step 4** — run the full suite; update each failing pinned expectation
  to the new literal text or offset, one by one, confirming each failure is
  only the moved `PLN`. Any other failure is a bug, not an expectation to
  update. Commit: `docs(example-invoice): carry PLN through |unit (#323)`.

## Task 7: Documentation

**Files:** listed per step. The drift test lives in
`packages/visimark/test/eval/display-rules.test.ts`.

- [ ] **`docs/visimark-design.md` §3** — "The registry holds two entries"
  becomes three; add the `unit` paragraph and example after `nbsp`; reword "A
  display rule mixed with a unit in the same span is `UNIT`" to name `percent`
  and exempt `unit`; add `unit` to the accepted-types sentence. Add the
  display-rules table with header `| Rule | Accepts | Renders | Example seed | Request |`
  and rows `percent` (#297), `nbsp` (#305), `unit` (#323). State that `|unit`
  compares byte for byte and that the number and unit may wrap at a line end.
- [ ] **Drift test** — in `display-rules.test.ts`, read
  `docs/visimark-design.md` (path resolved as `test/lang/reference-docs.test.ts`
  resolves it), find the table whose header row is the one above, and assert
  its first-column names (backticks stripped) equal `Object.keys(DISPLAY_RULES)`.
- [ ] **§3 / §21** — the "invoice's `**23300.00**<!--vmark=lines.net_total--> PLN`
  is unaffected" passage now cites the `|unit` form; say a plain decoration
  may use any unit spelling (`m^2`, `1/s`) and keeps it.
- [ ] **§10** — `TYPE` row: "any value with a unit" becomes "any value with a
  unit, except under `unit`, which instead refuses a value without one";
  `UNIT` row: "a display rule shares a span with a unit" becomes "`percent`
  shares a span with a unit"; `STALE` row unchanged.
- [ ] **`docs/design/algebraic-unit-maps-on-names-spec.md`** — §5.4 and the §7
  non-goal bullet each get a one-line note: superseded by #323, with a link to
  the new spec. Its §4 `TYPE` row stays (it is still true for `percent`/`nbsp`).
- [ ] **`docs/cli-reference.md`** — the finding table's `TYPE`/`STALE`/`UNIT`
  wording matches §10; the `ANCHOR` row is unchanged.
- [ ] **`docs/tutorial.md`** — update the two `TYPE` message literals (lines
  ~1407 and ~1465); add a section "### A figure with its unit: add `|unit`"
  after the `|nbsp` section: the invoice sentence before and after, a `fmt`
  session, and a findings table (`TYPE` on a dimensionless value; `STALE` for
  a missing, wrong or `$` unit; the `UNIT`-versus-`STALE` contrast on a plain
  anchor). Note that the pair may wrap.
- [ ] **`CHANGELOG.md`** — under `## Unreleased` → `### Added`: the `|unit`
  rule; and one line that plain decorations now read `m^2` and `1/s` instead
  of `fmt` stripping them.
- [ ] **`editors/vscode/CHANGELOG.md`** — under `## Unreleased`: a `|unit`
  anchor is no longer flagged as an unknown display rule, and a missing or
  wrong unit in one is a fixable `STALE`.
- [ ] **`docs/vocabulary-catalogue.md`** — move the #323 row out of section E
  into the Shipped register as `UNRELEASED`: `Name` `\|unit display rule`,
  `Kind` `language`, `Request` #323, `Landed` this PR (#326), `Released` `—`,
  `Decision` the deciding comment. Update the "… shipped, and … landed"
  sentence under section E.
- [ ] **Playground** — `bun run --filter visimark build:playground` and commit
  `docs/vendor/` if it changed; the bundle-size ceiling test must still pass.
- [ ] **Not changed, by decision:** `.github/ISSUE_TEMPLATE/` (no new finding
  code, precision variant or exit code), `docs/ci.md`, `docs/releasing.md`,
  `docs/issue-runbook.md`, `README.md`.
- [ ] Run `bun run gen:docs` and `bun run gen:mcp` one last time and the full
  local checks. Commit: `docs: |unit display rule (#323)`.
