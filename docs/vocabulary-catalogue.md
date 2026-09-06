# VisiMark — vocabulary catalogue

The language ships **nine functions and a fixed operator set**
([`visimark-design.md` §4](visimark-design.md)). This file is the register of
every proposed addition — mapper, operator, or aggregate — and the decision
taken on it. It exists so the same request is not re-argued from scratch, and so
a "no" has a citable reason.

## Requesting an addition

Open a GitHub issue with the **Vocabulary request** template
([`.github/ISSUE_TEMPLATE/vocabulary-request.yml`](../.github/ISSUE_TEMPLATE/vocabulary-request.yml)).
One primitive per issue.

A request is judged against the design doc's constraints, not against Excel:

1. **It fits the shape system.** A mapper is scalar → scalar; a reducer is
   vector → scalar and takes a bare column reference, never an expression; there
   is no vector → vector (§4, "Shape: map and reduce").
2. **Its value is document-local.** No locale, no clock, no network, no ambient
   data, no config (constraint 4). A value that genuinely comes from outside
   belongs in an input column where a human writes it down, dated and diffable.
3. **It adds no ambiguity.** No implicit coercion whose result depends on
   context; nothing a reader could read two ways (constraint 3).
4. **A real document needs it.** Per §14 a primitive with no motivating document
   is deferred by default — "nothing in either worked example repeats" is why
   user-defined functions are deferred, and the same bar applies here. Paste the
   table and its `vmark` block into the issue.

The maintainer records the outcome in the tables below: the **Request** column
links the issue, the **Status** column links the comment that decided it. The
process for getting from an issue to that comment is
[`vocabulary-review.md`](vocabulary-review.md).

## Status values

| Value | Meaning |
|-------|---------|
| `NEW` | Requested and catalogued; not yet decided. |
| `APPROVED` | Accepted and tracked to implementation. Becomes a row in a design-doc §4 table when it ships. |
| `DEFERRED` | Plausible, but no motivating document yet, or it waits on another decision. Not a "no". |
| `REJECTED` | Declined on a constraint. The linked comment is the reason; reopen only with new information. |

The seed entries below were catalogued from the **2026-09-06** design discussion
and predate the issue tracker, so their **Request** cells are empty. Nothing is
`APPROVED` yet — an addition reaches that state only through an issue carrying a
motivating document.

---

## A. Mappers (scalar → scalar)

Run once per row inside a column rule, or once for a scalar binding. Result is a
number, a date, or a string — never a boolean (§4).

| Name | What it does | Pros | Cons | Request | Status |
|------|--------------|------|------|---------|--------|
| `TEXT(n, places)` | Format a number as a string with exactly `places` decimals: `TEXT(5.5, 2)` → `"5.50"`. | The safe half of string concatenation — an explicit format instead of a guessed one. Cheap, map-shaped. | One more name in the did-you-mean space. Only useful alongside `&`. | — | `DEFERRED` |
| `YEAR(d)` / `MONTH(d)` / `DAY(d)` | Integer field of a date. | Pure, config-free, unambiguous (date → integer). Pairs with `&` for reference numbers. | Thin on its own without `&`. | — | `DEFERRED` |
| `SQRT(x)` | Square root. | Real need in engineering calculations, an explicit target document type. Map-shaped. | Irrational result is rounded at the binding like any other; fine, but worth stating. | — | `DEFERRED` |
| `CEILING(x, mult)` / `FLOOR(x, mult)` | Round `x` up / down to a multiple of `mult`: `CEILING(load, 50)` → next 50. | "Round up to the next standard size / price tier" is a genuine pricing and spec need. | The `mult` argument must be mandatory — a bare `CEILING(x)` invites a hidden "to 1" default. | — | `DEFERRED` |
| `TRUNC(x, places)` | Drop decimals past `places` without rounding. | Distinct from `ROUND`; occasionally the correct operation (tax floors). | Overlaps `ROUND`; easy to reach for by mistake. | — | `DEFERRED` |
| `EOMONTH(d, months)` | Last day of the month `months` calendar months from `d`; the day component of `d` is discarded. Returns a plain date. | "Net EOM" payment terms are common and unreachable by `date ± number`. Needs no month type — a date goes in, a date comes out (§5). The day is discarded before the offset, so it needs no clamp rule and is the ambiguity-free subset of month arithmetic. Leap/calendar math is already required by `date − date`. | Calendar/leap math in the engine. Definitional point pinned here: a `months` offset that overflows the year rolls over (month 13 → January); `months` must be an integer or `TYPE`. A general `date ± n months` / `EDATE` is out of scope of this row and unaddressed by it. | [#6](https://github.com/michal-niedzwiedzki/visimark/issues/6) | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/6#issuecomment-5559247913) |
| `DATE(y, m, d)` | Build a date from numeric parts. | — | You would otherwise write the literal `2026-09-03`; computed components are rare. | — | `DEFERRED` |
| `COALESCE(a, b, …)` | First non-blank argument. | Real tables have optional columns (override price, ad-hoc discount) with no clean path today. | Introduces a **`blank` in-flight value** — a fourth kind beside number/date/string/boolean. `blank + 5` must be defined, and any `blank → 0` is a silent guess (constraint 3). The single change that most "becomes Excel". | — | `DEFERRED` |
| `LEN(s)` / `LEFT` / `RIGHT` / `MID` / `FIND` | String length and substring extraction. | Prefix / embedded-code extraction. | Index base (0 vs 1) is an off-by-one farm; Unicode unit policy (code point vs grapheme) is a real correctness question; `FIND` returns a position that then feeds arithmetic, multiplying the surface. Neither worked example needs it. | — | `DEFERRED` |
| `SIN` / `COS` / `TAN` / `LN` / `LOG` / `EXP` / `PI()` | Transcendental math. | Genuine structural / mechanical calculations. | Computed in binary float internally, which dents the "re-add it on a calculator" promise (§7); radians-vs-degrees is a constraint-3 trap; `PI()` is non-terminating, reopening the precision question. | — | `DEFERRED` |
| `TODAY()` / `NOW()` | Current date / time. | The most-requested Excel date function. | **Violates constraint 4 (no clock)** — the same commit must evaluate identically forever. A due date is `Issued + 30` with `Issued` an input column. | — | `REJECTED` |
| `WORKDAY(d, n)` / `NETWORKDAYS(a, b)` | Business-day arithmetic. | Business-day due dates. | A holiday calendar is ambient data (constraint 4) unless holidays are an input column; "weekend = Sat/Sun" is itself a locale assumption (constraint 3). | — | `REJECTED` |
| `BITAND` / `BITOR` / `XOR` / shifts | Bitwise integer operations. | — | No plausible quote, invoice, budget, or structural-engineering document; an integer-only island in a decimal-number language. | — | `REJECTED` |

## B. Operators

The current set is `+ - * / ^`, comparison `== != < <= > >=`, and `and or not`
(§4). `=` is binding only; `%` is postfix-only so `23%` is never ambiguous.

| Name | What it does | Pros | Cons | Request | Status |
|------|--------------|------|------|---------|--------|
| `&` | Joins strings end to end: `"INV-" & YEAR(d)` → `"INV-2026"`. Dates join as their ISO text. | Computed string columns already exist and are tested (`IF(…, "late", "current")` in the drift example). `&` is a free character — no clash with table `\|`, and the language has no `&&` (it spells them `and` / `or`). | A **number** operand raises "what precision does a number have with no binding to infer from" (constraint 3). Must either refuse numeric operands or require `TEXT(n, places)` — a coercion rule to write into §4. | — | `DEFERRED` |
| `s[a:b]` slice | Substring by position as an operator rather than `MID`. | Terser than a function call. | Same index-base and Unicode-unit problems as the `MID` / `LEFT` family in Section A. | — | `DEFERRED` |
| `%` as infix modulo | `a % b` for remainder. | — | `%` is postfix-only by design so `23%` is unambiguous (§4). `MOD(x, y)` is the remainder. | — | `REJECTED` (settled in §4) |
| `//` integer division | Divide and floor in one operator. | — | Adds a second division operator with its own rounding rule; `TRUNC(a / b, 0)` or `MOD` already express it. | — | `REJECTED` |

## C. Reducers (vector → scalar)

Collapse one column to one value. Every reducer takes exactly one argument, a
bare column reference — `SUM(Price * Qty)` is refused so every intermediate is a
column the reader can see (§4). The current set is `SUM MIN MAX AVG COUNT`.

That last rule has a consequence worth stating plainly: because `SUM(IF(x > 0,
1, 0))` is not expressible, **there is today no way to count or total a subset of
a column without materialising a visible column of 1/0 or masked values** that
pollutes the very table the reader audits. The predicate aggregates below are
the minimal, principled fill for that gap — and "grow the vocabulary in the
engine" is what §14 prescribes over letting a document reach outside itself.

| Name | What it does | Pros | Cons | Request | Status |
|------|--------------|------|------|---------|--------|
| `COUNTNONBLANK(col)` | Number of rows whose cell is non-empty. | "How many line items have a delivered-date filled in" — real. The predicate is evaluated **inside** the reducer and never emits a `blank` that flows anywhere, so it is safe where `COALESCE` is not. Works on any column type. | Needs a defined notion of an empty input cell — which already exists. A different axis (presence) from the sign predicates. | — | `DEFERRED` |
| `COUNTPOSITIVE(col)` / `COUNTNEGATIVE(col)` | Count rows by the sign of a numeric cell. | Dodges `COUNTIF`'s criteria-string mini-language entirely. Variance and reconciliation columns are the use case. | Numbers only (error on a date column — one extra type check each). `COUNTZERO` is their complement against `COUNT`. | — | `DEFERRED` |
| `SUMPOSITIVE(col)` / `SUMNEGATIVE(col)` | Total the positive / negative cells of a column. | Splitting a ledger into debits and credits is **more common than counting** the entries; identical shape and cost to the count variants. | Numbers only. | — | `DEFERRED` |
| `COUNTZERO(col)` / `COUNTNONZERO(col)` | Count rows equal to / not equal to zero. | Completes the sign partition. | Derivable as complements of the above and `COUNT`; ship only if a real document reads better with them named. | — | `DEFERRED` |
| `MEDIAN(col)` / `MODE(col)` | Middle / most-frequent value. | Reporting tables. | An even-count median interpolates to a value not printed in the column, denting the recompute story (§7). Rare in quotes and invoices. | — | `DEFERRED` |
| `PRODUCT(col)` | Multiply a column together. | Compounding factors. | Niche; `^` covers most compounding, and a runaway product overflows precision fast. | — | `DEFERRED` |
| User-defined reducers | `NAME(col) = …` in a block. | — | See below. | — | `REJECTED` |

### User-defined reducers

Rejected, and tied to the spec:

- A user-defined reducer needs **vector parameters**, and the language
  deliberately has none — §14 says so outright ("Users cannot define a reduce,
  because doing so would require vector parameters, and the language does not
  have them").
- Expressing a fold means exposing init / step / combine — a sub-language whose
  logic is **not visible arithmetic**, which breaks the §7 property that a
  reader re-adding the column on a calculator gets the same answer.
- It reopens the macro / plugin hole constraint 4 closed on purpose: a Markdown
  file in a pull request selecting fold logic that CI then executes.
- The named predicate aggregates in this section are the pressure-relief valve.
  They cover the realistic conditional-aggregate cases as readable primitives
  everyone can run, which is exactly what §14 tells you to do instead.

Custom **collectors** — a user-supplied way to accumulate — are the same feature
wearing a different hat and are rejected for the same reasons.

## D. Sorting rules

Row order is currently the author's and the tool never touches it (§9). Whether
a sheet may declare a sort order is a language question, not a vocabulary one —
it changes no expression shape — so it is tracked here rather than in Sections
A–C. **Discussed 2026-09-06; no issue open yet; not a proposal until one is.**

**Shape of the idea.** A `by` clause on the fence info line, next to the sheet
id:

````markdown
```vmark #lines by Net, Name
```
````

`fmt` would reorder the owned table's rows — input cells and computed cells
together — by those columns, ties broken left to right and then by document
order. remark already exposes the whole info string as `node.meta`, and sheet
identity is already parsed out of it (§16), so `#id by a, b` is a small parser
extension, not a new surface.

| | |
|---|---|
| **Pros** | Payment schedules want date order; line-item tables sometimes want alphabetical order — real, recurring. The key sits in the document text, so constraint 4 holds and a reviewer sees the ordering rule. The result is deterministic given the data. Two people adding rows on separate branches converge on the same final order, so the order stops being a fact of edit history and merge conflicts on the table drop. No new value type and no new expression shape — it is a table-level directive, nearly free in the type system. ISO dates already sort lexically (§5), so a date key costs nothing. |
| **Cons** | **It writes to human-owned rows.** §9 says the tool owns computed cells and anchored values and that "everything else … is human territory and is never touched," with `fmt --fix-dates` as *the* single exception, gated behind a flag. Reordering moves input cells — the same category of breach — so `by` has to be opt-in by the same logic, or it quietly redefines the ownership model. **The first `fmt` after adding `by` is a whole-table reshuffle diff** — exactly what the offset splicer exists to avoid (§9, §13: "a one-cell change touches one line"). One-time, but loud. **A key that is a computed column** forces `fmt` to evaluate before it can sort, so a sheet carrying a `CYCLE` or `TYPE` error cannot be ordered — another "skipped because upstream" branch to specify and test, alongside the `UNIT` one. **String order must be pinned** — code-point order is unambiguous and config-free but is not "alphabetical" (`"Banana"` sorts before `"apple"`); that is a sentence in §5-land, not a silent choice. **`by` on a table-less sheet** (`#terms`, `#recon`) is a new `SHEET` error. And it is the first behaviour that looks like presentation, which §1 lists as a non-goal; it invites "then can I group, subtotal, hide a column" — the Excel gravity the format is built to resist. |
| **Cost** | **M**, roughly 2–4 days: parse the clause; sort in `write/` after evaluation; plus the tie-break rule, per-type ordering, descending, the skip-if-unevaluable branch, the table-less error, and a golden-file test proving the one-time reshuffle followed by a byte-stable second `fmt`. |

**Descending.** Worth having — "largest line items first", "most recent payment
first" are ordinary asks, and omitting it just sends people back to hand-ordering,
which the feature was meant to end. `by Net desc, Name` reads cleanly and costs
almost nothing once a key list is parsed: a `desc` (and optional explicit `asc`)
keyword per key. `by -Net` is rejected on sight — it reads as arithmetic and
collides conceptually with unary minus.

**If it is built**, the gate is §9's: declaring `by` is the author explicitly
handing row order to the tool, and `fmt` should reorder only when asked
(`fmt --sort`), or at minimum the format doc must state loudly that a sheet with
`by` has tool-managed rows. Syntax `by Col, Col` with per-key `desc` is the
shape to specify. A decision moves this section from "discussed" to a real
proposal with a `Status`.

<!--vmark:no-formulas-->
