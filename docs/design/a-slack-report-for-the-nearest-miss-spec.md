# A `slack` report for the nearest miss on each assertion — feature spec

**Status:** approved (#352) · **Date:** 2026-10-13 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/352#issuecomment-6151007966

A sixth built-in reading for `visimark simulate`. It amends [`add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md) §4 and §9 (#259) and [`lattice-on-param-and-report-statements-spec.md`](lattice-on-param-and-report-statements-spec.md) §2.2 (#258), which both say a new report name grows through its own catalogue row. This is that row.

## 1. Purpose

`docs/simulate/conference.md` declares three rules:

````markdown
```vmark #event
assert attendees <= venue_capacity
assert profit >= 0
assert sponsor_share <= 50%
```
````

The guide's chapter 18 says `best` does not say how much room a winner has left. Chapter 23 finds a margin by hand: it takes the 60-euro plan, then runs `eval --scenario` for a third sponsor, which prints `0.556` and a false `sponsor_share <= 50%`. The sweep had already evaluated both sides of that comparison in every question, and it threw them away. A simulated answer stores only whether each assertion holds.

No existing reading reaches it:

- `best … among infeasible` ranks a scalar. The most profitable failure can be the plan that misses a rule by the most.
- Counting broken assertions ties almost every one-rule failure, so the first row in grid order is an accident.
- `gates` names the first failure in grid order: the same accident.
- `forbidden` names a lattice point where every question fails. It says nothing about how large a miss is.
- An input column cannot record a distance that the sweep computed and did not keep.

`report slack` reads, for each assertion, the smallest room among the questions that work and the smallest miss among the questions that fail only that rule. The miss is the price of waiving one rule. Distances across rules are not comparable, because seats, euros and a share are not one unit, so each assertion is ranked on its own.

## 2. Syntax

```text
report slack
```

One new name in the closed `report` list (`lang/ast.ts` `REPORT_NAMES`), with no options. It may appear wherever a `report` statement may appear. It names no `REF` and binds nothing. In an unmodified renderer it is one more line of text inside the fence (constraint 1, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)).

The unknown-report message lists the new name last:

```text
unknown report `X`; the reports are ledger, deltas, gates, best, forbidden, slack
```

## 3. Semantics

### 3.1 Which assertions have a boundary

Every `assert` in the file, in document order and whichever sheet it sits in, gets one block. This is the same set and order as `gates`. Each block is keyed by the assertion's source after `assert`, with whitespace runs collapsed (simulate spec §3.3). Two sheets with the same `assert x >= 0` give two blocks with the same key, as they give two rows in `gates`.

The **top-level expression** of an assertion is its expression with any enclosing parentheses removed. Parentheses do not appear in the AST, so `assert (a <= b)` is the same as `assert a <= b`.

| Top-level expression | Kind |
|---|---|
| `a < b`, `a <= b`, `a > b`, `a >= b`, `a == b` | a **comparison** |
| `a != b`; `and`, `or`, `not`; a bare boolean name; anything else | **no single boundary** |

A comparison is **numeric** when both sides evaluate to numbers. Types do not change across the lattice, so the sides of an assertion are numbers in every question that evaluates it, or in none. When some question evaluates a comparison and its sides are not both numbers (a date, a string or a boolean), the block prints `not a numeric comparison`. When no question evaluates it, because every question faults it, the comparison is treated as numeric. Its pools are then empty and both lines print their empty-pool sentences.

### 3.2 Distance

`a` is the left side and `b` is the right side, each as the question evaluated it. A named value has already been rounded at its binding ([§7](../visimark-design.md#7-numeric-semantics)), so `sponsor_share precision 3` takes the value `0.556`, not 5/9. A percent literal is its decimal value: `50%` is `0.50`.

| Operator | Inside room (where it holds) | Outside miss (where it fails) |
|---|---|---|
| `a <= b` | `b − a`, can be `0` (the rule binds) | `a − b`, always above `0` |
| `a < b` | `b − a`, always above `0` | `a − b`, can be `0` (it fails at the bound) |
| `a >= b` | `a − b`, can be `0` | `b − a`, always above `0` |
| `a > b` | `a − b`, always above `0` | `b − a`, can be `0` |
| `a == b` | no inside line | the absolute value of `a − b`, always above `0` |

Every distance is exact decimal arithmetic and is never negative. `miss 0` on a strict operator is a real reading: the question lands on the bound, and a strict rule fails there.

**Width.** A distance prints at `w = max(width(a), width(b))`. The width of a side is the width [§7](../visimark-design.md#7-numeric-semantics) derives for that expression (`eval/precision.ts` `derivePrecision`), with a bare name taking the width it writes at. That is the rule [§7](../visimark-design.md#7-numeric-semantics) applies to a subtraction. When either side has no derived width (a division, `AVG`, `SQRT`), or when the exact distance has more decimals than `w`, the distance prints as its canonical decimal. **A distance is never rounded**, so two distances that print the same are equal, and a reader can redo the subtraction on a calculator. The conference widths:

| Assertion | width(a) | width(b) | w | Example |
|---|---|---|---|---|
| `attendees <= venue_capacity` | 0 | 0 | 0 | `100` |
| `profit >= 0` | 2 | 0 | 2 | `900.00` |
| `sponsor_share <= 50%` | 3 | 2 | 3 | `0.556 − 0.50 = 0.056` |
| `x / 4 > 0.25` (fixture, §6.2) | none | 2 | — | canonical `0.25`, `0` |

No unit bracket follows a distance. The block's key line already names the quantity. A unit on a distance is a later issue if a document needs it.

### 3.3 Pools

Pools use simulate spec §3.2 unchanged. A question is **faulted** when some `assert` cannot be verified in it, or when some scalar named by a `REF` in any report of the file has no value in it. `slack` names no `REF`, but a `REF` in another report can still remove questions from its pools. This is deliberate: `slack`'s feasible pool is exactly the pool that `best … among feasible` ranks in the same run.

| Pool | Members |
|---|---|
| **Inside** | grid questions that are feasible: not faulted, and every `assert` holds |
| **Outside** of assertion *k* | grid questions that are not faulted, where *k* is false and every other `assert` holds |

The base row is never a candidate. A question that is not faulted has no unverifiable assertion, so the outside pool never includes a question where another assertion is `null`.

The inside line shows the inside candidate with the smallest room. The outside line shows the outside candidate with the smallest miss. **Ties** are judged on the exact distance. The first candidate in grid order is shown. When `T > 1` candidates reach the smallest distance, a line follows the rows: `T questions tie inside; the first in grid order is shown`, or the same with `outside`. The inside tie line comes before the outside one.

### 3.4 Output

The body is printed under the report heading, as every report body is (simulate spec §3.3). Every body line is indented two spaces. The block lines below are indented two more.

For each assertion, in document order:

```text
KEY
  inside   room  D  QUESTION
  outside  miss  D  QUESTION
  T questions tie inside; the first in grid order is shown
  T questions tie outside; the first in grid order is shown
  from F feasible and O failing only this, of N questions
```

- `KEY` is the assertion key (§3.1).
- The two rows form one table per block (simulate spec §3.3 *Tables*). The label column is padded to seven characters (`inside `, `outside`). The word column holds `room` or `miss`. The distance column is right-aligned. `QUESTION` is the question in prose, `attendees=300 ticket=60.00 sponsors=2`. Columns are separated by two spaces, and trailing whitespace is trimmed.
- The tie lines appear only when `T > 1`.
- `F` counts the inside pool. `O` counts this assertion's outside pool. `N` is the grid size. The count line is printed for every comparison block, including `==`, and `F` and `O` may be `0`.

Cases that replace part of a block:

| Case | What prints |
|---|---|
| the file has no lattice param (`N = 0`) | the whole body is the one line `no grid: no param declares a lattice`, and no blocks |
| not one comparison (§3.1), including `!=` | `KEY`, then `  no single boundary`. No rows and no count line |
| a comparison whose sides are not numbers | `KEY`, then `  not a numeric comparison`. No rows and no count line |
| `==` | the outside row only. No inside row, and no inside tie line |
| empty inside pool (`F = 0`), not `==` | the inside row is replaced by `inside   no feasible question` |
| empty outside pool (`O = 0`) | the outside row is replaced by `outside  no question fails only this assertion` |

An empty-pool line is not a table row. It is written with its label padded to seven characters and two spaces, so it starts at the same column as a row. When only one row remains, the table is that one row.

All of these are readings. `simulate`'s exit code does not change (simulate spec §3.7).

## 4. Type rules and errors

No new finding code. Every failure is an existing [§10](../visimark-design.md#10-error-taxonomy) code, reported by `check`. A line that fails the grammar is dropped at parse, as any malformed `report` line is, so `simulate` does not see it. A line that parses but has nothing to read makes its sheet `(cannot start)` (simulate spec §3.4).

| Input | Finding | Message |
|---|---|---|
| `report slack` followed by anything | `TYPE` | `` `report slack` takes no options `` (the existing synopsis wording, `REPORT_SYNOPSIS.slack = null`) |
| `report slackk`, or any unknown name | `TYPE` | `` unknown report `slackk`; the reports are ledger, deltas, gates, best, forbidden, slack `` |
| two byte-identical `report slack` lines in one sheet | `DUP` | the existing duplicate-report finding |
| `report slack` in a file with no `assert` anywhere | `TYPE`, new message, on the report line | `` `report slack` has nothing to read: this document has no `assert` `` |

The no-`assert` rule follows #333 (`a-bare-report-deltas-in-a-sheet-with-no-spec.md`): a sheet that cannot print a body does not pass `check`. It is static. It stays silent when any sheet in the file lost a line to a parse error (`sheet.droppedLines`), because the lost line may have been the `assert`. It lives in `eval/check-reports.ts` beside the `deltas` rule. The finding is located on the report's span, so `simulate` reports that sheet as `(cannot start)`.

Evaluation-time trouble is not a finding. An assertion that one question cannot verify faults that question (§3.3), and the question then sits in neither pool.

## 5. Interaction with the rest of the language

- **Evaluation.** In `check`, each assertion whose top-level expression is a comparison now also keeps the values of its two sides, whenever it is evaluated (`holds` is `true` or `false`). The sides come from evaluating the two operand expressions in the same environment as the whole expression. They are exact, so `a OP b` on them reproduces `holds`. `simulate` keeps the sides per assertion per question beside `holds` in `Answer`. Nothing else reads them.
- **`--json`, `explain`, `eval`, the MCP server, the LSP.** These are unchanged. `report/json.ts` `publicAssertions` maps fields explicitly, so `eval --json` stays byte-identical. `explain` and the MCP server do not read the sides. The playground passes check results through `browser-entry.ts`. Its eval view prints the same text as before, and its simulate view gains `slack` through `renderSheet`.
- **`check`.** It accepts the name. It resolves nothing further, because the line names no `REF`. Its only new finding is the no-`assert` `TYPE` (§4).
- **`fmt` and write-back ([§9](../visimark-design.md#9-write-back)).** `fmt` does not rewrite a `report` line. The tool owns nothing new.
- **`infer`.** Unchanged.
- **Dependency graph ([§8](../visimark-design.md#8-evaluation)).** A report is not a graph node. No edge is added.
- **Name resolution, anchors, imports, `chart`, aliases ([§6](../visimark-design.md#6-name-resolution-and-scoping), [§3](../visimark-design.md#3-document-model)).** Untouched, because `slack` names nothing.
- **Other reports.** `slack` does not call or change `ledger`, `deltas`, `gates`, `best` or `forbidden`. Their output is byte-identical.
- **Highlighting.** `packages/codemirror-visimark/src/tokenize.ts` `WORDS.reportAtoms` gains `slack`, so the drift test against `REPORT_NAMES` stays green.

**Backward compatibility.** A document that passes `check` today still passes, because `report slack` fails `check` today and nothing depends on it. A document that uses `slack` fails `check` on an older visimark, as any new report name does.

## 6. Acceptance

### 6.1 The guide's document

`docs/simulate/conference.md` gains one line at the end of `#readings`:

````markdown
```vmark #readings
report gates
report forbidden
report best scalar event.profit direction max among feasible
report best scalar event.ticket direction min among feasible
report deltas on event.profit, event.sponsor_share among all
report slack
```
````

`check` still exits `0` with no finding. `visimark simulate docs/simulate/conference.md` exits `0`. Its `#readings` section ends with the existing `deltas` body, followed by exactly:

```text

report slack

  attendees <= venue_capacity
    inside   room    0  attendees=300 ticket=60.00 sponsors=2
    outside  miss  100  attendees=400 ticket=60.00 sponsors=1
    13 questions tie inside; the first in grid order is shown
    15 questions tie outside; the first in grid order is shown
    from 25 feasible and 15 failing only this, of 64 questions
  profit >= 0
    inside   room  900.00  attendees=200 ticket=60.00 sponsors=2
    outside  miss  100.00  attendees=200 ticket=80.00 sponsors=1
    from 25 feasible and 16 failing only this, of 64 questions
  sponsor_share <= 50%
    inside   room  0.000  attendees=100 ticket=100.00 sponsors=2
    outside  miss  0.056  attendees=100 ticket=80.00 sponsors=2
    3 questions tie outside; the first in grid order is shown
    from 25 feasible and 6 failing only this, of 64 questions
```

The sponsor line lands on question 7 (`100/80.00/2`). It does not land on chapter 23's `200/60.00/3` (question 20). Questions 7, 16 and 20 all reach `0.556`, a miss of `0.056`. The tie line says so, and chapter 23 says so too (§8).

### 6.2 A fixture for every case

A new fixture, `packages/visimark/test/fixtures/simulation/slack.md`:

````markdown
# Slack fixture

```vmark #s
param x integer in [0, 3] lattice 1 = default 2
param y precision 2 in [0, 1] lattice 0.25 = default 0.50
due = 2027-01-01 + x

assert x < 3
assert y >= 0.25
assert x / 4 > 0.25
assert x * 0 == 0
assert x >= 0 and x <= 3
assert x != 9
assert due <= 2027-01-05
```

```vmark #r
report slack
```
````

`check` exits `0` with no finding. The grid is `x ∈ {0,1,2,3}` × `y ∈ {0.00, 0.25, 0.50, 0.75, 1.00}`, 20 questions. Feasible questions are 12–15 (`x=2`, `y ≥ 0.25`). `visimark simulate slack.md` exits `0`, and stdout is exactly:

```text
==> slack.md <==
#r

report slack

  x < 3
    inside   room  1  x=2 y=0.25
    outside  miss  0  x=3 y=0.25
    4 questions tie inside; the first in grid order is shown
    4 questions tie outside; the first in grid order is shown
    from 4 feasible and 4 failing only this, of 20 questions
  y >= 0.25
    inside   room  0.00  x=2 y=0.25
    outside  miss  0.25  x=2 y=0.00
    from 4 feasible and 1 failing only this, of 20 questions
  x / 4 > 0.25
    inside   room  0.25  x=2 y=0.25
    outside  miss     0  x=1 y=0.25
    4 questions tie inside; the first in grid order is shown
    4 questions tie outside; the first in grid order is shown
    from 4 feasible and 8 failing only this, of 20 questions
  x * 0 == 0
    outside  no question fails only this assertion
    from 4 feasible and 0 failing only this, of 20 questions
  x >= 0 and x <= 3
    no single boundary
  x != 9
    no single boundary
  due <= 2027-01-05
    not a numeric comparison
```

Here is what each block covers:

| Block | Case |
|---|---|
| `x < 3` | strict `<`: the room is never 0, the miss is `0` at the bound, and both rows tie |
| `y >= 0.25` | `>=` takes `a − b` inside and `b − a` outside, with no inverted wording; the width is the wider side (2) |
| `x / 4 > 0.25` | strict `>`; a side with no derived width prints canonical (`0.25`, `0`); questions 2–5 miss by `0.25` and lose to questions 7–10, which miss by `0` |
| `x * 0 == 0` | `==` has no inside row; an empty outside pool |
| `x >= 0 and x <= 3`, `x != 9` | no single boundary |
| `due <= 2027-01-05` | a date comparison |

### 6.3 Variants, generated in memory from the fixture

These are held in the same test, in the style of `test/simulate-acceptance.test.ts`:

**No feasible question.** Append `assert x > 5` to `#s`. No question is feasible, and only the questions where `x > 5` is the sole failure (12–15) are outside candidates for anything. The body is exactly:

```text
  x < 3
    inside   no feasible question
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions
  y >= 0.25
    inside   no feasible question
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions
  x / 4 > 0.25
    inside   no feasible question
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions
  x * 0 == 0
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions
  x >= 0 and x <= 3
    no single boundary
  x != 9
    no single boundary
  due <= 2027-01-05
    not a numeric comparison
  x > 5
    inside   no feasible question
    outside  miss  3  x=2 y=0.25
    4 questions tie outside; the first in grid order is shown
    from 0 feasible and 4 failing only this, of 20 questions
```

**A fault from another report.** Add `q precision 2 = 1 / (x - 1)` to `#s` and `report best scalar s.q direction max among all` to `#r`. Questions 6–10 (`x=1`) have no `q`, so they are faulted (simulate spec §3.2) and leave `slack`'s pools. Only the `x / 4 > 0.25` block changes, and it becomes exactly:

```text
  x / 4 > 0.25
    inside   room  0.25  x=2 y=0.25
    outside  miss  0.25  x=0 y=0.25
    4 questions tie inside; the first in grid order is shown
    4 questions tie outside; the first in grid order is shown
    from 4 feasible and 4 failing only this, of 20 questions
```

The other variants:

| Variant | Expected |
|---|---|
| the fixture with every `lattice` clause removed | the body is `no grid: no param declares a lattice`; exit `0` |
| `report slack among all` | `check` exits `1` with `` TYPE … `report slack` takes no options ``. The line is dropped at parse, so `simulate` prints nothing on stdout and `simulate: FILE: no report statement` on stderr, and exits `1` |
| a file whose only sheet is `#r` with `report slack`, and no `assert` | `check` exits `1` with `` TYPE … `report slack` has nothing to read: this document has no `assert` `` |
| the same, with a parse error on another line of the file | no nothing-to-read finding; only the parse error |
| `report slack` twice in `#r` | `DUP` |
| `assert (x < 3)` in place of `assert x < 3` | the same rows as the `x < 3` block, under the key `(x < 3)` |

### 6.4 Unchanged

`eval --json` on `conference.md` and on the fixture is byte-identical before and after. `check`, `explain` and `eval` output on every document in `docs/` is unchanged. The other five reports' bodies in `conference.md` are unchanged.

## 7. Non-goals

- A combined distance across assertions, or ranking questions by total slack.
- A distance for compound assertions, `!=`, or date and string comparisons. A day distance for dates is a later issue if a document needs it.
- An `among` clause or any other option on `slack`.
- A unit bracket on the distance.
- Qualifying the assertion key with its sheet. This applies equally to `gates`, and it is a separate issue.
- `--json` for `simulate`, which still has none.
- Exposing the kept sides in `eval --json`, `explain` or the MCP server.

## 8. Documentation to update

- `docs/visimark-design.md`: the §3 `report` bullet (the name list), the §10 `TYPE` row (the new nothing-to-read message), and the §11 `simulate` paragraph.
- `docs/design/add-a-simulate-command-spec.md`: §4 ("All five read…", plus a pointer row for `slack` linking this spec) and §9 (the non-goal "New report names" now cites #352). Also `lattice-on-param-and-report-statements-spec.md` §2.2's name list.
- `docs/simulate.md`:
  - Chapter 12 becomes "The six reports", with a `slack` entry.
  - Chapter 18's "`best` does not say how much room is left" passage points to `slack`.
  - Chapter 23 shows the `slack` reading. Its prose says that the report lands on `100/80.00/2`, and that the guide's `200/60.00/3` is one of the three tied questions.
  - The chapter 26 checklist.
  - Every transcript of `#readings`.
- `docs/tutorial.md`: the "five reports" and "all five reports" passages.
- `docs/cli-reference.md`: the `simulate` row and the `TYPE` row.
- The regenerated pages `docs/simulate.html` and `docs/tutorial.html`.
- `CHANGELOG.md` under `## Unreleased` → `### Added`, and a one-line `editors/vscode/CHANGELOG.md` entry, because `report slack` is no longer flagged as unknown.
- `docs/vocabulary-catalogue.md`: the row moves to the Shipped register as `UNRELEASED`.

## 9. Open questions

None.

<!--vmark:no-formulas-->
