# Division by zero — feature spec

**Status:** approved (#122) · **Date:** 2026-09-20 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/122#issuecomment-5746529695

## 1. Purpose

A number in a VisiMark document is a decimal. Arithmetic that has no decimal
result must refuse, not invent a sentinel. Today `/` and `MOD` with a zero
divisor leak `decimal.js`'s `Infinity` and `NaN` into evaluation; `check`
reports them as `STALE`; `fmt` writes the words `Infinity` and `NaN` into
owned anchors; `eval --json` lists those strings as values with `"status":
"ok"`. On current `master`, `check` after that `fmt` still disagrees
(`Infinity ≠ Infinity`, `NaN ≠ NaN`), so the written tokens are not document
values at all.

This is a defect against [§7](../visimark-design.md#7-numeric-semantics)
("arithmetic is decimal"; a reader re-adding a column on a calculator gets the
same answer) and constraint 3
([§2](../visimark-design.md#2-constraints-that-shaped-the-design): refuse
rather than pick). `SQRT` of a negative and a non-positive `FLOOR`/`CEILING`
significance already throw `TYPE` on the same path. `/` and `MOD` do not.

**The motivating document** is the reproduction on #122:

````markdown
Net is 10<!--vmark=s.net-->. Ratio 1<!--vmark=s.r-->.

```vmark #s
z = 0
net precision 2 = 100 / z
r precision 2 = 0 / z
m = MOD(5, z)
```
````

A scenario ([#119](https://github.com/michal-niedzwiedzki/visimark/issues/119))
can set a divisor to `"0"` without editing the document, which is why this is
easier to hit now. The document cannot verify a ratio whose denominator is
zero, and existing findings misclassify that as a stale stored value.

## 2. Syntax

None. `/`, `MOD`, `^` and the rest of the operator set are unchanged as
surface syntax. The change is evaluation: a zero divisor is a `TYPE` error,
and a non-finite `Decimal` is never a `Value`.

Constraint 1 ([§2](../visimark-design.md#2-constraints-that-shaped-the-design))
is untouched. A document using `/` still renders as a fenced code block.

## 3. Semantics

A divisor is zero when `Decimal#isZero()` is true. That includes `0`, `0.0`,
`0%`, and `-0`. A non-zero value, however small, is a legal divisor.

`/` and `MOD` test the divisor **before** calling `Decimal.div` / `Decimal.mod`.
A zero divisor throws `EvalError` with message `division by zero` (code
`TYPE`). The same message covers `x / 0`, `0 / 0`, and `MOD(x, 0)`.

Every other operation that produces a `Decimal` still runs as today. After it
returns, a value that is not finite is refused by a guard on the way into a
`Value`: `TYPE`, message `result is not a finite decimal`. That catches
`0 ^ -1` (`Infinity`) and `(-2) ^ 0.5` (`NaN`) without giving `^` a private
error table.

| Case | Expression | Result |
|---|---|---|
| Ordinary division | `100 / 4` | `25` |
| Ordinary remainder | `MOD(7, 3)` | `1` |
| Tiny non-zero divisor | `1 / 0.0001` | `10000` |
| Zero divisor, non-zero dividend | `100 / 0` | `TYPE` `division by zero` |
| Negative zero divisor | `1 / -0` | `TYPE` `division by zero` |
| Zero over zero | `0 / 0` | `TYPE` `division by zero` |
| `MOD` by zero | `MOD(5, 0)` | `TYPE` `division by zero` |
| `MOD` by negative zero | `MOD(5, -0)` | `TYPE` `division by zero` |
| Negative dividend, zero divisor | `-100 / 0` | `TYPE` `division by zero` |
| Motivating `net` | `100 / z` with `z = 0` | `TYPE` `division by zero` |
| Motivating `r` | `0 / z` with `z = 0` | `TYPE` `division by zero` |
| Motivating `m` | `MOD(5, z)` with `z = 0` | `TYPE` `division by zero` |
| Reciprocal of zero via `^` | `0 ^ -1` | `TYPE` `result is not a finite decimal` |
| Non-real power | `(-2) ^ 0.5` | `TYPE` `result is not a finite decimal` |

Units are stripped before the test, as they are for every other numeric
operation ([§7](../visimark-design.md#7-numeric-semantics)). `$0` as a divisor
is still zero.

A failed binding is unevaluable: it contributes no `Value`, no cell, and no
anchor text. Downstream bindings and `assert` statements fold into the existing
per-sheet `NOTE` ([§8](../visimark-design.md#8-evaluation)). Other rows of a
column rule still compute.

## 4. Type rules and errors

No new [§10](../visimark-design.md#10-error-taxonomy) code. `TYPE` already
covers illegal operands.

**At evaluation** ([§8](../visimark-design.md#8-evaluation)):

| Situation | Code | Message | When |
|---|---|---|---|
| `/` whose right operand is a number and `isZero()` | `TYPE` | `division by zero` | evaluation, before `Decimal.div` |
| `MOD(x, y)` whose `y` is a number and `isZero()` | `TYPE` | `division by zero` | evaluation, before `Decimal.mod` |
| A `Decimal` that is not finite would become a `Value` | `TYPE` | `result is not a finite decimal` | evaluation, at the `Value` boundary |
| `/` or `MOD` with a non-number operand | `TYPE` | existing `` `/` expects a number `` / `MOD expects a number` | unchanged |
| `MOD` wrong arity | `TYPE` | existing static arity message | unchanged, static ([§4](../visimark-design.md#4-syntax)) |

`AVG` of an empty column stays `AVG() of an empty column`. A non-positive
`FLOOR`/`CEILING` significance stays that function's own message. Those paths
never produce a non-finite `Decimal`.

### Reporting granularity

Same split as `SQRT` of a negative ([§4](../visimark-design.md#4-syntax),
[§8](../visimark-design.md#8-evaluation)):

- **Column rule, per-row operand.** `Ratio = Amount / Qty` with a zero in one
  `Qty` cell: one `TYPE` finding on that row's cell. Other rows still compute
  and verify.
- **Scalar binding.** `net precision 2 = 100 / z` with `z = 0`: one `TYPE`
  finding on the binding. `fmt` does not rewrite its anchors.

A `PRECISION` finding does not also fire on the same binding. Evaluation
throws before rounding, so there is no width to honour and no ceiling to
test. A binding that both divides by zero and forgot `precision N` reports
only the `TYPE`.

## 5. Interaction with the rest of the language

- **Shape ([§4](../visimark-design.md#4-syntax)).** `/` remains scalar →
  scalar. `MOD` remains a map of arity 2. No boolean is stored. No new
  builtin.
- **Evaluation ([§8](../visimark-design.md#8-evaluation)).** The dependency
  graph is unchanged. An upstream `TYPE` still suppresses dependents into a
  `NOTE`.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** The tool still
  owns computed cells, anchors, and artifacts. `fmt` writes none of those for
  a binding (or row) that threw. It does not write `Infinity` or `NaN`. The
  stored text, including a stale placeholder, is left as the author wrote it.
- **Anchors ([§3](../visimark-design.md#3-document-model)).** An unevaluable
  scalar is not compared to its anchor, so there is no `STALE` next to the
  `TYPE`.
- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).**
  Write precision is unchanged: `/` still bounds nothing; a successful
  division still requires a declared width. `MOD`'s width is still the wider
  of its operands.
- **Dates ([§5](../visimark-design.md#5-dates)).** Unchanged. Date arithmetic
  does not divide.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).**
  Unchanged.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Unchanged:
  stripped for the operation, re-applied on a successful write. There is no
  successful write here.
- **CLI.**
  - `check` reports `TYPE`, exit 1, `1 error`. Not `STALE`.
  - `fmt` leaves the file byte-identical for these bindings; the `TYPE`
    remains.
  - `eval` (text) prints only evaluable values. `eval --json` keeps its
    existing contract: `status` tracks assertion failures only, so a document
    whose only problem is this `TYPE` still has `"status": "ok"`. The failed
    binding is **absent** from `values` (same as `SQRT(-1)` today). `values`
    must not contain `"Infinity"`, `"-Infinity"`, or `"NaN"`.
  - `infer` and `explain` do not gain a special case. `infer` does not propose
    a formula for a binding that does not evaluate. `explain` reports the
    `TYPE` with the rest of the findings.
- **Scenarios ([§20](../visimark-design.md#20-scenario-parameters)).** A
  scenario that sets a param used as a divisor to `"0"` takes this path. The
  defaults in the document are untouched; `check` / `fmt` never see the
  scenario.

**What does not change.** The operator set, the thirteen builtins' signatures,
the finding taxonomy, plugin policy, write-precision derivation, and the
owned-output categories in [§9](../visimark-design.md#9-write-back).

**What the design doc must say.** One sentence on `/` in the [§4](../visimark-design.md#4-syntax)
operators paragraph: a zero divisor is a `TYPE` error. One clause on the
`MOD` function-table cell: a zero divisor is a `TYPE` error. The generated
function reference follows from the registry. The finite-value guard is the
implementation of [§7](../visimark-design.md#7-numeric-semantics)'s "arithmetic
is decimal"; it does not need a new taxonomy row.

## 6. Acceptance

A new fixture, `packages/visimark/test/fixtures/div-zero.md` (or an equivalent
inline source in `test/eval/`), matching the issue's `div.md`:

````markdown
Net is 10<!--vmark=s.net-->. Ratio 1<!--vmark=s.r-->.

```vmark #s
z = 0
net precision 2 = 100 / z
r precision 2 = 0 / z
m = MOD(5, z)
```
````

`visimark check` on that file must report three `TYPE` findings, no `STALE`,
and must not mention `Infinity` or `NaN`. Exact shape (paths aside):

```
  TYPE    s.net             division by zero
  TYPE    s.r               division by zero
  TYPE    s.m               division by zero

  3 problems (0 stale, 3 errors)
```

`fmt` must report the file unchanged and leave the first line
`Net is 10<!--vmark=s.net-->. Ratio 1<!--vmark=s.r-->.`.

`eval --json` must omit `s.net`, `s.r`, and `s.m` from `values`, keep
`"s.z": "0"`, and must not contain `Infinity` or `NaN` anywhere in the
payload. `"status"` stays `"ok"` (no assertion failed).

Additional tests, same messages, covering a column rule (one zero row among
legal rows), `-0`, `0 ^ -1`, and `(-2) ^ 0.5`. `fmt` writes nothing in each
case. Existing example documents (`example-invoice.md`,
`example-invoice-drift.md`, `example-charts.md`) stay byte-identical and keep
their transcripts.

## 7. Non-goals

- A new finding code for domain errors.
- Changing `eval --json`'s `status` to track `TYPE` (that is the existing
  assertion-only contract; out of scope).
- IEEE-style signed infinity, NaN payloads, or a complex type.
- Treating a blank input cell as zero — blank handling is unchanged.
- Changing `AVG` of an empty column, or `FLOOR`/`CEILING` of a non-positive
  significance.
- Infix `%` as modulo ([catalogue §B](../vocabulary-catalogue.md#b-operators),
  `REJECTED`).
- Locale, Excel `#DIV/0!` text, or writing an error token into a cell.

## 8. Open questions

None.
