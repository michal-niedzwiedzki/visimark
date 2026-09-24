# Declared domain on `param` — feature spec

**Status:** approved (#241) · **Date:** 2026-09-24 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/241#issuecomment-5821299735

## 1. Purpose

A `param` declares that a value may be supplied from outside
([`scenario-params-spec.md`](scenario-params-spec.md)), with a declared width
and a default. Today the only bound a `param` carries is that width: any value
that fits `precision N` is a legal scenario value, however far it sits from
what the document's own rules allow. The only thing that catches a value the
author never meant to be askable is an `assert`, and an `assert` runs *after*
a full evaluation — it reports that a scenario broke a rule, not that the
scenario was never a legal question.

A document that wants to state *which* values are even askable — the envelope
a later search or a human is allowed to try — has nowhere to write that down.
The set currently lives in a script beside the file, or nowhere, which is how
a scenario like `extra_hours = 1000` or `prepay_share = 150%` gets evaluated,
printed, and only then rejected by an assertion three lines later.

**The motivating case**, from the issue: a set of levers with real limits.

```vmark
param extra_hours    precision 0 = default 0
param volume_disc    precision 3 = default 0%
param prepay_share   precision 2 = default 30%
param crosssell_days precision 0 = default 0
param premium_hours  precision 0 = default 0

assert levers.extra_hours <= max_extra_hours
assert levers.volume_disc <= max_discount
assert levers.prepay_share <= max_prepay
assert levers.crosssell_days <= security_capacity
```

`extra_hours` of `1000`, `prepay_share` of `150%`, and `extra_hours` of `-3`
are all well-typed scenario values today; only an `assert`, after a full
evaluation, tells you any of them was never a sane question. With a domain on
each param:

```vmark
param extra_hours    precision 0 integer in [0, 80] = default 0
param volume_disc    precision 3 in [0%, 15%] = default 0%
param prepay_share   precision 2 in { 30%, 40%, 45%, 50%, 60% } = default 30%
param crosssell_days precision 0 integer in [0, 8] = default 0
param premium_hours  precision 0 integer in [0, 12] = default 0
```

`prepay_share` of `60%` is in the set, evaluates, and fails
`prepay_share <= max_prepay` — the assertion still does its job, since the
envelope is deliberately wider than the business rule. `prepay_share` of `70%`
and `extra_hours` of `-3` are not in the set and are refused before
evaluation.

An `assert` cannot serve this: it cannot list `{ 30%, 40%, 45%, 50%, 60% }` as
the only legal prepay shares, and nothing lets a caller read that list back out
of an expression. An input column is a value a human commits, the opposite of
a transient scenario's envelope. `precision` is the width of the stored
number, not the set of legal values. This is the gap
[`scenario-params-spec.md`](scenario-params-spec.md) §7 (Non-goals) named when
`param` shipped: *"An `assert` already turns an out-of-range scenario into
exit `1`. Domain constraints would be a separate feature."*

## 2. Syntax

A domain clause is optional, and sits on the `param` header between
`precision N` and `= default LITERAL`:

```text
param NAME precision N [PRESET] [in DOMAIN-EXPR] = default LITERAL
```

At least one of `PRESET` or `in DOMAIN-EXPR` must be present for the param to
be treated as declaring a domain; a `param` with neither is exactly today's
`param` and is unaffected by anything in this spec.

```vmark
param extra_hours    precision 0 integer in [0, 80] = default 0
param volume_disc    precision 3 in [0%, 15%] = default 0%
param prepay_share   precision 2 in { 30%, 40%, 45%, 50% } = default 30%
param crosssell_days precision 0 natural in [0, 8] = default 0
param staff_added    precision 0 positive integer = default 1
```

**`PRESET`** is one of a closed list — this is a closed list in the language,
not an extension point, per constraint 4:

| Preset | Keyword spelling | Glyph spelling | Meaning |
|---|---|---|---|
| the integer lattice, no sign restriction | `integer` | `ℤ` | `{ …, −1, 0, 1, … }` |
| positive decimal, any width | `positive` | *(none — v1 keyword-only)* | `x > 0` |
| the naturals | `natural` | `ℕ` | integers, `x ≥ 0` (includes `0`) |
| the positive integers | `positive integer` | `ℤ⁺` | integers, `x > 0` (excludes `0`) |

`natural` and `positive integer` are each already an intersection of two
leaves internally (an unbounded-left bound and the integer lattice — see §5),
but the author writes them as one or two keywords, not as an intersection
expression. There is no `negative`, no compound beyond `positive integer`, and
no way to spell a new preset; a preset the language doesn't name is written as
an explicit `in [...]`/`in {...}` clause instead. `ℤ` is a new accepted glyph
for `integer`; `positive` has no glyph in v1 — there is no standard symbol for
"positive decimal" that doesn't imply the reals, which VisiMark does not have
([§7](../visimark-design.md#7-numeric-semantics)). Extending glyph coverage to
`positive` is a later, separate fork, not part of this spec.

`fmt` never rewrites one spelling to the other — the same rule that already
holds for `Σ`/`SUM`, `√`/`SQRT`, and the `|x|`/`⌊x⌋`/`⌈x⌉` trio.

**`DOMAIN-EXPR`** is one of:

- **a range**: `[LO, HI]`, `[LO, HI)`, `(LO, HI]`, `(LO, HI)`. Each end is
  independently open (`(`/`)`) or closed (`[`/`]`); the two ends need not
  match, so `[0, 40)` is legal in v1 — the internal shape (an interval with a
  `closed` flag per end) already assumes half-open, so restricting v1 to
  closed-only would have meant building the general case and hiding it. Either
  end may be omitted to mean unbounded on that side, and an omitted end has no
  closedness to declare, so **its bracket must be open**: `[0, )` is legal,
  `(, 40]` is legal, `[0,]` and `[,]` are refused (`TYPE`, malformed clause —
  write no domain, or an open bracket, instead). `LO` and `HI` are number
  literals as in [§2 of scenario-params-spec.md](scenario-params-spec.md#2-syntax)
  (optional `-`, digits, optional fraction, optional `%`) — never an
  expression, matching `default`.
  The math spelling `∈` is accepted in place of `in`, following the same
  glyph-equivalence rule as `PRESET`; the bracket characters themselves do not
  vary — `⟨⟩` and other alternate bracket glyphs are not accepted, since
  `[`/`]`/`(`/`)` already read as math notation and a second bracket alphabet
  would only add an unforced choice between spellings that mean the same
  thing.
- **a finite set**: `{ V1, V2, … }`, each `Vi` a number literal, comma
  separated, at least one member. `{ }` (empty) is refused — see §4, `DOMAIN`.
  Order and duplicates in the source text are not significant to membership,
  but duplicates are still worth flagging; v1 does not flag them (non-goal —
  a duplicate set member is harmless, unlike a duplicate `param` name).

**Intersection, not union.** A `PRESET` and a `DOMAIN-EXPR` together narrow the
set to their intersection: `integer in [0, 80]` is the 81 integers from 0 to
80. Two `DOMAIN-EXPR`s or two range/set clauses on one param are not proposed
— v1 has at most one `PRESET` clause and at most one `in` clause per param.
Union (two disjoint ranges on one param) is not planned; a param that needs
one is not served by this feature.

**In an unmodified renderer** the clause sits inside the fenced `vmark` block,
exactly like `precision` and `default` — no change to constraint 1
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)).

## 3. Semantics

Membership testing is exact-decimal, the same arithmetic every other VisiMark
comparison uses ([§7](../visimark-design.md#7-numeric-semantics)) — no binary
float, ever. A value is tested against the domain as a literal decimal, after
percent literals fold (`19%` → `0.19`), before rounding to the param's
declared precision (the value being tested is already exactly representable,
since it either *is* the default literal or has already passed the scenario
width check in [§3.3 of scenario-params-spec.md](scenario-params-spec.md#33-the-scenario-file)).

| Case | Domain (as declared) | Value | In domain? |
|---|---|---|---|
| closed range, interior | `[0, 80]` | `40` | yes |
| closed range, lower bound | `[0, 80]` | `0` | yes |
| closed range, upper bound | `[0, 80]` | `80` | yes |
| closed range, just outside | `[0, 80]` | `-1` or `81` | no |
| half-open, excluded end | `[0, 40)` | `40` | no |
| half-open, excluded end, included end | `[0, 40)` | `39` | yes |
| unbounded lower | `(, 40]` | `-1000000` | yes |
| finite set, member | `{ 30%, 40%, 45%, 50% }` | `40%` | yes |
| finite set, non-member | `{ 30%, 40%, 45%, 50% }` | `35%` | no |
| finite set, percent normalization | `{ 30%, 40% }` | `0.40` written as `40%` | yes (compared as `0.40` either way) |
| `integer` preset alone | `integer` | `-3` | yes |
| `integer` preset alone | `integer` | `2.5` | no |
| `integer` ∩ range | `integer in [0, 80]` | `40.5` | no (fails the lattice) |
| `integer` ∩ range | `integer in [0, 80]` | `81` | no (fails the range) |
| `natural`, zero | `natural` | `0` | yes |
| `natural`, negative | `natural` | `-1` | no |
| `positive integer`, zero | `positive integer` | `0` | no |
| `positive integer`, one | `positive integer` | `1` | yes |
| `positive`, fraction | `positive` | `0.001` | yes |
| `positive`, zero | `positive` | `0` | no |
| empty domain (declaration-time) | `integer in [0.2, 0.8]` | *(no legal point)* | `DOMAIN` finding, §4 |
| empty domain (declaration-time) | `[10, 0]` (reversed) | *(no legal point)* | `DOMAIN` finding, §4 |
| empty set literal | `{ }` | — | `DOMAIN` finding, §4 |

**Emptiness is checked where it is decidable, not in general.** A range's
emptiness (`lo > hi`, or `lo == hi` with either end open) is always decidable
from the two literals and is always checked. `integer`/`natural`/`positive
integer` intersected with a range is checked by testing whether the lattice
has a member in the range, which is also always decidable. A `positive` range
against a very narrow closed interval that happens to contain no value at the
param's declared `precision` (for example `positive in [0.001, 0.002]` with
`precision 1`) is **not** checked for emptiness in v1 — deciding that in
general means walking the precision grid, which this spec does not add. This
is a stated non-goal (§7), not a silent gap: such a param declares a domain
that is empty in practice and will simply refuse every scenario value, the
same as if the author had written `assert false`.

## 4. Type rules and errors

### 4.1 Document findings (all static)

A new finding code, **`DOMAIN`**, joins the taxonomy
([§10](../visimark-design.md#10-error-taxonomy)) — not a widened `TYPE` and
not a reused `ASSERT`. `TYPE` covers structural well-formedness (operand
types, call shape) independent of any particular value; a domain violation is
a value-membership question about an otherwise well-typed literal — a
different axis, and one this spec keeps separate rather than adding weight to
either existing code ahead of the algebraic type system tracked in
[#41](https://github.com/michal-niedzwiedzki/visimark/issues/41). `ASSERT`
runs over the built dependency graph at evaluation time; a domain check on a
default is static, before evaluation starts, like every other case in this
table. `DOMAIN` is not auto-fixable.

| Case | Code | Message |
|---|---|---|
| `param x precision 0 integer in [0.2, 0.8] = default 0` (empty domain) | `DOMAIN` | `param x declares an empty domain: integer in [0.2, 0.8] has no legal value` |
| `param x precision 0 in [10, 0]` (reversed range) | `DOMAIN` | `param x declares an empty domain: [10, 0] has no legal value` |
| `param x precision 0 in { }` (empty set) | `DOMAIN` | `param x declares an empty domain: {} has no legal value` |
| `param extra_hours precision 0 integer in [0, 80] = default 100` (default outside) | `DOMAIN` | `default 100 is not in the domain of extra_hours: integer in [0, 80]` |
| `param prepay_share precision 2 in { 30%, 40% } = default 35%` (default outside a set) | `DOMAIN` | `default 35% is not in the domain of prepay_share: { 30%, 40% }` |
| a domain literal (a range end or a set member) wider than the declared `precision` | `PRECISION` (widened) | `domain value 33.33% has 4 decimals; param prepay_share declares 2` — the same message shape the `default` check already uses |
| a domain literal's percent-ness mismatches the param's (bare vs `%`) | `TYPE` (widened) | `prepay_share is a percent; domain value 40 must be too` — mirrors the scenario-value percent rule ([§3.3](scenario-params-spec.md#33-the-scenario-file)) |
| a domain literal that is not a number literal (a date, a string, an expression, a name) | `TYPE` | `a param domain bound must be a number literal` |
| an unrecognised preset word (`integer` misspelled, or a word outside the closed list) | `TYPE` | `` unrecognised param domain preset `NAME` `` |
| `in` with no expression after it, or a malformed bracket pairing | `TYPE` | `malformed param domain clause` |
| a `param` with a domain, on the existing rules that already apply to every `param` (`DUP`, `WARN`, missing `precision` or `default`) | unchanged | as today — see [§4.1 of scenario-params-spec.md](scenario-params-spec.md#41-document-findings) |

A `param` whose domain finding fires is treated as any broken binding is
today: its dependants are suppressed under `NOTE`
([§8](../visimark-design.md#8-evaluation)).

### 4.2 Scenario faults (usage errors, unchanged code)

An out-of-domain scenario value is a **`SCENARIO`** fault — the existing exit
`2`, usage-error code from
[§4.2 of scenario-params-spec.md](scenario-params-spec.md#42-scenario-faults) —
not a new code. This slots into the existing check order in that spec's §3.3:
after the width and percent-ness checks (`checkValue`), and before the value
is applied. The message shape splits four ways on the domain's kind, matching
the existing `visimark: scenario value for <key> …` prefix:

| Domain kind | stderr |
|---|---|
| range | `visimark: scenario value for prepay_share is not in [30%, 60%]: 70%` |
| finite set, ≤10 members | `visimark: scenario value for prepay_share is not in { 30%, 40%, 45%, 50% }: 35%` |
| finite set, >10 members | `visimark: scenario value for code is not among the 14 legal values: 15` |
| named preset (with or without an intersected range/set) | `visimark: scenario value for extra_hours is not a non-negative integer: -3` (`natural`) / `visimark: scenario value for staff_added is not a positive integer: 0` (`positive integer`) / `visimark: scenario value for extra_hours is not an integer: 2.5` (`integer`) / `visimark: scenario value for volume_disc is not positive: -1%` (`positive`) |

The 10-member threshold matches the width at which a message stops being
useful to read at a glance; it is not otherwise load-bearing. A value inside
the domain that later fails an `assert` is unchanged from
[§3.2 of scenario-params-spec.md](scenario-params-spec.md#32-under-a-scenario):
exit `1`, values printed, the assertion reports pass/fail/unverified on the
defaults.

## 5. Interaction with the rest of the language

- **Shape** ([§4](../visimark-design.md#4-syntax)). A param with a domain is
  still a numeric scalar. No vector, no boolean, no new shape.
- **Evaluation** ([§8](../visimark-design.md#8-evaluation)). The domain check
  on a default is a static check, run once when the document is built —
  exactly when the `PRECISION` check on a default already runs. It is not a
  graph node and does not change the dependency graph, the evaluation order,
  or `CYCLE` rules.
- **Write-back** ([§9](../visimark-design.md#9-write-back)). The tool owns
  nothing new. `fmt` never writes a domain clause: it does not add one, does
  not remove one, does not fill in a missing domain, and does not normalize
  one glyph spelling to another (`in` ↔ `∈`, `integer` ↔ `ℤ`) — the same rule
  already governing `precision` and `default`.
- **Precision** ([§7](../visimark-design.md#7-numeric-semantics)). `precision`
  is not a field of the domain (confirmed in the issue's second comment); it
  is checked against every domain literal independently, the same way it is
  checked against `default` today (§4.1 above).
- **Units** ([§7](../visimark-design.md#7-numeric-semantics)). Unaffected — a
  param's unit still comes from its anchors, and a domain clause carries none.
- **Name resolution** ([§6](../visimark-design.md#6-name-resolution-and-scoping)).
  Unaffected. A domain clause introduces no new name; `integer`, `natural`,
  `positive`, and `in` are contextual keywords recognised only inside a
  `param` header's domain position, the same way `param` and `default` are
  contextual ([§2 of scenario-params-spec.md](scenario-params-spec.md#2-syntax)).
  No existing document changes meaning and no word becomes reserved: `integer
  = 5` still binds a scalar called `integer`.
- **Declared local data imports** ([§19](../visimark-design.md#19-declared-local-data-imports)).
  No special case. A `param` may already appear on an imported sheet; a domain
  clause is param metadata, untouched by a sheet's read-only status, exactly
  as `precision` and `default` are today.
- **Scenario parameters** ([§20](../visimark-design.md#20-scenario-parameters),
  [scenario-params-spec.md](scenario-params-spec.md)). This spec is additive
  to that one. Everything in §3–§5 of that spec is unchanged except the one
  new check named in §4.2 above, inserted into the existing `checkValue`
  order.
- **What does not change.** `check`, `fmt`, and `infer` behave exactly as
  today on every existing document — no existing `param` has a domain clause,
  and none is inferred, so no document that passes `check` today starts
  failing. `infer` never proposes a domain and never rewrites one, the same
  as it never proposes a `param` itself.

## 6. CLI reporting

**`eval` (plain, and `--scenario`), text.** A `params:` block, after the value
lines and (under `--scenario`) after the existing `scenario:` block, listing
every param that declares a domain, in document order — a document with no
domain-bearing param keeps today's stdout, byte-for-byte:

```
params:
  levers.extra_hours   integer in [0, 80]
  levers.prepay_share  { 30%, 40%, 45%, 50%, 60% }
```

**`eval` (plain, and `--scenario`), JSON.** A `params` object, present only
when at least one param declares a domain, keyed by qualified name:

```json
"params": {
  "levers.extra_hours": {
    "value": "40", "default": "0", "source": "default",
    "domain": { "clauses": ["integer", "[0, 80]"], "fold": ["0", "1", "…", "80"] }
  },
  "levers.prepay_share": {
    "value": "0.30", "default": "0.30", "source": "default",
    "domain": { "clauses": ["{ 30%, 40%, 45%, 50%, 60% }"], "fold": ["0.30", "0.40", "0.45", "0.50", "0.60"] }
  }
}
```

Existing keys (`values`, `assertions`, `scenario`) are unchanged.
`domain.clauses` carries the clauses in source order, each as its source
text — `["integer", "[0, 80]"]`, not one merged string — so an error can name
the one that failed. `domain.fold` is the exact enumerated set, present only
when the intersection folds to a finite, exactly-known list (an explicit set,
or a preset/range combination bounded to a finite integer lattice); it is
**absent**, not `null`, when no exact fold exists (an unbounded or
non-integer range) — following the same presence/absence convention
`scenario-params-spec.md` §5.3 already uses for optional per-entry keys. Under
`--scenario`, `value`/`default`/`source` behave exactly as the existing
`scenario.params` entries do today; `domain` is the only addition. An
out-of-domain scenario value is the existing `SCENARIO` error envelope (§4.2
above) and has no `params` key, same as any other `eval --scenario` usage
error today.

**`explain`, text and `--json`.** The existing `params:` block
([§5.3 of scenario-params-spec.md](scenario-params-spec.md#53-cli)) gains the
domain on each row that declares one:

```
#levers
  params:
    extra_hours    precision 0   default 0   domain integer in [0, 80]
    prepay_share   precision 2   default 30%   domain { 30%, 40%, 45%, 50%, 60% }
```

`explain --json`'s per-sheet `params` array (and the top-level
`documentScopeParams` array) gains a `domain` field on each entry, same shape
as `eval --json`'s (`clauses`, and `fold` when exact), **absent** on an entry
whose param declares no domain — so `explain --json` on a document with no
domain-bearing param is byte-for-byte unchanged, and a param that has a domain
but no scenario is still fully described without running `eval`.

**`ref` is unaffected.** `visimark ref` is the builtin-*function* reference —
"the one command that reads no file: it answers about the language, not
about a document" (`packages/visimark/src/cli/commands.ts`). It has no
per-document param data to report a domain from, and never did; a `param`'s
`precision` and `default` are not part of its output today either. The issue
body and the discussion summary both listed `ref --json` as a reporting
surface for this feature — that was a mistake, caught while grounding this
spec against the actual command (`cmdRef` takes a function name, never a
file). `explain --json`, not `ref`, is the per-document surface, and it
already carries the domain above.

**`infer`.** Unchanged — never proposes a domain, never rewrites one.

## 7. Acceptance

A new, non-normative fixture — `test/fixtures/domain/levers.md` — following
the precedent set by declared local data imports
([§13](../visimark-design.md#13-testing): `test/fixtures/import/benchmark.{md,csv}`,
held to a transcript test rather than to `fmt` byte-stability across arbitrary
edits). One document is enough to cover every notation variant named in this
spec without forcing them all into one of the three normative example
documents:

- a range with both ends closed (`[0, 80]`) and one half-open (`[0, 40)`)
- a finite set (`{ 30%, 40%, 45%, 50% }`)
- `natural`/`ℕ` and `positive integer`/`ℤ⁺` as alternate spellings of the same
  clause on two different params, proving `fmt` leaves both spellings alone
- `in` and `∈` as alternate spellings of the same clause
- one default outside its domain (`DOMAIN`, exit `1` under `check`)
- one `eval --scenario` value outside a domain (`SCENARIO`, exit `2`), for
  each of the four message shapes in §4.2 (range, small set, large set,
  preset)
- one in-domain scenario value that fails an `assert` (exit `1`, unchanged
  from `scenario-params-spec.md`)

`test/domain-acceptance.test.ts` asserts `check` and `eval --scenario --json`
output against fixed expectations, in the same style as
`test/import-acceptance.test.ts`. The document is **not** added to the
`fmt`-byte-stability suite in [§13](../visimark-design.md#13-testing) beyond
its own transcript test — it is a feature fixture, not a fourth normative
example document.

## 8. Non-goals

- **Naming and reusing a domain** across params (`param x is positive`,
  `param y is like x`) — an adjacent idea raised in discussion, not part of
  this issue.
- **`step`** (a lattice spacing narrower than the integer lattice, e.g. `step
  5` on a range) — belongs to a future scenario-sweep/simulation feature, not
  to a domain declaration.
- **A command that sweeps or searches the domain** — section F, a later issue.
  This spec adds no `simulate`, no report, no grid.
- **Union** (two disjoint ranges or sets on one param) — not planned.
- **Glyph coverage for `positive`** — stays keyword-only; see §2.
- **General emptiness detection at arbitrary precision** — see §3's stated
  scope limit for `positive` ranges narrower than the declared precision.
- **Flagging a duplicate member in a finite set** — harmless, not checked.
- **A new preset beyond the closed list in §2** — write an explicit
  `in [...]`/`in {...}` clause instead.

## 9. Open questions

None.
