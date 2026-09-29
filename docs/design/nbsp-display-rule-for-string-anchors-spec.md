# `nbsp` display rule for string anchors — feature spec

**Status:** approved (#305) · **Date:** 2026-09-29 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/305#issuecomment-5892873150

## 1. Purpose

`|nbsp` is the second entry in the closed display-rule registry
(`packages/visimark/src/eval/display-rules.ts`, [#297](https://github.com/michal-niedzwiedzki/visimark/issues/297)).
On a string-valued scalar with a `**…**` or `*…*` seed, it asks `fmt` to write
the stored words joined with the `&nbsp;` entity, and it gives `check` a way to
report `STALE` when that span drifts from the stored string.

The motivating document, reproduced on `master`:

````markdown
```vmark #s
status = "past due"
```

Account status: **past due**<!--vmark=s.status--> as of today.
````

Change `status` to `"paid in full"` and `check` still reports
`0 problems (0 stale, 0 errors)`. A string anchor is never compared with its
prose. That is the "one current limit" in `docs/tutorial.md` ch. 9. With this
spec:

````markdown
Account status: **past&nbsp;due**<!--vmark=s.status|nbsp--> as of today.
````

`check` reports `STALE` when `status` changes, and `fmt` rewrites the span to
`paid&nbsp;in&nbsp;full`.

Nothing that ships today reaches this. `|percent` accepts numbers only. A
plain string anchor is never checked. A writing convention such as "always
wrap a multi-word value in `**`" gives a delimiter but no joiner and no
`STALE`. This spec supersedes [#146](https://github.com/michal-niedzwiedzki/visimark/issues/146)
(`DEFERRED`, closed). #146 needed its own boundary marker to find an unseeded
target. The delimited-seed rule from #297/[#298](https://github.com/michal-niedzwiedzki/visimark/issues/298)
makes that marker unnecessary. #146's `_` joiner (`|underscore`) is **not**
carried over, because no real document needs it.

## 2. Syntax

No grammar change. `ANCHOR_RE` (`packages/visimark/src/parse/document.ts`)
already admits one optional `|name`:

```
<!--vmark=sheet.name|nbsp-->
```

`nbsp` becomes a key in `DISPLAY_RULES`. The `DisplayRule` interface gains two
fields, so that neither message nor check has to be extended by hand for each
rule:

```ts
export interface DisplayRule {
  accepts(v: Value): boolean;
  render(v: Value, places: number): string;
  /** the accepted-type phrase in the shared TYPE message, e.g. "numeric only" */
  accepted: string;
  /** false when the rendering is not legible inside a code span */
  inlineCode: boolean;
}

percent: { accepts: (v) => v.t === "num", render: percentDisplay, accepted: "numeric only", inlineCode: true },
nbsp:    { accepts: (v) => v.t === "str", render: nbspDisplay,    accepted: "string only",  inlineCode: false },
```

`nbspDisplay(v)` returns `v.s.trim().split(/\s+/).join("&nbsp;")` and ignores
`places`. A string value has no write precision, so callers pass `0`. `/\s+/`
is ECMAScript `\s`, which includes U+00A0 and the other Unicode space
separators. A stored U+00A0 is therefore a word boundary like any other space.

**Where it may appear:** after a `strong` (`**…**`, `__…__`) or `emphasis`
(`*…*`, `_…_`) node that wraps exactly one plain text child. That is the
existing delimited-seed rule. A bare text seed is refused, as for every display
rule. An `inlineCode` seed is refused for `nbsp` (§4).

**In an unmodified renderer** (constraint 1, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)):
the comment is hidden. `&nbsp;` is a standard HTML entity that every CommonMark
renderer decodes to U+00A0 inside `strong`/`emphasis`. `**past&nbsp;due**`
shows as **past due**. The literal entity form is written, never a raw U+00A0
byte, so the output stays visible in a terminal diff. It also matches the
repository's own `&nbsp;&nbsp;` separator convention.

## 3. Semantics

Let `words` = `v.s.trim().split(/\s+/)`. Let `rendered` = `words.join("&nbsp;")`,
the text `fmt` writes. Let `expected` = `words.join(" ")`, the text a
reader sees. The span is the raw source slice between the delimiters.

`check` decides in this order, per `|nbsp` anchor that is not already refused:

1. **Round trip.** Take the document source, replace the span with `rendered`,
   and re-parse the result with the document parser (`remark-parse` +
   `remark-gfm`, as `parseDocument` does). Find the anchor whose comment
   now starts at `commentSpan.start + rendered.length − (span.end − span.start)`.
   The round trip holds only if all of the following are true: that anchor
   exists; its target node is the same kind (`strong` or `emphasis`) as
   before; the node wraps exactly one `text` child; that child's source span
   is exactly the spliced `rendered`; and the child's decoded value equals
   `expected`. If any of these fails, the anchor is refused as `ANCHOR` (§4)
   and added to `refusedAnchors`, so `fmt` never writes it. This runs even
   when the span already equals `rendered`, because an unchanged span can
   still decode to something other than `expected`.
2. **Staleness.** The span is clean when it is **byte-equal** to `rendered`.
   Otherwise it is `STALE`, with `stored` = the span and `computed` =
   `rendered`. No lenient fold applies. `percent`'s `N%` ÷ 100 fold lives in
   `matchesStored` and is untouched; `nbsp` never goes through `matchesStored`.

`fmt` writes `rendered` into the span when that span is `STALE`. It never
writes a refused anchor or an anchor on a scalar that has a `TYPE` finding.

| Case | Stored `v.s` | Span in (source) | `check` | `fmt` writes |
|---|---|---|---|---|
| Motivating, current | `past due` | `past&nbsp;due` | clean | nothing |
| Motivating, drifted | `paid in full` | `past&nbsp;due` | `STALE` `past&nbsp;due ≠ paid&nbsp;in&nbsp;full` | `paid&nbsp;in&nbsp;full` |
| Placeholder seed | `past due` | `_` (in `**_**`) | `STALE` `_ ≠ past&nbsp;due` | `past&nbsp;due` |
| Plain space typed by hand | `past due` | `past due` | `STALE` `past due ≠ past&nbsp;due` | `past&nbsp;due` |
| Raw U+00A0 typed by hand | `past due` | `past` U+00A0 `due` | `STALE` (the left side shows the raw byte) | `past&nbsp;due` |
| Numeric entity typed by hand | `past due` | `past&#160;due` | `STALE` `past&#160;due ≠ past&nbsp;due` | `past&nbsp;due` |
| `\|nbsp` added to an existing plain anchor | `past due` | `past due` | `STALE` until `fmt` runs, as when `\|percent` is adopted | `past&nbsp;due` |
| Single word | `settled` | `settled` | clean (a single word is legal, and `nbsp` is a no-op on it) | nothing |
| Surrounding and repeated whitespace | `"  past   due "` | `past&nbsp;due` | clean | nothing |
| Stored U+00A0 | `past` U+00A0 `due` | `past&nbsp;due` | clean (U+00A0 splits) | nothing |
| Intraword `_` in `**…**` | `user_id` | `user_id` | clean (not emphasis syntax) | nothing |
| Intraword `_` in `_…_` | `user_id` | `user_id` | clean (verified: `_user_id_` parses as emphasis with text `user_id`) | nothing |
| `*…*` delimiter | `past due` | `past&nbsp;due` | clean | nothing |
| Emphasis inside the value | `a *b* c` | `_` | `ANCHOR` round trip (names `*`) | nothing |
| Code inside the value | ``run `ls` now`` | `_` | `ANCHOR` round trip (names `` ` ``) | nothing |
| Entity text inside the value | `already&nbsp;joined` | `_` | `ANCHOR` round trip (names `&`). It would decode to U+00A0, not to the stored text. This overrides the issue body's "passes through untouched". | nothing |
| Empty or whitespace-only | `""`, `"   "` | `_` | `ANCHOR` empty (`****` is not a strong node) | nothing |
| Would autolink (GFM) | `www.example.com` | `_` | `ANCHOR` round trip (names no character) | nothing |
| Flanking breaks in context | `"a"` in `x**…**y` | `_` | `ANCHOR` round trip (names no character). Verified: `x**"a"**y` is not strong. | nothing |
| Human `&nbsp;&nbsp;` separator beside the anchor | `past due` | `past&nbsp;due` | clean, and the separator is prose that is never read | nothing |
| Plain string anchor, no rule | any | any | unchecked, as today | nothing |

When several `|nbsp` anchors bind one scalar, each one is decided on its own,
in its own delimiter. When `fmt` writes several of them in one run, each splice
is inside its own inline node. No inline construct spans two nodes, so the
round trips that were proved one at a time still hold together.

## 4. Type rules and errors

This spec adds no new §10 code.

| Case | When | Code | Message |
|---|---|---|---|
| `\|nbsp` on a non-string (number, date) | after evaluation, once per scalar (first offending anchor) | `TYPE` | `a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only)` |
| `\|nbsp` on a chart image | report stage (`check-report.ts`) | `TYPE` | the same message |
| `\|nbsp` with a bare text seed | pre-loop, as today | `ANCHOR` | `a display rule needs a delimited seed — wrap a placeholder instead, such as **_**` (unchanged) |
| `\|nbsp` with an `inlineCode` seed | pre-loop, for any registered rule with `inlineCode: false`, regardless of value type | `ANCHOR` | ``display rule `nbsp` cannot render inside a code span — wrap the seed in **…** or *…* instead`` |
| Round trip fails, value empty after trim | §3 step 1 | `ANCHOR` | ``display rule `nbsp` cannot write an empty value inside <open>…<close>`` |
| Round trip fails, value contains syntax characters | §3 step 1 | `ANCHOR` | ``display rule `nbsp` cannot write this value inside <open>…<close> and read it back unchanged — it contains Markdown syntax: <chars>`` |
| Round trip fails, no syntax character | §3 step 1 | `ANCHOR` | ``display rule `nbsp` cannot write this value inside <open>…<close> and read it back unchanged`` |
| `\|nbsp\|percent`, or any second name | parse | `ANCHOR` | the existing malformed-comment message (the grammar allows at most one `\|name`) |
| Span drifted | §3 step 2 | `STALE` | `stored ≠ computed` |

- `<open>` and `<close>` are the seed's own delimiters, sliced from the source
  (`**`, `__`, `*`, `_`). For `**_**`, the message says `**…**`.
- `<chars>` lists each distinct character of the stored value from the set
  `` \ ` * _ [ ] < & ~ ``, in order of first appearance, separated by single
  spaces.
- The `TYPE` message is built from the registry: `name: accepted` for each
  entry in registry order, joined with `; `. The same builder replaces both
  hardcoded copies, in `check.ts` and `check-report.ts`. The existing
  `display-rule-errors.md` expectation and `docs/tutorial.md`'s refusal table
  change with it. The existing test asserts only the prefix
  `a display rule is only legal on a value it accepts`, so it still passes.
- A code-span seed with a wrong-type value reports both findings, `TYPE` and
  `ANCHOR`, because each is independently true.
- Any refused anchor is added to `refusedAnchors`, and `fmt` skips it. A
  `TYPE` finding sets `sigilBlocked` for the scalar, as it does today.
- Under an upstream error ([§8](../visimark-design.md#8-evaluation)), a
  scalar whose expression is unevaluable is never checked. Its `|nbsp`
  anchors get no `TYPE`, round-trip or `STALE` finding. That is the existing
  suppression, unchanged.
- An unknown rule name keeps its existing `ANCHOR` and gets no other finding.

**Where the code changes.** Both numeric-only gates get a text branch that
never touches `matchesStored`:

- `check.ts`: the `STALE` loop is gated on
  `!sigilBlocked && prec !== null && v.t === "num"`. A sibling branch,
  `!sigilBlocked && v.t === "str"`, runs §3 over `mine` anchors whose
  `displayRule` names a registered rule, skipping `refusedAnchors`. It adds the
  scalar to `staleScalars` on a `STALE`, as the numeric branch does. A text
  binding's `prec` is `null`, and nothing here requires one.
- `fmt.ts`: the anchored-scalar pass `continue`s on `prec === undefined`
  before it reaches the rule. For a `str` value with a registered rule, a text
  branch placed before that line writes `rule.render(v, 0)` when
  `current !== wanted`, after the existing `refusedAnchors` and `sigilBlocked`
  skips. A `str` value with no rule is skipped, as today.
- `parse/document.ts`: the round trip needs a target's decoded text.
  `RawAnchor` gains `valueText?: string`, set for `strong`/`emphasis` targets
  to the single text child's decoded `value`. The re-parse reuses the
  document's own parse entry point.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)):** unaffected. No
  expression syntax.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)):**
  unaffected. The rule renders a value that is already computed. Suppression is
  as §4 describes.
- **Write-back ([§9](../visimark-design.md#9-write-back)):** the anchored value
  is still the tool-owned category it always was. What is new is that `fmt`
  writes an author-supplied **string** into prose for the first time, and only
  after the round trip proves it. Diffability: one changed string rewrites
  exactly its `|nbsp` spans. `fmt` never touches a plain string anchor and
  never adds `|nbsp` to a comment.
- **Anchors ([§3](../visimark-design.md#3-document-model)):** the delimited-seed
  rule is reused. `nbsp` narrows it further by refusing `inlineCode`. A plain
  string anchor stays unchecked. Drift detection for plain delimited string
  anchors is still open (§7).
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)):**
  unchanged.
- **Numeric semantics and units ([§7](../visimark-design.md#7-numeric-semantics)):**
  not involved. There is no precision, no rounding and no unit on a string.
  `nbsp` has no `PRECISION` or `UNIT` case.
- **Dates ([§5](../visimark-design.md#5-dates)):** `|nbsp` on a date is `TYPE`.
- **`param` ([§20](../visimark-design.md#20-scenario-parameters)):** a string
  `param` renders its default. `eval --scenario` still reports stored strings.
- **`assert`, `chart`, imports, column aliases, declared precision:**
  unchanged. `|nbsp` on a chart image is `TYPE`. A column cell has no `|name`
  grammar.
- **`matchesStored`:** unchanged, including its text branch `t === v.s`.
- **CLI:**
  - `check`: new `STALE` and `ANCHOR` findings as specified. Exit codes are
    unchanged (`0` clean, `1` findings). `--json` gains no shape change:
    `STALE` carries `details.stored` / `details.computed` as the raw span and
    `rendered`, and `ANCHOR` / `TYPE` carry `details.message`.
  - `fmt`: as specified. It prints the usual `updated N anchor(s)`.
  - `eval`, `eval --json`, `eval --scenario`, `explain`: the stored string,
    never the rendering.
  - `infer`: parses `|nbsp` as an anchor. `infer --write` never emits `|nbsp`.
  - Did-you-mean: none exists for rule names. Unchanged.
- **Editors and integrations:** `visimark-lsp` (diagnostics, code actions,
  formatting), `visimark-mcp`, the Obsidian plugin and `remark-lint-visimark`
  all consume `check`/`planFmt`. They gain the new findings and repairs with no
  code change of their own.

**What does not change:** the anchor grammar, `percent`'s behaviour and
messages (except the shared `TYPE` parenthetical), numeric and date anchor
checking, plain string anchors, table-cell write-back, exit codes, the
`--json` envelope, and every CLI option.

**Documents that pass `check` today** still pass. No document in `docs/` or
`packages/` uses `|nbsp`, and today it is `ANCHOR` (unknown rule).

## 6. Acceptance

**Fixture** `packages/visimark/test/fixtures/display-rule-nbsp.md`:

````markdown
# Account

```vmark #s
status = "past due"
key = "user_id"
one = "settled"
```

**Status:** **past&nbsp;due**<!--vmark=s.status|nbsp--> &nbsp;&nbsp; **Also:** *past&nbsp;due*<!--vmark=s.status|nbsp-->

Key **user_id**<!--vmark=s.key|nbsp--> or _user_id_<!--vmark=s.key|nbsp-->. One word **settled**<!--vmark=s.one|nbsp-->.

A plain anchor is still unchecked: **past due**<!--vmark=s.status-->.
````

```
$ bun run packages/visimark/src/cli/main.ts check packages/visimark/test/fixtures/display-rule-nbsp.md
packages/visimark/test/fixtures/display-rule-nbsp.md

  0 problems (0 stale, 0 errors)
```

Exit `0`. `eval --json` reports `"s.status": "past due"`.

**Drift.** Copy the fixture and change `status` to `"paid in full"`:

```
  STALE   s.status                            past&nbsp;due ≠ paid&nbsp;in&nbsp;full
  STALE   s.status                            past&nbsp;due ≠ paid&nbsp;in&nbsp;full
  STALE   3 prose anchors bound to the values above

  5 problems (5 stale, 0 errors)
```

Exit `1`. The group line counts every anchor of the stale scalar, including the
plain one, as it does today. `fmt` prints `…: updated 2 anchors`. The status
line becomes:

```markdown
**Status:** **paid&nbsp;in&nbsp;full**<!--vmark=s.status|nbsp--> &nbsp;&nbsp; **Also:** *paid&nbsp;in&nbsp;full*<!--vmark=s.status|nbsp-->
```

The `&nbsp;&nbsp;` separator and the plain anchor's `**past due**` are
byte-identical to before. A second `fmt` prints `unchanged`, and `check` exits
`0`.

**Hand-typed variants.** Replace the first span with `past&#160;due`, then
with `past due`: each gives one `STALE` line and exit `1`, and `fmt` restores
`past&nbsp;due`.

**Refusals** — fixture `packages/visimark/test/fixtures/display-rule-nbsp-errors.md`:

````markdown
```vmark #s
bare = "past due"
code = "past due"
n precision 2 = 3
star = "a *b* c"
tick = "run `ls` now"
joined = "already&nbsp;joined"
empty = ""
```

Bare past due<!--vmark=s.bare|nbsp-->.
Code `past due`<!--vmark=s.code|nbsp-->.
Number `3.00`<!--vmark=s.n|nbsp-->.
Star **_**<!--vmark=s.star|nbsp-->.
Tick **_**<!--vmark=s.tick|nbsp-->.
Joined **_**<!--vmark=s.joined|nbsp-->.
Empty **_**<!--vmark=s.empty|nbsp-->.
Two **past due**<!--vmark=s.bare|nbsp|percent-->.
````

```
packages/visimark/test/fixtures/display-rule-nbsp-errors.md

  TYPE    s.n               a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only)

  ANCHOR  .                 malformed anchor comment — expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name|rule-->`

  ANCHOR  s.bare            a display rule needs a delimited seed — wrap a placeholder instead, such as **_**

  ANCHOR  s.code            display rule `nbsp` cannot render inside a code span — wrap the seed in **…** or *…* instead

  ANCHOR  s.n               display rule `nbsp` cannot render inside a code span — wrap the seed in **…** or *…* instead

  ANCHOR  s.star            display rule `nbsp` cannot write this value inside **…** and read it back unchanged — it contains Markdown syntax: *

  ANCHOR  s.tick            display rule `nbsp` cannot write this value inside **…** and read it back unchanged — it contains Markdown syntax: `

  ANCHOR  s.joined          display rule `nbsp` cannot write this value inside **…** and read it back unchanged — it contains Markdown syntax: &

  ANCHOR  s.empty           display rule `nbsp` cannot write an empty value inside **…**

  9 problems (0 stale, 9 errors)
```

Exit `1`. `fmt` on this fixture prints `unchanged`, and the file is
byte-identical afterwards. Ordering is the report's existing rule: `TYPE`
(rank 0) before `ANCHOR` (rank 3). Model findings (the malformed comment) come
first within a rank, then emission order, which follows binding order.

**Unit tests** (`test/eval/`): `nbspDisplay` over every §3 row (trim,
repeated whitespace, U+00A0, single word, empty); the round trip for the
autolink (`www.example.com`) and in-context flanking (`x**…**y` with `"a"`)
rows, which report the message with no character list; `_…_` and `__…__`
delimiters appearing in the message; a numeric `display-rule-percent.md` run
that is unchanged.

## 7. Non-goals

- `|underscore`, or any joiner besides `&nbsp;`. #146's `_` case is dropped as
  unmotivated.
- Drift detection for a **plain** delimited string anchor. An opt-in identity
  rule (joiner `" "`) could give it without changing any passing result. That
  is its own future issue.
- String or date anchors with no rule. Date anchor checking is out of scope.
- Chaining rules, or rule arguments. The grammar still allows one `|name`.
- Escaping author strings so they survive Markdown. `nbsp` refuses them; it
  never rewrites them.
- `fmt` adding `|nbsp` to a comment, and `infer --write` proposing it.
- `nbsp` for numbers (thousands spacing). That would be a separate rule with
  its own request.

## 8. Open questions

None.

<!--vmark:no-formulas-->
