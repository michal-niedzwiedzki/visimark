# The `simulate` command — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** `visimark simulate FILE... [--fail-on-fault] [--progress]` asks every question a document's lattices declare, plus the base, once each and in one process. It prints the five shipped reports for every report sheet, exactly as specified, and writes nothing. The tutorial and the CI guide teach it, and a battery-storage showcase example demonstrates it under a transcript test. Per [`add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md).

**Architecture:**
- **Evaluation.** A new evaluation module, `packages/visimark/src/eval/simulate.ts`, owns the simulation. It enumerates the grid, using a new `latticePoints` beside `analyzeLattice` in `lang/lattice.ts`, and decides which report sheets can start from one `check` of the file. It then evaluates the base and every grid question through the scenario path (`build` → `applyScenario` → `check`), keeping only what reports read: scalar values and widths, each assertion's `holds`, and the faulted flag.
- **Rendering.** A new reporting module, `packages/visimark/src/report/simulate.ts`, renders the five reports as plain text lines from that result. It does no evaluation itself.
- **Report options.** The parser already validates each report's options but keeps only `refs` and `text`. `ReportDecl` and `Report` gain a structured `options` field, so the renderer never re-parses text.
- **Command.** `cmdSimulate` in `cli/commands.ts` wires files, streams, exit codes and progress.
- **Progress.** `CliIO` gains `errTTY` and `errRaw` so the `\r` path is testable.

**Tech Stack:** TypeScript; `decimal.js`; Bun test runner; engine package `packages/visimark`. No new dependency.

**Spec:** [`docs/design/add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md)

## Global Constraints

- Work on branch `issue/259-add-a-simulate-command-impl`. Use one PR (#329, already open as a draft); do not open a second.
- Every commit ends with the `Co-Authored-By` trailer resolved from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the work. Do not hardcode a vendor name into this plan or copy a trailer from another plan.
- **No language change.** No new statement, finding code, grammar or message in `check`. `check`, `fmt`, `infer`, `eval`, `explain` and `ref` print byte-for-byte what they printed before on every `docs/example-*.md`. Capture their output before Task 1, and diff it after every task. The one exception is the new refusals of `--fail-on-fault` and `--progress` on those commands.
- **Exact text.** Every stdout and stderr line is the spec's (§2, §3, §4, §5). Where the spec writes a literal transcript, the test asserts it byte for byte.
- **No writes, no clock.** `simulate` never calls a writer or reads `Date`, `performance` or a timer. Grep for that in Task 6.
- **One evaluation per question.** The file is read and parsed once per file argument. Each question builds its own model from the same `locate` result and is checked once (spec §5 item 3).
- **The CLI rule.** `--json` stays an accepted token for the six existing commands only. `simulate --json` is refused with `visimark: simulate has no --json mode` and a `USAGE` envelope.
- **Runtime parity** ([`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md)). The published `bin` is unchanged. Any new install or run snippet for a published command is written in both `npm i -g`/`bun add -g` and `npx`/`bunx` forms, except where a doc is single-runner by design (`docs/ci.md` stays `npx`).
- After each task, run `bun test`, `bun run typecheck`, `bun run build` and `bun run lint` from the repo root. Also run `bun run packages/visimark/src/cli/main.ts check` on every `docs/example-*.md`, the new fixture, and the new example once they exist. Loop check → fix → check until green. Never use `bunx visimark`, which runs the published build, not this branch.

## Review Focus

These are inputs the spec implies but the tasks' own tests may not reach. Each has a test in the task named.

1. **A lattice param on document scope**, outside any sheet, appears in the grid under its bare name. Task 4.
2. **Two lattice params with one bare name** on different sheets print as `sheet.name` in every report. Task 5.
3. **A default off the lattice** (`in [0, 20] lattice 10 = default 7`) still makes the base `hours=7`, and the base is never a numbered row. Task 4.
4. **A report sheet whose REF reads a scalar from another sheet.** That sheet is blocked only by findings in its own REFs' dependency closure. A `TYPE` finding on an unrelated sheet's binding does not block it. Task 4.
5. **A percent REF** (a scalar with a `|percent` display, or a percent param) prints in `deltas`/`best` at its write width as a decimal. Only *lattice params* print as percents (spec §3.3). Task 5.
6. **`--progress` with `N = 1`** (no lattice) prints exactly one progress line. Task 6.

---

### Task 1: the command name, options and usage

**Files:**
- Modify: `packages/visimark/src/report/json.ts` (`CommandName`)
- Modify: `packages/visimark/src/cli/args.ts`
- Test: `packages/visimark/test/cli/args.test.ts` (extend; create if the args tests live elsewhere, after a grep for `parseArgs(`)

**Interfaces:**
- `CommandName` gains `"simulate"`.
- `USAGE.simulate = "usage: visimark simulate FILE... [--fail-on-fault] [--progress]"`.
- `OPTIONS["--fail-on-fault"] = { commands: ["simulate"], value: false }` and `OPTIONS["--progress"] = { commands: ["simulate"], value: false }`.
- `--json` keeps `commands: ALL`, but `ALL` stays the six existing commands, and `parseArgs("simulate", ["--json", …])` returns the refusal `visimark: simulate has no --json mode` with `json: true`. This is checked before the generic `only valid with` branch, so the message is the spec's and not `--json is only valid with check`.
- `maxFiles` stays `Infinity` for `simulate`.

- [ ] **Step 1: Write the failing tests.** One `parseArgs` case per row of spec §2's refusal table:
  - `simulate --json f.md`, with message `visimark: simulate has no --json mode` and `json === true`;
  - `simulate --get x f.md` → `visimark: --get is only valid with eval`;
  - `simulate --scenario s.json f.md` → `visimark: --scenario is only valid with eval`;
  - `simulate --fail-on-faults f.md` → the did-you-mean message;
  - `simulate #plan f.md` → `visimark: #plan is only valid with explain`;
  - `check --progress f.md` → `visimark: --progress is only valid with simulate`;
  - `eval --fail-on-fault f.md` → `visimark: --fail-on-fault is only valid with simulate`.

  Positive cases: `simulate a.md b.md --fail-on-fault --progress` parses to two files and both flags. `usageLine("simulate")` is the spec's line.
- [ ] **Step 2: Run them and confirm they fail.** `bun test packages/visimark/test/cli` fails.
- [ ] **Step 3: Implement it.** Add `"simulate"` to `CommandName`, the `USAGE` entry, the two `OPTIONS` entries, and the `--json` special case for `simulate`. Fix every exhaustive `Record<CommandName, …>` or `switch` the type checker then flags. Grep `CommandName` and give each new key the `simulate` value the spec implies, never a placeholder.
- [ ] **Step 4: Re-run until green.** Also run the full suite: the refusals of existing commands must be unchanged.
- [ ] **Step 5: Commit.** `feat(cli): simulate command name, options and refusals`.

### Task 2: lattice points

**Files:**
- Modify: `packages/visimark/src/lang/lattice.ts`
- Test: `packages/visimark/test/lang/lattice.test.ts` (extend)

**Interfaces:**
- `latticePoints(input: LatticeInput): string[]` returns the canonical decimals, ascending. It calls `analyzeLattice`, and on `ok` builds the list `first, first + step, …, last` (`count` entries) in exact decimal. On a fault it throws: callers only reach it for params whose lattice `check` passed.

- [ ] **Step 1: Write the failing test.** One case per row of #258 spec §3.1's table that has points:
  - `[0%, 10%] lattice 1%` → 11 points, `"0"` … `"0.1"`;
  - `integer in [3, 83] lattice 20` → `3, 23, 43, 63, 83`;
  - `in (0, 10) lattice 5` → `["5"]`;
  - `positive in [0, 10] lattice 5` → `["5", "10"]`;
  - `in [3, 3] lattice 1` → `["3"]`;
  - `integer in [-10, 10] lattice 5` → `-10, -5, 0, 5, 10`.

  For each, `latticePoints(...).length === analyzeLattice(...).count`. Fault rows throw.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it**, with no float arithmetic.
- [ ] **Step 4: Run it until green.**
- [ ] **Step 5: Commit.** `feat(lang): enumerate a lattice's points`.

### Task 3: structured report options

**Files:**
- Modify: `packages/visimark/src/lang/ast.ts` (`ReportDecl`), `packages/visimark/src/lang/parser.ts` (`parseReport`), `packages/visimark/src/model/types.ts` (`Report`), `packages/visimark/src/model/build.ts`
- Test: `packages/visimark/test/lang/parser.test.ts` (or the file that already tests `parseReport`; grep `report best`)

**Interfaces:**

```ts
export type ReportOptions =
  | { kind: "ledger"; assertionsBroken: boolean }
  | { kind: "deltas"; on: Ref[] }                 // empty: every non-param scalar of the sheet
  | { kind: "gates" }
  | { kind: "best"; scalar: Ref; direction: "max" | "min"; amongFeasible: boolean }
  | { kind: "forbidden" };
```

`ReportDecl.options: ReportOptions` and `Report.options: ReportOptions` carry the same `Ref` objects as `refs`, so spans and `check-reports.ts` are untouched.

- [ ] **Step 1: Write the failing test.** Parse each of the five synopsis forms, with and without its optional words, and assert `options`. Keep the existing malformed-option messages (#258 §4.2): parse one malformed line per report name, and assert the error text is unchanged.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it.** Build `options` where `parseReport` already walks the tokens, and copy it through `build.ts`.
- [ ] **Step 4: Run it until green.** `simulation-acceptance.test.ts`, the #258 transcript, must stay green unchanged.
- [ ] **Step 5: Commit.** `refactor(lang): keep a report's parsed options`.

### Task 4: the simulation engine

**Files:**
- Create: `packages/visimark/src/eval/simulate.ts`
- Create: `packages/visimark/test/fixtures/simulation/simulate.md` (the spec §5 fixture, verbatim)
- Test: `packages/visimark/test/eval/simulate.test.ts`

**Interfaces:**

```ts
export interface LatticeParam { id: string; name: string; label: string; percent: boolean; precision: number; points: string[]; info: ParamInfo }
export interface Question { index: number | "base"; values: Map<string, string> }  // param id → canonical decimal
export interface Answer {
  question: Question;
  scalars: Map<string, Value>;            // every scalar binding id → value (absent if unevaluated)
  holds: (boolean | null)[];              // one per assertion, document order
  faulted: boolean;
}
export interface Blocked { sheetId: string; first: Finding; more: number }
export interface Simulation {
  params: LatticeParam[];                 // grid order
  gridSize: number;                       // N, excluding the base
  reportSheets: string[];                 // document order
  blocked: Blocked[];                     // a subset of reportSheets
  assertions: { sheetId: string; key: string }[]; // document order, key = source after `assert`, whitespace collapsed
  scalarPrecision: Map<string, number>;   // from the base check
  units: Map<string, string>;             // id → formatted unit bracket text, from the base check
  answers: Answer[];                      // [base, 1…N]; empty when every sheet is blocked
}
export function planSimulation(source: string, path: string): Omit<Simulation, "answers"> & { questions: Question[] };
export function simulate(source: string, path: string, opts?: { onQuestion?: (i: number, n: number) => void; evaluate?: (model: DocModel) => CheckResult }): Simulation;
```

- `label` is the bare name, or `sheet.name` when two lattice params share a bare name (spec §3.3).
- `evaluate` defaults to `check`. Tests inject a counting wrapper.
- **Blocking** (spec §3.4). Run one `check` on the unmodified model. Take its error-class findings, ignoring `STALE`, `ASSERT`, `ARTIFACT`, `COVERAGE`, `WARN` and `NOTE`.
  - Any lattice finding blocks every sheet. That is a `TYPE` or `PRECISION` finding whose `name` is a lattice param, or a `DOMAIN` finding on a lattice param.
  - Otherwise a sheet is blocked by a finding on one of its `report` spans, or by a finding on a binding in the dependency closure of its REFs. Compute that closure with `dependencies()` from `eval/graph.ts`, walked transitively. `deltas` with no `on` uses every non-param scalar of its sheet.
  - `first` is the first such finding in `check`'s order, and `more` counts the rest.
- **Faulted** (spec §3.2): some `holds` is `null`, or some REF of any report in the file (with `deltas`'s implicit scalars) has no value.
- Questions are built in grid order: the last param changes fastest. The base uses `listParams` defaults. Each question gets a fresh `build(located)` from one `locate(source)`, then `applyScenario`, then `evaluate`.

- [ ] **Step 1: Write the failing tests.**
  - On the fixture: `gridSize === 9`; the params are `hours` then `disc`; question 7 is `{hours: "20", disc: "0"}`; base `{hours: "10", disc: "0"}`; the counting `evaluate` is called exactly 10 times (spec §5 item 3).
  - Answers: question 9 has `margin = -650.00`, and `holds` is `[false, false]`.
  - Case 9 variant (generated in memory): questions 1–3 are faulted, base is not.
  - Case 6 variant: `blocked[0].first.code === "UNDEF"`, `answers` is empty.
  - Case 8 variant: blocked by the `TYPE` lattice finding.
  - Review Focus 1, 3 and 4 as their own cases.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** Hold nothing per question but `Answer`. Drop each model after its check, so memory stays flat on a large grid.
- [ ] **Step 4: Run them until green.**
- [ ] **Step 5: Commit.** `feat(eval): simulate a document's lattice grid`.

### Task 5: the five reports

**Files:**
- Create: `packages/visimark/src/report/simulate.ts`
- Test: `packages/visimark/test/report/simulate.test.ts`

**Interfaces:**
- `renderSheet(sim: Simulation, sheetId: string, reports: Report[]): string[]` returns the `#sheet` line and every report's lines (spec §3.3).
- `renderBlocked(sheetId: string): string[]` returns `["#sheet", "  (cannot start)"]`.
- Helpers, which are not exported unless a test needs them:
  - `table(rows: string[][], numeric: boolean[]): string[]`: pads columns to the widest cell, left-aligns text and right-aligns numbers, uses two-space gaps, and trims the right edge.
  - `num(id, value)`: the value at its write width.
  - `param(p, value)`: as a percent when `p.percent`, at width `p.precision - 2`, and otherwise at `p.precision`.
  - `delta(d, width)`: signed, `+`/`-`, no sign at zero.
  - `prose(q)`: `hours=20 disc=10%`, or `base`.
- The rules are spec §4: ties, the empty cases, and `no grid: no param declares a lattice`.

- [ ] **Step 1: Write the failing tests.**
  - On the fixture's `Simulation` (from Task 4), assert each report's lines equal the spec §5 case 1 transcript, block by block.
  - Variants 9, 10 and 11 each get their own expected lines. Write them out in full in the test from the spec's description, and work them out by hand before running.
  - Review Focus 2 and 5.
  - A tie case: add `assert disc >= 0%` and `report best scalar plan.cost direction min` → `hours=0 …` with `3 questions tie; the first in grid order is shown`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement it.** Use `roundToPlaces` from `eval/value.ts` for widths. Use the unit text `eval` uses (`formatUnit`) for brackets.
- [ ] **Step 4: Run them until green.**
- [ ] **Step 5: Commit.** `feat(report): render the five simulation reports`.

### Task 6: `cmdSimulate`, the banner and progress

**Files:**
- Modify: `packages/visimark/src/cli/commands.ts` (new `cmdSimulate`), `packages/visimark/src/cli/main.ts` (dispatch, the `USAGE` banner line, `CliIO.errTTY` / `CliIO.errRaw`)
- Test: `packages/visimark/test/simulate-acceptance.test.ts`

**Interfaces:**
- `cmdSimulate(args, out, err, tty: { isTTY: boolean; raw: (s: string) => void }): number`.
- `runCli` passes `io.errTTY ?? process.stderr.isTTY === true` and `io.errRaw ?? ((s) => process.stderr.write(s))`.
- The banner gains `  visimark simulate FILE... [--fail-on-fault] [--progress]`, placed after `explain`.

- [ ] **Step 1: Write the failing acceptance test.** It follows the style of `simulation-acceptance.test.ts`, with a `run(args, {tty})` helper. One `test` per row of spec §5, cases 1–15:
  - case 1: the stdout and stderr literals, verbatim;
  - cases 3–5: two-file runs against `docs/example-invoice.md` and the fixture twice;
  - case 12: `--progress` non-TTY lines;
  - a TTY case: `errRaw` receives `\r`-prefixed `simulate: simulate.md: question i of 10` writes and a final clear (`\r` + spaces + `\r`). No progress lines go through `err`.
  - Every refusal in spec §2's table, by `runCli`, with exit codes. `simulate --json` also emits one `USAGE` JSON envelope on stdout.
  - Review Focus 6.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it.**
  - Read each file in argument order. On a read failure, write `visimark: cannot read FILE` to stderr, record exit `2`, and continue.
  - A file with no `report` gets `no report statement` and no evaluation.
  - Otherwise:
    1. Write the count line.
    2. Run `simulate` with `onQuestion` driving progress, at every tenth off a TTY and every question on one.
    3. Write `==> FILE <==` (preceded by `""`, `---`, `""` when not first) and each report sheet's lines in document order.
    4. Write the `cannot start` lines, using `describeFinding` from `report/format.ts` for the message and `sheet.name` from the finding's location when it names a binding.
    5. Write the summary line.
  - With more than one file, write the total line.
  - Exit codes: 2 beats 1 beats 0; `1` when no file had a report, or under `--fail-on-fault` when any sheet was blocked.
- [ ] **Step 4: Run it until green.** Then grep `packages/visimark/src/eval/simulate.ts packages/visimark/src/report/simulate.ts` and `cmdSimulate` for `Date`, `performance`, `setTimeout`, `writeFile` and `nodeWriter`. Expect no hit.
- [ ] **Step 5: Commit.** `feat(cli): visimark simulate`.

### Task 7: the showcase example — battery storage project finance

**Files:**
- Create: `docs/example-battery-storage.md`
- Create: `docs/charts/example-battery-storage-*.svg` (via `fmt`, which draws the declared charts)
- Modify: `docs/examples/examples.json` (a card: slug `battery-storage`, tags `Project finance`, `Simulation`, `Units`, and a teaser), then `bun run gen:examples`, which writes `docs/examples/battery-storage/index.html`
- Test: `packages/visimark/test/example-battery-storage.test.ts`

The document is a lender's model of a grid-scale battery storage project (spec §7.1). Model it carefully. Every figure must be one a credit analyst would recognise, and every simplification must be stated in the prose. The required structure follows; the exact constants are chosen while writing it.

| Sheet | Contents |
|---|---|
| `#levers` | `param`s with units, domains and lattices. Power `[MW]` `integer in [40, 100] lattice 20` (4 points). Duration `[h]` `integer in [1, 4] lattice 1` (4). Merchant spread `[EUR/MWh]` `in [60, 120] lattice 20` (4). Annual degradation, a percent, `in [1.5%, 3.5%] lattice 1%` (3). Gearing, a percent, `in [60%, 80%] lattice 10%` (3). That gives 576 grid questions. Defaults are chosen so `check` is clean, and the base sits inside the feasible region. Fixed assumptions (cycles per day, depth of discharge, round-trip efficiency, capacity payment `[EUR/MW]`, capex per MW and per MWh, opex, debt rate, tenor, discount rate, grid connection limit) are plain scalars with units. |
| `#asset` | Energy capacity `[MWh]`, usable energy, annual throughput, end-of-life state of health, and capex, with units carried through. |
| `#cashflow` | A year table, years 0–N, with column rules. The year-0 row holds capex, and later rows hold revenue on a degrading capacity minus opex. It has `NPV`, `IRR`, and a `chart` of the flows. |
| `#debt` | Debt as gearing × capex, annual debt service from `PMT`, CFADS, and the minimum DSCR. |
| `#credit` | Covenants and limits as `assert`s: `dscr_min >= 1.30`, `soh_eol >= 70%`, `power <= grid_limit`, `gearing <= 75%`. These are chosen so that the grid shows real trade-offs and `forbidden` names at least one point (power 100 over the grid limit; degradation 3.5% under the SoH floor). It carries `report gates`, `report ledger assertions broken` and `report forbidden`. |
| `#returns` | `report best scalar returns.irr direction max among feasible`, `report best scalar returns.npv direction max among feasible`, `report deltas on returns.npv, debt.dscr_min`, and `report deltas` with no `on` over its own scalars. |

The prose explains, for a credit committee, what each report shows and why the sweep belongs in the document. Headline figures (capex, base IRR, base minimum DSCR) are anchored. The full `simulate` transcript is quoted in a `console` block.

`report ledger` over 576 questions is long, but that is the point: it is the complete case ledger. The transcript quotes the whole stdout. If that makes the page unreadable, put the ledger in its own `#ledger` report sheet, and quote that section inside a `<details>` element. The test still asserts the full transcript.

- [ ] **Step 1: Write the failing test.** Run `simulate docs/example-battery-storage.md` through `runCli`. Extract the document's `console` block that starts with `$ visimark simulate example-battery-storage.md`, and assert that its stdout and stderr lines equal the run's output, byte for byte. Also assert that `check` on the document exits `0`.
- [ ] **Step 2: Write the document.** Write the inputs and rules, run `bun run packages/visimark/src/cli/main.ts fmt docs/example-battery-storage.md` to fill the computed cells, anchors and charts, and check it clean. Run `simulate`, read every report, and tune the constants until the readings tell a coherent story: a feasible region, a forbidden edge, a clear best case, and a binding covenant. Then paste the transcript.
- [ ] **Step 3: Add the card and regenerate.** Add the `examples.json` card, and run `bun run gen:examples` and `bun run gen:docs`.
- [ ] **Step 4: Run it until green.** Include the suite's example and site tests (`test/examples.ts`, `test/site`).
- [ ] **Step 5: Commit.** `docs: battery storage showcase example for simulate`.

### Task 8: the tutorial chapter

**Files:**
- Create: `docs/tutorial/runway-sweep.md` (a copy of `docs/tutorial/runway.md` with `lattice` clauses on two or three of its params, a `#sweep` sheet carrying reports, and asserts)
- Modify: `docs/tutorial.md`; the regenerated `docs/tutorial.html` (`bun run gen:docs`)
- Test: extend the tutorial transcript test if one exists (grep `tutorial/runway.md` under `packages/visimark/test`). Otherwise add `packages/visimark/test/tutorial-sweep.test.ts`, which asserts the chapter's `simulate` block against a run.

- [ ] **Step 1: Write chapter 31, "Simulation: sweeping the parameters", in Part 8 after chapter 30.**
  - It covers: why a sweep, the `lattice` clause, a short recap of the #258 rules and the `TYPE` refusals, and the five `report` statements.
  - It runs `visimark simulate` with a real transcript and reads each report.
  - It covers `--progress`, `--fail-on-fault`, and the exit codes, which differ from `check`'s on purpose.
  - It notes what simulate does not do (no writes, no `--json`, no cap), and links the battery example as the large worked case.
  - Match the tutorial's voice and chapter length.
- [ ] **Step 2: Renumber.** Chapters 31–33 become 32–34. Fix the "How to read this" table, the Part 8 introduction (which names its chapters), line 45 ("chapter 31") and line 1424 ("The capstone (chapter 31)"). Fix every other "chapter 3[1-3]" reference to the tutorial in `docs/` and `README.md`, which a grep confirms.
- [ ] **Step 3: Regenerate and test.** Run `bun run gen:docs` and the tests until green.
- [ ] **Step 4: Commit.** `docs(tutorial): chapter 31, simulation`.

### Task 9: the CI guide chapter

**Files:**
- Modify: `docs/ci.md`; the regenerated `docs/ci.html`

- [ ] **Step 1: Write the new chapter, "Running the simulations in CI", at the end of Part 5 (after "Reading values out of a document in CI").**
  - It covers: what `simulate` is for in CI (a published reading, not a gate); its exit codes against `check`'s; `--fail-on-fault` as the one gate it offers; `--progress` in a CI log (off a TTY: a line per tenth); and writing the reports to `$GITHUB_STEP_SUMMARY` inside a fenced block.
  - It includes an Action example (`command: simulate`, `args: --fail-on-fault`) and an `npx --yes visimark@<version> simulate` `run:` example. Pin the version the rest of the guide pins.
- [ ] **Step 2: Renumber the whole guide cleanly.** Every chapter after the new one moves up by one, and the existing out-of-order "29. The MCP server" takes its sequential place. Update the "How to read this" table (chapter ranges per part) and the "There are N short chapters in seven parts" sentence. Fix every internal "chapter N" / "Chapter N" reference to the new numbers. Two chapters (`remark`, `markdownlint`) and the MCP chapter sit between Parts 6 and 7 without a part heading. Put them in Part 6, which is where the table's "Other runners" description fits.
- [ ] **Step 3: Update the rest of the guide.** The inputs table's `command` row becomes `check`, `fmt` or `simulate`. Add a troubleshooting row: `simulate` exits `1` with `no report statement` → the glob reached documents with no `report`; name the files that have one. Add the battery example to "Where to go next".
- [ ] **Step 4: Regenerate and test.** Run `bun run gen:docs` and the tests until green.
- [ ] **Step 5: Commit.** `docs(ci): simulate chapter; renumber the guide`.

### Task 10: documentation

**Files:**
- Modify: `docs/cli-reference.md`, `README.md`, `docs/visimark-design.md`, `docs/mcp.md`, `docs/mcp-server.md`, `action.yml`, `CHANGELOG.md`, `docs/vocabulary-catalogue.md`
- Regenerate: `bun run gen:docs`, `bun run gen:mcp` (the MCP skill embeds the CLI reference; check whether its output changed)

- [ ] **Step 1: `docs/cli-reference.md`.**
  - A `visimark simulate FILE...` row in the commands table: reads the files you name, writes nothing, and fails the run when no file has a `report`, or when a sheet cannot start under `--fail-on-fault`.
  - `--fail-on-fault` and `--progress` rows in the options table.
  - A `simulate` row in the per-command options table: `FILE...`, `--fail-on-fault`, `--progress`, and no `--json`.
  - The exit-code table's `1` and `2` rows name `simulate`'s cases.
  - The `--json` row's command list stays the same six.
- [ ] **Step 2: `README.md`.** Add the command table row. Change "every command as a tool" to "every command except `simulate`".
- [ ] **Step 3: `docs/visimark-design.md`.** Add `visimark simulate FILE... [--fail-on-fault] [--progress]` to the §11 command list, with one sentence and a link to the spec. In line 305 (§4) and the §20 lattice bullet, replace "belongs to the `simulate` command" with a link to [`design/add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md).
- [ ] **Step 4: `docs/mcp.md`, `docs/mcp-server.md`.** Change "every command" to "every command except `simulate`". Then ask the maintainer whether to file the follow-up issue for a `visimark-mcp` `simulate` tool. Filing it is outward-facing, so do it only on a yes.
- [ ] **Step 5: `action.yml`.** The `command` description becomes `"visimark subcommand to run: check, fmt or simulate"`.
- [ ] **Step 6: `CHANGELOG.md`.** Under `## Unreleased` → `### Added`, add:
  - "`visimark simulate FILE... [--fail-on-fault] [--progress]` runs the questions a document's lattices declare and prints its `report` statements' readings (#259)";
  - "A battery storage project-finance example that sweeps 576 scenarios (#259)".
  - No `editors/vscode/CHANGELOG.md` entry: the extension's surface is unchanged.
- [ ] **Step 7: `docs/vocabulary-catalogue.md`.** Move the #259 row out of section F's table into the Shipped register as `UNRELEASED`. Use that table's columns: `Name` `` `simulate` command ``, `Kind` `tooling`, `Request` `[#259](…)`, `Landed` `[#329](…)`, `Released` `—`, `Decision` the deciding comment. Drop the prose columns.
- [ ] **Step 8: Check the issue templates.** Grep `.github/ISSUE_TEMPLATE/` for a list of commands; add `simulate` wherever one is enumerated. The grep on 2026-10-02 found none, so confirm that and move on.
- [ ] **Step 9: Regenerate and run the full checks.** Run `bun run gen:docs` and `bun run gen:mcp`, then `bun test`, `bun run typecheck`, `bun run build`, `bun run lint`, `bun run format:check`, and `check` on every `docs/example-*.md`.
- [ ] **Step 10: Commit.** `docs: simulate in the CLI reference, README, design, MCP docs, Action, changelog and catalogue`.

<!--vmark:no-formulas-->
