# The `simulate` command — feature spec

**Status:** approved (#259) · **Date:** 2026-10-02 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/259#issuecomment-5958948249

## 1. Purpose

[#258](https://github.com/michal-niedzwiedzki/visimark/issues/258) gave a
document two declarations it cannot act on by itself: a `lattice STEP` clause
on a `param`, the spacing at which a sweep visits the param's declared domain,
and `report NAME [OPTIONS]` statements, the readings of that sweep a sheet
wants printed ([`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md)).
`check` validates both and runs neither. That spec hands two questions to this
one: **which questions a sweep asks**, and **what each of the five shipped
reports computes and prints** (its §3.3 and §7).

This spec adds the command that runs them, `visimark simulate`. It reads a
document, asks it every question its lattices declare, evaluates each one
in-process exactly as `eval --scenario` would, and prints each sheet's reports.
It writes nothing.

**The session that motivated it**, against the current build:

```console
$ visimark simulate docs/example.md
visimark: unknown command `simulate`
```

exit `2`, with the usage banner on stderr. Today the only way to read a sweep
is a script that writes one scenario file per point and calls `eval --scenario`
once for each, then parses the outputs. That costs a process per point, and the
reading lives outside the document that declares it.

**Why the current surface does not reach it.** `eval --scenario` answers one
question. `check`, `fmt` and `eval` evaluate a sheet once, at its defaults, by
#258's own rule (§5 there). No command reduces across evaluations.

## 2. The surface

```text
visimark simulate FILE... [--fail-on-fault] [--progress]
```

| Token | Meaning |
|---|---|
| `FILE...` | One or more Markdown files, read in argument order. At least one. |
| `--fail-on-fault` | Exit `1` if any report sheet, in any file, cannot start (§3.4). Faulted *questions* (§3.2) do not count. |
| `--progress` | Write a progress line to stderr while questions are evaluated (§3.6). |

There are no short forms. `simulate` accepts no other option. It is refused in
the same way as every other command
([`refuse-unrecognised-and-misplaced-cli-options-spec.md`](refuse-unrecognised-and-misplaced-cli-options-spec.md)):

| Invocation | stderr | Exit |
|---|---|---|
| `simulate --json f.md` | `visimark: simulate has no --json mode` | `2`. A `USAGE` envelope goes to stdout, as for every refusal under `--json` |
| `simulate --get x f.md` | `visimark: --get is only valid with eval` | `2` |
| `simulate --scenario s.json f.md` | `visimark: --scenario is only valid with eval` | `2` |
| `simulate --fail-on-faults f.md` | ``visimark: unknown option --fail-on-faults — did you mean `--fail-on-fault`?`` | `2` |
| `simulate #plan f.md` | `visimark: #plan is only valid with explain` | `2` |
| `check --progress f.md` | `visimark: --progress is only valid with simulate` | `2` |
| `eval --fail-on-fault f.md` | `visimark: --fail-on-fault is only valid with simulate` | `2` |
| `simulate` (no file) | `usage: visimark simulate FILE... [--fail-on-fault] [--progress]` | `2` |

The usage line above is the one `simulate --help` prints, and it joins the
banner `visimark --help` prints:

```text
  visimark simulate FILE... [--fail-on-fault] [--progress]
```

## 3. The machine contract

### 3.1 Questions

A **lattice param** is a `param` that declares a `lattice` clause. Its
**points** are those defined in #258 §3.1. They are computed in exact decimal,
starting at the lower end.

A **question** sets every lattice param in the document to one of its points,
and holds every other param at its default. The **grid** is the Cartesian
product of all lattice params' points. **Grid order** walks the lattice params
in the order their declarations appear in the document, with the last
changing fastest. Grid questions are numbered `1…N` in that order.

The **base** is the question with every param at its default. It is always
asked first, even when it coincides with a grid point. It is labelled `base`
and is never counted in `N`.

A document with no lattice param has an empty grid (`N = 0`) and asks only the
base. The grid is per file and shared by every report sheet in it. Each
question is evaluated once, whichever sheets read it.

A question is evaluated as `eval --scenario` evaluates the same values. The
graph, the rounding and the assertions are the same. Stored cells, anchors and
artifacts are never read as inputs and never written.

### 3.2 Feasible, infeasible, faulted

| A question is | When |
|---|---|
| **faulted** | Some `assert` in the document cannot be verified in it, or some scalar named by a `REF` in any of the file's reports has no value in it. Division by zero at a grid point is the common case. |
| **feasible** | It is not faulted, and every `assert` in the document holds. |
| **infeasible** | It is not faulted, and at least one `assert` is false. |

A document with no `assert` makes every question that is not faulted feasible.

### 3.3 Output

stdout carries the reports and nothing else. For each file that has at least
one `report` statement, in argument order:

```text
==> FILE <==
```

`FILE` is the path as given. A blank line separates two files' sections, then
a line `---`, then another blank line. Nothing is printed before the first
header or after the last section. The header is printed even when only one
file is named.

Inside a file, each sheet that has a `report` statement is printed in document
order. It starts with a line `#sheet`, followed by each of its reports in
statement order. A report starts with a blank line, then the statement as
written in the document with its whitespace runs collapsed to single spaces,
then a blank line, then its body (§4). Every body line is indented two spaces.

A file with no `report` statement prints nothing on stdout.

**Numbers** print at the width their binding writes at
([§7](../visimark-design.md#7-numeric-semantics)). That is the declared
`precision`, otherwise the width derived from the formula, otherwise the
canonical decimal. A percent param prints as a percent at its width
(`0.05` at `precision 2` prints `5%`). A delta is signed: `+` above zero, `-`
below, and no sign at zero. A name with a unit is followed by its bracket,
`plan.margin [EUR]`, as `eval` prints it.

**Names.** A lattice param is named by its bare name. If two lattice params in
the file share a bare name, both use `sheet.name`. A `REF` is printed as
written in the `report` line. An assertion is keyed by its source text after
`assert`, with whitespace runs collapsed.

**A question in prose** prints as its lattice params' values in grid order,
`hours=20 disc=10%`. The base prints as `base`.

**Tables** align each column to its widest cell. Text is left-aligned, numbers
are right-aligned, and columns are separated by two spaces. Trailing
whitespace is trimmed.

### 3.4 Sheets that cannot start

A report sheet **cannot start** when `check` on the file reports an
error-class finding on one of that sheet's `report` statements, or on a
binding that one of its `REF`s reads. `STALE`, `ASSERT`, `ARTIFACT` and
`COVERAGE` do not count: simulate recomputes everything, writes nothing, and
treats a false assertion as a reading. If any `param` in the file has a
lattice finding (#258 §4.1), or a `DOMAIN` finding on a lattice param, the
grid cannot be built and **every** report sheet in the file cannot start.

A sheet that cannot start prints its `#sheet` heading on stdout, followed by
the single line `  (cannot start)`. On stderr it prints one line, built from
the first blocking finding in `check`'s order. `sheet.name` is the
finding's location, and it is left out along with its space when the finding
names no binding, giving `CODE: message`:

```text
simulate: FILE: #sheet cannot start: CODE sheet.name: message
```

When more than one finding blocks, the line ends `(and N more; run visimark check FILE)`.

### 3.5 stderr

stderr carries, in this order for each file:

1. `simulate: FILE: N questions (k lattice params)`, written before any
   question is evaluated. `N` counts the base, so it is the grid size + 1. A
   file with no `report` statement is not evaluated and prints
   `simulate: FILE: no report statement` instead.
2. Progress lines, under `--progress` only (§3.6).
3. One `cannot start` line per blocked sheet (§3.4), in document order.
4. `simulate: FILE: R of S sheets ran in T`, where `S` is the file's report
   sheets and `T` is the wall time the file took, from reading it to its last
   report: `412 ms` below a second, `3.4 s` below a minute, `2 min 05 s`
   above.

After the last file, when more than one file was named:
`simulate: R of S sheets ran across F files in T`, `T` covering the whole run.

`T` is the only thing in the output that differs between two runs of the same
commit, and it is on stderr only. It describes the run, not the document, so
constraint 4 ([§2](../visimark-design.md#2-constraints-that-shaped-the-design))
is unaffected. Reports are not timed one by one: every report sheet reads the
same answers, each question evaluated once, so a per-report time would be
almost entirely shared work.

An unreadable file prints `visimark: cannot read FILE` in its place, and the
other files are still processed.

### 3.6 `--progress`

When stderr is a terminal, a single line `simulate: FILE: question i of N` is
rewritten in place with `\r` after each question, and cleared when the file
finishes. When stderr is not a terminal, a line is printed at each tenth of
`N` (the first question `i` at which `floor(10·i/N)` increases) and at the
last question. There is no rate and no time estimate; the elapsed time comes
once, on the summary line (§3.5). Without `--progress`, no progress is
written.

### 3.7 Exit codes

| Condition | Exit | stdout | stderr |
|---|---|---|---|
| Every report sheet that could start has printed, whatever its assertions found | `0` | the reports | counts and summaries |
| As above, with some sheet unable to start, no `--fail-on-fault` | `0` | reports, plus `(cannot start)` under each blocked heading | the `cannot start` lines |
| As above, with some sheet unable to start, under `--fail-on-fault` | `1` | as above | as above |
| No named file has a `report` statement | `1` | nothing | `no report statement` per file |
| A file cannot be read, no file is given, or an option is refused | `2` | nothing for that file (a `USAGE` envelope for a `--json` refusal) | the `visimark:` line |

With several files the worst code wins, as for every command: `2` outranks
`1`, and `1` outranks `0`. A file without a `report` statement, among files
that have one, does not make the run exit `1`. Faulted and infeasible
questions never change the exit code. They are readings.

`--json` is not a mode of this command, so no JSON shape is defined.

## 4. The reports

All five read the same set of evaluated questions. `N` is the grid size,
excluding the base.

| Report | Prints |
|---|---|
| `ledger` | One row per question, base first, then `1…N`. Columns: `question`, each lattice param, `feasible` (`yes`, `no`, `faulted`). |
| `ledger assertions broken` | As `ledger`, plus a `broken` column listing the false assertions' keys, joined with `; `. It is blank when none is false. |
| `deltas on REF, …` | For each `REF` in the order written: the line `REF  base V`, then `low` and `high` lines. Each shows the lowest or highest value over the grid's questions that are not faulted, its signed delta from base in parentheses, and the first question in grid order that reaches it. |
| `deltas` (no `on`) | As above for every scalar of the report's own sheet that is not a param, in document order. |
| `gates` | A line `N questions`, then one row per `assert` in document order. Columns: `assert`, `holds`, `fails`, `faulted` (counts over the grid), `base` (`holds`, `fails`, `faulted`), and `first failure` (the first grid question in which it is false, blank if none). |
| `best scalar REF direction max\|min` | The winning question in prose, then `REF  V  (Δ against base)`, then `chosen from N questions`. The candidates are the grid's questions that are not faulted. |
| `… among feasible` | Candidates are the feasible questions only. The last line reads `chosen from F feasible of N questions`. |
| `forbidden` | One line per lattice-param point at which every grid question is infeasible or faulted, in grid order: `NAME = V  every question with it breaks an assertion`. Then `I of N questions are infeasible`. With no such point, the first line reads `nothing is forbidden`. |

**Ties.** `best`, `low` and `high` take the first question in grid order. When
more than one question reaches the winning value, `best` adds the line
`T questions tie; the first in grid order is shown`.

**Empty cases.** These are readings, so the exit code is unchanged.

| Case | Body |
|---|---|
| `best … among feasible` with no feasible question | `no feasible question` |
| `best`, `deltas` with every grid question faulted | `no question evaluated` |
| `deltas` on a REF that never changes | `low` and `high` both equal base, with delta `0.00` at that width, and the first question shown |
| any report on a file with no lattice param (`N = 0`) | `ledger` prints only the base row. `gates` prints `0 questions` with the counts at `0` and `base` filled in. `deltas`, `best` and `forbidden` print `no grid: no param declares a lattice` |

## 5. Behaviour table and acceptance

A new fixture, `packages/visimark/test/fixtures/simulation/simulate.md`,
is held to a transcript test, `packages/visimark/test/simulate-acceptance.test.ts`,
written in the style of `test/simulation-acceptance.test.ts`. Only the clean
fixture is committed, and each variant is generated in memory from it.

````markdown
# Simulate fixture

```vmark #plan
param hours precision 0 integer in [0, 20] lattice 10 = default 10
param disc  precision 2 in [0%, 10%] lattice 5% = default 0%
rate precision 2 = 100.00
cost precision 2 = hours * rate
price precision 2 = 1500.00 * (1 - disc)
margin precision 2 = price - cost
assert margin >= 0
assert hours <= 15

report ledger assertions broken
report deltas on plan.margin
report gates
report best scalar plan.margin direction max among feasible
report forbidden
```
````

`check` on the fixture exits `0` with no finding. The grid is
`hours ∈ {0, 10, 20}` × `disc ∈ {0%, 5%, 10%}`, which is nine questions plus
the base (`hours=10 disc=0%`). `margin` is `1500.00·(1 − disc) − 100.00·hours`.

**1. Clean run.** `visimark simulate simulate.md` exits `0`. stdout is exactly:

```text
==> simulate.md <==
#plan

report ledger assertions broken

  question  hours  disc  feasible  broken
  base         10    0%  yes
  1             0    0%  yes
  2             0    5%  yes
  3             0   10%  yes
  4            10    0%  yes
  5            10    5%  yes
  6            10   10%  yes
  7            20    0%  no        margin >= 0; hours <= 15
  8            20    5%  no        margin >= 0; hours <= 15
  9            20   10%  no        margin >= 0; hours <= 15

report deltas on plan.margin

  plan.margin  base 500.00
    low   -650.00  (-1150.00)  hours=20 disc=10%
    high  1500.00  (+1000.00)  hours=0 disc=0%

report gates

  9 questions
  assert       holds  fails  faulted  base   first failure
  margin >= 0      6      3        0  holds  hours=20 disc=0%
  hours <= 15      6      3        0  holds  hours=20 disc=0%

report best scalar plan.margin direction max among feasible

  hours=0 disc=0%
  plan.margin  1500.00  (+1000.00 against base)
  chosen from 6 feasible of 9 questions

report forbidden

  hours = 20  every question with it breaks an assertion
  3 of 9 questions are infeasible
```

stderr is exactly:

```text
simulate: simulate.md: 10 questions (2 lattice params)
simulate: simulate.md: 1 of 1 sheets ran
```

**2. Further cases**, each a variant of the fixture:

| # | Invocation or variant | stdout | stderr | Exit |
|---|---|---|---|---|
| 2 | case 1 with `--fail-on-fault` | as case 1 | as case 1 | `0` |
| 3 | `docs/example-invoice.md` (no `report`) | empty | `simulate: docs/example-invoice.md: no report statement` | `1` |
| 4 | `simulate.md docs/example-invoice.md` | case 1's section only, with no `---` | case 1's lines, `…: no report statement`, `simulate: 1 of 1 sheets ran across 2 files` | `0` |
| 5 | `simulate.md simulate.md` | case 1's section twice, separated by a blank line, `---` and a blank line | each file's lines, then `simulate: 2 of 2 sheets ran across 2 files` | `0` |
| 6 | variant: `report deltas on plan.marginn` | `==> simulate.md <==`, `#plan`, `  (cannot start)` | count line, ``simulate: simulate.md: #plan cannot start: UNDEF: unknown name `plan.marginn` ``, `simulate: simulate.md: 0 of 1 sheets ran` | `0` |
| 7 | case 6 with `--fail-on-fault` | as case 6 | as case 6 | `1` |
| 8 | variant: `lattice 3` on `hours` (does not reach 20) | as case 6 | `…: #plan cannot start: TYPE plan.hours: lattice step 3 does not reach the end of [0, 20]: 20 is not a multiple of 3 above 0` | `0` |
| 9 | variant: add `per_hour precision 2 = margin / hours` and `assert per_hour >= 0` | the ledger's rows `1`–`3` read `faulted`. `gates` gains a `per_hour >= 0` row whose `faulted` is `3`. `best … among feasible` reads `hours=10 disc=0%`, `plan.margin  500.00  (0.00 against base)`, `chosen from 3 feasible of 9 questions` | as case 1 | `0` |
| 10 | variant: every `lattice` clause removed | the ledger shows the base row only. `gates` shows `0 questions`. `deltas`, `best` and `forbidden` each print `no grid: no param declares a lattice` | `simulate: simulate.md: 1 questions (0 lattice params)`, `…: 1 of 1 sheets ran` | `0` |
| 11 | variant: `assert margin >= 2000` | every row is infeasible. `best … among feasible` prints `no feasible question`. `forbidden` lists `hours = 0`, `hours = 10`, `hours = 20`, `disc = 0%`, `disc = 5%`, `disc = 10%` | as case 1 | `0` |
| 12 | `--progress`, stderr not a terminal | as case 1 | the count line, then `simulate: simulate.md: question i of 10` for `i` = 1…10, then the summary | `0` |
| 13 | `simulate nope.md` | empty | `visimark: cannot read nope.md` | `2` |
| 14 | `simulate nope.md simulate.md` | case 1's section | `visimark: cannot read nope.md`, case 1's lines, `simulate: 1 of 1 sheets ran across 2 files` | `2` |
| 15 | every refusal in §2's table | as listed | as listed | `2` |

In case 9 the base is `hours=10`, where `per_hour` is defined, so the base
stays feasible. In case 10 the count line reads `1 questions`. The noun is
not inflected; this keeps the line's shape fixed for a grep.

**3. One evaluation per question.** A unit test counts evaluations on the
fixture and asserts exactly 10 for one file, however many reports read them.

**4. The showcase transcript.** The example document of §7.1 quotes its own
`simulate` output in a `console` block. A test runs `simulate` on the document
and asserts that block byte for byte, so the example cannot drift from the
tool.

## 6. Compatibility

| Surface | Before | After |
|---|---|---|
| `check`, `fmt`, `infer`, `eval`, `explain`, `ref` | — | Unchanged. They also refuse `--fail-on-fault` and `--progress` with exit `2`, as they refuse any option they do not own. |
| `docs/ci.md` workflows, `.github/workflows/dogfood.yml` | run `check` | Unchanged. No job calls `simulate`. |
| `action.yml` | `command` described as "check or fmt", forwarded as given | Behaviour unchanged. The description reads "check, fmt or simulate". `args: --fail-on-fault` reaches `simulate` through the existing `args` input. |
| a script calling `visimark simulate` | exit `2`, `unknown command` | runs |
| `remark-lint-visimark`, `markdownlint-rule-visimark`, LSP / VS Code | run `check` | Unchanged |
| `visimark-mcp` | serves the six commands | Unchanged. It does not gain a `simulate` tool (§9). |

Nothing breaks. The change is reversible until the release that ships it.
After that release, removing the command is a usage break for its callers.

## 7. Interaction with the rest of the tooling

- **Evaluation.** Each question uses the scenario path `eval --scenario` uses.
  A lattice point is always a legal scenario value, since #258 checks the step
  against `precision` and the domain, so no `SCENARIO` fault can arise. The
  file is read and parsed once, and every question is evaluated in the same
  process.
- **`check`.** It decides which sheets can start (§3.4). It does not run the
  sweep, and its exit code is unchanged.
- **`eval --scenario`.** This stays the one-question interface. A `simulate`
  value and an `eval --scenario` value for the same question are equal.
- **Writes.** None. No cell, anchor, stamp or artifact is touched. A `chart`
  in a report sheet is not redrawn per question.
- **Release workflow, review workflow.** Unchanged.
- **What does not change.** The language: no statement, finding or grammar is
  added, and #258's contract is consumed as is.

### 7.1 The showcase example

A new example document, `docs/example-battery-storage.md`, models a
grid-scale battery energy storage project as lenders see one. It exists to
show everything this command and the rest of the tool can do in one real
document. It must:

- check clean with `visimark check`, and be listed in `docs/examples/examples.json`
  and on the examples site page, like the existing examples;
- declare its levers as `param`s with units, domains and lattices. It has at
  least three lattice params: for example power rating `[MW]`, duration `[h]`,
  merchant price spread `[EUR/MWh]` and degradation per year. The grid stays
  in the hundreds of questions, so the transcript test runs in seconds;
- derive energy capacity, annual throughput, revenue, opex, debt service with
  `PMT`, and project returns with `NPV` and `IRR`, carrying units through the
  arithmetic;
- state lender covenants and physical limits as `assert`s: a minimum
  debt-service cover ratio, an end-of-life state of health, a grid connection
  limit, and a maximum gearing;
- bind headline figures in prose with anchors, and declare at least one
  `chart`;
- carry all five reports, with the options they take, across at least two
  report sheets, so both multi-sheet output and a shared grid are shown;
- quote its own `simulate` transcript, held by §5 item 4, and explain in prose
  what each report shows a credit committee.

## 8. Documentation to update

The plan's final task covers each of these.

| File | Change |
|---|---|
| `packages/visimark/src/cli/main.ts` usage banner | the `simulate` line of §2 |
| `docs/cli-reference.md` | a command row, the two option rows, the per-command options table, the exit-code text for `simulate` |
| `README.md` | the command table row. The MCP sentence ("every command as a tool") becomes "every command except `simulate`". |
| `docs/visimark-design.md` | the §11 command list, and §20 / §4 where they say what reports compute "belongs to the `simulate` command": link this spec instead |
| `docs/ci.md` | a new chapter in Part 5, "Running the simulations in CI". It covers `simulate` as a published reading (job summary, `--fail-on-fault`, `--progress` in logs, exit codes unlike `check`'s). Every chapter after it is renumbered. The "How to read this" table and every internal "chapter N" reference are corrected, which also fixes the existing out-of-order chapter 29. The Action `command` input row is updated. A troubleshooting row is added. The example goes into "Where to go next". |
| `docs/tutorial.md` | a new chapter 31, "Simulation: sweeping the parameters", in Part 8. It covers `lattice`, `report`, and running `simulate`, using the tutorial's runway example. Chapters 31–33 renumber to 32–34, and every cross-reference to them in `docs/` and `README.md` is corrected. |
| `docs/mcp.md`, `docs/mcp-server.md` | "every command" becomes "every command except `simulate`" |
| `action.yml` | the `command` description |
| `docs/example-battery-storage.md`, `docs/examples/examples.json`, the examples site page | the new example (§7.1) |
| `CHANGELOG.md` | `## Unreleased` → `### Added`: the `simulate` command and the example |
| `docs/vocabulary-catalogue.md` | the #259 row moved to the Shipped register as `UNRELEASED` |

## 9. Non-goals

- **`--json`.** Not a mode of this command. A machine-readable twin of the
  reports waits for a caller that needs one.
- **A `visimark-mcp` tool.** This becomes a follow-up issue, and the docs say
  so in the meantime.
- **Question sources other than the lattice grid.** Table rows as named
  scenarios, and a `files` statement, would change what a document means.
  Each needs its own language row.
- **A per-sheet grid.** One grid per file is shared by every report sheet.
- **A point-count cap or ceiling option.** The count is printed before the
  run, and the caller decides.
- **Time estimates, rates, or parallel evaluation.**
- **New report names or options.** The closed list is #258's, and it grows
  through its own catalogue row.
- **Writing a report back into the document.**

## 10. Open questions

None.

How the pre-review's open questions closed (see the discussion summary on #259):

| # | Question | Closed as |
|---|---|---|
| 1 | exit code when the only sheet cannot start | `0`, an always-on stderr summary, `--fail-on-fault` for `1` (§3.7) |
| 2 | usage exit | `2`; `--json` refused with its own message (§2) |
| 3 | `--progress` stream | stderr, no short form (§3.6) |
| 4 | one file or many | `FILE...`, with headers and `---` separators (§3.3) |
| 5 | question sources | the document's lattice grid plus the base (§3.1); other sources are non-goals |
| 6 | acceptance | §5, written out literally |
| 7 | `action.yml` | description updated; `args` already forwards flags (§6) |
| 8 | output layout across files | §3.3 |

<!--vmark:no-formulas-->
