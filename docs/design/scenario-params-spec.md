# Scenario parameters — feature spec

**Status:** approved (#119) · **Date:** 2026-09-19 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/119#issuecomment-5740581923

## 1. Purpose

A document computes one answer from one set of numbers. People and agents keep
asking the second question: *what would this come to if the tax rate were 12.5%
instead of 19%?* Today the only way to ask it is to edit the document, run
`fmt`, read the result, and put the edit back. The edit is the problem. It
rewrites stored numbers, anchors and generated charts, and leaves a diff for a
question nobody meant to commit.

This feature lets a document declare which of its scalars may be varied, and
lets `eval`, and only `eval`, run the document with different values for them:

```console
$ visimark eval --scenario tight.json docs/example-agent-budget.md --json > tight-result.json
$ cat tight.json | visimark eval --scenario - docs/example-agent-budget.md
```

The use case is simulation: run the document under a scenario and hand the
result to an external system or an AI agent. The scenario is a transient
argument to one evaluation. It is never written to the document, to a stored
number, to an anchor or to an artifact.

**The motivating document** is
[`example-agent-budget.md`](../example-agent-budget.md). Its `#rates` sheet
holds the session cap a human sets:

```vmark #rates
budget = 2.00
```

and `#calls` asserts `spent <= rates.budget`. A harness planning the next steps
wants to ask *would this session still fit under a $0.40 cap?* before it
commits to the plan. Today it can only answer by editing the document, which is
exactly the edit the ledger's own rules forbid ("never edited by the agent").
With `budget` declared a `param`, the harness asks with `eval --scenario` and
reads the answer from the exit code, and the document is untouched.

Existing features do not reach this. A scalar binding has exactly one value,
fixed in the text. An input column is a value a human writes down and commits,
which is the opposite of a transient question. `eval --get` reads a value but
cannot change one. The only workaround is to copy the file and edit a literal,
which fails silently when the edit misses or misspells its target and gives
the reader no list of which values are meant to vary.

**The one rule everything below follows from:** *the defaults are the document.
A scenario is a view of it.* Every command except `eval --scenario` sees only
the defaults.

## 2. Syntax

A `param` statement is a line in a `vmark` block:

```text
param tax precision 3 = default 19%
param headcount precision 0 = default 40
```

Read aloud: *a parameter, tax, to three decimals, defaulting to 19%.* `param`
says the value may be supplied from outside, and `default` says what it is when
nothing is supplied.

**Grammar:** `param NAME precision N = default LITERAL`, every part required,
in that order. A `param` may add an optional domain clause narrowing its
legal scenario values below `precision N`'s width — see
[`a-param-declares-the-set-of-values-it-ac-spec.md`](a-param-declares-the-set-of-values-it-ac-spec.md),
which extends this spec rather than amending it.

- **`NAME`** is an identifier. A quoted name (`param "Growth" …`) is refused: a
  quoted left-hand side always names a column header
  ([§4](../visimark-design.md#4-syntax)), and a param is never a column. The
  param is a scalar of its sheet, or of document scope in a block with no sheet
  id, and behaves as one everywhere: other bindings, assertions, anchors and
  charts read it by name, locally or as `sheet.name`.
- **`precision N`** is the existing clause
  ([declared-precision-spec §2](declared-precision-spec.md#2-syntax)), with `N`
  from `0` to `18`. It is **required**. A value that arrives from outside has
  no width the document can derive from its own text, and the default's width
  describes the default, not what a scenario may bring. Deriving it would make
  `default 19%` (two decimals) reject `12.5%`.
- **`LITERAL`** is a number literal: an optional leading `-`, digits, an
  optional fraction, an optional trailing `%`. It is a literal and not an
  expression, so the value a reader sees in the document is the value `check`
  uses. A computed value is an ordinary binding. Percent literals fold as they
  do everywhere: `19%` is exactly `0.19`
  ([declared-precision-spec §3.3](declared-precision-spec.md#33-derivation-table)).
- **Numeric only.** A date, a string, or a name after `default` is refused
  ([§4](#4-type-rules-and-errors)).
- A `param` may appear in any sheet that may hold a scalar, including an
  imported sheet ([§19](../visimark-design.md#19-declared-local-data-imports)),
  and at document scope.

**`param` and `default` are contextual keywords, not reserved words.** They are
recognised only in the statement's own positions, the way `as`, `of`,
`labelled` and `aspect` are recognised only inside a `chart` statement
([§18](../visimark-design.md#18-generated-artifacts)):

- `param` is the keyword only as the first token of a statement and followed
  by an identifier or a quoted string. `param = 5` and `param precision 2 = x /
  y` are ordinary bindings of a scalar called `param`, as they are today.
- `default` is the keyword only as the first token after `=` in a statement
  that began with the `param` keyword. Anywhere else it is an ordinary name:
  `default = 3` binds a scalar, and `x = default + 1` reads it.

No existing document changes meaning, and no word becomes reserved.

**In an unmodified renderer** a `param` line is text inside a fenced code
block, like every other binding, so constraint 1
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)) holds.

## 3. Semantics

### 3.1 The default is the value

In `check`, `fmt`, `infer`, `explain` and a plain `eval`, the statement
`param tax precision 3 = default 19%` behaves exactly as the binding
`tax precision 3 = 19%` does today. Stored derived numbers, anchors and
generated artifacts are therefore always the defaults' numbers, and a reviewer
reading the document sees the state `check` verifies.

The default must fit its declared width. `param tax precision 2 = default
12.5%` is a `PRECISION` finding, because the declaration would silently round
the value the author wrote. This is the one literal a declared precision may
not narrow; for every other binding a declared width may discard digits
([§7](../visimark-design.md#7-numeric-semantics)), because there the author
asked for it.

### 3.2 Under a scenario

`eval --scenario FILE` evaluates the same dependency graph
([§8](../visimark-design.md#8-evaluation)) with each supplied param holding its
scenario value and every other param holding its default. Nothing else differs:
the same order, the same rounding at every binding, the same functions.

- **Assertions are evaluated under the scenario**, and a false one exits `1`,
  as in a plain `eval` ([§17](../visimark-design.md#17-assertions)). The values
  are still printed first.
- **A failed assertion says whether it holds on the defaults.** Under a
  scenario `eval` also evaluates the document on its defaults, and each
  assertion that is false under the scenario reports its result there as
  `pass`, `fail`, or `unverified` (not evaluable on the defaults). That tells
  "these assumptions break the cap" from "the cap was already broken", which
  the exit code alone cannot, because `eval` does not assume `check` passed.
  The exit code is `1` either way.
- **Evaluation errors behave as in a plain `eval`.** A scenario value that makes
  a binding fail to evaluate (`SQRT` of a negative, for example) leaves that
  binding out of `values`, and an assertion that depends on it reports
  `holds: null`. No new reporting is added for this case. Division by zero
  is a separate defect, tracked in
  [#122](https://github.com/michal-niedzwiedzki/visimark/issues/122).
- **Stored things are not judged.** `eval` writes nothing. Under a scenario it
  also omits the `state` of each chart entry, keeping its computed `series` and
  `labels`: the artifact on disk was drawn from the defaults and would read as
  `stale` in every scenario.

### 3.3 The scenario file

A JSON object, flat, one key per param, every value a string:

```json
{ "tax": "12.5%", "headcount": "44", "budget.growth": "3.10" }
```

**Keys.** A key is `sheet.name`, or a bare `name` when exactly one param in the
document has that name. A param at document scope is addressed by its bare name
only, as `eval --get` addresses it today.

| Key | Result |
|---|---|
| names a declared `param` | applied |
| names nothing | error, with a did-you-mean over the declared params |
| names a binding that is not a `param` | error: `tax is a rule, not a param` for a scalar, `Price is a column, not a param` for a column |
| a bare name matching params in two sheets | error naming both `sheet.name` forms |
| names the same param twice, literally or once bare and once qualified | error |

A declared param the file does not mention keeps its default. An empty object
`{}` is a valid scenario and equals the defaults. This is strict on purpose: a
misspelled key that was ignored would produce a simulation that looks fine and
is wrong.

**Values** are JSON strings holding exactly a number literal as in
[§2](#2-syntax): an optional `-`, digits, an optional fraction, an optional
`%`. There is no surrounding whitespace, no `+`, no unit decoration, no
thousands separator and no exponent. The string is parsed by the same rules as
a literal in the document, so `"0.1"` is exactly one tenth and a 20-digit
integer keeps every digit.

- **A JSON number is refused**, even a whole one. A JSON number goes through a
  binary float in nearly every producer and parser, so accepting one would lose
  digits or promise an exactness the tool cannot see the producer keep.
  Requiring a string leaves the decimal text, and the responsibility for it,
  with whoever wrote the scenario.
- **A percent param takes a percent value.** When a param's default is written
  as a percent literal, its scenario value must be one too. A producer that
  thinks in percentages writes `"12.5"` as easily as `"12.5%"`, and without this
  rule that value would be 1250%, fit `precision 3`, and pass silently. The rule
  applies one way only: a param with a bare default accepts `"12.5%"`, because
  that literal has one reading. It exists only for scenarios. Input columns may
  still mix `30%` and `0.30`, and `%` is still not a unit
  ([§7](../visimark-design.md#7-numeric-semantics)).
- **Width is checked on the value, and never rounded.** A value with more
  significant decimals than the declared width is refused. Trailing zeros are
  not significant: `"44.0"` is `44` and fits `precision 0`.

Worked cases, for `param tax precision 3 = default 19%`,
`param rate precision 3 = default 0.19` and
`param headcount precision 0 = default 40` in sheet `budget`:

| Scenario | Result |
|---|---|
| none (plain `eval`, `check`, `fmt`) | `tax` 0.19, `rate` 0.19, `headcount` 40 |
| `{}` | same as none; the `scenario` block lists all three as `default` |
| `{"tax": "12.5%"}` | `tax` 0.125; `rate` and `headcount` keep their defaults |
| `{"tax": "12%"}` | `tax` 0.12 |
| `{"tax": "12.50%"}` | `tax` 0.125; the trailing zero is not significant |
| `{"tax": "12.55%"}` | error: 0.1255 has 4 decimals, `tax` declares 3 |
| `{"tax": "12.5"}` | error: `tax` is a percent |
| `{"tax": "0.125"}` | error: `tax` is a percent |
| `{"tax": 12.5}` | error: JSON number |
| `{"rate": "12.5%"}` | `rate` 0.125 |
| `{"rate": "0.1255"}` | error: 4 decimals, `rate` declares 3 |
| `{"headcount": "-3"}` | `headcount` −3; a sign is not restricted, and an `assert` bounds a param where one is needed |
| `{"headcount": "44.0"}` | `headcount` 44 |
| `{"headcount": "44.5"}` | error: 1 decimal, `headcount` declares 0 |
| `{"headcount": "1e3"}`, `"1,000"`, `" 44"`, `"+44"`, `"$44"` | error: not a number literal |
| `{"headcount": true}`, `null`, `[]`, `{}`, `"2026-01-01"` | error: not a number literal |
| `{"budget.tax": "12%", "tax": "13%"}` | error: `tax` given twice |
| `{"taxx": "12%"}` | error: no param `taxx`; did you mean `tax`? |

Downstream rounding is unchanged. With `net precision 2 = 1000 * (1 + tax)`,
`{"tax": "12.5%"}` gives `net` 1125.00, rounded at `net` as always.

## 4. Type rules and errors

### 4.1 Document findings

All static. None is new. A `param` with a finding is treated as any broken
binding is today: its dependants are suppressed under `NOTE`
([§8](../visimark-design.md#8-evaluation)).

| Case | Code | Message |
|---|---|---|
| `param tax = default 19%` (no `precision`) | `PRECISION` | `param tax declares no width` / `write \`param tax precision N = default …\`` |
| `param tax precision 2 = default 12.5%` | `PRECISION` | `default 12.5% has 3 decimals; param tax declares 2` |
| `param tax precision 3 = 19%` (no `default`) | `TYPE` | `expected \`default\` after \`=\` in a param` |
| `default 12.5% * 2`, `default rate`, `default "abc"`, `default 2026-01-01` | `TYPE` | `a param default must be a number literal` |
| `param "Growth" precision 2 = default 4.25` | `TYPE` | `a param name must be an identifier, not a quoted header` |
| a `param` name bound twice in one scope | `DUP` | as for any binding, reported on the second ([§6](../visimark-design.md#6-name-resolution-and-scoping)) |
| a `param` name equal to a header (or imported column) of its sheet | `DUP` | reported on the `param`, whatever the order of table and block; the column keeps its data and rule |
| a `param` nothing reads | `WARN` | the existing unreferenced-scalar `WARN` |

### 4.2 Scenario faults

A scenario fault is not a finding about the document, so it is not a finding.
It is a usage error, like `eval --get nope`: exit `2`, a `visimark: …` line on
stderr naming the key and the reason, and nothing evaluated or printed on
stdout. Under `--json` the envelope has `status: "error"` and `error.code:
"SCENARIO"`, a new code beside `USAGE` and `READ`; a misplaced `--scenario` or
one with no value is `USAGE`, since it is not a fault in the scenario
([structured-output-json-spec §3](structured-output-json-spec.md)). The
[§10](../visimark-design.md#10-error-taxonomy) finding taxonomy does not change.
A param with a declared domain reuses this same `SCENARIO` code for an
out-of-domain scenario value — see
[`a-param-declares-the-set-of-values-it-ac-spec.md` §4.2](a-param-declares-the-set-of-values-it-ac-spec.md#42-scenario-faults-usage-errors-unchanged-code).

| Case | stderr |
|---|---|
| `--scenario` with no value (an invocation fault: `USAGE`, not `SCENARIO`, since #121) | `visimark: --scenario needs a file, or - for stdin` |
| the file cannot be read | `visimark: cannot read scenario tight.json` |
| not JSON, or not a JSON object | `visimark: scenario tight.json is not a JSON object` |
| unknown key | `visimark: scenario key taxx names no param; did you mean tax?` |
| key names a non-param | `visimark: scenario key tax is a rule, not a param` (a scalar) / `visimark: scenario key Price is a column, not a param` (a column) |
| ambiguous bare key | `visimark: scenario key tax is ambiguous: budget.tax, forecast.tax` |
| duplicate | `visimark: scenario key tax is given twice` |
| JSON number | `visimark: scenario value for tax must be a string: write "44"` |
| not a number literal | `visimark: scenario value for headcount is not a number: "1e3"` |
| bare value for a percent param | `visimark: tax is a percent; write "12.5%"` |
| too wide | `visimark: scenario value for tax has 4 decimals; tax declares 3` |
| `--scenario` on another command | `visimark: --scenario is only valid with eval` |

The document is parsed before the scenario is checked, because key checks need
its params. A document that cannot be read fails as it does today. A document
with findings is still evaluated, as in a plain `eval`.

## 5. Interaction with the rest of the language

### 5.1 Language

- **Shape** ([§4](../visimark-design.md#4-syntax)). A param is a numeric scalar.
  No vector, no boolean, no new shape.
- **Evaluation** ([§8](../visimark-design.md#8-evaluation)). A param is a node
  with no inputs. The graph, the order and the `CYCLE` rules are unchanged.
- **Name resolution** ([§6](../visimark-design.md#6-name-resolution-and-scoping)).
  A param is a scalar name in its scope, subject to the same resolution,
  did-you-mean and `DUP` rules.
- **Write-back** ([§9](../visimark-design.md#9-write-back)). The tool owns
  nothing new. `fmt` never writes a param's statement. An anchor on a param
  behaves exactly as an anchor on the equivalent `tax precision 3 = 19%` does
  today, and is always rewritten from the default.
- **Precision** ([§7](../visimark-design.md#7-numeric-semantics)). The width is
  declared. A param with no anchor is never written, as with any scalar.
- **Units** ([§7](../visimark-design.md#7-numeric-semantics)). A param's unit is
  inferred from its anchors as for any scalar. The default literal carries none.

### 5.2 Constraint 4

[§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 4
gains one sentence:

> A scenario supplied to `eval` is an argument to that evaluation, not part of
> the document's meaning: `check`, `fmt` and `infer` never accept one, and
> `eval` reports the scenario it used alongside the values it produced.

Two people checking out the same commit and running `check` still get the same
answer. Two people running `eval --scenario` with the same file do too. A
scenario is data, never code, so the no-plugin rule is untouched.

### 5.3 CLI

```
visimark eval FILE [--scenario FILE|-] [--get NAME] [--json]
```

- **`check`, `fmt`, `infer`, `explain`, `ref`** with `--scenario` exit `2`
  (`visimark: --scenario is only valid with eval`) and read and write nothing:
  a `fmt --scenario` that ignored the flag would exit `0` and let its author
  believe a scenario had been handled. Since
  [#121](https://github.com/michal-niedzwiedzki/visimark/issues/121) this is one
  case of the general rule that every command refuses an option it does not
  accept ([spec](refuse-unrecognised-and-misplaced-cli-options-spec.md)), and
  its `--json` error code is `USAGE`, not `SCENARIO`.
- **`--scenario -`** reads the scenario from stdin. There is no bare-stdin
  form, so a later `eval` reading its document from stdin cannot collide with
  it.
- **Plain `eval`**, text and JSON, is byte-identical to today on every document,
  with or without params.

**`eval --scenario`, text.** The value lines are printed as today, computed
from the scenario. A `scenario:` block follows them, listing every declared
param in document order: its qualified name (bare at document scope), its value
in the same canonical form as the value lines, its source, and for a supplied
param its default. Failed assertions follow, as today, and each says which case
it is:

```
scenario: tight.json
  rates.budget  0.4  scenario  (default 2)
```

```
  ASSERT  #calls   spent <= rates.budget
          0.4266 <= 0.40   is false under scenario (holds on defaults)
```

The three endings are `(holds on defaults)`, `(also false on defaults)` and
`(unverified on defaults)`. `file` prints as given, and as `-` for stdin.

**`eval --scenario`, JSON.** One top-level key, `scenario`, present only under
`--scenario`, placed after `file`. `params` lists every declared param, keyed by
qualified name, with `value` and `default` in the same canonical decimal form
as `values`:

```json
"scenario": {
  "file": "tight.json",
  "params": {
    "rates.budget": { "value": "0.4", "default": "2", "source": "scenario" }
  }
}
```

`source` is `"scenario"` or `"default"`. Each `assertions` entry with `holds:
false` gains `"defaults": "pass" | "fail" | "unverified"`. The key is absent on
other entries and absent everywhere without `--scenario`. Chart entries omit
`state` ([§3.2](#32-under-a-scenario)). `status` follows the exit code as
today.

**`--get` under a scenario** keeps its contract: the text form prints the bare
value and no `scenario:` block, and the JSON form is the same envelope,
including `scenario`, with that one key in `values`.

**`explain`** lists each sheet's params after its scalars:

```
#rates
  inputs:  Model, Input $/M, Output $/M
  params:
    budget   precision 2   default 2.00
  order:   budget
```

The default prints as written in the document. A param is listed under
`params:` and not under `scalars:`; it still appears in `order:`. At document
scope the same `params:` lines follow the `document scope` bindings.
`explain --json` carries the same as a per-sheet `params` array of
`{ "name", "precision", "default" }`, `default` as written and `precision`
`null` when the clause is missing, and document-scope params as a top-level
`documentScopeParams` array of the same shape. Params are not repeated in
`scalars` or `documentScope`. Both keys are present only when there is a param,
so `explain --json` on a document without one is unchanged.

**`infer`** treats a param as the constant binding it is on the defaults. It
never proposes a `param` and never rewrites one.

**The editor extension and language server** need no new surface: findings on
a `param` arrive as diagnostics through the existing path.

## 6. Acceptance

**The motivating document.** In
[`example-agent-budget.md`](../example-agent-budget.md), the `#rates` block
becomes

```vmark #rates
param budget precision 2 = default 2.00
```

and the document gains a short "What-if runs" section, after "The gate",
showing the tight-budget scenario below. On the edited document:

- `visimark check` reports `0 problems`, and `fmt` leaves the file
  byte-identical.
- `visimark eval` prints exactly what it prints before the edit.
- With `tight.json` = `{"budget": "0.40"}`, `visimark eval --scenario
  tight.json docs/example-agent-budget.md` prints, and exits `1`:

  ```
  rates.budget     0.4
  calls.spent      0.4266
  calls.remaining  -0.0266
  calls.Cost       0.1268, 0.0196, 0.0543, 0.0279, 0.198
  scenario: tight.json
    rates.budget  0.4  scenario  (default 2)
    ASSERT  #calls   spent <= rates.budget
            0.4266 <= 0.40   is false under scenario (holds on defaults)
  ```

  Under `--json`: `status: "problems"`, `values["rates.budget"]` is `"0.4"`,
  `scenario.params["rates.budget"]` is
  `{"value": "0.4", "default": "2", "source": "scenario"}`, and the assertion
  entry has `holds: false`, `substituted: "0.4266 <= 0.40"` and
  `defaults: "pass"`.
- With `{"budget": "1.00"}`: exit `0`, `calls.remaining` 0.5734, no `ASSERT`
  lines.
- With `{"budget": "0.405"}`: exit `2`, `SCENARIO`, width. With
  `{"budget": 1}`: exit `2`, `SCENARIO`, JSON number.

The scenario files and the expected outputs live as `test/cli` fixtures.

**Language tests** (`test/lang`, `test/eval`):

- `param` parses with and without a sheet id, and in an imported sheet.
- `param = 5`, `param precision 2 = x / y`, `default = 3`, `x = param +
  default`, and `param` / `default` as column headers all bind and resolve as
  they do today.
- Every row of [§4.1](#41-document-findings) produces its code and message.
- `param tax precision 3 = default 12.5%` evaluates to `0.125` with no finding.
- The `DUP` on a header match fires with the table before and after the block.

**CLI tests** (`test/cli`):

- Plain `eval`, text and `--json`, is byte-identical to before on every
  existing fixture.
- Every row of the worked-cases table in
  [§3.3](#33-the-scenario-file) and every row of
  [§4.2](#42-scenario-faults) produces the stated result, exit code and
  stderr, and a fault prints nothing on stdout.
- A scenario changes values downstream of a param and nothing upstream.
- `--scenario -` reads stdin.
- `check`, `fmt`, `infer`, `explain` and `ref` with `--scenario` exit `2`, and
  the file is byte-identical afterwards.
- `--get` under a scenario prints one bare value and no `scenario:` block.
- `defaults` is `pass`, `fail` and `unverified` in the three cases, and absent
  on a holding assertion and without `--scenario`.
- A chart entry under a scenario has no `state`.
- `explain` and `explain --json` list params as in [§5.3](#53-cli).
- **Round trip:** `fmt`, then `eval --scenario`, then `check`: the document is
  unchanged by the second step and clean after the third.

## 7. Non-goals

- **Table overrides.** Replacing a column, a row or a cell from a scenario,
  including an imported column. That needs a story for row identity, added and
  removed rows, and column types, and the scalar case does not depend on it.
- **Required params**, with no default. The document could not be evaluated
  on its own, and `check` and `fmt` would have nothing to run.
- **Non-numeric params**: dates, strings, booleans. A start date is the likely
  first request.
- **Named scenarios inside the document**, or any way for a scenario to be
  written back. Both would make the transient value durable.
- **Other scenario formats** and per-param overrides on the command line or in
  the environment (`--set tax=12.5%`). A later `--set` must reuse the key and
  value rules of [§3.3](#33-the-scenario-file).
- **Declared bounds on a param.** An `assert` already turns an out-of-range
  scenario into exit `1`. Domain constraints would be a separate feature.
- **Refusing unknown options in general.** Decided separately in
  [#121](https://github.com/michal-niedzwiedzki/visimark/issues/121).
- **Moving `assert`, `chart`, `is` and `precision` to contextual keywords.**
  A separate idea. This spec only makes its own two words contextual.
- **Reporting evaluation errors from `eval`.** A scenario inherits plain
  `eval`'s behaviour. Changing that is a change to `eval` as a whole.

## 8. Open questions

None.
