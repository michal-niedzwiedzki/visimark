# `lattice` on `param`, and `report` statements — feature spec

**Status:** approved (#258) · **Date:** 2026-10-02 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/258#issuecomment-5956116308

## 1. Purpose

A document that is audited at its defaults is also, usually, a document whose
author wants to ask *what if* of many values — and to say, in the document,
which questions are worth asking and which readings of the answers are wanted.
Today that lives in a script beside the file. [#241](https://github.com/michal-niedzwiedzki/visimark/issues/241)
gave a `param` a declared domain, the envelope of values a search may try
([`a-param-declares-the-set-of-values-it-ac-spec.md`](a-param-declares-the-set-of-values-it-ac-spec.md)).
A continuous interval such as `[0%, 10%]` is an envelope with infinitely many
points; nothing says which of them a sweep should visit. And nothing in a
document names the readings — the case ledger, the deltas against the
defaults, which assertions failed together — that make a sweep legible.

This spec adds two things, both inside the existing `vmark` fence:

- a **`lattice STEP` clause on a `param` header**: the spacing at which a
  sweep visits the param's declared domain. It is a declaration about the
  sweep, not about membership;
- a **`report NAME [OPTIONS]` statement**, beside `chart`: a request that a
  named, shipped reading of a simulation be printed under the sheet's heading.

Neither is evaluated by `check`, `fmt` or `eval`. A `simulate` command that
consumes them is tooling and is specified separately
([#259](https://github.com/michal-niedzwiedzki/visimark/issues/259)).

**The motivating document.** Five levers, limits expressed as `assert`
statements, and a sheet that wants readings of many scenarios:

````markdown
```vmark #levers
param extra_hours    precision 0 integer in [0, 80] = default 0
param volume_disc    precision 3 in [0%, 10%] = default 0%
param prepay_share   precision 2 in { 30%, 40%, 45%, 50% } = default 30%
```

```vmark #runs
signature_target = 17000.00
CashGap   precision 2 = Signature - signature_target
MarginGap precision 4 = Margin - guardrails.min_margin
chart cash   as bar of CashGap   labelled Run aspect 16:9
chart margin as bar of MarginGap labelled Run aspect 16:9

report ledger assertions broken
report deltas on lines.signature, lines.margin
report gates
report best scalar lines.margin direction max among feasible
report forbidden
```
````

Checked against the current build, the five `report` lines in `#runs` each
report `TYPE binding has no =`: `check` correctly rejects syntax that does not
exist yet. `volume_disc in [0%, 10%]` is a continuum at precision 3, and
nothing in the document says whether a sweep should visit 11 points or 10,001.

**Why existing vocabulary does not reach it.** `precision` is the width of a
stored number, not a sweep spacing. The domain is membership: it must keep
accepting `2.5%` for a scenario value even if a sweep never asks about it, so
the spacing cannot be part of it. An `assert` runs after an evaluation and
selects nothing. An input column holds one scenario, not a family.

## 2. Syntax

### 2.1 The `lattice` clause

```text
param NAME precision N [PRESET] [in DOMAIN-EXPR] [lattice STEP] = default LITERAL
```

`lattice STEP` is last in the header, after the domain clause of #241 and
before `= default`. `STEP` is a number literal as in
[§2 of the #241 spec](a-param-declares-the-set-of-values-it-ac-spec.md#2-syntax)
(optional `-`, digits, optional fraction, optional `%`), never an expression.
At most one `lattice` clause per param.

````markdown
```vmark #levers
param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40
param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%
param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param bump         precision 1 in (0, 10) lattice 5 = default 5
```
````

**`lattice` is a contextual keyword**, recognised only in a `param` header,
after the domain, exactly as `integer` and `in` are. No word becomes
reserved; `lattice = 5` still binds a scalar called `lattice`.

**A lattice is not part of the domain.** It does not narrow what a value may
be: `in [0, 80] lattice 5` still accepts `7`, as a default and as a scenario
value. It is not a field of the `Domain` (`parts`) or of its `fold`. It is a
sibling of `domain` on the param. Its only reader is a sweep.

**The membership lattice is not a field either.** The shipped domain has no
`{ step, anchor }` object: a leaf is a preset, a range or a set, and a domain
is integral exactly when it contains the `integer`, `natural` or
`positive integer` preset. This spec adds a derived predicate
`isIntegral(domain)` over those presets and no stored flag.

### 2.2 The `report` statement

```text
report NAME [OPTIONS]
```

A statement, not a binding: it binds no name and stores no value, like
`chart`. It sits in a sheet block (`vmark #id`). `NAME` is one of a closed
list shipped with the tool; each name has a closed option grammar:

| `NAME` | Options |
|---|---|
| `ledger` | `[assertions broken]` |
| `deltas` | `[on REF {, REF}] among feasible\|infeasible\|all` |
| `gates` | *(none)* |
| `best` | `scalar REF direction max\|min among feasible\|infeasible\|all` |
| `forbidden` | *(none)* |

`REF` is a name as written in an expression: bare (`margin`) or sheet-qualified
(`lines.margin`). The words `assertions`, `broken`, `on`, `scalar`,
`direction`, `max`, `min`, `among`, `feasible`, `infeasible` and `all` are contextual, recognised
only inside a `report` line. The list of names grows only through its own
catalogue row — the same closed-set model `chart`'s engine names use — and no
document selects code to run: there is no `reports/` folder and no way to
name a report that the tool does not ship.

**Recognition.** A line in a `vmark` block whose first token is the word
`report` and which has no `=` is a report statement. A binding always has an
`=`, so `report = 5` and `report precision 2 = 5` still bind a scalar called
`report`. A bare `report` line is a statement with no name (§4).

**In an unmodified renderer** both forms sit inside the fence — constraint 1
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)).

## 3. Semantics

### 3.1 The sweep points of a lattice

Neither `check` nor `eval` visits these points; this section defines what the
lattice *declares*, so that the declaration can be validated and a sweep has
one place to read it. Write `lo` and `hi` for the ends of the param's
effective interval and `s` for the step. The effective interval is the
intersection of every bound the domain clauses state: `lo` is the greatest of
the low bounds, `hi` the least of the high bounds, an open bound winning a
tie; `positive` contributes an open low bound at 0, `natural` a closed low
bound at 0, `positive integer` an open low bound at 0.

1. Start `a = lo`, and `b = hi`. If the domain is integral, `a = ceil(lo)`
   and `b = floor(hi)`.
2. `(b − a) / s` must be a whole number `n`. The candidate points are
   `a, a + s, …, a + n·s`.
3. A candidate equal to an open end is dropped.
4. The points that remain must be at least one.

Arithmetic is exact decimal ([§7](../visimark-design.md#7-numeric-semantics));
a percent step is its decimal (`1%` is `0.01`). The anchor is the lower end,
not zero.

| Declaration | Points | Why |
|---|---|---|
| `[0%, 10%] lattice 1%` | `0, 0.01, … , 0.10` (11) | closed ends, both visited |
| `integer in [0, 80] lattice 20` | `0, 20, 40, 60, 80` | integral, anchored at 0 |
| `integer in [3, 83] lattice 20` | `3, 23, 43, 63, 83` | anchored at the lower end, not at 0 |
| `integer in [2.5, 22.5] lattice 5` | *(fault)* | `a = 3`, `b = 22`, `19` is not a multiple of 5 |
| `in (0, 10) lattice 5` | `5` | `0` and `10` are the open ends, dropped |
| `integer in (0, 10) lattice 1` | `1 … 9` | open ends dropped |
| `positive in [0, 10] lattice 5` | `5, 10` | `positive` makes the low end `0` open |
| `in [0, 10] lattice 3` | *(fault)* | `10` is not a multiple of 3 above `0`; the last point is never silently dropped |
| `in [3, 3] lattice 1` | `3` | a one-point interval is legal |
| `in (0, 5) lattice 5` | *(fault)* | no point remains |

A param **without** a `lattice` is not swept: a sweep holds it at its default.
A param **with** one is swept over its points, and a sweep over several
lattice params is their Cartesian product. The default need not be a point:
`in [0, 80] lattice 20 = default 7` is legal, and the lattice is not used to
compute the base case. A sweep asks the default once in addition to the grid.

### 3.2 What a lattice does not change

| Case | Behaviour |
|---|---|
| `eval` and `check` on a param with a lattice | the default evaluates and checks exactly as without the clause |
| a scenario value off the lattice, inside the domain | accepted (`in [0, 80] lattice 20`, `extra_hours = 7`) |
| a scenario value outside the domain | the existing `SCENARIO` fault, unchanged |
| a default off the lattice | legal, no finding |

### 3.3 `report` at `check` time

`check` parses the line against the grammar in §2.2, resolves each `REF`, and
stops. It does not run a question, estimate a grid size or judge a report. A
sheet with `report` lines evaluates exactly as it did without them under
`check`, `fmt` and `eval`.

Which questions a sheet is asked — its table rows, the grid of lattice params,
a single default question, a `files` statement — and what each report computes
and prints belong to `simulate` (#259), not to the language. The list of
report names and their option grammars is the whole language-level contract.

## 4. Type rules and errors

All findings are static. No new code joins the taxonomy
([§10](../visimark-design.md#10-error-taxonomy)): `TYPE` is widened to cover a
malformed `lattice` clause, an impossible lattice and a malformed or unknown
`report`, by the definition it already has — structural well-formedness
independent of any particular value. `DOMAIN` stays what #241 made it, a
question about whether a *value* belongs.

### 4.1 `lattice`

| Case | Code | Message |
|---|---|---|
| `lattice` with no literal, or a non-literal (an expression, a name, a date) | `TYPE` | `a lattice step must be a number literal` |
| a second `lattice` clause, or `lattice` before the domain | `TYPE` | `malformed param domain clause` |
| `param x precision 0 lattice 5 = default 0` (no domain at all) | `TYPE` | `param x declares a lattice but no domain` |
| `in { 1, 2 } lattice 1` (a set) | `TYPE` | `param x declares a lattice, but a set already lists its points` |
| `natural lattice 5` (no high bound) | `TYPE` | `param x declares a lattice, but its domain has no upper bound` |
| `in (, 10] lattice 5` (no low bound) | `TYPE` | `param x declares a lattice, but its domain has no lower bound` |
| a percent param with a bare step, or the reverse | `TYPE` | `volume_disc is a percent; lattice step 5 must be too` |
| a step with more decimals than the declared `precision`: `precision 1 in [0, 1] lattice 0.25` | `PRECISION` (widened) | `lattice step 0.25 has 2 decimals; param x declares 1` — the shape the `default` and domain-literal checks use |
| `lattice 0` or `lattice -5` | `TYPE` | `lattice step must be positive` |
| an integral domain with a fractional step: `precision 1 integer in [0, 80] lattice 2.5` | `TYPE` | `lattice step 2.5 must be a whole number: param x is an integer domain` |
| a step that does not reach the end: `in [0, 10] lattice 3` | `TYPE` | `lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0` |
| no point remains: `in (0, 5) lattice 5` | `TYPE` | `lattice step 5 leaves no point in (0, 5)` |

The checks run in the order of this table — the literal, then percent-ness and
width, then the facts about the domain, then the reach of the step — and the
first that fires is the only finding for that param. The domain checks of #241 run first; a param
whose domain is already faulty (`DOMAIN`, or a malformed clause) reports that
and no lattice finding. A `lattice` clause that fails to *parse* is a broken
binding like any malformed `param`, and its dependants are suppressed under
`NOTE` ([§8](../visimark-design.md#8-evaluation)). A lattice that parses but is
impossible is a finding on the declaration only: the param's default and
domain are fine, and its dependants evaluate and check as before.

The finding names the param (`location.name`), as every `param` finding does.

### 4.2 `report`

| Case | Code | Message |
|---|---|---|
| `report` with no name | `TYPE` | `a report needs a name` |
| a name outside the closed list | `TYPE` | `unknown report \`foo\`; the reports are ledger, deltas, gates, best, forbidden` |
| options that do not match the report's grammar | `TYPE` | `` `report best` takes: scalar REF direction max\|min among feasible\|infeasible\|all `` (the synopsis from §2.2 for that name; `` `report gates` takes no options `` for the optionless two) |
| a `REF` that resolves to nothing | `UNDEF` | the message an unresolved name has today |
| a `REF` that resolves to a column, not a scalar | `TYPE` | `a report reads a scalar; lines.price is a column` |
| a `report` in a document-scope block (no sheet id) | `SHEET` | ``` `report` must be in a `#id` sheet block ``` |
| a parsed `report deltas among <word>` with no `on`, in a sheet with no scalar that is not a `param` (#333). A line with no `among` fails the synopsis instead (#351) | `TYPE` | `` `report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …` `` |
| two byte-identical `report` statements in one sheet, whitespace normalised | `DUP` | `report gates is declared twice in sheet runs` |

The findings carry the sheet (`location.sheet`) and no `name`, as the existing
`chart` findings do. A `report` does not need a table: it is legal in a sheet
that has none. Two reports of the same name with different options, `deltas on
a` and `deltas on b`, are not duplicates.

A `REF` counts as a **read** of the scalar it names, so a scalar that only a
report reads is not reported by `WARN` as defined and never read. A report adds
no edge to the dependency graph: it changes no evaluation order and cannot
introduce a `CYCLE`.

## 5. Interaction with the rest of the language

- **Shape** ([§4](../visimark-design.md#4-syntax)). A param with a lattice is
  still a numeric scalar; a `report` binds nothing. No new shape, no boolean.
- **Evaluation** ([§8](../visimark-design.md#8-evaluation)). Neither form is a
  graph node. `check`, `fmt` and `eval` evaluate a sheet once, at its
  defaults, with or without them.
- **Write-back** ([§9](../visimark-design.md#9-write-back)). The tool owns
  nothing new. `fmt` neither adds, removes nor normalises a `lattice` clause or a
  `report` line; the offset splicer is not involved. A one-input change still
  diffs as that input.
- **Precision** ([§7](../visimark-design.md#7-numeric-semantics)). The step is
  checked against `precision` as every domain literal is (§4.1), so every
  lattice point is writable at the param's width.
- **Units** ([§21](../visimark-design.md#21-units)). Unaffected; neither form
  carries a unit.
- **Name resolution** ([§6](../visimark-design.md#6-name-resolution-and-scoping)).
  `lattice`, `report` and the option words introduce no name and reserve no
  word. A `REF` resolves as a name does in an expression.
- **Imports, `assert`, `chart`, aliases, declared precision.** No special
  case. A `report` may sit beside `chart` and `assert` in one sheet. A param on
  an imported sheet may carry a lattice, as it may carry a domain.
- **Scenario parameters** ([§20](../visimark-design.md#20-scenario-parameters)).
  `--scenario` overrides a default and never a lattice; §3.2.
- **CLI surfaces.**
  - `check` reports the findings of §4 and exits `1` on any of them (all are
    problems, not advice); `--json` keeps its shape.
  - `fmt` and `infer` are unchanged: `infer` never proposes a lattice or a
    report.
  - `eval` and `explain` report a lattice on each param that has one, beside
    its domain, and are otherwise unchanged. A document with no lattice
    prints byte-for-byte what it printed before. In `eval`'s `params:` block
    the clause follows the domain text:

    ```
    params:
      levers.extra_hours   integer in [0, 80] lattice 20
      levers.volume_disc   [0%, 10%] lattice 1%
      levers.prepay_share  { 30%, 40%, 45%, 50% }
    ```

    `explain` appends the same text after the domain on the param's row:
    `domain integer in [0, 80]   lattice 20`. The step is printed as written.
    In `eval --json` and `explain --json` a param entry gains a `lattice`
    object, a sibling of `domain` and **absent** on a param with none:
    `"lattice": { "step": "0.01" }`, the canonical decimal, `1%` shown as
    `0.01`. It carries no point list and no count; whether to report the
    computed point count is `simulate`'s open question.
  - `ref` is unaffected.
- **Editors.** Diagnostics come from `check`, so the LSP needs no new rule.
  Any editor keyword list that names the `param` header's contextual words is
  extended with `lattice`, and the `chart`-adjacent statement words with
  `report`.
- **What does not change.** No document that passes `check` today stops
  passing: no `vmark` fence under `docs/` or `packages/*/test/fixtures` has a
  line starting `report` (without an `=`) or a `param` header containing
  `lattice`, and no existing binding named `report` or `lattice` is touched
  (a `grep` of the tree on 2026-10-02 found only prose). `check`'s exit code on every existing
  document is unchanged.

## 6. Acceptance

A new non-normative fixture, `packages/visimark/test/fixtures/simulation/levers.md`,
held to a transcript test in the style of `test/domain-acceptance.test.ts`:
only the clean fixture is committed and each broken variant is generated in
memory from it.

````markdown
```vmark #levers
param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40
param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%
param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param bump         precision 1 in (0, 10) lattice 5 = default 5
param staff        precision 0 positive integer in [1, 13] lattice 3 = default 1

max_prepay = 40%
cost precision 0 = extra_hours * 100
assert levers.prepay_share <= max_prepay

report ledger assertions broken
report deltas on levers.extra_hours, levers.volume_disc among all
report gates
report best scalar levers.cost direction min among feasible
report forbidden
```
````

`test/simulation-acceptance.test.ts` asserts, with `runCli` as the domain
test does:

1. **Clean.** `check <fixture>` exits `0`, prints `0 problems`, and prints no
   `TYPE`, `DOMAIN`, `PRECISION`, `SHEET`, `UNDEF` or `DUP`. `WARN` for
   `bump` and `staff` (defined, never read) is allowed; none is raised for
   `volume_disc`, which only a report reads.
2. **Reporting.** `eval --json` has, under `params`:
   `levers.extra_hours.lattice` equal to `{ "step": "20" }`,
   `levers.volume_disc.lattice` equal to `{ "step": "0.01" }`,
   `levers.bump.lattice` equal to `{ "step": "5" }`,
   `levers.staff.lattice` equal to `{ "step": "3" }`, and no `lattice` key on
   `levers.prepay_share`. `levers.extra_hours.domain` is unchanged from #241's
   fixture shape. The plain-text `eval` `params:` block matches §5 on the same
   rows.
3. **Unchanged.** `eval` and `explain` on `test/fixtures/domain/levers.md`
   print what they printed before this change, byte for byte.
4. **Findings.** One variant per row of §4 generated from the fixture, each
   asserted through `check --json` on `code`, `location.sheet`,
   `location.name` (absent for `report`) and `details.message`: every row of
   §4.1 and §4.2, plus the unfired cases that must stay silent — a default off
   its lattice (`in [0, 80] lattice 20 = default 7`), `deltas on a` beside
   `deltas on b`, and a `report` in a sheet with no table. Each variant's
   `check` exit code is `1`, except the silent cases, `0`.
5. **Membership untouched.** `eval --scenario` with `extra_hours = 7` against
   the fixture exits `0` and reports `7`; with `extra_hours = 81` it exits `2`
   with the existing `SCENARIO` message of #241.
6. **`fmt` writes nothing.** `fmt` on the fixture is a byte-identical no-op.
7. **A name bound `report`.** A variant adding `report = 5` to a sheet still
   checks clean, and `eval` prints a `levers.report` line with the value `5`.

The point-set table of §3.1 is covered by a unit test of the lattice validator,
one case per row, including the fault rows. `isIntegral` has a unit test over
the four presets and an `in` range alone.

## 7. Non-goals

- **The `simulate` command**, which questions a sheet is asked (its table rows,
  the lattice grid, a single default question, a `files` statement), the
  `--json` shape of a report, a cap or a progress option, and what each report
  computes and prints ([#259](https://github.com/michal-niedzwiedzki/visimark/issues/259)).
- **A `space` statement.** Dropped by decision on #258: the domain with a
  lattice doubles as the sweep's space. A per-sheet override can return as its
  own row if a real document needs one.
- **A local `reports/` folder or any document-selected code**
  ([§2](../visimark-design.md#2-constraints-that-shaped-the-design),
  constraint 4).
- **A `data()` twin, display names on assertions, a separate simulation file.**
  Not proposed; add each when a real caller needs one.
- **A lattice on a set, on an unbounded domain or on a param with no domain.**
  Refused (§4.1), not extended.
- **Reporting the point count or the grid size** in `check`, `eval` or
  `explain`.
- **Rewording `binding has no =`** for lines that are neither a binding nor a
  known statement. Once `report` is real the motivating case is gone; the
  message is unchanged.
- **Checking that a report's options are meaningful** for the sheet (a
  `deltas` on a scalar no sweep varies, a `best` over a scalar that
  never changes). `check` validates syntax and names only, with one exception
  added by #333: a bare `deltas` in a sheet with no scalar that is not a
  `param` has nothing to read and is `TYPE` (§4.2). A sheet of constants still
  gets a flat reading and no finding.

## 8. Open questions

None.

How the pre-review's open questions closed:

| # | Question | Closed as |
|---|---|---|
| 1 | where the motivating sheet's questions come from | not the language's: a lattice is a document-wide declaration, `simulate` (#259) picks the source for each sheet; a `report` never requires a lattice |
| 2 | several `space` lines | no `space`; lattice params sweep as their Cartesian product, params without one are held (§3.1) |
| 3 | no domain, a set, an open end | `TYPE` (§4.1) |
| 4 | `space` without `report`, `space` with a table | moot; the source rule is #259's |
| 5 | does `check` parse report options | yes, against a closed grammar per report, and resolves each `REF`; it never runs or judges (§3.3, §4.2) |
| 6 | the rule each shipped report computes | not specified here; the names and option grammars are the language contract (§2.2), the rest is #259 |
| 7 | the unknown-statement wording | `report` is a statement now; `binding has no =` unchanged (§7) |
| 8 | duplicate `report` names, two `space` lines for one param | `DUP` on an identical statement; two lattice clauses on one param are malformed (§4) |
| 9 | acceptance | §6 |
| 10 | #241's bound syntax | the clause sits on the same header and restates no bound |

<!--vmark:no-formulas-->
