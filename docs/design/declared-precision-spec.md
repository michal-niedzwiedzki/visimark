# Declared precision — feature spec

Status: proposed. Supersedes the inferred-precision rule in
[`visimark-design.md` §7](../visimark-design.md#7-numeric-semantics).

## 1. Purpose

A value's decimal width currently comes from **prose**: a scalar "takes it from
its anchor's current text" ([§7](../visimark-design.md#7-numeric-semantics)).
Because rounding happens at every name binding, prose formatting is therefore an
input to arithmetic. Three consequences, all reachable today with `0 problems`
and exit `0`:

```
fx      = 4.2650
derived = SUM(Rate) * fx        # Rate total 100.00
```

- `fx` unanchored → `derived` is `426.50`.
- add `Rate: 0<!--vmark=s.fx-->` to a sentence → `fx` rounds to `4`, and
  `derived` becomes `400.00`. Mentioning a constant in prose moved a downstream
  figure by 26.50.
- a second anchor at four decimals on an already-rounded scalar renders
  `686.0000` — four decimal places of a value rounded to zero — and the result
  depends on which anchor appears first in the document.

The placeholder is the mechanism: `0` is the natural thing to type for "a number
goes here", and `decimalPlaces("0")` is `0`, an explicit zero-width declaration
that then rounds the stored value.

This spec moves precision out of prose. **A value's precision is an input to the
document or a consequence of its own formula — never derived from how it is
displayed.**

## 2. Syntax

A `precision` clause on a binding head:

```
eur_total       precision 2 = gross_total / fx_eur
"Gross amount"  precision 2 = Net + VAT
gross           precision 2 = Net + VAT          # via an `is` alias
```

- `precision` is a keyword, tokenised beside `is`, `assert` and `chart`
  ([§4](../visimark-design.md#4-syntax)). It may not be a bound name or a column
  header.
- `N` is a non-negative integer literal, `0`–`18`. The upper bound matches the
  default ERC-20 token granularity; `32` was rejected on measurement
  ([§3.5](#35-the-working-precision-ceiling)).
- The clause is legal on a scalar binding and on a column rule, in both the
  identifier and quoted-header forms, and on an alias symbol.
- It is **optional** wherever the precision is derivable ([§3](#3-semantics)),
  and **required** where it is not.

There is no document-scope precision and no sheet-scope precision. The existing
document-scope `precision` constant is removed; no document, example or fixture
in the repository binds it, and it is named in exactly one spec sentence.

`precision = 2` is now a keyword misuse and reports as one, in the style of
[`parser.ts`](../../packages/visimark/src/lang/parser.ts)'s existing keyword
diagnostics:

```
`precision` is a keyword — write `precision 2`, not `precision = 2`
```

## 3. Semantics

### 3.1 Three sources, in order

1. **Declared** — the clause's `N`.
2. **Derived** — from the binding's own expression, where the operation
   preserves precision exactly ([§3.3](#33-derivation-table)).
3. **Neither** — a `PRECISION` error ([§4](#4-type-rules-and-errors)).

Rounding still happens at every name binding and nowhere else, half-up, exactly
as [§7](../visimark-design.md#7-numeric-semantics) already specifies. What
changes is only where the width comes from.

### 3.2 The invariant

**A derived precision never discards a digit.** Every rule in
[§3.3](#33-derivation-table) yields a width the exact result already fits in, so
rounding at a derived precision is a no-op. Only a *declared* precision can lose
digits, and only because the author asked for it.

This is why the table has exactly the shape it does: an operation earns a
derivation rule if and only if its result's scale is bounded by its operands'.
Division, `AVG` and `SQRT` are not, so they have none.

### 3.3 Derivation table

Writing `P(x)` for the precision of `x`:

| Construct | Result precision | Exact because |
|---|---|---|
| number literal | decimals as written | it is the value |
| percent literal | written decimals + 2 | `23%` is exactly `0.23` |
| input column | max decimals over its non-empty cells | the cells are the values |
| input column, no cells | **not derivable** | nothing to infer from |
| `a + b`, `a - b` | `max(P(a), P(b))` | sum of two scales fits the wider |
| `-a` | `P(a)` | sign does not change scale |
| `a * b` | `P(a) + P(b)` | product of `p` and `q` decimals has ≤ `p+q` |
| `a ^ b` | `P(a) × b`, for integer `b ≥ 0` | repeated multiplication |
| `a ^ b`, other `b` | **not derivable** | — |
| `a / b` | **not derivable** | quotients need not terminate |
| `SUM(col)`, `MIN(col)`, `MAX(col)` | `P(col)` | closed over the column's scale |
| `COUNT(col)` | `0` | a count is an integer |
| `AVG(col)` | **not derivable** | it divides |
| `ROUND(x, n)` | `n` | by definition |
| `FLOOR(x, s)`, `CEILING(x, s)` | `P(s)` | the result is a multiple of `s` |
| `ABS(x)` | `P(x)` | magnitude does not change scale |
| `MOD(x, y)` | `max(P(x), P(y))` | the remainder is `x − ky` |
| `IF(c, a, b)` | `max(P(a), P(b))` | the result is one of the branches |
| `SQRT(x)` | **not derivable** | roots need not terminate |
| `EOMONTH`, comparisons, `and`/`or`/`not` | n/a | not numeric |

A binding whose value is a date or a string has no precision; a `precision`
clause on one is a `TYPE` error.

### 3.4 Anchors are outputs only

An anchor's text is **never** a precision source. Every anchor on a scalar
renders that scalar at its governing precision, zero-padded to width. It follows
that:

- a bare anchor (`<!--vmark=s.total-->`, nothing in front of it) is legal
  authoring syntax, and `fmt` seeds it;
- an anchor whose rendered text disagrees with the scalar's precision is `STALE`,
  which `fmt` repairs — so `686.0000`, `0` and an empty anchor all converge on
  the same rendering;
- two anchors on one scalar cannot disagree about precision, because neither is
  consulted.

[§3](../visimark-design.md#3-document-model)'s requirement that a bare text
node's "trailing token is a number" is therefore removed. The remaining
`ANCHOR` cases are an anchor preceded by a genuinely unrewritable node, an
image/chart mismatch, and a comment that announces itself as an anchor but does
not parse.

### 3.5 The working-precision ceiling

[`value.ts`](../../packages/visimark/src/eval/value.ts) sets
`Decimal.precision = 40`, and decimal.js counts that in **significant digits,
not decimal places**. A declared `N` is therefore real only while a value's
integer digits plus `N` stay inside it. Measured at the current setting:

| Expression | `N` | Result |
|---|---|---|
| `100.00 / 7` | 32 | 34 significant digits — correct |
| `1234567890.00 / 7` | 32 | 41 requested; last digit wrong (`…857142857140`) |
| `12345678901234567890.00 / 7` | 32 | 51 requested; tail padded with eleven fabricated zeros |
| all three | 18 | ≤ 38 significant digits — correct |
| 30 ones `/ 7` | 18 | eighteen fabricated zeros: `…873.000000000000000000` |

At `N = 32` the tool prints digits it never computed, which is exactly the class
of claim this feature exists to eliminate. Raising `Decimal.precision` would make
`32` honest, but it slows every operation and interacts with
[§7](../visimark-design.md#7-numeric-semantics)'s guarantee that sub-expressions
carry full precision — a change to argue on its own evidence, not a side effect
of choosing a width cap.

`18` is safe for integer parts up to 22 digits at the current setting. Beyond
that the ceiling still binds, so:

**Requirement.** A value whose integer digits plus its governing precision would
exceed the working precision is **reported, not padded**. Integer digits are not
known statically, so this is a runtime condition and it carries the same
`PRECISION` code ([§4.1](#41-precision--new-code)) rather than a second one.

## 4. Type rules and errors

### 4.1 `PRECISION` — new code

Two triggers:

- **Static** — a binding's precision is **neither declared nor derivable**.
  Decidable from the formula alone, before evaluation, and stable under input
  changes.
- **Runtime** — the governing precision cannot be honoured at this value's
  magnitude ([§3.5](#35-the-working-precision-ceiling)).

- Class: problem/error. Exit `1`.
- `fmt`-fixable: **no.** The missing information is authorial intent, not a value
  the formula is authority over. It sits with ambiguous `DATE`, `UNIT` and
  `CYCLE`.
- One finding per binding, never one per row.

```
  PRECISION  terms.eur_total   `gross_total / fx_eur` has no derivable precision
             Division does not bound its result's decimals. Declare the width:
             `eur_total precision 2 = …`
```

`fmt` must **not** insert the clause. [§10](../visimark-design.md#10-error-taxonomy)
has a tempting precedent — `fmt` completes a missing import stamp because that is
"legal authoring syntax rather than a question for a human" — but inserting a
rule into a block is authoring, not write-back, and `fmt` owns exactly three
things ([§9](../visimark-design.md#9-write-back)). Deriving a width from prose
would also re-establish prose as the authority one final time, invisibly.

`infer` proposes the clause instead ([§5.4](#54-infer)).

### 4.2 Suppression

`PRECISION` participates in [§8](../visimark-design.md#8-evaluation)'s
suppression. A binding carrying it has no defined value, so findings on values
that depend on it fold into the sheet's `NOTE` rather than compounding. A binding
whose operands are already erroring reports the upstream cause, not a second
`PRECISION`.

### 4.3 Existing codes

- `TYPE` — a `precision` clause on a string- or date-valued binding; `N` not a
  non-negative integer literal or out of range; two clauses on one binding; a
  clause on an `assert`, `chart` or `is` statement.
- `DUP` — `precision` used as a bound name or column header, by the
  keyword-collision mechanism [§10](../visimark-design.md#10-error-taxonomy)
  already describes for alias symbols.
- `STALE` widens, per [§3.4](#34-anchors-are-outputs-only). Both new cases are
  `fmt`-repairable.
- `ANCHOR` narrows, per [§3.4](#34-anchors-are-outputs-only).

## 5. Interaction with the rest of the language

### 5.1 Units

Unchanged: a scalar's unit remains the decoration on its anchored value
([§7](../visimark-design.md#7-numeric-semantics)), and two anchors that disagree
are a `UNIT` error. The asymmetry with precision is deliberate and needs one
sentence in [§7](../visimark-design.md#7-numeric-semantics) to say so:
[§15](../visimark-design.md#15-known-tensions)'s
compromise is that a unit is inert and does not compute, so a wrong unit cannot
move a number the way a wrong precision did.

### 5.2 Imports

An imported column's precision is inferred from its fields exactly as a table
column's is from its cells ([§19](../visimark-design.md#19-declared-local-data-imports)
already reads every field with the table-cell literal grammar). A scalar over an
imported column derives through `SUM`/`MIN`/`MAX` as usual. Imported columns take
no `precision` clause — they are read-only, and a column rule on one is already
an `IMPORT` error.

### 5.3 Charts and assertions

Chart series render each value at its precision. `assert` is unaffected and still
offers no rounding tolerance ([§17](../visimark-design.md#17-assertions)) — with
derivation exact, an assertion over derived values is now more predictable, not
less.

### 5.4 `infer`

`infer` proposes `precision N` where it can verify `N` from what the document
already renders — every anchor on the scalar showing the same width, or a
computed column's existing cells — and refuses where anchors disagree or none
exists. This is its existing contract: advisory, exit `0` whatever it finds,
insert-only, and "only rules that reproduce every row exactly — never a best
fit". It already proposes scalars and tracks anchor sites, so this extends
existing machinery.

`visimark infer --write` is therefore the migration command
([§7](#7-migration)).

### 5.5 `explain` and `eval --json`

`explain` gains each binding's precision and whether it was declared or derived —
cheap, and the fastest way to answer "why is this figure this wide?".
`eval --json` values already carry their scale; the contract is unchanged, but
the documented meaning becomes "the declared or derived precision".

## 6. Acceptance

The three normative examples
([§13](../visimark-design.md#13-testing)) keep their guarantees, with
`example-invoice.md` and `example-invoice-drift.md` amended per
[§7](#7-migration).

Two new property tests, the first of which is the invariant whose absence let the
original defect ship:

1. **`fmt` output re-reads identically.** For every fixture, the anchors `fmt`
   writes are found again by the scanner on the next parse. `fmt`'s existing
   idempotency test cannot catch a value the scanner cannot read back, because a
   second `fmt` run reports `unchanged`.
2. **Derivation never loses a digit.** For every binding with a derived
   precision, the exact expression result equals that result rounded to the
   derived width ([§3.2](#32-the-invariant)).
3. **No digit is ever fabricated.** A value whose integer digits plus its
   governing precision exceed the working precision reports `PRECISION` rather
   than padding zeros onto a tail decimal.js never computed
   ([§3.5](#35-the-working-precision-ceiling)).

   The oracle is a **raised working precision**, not inspection: recompute at
   `Decimal.precision = 120` and require the same rendered value. Eyeballing does
   not work — at 23 integer digits and `precision 18` the two agree, while at 30
   the fractional part is eighteen zeros that look orderly and are invented. The
   guarantee is `integer digits + N ≤ Decimal.precision`; past it there is no
   guarantee even where a case happens to agree.

Plus:

- `PRECISION` added to the hardcoded `errorCodes` set in
  [`acceptance.test.ts`](../../packages/visimark/test/acceptance.test.ts) — its
  absence would let the drift error count pass while a sixth error existed.
- `example-invoice-drift.md`'s fenced console transcript regenerated. The test
  extracts it from the document itself, so the documentation cannot drift from
  the implementation without failing the build.
- Unit coverage per derivation rule in [§3.3](#33-derivation-table), including
  the percent-literal case: `vat = 23%` must stay `0.23`. Under an earlier
  formulation ("the literal's own decimal count") it would have rounded to `0`
  and taken every VAT figure in the invoice with it.

## 7. Migration

Declarations fall into two classes, and the distinction matters for review:

- **Required** — the binding is not derivable. Without a clause it is an error.
- **Elective** — the binding derives a width wider than the author wants. Legal
  either way; the clause records a rounding decision.

`example-invoice.md` needs one of each:

```
eur_total       precision 2 = lines.gross_total / fx_eur          # required
early_pay_total precision 2 = lines.gross_total * (1 - early_pay_disc)   # elective
```

The second derives `2 + 2 = 4` decimals exactly; the author keeps two, which is a
genuine rounding decision and now written down. Without the clause `fmt` would
rewrite the anchor to `28085.8200` and break byte-stability.

### 7.1 Document inventory

Measured across `docs/example-*.md`, the bindings at issue are divisions,
averages, square roots and money products. Known cases:

| Document | Binding | Class |
|---|---|---|
| `example-invoice.md` | `eur_total` | required |
| `example-invoice.md` | `early_pay_total` | elective |
| `example-invoice-drift.md` | `eur_total` | already `UNDEF`-poisoned; transcript regenerates |
| `example-ci-sharding.md` | `avg_per_runner` | required |
| `example-quote-plain.md` | `fee_avg` | required |
| `example-structural-check.md` | `w_plf`, `Mallow`, `Lmax` | required |
| `example-onboarding-dashboard.md` | `retention` | none — outermost `ROUND(…, 4)` derives 4 |
| `example-bandwidth.md` | `peak = MAX(gpu_bw)` | none — derives `0` from its column |
| `example-executable-documentation.md` | `MaxNodes` | none — outermost `ROUND` |
| `example-agent-budget.md` | `Cost` | none — column, outermost `ROUND` |

The last four are the point of the closure rules: a flat default would have
silently overridden `retention`'s four declared digits, turned `peak` from `400`
into `400.00`, and broken a live assertion. Every document must still be
re-audited during implementation; this table is the measured starting point, not
a completed audit.

### 7.2 Documentation

Two tiers, and they are not interchangeable:

**Lockstep — tests enforce these, so they land with the code.**

- [`visimark-design.md` §3](../visimark-design.md#3-document-model) — the anchor
  target sentence loses its numeric clause.
- [§4](../visimark-design.md#4-syntax) — the `precision` clause in the binding
  grammar; `precision` added to the reserved words beside `is`, `assert`,
  `chart`; a **precision-behaviour column on the thirteen-function table** and
  the same statement for the operator set.
- [§7](../visimark-design.md#7-numeric-semantics) — "Write precision is inferred,
  not declared" is replaced by [§3](#3-semantics); the document-scope constant
  and its fallback sentence are removed; the unit asymmetry gains a sentence.
- [§9](../visimark-design.md#9-write-back) — anchors render at the governing
  precision; bare anchors are seeded; `fmt` never inserts a clause.
- [§10](../visimark-design.md#10-error-taxonomy) — the `PRECISION` row,
  `fmt`-fixable: no; `STALE` and `ANCHOR` amended in the existing "widened again
  here" idiom.
- [§13](../visimark-design.md#13-testing) — the two new property tests.
- [§14](../visimark-design.md#14-deferred) — per-column *output formats* stay
  deferred; per-column *precision* has landed, and the entry says so.
- [`cli-reference.md`](../cli-reference.md) — the `ANCHOR` row's "has no number
  in front of it to rewrite" wording, and a new `PRECISION` row.
- [`vocabulary-request.yml`](../../.github/ISSUE_TEMPLATE/vocabulary-request.yml)
  — a required `Precision behaviour` dropdown with three options (derives from
  operands / fixed by an argument / not derivable), and a fourth judging bullet
  in the preface.
- [`vocabulary-catalogue.md`](../vocabulary-catalogue.md) — the matching judging
  criterion, and a section E row for this feature.

**Final pass — prose that mentions precision but is not test-enforced.** A
single review step at the end, after the tool's behaviour is settled, covering
`README.md`, the tutorial and narrative examples, the editor-plugin spec, and the
`skills/` copy. Running it earlier means writing prose against behaviour that is
still moving; running it as part of the lockstep tier means blocking the code on
copy edits. It is its own step, and it is the last one.

## 8. Non-goals

- **Rounding discipline.** Half-up stays global and undeclared.
  `ROUND`/`FLOOR`/`CEILING` already express per-binding discipline explicitly, in
  the expression, where a reviewer reads the arithmetic. No `truncated` /
  `half up` / `half even` keyword family.
- **`TRUNC`.** Truncation toward zero is not expressible today — `FLOOR` is
  truncation only for non-negative values, and goes to `-4.57` at `-4.561`. If it
  is needed it is a vocabulary request, not syntax.
- **Document- or sheet-scope precision.** A sheet-level default could only
  override a derivation or suppress a required declaration. The ergonomic want is
  real; a document that feels the pain should make the case.
- **`is precision`.** A column rule is already a binding, so the binding-head
  clause covers it. An *input* column with cells infers exactly; one with no
  cells has no values to be wrong about.
- **Output formats beyond width.** No masks, no thousands separators —
  [§7](../visimark-design.md#7-numeric-semantics) rejects separators and calls
  presentation the renderer's job.
- **Denominations and dimensional analysis** (#41). Complementary, not
  competing: a currency denomination would supply precision for money, but #41's
  scope boundaries exclude percentages and ratios, which is where a flat money
  default is weakest.

## 9. Settled questions

1. **`N`'s upper bound is `18`**, matching the default ERC-20 token granularity.
   `32` was considered and rejected on measurement, not taste — see
   [§3.5](#35-the-working-precision-ceiling).
2. **An empty computed column is `PRECISION`**, with no friendlier finding. It
   is not derivable and it declares nothing; a template table is authored the
   same way as any other document.
3. **`explain` shows the result only**, not a derivation chain. The `P(a) + P(b)`
   notation in [§3.3](#33-derivation-table) is spec shorthand and is not a
   user-facing operator; how the rules are documented for authors is tracked
   separately.
4. **The remaining string-anchor questions are deferred.** [§3.4](#34-anchors-are-outputs-only)
   removes the numeric-trailing-token rule, so a bare string anchor becomes
   `STALE` and `fmt` stops writing documents `check` rejects. What is *not*
   addressed here is the span: `no problem<!--vmark=s.x-->` rewrites only the
   trailing word. That is accepted for now; delimiting a string value —
   whether by `**`, `_` or `"` — is a later discussion, tracked separately.
