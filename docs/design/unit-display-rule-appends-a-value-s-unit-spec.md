# `|unit` display rule — feature spec

**Status:** approved (#323) · **Date:** 2026-10-02 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/323#issuecomment-5953456447

## 1. Purpose

An anchor can already render its scalar differently from the stored value
through a **display rule** (`|percent`, `|nbsp`; [§3](../visimark-design.md#3-document-model),
#297). This spec adds a third, `|unit`, that writes a value's **unit** next to
its number, so the figure and its unit are one span the tool owns and cannot
drift apart.

**Motivating document**, `docs/example-invoice.md` as it stands:

```markdown
Net of tax the engagement comes to **23300.00**<!--vmark=lines.net_total--> PLN.
```

`net_total` is declared `[PLN]` (#317), yet `PLN` sits in the prose, where
`fmt` does not own it. Change the declaration to `EUR`, or the total, and the
sentence is only half updated. After this change:

```markdown
Net of tax the engagement comes to **23300.00 PLN**<!--vmark=lines.net_total|unit-->.
```

**Why existing features do not reach it.** A seed that already reads
`**23300.00 PLN**` is accepted today as an *inferred decoration*: the unit is
whatever the seed shows, a bare seed stays bare, and `fmt` never inserts one.
So nothing states that the unit belongs there. The inferred path also cannot
carry `1/s` or `m^2`: `parseDecorated("50 1/s")` and `parseDecorated("5 m^2")`
are `not-a-number`, so a stale `**50 1/s**` is rewritten by `fmt` to `**50**`
and the unit is lost. This spec fixes both: a rule that **declares** the unit
([§2.1](#21-the-rule)), and a decoration parser that **reads the whole unit
grammar** ([§2.3](#23-the-unit-suffix-of-a-plain-decoration)).

## 2. Syntax

### 2.1 The rule

`ANCHOR_RE` already admits any identifier after `|`; nothing in the grammar
changes. The closed registry in `packages/visimark/src/eval/display-rules.ts`
gains one entry, `unit`:

```ts
interface DisplayRule {
  accepts(v: Value): boolean;                       // type test, unchanged
  render(v: Value, places: number, unit?: UnitMap): string; // unit added
  accepted: string;
  inlineCode: boolean;
  needsUnit: boolean;                               // new; false for percent, nbsp
}
// unit: accepts(v) = v.t === "num"; accepted = "numeric with a unit";
//       inlineCode = true; needsUnit = true
```

```markdown
Net of tax the engagement comes to **23300.00 PLN**<!--vmark=lines.net_total|unit-->.
```

The seed rule is the one every display rule already has: a delimited node
(`strong`, `emphasis`, `inlineCode`) wrapping exactly one text child. A bare
text node is `ANCHOR` ("a display rule needs a delimited seed"). The **owned
span** is that node's whole text content. The unit is always **inside** the
delimiter; there is no outside form.

### 2.2 Rendering

`render` returns `<number> <unit>`:

- `<number>` is the value rounded to the scalar's write precision and printed
  as for any anchor (`showValue`): `-` before the digits for a negative, never
  `-0.00` for a value that rounds to zero.
- `<unit>` is the scalar's unit map in the normalised spelling of
  [#317 spec §3, Printing](algebraic-unit-maps-on-names-spec.md): atoms in
  code-point order, `⋅` between numerator atoms, superscript exponents,
  `1/` when the numerator is empty, `/` before each divisor. A binding that
  *declares* `[J]` prints `J`; one that derives `N⋅m` prints `N⋅m`. Printing
  never expands or contracts a definition.
- The separator is exactly **one U+0020**. The pair may therefore wrap at a
  line end. No existing rule prevents that on a numeric anchor and rules do not
  chain, so the docs state the fact and promise nothing more.

### 2.3 The unit suffix of a plain decoration

`parseDecorated` (`packages/visimark/src/eval/units.ts`) reads a decoration as
a run of characters that are not digits, whitespace, `.`, `-` or `%`. A unit
with a digit in it (`m^2`, `1/s`) therefore fails. It gains a second chance,
tried only when the first pattern fails:

```text
number whitespace+ rest     where  rest parses under the unit grammar
                                   (#317 spec §2.1, via parseUnit)
→ { kind: "number", num, unit: { text: rest, side: "suffix" } }
```

Prefix handling, both-sides detection and the sign rules are unchanged, as is
every text that already parsed. Spelling is **kept**: `Unit.text` is the
author's text, not the normalised one.

Decoration equality becomes **by unit map**. `unitKey` (used to test that a
column's cells agree) keys a suffix that parses as a unit by its normalised
map, and any other decoration by its text as today. `m^2` and `m²` are one
decoration; `PLN` and `EUR` are two.

## 3. Semantics

| Case | Declaration and precision | Seed after `fmt` |
|---|---|---|
| Currency | `total [PLN] precision 2 = 23300 [PLN]` | `**23300.00 PLN**` |
| Negative | `loss [kg] precision 2 = -3.5 [kg]` | `**-3.50 kg**` |
| Exponent | `area [m²] precision 0 = 5 [m²]` | `**5 m²**` |
| Reciprocal | `rate [1/s] precision 0 = 50 [1/s]` | `**50 1/s**` |
| Declared definition | `[J] = [N⋅m]` (document scope), `work [J] precision 1 = 2 [N] * 3 [m]` | `**6.0 J**` |
| Derived, undeclared | `drag precision 1 = 2 [N] * 3 [m] / 1 [s] / 1 [s]` | `**6.0 N⋅m/s²**` |
| Rounds to zero | `tiny [PLN] precision 2 = -0.001 [PLN]` | `**0.00 PLN**` |
| Bare seed | any of the above, seed `**_**` or `**0**` | rewritten as the row above |
| Prefix or bracket seed | seed `**$3.50**` or `**[PLN] 3.50**` | whole span replaced |
| Wrong unit word | seed `**23300.00 EUR**` for a `PLN` scalar | whole span replaced |
| Spelling | seed `**5 m^2**` for `area` | whole span replaced by `5 m²` |
| Inline code | `` `5 m²`<!--vmark=s.area\|unit--> `` | same rendering; `inlineCode: true` |

**Comparison is byte for byte** between the owned span and the rendering, as
for `nbsp`, never numeric (as for `percent`). `23300` against
`23300.00 PLN`, a double space, `m^2` for `m²` and `Pln` for `PLN` are each
`STALE`.

**Write precision.** `|unit` has no precision floor (`5 m²` at `precision 0`
is legal). A scalar with no write precision is not checked at all, unit suffix
included, exactly as for every other rule today.

**Upstream error.** A scalar with no value (suppression, [§8](../visimark-design.md#8-evaluation))
leaves its anchor untouched; no unit is written beside a missing number.

**Several anchors on one scalar.** Each comment is its own rendering. A
`|unit` anchor, a plain `**23300.00 PLN**` anchor, a bare `**23300.00**`
anchor and a `|percent` anchor may coexist on one scalar, except that
`|percent` on a unit-bearing scalar is `TYPE` as today.

**Plain decorations keep their spelling.** A plain anchor or cell decorated
`5 m^2` is read as 5 of `m²`. `check` compares the number numerically (as it
does for `5 m²` today); `fmt` rewrites a stale one as `6 m^2`, preserving the
author's spelling. Only `|unit` normalises spelling, and `fmt --fix-units`
remains the one explicit command that respells brackets; it is **not**
extended to decorations.

## 4. Type rules and errors

No new finding code, no new exit code. `check` exits `1` on each finding
below, as for any finding.

| Condition | Code | Message | `fmt` |
|---|---|---|---|
| `\|unit` on a string, a date, a chart or image target, or a number without a unit (including one that cancels, `6 [PLN] / 2 [PLN]`) | `TYPE` | the shared message, `a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)` | does not touch the scalar's anchors |
| `\|percent` or `\|nbsp` on a unit-bearing number | `TYPE` | unchanged, `\|percent cannot render a value with a unit (PLN)` | unchanged |
| `\|unit` seed is a bare text node | `ANCHOR` | unchanged, `a display rule needs a delimited seed — wrap a placeholder instead, such as **_**` | refused |
| `\|unit` chained (`\|unit\|nbsp`) or an unknown rule name | `ANCHOR` | unchanged | refused |
| owned span differs from the rendering: wrong number, missing unit, wrong unit, non-normal spelling, `$` prefix or brackets, both sides | `STALE` | `<span> ≠ <rendering>`, both in rendered form (`23300.00 PLN ≠ 24000.00 PLN`, `5 m^2 ≠ 5 m²`) | replaces the whole owned span |
| a plain (no-rule) anchor or cell whose unit word differs from the declaration, or has a prefix | `UNIT` | unchanged (`anchor "3.50 EUR" carries EUR, but d declares PLN`) | refused, unchanged |

The last row is the contrast the discussion settled: the **same wrong text**
is `UNIT` (by hand) on a plain anchor and `STALE` (`fmt` repairs it) under
`|unit`, because the comment is what hands the tool ownership of the span.
This is why anchor-decoration inference ignores rule-bearing anchors (§5.1).

The `UNIT` rule "cannot mix a unit with a display rule" is emitted today only
for `|percent`; it stays so. [§3](../visimark-design.md#3-document-model)'s
sentence "A display rule mixed with a unit in the same span is `UNIT`" is
reworded to name `percent` and to exempt `unit`.

## 5. Interaction with the rest of the language

### 5.1 Check and write-back

- **Registry call sites.** `fmt.ts` and `check.ts` call
  `rule.render(v, places)`; both pass the scalar's unit map (from
  `dimensions.unitOf`) as the third argument.
- **The blanket unit block** in `check.ts` (the `TYPE … cannot render a value
  with a unit` emission over `registeredMine`) applies only to rules with
  `needsUnit === false`. A `needsUnit` rule on a dimensionless number is
  handled by `accepts` plus the shared `TYPE` message.
- **Anchor-decoration inference** (`anchorValueText` in `check.ts`) considers
  only anchors **without** a display rule. Otherwise a `|unit` anchor seeded
  `$3.50` would raise the by-hand `UNIT` and block the `STALE` repair, and a
  plain sibling's expected text would borrow the `|unit` anchor's decoration.
  For `|percent` and `|nbsp` seeds the result is unchanged (neither parses as
  a decorated number).
- **`sigilBlocked`** in `fmt` is unchanged: a scalar with a `PRECISION`,
  `TYPE` or `UNIT` finding is not rewritten.
- **`matchesStored`** is untouched; the `|unit` path never calls it.

### 5.2 Unit-grammar decoration (§2.3)

- `inferColumnUnit`, `decorationProblem`, `numericValue`, `cellPrecision`,
  `decimalPlaces` and `infer/verify.ts` read `parseDecorated` and so see
  `5 m^2` and `50 1/s` as numbers with a suffix unit. `decorationProblem`
  already compares by `sameUnit`, so a `[m²]` header accepts `m^2` cells.
- A column that mixes `m^2` and `m²` cells is **not** a decoration conflict
  (§2.3). A column that mixes `m²` and `kg` is, as before.

### 5.3 Commands

`check`, `fmt`, `infer`, `explain`, `eval`, `eval --json` and the did-you-mean
list gain **no** option, key or output. `eval` and `explain` already report
the unit map; `infer` never proposes `|unit`. The LSP and the Obsidian plugin
mark a stale anchor by its `STALE` span, which for `|unit` is the inside seed,
so neither changes. Imports, `param`, `assert`, `chart`, column aliases and
declared precision are untouched: `|unit` is read from a scalar that already
has a unit, and a chart or image target is refused by the existing
display-rule guard.

### 5.4 What does not change

Stored values, evaluation, the finding codes and exit codes, `ANCHOR_RE`,
`fmt --fix-units`, bracketed unit declarations, and every document in `docs/`
that passes `check` today. The one **observable** change to an existing
document is that a plain decoration whose unit contains a digit
(`m^2`, `1/s`) is now read instead of being treated as not a number; no
document in `docs/` contains one, which the plan verifies by running `check`
over every example before and after.

## 6. Acceptance

**Fixture** `packages/visimark/test/fixtures/display-rule-unit.md`:

````markdown
# Units in prose

```vmark
[J] = [N⋅m]
```

```vmark #s
total [PLN] precision 2 = 23300 [PLN]
loss [kg] precision 2 = -3.5 [kg]
area [m²] precision 0 = 5 [m²]
rate [1/s] precision 0 = 50 [1/s]
work [J] precision 1 = 2 [N] * 3 [m]
drag precision 1 = 2 [N] * 3 [m] / 1 [s] / 1 [s]
tiny [PLN] precision 2 = -0.001 [PLN]
```

Total **23300.00 PLN**<!--vmark=s.total|unit-->, loss *-3.50 kg*<!--vmark=s.loss|unit-->,
area `5 m²`<!--vmark=s.area|unit--> and rate **50 1/s**<!--vmark=s.rate|unit-->.
Work **6.0 J**<!--vmark=s.work|unit--> and drag **6.0 N⋅m/s²**<!--vmark=s.drag|unit-->.
Rounded to **0.00 PLN**<!--vmark=s.tiny|unit-->.

A plain sibling keeps its spelling: **5 m^2**<!--vmark=s.area--> and **50 1/s**<!--vmark=s.rate-->.
````

```
$ bun run packages/visimark/src/cli/main.ts check packages/visimark/test/fixtures/display-rule-unit.md
packages/visimark/test/fixtures/display-rule-unit.md

  0 problems (0 stale, 0 errors)
```

Exit `0`; `fmt` prints `unchanged`. `eval --json` is unchanged in shape.

**Drift.** Copy the fixture and change `total` to `24000 [PLN]`:

```
  STALE   s.total                            23300.00 PLN ≠ 24000.00 PLN
  STALE   1 prose anchors bound to the values above

  2 problems (2 stale, 0 errors)
```

Exit `1`. `fmt` prints `…: updated 1 anchor` and the line becomes
`Total **24000.00 PLN**<!--vmark=s.total|unit-->`. Change the declaration and
literal to `[EUR]` instead: one `STALE` (`23300.00 PLN ≠ 23300.00 EUR`), and
`fmt` rewrites only the unit token. A second `fmt` prints `unchanged`.

**Plain sibling.** Change `area` to `6 [m²]`: the `|unit` span and the plain
sibling are each stale; `fmt` writes `6 m²` and `6 m^2` respectively.

**Hand-typed variants.** Replace the `total` span with each of `23300`,
`23300.00`, `23300.00  PLN` (two spaces), `$23300.00`, `[PLN] 23300.00`,
`23300.00 EUR`, `23300.00 pln`: each gives one `STALE` and exit `1`, and `fmt`
restores `23300.00 PLN`. A bare placeholder `**_**` and `**0**` do the same.

**Refusals**, fixture `packages/visimark/test/fixtures/display-rule-unit-errors.md`:

````markdown
```vmark #s
n [PLN] precision 2 = 3 [PLN]
word = "past due"
bare precision 2 = 3
ratio precision 2 = 6 [PLN] / 2 [PLN]
```

Bare 3.00 PLN<!--vmark=s.n|unit-->.
String **_**<!--vmark=s.word|unit-->.
Dimensionless **3.00**<!--vmark=s.bare|unit-->.
Cancelled **3.00**<!--vmark=s.ratio|unit-->.
Percent **_**<!--vmark=s.n|percent-->.
Chained **_**<!--vmark=s.n|unit|nbsp-->.
````

```
packages/visimark/test/fixtures/display-rule-unit-errors.md

  TYPE    s.bare            a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)

  TYPE    s.n               |percent cannot render a value with a unit (PLN)

  TYPE    s.ratio           a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)

  TYPE    s.word            a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only; unit: numeric with a unit)

  ANCHOR  .                 malformed anchor comment — expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name|rule-->`

  ANCHOR  s.n               a display rule needs a delimited seed — wrap a placeholder instead, such as **_**

  6 problems (0 stale, 6 errors)
```

Exit `1`. The order of the lines follows the report's existing ordering; the
test pins the set of `(code, scalar, message)` triples, not the layout.

**Decoration spelling** — fixture `packages/visimark/test/fixtures/decoration-unit-spelling.md`:

````markdown
| Room   | Area [m²] |
|--------|----------:|
| hall   |  12 m^2   |
| office |  30 m²    |

```vmark #flat
total [m²] precision 0 = SUM(Area)
rate [1/s] precision 0 = 50 [1/s]
```

Floor area **42 m^2**<!--vmark=flat.total--> and **50 1/s**<!--vmark=flat.rate-->.
````

`check` exits `0`. Change `hall` to `13 m^2`: one `STALE` on the anchor, and `fmt` writes
`43 m^2`, never `43` and never `43 m²`. A column mixing `12 m^2`, `30 m²` and
`4 kg` is `UNIT`, naming the forms seen.

**Existing examples.** `docs/example-invoice.md` adopts `|unit` on all six
prose anchors followed by `PLN` — the summary sentence's `net_total`,
`vat_total` and `gross_total`, and the `#recon` paragraph's `scheduled`,
`gross_total` and `variance` — each moving `PLN` inside the delimiter, so no
bare `PLN` is left after an anchor. Its sentence "The anchored numbers stay bare — `PLN`
and `EUR` stay in the prose" is replaced to describe `|unit`.
`example-invoice-drift.md` and `example-invoice-csv-import.md` are unchanged
(their expected output is pinned and they do not need the rule). `check` over
every document in `docs/` and `packages/visimark/test/fixtures/` is clean
before and after.

**Drift guard for the rule table.** A test reads the display-rules table in
[§3](../visimark-design.md#3-document-model) of `docs/visimark-design.md`
(the table whose header row is `| Rule | Accepts | Renders | Example seed |
Request |`) and asserts that its first-column names equal the keys of
`DISPLAY_RULES`. Adding a fourth rule without a row fails CI.

## 7. Non-goals

- **A `|currency` rule**, `$`, `€`, minor units. They stay presentation.
- **A `|bare` rule** stripping a unit, and a `|nowrap` rule or any chaining
  (`|unit|nowrap`). Each is its own request and `|nowrap` must answer the
  chaining question itself.
- **An outside form** (`**23300.00**<!--…|unit--> PLN`). Rejected: an atom is
  any run of letters, so a following prose word cannot be told from a wrong
  unit.
- **Normalising decorations everywhere** or extending `fmt --fix-units` to
  cells and anchors.
- **A different separator** (U+00A0).
- **Plurals, locale, a unit table**, and any conversion.
- **A generated display-rules reference** like `function-reference.md`: a
  separate docs issue. This change adds the hand-written table and its drift
  test only.

## 8. Open questions

None.
