# `assert` statements — feature spec

**Status:** approved (#27) · **Date:** 2026-09-07 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/27#issuecomment-5570701059>

## 1. Purpose

VisiMark enforces exactly one class of invariant today: a materialised value equals the formula that owns it (`STALE`). Every other relationship a document depends on — two totals agreeing, a share allocation summing to 1, a variance being zero, a margin staying non-negative, a delivery date not preceding a signature date — can only be *computed* as a number and then read by a human. `check` cannot see that the number is wrong.

`assert <boolean expression>` closes that gap. A `vmark` block may carry `assert` lines; `check` evaluates each and reports an `ASSERT` finding when the expression is false. An assertion binds no name and materialises nothing — it is a check, not a value — so `fmt` never writes one and the "a boolean never reaches a cell" rule ([§4](../visimark-design.md#4-syntax)) is untouched.

Motivating document — `docs/example-invoice.md`, the `#recon` sheet:

````markdown
```vmark #recon
scheduled = SUM(schedule.Amount)
variance  = lines.gross_total - scheduled
```
> …leaving a variance of **0.00**<!--vmark=recon.variance--> PLN.
````

The sheet exists to assert `variance == 0`. Today it cannot. Editing one input cell (`Signature` share `30%` → `20%`) and running `visimark fmt` — the ordinary "propagate my change" step — produces a document that `check` passes with `0 problems` while `recon.variance` is `2865.90` and the schedule covers 90 % of the invoice. `assert variance == 0` makes that a `check` failure.

Existing vocabulary does not reach it: a comparison produces a boolean, and [§4](../visimark-design.md#4-syntax) forbids binding a boolean to a name or writing it to a cell, so there is no way to state "this must hold" at all.

## 2. Syntax

A **statement** form, new to the language — every other line in a `vmark` block is a `name = expression` binding.

```
assert <expression>
```

- `assert` is a **keyword**, tokenised by the lexer alongside `and` / `or` / `not`. It may not be used as a bound name or a column header — `assert = 1` is a `TYPE` error ("`assert` is a keyword"). No example document uses it as a name; the design-doc and changelog entries note the reservation.
- An `assert` line may appear anywhere in a **`#id` sheet block** (`#lines`, or a table-less sheet like `#recon`). Order within the block is irrelevant; assertions evaluate after every binding they depend on, like any other node ([§8](../visimark-design.md#8-evaluation)).
- An `assert` in a **document-scope block** (a `vmark` block with no `#id`) is a `SHEET` error — "`assert` must be in a `#id` sheet block". A cross-cutting invariant goes in whichever sheet is most related to it (`#recon` for a reconciliation check). Document-scope assertions are deferred to a later revision.
- `<expression>` is an ordinary VisiMark expression using the full operator and function set. It resolves names by the [§6](../visimark-design.md#6-name-resolution-and-scoping) rules of the block it sits in: bare names against the sheet's columns, then scalars, then document scope; qualified `sheet.name` anywhere.
- The expression must be **scalar** and **boolean-typed**. `assert MIN(margin) >= 0` is how a row-wise property is written; `assert margin >= 0` with `margin` a column is a `VECTOR` error. Per-row assertions are out of scope (§7).
- No block may bind the *result* — `ok = variance == 0` remains a `TYPE` error ([§4](../visimark-design.md#4-syntax)); `assert` is the only top-level consumer of a boolean.

An `assert` line lives inside a fenced ```vmark block, which every target renderer already shows as an inert code block ([§16](../visimark-design.md#16-renderer-verification)). Nothing new is asked of any renderer.

## 3. Semantics

**Rounding.** `assert` does no rounding and adds no tolerance. Operands are compared exactly, at the decimal precision they already carry from their own bindings ([§7](../visimark-design.md#7-numeric-semantics)). `SUM(Share)` over `0.3333` three times is `0.9999`, and `assert SUM(Share) == 1` is *false* — the author writes `assert ROUND(SUM(Share), 4) == 1`, or rounds `Share` itself. This matches the ISO-date and thousands-separator decisions: no hidden coercion.

| Case | Example | Result |
|---|---|---|
| Expression true | `assert variance == 0`, `variance` = `0.00` | pass — silent, nothing printed |
| Expression false | `assert variance == 0`, `variance` = `2865.90` | `ASSERT` finding (§4); counts as a problem; `check` and `fmt` exit `1` |
| Comparison of rounded operands | `assert covered == gross_total`, both bound and equal | pass |
| Summed fractions | shares `0.30 0.40 0.30` → `assert SUM(Share) == 1` passes; `0.33 0.33 0.33` → `0.99 == 1` → fail |
| Date comparison | `assert delivery >= signature`, both scalar dates | pass / fail by [§5](../visimark-design.md#5-dates) date order |
| Compound | `assert margin >= 0 and covered == gross_total` | `and` / `or` / `not` compose as in any condition ([§4](../visimark-design.md#4-syntax)) |
| Depends on a merely-`STALE` binding | `assert variance == 0` where `variance` is `STALE` | **still evaluated**, against the computed value — a stale *stored* number does not stop the engine computing the real one, and the assertion is about the real one |
| Depends on an unevaluable binding (`UNDEF` / `VECTOR` / `TYPE` / `CYCLE` / `DATE`) | `assert total == 1` where `total = nope + 1` | not evaluated — folded into one per-sheet `NOTE` ([§8](../visimark-design.md#8-evaluation)); disappears when the upstream finding is fixed |
| Reads a name on a `CYCLE` path | — | suppressed into the same `NOTE` |
| In a document-scope block | `assert` with no `#id` on the block | `SHEET` error (§4), static |

An assertion is **anonymous**: it defines no name, nothing can reference it, and it is never a `WARN` for being unread.

## 4. Type rules and errors

New finding **`ASSERT`** ([§10](../visimark-design.md#10-error-taxonomy)): *class* problem; *auto-fixable* no. The design doc gains a **new dedicated section** stating the feature whole, with one-line cross-references from [§8](../visimark-design.md#8-evaluation) (assertion nodes, suppression), [§10](../visimark-design.md#10-error-taxonomy) (the `ASSERT` row) and [§11](../visimark-design.md#11-cli) (the `eval` exit-code widening); `docs/cli-reference.md` gains the finding row and the exit-code note.

| Situation | Code | When |
|---|---|---|
| Assertion expression evaluates `false` | **`ASSERT`** | evaluation time |
| Expression is not boolean (`assert Net + 1`, `assert variance`) | `TYPE` | static, once per `assert` line — "`assert` needs a boolean; `variance` is a number" |
| Expression is a vector (`assert Net > 0`, `Net` a column) | `VECTOR` | static — names the aggregate: "wrap it: `MIN(Net) > 0`, `MAX(...)`, `SUM(...)`" |
| A name in the expression does not resolve | `UNDEF` | static, with did-you-mean |
| `assert` used as a bound name / column header | `TYPE` | static — "`assert` is a reserved word" |
| `assert` in a document-scope (`#id`-less) block | `SHEET` | static — "`assert` must be in a `#id` sheet block" |
| Assertion depends on an **unevaluable** binding (`UNDEF` / `VECTOR` / `TYPE` / `CYCLE` / `DATE`) | `NOTE` | one per sheet, not one per assertion. A merely-`STALE` dependency is not suppressed — the assertion runs against the computed value. |

`ASSERT` is counted in the `N problems` line and makes `check` fail. It joins the `errors` tally in the summary line (`26 problems (21 stale, 5 errors)` → the error count rises). It is never auto-fixed — a false invariant is a question for a human, like `DATE`-undecidable or `CYCLE`.

The `ASSERT` report line (transcript-exact, tested) follows the existing column grid: `ASSERT` in the code field, the sheet id (`#recon`) in the 16-wide id field, then the assertion's source verbatim as the payload. The continuation line, at the content column, is the source with **every named operand substituted by its evaluated value** at its binding precision, followed by `is false`:

```
  ASSERT  #recon         variance == 0
          2865.90 == 0   is false
```

For a compound assertion each named operand is substituted in place; literals and function calls stay as written:

```
  ASSERT  #plan          margin >= 0 and covered == gross_total
          -140.00 >= 0 and 31217.40 == 31217.40   is false
```

A named operand carrying a unit decoration is substituted **bare** (the number only) — the comparison is on the number, as everywhere else ([§7](../visimark-design.md#7-numeric-semantics)). A date operand is substituted as its ISO text.

## 5. Interaction with the rest of the language

| Area | Effect |
|---|---|
| Shape system ([§4](../visimark-design.md#4-syntax)) | Unchanged. `assert` is a third consumer of an in-flight boolean, beside `IF()` and `and` / `or` / `not`. A boolean still never lands in a cell or an anchor. |
| Evaluation / dependency graph ([§8](../visimark-design.md#8-evaluation)) | Each `assert` is a leaf node depending on the names it reads. It sorts and evaluates like any node and has no dependents. It is suppressed to a per-sheet `NOTE` exactly when the engine's existing `Unevaluable` rule fires for one of its dependencies — a merely-`STALE` value is still computed, so an assertion over it still runs. |
| Write-back ([§9](../visimark-design.md#9-write-back)) | Unchanged. `fmt` never reads, writes, or removes an `assert` line; the offset splicer is untouched. A document whose only remaining finding is `ASSERT` is not repairable — `fmt` reports it and exits `1` ("a problem it cannot repair remains"). |
| Anchors ([§3](../visimark-design.md#3-document-model)) | Not used by v1. A prose-anchored assertion is deferred (§7). |
| Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)) | `assert` expressions resolve names exactly as a binding in the same block would. |
| `check` | Evaluates every assertion; reports `ASSERT` / `NOTE`. `COVERAGE` is satisfied by a sheet carrying at least one `assert` even with no column rules — something *is* checked. |
| `fmt` | Evaluates assertions only to report them; writes nothing for them; exits `1` if one is false. |
| `infer` | Never proposes an `assert` — a relation that happens to hold is not evidence of an intended invariant, and the false-positive risk is too high. `infer --write` leaves existing `assert` lines untouched (it only inserts). |
| `explain` | After a sheet's inputs, rules and evaluation order, a trailing `assertions:` block lists each `assert` — its source text, one per line, in document order. |
| `eval` | Evaluates assertions. If any is false, `eval` prints the same `ASSERT` block(s) to stderr and **exits `1`** rather than `0` — it will not return values as if the document were sound. `eval --get NAME` prints the value, then exits non-zero if an assertion anywhere failed. This widens `eval`'s exit contract (today `0` / `2`); noted in `cli-reference.md`. |
| `eval --json` | Gains a top-level `"assertions"` array — one object per assertion: `{"sheet": "recon", "source": "variance == 0", "holds": false, "operands": {"variance": "2865.90"}}`. |
| LSP / VS Code | A false assertion surfaces as a diagnostic on the `assert` line like any `check` finding — no code change beyond the engine. One line in `editors/vscode/CHANGELOG.md`. |
| Dates ([§5](../visimark-design.md#5-dates)), units, precision | Unchanged. `date >= date` in an `assert` uses the existing date order; a unit decoration is stripped for the comparison as everywhere. |

## 6. Acceptance

[§13](../visimark-design.md#13-testing)-style.

**Passing assertion — `docs/example-invoice.md` (`#recon`).** Add one line:

````markdown
```vmark #recon
scheduled = SUM(schedule.Amount)
variance  = lines.gross_total - scheduled
assert variance == 0
```
````

`visimark check docs/example-invoice.md` still prints `0 problems (0 stale, 0 errors)`; `visimark fmt` still leaves the file **byte-for-byte identical**. A new appendix paragraph explains the `assert` line — the sheet now *enforces* the reconciliation it used to only compute.

**`docs/example-invoice-drift.md` is not touched.** Its 26-problem transcript is normative and stays exactly as it is — an `assert` on its already-broken `#recon.variance` would only add a `NOTE`, which is not the demo worth having.

**Failing assertion — new fixture `packages/visimark/test/fixtures/assert-fail.md`** (or the repo's existing fixture location). A `# Share allocation` heading; a two-column table `Milestone | Share` with three input rows whose `Share` cells are `30%`, `40%`, `20%`; and a `#plan` sheet block:

    total = SUM(Share)
    assert total == 1

`Share` is an input column, `total` is `0.90`, and `visimark check` on the file must produce, transcript-exact:

```
<path>/assert-fail.md

  ASSERT  #plan   total == 1
          0.90 == 1   is false

  1 problem (0 stale, 1 error)
```

and exit `1`. `visimark eval <path>/assert-fail.md --get plan.total` prints `0.90` to stdout, the `ASSERT` block to stderr, and exits `1`.

**Unit coverage:** a true assertion (silent, no finding); the fixture above (`ASSERT`, counted, exit 1, value-substituted line); a non-boolean expression (`TYPE`); a vector expression (`VECTOR`, with the wrap-it hint); a document-scope `assert` (`SHEET`); assertions suppressed by an unevaluable dependency (one per-sheet `NOTE`, gone once the upstream finding is fixed); an assertion over a merely-`STALE` value still evaluating; `explain` listing a sheet's assertions; `eval` exiting `1` on a false assertion; the `eval --json` `assertions` array shape; `assert` rejected as a bound name; `fmt` idempotent and byte-stable with an `assert` present.

## 7. Non-goals

- **Per-row assertions.** `assert` takes a scalar. A row-wise property is `assert MIN(col) >= 0`. A per-row `assert` in the column-rule context is deferred until a document needs it.
- **Prose-anchored assertions.** `The schedule covers 100%.<!--vmark-assert=name-->` — deferred; not v1.
- **Named / reusable assertions, assertion groups, severity levels.** An assertion is anonymous and always an error.
- **`infer` proposing assertions.** Rejected (§5).
- **A tolerance primitive (`NEAR`, `APPROX`).** Rejected — rounding is explicit.

## 8. Open questions

None. Resolved during the decision (#27):

- Syntax is the `assert <expr>` keyword; no `ASSERT()` builtin, no naming convention.
- No tolerance; rounding is explicit (`ROUND(...) == 1`).
- Scalar expressions only; per-row assertions deferred.
- `ASSERT` is a new [§10](../visimark-design.md#10-error-taxonomy) finding, exit 1, not auto-fixable, counted under "errors".
- Suppressed to one per-sheet `NOTE` when a dependency is unevaluable (`UNDEF`/`VECTOR`/`TYPE`/`CYCLE`/`DATE`); a merely-`STALE` dependency does **not** suppress — corrected from the original "STALE suppresses" during implementation, because the engine still computes a value behind a `STALE` and the assertion is about that value.
- The failure line substitutes named operands with their values (`0.90 == 1 is false`).
- `eval` exits 1 (hard) on a false assertion, `--get` included.
- v1 is sheet-blocks only; document-scope `assert` is a `SHEET` error, deferred.
- Prose-anchored assertions deferred.
- `infer` never proposes assertions.
- Acceptance: `example-invoice.md` `#recon` gains a passing `assert`; `example-invoice-drift.md` untouched; a new fixture carries the failing-`ASSERT` transcript.

Resolved during plan drafting:

- `assert` is a lexer keyword (not a `build.ts` prefix); the parser grows an assert-statement production.
- The `ASSERT` line puts `#sheet` in the id field and the source as payload; the continuation substitutes named operands.
- `explain` shows a trailing `assertions:` block per sheet.
- The design doc gains a new dedicated section, with cross-references from §8 / §10 / §11.

<!--vmark:no-formulas-->
