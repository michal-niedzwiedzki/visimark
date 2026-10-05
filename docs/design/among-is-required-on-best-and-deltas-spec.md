# Among required on best and deltas — feature spec

**Status:** approved (#351) · **Date:** 2026-10-05 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/351#issuecomment-6004077852

An amendment to [`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md) §2.2 and §4.2 (#258), to [`add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md) §4 (#259), and to the nothing-to-read rule in [`a-bare-report-deltas-in-a-sheet-with-no-spec.md`](a-bare-report-deltas-in-a-sheet-with-no-spec.md) (#333).

## 1. Purpose

`report best` and `report deltas` rank a population of grid questions. Today the population is a silent default. Omitting `among` on `best`, and writing any `deltas`, ranks every question that is not faulted (#259 §4). The conference model shows the cost. `docs/simulate/conference.md` passes `check`, and its readings are:

````markdown
```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share
```
````

`simulate` prints a profit high of `34200.00` at `attendees=400`, the plan `forbidden` has just ruled out. The `deltas` line does not say that it ranges outside the rules. A bare `best` does the same thing: on the nine-question plan below, `report best scalar margin direction min` with no `among` ranks `hours=20 disc=10%`, margin `-650.00`, a question that fails both asserts, and prints `chosen from 9 questions`.

`among feasible` already exists on `best` and is optional. This spec makes the clause required on `best` and on `deltas`, and adds `infeasible` and `all`. `all` is today's candidate set, so a document keeps today's ranking by writing it. `ledger`, `gates`, and `forbidden` do not take the clause. A `slack` report is #352 and is out of scope.

## 2. Syntax

The clause is required and last. In [`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md) §2.2 the option grammar becomes:

| `NAME` | Options |
|---|---|
| `ledger` | `[assertions broken]` |
| `deltas` | `[on REF {, REF}] among feasible\|infeasible\|all` |
| `gates` | *(none)* |
| `best` | `scalar REF direction max\|min among feasible\|infeasible\|all` |
| `forbidden` | *(none)* |

`feasible`, `infeasible`, and `all` are contextual, recognised only as the word after `among` on these two reports, the same way `feasible` is contextual today. A scalar may still be named `all`, `feasible`, `infeasible`, or `among`. `report deltas on all among all` is a well-formed line when `all` is a scalar.

The normalized statement text, which is the `DUP` key and the heading `simulate` prints, collapses whitespace and includes the clause: `report deltas on plan.margin among all`, `report best scalar margin direction min among feasible`.

The parsed option replaces `amongFeasible: boolean` with `among: "feasible" | "infeasible" | "all"` on both `best` and `deltas`.

The line stays inside the fence, so an unmodified renderer still shows it (constraint 1, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)).

## 3. Semantics

A question is the base, or one grid point. The base is never a candidate. `N` is the grid size, excluding the base, as in #259 §4.

A grid question is **faulted** when some assert cannot be verified or some scalar named by a `REF` in any report that runs has no value (#259 §3.2). A value that is a string or a date is a value, so that question is not faulted for that reason.

| A non-faulted grid question is | When |
|---|---|
| **feasible** | Every assert holds. No assert in the document means every non-faulted question is feasible. |
| **infeasible** | At least one assert is false. |
| in the population **all** | It is not faulted. No further test. |

Faulted questions are in none of the three. A question that fails one assert and cannot verify another is faulted, so it is not infeasible.

A question **ranks** a scalar when it is in the named population and that scalar's value is a number. `F`, `I`, and `K` are counts of questions that rank. For `best` there is one scalar, so the count is the number of questions that rank it. For `deltas` the count is the number of population questions that have a number for **at least one** ref on that line. One count for the report, printed once after the last ref.

Low, high, and the winner are taken only from questions that rank that scalar. Ties take the first question in grid order (the last lattice param changes fastest). `best` adds `T questions tie; the first in grid order is shown` when `T > 1`. `deltas` does not add a tie line.

| Population | `best`, after the winner | `deltas`, after the last ref | Population empty |
|---|---|---|---|
| `feasible` | `chosen from F feasible of N questions` | `over F feasible of N questions` | `no feasible question` |
| `infeasible` | `chosen from I infeasible of N questions` | `over I infeasible of N questions` | `no infeasible question` |
| `all` | `chosen from K questions` | `over K questions` | `no question evaluated` |

The nouns are not inflected. `1 feasible of 9 questions` and `chosen from 1 questions` stay as #259 already prints them. The `all` line does not grow an `of N`, including when `K = N`.

**Empty population.** The body is that one line. No winner, no base line, no low or high.

**`deltas` when the population is non-empty.** For each ref, in order: `REF  base V`, then low and high when at least one population question ranks that ref. A ref that no population question ranks keeps the base line and omits low and high. The count line follows the last ref. The base value is printed as today, including `?` when the base value is not a number.

**No lattice.** `N = 0`. `best` and `deltas` print `no grid: no param declares a lattice` for every population, and they do not print an empty-population line. This is the check today's code already makes before it looks at `among feasible`.

**Every question faulted.** The population is empty for all three words. `among all` prints `no question evaluated`. `among feasible` prints `no feasible question`. `among infeasible` prints `no infeasible question`.

Worked on the nine-question plan (`hours` 0, 10, 20 × `disc` 0%, 5%, 10%; base `hours=10 disc=0%`; `margin = 1500.00·(1 − disc) − 100.00·hours`; asserts `margin >= 0` and `hours <= 15`). Six questions are feasible and three are infeasible. None are faulted. Every `margin` is a number, so `F = 6`, `I = 3`, `K = 9`.

| Line | Body |
|---|---|
| `best … direction max among all` | `hours=0 disc=0%`, margin `1500.00` `(+1000.00 against base)`, `chosen from 9 questions` |
| `best … direction max among feasible` | the same winner, `chosen from 6 feasible of 9 questions` |
| `best … direction max among infeasible` | `hours=20 disc=0%`, margin `-500.00` `(-1000.00 against base)`, `chosen from 3 infeasible of 9 questions` |
| `best … direction min among feasible` | `hours=10 disc=10%`, margin `350.00` `(-150.00 against base)`, `chosen from 6 feasible of 9 questions` |
| `best … direction min among all` | `hours=20 disc=10%`, margin `-650.00` `(-1150.00 against base)`, `chosen from 9 questions` |
| `deltas on margin among all` | base `500.00`; low `-650.00` at `hours=20 disc=10%`; high `1500.00` at `hours=0 disc=0%`; `over 9 questions` |
| `deltas on margin among feasible` | base `500.00`; low `350.00` at `hours=10 disc=10%`; high `1500.00` at `hours=0 disc=0%`; `over 6 feasible of 9 questions` |
| `deltas on margin among infeasible` | base `500.00`; low `-650.00` at `hours=20 disc=10%`; high `-500.00` at `hours=20 disc=0%`; `over 3 infeasible of 9 questions` |

A flat scalar, `flat precision 2 = 100.00`, with `best scalar flat direction min among feasible`: winner `hours=0 disc=0%`, value `100.00` `(0.00 against base)`, `chosen from 6 feasible of 9 questions`, then `6 questions tie; the first in grid order is shown`.

A string beside a number, `label = "east"` and `deltas on label, margin among all`: the population has nine questions, and nine of them have a number for `margin`, so the count is `over 9 questions`. `label` prints `label  base ?` and no low or high. `margin` prints the same low and high as `among all`. `best scalar label direction max among all` prints `no question evaluated`.

## 4. Type rules and errors

No new [§10](../visimark-design.md#10-error-taxonomy) code. A bad clause is the existing malformed-report `TYPE`. The synopsis strings in #258 §4.2 become:

| Report | Synopsis |
|---|---|
| `best` | `scalar REF direction max\|min among feasible\|infeasible\|all` |
| `deltas` | `[on REF {, REF}] among feasible\|infeasible\|all` |

`check` prints them as today: `` `report best` takes: <synopsis> `` and `` `report deltas` takes: <synopsis> ``. The finding carries the sheet and no binding name. `check` exits `1`.

The synopsis is the finding for every malformation of these two reports: the clause omitted, `among` not last, the word missing, the word anything else, or trailing tokens. `report gates among feasible`, `report forbidden among infeasible`, and `report ledger among all` stay the existing "takes no options" or ledger synopsis. They do not mention `among`.

`report deltas among feasible` with no `on` parses. #333 then applies unchanged: if the sheet has no scalar that is not a param, the finding is still `` `report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …` ``. A bare `report deltas` does not parse, so the sheet's `droppedLines` flag keeps #333 silent and the only finding is the synopsis.

A `TYPE` or `UNDEF` on a report line still blocks that whole sheet in `simulate`: the heading and `  (cannot start)`, exit `0` unless `--fail-on-fault`. A well-formed neighbour in the same sheet does not run. That is #259 §3.4, unchanged.

Two statements whose normalized text is equal are `DUP`, message `<text> is declared twice in sheet <id>`. The same refs with a different population are not duplicates. Two `best` lines that differ in scalar, direction, or population are not duplicates.

An upstream `UNDEF` or a null assert faults the question ([§8](../visimark-design.md#8-evaluation)). The question drops out of every population. No sentinel number is printed for it.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)).** The report paragraph gains one sentence: `best` and `deltas` require a trailing `among feasible|infeasible|all`. Nothing else in §4 changes. A report still binds nothing and stores nothing.
- **Evaluation ([§8](../visimark-design.md#8-evaluation)).** A report is still not a graph node. `check` still does not run the sweep.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** `fmt` does not rewrite a `report` line. A document that already has a legal clause is byte-stable under `fmt`.
- **Findings ([§10](../visimark-design.md#10-error-taxonomy)).** The `TYPE` row already says a malformed `report`. The row text stays. The new synopsis is the lattice spec's.
- **`check`.** Exit `1` when the clause is missing or illegal, exit `0` when it is one of the three words and the rest of the document is clean. `--json` carries the same `TYPE` object as any other malformed report: `code: "TYPE"`, `class: "problem"`, `location.sheet`, no `location.name`, `details.message` equal to the synopsis sentence.
- **`simulate`.** Exit codes unchanged. A false assertion stays a reading. stdout gains the count line on `deltas` and the two new populations on both reports. No `--json`.
- **`eval`, `explain`, `infer`.** They do not read `report` lines. Unchanged.
- **`ledger`, `gates`, `forbidden`.** Unchanged, including the ledger's `yes` / `no` / `faulted` column and `forbidden`'s "every question with it breaks an assertion".
- **Imports, `param`, `assert`, `chart`, aliases, precision.** A ref is still resolved as today. Precision and units on the printed numbers stay the binding's. `param` still defines the grid. `assert` still defines feasible and infeasible. `chart` is untouched.
- **Backward compatibility.** A document that passes `check` today stops passing when a `best` or `deltas` line has no `among`. The lines in the repository are:
  - `docs/simulate/conference.md` — `report deltas on event.profit, event.sponsor_share`
  - `docs/example-battery-storage.md` — bare `report deltas`, and `report deltas on debt.dscr_min, asset.soh_eol`
  - `docs/tutorial/runway-sweep.md` — `report deltas on runway.months`
  - `packages/visimark/test/fixtures/simulation/simulate.md` — `report deltas on plan.margin`
  - `packages/visimark/test/fixtures/simulation/levers.md` — `report deltas on levers.extra_hours, levers.volume_disc`

  Each of those gains `among all`, which is the population that line ranks today. Shipped `best` lines already say `among feasible` and stay. `docs/articles/bakeoff/bakeoff.md` has only that `best` form and stays clean.

  `docs/simulate.md`, `docs/tutorial.md`, and `docs/ci.md` embed the same lines inside a display fence, so `check` does not evaluate them. Their sample sessions gain the count line, and the source examples gain `among all` on `deltas`. Chapter 19 of `docs/simulate.md` says that `among all` is the range over every non-faulted question and that `among feasible` is the range inside the rules.

  `packages/visimark/test/fixtures/simulation/bare-deltas.md` already fails #333. After this change the line `report deltas` fails with the `deltas` synopsis instead, and `report deltas among all` in that sheet is what fails with the nothing-to-read sentence.

## 6. Acceptance

Fixture `packages/visimark/test/fixtures/simulation/among.md`:

````markdown
# Among

```vmark #plan
param hours precision 0 integer in [0, 20] lattice 10 = default 10
param disc precision 2 in [0%, 10%] lattice 5% = default 0%
rate precision 2 = 100.00
margin precision 2 = 1500.00 * (1 - disc) - rate * hours
assert margin >= 0
assert hours <= 15

report best scalar margin direction max among all
report best scalar margin direction max among feasible
report best scalar margin direction max among infeasible
report best scalar margin direction min among feasible
report deltas on margin among all
report deltas on margin among feasible
report deltas on margin among infeasible
```
````

`check among.md` exits `0` and prints `0 problems`. `simulate among.md` exits `0`. stdout is exactly:

```text
==> among.md <==
#plan

report best scalar margin direction max among all

  hours=0 disc=0%
  margin  1500.00  (+1000.00 against base)
  chosen from 9 questions

report best scalar margin direction max among feasible

  hours=0 disc=0%
  margin  1500.00  (+1000.00 against base)
  chosen from 6 feasible of 9 questions

report best scalar margin direction max among infeasible

  hours=20 disc=0%
  margin  -500.00  (-1000.00 against base)
  chosen from 3 infeasible of 9 questions

report best scalar margin direction min among feasible

  hours=10 disc=10%
  margin  350.00  (-150.00 against base)
  chosen from 6 feasible of 9 questions

report deltas on margin among all

  margin  base 500.00
    low   -650.00  (-1150.00)  hours=20 disc=10%
    high  1500.00  (+1000.00)  hours=0 disc=0%
  over 9 questions

report deltas on margin among feasible

  margin  base 500.00
    low    350.00   (-150.00)  hours=10 disc=10%
    high  1500.00  (+1000.00)  hours=0 disc=0%
  over 6 feasible of 9 questions

report deltas on margin among infeasible

  margin  base 500.00
    low   -650.00  (-1150.00)  hours=20 disc=10%
    high  -500.00   (-1000.00)  hours=20 disc=0%
  over 3 infeasible of 9 questions
```

stderr is the question line `simulate: among.md: 10 questions (2 lattice params)` and the summary `simulate: among.md: 1 of 1 sheets ran in <duration>`. The acceptance test stubs the duration at `0 ms`, as `simulate-acceptance.test.ts` does.

**Missing clause.** The same document with both `among …` tails deleted: `check` exits `1` and prints exactly these two findings and the footer (sheet column padded as every other `TYPE`):

```text
  TYPE    plan.             `report best` takes: scalar REF direction max|min among feasible|infeasible|all

  TYPE    plan.             `report best` takes: scalar REF direction max|min among feasible|infeasible|all

  TYPE    plan.             `report best` takes: scalar REF direction max|min among feasible|infeasible|all

  TYPE    plan.             `report best` takes: scalar REF direction max|min among feasible|infeasible|all

  TYPE    plan.             `report deltas` takes: [on REF {, REF}] among feasible|infeasible|all

  TYPE    plan.             `report deltas` takes: [on REF {, REF}] among feasible|infeasible|all

  TYPE    plan.             `report deltas` takes: [on REF {, REF}] among feasible|infeasible|all

  7 problems (0 stale, 7 errors)
```

There are four `best` lines and three `deltas` lines in the fixture. `check --json` has `status: "problems"`, `summary.errors` 7, and each finding's `details.message` equal to the sentence on its line.

**Further cases**, each a variant of `among.md` unless a path is named:

| Case | Result |
|---|---|
| `among feasible` on the existing `simulate.md` `best` line | stdout unchanged for that report |
| `simulate.md`'s `deltas` line written `report deltas on plan.margin among all` | the low and high lines unchanged, then `  over 9 questions` |
| delete every `lattice` | `best` and `deltas` each print `no grid: no param declares a lattice`; exit `0` |
| `assert margin >= 2000`, then `best … among feasible` and `deltas on margin among feasible` | each body is exactly `no feasible question` |
| `assert margin >= -100000`, then `best … among infeasible` and `deltas … among infeasible` | each body is exactly `no infeasible question` |
| add `per_hour precision 2 = margin / hours` and `assert per_hour >= 0`, then `best … direction max among all` | the three `hours=0` questions are faulted; the winner is `hours=10 disc=0%`, margin `500.00` `(0.00 against base)`, `chosen from 6 questions` |
| the same fault, `among infeasible` | body `no infeasible question` (the `hours=20` questions fail asserts and also fail to verify `per_hour`, so they are faulted, not infeasible) |
| `label = "east"` and `report deltas on label, margin among all` only | `label  base ?` and no low/high; `margin` low and high as `among all`; `  over 9 questions` |
| `report best scalar label direction max among all` only | body `no question evaluated` |
| `report deltas among all` in a sheet whose only bindings are params | the #333 nothing-to-read `TYPE`; `check` exit `1` |
| `report deltas` with no `among` in that same sheet | the synopsis `TYPE` only |
| two copies of `report deltas on margin among all` | the second is `DUP` |
| `report deltas on margin among all` and `report deltas on margin among feasible` | both clean |
| `report gates among all` | `` `report gates` takes no options `` |
| `fmt` on `among.md` | stdout says the file is unchanged |

## 7. Non-goals

- A `slack` report, and any margin-to-the-boundary reading. That is #352. `slack` does not take `among`.
- `among` on `ledger`, `gates`, or `forbidden`.
- Changing which questions are feasible, infeasible, or faulted.
- A tie line on `deltas`.
- Pluralizing `question` or `feasible`.
- `simulate --json`, or any change to `simulate`'s exit codes.
- `fmt` rewriting a report line to insert `among`.

## 8. Open questions

None. The pre-review's three questions are closed as follows.

1. `F`, `I`, and `K` count questions in the population whose ranked scalar is a number. §3.
2. `deltas` prints one count line for the report. An empty population is that one line and nothing else. A ref with no numeric value inside a non-empty population keeps its base line and omits low and high. §3.
3. No lattice stays `no grid: no param declares a lattice` for every population. The empty-population lines apply only when the grid exists and the population is empty. §3.
