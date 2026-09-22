# Percent display sigil on prose anchors — feature spec

**Status:** approved (#140) · **Date:** 2026-09-22 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/140#issuecomment-5775547789

## 1. Purpose

A scalar prose anchor can ask `fmt` to print a stored ratio as a percent,
without changing the stored value, the binding, or any arithmetic.

```markdown
The engagement clears a margin of **40.26%**<!--vmark=lines.margin%-->.
```

```vmark #lines
margin precision 4 = (net_total - cost_total) / net_total
```

`margin` stays `0.4026`. The `%` on the comment is a display request for that
one span: write stored × 100 at precision − 2, with a trailing `%`.

`docs/example-executable-documentation.md` already puts `**20.00%**` and
`**50.00%**` in prose. `check` accepts those strings as the stored ratio
(`matchesStored` folds `N%` by dividing by 100). `fmt` does not preserve them:
the first time the value moves, it writes canonical `toFixed` (`0.25`). A
trailing `%` in human-owned text after the comment (the `PLN` pattern) cannot
put `%` inside the rewritten span, because `%` is not a unit
([§7](../visimark-design.md#7-numeric-semantics)). A second scalar storing
`20` then fails `matchesStored` against `20%` (read as `0.20`).

This is the missing write-back half of a form `check` already understands.

## 2. Syntax

The anchor comment grows an optional trailing `%` immediately after the
scalar name:

```
<!--vmark=sheet.scalar%-->
```

Grammar, extending the current `ANCHOR_RE`
(`packages/visimark/src/parse/document.ts`):

```
<!--\s*vmark\s*=\s*<id>.<id>%\s*-->
```

`<id>` is `[A-Za-z_][A-Za-z0-9_]*`, unchanged. No whitespace between the
name and `%`. Whitespace around `=` and before `-->` stays as today.

`sheet.name %` (space before `%`), `sheet.name%%`, and any other stray
character after the name remain a malformed anchor: `ANCHOR`, message
`malformed anchor comment — expected \`<!--vmark=sheet.name-->\` or \`<!--vmark=sheet.name%-->\``.

The sigil is legal only on a **scalar prose** target: `strong`, `emphasis`,
`inlineCode`, or a text node, the same rewrite targets [§3](../visimark-design.md#3-document-model)
already names. An image/chart target with `%` parses, then `TYPE` (§4).

Constraint 1 ([§2](../visimark-design.md#2-constraints-that-shaped-the-design)):
the sigil lives in an HTML comment unmodified renderers already hide. The
visible text (`40.26%`, `-5%`) is ordinary Markdown.

`%` inside a `vmark` block remains postfix scaling of a literal (`23%` is
`0.23`, [§4](../visimark-design.md#4-syntax)). The two grammars do not meet.

## 3. Semantics

The stored value is unchanged. Display is a function of that value, the
binding's write precision `N`, and the sigil on this comment.

**Percent rendering**, when the target is a number and `N ≥ 2`:

1. Take the stored decimal, already rounded to `N` ([§7](../visimark-design.md#7-numeric-semantics)).
2. Multiply by 100.
3. Write with `toFixed(N − 2)` under the global half-up rule.
4. Prefix `-` when the stored value is negative (minus zero writes `0%`, no sign).
5. Suffix `%` with no space.

| Case | Stored | `N` | Span in | `fmt` writes |
|---|---|---|---|---|
| Motivating margin | `0.4026` | 4 | `0.4155` | `40.26%` |
| Integer percent | `0.40` | 2 | `0.40` | `40%` |
| In-tree reserved capacity | `0.20` | 2 | `20.00%` | `20%` |
| In-tree worker share | `0.50` | 2 | `50.00%` | `50%` |
| Zero | `0.00` | 2 | `0.00` | `0%` |
| Negative | `-0.05` | 2 | `-0.05` | `-5%` |
| Greater than one | `1.50` | 2 | `1.50` | `150%` |
| Fractional at width 3 | `0.125` | 3 | `0.125` | `12.5%` |
| Already canonical | `0.4026` | 4 | `40.26%` | unchanged |
| Hand-written without sigil | `0.20` | 2 | `20.00%` | `0.20` (no `%` on the comment) |
| Wrong number, with sigil | `0.4026` | 4 | `41.55%` | `40.26%` |

`check`'s verdict is numeric: the span agrees when `matchesStored` of the
stored value against the span text at precision `N` is true. `N%` and `-N%`
both fold by dividing the digits by 100. A span whose *glyphs* are still
decimal (`0.4026`) on a `%` comment is clean if the number agrees; `fmt`
then writes the percent form.

A span whose number disagrees is `STALE`. The line prints the span text as
written on the left and the percent rendering on the right:

```
STALE   lines.margin                               41.55% ≠ 40.26%
```

If the span is still decimal, the left side is that decimal:

```
STALE   lines.margin                                0.50 ≠ 40.26%
```

Two anchors of one scalar may disagree about the sigil. Bare
`<!--vmark=lines.margin-->` writes `0.4026`; `<!--vmark=lines.margin%-->`
writes `40.26%`. Each comment is its own rendering. `%` is not a unit, so
this pair is not `UNIT`.

Without a `%` sigil, `fmt` writes canonical `toFixed(N)` (and any inferred
unit), including when the current span is percent-shaped. That is the
convention of a comment that did not ask for percent.

## 4. Type rules and errors

No new [§10](../visimark-design.md#10-error-taxonomy) code. Three existing
codes gain a trigger. None is auto-fixable except `STALE`, which `fmt`
already repairs.

| Condition | Code | When | Message |
|---|---|---|---|
| Span number ≠ stored value | `STALE` | evaluation, as today | span text ≠ percent rendering (with sigil) or ≠ `toFixed` (without) |
| Binding width `N < 2` on a `%` comment | `PRECISION` | once `N` is known | `percent display needs precision 2 or more; <name> has <N>` |
| `%` on a date or string scalar | `TYPE` | evaluation | `a % sigil is only legal on a numeric scalar` |
| `%` on a chart or image anchor | `TYPE` | after the comment parses | `a % sigil is only legal on a numeric scalar` |
| `%` on a span that also carries a unit (`$`, ` kg`, both-sides) | `UNIT` | decoration pass | `cannot mix a unit with percent display` |
| Space or extra character between name and `%` | `ANCHOR` | parse | malformed-comment message, as today |
| Empty / missing rewrite target | `ANCHOR` | as today | `no value to rewrite in front of this anchor` — this spec does not seed |

`fmt` does not rewrite a span that carries `PRECISION`, `TYPE`, or `UNIT`
from the sigil. Same ownership rule as a `UNIT` column today
([§9](../visimark-design.md#9-write-back)).

**Suppression ([§8](../visimark-design.md#8-evaluation)).** If the scalar is
unevaluable from an upstream finding, a `%` span produces no `STALE`; it
folds into the existing per-sheet `NOTE`. `PRECISION` for `N < 2` still
fires when the width is known, because the display request is illegal
regardless of the value. `TYPE` / `UNIT` on the sigil still fire: they do
not depend on the number.

**Static vs evaluation.** Malformed comments are parse-time `ANCHOR`. Chart
vs scalar is known after build (the name is a chart). Width `< 2` is known
once the binding's precision is resolved. Date/string is evaluation-time
(the value's type).

## 5. Interaction with the rest of the language

- **Shape ([§4](../visimark-design.md#4-syntax)).** Unchanged. The stored
  scalar stays a number. No new expression form.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Unchanged. The sigil is not a node. It is consulted when writing or when
  formatting a `STALE` line.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** The tool still
  owns computed cells, anchored values, and generated artifacts. It owns
  nothing new. A `%` comment is a second rendering rule for an already-owned
  span. One changed input still rewrites one span
  ([§13](../visimark-design.md#13-testing)). The offset splicer still applies.
- **Anchors ([§3](../visimark-design.md#3-document-model)).** An anchor remains
  an output. The sigil does not feed precision, units (except the `UNIT`
  refusal above), or arithmetic. Two `%` anchors of one scalar cannot
  disagree about precision, because neither is consulted for it.
- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).**
  Write precision is still declared or derived on the binding. Percent
  display does not declare a width. `N − 2` is only how many decimals the
  *printed percent* shows. `%` is still not a unit.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).**
  Unchanged. The path is `sheet.scalar` as today. An `is` alias is not an
  anchor path.
- **Imports ([§19](../visimark-design.md#19-declared-local-data-imports)).**
  Unchanged. A `%` comment on a numeric scalar computed from an imported
  column is legal.
- **`param` ([§20](../visimark-design.md#20-scenario-parameters)).** Unchanged.
  `check` / `fmt` see the default. A `%` comment on a percent `param` prints
  the default as a percent. `eval --scenario` still reports stored numbers.
- **`assert` ([§17](../visimark-design.md#17-assertions)).** Unchanged. Assertions
  read stored values.
- **`chart` ([§18](../visimark-design.md#18-generated-artifacts)).** A `%`
  comment on a chart/image name is `TYPE` (§4). Series data and SVG bytes
  are unchanged.
- **Column aliases.** Unchanged.

**CLI**

- `check`: numeric verdict as §3. `STALE` computed text uses the percent
  renderer when the comment has `%`. Exit codes unchanged (`0` clean, `1`
  findings). `--json` envelope unchanged; `stored` / `computed` on a `STALE`
  finding carry the strings the human line shows.
- `fmt`: writes the percent rendering on a `%` comment when §4 allows it;
  writes `toFixed(N)` (plus unit) on a bare comment, even if the span was
  percent-shaped. Does not insert a `%` into the comment.
- `infer`: parses the new grammar so a `%` comment is an anchor, not
  malformed. `infer --write` never emits `%`. It does not guess which values
  deserve percent display.
- `explain`: stored formula and stored value, as today.
- `eval` / `eval --json` / `eval --scenario`: stored numbers. Nothing in the
  envelope reveals the sigil.
- Did-you-mean: unchanged (no new name).
- LSP / hover: unchanged beyond parsing the comment so the `%` form is a
  real anchor.

**What does not change:** expression syntax, evaluation, stored values,
units as inert decorations on non-`%` spans, `ref`, exit codes, the `--json`
shape, chart bytes, import stamps.

**Documents that pass `check` today:** all of them still pass. `%` on a
comment is currently `ANCHOR`, so no passing document carries it.
`docs/example-executable-documentation.md` keeps passing with `20.00%` /
`50.00%` and no sigil (`matchesStored`). The first `fmt` after this ships
rewrites those spans to `0.20` and `0.50` unless the comments gain `%`
(acceptance, §6).

## 6. Acceptance

**Fixture** `packages/visimark/test/fixtures/percent-display-sigil.md`,
covering every row of §3 and every row of §4.

````markdown
Margin **40.26%**<!--vmark=s.margin%-->.
Bare **0.4026**<!--vmark=s.margin-->.
Negative **-5%**<!--vmark=s.loss%-->.
Over **150%**<!--vmark=s.over%-->.

```vmark #s
margin precision 4 = 0.4026
loss precision 2 = -5%
over precision 2 = 150%
```
````

```
$ bun run packages/visimark/src/cli/main.ts check fixtures/percent-display-sigil.md
…/percent-display-sigil.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

Sabotage `margin`'s span to `41.55%`:

```
  STALE   s.margin                                 41.55% ≠ 40.26%
  STALE   1 prose anchors bound to the values above

  2 problems (2 stale, 0 errors)
```

Exit `1`. `fmt` rewrites that span to `40.26%`; a second `fmt` is a no-op.

`<!--vmark=s.margin %-->` (space) is `ANCHOR`, exit `1`.
`precision 1` with `%` is `PRECISION`, exit `1`, and `fmt` leaves the span.
A `%` comment on a date scalar, a string scalar, or a chart image is `TYPE`,
exit `1`. `**$40.26%**` or `**$0.4026**` with a `%` comment is `UNIT`,
exit `1`.

**In-tree document.** `docs/example-executable-documentation.md` gains `%`
on the two percent anchors. After that edit, `fmt` writes `20%` and `50%`
(`N = 2` → zero display decimals), and `check` exits `0`. `eval --json`
still reports `0.2` and `0.5` (decimal strings as today).

## 7. Non-goals

- Scientific display: `^`, ASCII `e+`, maths `×10ⁿ`, `infer --maths`.
  [#142](https://github.com/michal-niedzwiedzki/visimark/issues/142), after
  this ships.
- Per-column output formats, masks, thousands separators
  ([§14](../visimark-design.md#14-deferred)).
- Algebraic types / denominations ([#41](https://github.com/michal-niedzwiedzki/visimark/issues/41)).
- Seeding an empty rewrite target with a percent. `ANCHOR` as today; a
  separate issue owns that.
- `fmt` inserting `%` into a comment that does not already have it.
- `infer --write` emitting `%`.
- Consistency checking that a `%` scalar is "ratio-shaped". A `%` sigil on
  a currency total is legal and inert, the same compromise as a wrong unit
  ([§15](../visimark-design.md#15-known-tensions)).

## 8. Open questions

None.
