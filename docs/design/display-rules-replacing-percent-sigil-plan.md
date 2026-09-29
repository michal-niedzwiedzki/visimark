# Display rules, replacing the `%` sigil — implementation plan

**Spec:** [`docs/design/display-rules-replacing-percent-sigil-spec.md`](display-rules-replacing-percent-sigil-spec.md)

## Goal

Replace the shipped `%` anchor-comment sigil with `|percent`, a named
**display rule** drawn from a new closed registry, exactly as the spec
defines it — no chaining, no arguments, `percent` as the sole entry. Every
call site that currently branches on `RawAnchor.percent` is renamed to a
registry lookup on `RawAnchor.displayRule`; every `%`-specific message and
design-doc passage generalises to "a display rule."

## Architecture

- **`packages/visimark/src/eval/display-rules.ts`** (renamed from
  `percent-display.ts`) becomes the registry module: the `DisplayRule`
  interface, the closed `DISPLAY_RULES` map, and `percent`'s implementation
  (the existing `percentDisplay` function, unchanged, plus `isPercentText`
  which stays as `percent`'s own helper — not a registry-wide concept, since
  only `percent` needs it and the spec defers a rule-agnostic version).
- **`parse/document.ts`** owns the grammar (`ANCHOR_RE`) and the parsed field
  (`RawAnchor.displayRule?: string`).
- **`eval/check.ts`** and **`eval/check-report.ts`** own every finding this
  issue touches (`ANCHOR` unknown-name and undelimited-seed, `TYPE`, `UNIT`,
  the unchanged `PRECISION`). `matchesStored` is explicitly **not** touched
  — see Task 2.
- **`write/fmt.ts`** owns rendering the display-rule's output into the span
  `document.ts` already locates — no new locator logic (spec §2).

## Tech Stack

Existing: TypeScript, Bun test runner, the repo's own `visimark` CLI for
acceptance sessions. No new dependency.

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer this session's
  attribution rule (`.agents/rules/ai-attribution.md`) resolves to — do not
  hardcode a vendor name.
- `bun test`, `bun run typecheck`, and `bun run build` must be green after
  every task, not just at the end.
- No behaviour change to `percentDisplay`'s rendering (× 100 at precision −
  2, leading `-`, trailing `%`) — this issue is a syntax and mechanism swap,
  not a rendering change.
- `eval`, `explain`, `--json`, `infer --write`, table-cell write-back, and
  every CLI option are untouched (spec §5) — no task here should need to
  touch `cli/`, `eval/eval.ts`, `eval/explain.ts`, or `infer/`, beyond the one
  `infer/write.test.ts` assertion in Task 5.

---

## Task 1: Registry and grammar

- [ ] Rename `packages/visimark/src/eval/percent-display.ts` to
      `display-rules.ts`. Add the `DisplayRule` interface and the closed
      `DISPLAY_RULES: Readonly<Record<string, DisplayRule>>` map with one
      entry, `percent: { accepts: (v) => v.t === "num", render: percentDisplay }`
      (spec §2). Keep `percentDisplay` and `isPercentText` exported from this
      file unchanged.
- [ ] Update `parse/document.ts`:
  - `ANCHOR_RE` (line ~152-153) gains capture group 3 for `\|name` in place
    of the `(%)?` group (spec §2, exact regex given there).
  - `RawAnchor.percent?: true` (line ~102-103) → `RawAnchor.displayRule?:
    string`, populated from capture group 3 where present.
  - The malformed-anchor message in `model/build.ts:387-388` updates from
    `` `<!--vmark=sheet.name%-->` `` to `` `<!--vmark=sheet.name|rule-->` ``
    (spec §4).

**Files:** `packages/visimark/src/eval/percent-display.ts` (rename),
`packages/visimark/src/parse/document.ts`, `packages/visimark/src/model/build.ts`

**Interfaces:** `DisplayRule`, `DISPLAY_RULES` (new, exported from
`display-rules.ts`); `RawAnchor.displayRule?: string` (replaces `.percent?:
true`)

**Steps:**
1. Write the new `display-rules.ts` (rename + registry), update its one
   existing import site (`eval/percent-display.js` → `eval/display-rules.js`
   in `check.ts` and `write/fmt.ts`).
2. Update `ANCHOR_RE` and `RawAnchor`.
3. Update the malformed-anchor message.
4. Run `bun run typecheck` — every now-broken `.percent` reference across
   `check.ts`, `check-report.ts`, `fmt.ts` surfaces as a compile error; that
   is the exhaustive list for Tasks 2-3 below (confirmed against source: five
   call sites — `check-report.ts:98`, `check.ts:746,811`, `fmt.ts:123,126,130`
   — do not rely on this list alone if the compiler finds more).

## Task 2: Evaluation and errors

- [ ] In `check.ts`, replace the `percentMine` block (lines ~746-790) with
      display-rule-aware logic, keeping its position and evaluation order
      (still gated on the binding's own expression evaluating successfully —
      spec §4):
  - Filter anchors by `a.displayRule !== undefined`.
  - **Unknown name**: `a.displayRule` not a `DISPLAY_RULES` key → `ANCHOR`,
    message `` `unknown display rule `${a.displayRule}`` `` (spec §4 table).
  - **Undelimited seed**: `a.value.kind === "text"` → `ANCHOR`, message
    `"a display rule needs a delimited seed — wrap a placeholder instead,
    such as **_**"` (spec §4 table). This is a **new** check — today's code
    has no equivalent, since `%` never restricted its seed shape beyond the
    base numeric/date/string rule #298 already applies.
  - **Wrong type**: `!DISPLAY_RULES[a.displayRule].accepts(v)` → `TYPE`,
    message `"a display rule is only legal on a value it accepts (percent:
    numeric only)"` (replaces `"a % sigil is only legal on a numeric
    scalar"`).
  - **Precision floor**: unchanged logic, scoped to `a.displayRule ===
    "percent"` specifically rather than every display rule (spec §4 — the
    `PRECISION` message and its `prec < 2` condition are unchanged).
  - **Unit clash**: unchanged detection (`parseDecorated` "both-sides" or
    unit-bearing), message `"cannot mix a unit with a display rule"`
    (replaces `"cannot mix a unit with percent display"`).
- [ ] In `check.ts` line ~811-812 (`STALE` finding's `computed` field):
      `a.percent ? percentDisplay(v, prec) : ...` → look up
      `DISPLAY_RULES[a.displayRule]?.render(v, prec)` when `a.displayRule` is
      set, else the existing `applyUnit(showValue(...))` branch.
- [ ] In `check-report.ts:98`, the chart/image + percent combo: `a.percent`
      → `a.displayRule !== undefined`, and reword the message the same way
      as the Task 2 TYPE message above (this is a second emission site for
      the same generalised TYPE case — the spec's §4 table names the general
      rule; this is where it recurs).
- [ ] `matchesStored` (`check.ts` lines ~1137-1153) — **do not touch.**
      Its `PERCENT_RE` fold is not gated on `a.percent`/`a.displayRule`; it
      makes `check` treat percent-shaped prose as matching a stored ratio on
      *any* numeric anchor, sigil or not — confirmed load-bearing for
      `docs/tutorial.md`'s "check compares numbers, not spellings" lesson
      (resolved in review: keep it, scope the rest of this issue to the
      rendering path only). The only change near this function is the
      caller at `check.ts:802`, which is unaffected in its own logic — it
      already just calls `matchesStored(v, text, prec)` and does not
      branch on `a.percent` itself.

**Files:** `packages/visimark/src/eval/check.ts`,
`packages/visimark/src/eval/check-report.ts`

**Interfaces:** none new — consumes `DISPLAY_RULES` from Task 1

**Steps:** as bulleted above, in order; run `bun test packages/visimark/test/eval/check.test.ts` after each finding-message change to catch a stale assertion immediately rather than at the end.

## Task 3: Write-back

- [ ] In `fmt.ts`:
  - `sigilBlocked` (line ~100-104) stays keyed by finding, unaffected in
    shape — only its consumer at line ~123 changes.
  - Line ~123: `if (a.percent && sigilBlocked.has(id)) continue;` →
    `if (a.displayRule && sigilBlocked.has(id)) continue;` — generalised
    (registry-agnostic: any blocking finding on the id skips the write,
    whichever rule is involved).
  - Lines ~126-128 (`wanted`): `a.percent ? percentDisplay(rounded, prec) :
    applyUnit(...)` → `a.displayRule ? DISPLAY_RULES[a.displayRule]!.render(rounded, prec) :
    applyUnit(...)`. The `!` is safe here only because the ANCHOR/TYPE checks
    in Task 2 already refused an unknown name or wrong-typed value before
    `fmt` ever reaches a `refusedAnchors`-filtered anchor (line ~113) —
    confirm this invariant holds by testing an unknown-name and a
    wrong-type case both produce **no** edit from `fmt`, not a thrown error.
  - Line ~130 (`rewrite` decision): `a.percent || isPercentText(current) ?
    current !== wanted : !matchesStored(...)` → `a.displayRule === "percent"
    || isPercentText(current) ? current !== wanted : !matchesStored(...)`.
    **Not generalised** — deliberately kept scoped to `percent` by name,
    same reasoning as `matchesStored` above: `isPercentText` is `percent`'s
    own compatibility heuristic (forcing a canonical rewrite when the prose
    already looks percent-shaped, sigil or not — the other half of the
    tutorial's "fmt is stricter" lesson), not a registry-wide concept. A
    future display rule gets its own such heuristic, or none, on its own
    request.

**Files:** `packages/visimark/src/write/fmt.ts`

**Interfaces:** none new — consumes `DISPLAY_RULES` from Task 1

**Steps:** as bulleted above; `bun test packages/visimark/test/write/fmt.test.ts` after each change.

## Task 4: Fixtures and tests

- [ ] `packages/visimark/test/fixtures/percent-display-sigil.md` → two new
      fixtures per spec §6: `display-rule-percent.md` (the passing case) and
      `display-rule-errors.md` (the four refusal cases: undelimited seed,
      unknown name, wrong type, old `%` syntax as malformed). Use the exact
      documents and expected `check`/`fmt` output given in spec §6.
- [ ] `packages/visimark/test/eval/percent-display.test.ts` → rename to
      `display-rules.test.ts`, mirroring the Task 1 source rename. Its
      existing `percentDisplay` render tests are unaffected by this issue;
      add cases for the registry itself: `DISPLAY_RULES.percent.accepts`/
      `.render`, and that an unregistered key is absent (guards the
      closed-registry property directly, independent of the ANCHOR-level
      test in `check.test.ts`).
- [ ] `packages/visimark/test/eval/check.test.ts` — every existing `%`-sigil
      test updates to `|percent` syntax and the new message text (spec §4
      table is the exhaustive list of message changes). Add cases for: an
      unknown display-rule name, an undelimited seed on a display-rule
      anchor, and the chart/image + `percent` combo (mirroring
      `check-report.ts`'s own test file if the assertion lives there instead
      — check both).
- [ ] `packages/visimark/test/parse/document.test.ts` — update `ANCHOR_RE`
      parsing tests for the new capture group; add a case for `|name` parsing
      and for the old `<!--vmark=x.y%-->` now falling through to
      `malformedAnchors`.
- [ ] `packages/visimark/test/cli/cli.test.ts` — update any CLI-level
      percent-sigil assertions to the new syntax/messages.
- [ ] `packages/visimark/test/infer/write.test.ts:59` — rename the test
      `"inserted anchors never carry a percent sigil"` to `"inserted anchors
      never carry a display rule"`; confirm the assertion checks for absence
      of `|` after an inserted anchor's sheet.name, not just absence of `%`.
- [ ] Explicitly **not in scope** (false positives from grepping `percent`
      across the tree — do not touch): `eval/scenario.ts`,
      `test/eval/scenario.test.ts`, `test/lang/param.test.ts` — these
      implement `param`'s unrelated declared-percent-domain feature (#241),
      which reuses the word "percent" for a completely different mechanism
      (`eval --scenario` value parsing). Confirm at the end of this task that
      neither file's diff (if any) touched this issue's code.

**Files:** `packages/visimark/test/fixtures/percent-display-sigil.md`
(remove), `packages/visimark/test/fixtures/display-rule-percent.md` (new),
`packages/visimark/test/fixtures/display-rule-errors.md` (new),
`packages/visimark/test/eval/percent-display.test.ts` (rename to `display-rules.test.ts`),
`packages/visimark/test/eval/check.test.ts`,
`packages/visimark/test/parse/document.test.ts`,
`packages/visimark/test/cli/cli.test.ts`,
`packages/visimark/test/infer/write.test.ts`

**Interfaces:** none new

**Steps:** work file by file, `bun test` after each; the full suite must be
green before Task 5.

## Task 5: Documentation

- [ ] `docs/visimark-design.md`:
  - Replace the `%`-specific passage at lines ~125-158 (the whole "An
    optional trailing `%`..." section) with a description of `|name` syntax,
    the closed registry, the delimited-seed requirement, and `percent` as
    the shipped example (spec §2, §4).
  - Reword the three §10 rows (current lines ~626, 631, 634 — confirm exact
    line numbers after the §3 edit above shifts them): `UNIT` and `TYPE` to
    "a display rule..." wording; `PRECISION` stays scoped to `percent` by
    name (spec §4's exact wording).
- [ ] `docs/example-executable-documentation.md` (2 sites),
      `docs/tutorial/runway.md` (1 site), `docs/tutorial/capstone.md` (1
      site): `%` → `|percent` in each anchor comment. These are the four
      documents the issue itself named.
- [ ] **`docs/tutorial.md`** — found during planning, not named in the issue
      or the spec's migration list: **nine** additional `%`-sigil anchor
      instances (lines ~740, 1337, 1347, 1381, 1385, 2500, 2551, 3062 — verify
      current line numbers, the file may have shifted) plus one error-table
      row (~line 1403, `` `%` on a date or a string | `TYPE` — `a % sigil is
      only legal on a numeric scalar` ``) documenting the old message. All
      confirmed delimited (`**...**`), so the migration is mechanical:
      `%` → `|percent` in each anchor, and the error-table row's wording and
      example update to match spec §4. Regenerate `docs/tutorial.html` via
      `bun run gen:docs` afterward — do not hand-edit the generated HTML.
  - Also reword the syntax-description prose around line ~740 ("to the end
    of the anchor name, `<!--vmark=lines.margin%-->`...") to describe `|name`
    instead.
- [ ] `docs/design/presentation-only-percent-display-sigil-spec.md` and
      `-plan.md`: prepend a short superseded notice under each header
      pointing to this issue's spec — keep the rest of both files as the
      historical record of #140, unedited otherwise.
- [ ] `CHANGELOG.md`, `## Unreleased` → `### Added`: the `|name` display-rule
      syntax and `percent`. Pair with a `### Removed` or `### Changed` entry
      naming the `%` sigil's retirement and the four (now confirmed: several
      more, see above) migrated documents, in this repo's existing entry
      style (see the `%`-sigil's own original `### Added` entry from #140
      for the style to match, and the type-aware-placeholder entry quoted at
      the top of this file for the "no longer silently X" phrasing this repo
      uses for a breaking behaviour change).
- [ ] `docs/vocabulary-catalogue.md`: move the `#297` row out of section E's
      table into the **Shipped register**, condensed to that table's columns
      (`Name` = "Display rules, replacing the `%` sigil", `Kind` = "language
      feature", `Request` = `[#297](...)`, `Landed` = this PR, `Released` =
      `—`, `Decision` = the deciding-comment URL already in the spec header).
      Status stays `UNRELEASED` until a tag ships it — do not write `SHIPPED`
      here.
- [ ] Regenerate any other build artifact CI checks on `%`/`display rule`
      content — confirm by running whatever `playground-bundle` and
      `generated-docs` CI jobs run locally (see `.github/workflows/`) before
      pushing, since PR #301 (the catalogue-only change) still triggered both
      jobs; a source change definitely will.

**Files:** `docs/visimark-design.md`,
`docs/example-executable-documentation.md`, `docs/tutorial/runway.md`,
`docs/tutorial/capstone.md`, `docs/tutorial.md`, `docs/tutorial.html`
(regenerated), `docs/design/presentation-only-percent-display-sigil-spec.md`,
`docs/design/presentation-only-percent-display-sigil-plan.md`,
`CHANGELOG.md`, `docs/vocabulary-catalogue.md`

**Interfaces:** none

**Steps:** design doc first (source of truth for wording), then the six
documents' anchor migrations, then regenerate, then CHANGELOG and the
catalogue register move, then a final full-repo grep for `vmark=.*%-->` and
`a % sigil`/`percent display` (case-sensitive) to catch anything this list
missed.

---

## Final check, every task

`bun test`, `bun run typecheck`, `bun run build` from the repo root; `bun run
packages/visimark/src/cli/main.ts check` on every document this plan touched.
Loop check → fix → check until green, per the executing-plans discipline —
do not weaken an assertion or skip a test to get there.
