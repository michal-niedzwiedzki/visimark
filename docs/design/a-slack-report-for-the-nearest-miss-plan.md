# `report slack` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `report slack`, a sixth built-in `report` that prints, for each `assert`, the smallest room among feasible grid questions and the smallest miss among questions that fail only that assertion.

**Architecture:** The parser accepts one new option-less name. `check` keeps the two sides of each top-level comparison on its `AssertionResult`, along with the comparison's §7 width. `simulate` copies them per question into `Answer.sides`. `report/simulate.ts` gains a `slack` renderer that reads them. `check-reports.ts` gains the static "nothing to read" rule. No other surface reads the new fields.

**Tech Stack:** TypeScript, Bun (`bun test`), decimal.js.

**Spec:** [`a-slack-report-for-the-nearest-miss-spec.md`](a-slack-report-for-the-nearest-miss-spec.md)

## Global Constraints

- Every commit carries the `Co-Authored-By:` trailer for this session from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md).
- Every printed byte is exactly the spec's §3.4 and §6. Do not reword a sentence.
- `eval --json`, `explain`, the MCP server and the other five report bodies stay byte-identical (spec §6.4). `publicAssertions` is not touched.
- No new dependency and no new public export from `packages/visimark/src/index.ts`.
- Run `bun run format` and `bun run lint` before every push.
- After each task, run `bun test`, `bun run typecheck` and `bun run build` from the repo root.

---

### Task 1: The name

**Files:**

- Modify: `packages/visimark/src/lang/ast.ts`. Add `"slack"` to the end of `REPORT_NAMES`, and add `| { kind: "slack" }` to `ReportOptions`.
- Modify: `packages/visimark/src/lang/parser.ts`. Add `slack: null` to `REPORT_SYNOPSIS`. The existing `{ kind: name }` fallthrough builds the options.
- Modify: `packages/visimark/src/report/simulate.ts`. Add a `case "slack"` to `body()`, which returns `[]` until Task 4.
- Modify: `packages/codemirror-visimark/src/tokenize.ts`. Add `"slack"` to `WORDS.reportAtoms`.
- Test: `packages/visimark/test/lang/report.test.ts`.

**Interfaces:** `ReportName` gains `"slack"`.

- [ ] **Step 1:** Write the tests first:
  - `report("report slack").options` equals `{ kind: "slack" }`, and `.text` is `"report slack"`.
  - `fails("report slack among all").message` is `` "`report slack` takes no options" ``.
  - Change the existing unknown-report expectation to `` "unknown report `foo`; the reports are ledger, deltas, gates, best, forbidden, slack" ``.

  Run them and watch them fail.
- [ ] **Step 2:** Make the four edits above, then run `bun test` (including `packages/codemirror-visimark/test/tokenize-drift.test.ts`). Commit as `feat(lang): accept report slack`.

### Task 2: `check` refuses a `slack` with nothing to read

**Files:**

- Modify: `packages/visimark/src/eval/check-reports.ts`. Add the rule beside the `deltas` rule.
- Test: `packages/visimark/test/report-nothing-to-read.test.ts`. Add cases there.

**Interfaces:** The rule emits this finding on the report's span, with `sheetId: report.sheetId`:

```ts
{ code: "TYPE", message: "`report slack` has nothing to read: this document has no `assert`" }
```

It fires when `report.options.kind === "slack"`, no sheet has `assertions.length > 0`, and no sheet has `droppedLines`.

- [ ] **Step 1:** Write the tests:
  - A file whose only block is `#r` with `report slack` gives exactly that `TYPE`, and `check` exits `1`.
  - The same file plus a sheet with `assert 1 >= 0` gives no finding.
  - The same file plus a line that fails to parse in another sheet gives no nothing-to-read finding.
  - `simulate` on the no-`assert` file prints `#r` and `  (cannot start)`.

  Watch them fail.
- [ ] **Step 2:** Implement the rule. Run the tests and commit as `feat(check): report slack with no assert is TYPE`.

### Task 3: Keep the sides of a comparison

**Files:**

- Modify: `packages/visimark/src/eval/check-state.ts`. Extend `AssertionResult`.
- Modify: `packages/visimark/src/eval/check.ts`. Change `evalAssertion`'s `record`.
- Modify: `packages/visimark/src/eval/simulate.ts`. Extend `Answer` and `Simulation.assertions`.
- Test: `packages/visimark/test/eval/assertion-sides.test.ts` (new).

**Interfaces:**

```ts
// check-state.ts
export type ComparisonOp = "<" | "<=" | ">" | ">=" | "==";
export interface AssertionSides {
  left: Value;
  right: Value;
  /** max of the two sides' §7 widths; null when either side derives none */
  width: number | null;
}
export interface AssertionResult {
  // …existing fields…
  /** the top-level operator when the expression is one comparison (never `!=`) */
  comparison?: ComparisonOp;
  /** both sides as evaluated; present only when `comparison` is set and `holds` is not null */
  sides?: AssertionSides;
}

// simulate.ts
export interface Answer { /* … */ sides: (AssertionSides | undefined)[]; }
// Simulation.assertions entries gain: comparison: ComparisonOp | undefined
```

- `comparison` is set from `a.expr`: `type === "binary"` and `op` is one of the five operators. The AST has no parenthesis node, so `(x < 3)` is covered.
- `sides` is computed in `record` when `holds !== null && comparison`. The left side is `evalExpr(expr.left, scalarEnv(node))`, and the right side is the same for `expr.right`. `width` is `derivePrecision` of each side with `(ref) => refPrecision(a.sheetId, ref)`. Both widths must be numbers to give their max; otherwise `width` is `null`. The two evaluations sit inside the existing `try` block, so they cannot add a finding. If either throws, `sides` is omitted.

- [ ] **Step 1:** Write the tests:
  - On `docs/simulate/conference.md`, `check(...)`'s three assertions carry `comparison` `<=`, `>=`, `<=`. Their sides are `250`/`300`, `6975.00`/`0` and `0.333`/`0.5`, and their widths are `0`, `2` and `3`.
  - `assert x != 9` and `assert a and b` have no `comparison`.
  - `assert x / 4 > 0.25` has width `null`.
  - A date comparison keeps date-valued sides.
  - `publicAssertions` output for conference.md is deep-equal to a snapshot taken before the change (`eval --json` byte-identical).

  Watch them fail.
- [ ] **Step 2:** Implement the `check` side. In `simulate()`, add `sides: r.assertions.map((a) => a.sides)` to each answer and `comparison: a.comparison` to each `assertions` entry. Run `bun test` and commit as `feat(eval): keep both sides of a comparison assertion`.

### Task 4: The renderer

**Files:**

- Modify: `packages/visimark/src/report/simulate.ts`. Add `slack(v: View): string[]` and update the module comment to "six".
- Create: `packages/visimark/test/fixtures/simulation/slack.md`, exactly spec §6.2's fixture.
- Create: `packages/visimark/test/slack-acceptance.test.ts`, in the style of `test/simulate-acceptance.test.ts`.

**Interfaces:** `slack(v)` returns body lines. `renderSheet` already indents them by two spaces, so the block lines carry their own extra two.

Algorithm for each assertion `i`, in `sim.assertions` order:

1. **No grid.** If `gridSize === 0`, return `[NO_GRID]` for the whole report, once.
2. **Key.** Push `key`.
3. **Not a comparison.** If `comparison` is undefined, push `  no single boundary` and continue.
4. **Not numeric.** If any answer (base included) has `sides[i]` whose `left.t` or `right.t` is not `"num"`, push `  not a numeric comparison` and continue.
5. **Pools.**
   - `inside`: grid answers where `v.feasible(a)` and `sides[i]` is set.
   - `outside`: grid answers that are not faulted, where `holds[i] === false` and every other `holds[j] === true`, and `sides[i]` is set.
6. **Distances.** Per the spec §3.2 table, use `Decimal` `minus` (and `abs` for `==`).
7. **Winners.** Take the first minimum in grid order, then `T` is the count of candidates whose distance `.eq()` the minimum.
8. **Formatting.** Format with `w = sides.width` from the winner (static, so any answer's is the same). Use `d.toFixed(w)` when `w !== null && d.decimalPlaces() <= w`, and `d.toString()` otherwise.
9. **Rows.**
   - Build `["inside ", "room", D, prose]` and `["outside", "miss", D, prose]` for the non-empty pools.
   - For `==`, never build the inside row.
   - Lay out the rows with `table(rows, [false, false, true, false])`. Each row is pushed in pool order: inside, then outside.
   - An empty pool pushes its literal sentence line instead, in the same position: `inside   no feasible question` (only when the operator is not `==`) or `outside  no question fails only this assertion`.
   - Each line is prefixed with two spaces.
10. **Tie lines.** Then the tie lines (`  T questions tie inside; …`, then outside), when `T > 1`.
11. **Count line.** Then `  from ${F} feasible and ${O} failing only this, of ${N} questions`, where `F` and `O` are the pool sizes.

The rows and the sentence lines interleave in pool order, so lay out only the rows as one table, then splice each sentence into its slot.

- [ ] **Step 1:** Write `slack-acceptance.test.ts`. Each expected stdout is copied verbatim from the spec:
  - The clean fixture's stdout equals spec §6.2's block, and the exit code is `0`.
  - The no-feasible variant (append `assert x > 5`) equals spec §6.3's first block.
  - The fault variant (`q precision 2 = 1 / (x - 1)`, `report best scalar s.q direction max among all`) has an `x / 4 > 0.25` block equal to spec §6.3's second block.
  - The no-lattice variant prints `  no grid: no param declares a lattice`.
  - `report slack among all` gives `check` exit `1` with the synopsis `TYPE`.
  - Two `report slack` lines give `DUP`.
  - `assert (x < 3)` gives the same rows under key `(x < 3)`.
  - `docs/simulate/conference.md` (after Task 5's edit) ends `#readings` with spec §6.1's block.

  Watch them fail.
- [ ] **Step 2:** Implement `slack`. Iterate until every test passes. Do not change an expected string to match the output. A mismatch is a bug in the code or a hand-computation error in the spec. If it is the spec, stop and tell the maintainer. Commit as `feat(simulate): report slack`.

### Task 5: The guide's document

**Files:**

- Modify: `docs/simulate/conference.md`. Append `report slack` to `#readings`.

- [ ] **Step 1:** Append the line. Then run `bun run packages/visimark/src/cli/main.ts check docs/simulate/conference.md`, which must report 0 problems, and `simulate`, which must match spec §6.1. The Task 4 conference test turns green. Commit as `docs: conference.md reads report slack`.

### Task 6: Documentation

**Files:**

- `docs/visimark-design.md`:
  - §3: add `slack` to the `report` bullet's name list.
  - §10: in the `TYPE` row, add the nothing-to-read message for `slack` beside the `deltas` one.
  - §11: in the `simulate` paragraph, change "five" to "six" and name `slack`.
- `docs/design/add-a-simulate-command-spec.md`:
  - §4: "All five read…" becomes "All six read…", and add a table row for `slack` that points to the slack spec.
  - §9: the "New report names" non-goal notes that #352 added `slack` through its own row.
- `docs/design/lattice-on-param-and-report-statements-spec.md` §2.2: the name list.
- `docs/simulate.md`:
  - Chapter 12 title becomes "The six reports, and the question each answers", with a `slack` entry.
  - Chapter 18's passage saying `best` does not say how much room is left points to `slack`.
  - Chapter 23 shows the `report slack` reading. It says that the report lands on `attendees=100 ticket=80.00 sponsors=2`, and that the guide's `200/60.00/3` is one of the three tied questions.
  - Add a checklist line to chapter 26.
  - Every transcript of the `#readings` sheet gains the `slack` body.
- `docs/tutorial.md`: the "five reports" and "all five reports" passages.
- `docs/cli-reference.md`: the `simulate` row (the report list) and the `TYPE` row.
- Run `bun run gen:docs` to regenerate `docs/simulate.html` and `docs/tutorial.html`, and any other generated page that `git status` shows changed.
- `CHANGELOG.md`, under `## Unreleased` → `### Added`: `` `report slack` — for each `assert`, the smallest room among feasible questions and the smallest miss among questions that fail only that rule (#352). ``
- `editors/vscode/CHANGELOG.md`: one line saying `report slack` is no longer flagged as an unknown report.
- `docs/vocabulary-catalogue.md`: move the `report slack` row out of section E into the Shipped register as `UNRELEASED`. Condense it to that table's columns: `Name` `report slack`, its `Kind`, `Request` #352, `Landed` this PR, `Released` `—`, and `Decision` the deciding comment.

- [ ] **Step 1:** Make the edits. Then run `check` on every Markdown file you touched, plus `bun test`, `bun run typecheck`, `bun run build`, `bun run format:check` and `bun run lint`. Commit as `docs: report slack`.

<!--vmark:no-formulas-->
