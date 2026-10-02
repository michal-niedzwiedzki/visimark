# Algebraic unit maps on names — feature spec

**Status:** approved (#317) · **Date:** 2026-10-01 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/317#issuecomment-5934556084

## 1. Purpose

A value carries a **unit map** next to its number: a map from a unit atom
(`kg`, `m`, `PLN`) to a non-zero integer exponent. `+`, `-` and comparison
require equal maps. `*` and `/` combine them. A mismatch is a hard error, so
`5 kg + 3 m` does not evaluate. A unit is declared once, in a bracket right
after a name — on a binding head or on a column header — and nowhere else
except a number literal that needs one.

The motivating document is [`docs/example-invoice.md`](../example-invoice.md).
It converts a PLN total to EUR through a rate that is stated in prose and
nowhere else:

````markdown
```vmark
fx_eur         = 4.2650
```
````

````markdown
```vmark #terms
eur_total       precision 2 = lines.gross_total / fx_eur
```
````

```markdown
**6719.58**<!--vmark=terms.eur_total--> EUR at the ECB reference rate of
4.2650 PLN/EUR recorded on the delivery date.
```

Nothing stops `fx_eur` from being applied to a count, multiplied instead of
divided, or applied to a second currency. `check` passes all three. The same
shape appears wherever a price per unit meets a count (`USD/node/month` times
`node`). An `assert` can pin one number only after someone has written the
invariant down; a column convention ("this header is kilograms") is not
checked at all; and the [§7](../visimark-design.md#7-numeric-semantics) unit
decoration is inert by design — it is stripped before arithmetic and copied
back on write, so it cannot refuse `kg + m` or derive `km/h`.

With this feature the invoice declares three things and every other unit
follows:

```markdown
| Item | Unit | Qty | Rate [PLN] | Net | VAT | Gross |
```

````markdown
```vmark
fx_eur [PLN/EUR] = 4.2650
```
````

````markdown
```vmark #terms
eur_total [EUR] precision 2 = lines.gross_total / fx_eur
```
````

`Rate [PLN]` is PLN per item: `Qty` mixes days, hours and months by row, so it
stays dimensionless. `Net = Qty * Rate` derives `PLN`; `VAT`, `Gross`,
`gross_total`, `schedule.Amount` and `recon.variance` all follow without a
declaration of their own. `infer --write` then pins each of those derived units
as a declaration (`Net [PLN]`, `net_total [PLN]`, …), so the next edit that
changes one is caught; the committed invoice carries them. `gross_total / fx_eur` derives `PLN ÷ PLN/EUR =
EUR`, which the `[EUR]` on `eur_total` checks. A document that adds `PLN` to
`EUR`, or multiplies by the rate instead of dividing, fails `check`.

This reverses [§15](../visimark-design.md#15-known-tensions)'s inert-unit
compromise and clears the units entry of
[§14](../visimark-design.md#14-deferred). It supersedes
[#41](https://github.com/michal-niedzwiedzki/visimark/issues/41). The review is
on [#317](https://github.com/michal-niedzwiedzki/visimark/issues/317): the
pre-review, the discussion summary (whose numbered points 1–28 this spec
closes) and the deciding comment.

## 2. Syntax

### 2.1 The unit expression

One grammar is used everywhere a unit is written — a header, a binding head, a
number literal, a definition, an import's `labelled` list:

```text
unit      := numerator ( "/" factor )*
numerator := "1" | factor ( mul factor )*
factor    := atom exponent?
atom      := "℃" | "℉" | "°"? letter+
exponent  := "^" positive-integer | superscript-digit+
mul       := "⋅" | "*" | "·" | "×"
```

- `letter` is any Unicode letter (general category `L`), so `kg`, `µg`, `Ω`,
  `USD`, `node`, `percent` and `optional` are all atoms. Atoms are opaque and
  case-sensitive: `kg` and `Kg` are different atoms, and nothing knows that
  `m` is a metre.
- `degC`, `°C` and `℃` (U+2103) are **one atom**, spelled `℃`; `degF`, `°F` and
  `℉` (U+2109) are one atom, spelled `℉`. These are the only atoms with more
  than one spelling.
- A `superscript-digit` is one of `⁰¹²³⁴⁵⁶⁷⁸⁹`; `m²` and `m^2` are the same
  factor. An exponent is a positive integer.
- Everything after the first `/` is a divisor, one factor per `/`:
  `USD/node/month` is USD·node⁻¹·month⁻¹. A product after a `/` (`a/b⋅c`) reads
  two ways and is refused; write `a⋅c/b` or `a/b/c`.
- Spaces are allowed around `mul` and `/`, and are otherwise significant:
  `[N m]` is refused (a space is not a product), and so is `[100km]` (an atom
  has no digits).
- `1` may stand only as the numerator of a unit with at least one divisor
  (`1/s`).
- A unit whose map is empty — `[node/node]`, `[1]` — declares no unit and is
  refused.

`⋅` (U+22C5) is the canonical product mark. Outside a bracket it is also a
spelling of the `*` operator ([§4](../visimark-design.md#4-syntax)), so
`width ⋅ height` is `width * height`. `×` and `·` are product marks inside a
bracket only; outside one they are not operators.

### 2.2 Where a unit is written

| Place | Form | Notes |
|---|---|---|
| Scalar binding head | `name [unit] precision N = expr` | The bracket comes immediately after the name, before `precision`. `name precision 2 [unit]` is a parse error. |
| `param` head | `param name [unit] precision N in [lo, hi] = default lit` | Brackets after the name are a unit; brackets after `in` are a domain interval. |
| Column header | `Weight [kg]` | §2.3. A column's unit lives only on its header. |
| Number literal | `10 [PLN]` | Number literals only. Binds tighter than any operator. |
| Document-scope block | `[J] = [N⋅m]` | A scale-1 definition (§2.5). |
| Import declaration | `labelled Item, Qty, Price [USD]` | Also in `unlabelled`, and in the CSV header row itself (§5.8). |

A unit is **not** written on: a column rule's head (`Net [PLN] = …` as a column
rule is `UNIT` — the unit lives on the header); a quoted head
(`"Worker cost" = …`); an `is` line; a name used as an operand (`x [PLN]`); a
string or date literal; a `%` literal (`23% [PLN]`); a `param`'s default
literal or its domain bounds, which take the head's unit (§3).

### 2.3 Header names

The rule applies to a GFM table's header row, a CSV header row, and an
import's `labelled` / `unlabelled` list. A bracket in a body cell is data. The
rule reads the header cell's **source text**, trimmed:

1. **Does it have a unit clause?** Only if the text ends in an unescaped `]`.
   Its partner is the last unescaped `[` before it. Not a unit clause:
   - a footnote reference, `[^…]`;
   - a `[` immediately preceded by `]` — a reference link, `[text][ref]`;
   - an escaped `\[…\]`. This is the opt-out: `Revenue \[1\]` renders as
     `Revenue [1]`, has no unit, and keeps the name a header with no clause has
     always had — its cell text as written, escapes included.

   A header that does not end in `]` — `[x](url)`, `Bandwidth per Unit (TB/s,
   full-duplex)` — has no unit and its whole text is its name, as today. A
   document that also defines `[USD]: https://…` as a link reference does not
   change this: `Price [USD]` is a unit clause, decided from the header's own
   text with no link-definition lookup.
2. **The stem** is everything before the `[`, with trailing whitespace trimmed,
   so `Distance[m]` and `Distance [m]` are the same clause. An empty stem (a
   header that is only `[kg]`) is `UNIT`. So is a stem that itself ends in a
   unit clause (`Speed [m] [s]`): a header has one unit clause.
3. **The unit** is the bracket's content, parsed under §2.1. A content that
   fails the grammar is `UNIT` — the bracket does not fall back to being part
   of the name. `[%]` has its own message (§4).
4. **The name** is the stem's plain text, after inline Markdown is resolved, as
   names are today (`**Weight** [kg]` is the name `Weight`). Only the
   unit-clause detection in step 1 reads source text, and only to find escapes.
   A stem that is one identifier is that column's symbol directly. Any other
   stem is the column's name, reached as a quoted head (`"Worker cost" = …`) or
   through `"Worker cost" is wc`. The full header text — `"Weight [kg]"` —
   never resolves.
5. **Collisions are by name.** `Weight` beside `Weight [kg]`, or `Weight [kg]`
   beside `Weight [lb]`, in one table is `DUP`
   ([§10](../visimark-design.md#10-error-taxonomy)), widening the existing
   two-identical-headers `DUP`.

In an unmodified renderer a header bracket is ordinary text and a declaration
sits inside the `vmark` fence, so constraint 1
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)) holds.

### 2.4 Number literals

`10 [PLN]` is the number `10` with the unit `PLN`. The bracket binds tighter
than any operator: `-10 [PLN]` is `-(10 [PLN])` and `2 * 10 [PLN]` is `PLN`.
Whitespace between the literal and the bracket is optional.

### 2.5 Definitions

`[J] = [N⋅m]` defines the atom on the left as the unit on the right, at scale
1. It is legal only in a document-scope block (no `#id`). The left side is one
atom with no exponent. The right side is any unit and may use other defined
atoms. A definition calls no function and carries no factor; there is no
built-in definition, so `N⋅m` stays `N⋅m` unless the document writes this line.
Definitions are global: every sheet, and every imported sheet, sees them.

## 3. Semantics

**Unit of a value.** Every binding, column and literal has a unit map. The map
is static — it is computed once per binding, before evaluation, never per row.

| Value | Map |
|---|---|
| A number literal with no bracket | dimensionless, except as the literal `0` below |
| `10 [PLN]` | `PLN` |
| An input column with header `Rate [PLN]` | `PLN` |
| An input column with no unit clause | dimensionless |
| A scalar or `param` with no declaration whose right side is a literal | dimensionless |
| A computed binding with no declaration | its derived map, unchecked |
| A binding with a declaration `[D]` | `D`, after the ascription check below |
| A date, string or boolean | no map; they never carry a unit |

Only leaves — input columns, literals, literal-only scalars and params —
default to dimensionless. A computed binding with no declaration carries what
its formula derives: `Amount = Share * lines.gross_total` is `PLN` because
`gross_total` is. It is reported in `eval --json`'s `units` and proposed by
`infer`, but there is nothing to check it against.

**Ascription and the check.** For a binding declared `[D]` whose right side
derives the map `M`:

| Right side | Result |
|---|---|
| unit-free — no operand carries a unit | the binding is `D` (ascribed) |
| `M` equals `D` after expanding definitions | the binding is `D` |
| anything else, including an `M` that is dimensionless by cancellation | `UNIT` mismatch; the binding produces no value |

A right side is unit-free when none of its operands — names, literals, call
results — carries a unit. A map that cancels to nothing is a real
dimensionless result, not an absent one: `share [PLN] = part / total` with
both `PLN` is `share declares PLN but its formula derives dimensionless`.

Ascription applies to a bare literal (`fee [PLN] = 10`), to an expression over
dimensionless operands (`Net [PLN]` with `Net = Qty * Rate`, both bare), to a
`param`'s default, domain bounds and `--scenario` values, and to the cells of
an input column with a header unit. A literal written with `%` is never
ascribed a unit: `rate [PLN] = 23%`, `param tax [PLN] … = default 19%` and a
`23%` cell in a unit column are all `UNIT`. An expression that merely contains
a `%` literal (`23% * x`) is ordinary.

**Operators.**

| Operation | Rule | Example |
|---|---|---|
| `a + b`, `a - b` | maps equal → that map | `5 [kg] + 3 [kg]` → `kg`; `5 [kg] + 3 [m]` → `UNIT` |
| `==` `!=` `<` `<=` `>` `>=` | maps equal; the result is a boolean | `total > 0` passes for any `total` |
| `a * b`, `a ⋅ b` | exponents add | `m * m` → `m²`; `USD/node/month * node` → `USD/month` |
| `a / b` | exponents subtract | `km / h` → `km/h`; `PLN / PLN/EUR` → `EUR`; `PLN / PLN` → dimensionless |
| `a ^ n`, base has a unit | `n` must be a non-negative integer **literal**; exponents multiply | `side ^ 2` → `m²`; `side ^ n` → `UNIT` |
| `a ^ n`, base dimensionless | any dimensionless integer exponent, as today | `(1 + r) ^ years` |
| `-a` | unchanged | |
| `x%` | a dimensionless ratio | `23%` is `0.23` |
| `and` `or` `not` | booleans; no map | |

An exponent of `0` on a unit-bearing base yields dimensionless (`m ^ 0`).
Maps are compared after full expansion of definitions; atoms whose exponents
cancel are removed, so `kg⋅m/s/s` equals `kg⋅m/s²` and `node/node` is
dimensionless.

**The literal `0`.** Wherever two maps must match — `+`, `-`, a comparison,
the two branches of `IF` — a literal `0` (any spelling: `0`, `0.00`) matches
any map. `assert variance == 0`, `IF(late, 0, fee)` and `x + 0` pass for a
unit-bearing `variance`, `fee` or `x`. A computed zero (`a - a`) gets no
exemption; it is an ordinary value with its own map. `0 [PLN]` is legal and
redundant.

**Builtins.** Each builtin carries a unit signature. Notation: `1` is
dimensionless; `any` is accepted and dropped; `U`, `V` are variables that tie
arguments and the result to one map; `bool`, `date`, `string` never carry a
unit; a result may be derived (`U²`, `U·V`, `Uⁿ`).

| Function | Signature |
|---|---|
| `SUM` (`Σ`, `∑`) | `SUM(col: U) → U` |
| `MIN` | `MIN(col: U) → U` |
| `MAX` | `MAX(col: U) → U` |
| `AVG` | `AVG(col: U) → U` |
| `COUNT` | `COUNT(col: any) → 1` |
| `NPV` | `NPV(rate: 1, flows: U) → U` |
| `IRR` | `IRR(flows: U) → 1` |
| `ROUND` | `ROUND(x: U, places: 1) → U` |
| `ABS` (`\|x\|`) | `ABS(x: U) → U` |
| `MOD` | `MOD(x: U, y: U) → U` |
| `SQRT` (`√`) | `SQRT(x: U²) → U` — every exponent of `x` must be even |
| `FLOOR` | `FLOOR(x: U, s: U) → U` |
| `CEILING` | `CEILING(x: U, s: U) → U` |
| `IF` | `IF(cond: bool, a: U, b: U) → U` |
| `EOMONTH` | `EOMONTH(d: date, months: any) → date` |
| `PMT` | `PMT(rate: 1, nper: 1, pv: U) → U` |

Aliases follow their function. `⌊x⌋` and `⌈x⌉` are `FLOOR(x, 1)` and
`CEILING(x, 1)` with the implicit step `1` **in `x`'s own unit**, so
`⌊Weight⌋` is `kg`. An explicit `FLOOR(Weight, 1)` still needs `1 [kg]`.

Operators share the notation: `+(U, U) → U`, `*(U, V) → U·V`,
`/(U, V) → U/V`, `^(U, n: literal) → Uⁿ`.

**Dates.** `date - date` is a dimensionless number of days. `date ± n` takes
`n: any` and returns a date: a `Days [day]` column may be added to a date.
`EOMONTH`'s `months: any` is the same deliberate, named hole — the unit of a
number added to a date is not checked.

**Precision.** A unit changes no width. The bracket is not a precision, every
rule in [§7](../visimark-design.md#7-numeric-semantics) applies unchanged, and
no definition carries a factor, so "re-add it on a calculator" holds exactly.

**Printing.** The normalised form of a map is: numerator atoms with positive
exponents joined by `⋅`, then each divisor atom after its own `/`; exponents as
superscripts; atoms in Unicode code-point order within the numerator and
within the divisors (no locale, so `USD` sorts before `kg`); `1/s` when the
numerator is empty; `℃` and `℉` for the temperature atoms. Examples: `kg⋅m²/s²`,
`USD/month/node`, `N⋅m`, `1/s`, `EUR`. Printing neither expands nor contracts
definitions: a binding declared `[J]` prints `J`, and a derived `N⋅m` prints
`N⋅m` even when `[J] = [N⋅m]` is defined (and still matches `[J]`).

**Cell decorations under a header unit.** Evaluation ignores a decoration, as
today. When the column has a header unit:

| Cell | Result |
|---|---|
| `40` | OK |
| `40 kg`, `40kg` (suffix parses and equals the header unit after expansion) | OK |
| `5 m²` under `[m^2]` | OK — the comparison is parsed, not textual |
| `40 lbs` under `[kg]` | `UNIT` |
| `5 kilogram` under `[kg]` | `UNIT` — atoms are opaque |
| `5 €` (suffix is not a unit) | `UNIT` |
| `$40.00` (any prefix decoration) | `UNIT` |
| `5%` | `UNIT` |
| mixed bare and decorated, or two different decorations | `UNIT`, as today |

A column with no header unit keeps today's inert decorations unchanged, prefix
or suffix. Write-back re-applies a column's uniform decoration exactly as
[§9](../visimark-design.md#9-write-back) does today. The same table applies to
the text of an anchored span of a scalar with a declared unit.

## 4. Type rules and errors

Every unit problem is `UNIT` — the code is widened, not joined by a new one —
except where an existing code already names the problem. All are found by a
static pass after the document is built and before anything is evaluated. A
binding with a unit error produces no value; everything downstream of it, its
anchors, and any `assert` or chart that reads it are suppressed into `NOTE`
([§8](../visimark-design.md#8-evaluation)). One root cause, one finding.

| Case | Code | Message |
|---|---|---|
| Declared unit ≠ derived | `UNIT` | `per_hour declares kcal/h but its formula derives kcal` |
| `+`, `-` on different maps | `UNIT` | `+ needs matching units: kg and m` |
| Comparison on different maps | `UNIT` | `== needs matching units: PLN and EUR` |
| `IF` branches differ | `UNIT` | `IF's branches need matching units: PLN and EUR` |
| A tied builtin argument differs | `UNIT` | `MOD needs matching units: kg and g` |
| A `1` argument carries a unit | `UNIT` | `ROUND's places must be dimensionless, not kg` |
| `^` with a non-literal exponent on a unit-bearing base | `UNIT` | `^ needs a literal exponent when its base has a unit (m)` |
| `SQRT` of an odd exponent | `UNIT` | `SQRT needs even exponents; m has an odd one` |
| A bracket that fails the grammar | `UNIT` | `[100km] is not a unit — an atom is letters only` · `[N m] is not a unit — write a product as N⋅m` · `[a/b⋅c] is ambiguous — write a⋅c/b or a/b/c` |
| `[%]` | `UNIT` | `[%] is not a unit — % is number syntax (23% is 0.23); drop the bracket` |
| An empty map (`[]`, `[1]`, `[node/node]`) | `UNIT` | `[node/node] declares no unit` |
| A `%` literal given a unit (inline, ascribed, or a cell) | `UNIT` | `23% is a ratio and cannot carry a unit` |
| A bracket on a name operand | `UNIT` | `a unit can be written only on a number literal` |
| A bracket on a column rule's head | `UNIT` | `Net's unit is declared on its header, not on its rule` |
| A bracket on a `param` default or domain bound | `UNIT` | `a param's unit is declared on its head` |
| A unit on a date or string binding or column | `UNIT` | `a date cannot carry a unit` / `a string cannot carry a unit` |
| Header with an empty stem, or two unit clauses | `UNIT` | `a header needs a name before its unit` / `a header has one unit clause` |
| Cell decoration disagrees | `UNIT` | `cell "40 lbs" carries lbs, but the column declares kg` · `cell "$40.00" has a prefix, which a column with a unit forbids` · `cell "5 €" carries "€", which is not a unit` · `5% is a ratio and cannot carry a unit` |
| An anchored span of a declared scalar disagrees | `UNIT` | `anchor "40 lbs" carries lbs, but weight declares kg` |
| `^` with an exponent that carries a unit | `UNIT` | `^ needs a dimensionless exponent, not kg` |
| Chart value columns differ | `UNIT` | `chart cost needs one unit across its columns: Net is PLN, Hours is h` |
| Import's `labelled` unit ≠ CSV header unit | `UNIT` | `Price is declared USD in labelled but EUR in the CSV header` |
| A display rule on a unit-bearing value | `TYPE` | `\|percent cannot render a value with a unit (PLN)` |
| `name precision 2 [unit]` | `TYPE` | `the unit comes before precision: name [unit] precision N` |
| Two headers with one name | `DUP` | as today for duplicate headers, naming both positions |
| A definition in a `#id` block | `SHEET` | `a unit definition belongs in a document-scope block` |
| A definition's left side is not one atom | `UNIT` | `a definition defines one atom` |
| `[x] = [1]` | `UNIT` | `a unit cannot be defined as dimensionless` |
| An atom defined twice (even identically) | `DUP` | `[J] is already defined at line N` |
| A definition cycle, or self-reference | `CYCLE` | `[a] → [b] → [a]` |
| A definition nothing uses | `WARN` | `[J] is defined and never used` |
| `"Weight [kg]"` does not resolve | `UNDEF` | `unknown name "Weight [kg]"` with the hint `the header's name is Weight; [kg] is its unit` in place of the edit-distance suggestion |

`check` exits `1` on any of these, as on any error. There is no new exit code.
No sentinel value stands in for a refused binding: it has no value, `eval`
reports it as for any other erroring binding today, and its anchors are not
rewritten.

## 5. Interaction with the rest of the language

### 5.1 Shape system ([§4](../visimark-design.md#4-syntax))

A unit is orthogonal to shape. A column has one map for every row; a reducer
maps a column's map to its result by its signature; a foreign column carries
its unit (`SUM(schedule.Amount)` keeps `Amount`'s map). A unit is global — there
is no qualified unit. No boolean is stored.

### 5.2 Evaluation ([§8](../visimark-design.md#8-evaluation))

The unit pass runs over the dependency graph after the build and before
evaluation, in the same topological order. It reads no value. Definitions are
resolved first; a definition `CYCLE` is reported once and every unit that
expands through it is suppressed.

### 5.3 Write-back ([§9](../visimark-design.md#9-write-back))

The tool gains no new owned category. Two opt-in writers touch human text and
are named in §9 beside `--fix-dates`:

- **`infer --write`** may add a missing derived unit to a computed column's
  header (`Speed` → `Speed [m/s]`) or a scalar's head (`speed = …` →
  `speed [m/s] = …`). It writes only where no declaration exists and the
  derived map is non-empty, in normalised form, and writes no `is` line for the
  suffix. It never rewrites an existing declaration and never invents a unit
  for an input column. A second run on an unchanged document writes nothing.
  The first write records whatever the formula derives, including a wrong
  unit; the check becomes real on the next edit.
- **`fmt --fix-units`** rewrites the text of every existing bracket — headers,
  heads, literal brackets, definitions, import lists — to the normalised form
  of that bracket's own map (§3 Printing): product marks become `⋅`, `^n`
  becomes superscripts, atoms are ordered, `degC` and `°C` become `℃` (`degF`
  and `°F` become `℉`), and
  repeated or cancelling atoms are merged. It never expands or contracts a
  definition (`kg⋅m²/s²` is not renamed `J`), never changes a map, never
  touches a bracket that fails the grammar, a cell decoration or prose, and
  never adds or removes a declaration.

Plain `fmt` neither adds nor removes a unit declaration. One changed input
still changes one computed cell; cell text stays a number, so no cell gains a
unit suffix it did not have. Adding a header suffix changes the header line
only; the splicer does not re-pad the column.

### 5.4 Anchors ([§3](../visimark-design.md#3-document-model))

An anchor writes the bare number, as today, and the invoice's `PLN` stays in
the prose. A `|unit` display rule is out of scope (§7). *(Superseded by #323: the
[`|unit` display rule](unit-display-rule-appends-a-value-s-unit-spec.md) now
prints the unit inside the anchor's span, and the invoice uses it.)* Every display rule
receives the value's unit and refuses a unit-bearing value with `TYPE`. The
decoration rules of §3 apply to an anchored span of a scalar with a declared
unit.

### 5.5 Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping))

A header with a unit clause is named by its stem (§2.3). A quoted head and an
`is` alias match a header's **name**, not its full text — identical to today
for every header without a unit clause. An alias is a second key for the
column, so it shares the column's unit. Atoms and names are separate
namespaces: an atom `m` and a scalar `m` do not collide.

### 5.6 `param` ([§20](../visimark-design.md#20-scenario-parameters))

`param rate [PLN/EUR] precision 4 in [4.0, 4.5] = default 4.2650` is legal.
The default, the domain bounds and every `--scenario` value take the declared
unit. Scenarios cannot change a unit, and a scenario file carries no units.

### 5.7 `assert` ([§17](../visimark-design.md#17-assertions)) and charts ([§18](../visimark-design.md#18-generated-artifacts))

An `assert` is a comparison and follows its rule; `assert variance == 0` uses
the literal-`0` exemption. A chart's value columns (`of <cols>`) must share one
map after expansion — a declared column beside a dimensionless one is a
mismatch; the `labelled` column is not counted. The SVG does not show the unit
and its bytes do not change.

### 5.8 Imports ([§19](../visimark-design.md#19-declared-local-data-imports))

A unit may be given in the import declaration:
`vmark #prices from prices.csv labelled Item, Qty, Price [USD]` against a CSV
header `Item,Qty,Price`. `labelled` asserts the header's **names**; the
bracket adds the unit. A CSV header that carries its own bracket
(`Price [USD]`) is parsed by §2.3. When both give a unit and they differ, that
is `UNIT`; when one does, it applies. `unlabelled Item, Qty, Price [USD]` takes
brackets the same way. Imported sheets resolve units against the document's
definitions. `infer --write` never writes into a CSV.

### 5.9 Commands

- **`check`** — runs the unit pass; reports §4's findings; writes nothing.
- **`eval`** text — a unit-bearing name prints its normalised unit in brackets
  after the name, mirroring the declaration:
  `terms.eur_total [EUR]  6719.58`. A dimensionless name prints as today.
  `--get NAME` prints the bare value only.
- **`eval --json`** — `values` keys a bracketed column by its name
  (`s.Weight`). A sibling `units` object, always present (`{}` when empty),
  holds one entry for every name that has a unit — computed bindings and
  declared input columns alike, so it may hold keys `values` lacks. The value is
  the exponent map with atoms in code-point order, unexpanded:
  `"units": { "s.work": { "kg": 1, "m": 2, "s": -2 } }`. A dimensionless name is
  absent; an alias is absent; the canonical name is present. Keys follow
  `values` order, then declared input columns in sheet order. The normalised
  spelling is text output only.
- **`explain`** — an input with a unit is listed with it (`Rate [PLN]`); each
  rule and scalar gains a unit annotation after its precision —
  `[PLN] (declared)` or `[PLN] (derived)`, omitted when dimensionless;
  definitions are listed under document scope. `explain --json` gains a `unit`
  member on each binding, `{ "map": {…}, "source": "declared" | "derived" }`, an
  `inputUnits` map on a sheet whose inputs declare units, and a top-level
  `unitDefinitions` list when the document has any.
- **`infer`** — a new `units` section lists each proposal with its target:
  `Speed  [m/s]  header` or `speed  [m/s]  head`. Units are read off the
  document as it will be after this run's own rules are written, so a scalar
  `infer` adds carries its unit in its rule, a column rule it adds gets its
  header suffix in the same pass, and one `--write` is idempotent. `infer --json`
  lists each as a proposal of kind `unit` with `unit` and `target` (`"header"` or
  `"head"`), and `written` gains a `units` count; the text summary says
  `wrote 2 units`. `infer`
  offers no acronym for a header with a unit clause whose stem is an
  identifier; for a non-identifier stem it offers an alias for the stem
  (`"Worker cost" is wc`), never for the full text.
- **`ref NAME`** — prints the function's unit signature on a `units` line.
  `ref --json` gains `"units": { "params": { "<param>": "<sig>" }, "returns":
  "<sig>", "text": "<the whole signature>" }`. The signature is stored in the `FnDoc` in
  `packages/visimark/src/lang/reference.ts`, next to `precision`, so the
  generated function table and `function-reference.md` show it too.
- **`fmt`** — `--fix-units` as §5.3. Refused on every other command with exit
  `2`, through the existing unrecognised-option path.
- **LSP / VS Code** — hover on a binding or column shows its unit and source;
  hover on a builtin shows its unit signature. Diagnostics follow the findings.
- **MCP server and playground** — consume the engine's output. The MCP `eval`
  tool emits the same `units` object as `eval --json`; nothing else of their
  own changes.

### 5.10 What does not change

Precision, rounding, and every `PRECISION` rule. The dependency graph's
structure. Anchor write-back. Exit codes. The `%` rule. Every header with no
trailing unit clause, including `docs/example-bandwidth.md`'s parentheses.
Every column with no header unit, including its decorations. `fmt` without
`--fix-units`. No document under `docs/` that passes `check` today stops
passing (none has a header ending in `]`); the breaks are confined to documents
outside the repository that use a bracketed header, a quoted alias of one, or
the `eval --json` key of one.

## 6. Acceptance

1. **The invoice.** `docs/example-invoice.md` gains `Rate [PLN]` on its header
   (column re-padded by hand), `fx_eur [PLN/EUR] = 4.2650`, and
   `eur_total [EUR] precision 2 = …`, then the twelve units `infer --write`
   pins (tables and heads re-aligned by hand). Then:

   ```text
   $ visimark check docs/example-invoice.md
   docs/example-invoice.md

     0 problems (0 stale, 0 errors)
   $ echo $?
   0
   ```

   `visimark eval docs/example-invoice.md` prints:

   ```text
   vat                          0.23
   early_pay_disc               0.02
   fx_eur [PLN/EUR]             4.265
   lines.net_total [PLN]        23300
   lines.vat_total [PLN]        5359
   lines.gross_total [PLN]      28659
   schedule.covered [PLN]       28659
   terms.early_pay_total [PLN]  28085.82
   terms.early_pay_saved [PLN]  573.18
   terms.eur_total [EUR]        6719.58
   recon.scheduled [PLN]        28659
   recon.variance [PLN]         0
   lines.Net [PLN]              3600, 14080, 2500, 3120
   lines.VAT [PLN]              828, 3238.4, 575, 717.6
   lines.Gross [PLN]            4428, 17318.4, 3075, 3837.6
   schedule.Amount [PLN]        8597.7, 11463.6, 8597.7
   ```

   `eval --json` keeps every existing `values` key and adds:

   ```json
   "units": {
     "fx_eur": { "EUR": -1, "PLN": 1 },
     "lines.net_total": { "PLN": 1 },
     "lines.vat_total": { "PLN": 1 },
     "lines.gross_total": { "PLN": 1 },
     "schedule.covered": { "PLN": 1 },
     "terms.early_pay_total": { "PLN": 1 },
     "terms.early_pay_saved": { "PLN": 1 },
     "terms.eur_total": { "EUR": 1 },
     "recon.scheduled": { "PLN": 1 },
     "recon.variance": { "PLN": 1 },
     "lines.Net": { "PLN": 1 },
     "lines.VAT": { "PLN": 1 },
     "lines.Gross": { "PLN": 1 },
     "schedule.Amount": { "PLN": 1 },
     "lines.Rate": { "PLN": 1 }
   }
   ```

   Changing `eur_total`'s formula to `lines.gross_total * fx_eur` makes `check`
   exit `1` with
   `UNIT    terms.eur_total   eur_total declares EUR but its formula derives PLN²/EUR`.

2. **A fixture per row of §4's table**, under the CLI test suite, each asserting
   the code, the location and the exact message.

3. **The header rule.** A fixture with `| Weight [kg] | Count |` and
   `total [kg] = SUM(Weight)` passes; `units` holds `"s.Weight": {"kg": 1}` and
   `"s.total": {"kg": 1}`; `Count` is absent; `"Weight [kg]" is w` is `UNDEF`
   with the hint. `Revenue \[1\]` has no unit and no finding;
   `Revenue [1]` is `UNIT`; `[x](url)` and a `[^1]` footnote header are plain
   names.

4. **Ascription and literals.** `metabolic_rate [kcal] precision 0 = 1600`,
   `hours [h] = 24`, `per_hour [kcal/h] = metabolic_rate / hours` passes;
   `per_hour [kcal/h] = metabolic_rate / 24` is the §4 mismatch message.
   `Net [PLN] = Qty * Rate + 10 [PLN]` passes with `Rate [PLN]` and bare `Qty`;
   `+ 10` without the bracket is `+ needs matching units: PLN and dimensionless`
   (the dimensionless side prints as `dimensionless`). `part [PLN] = 3`,
   `total [PLN] = 4`, `share [PLN] = part / total` is
   `share declares PLN but its formula derives dimensionless`.

5. **Definitions.** `[J] = [N⋅m]`, `force [N] = 10`, `distance [m] = 3`,
   `work [J] = force ⋅ distance` passes and `eval` prints `work [J]  30`;
   without the definition it is the mismatch message.

6. **`infer --write`** on a computed column `Speed = Distance / Duration` with
   `Distance [m]`, `Duration [s]` rewrites the header to `Speed [m/s]` and
   nothing else; a second run writes nothing.

7. **`fmt --fix-units`** rewrites `[kg*m^2/s^2]` to `[kg⋅m²/s²]`,
   `[node⋅USD/month]` to `[USD⋅node/month]`, `[degC]` to `[℃]`, `[°F]` to
   `[℉]`; plain `fmt` leaves all four alone.

8. **No regression.** `check` exits `0` on every document under `docs/` that
   passes today.

## 7. Non-goals

- **A `|unit` display rule** printing an anchor's unit — a follow-up issue in
  the display-rule family. *(Since specified and approved as #323:
  [`|unit` display rule](unit-display-rule-appends-a-value-s-unit-spec.md).)*
- **A `|currency` display rule** and any treatment of `$`, `€`, `£`, `¥`. They
  stay presentation; `$` is not `USD`; no minor-unit table; `infer` never
  proposes a precision from a currency code.
- **A `|bare` display rule** stripping a unit.
- **Lifting a uniform cell decoration into a header.** Dropped; it may return
  later as an `infer` capability.
- **Conversion by any factor other than 1**, SI prefixes, numeric prefixes
  (`l/100km`), multi-hop conversion, live rates, affine units beyond the opaque
  `℃` and `℉` atoms (no °C ↔ K arithmetic), logarithmic units, a dimension layer
  (`mass`, `length`), and any definition that calls a function.
- **The `Col :: "unit"` form** and units in a `--scenario` file.
- **A unit in a chart's SVG.**

## 8. Open questions

None.

<!--vmark:no-formulas-->
