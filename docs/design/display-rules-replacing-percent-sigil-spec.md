# Display rules, replacing the `%` sigil — feature spec

**Status:** approved (#297) · **Date:** 2026-09-29 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/297#issuecomment-5888048139

## 1. Purpose

An anchor comment can decorate the value it renders with a display transform
that never touches the stored value — today, exactly one such transform
exists: a trailing `%` on the comment (`<!--vmark=x.y%-->`), shipped as
[#140](https://github.com/michal-niedzwiedzki/visimark/issues/140). It is
one-off, punctuation-only syntax with no room to add a second transform
(`nbsp` for accountant-style thousands spacing, `sci` for scientific
notation) without inventing a new sigil each time, each with no shared
contract.

This spec replaces the `%` sigil with a **display rule**: a named transform
invoked with `|name` after the anchor target (`<!--vmark=x.y|percent-->`),
drawn from a closed, catalogue-governed registry. `percent` is the first and,
after this issue, only entry — a drop-in replacement for `%` with unchanged
rendering. `nbsp`, `sci`, and any other transform are each their own future
vocabulary request; this issue adds the mechanism and its one first consumer,
nothing else.

**Motivating document**, reproduced on `master`:

```markdown
The engagement clears a margin of **40.26%**<!--vmark=lines.margin%-->.
```

`%` is shipped and load-bearing in four real documents in this repo:
`docs/tutorial/runway.md`, `docs/example-executable-documentation.md`,
`docs/tutorial/capstone.md`, `packages/visimark/test/fixtures/percent-display-sigil.md`
— all four already seed through a delimited node (`**...**`), never bare.

## 2. Syntax

The anchor-comment grammar gains one optional suffix, a pipe followed by a
bare identifier:

```
<!--vmark=sheet.name-->
<!--vmark=sheet.name|rule-->
```

`ANCHOR_RE` (`packages/visimark/src/parse/document.ts:152-153`) changes from:

```ts
/^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(%)?\s*-->$/
```

to:

```ts
/^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?:\|([A-Za-z_][A-Za-z0-9_]*))?\s*-->$/
```

Capture group 3, when present, is the display-rule name. `RawAnchor.percent?:
true` (`document.ts:102-103`) is replaced by `RawAnchor.displayRule?: string`.

**Scope, explicit.** The grammar admits exactly one optional `|name` suffix —
no chaining (`|a|b`), no literal arguments (`|prefix("0x")`). `percent` takes
none. Chaining and an argument grammar are deferred in full to whichever
future display-rule request first needs either (decided in review: neither
has a real consumer yet, and inventing the grammar now would fail the
catalogue's own §14 "a real document needs it" bar). A future request that
needs arguments extends `ANCHOR_RE` itself — this issue does not reserve
syntax for it.

**Registry.** A closed map in `packages/visimark/src/eval/display-rules.ts`
(renamed from `percent-display.ts`, which becomes this rule's implementation):

```ts
interface DisplayRule {
  /** true if the rule accepts a scalar of this value's type */
  accepts(v: Value): boolean;
  /** stored value, at the binding's write precision, to rendered text */
  render(v: Value, places: number): string;
}

const DISPLAY_RULES: Readonly<Record<string, DisplayRule>> = {
  percent: {
    accepts: (v) => v.t === "num",
    render: percentDisplay, // unchanged: × 100 at precision − 2, leading `-`, trailing `%`
  },
};
```

No user-defined entries (constraint 4, no plugin surface) — adding a rule
means adding a key here, behind its own catalogue-approved issue.

**Seeding.** An anchor carrying a display-rule name requires a **delimited**
seed — `strong`, `emphasis`, or `inlineCode` (`**x**`, `_x_`, `` `x` ``) —
accepted regardless of content, exactly as [#298](https://github.com/michal-niedzwiedzki/visimark/issues/298)
already defined for any anchor. A bare, undelimited text node in front of a
display-rule anchor is refused (`ANCHOR`), never accepted by shape the way a
plain numeric or date anchor's bare trailing token is. An anchor with no
display-rule name is entirely unaffected — #298's existing rule (bare number/
date accepted by shape, bare string never) governs it exactly as it does
today.

This is a **narrowing**, not new grammar: `fmt` locates a delimited seed's
span via the existing `innerValueSpan` (`document.ts`), unchanged. No locator
contract, no backward text scan — the delimiter already marks the exact
bounds regardless of what the old rendering said. (An earlier draft of this
issue proposed an `own(textBefore) → length` locator per rule; the review
closed that question by requiring a delimited seed instead, since every named
document seeds this way already — see the issue's discussion.)

## 3. Semantics

| Input | Rendered (`fmt`) | Notes |
|---|---|---|
| `margin = 0.4026`, `precision 4`, `**40.26%**<!--vmark=lines.margin\|percent-->` | `**40.26%**<!--vmark=lines.margin\|percent-->` | Matches today's `%` output exactly — `percentDisplay` is unchanged: × 100 at precision − 2. |
| `margin = 0.4155`, same anchor, stale prose `**40.26%**` | rewritten to `**41.55%**` | `STALE` before `fmt`; both sides shown in rendered form (`40.26% ≠ 41.55%`), same as `%` today. |
| `rate = -0.05`, `precision 4`, `**-5%**<!--vmark=s.rate\|percent-->` | unchanged if current | Leading `-` on a negative ratio, matching `percentDisplay`'s existing sign rule. |
| `**_**<!--vmark=x.y\|percent-->` (unseeded, delimited) | `fmt` writes the rendered value inside the delimiter | Same as any other delimited seed today — `**_**` is the documented convention from #298. |
| `40.26%<!--vmark=x.y\|percent-->` (bare, undelimited) | refused | `ANCHOR` — no delimited seed. Never written; `check` names the fix. |
| `<!--vmark=x.y\|nope-->` (any seed) | refused | `ANCHOR` — unknown display-rule name. |
| `<!--vmark=x.y%-->` (old syntax) | refused | Falls out of `ANCHOR_RE` entirely (no `%` production); the loose prefix still matches, so this is the existing **malformed anchor** path, not a new one. |

## 4. Type rules and errors

All in `packages/visimark/src/eval/check.ts`, replacing the `percentMine`
block at lines 746-790 (unchanged in position and evaluation order — still
gated on the binding's own expression evaluating successfully, same
"skipped because upstream" behaviour as today):

| Case | Code | Message |
|---|---|---|
| `\|<name>` where `<name>` is not a `DISPLAY_RULES` key | `ANCHOR` | `` unknown display rule `<name>` `` |
| Display-rule anchor whose seed is a bare text node (`a.value.kind === "text"`) | `ANCHOR` | `a display rule needs a delimited seed — wrap a placeholder instead, such as **_**` |
| Display-rule anchor on a binding whose value type the rule's `accepts()` rejects (only `percent` today: non-numeric) | `TYPE` | `a display rule is only legal on a value it accepts (percent: numeric only)` — replaces `"a % sigil is only legal on a numeric scalar"` |
| `percent` on a binding with declared/derived precision below 2 | `PRECISION` | `percent display needs precision 2 or more; ${binding.name} has ${prec}` — **unchanged**, stays scoped to `percent` by name (a width floor is not a property every future rule will share) |
| `percent`'s rendered value shares a span with a unit decoration | `UNIT` | `cannot mix a unit with a display rule` — replaces `"cannot mix a unit with percent display"` |
| Malformed comment (`<!--vmark=x.y%-->` and any other loose-but-not-full match) | `ANCHOR` | `` malformed anchor comment — expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name|rule-->` `` — replaces the `%`-form in the existing message at `model/build.ts:387-388` |
| `STALE` | `STALE` | unchanged in meaning; the rendered chain (here, `percentDisplay`'s output) is what's compared and shown, exactly as `%` does today |

No new §10 code. Three existing `visimark-design.md` §10 rows (lines 626,
631, 634) reword:
- `UNIT`: `"a % sigil shares a span with a unit"` → `"a display rule shares a span with a unit"`
- `TYPE`: `"a % sigil on a non-numeric scalar or a chart/image"` → `"a display rule on a value of a type it does not accept, or a chart/image"`
- `PRECISION`: stays scoped to `percent` by name — `"a percent display rule on a binding whose width is below 2"`

The `%`-specific prose at `visimark-design.md:125-158` (the whole "An
optional trailing `%`..." passage) is replaced by a description of `|name`
syntax, the closed registry, the delimited-seed requirement, and `percent` as
the shipped example — folding in #298's already-shipped acceptance rule by
reference rather than restating it.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax))** — unaffected. No new expression syntax, mapper, operator, or reducer; anchor-comment grammar only.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation))** — unaffected. A display rule never participates in evaluation; it renders a value already computed.
- **Write-back ([§9](../visimark-design.md#9-write-back))** — an anchored value with a display rule stays the same tool-owned category it always was; the rule changes only what `fmt` writes into the span it already owns.
- **Anchors ([§3](../visimark-design.md#3-document-model))** — the acceptance grammar #298 shipped is reused, narrowed by one rule: a display-rule anchor's bare-text branch is refused outright rather than checked against the base type.
- **`matchesStored` (`check.ts:1137-1153`)** — **unchanged, kept on purpose.** Its `PERCENT_RE` fold (`N%` ÷ 100, lines 1144-1147) is not gated on `a.percent`/`a.displayRule` at all — it makes `check` treat percent-shaped prose as matching a stored ratio on *any* numeric anchor, sigil or not, which `docs/tutorial.md`'s own worked lesson depends on ("`check` compares numbers, not spellings… either text is clean, with or without `%` on the anchor"). Removing it would be a second, undiscussed breaking change and would falsify that lesson. Only the code that special-cased `%` for *rendering* — `check.ts`'s `STALE` `computed` field and `fmt.ts`'s write-back — moves to the registry; the matching leniency itself is untouched.
- **`eval`, `explain`, `--json`** — unaffected; all three report the stored value, never a display rule's rendering. Confirmed unchanged from today's `%` behaviour.
- **`infer --write`** — unaffected; never emits a display-rule suffix, exactly as it never emitted `%`. It cannot know which values deserve one.
- **`check`, `fmt`** — as specified above.
- **What does not change:** the shape system, evaluation order, name resolution, units (beyond the reworded `UNIT` message), dates, `param`/`assert`/`chart`/imports, and every CLI option surface (section F is untouched — no new flag, no new exit code). Table-cell write-back (`fmt.ts`'s "computed column cells" pass) is untouched — a display rule applies only to a scalar anchor, exactly as `%` does today; a column cell has no `|name` grammar to carry one.

## 6. Acceptance

New fixture, `packages/visimark/test/fixtures/display-rule-percent.md` (replaces
`percent-display-sigil.md`, migrated to the new syntax):

````markdown
```vmark #s
margin precision 4 = 0.4026
loss precision 4 = -0.05
over precision 4 = 1.50
```

Margin **40.26%**<!--vmark=s.margin|percent-->.
Negative **-5%**<!--vmark=s.loss|percent-->.
Over **150%**<!--vmark=s.over|percent-->.
````

```
$ visimark check display-rule-percent.md
  0 problems (0 stale, 0 errors)
```

Stale case — same fixture with `margin` changed to `0.4155` and the prose
left at `40.26%`:

```
$ visimark check display-rule-percent.md
  STALE   s.margin   40.26% ≠ 41.55%
  1 problem (1 stale, 0 errors)
$ visimark fmt display-rule-percent.md
display-rule-percent.md: updated 1 anchor
$ tail -1 display-rule-percent.md
Margin **41.55%**<!--vmark=s.margin|percent-->.
```

Refusal cases, new fixture `packages/visimark/test/fixtures/display-rule-errors.md`:

````markdown
```vmark #s
margin precision 4 = 0.4026
status = "ok"
```

Bare 40.26%<!--vmark=s.margin|percent-->.
Unknown **40.26%**<!--vmark=s.margin|nope-->.
Wrong type **ok**<!--vmark=s.status|percent-->.
Old syntax **40.26%**<!--vmark=s.margin%-->.
````

```
$ visimark check display-rule-errors.md
  ANCHOR  s.margin   a display rule needs a delimited seed — wrap a placeholder instead, such as **_**
  ANCHOR  s.margin   unknown display rule `nope`
  TYPE    s.status   a display rule is only legal on a value it accepts (percent: numeric only)
  ANCHOR  .          malformed anchor comment — expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name|rule-->`
  4 problems (0 stale, 4 errors)
```

Migration, all four named documents: `%` → `|percent`, delimited seed
unchanged (all four already are). `CHANGELOG.md` gets an `### Added` (new
`|name` syntax and `percent`) and a paired note under `### Changed` or
`### Removed` for the `%` sigil's retirement, naming the four migrated
documents. `docs/design/presentation-only-percent-display-sigil-spec.md`
is superseded by this spec — replace its body with a one-line pointer here,
keeping the file (and its historical PR link) rather than deleting it,
matching how other superseded design docs in this repo are handled.

## 7. Non-goals

- `nbsp`, `sci`, `hex`, `prefix`, or any display rule besides `percent` — each its own future catalogue request.
- Chaining more than one display rule, and literal arguments to a display rule — deferred in full (§2 above) to whichever future request first needs either.
- The `&nbsp;&nbsp;` field-separator question for a future `nbsp` rule — explicitly left for that request; this issue's delimited-seed requirement means `nbsp` only has to specify what its `render` does with a delimited node's content, not how to find the span.
- `^`/`sci` forks (ASCII `e+` vs. `×10ⁿ`, superscript digits) — future `sci` request.
- The numeric bare-anchor word-deletion fork from #146's pre-review — separate, narrower issue, not fixed here.
- Anything about `docs/tutorial.md` ch. 9's string-anchor gap beyond what #298 already closed — a seeded string anchor with drifted prose stays silently unverified after this issue, same as before; closing that is `nbsp`'s job, not this one's.

## 8. Open questions

None.
