# Σ / ∑ as an alias for `SUM` — feature spec

**Status:** approved (#43) · **Date:** 2026-09-08 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/43#issuecomment-5588631404

## 1. Purpose

Add two Unicode summation glyphs — U+03A3 (`Σ`, GREEK CAPITAL LETTER SIGMA) and
U+2211 (`∑`, N-ARY SUMMATION) — as lexical aliases for the built-in `SUM`
reducer ([§4](../visimark-design.md#4-syntax)). `total = Σ(Net)` and
`total = ∑(Net)` parse, type-check, evaluate, and infer identically to
`total = SUM(Net)` — same shape, arity, dependency tracking, did-you-mean
behaviour, and output. There is no new semantic construct: this is a second
spelling for one existing primitive, nothing else.

The motivating case, from issue #43:

> ```vmark
> total = Σ(Net)
> ```
> is exactly equivalent to:
> ```vmark
> total = SUM(Net)
> ```

The motivation is explicitly not expressive — the issue states it plainly:
"partly practical... but mostly cultural: a tiny dog-whistle to the scientific
and mathematical community." Existing vocabulary (`SUM`) already computes
everything the alias computes; the issue does not claim otherwise. The
deciding comment (#43) accepts this as an outreach/personality feature judged
on cost, not on expressive necessity — see the Non-goals section for the
boundary this draws around future requests of the same shape.

## 2. Syntax

Two single-codepoint tokens are added to the lexer's identifier-recognition
branch (`packages/visimark/src/lang/lexer.ts`), alongside the existing ASCII
`isIdentStart`/`isIdentPart` path:

- `Σ` (U+03A3, GREEK CAPITAL LETTER SIGMA)
- `∑` (U+2211, N-ARY SUMMATION)

Either codepoint, standing alone (it is not a valid continuation of an ASCII
identifier and no ASCII identifier can contain it, so no lexer ambiguity is
possible), lexes as an `ident` token **whose value is the literal string
`"SUM"`** — not a distinct alias token type. The token's source span is the one
character actually written (1 UTF-16 code unit for both codepoints), so error
messages and `explain` point at exactly what the author typed, while every
downstream consumer (parser, function-arity check, evaluator, did-you-mean,
`infer`) sees plain `SUM` and requires no awareness that an alias exists.

Concretely, in the lexer's `isIdentStart(c)` branch:

```
if (c === "Σ" || c === "∑") {
  push("ident", "SUM", i, i + 1);
  i++;
  continue;
}
```

placed as a sibling check to the existing `isIdentStart(c)` branch, before it
(so the ASCII path is unaffected).

Neither glyph is reserved as a name — nothing changes about what identifiers a
document may bind, because the identifier grammar
([§6](../visimark-design.md#6-name-resolution-and-scoping),
`[A-Za-z_][A-Za-z0-9_]*`) is unchanged and never accepted non-ASCII characters
to begin with. `Σ` and `∑` were already illegal in a bound name before this
change; they still are. There is no name collision to resolve.

This reads unmodified in every renderer in [§2](../visimark-design.md#2-constraints-that-shaped-the-design)'s
list (GitHub, VS Code preview, Obsidian, pandoc) — both glyphs are ordinary
UTF-8 text inside a fenced ```vmark``` code block, exactly like the ASCII they
replace.

**Lowercase and other sigma-shaped characters are out of scope.** Lowercase
Greek sigma (`σ`, U+03C3) and final sigma (`ς`, U+03C2) are not aliased —
lowercase sigma has an established, unrelated meaning in mathematical notation
(standard deviation), and aliasing it would invite exactly the kind of
context-dependent reading constraint 3 forbids. Only the two uppercase/operator
forms named above are recognised.

## 3. Semantics

| Input | Behaviour |
|-------|-----------|
| `total = Σ(Net)` | Identical to `total = SUM(Net)`: sums the `Net` column; `0` over an empty column. |
| `total = ∑(Net)` | Identical to `total = SUM(Net)`. |
| `x = Σ` (no call) | Identical to a bare reference to an unresolvable name `SUM` in the current scope: an `UNDEF` error (unless the document happens to define a scalar or column literally named `SUM`, in which case it resolves to that binding) — exactly today's behaviour for a bare `SUM` with no parens, unrelated to this change. |
| `Σ(Price * Qty)` | Identical to `SUM(Price * Qty)`: refused. A reduce takes a bare column reference, never an expression ([§4](../visimark-design.md#4-syntax)). |
| `Σ(Qty, 2)` | Identical to `SUM(Qty, 2)`: a `TYPE` error for wrong arity, reported once against the call span (the one character written), naming the function `SUM` (the canonical name) in the message. |
| `share = Net / Σ(Net)` | Identical to `share = Net / SUM(Net)`: legal, a reduce composing as a scalar inside a column rule. |
| `Σ(schedule.Amount)` | Identical to `SUM(schedule.Amount)`: legal, a foreign column consumed by an aggregate ([§6](../visimark-design.md#6-name-resolution-and-scoping)). |
| A document that types `SUM` and `Σ`/`∑` for the same total in different sheets | Both compute the same way; nothing forces one spelling document-wide. Consistency within one document is a style question for the author, not something the tool enforces (mirrors every other stylistic choice VisiMark leaves alone). |

No boundary case behaves differently under the alias than under `SUM` itself —
that is the entire design: the alias is resolved to `SUM` before any other
stage of the pipeline sees it, so `SUM`'s existing zero-over-empty rule,
arity check, and every other rule apply unchanged.

## 4. Type rules and errors

No new error code. Every failure mode a call through `Σ`/`∑` can produce is an
existing `SUM` failure mode, reported under the name `SUM` (the token's value),
at the span of the character actually written:

- Wrong arity (`Σ()`, `Σ(a, b)`) → `TYPE`, exactly as `SUM()`/`SUM(a, b)` today.
- Non-bare-column argument (`Σ(Price * Qty)`) → `TYPE`, exactly as today.
- Unresolvable inner reference (`Σ(NoSuchColumn)`) → `UNDEF`, exactly as today,
  on the inner name — the alias itself never fails to resolve, since it is
  not looked up by name at all (see §2).

Because the alias is never a name subject to lookup, it **never appears in a
did-you-mean list**: the edit-distance suggestion machinery
([§4](../visimark-design.md#4-syntax), [§6](../visimark-design.md#6-name-resolution-and-scoping))
walks the builtin-function table and in-scope identifiers, neither of which
gains an entry — `FUNCTIONS` (`packages/visimark/src/eval/functions.ts`) is
untouched. This falls out of the implementation rather than needing a special
case: there is nothing to special-case against.

## 5. Interaction with the rest of the language

- **Dates ([§5](../visimark-design.md#5-dates)):** untouched. `SUM` does not
  operate on dates today and the alias changes nothing about that.
- **Numeric semantics and write precision ([§7](../visimark-design.md#7-numeric-semantics)):**
  untouched — the alias resolves to the same `SUM` evaluation path, so the
  written result's precision and unit decoration are identical regardless of
  which spelling produced it.
- **Write-back ([§9](../visimark-design.md#9-write-back)):** untouched, and
  this is the answer to the canonicalization question the pre-review raised.
  `fmt` writes only computed cells, anchors, and generated artifacts — never a
  binding's own expression text. A binding written as `Σ(Net)` is never
  rewritten to `SUM(Net)` (or vice versa) by any tool command; the source
  spelling the author chose persists untouched, the same as every other
  stylistic choice in a rule expression (spacing, operand order, etc.) that
  `fmt` already leaves alone.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)):**
  untouched — see §2. The identifier grammar does not change, so no existing
  or future document-bound name can collide with either glyph.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)):** untouched,
  same reasoning as numeric semantics above.
- **CLI surfaces:**
  - `check` — reports exactly what `SUM` would report, same finding codes.
  - `fmt` — never rewrites the alias to `SUM` or back (see write-back above).
  - `infer` — never *emits* `Σ`/`∑` when reverse-engineering a formula from
    existing values; it only ever proposes `SUM`, matching the "SUM stays
    canonical in examples and generated explanations" requirement in the
    issue. `infer` reading a document that already uses the alias sees a
    normal `SUM` call (per §2) and needs no change.
  - `explain` — prints the call using the token's own source span, so a sheet
    using `Σ(Net)` shows `Σ(Net)` in `explain`'s rule listing (it echoes
    source text, not the resolved name) while still describing the same
    evaluation order and dependency edges `SUM(Net)` would.
  - `eval --json` — the computed value is identical; nothing about the
    `--json` shape reveals which spelling produced it, since the alias
    resolves before evaluation.

**What does not change:** the function table (`FUNCTIONS`), the identifier
grammar, the did-you-mean candidate set, arity checking, the error taxonomy,
write-back ownership, and every builtin other than `SUM`'s two new spellings.

## 6. Acceptance

No change to any of the three canonical example documents
(`example-invoice.md`, `example-charts.md`, `example-invoice-drift.md`) — the
alias stays out of the canonical examples deliberately, per the issue ("`SUM`
remains the canonical spelling in examples and generated explanations"), so
the acceptance-suite transcripts in [§13](../visimark-design.md#13-testing)
are unaffected.

Coverage lives in the lexer/evaluator unit suite instead:

- `lex("Σ(Net)")` and `lex("∑(Net)")` each produce the same token stream as
  `lex("SUM(Net)")` except for the first token's `start`/`end` span (1 code
  unit instead of 3).
- A small fixture sheet bound with `total = Σ(Net)` evaluates to the same
  value as the identical sheet bound with `total = SUM(Net)`, via
  `visimark eval`.
- `visimark check` on a document using `Σ(Net)` reports zero findings when the
  computed cell is current, and a `STALE` finding (not a parse or `TYPE`
  error) when it is not — proving the alias is fully transparent to `check`.
- `visimark check` on `Σ(Price * Qty)` reports the same `TYPE` error, at the
  same message text (naming `SUM`), that `SUM(Price * Qty)` reports today.
- A did-you-mean unit test confirms an unrelated unresolvable name near `SUM`
  (e.g. a typo `SUMM(Net)`) never suggests `Σ` or `∑` as a candidate.

## 7. Non-goals

- **No general symbol-alias system.** `√`, `∏`, `∫`, and any other
  mathematical glyph are explicitly out of scope. This spec authorises exactly
  two codepoints as aliases for exactly one function. A future request for
  another symbolic alias is a new catalogue issue, judged on its own facts —
  this spec's approval is not precedent for it, and the deciding comment on
  #43 says so explicitly.
- **No documentation as a headline feature.** The alias gets a one-line
  footnote under the builtin functions table in `visimark-design.md`
  (documentation task, implementation plan) — not a table row, not a CLI
  `--help` mention, not example-document usage. `SUM` remains what a reader
  encounters first.
- **No canonicalization / normalization pass.** Neither `fmt` nor any other
  command ever rewrites one spelling to the other (§5).
- **No lowercase or other sigma-shaped glyphs** — see §2.

## 8. Open questions

None.
