# Type-aware anchor placeholder acceptance — feature spec

**Status:** approved (#298) · **Date:** 2026-09-29 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/298#issuecomment-5886082114

## 1. Purpose

An anchor rewrites the inline node immediately in front of its comment
([§3](../visimark-design.md#3-document-model)). Today that node qualifies as a
rewritable target on syntactic shape alone — `strong`/`emphasis`/`inlineCode`
unconditionally, or, for a bare text node, its trailing whitespace-delimited
word, whatever that word is. Nothing checks whether the word actually looks
like a value of the anchor's own type before `fmt` claims it.

Two live, reproduced consequences, against `master`:

````
$ cat s.md
```vmark #s
b precision 2 = 0.25
```

It comes to <!--vmark=s.b--> PLN.

$ visimark check s.md
  STALE   s.b   to ≠ 0.25
$ visimark fmt s.md
$ tail -1 s.md
It comes 0.25 <!--vmark=s.b--> PLN.
````
`fmt` deletes the word `to`. `check` flags the mismatch first, but nothing in
the `STALE` line reads as "this will delete a word," and `fmt` does it anyway.

````
$ cat s2.md
```vmark #s
status = "all clear"
```

The status is no problem<!--vmark=s.status--> today.

$ visimark check s2.md
  0 problems (0 stale, 0 errors)
````
`check` never flags this at all — the same gap `docs/tutorial.md` ch. 9
already documents as "one current limit," for a stale value hiding under
prose that no longer describes it.

This spec closes both by making placeholder acceptance **type-aware**: a bare,
unwrapped word only counts as an anchor's target when it already unambiguously
denotes a value of that anchor's own type. Anything else bare in front of an
anchor refuses with `ANCHOR` instead of being silently claimed. This is
[§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 3
("ambiguity is an error, never a guess") applied to a case the constraint
was never checked against: today's rule is exactly the kind of guess
constraint 3 exists to forbid.

A related, narrower bug surfaced while specifying this: a **delimited**
placeholder (`**…**`) whose content itself contains nested Markdown emphasis
(a literal `**` inside a `**`-wrapped anchor value) is silently mis-scoped
today rather than refused — see §4.

## 2. Syntax

No grammar changes. `<!--vmark=sheet.name-->` and `<!--vmark=sheet.name%-->`
are unchanged. This spec changes only the **acceptance rule** that decides
whether the inline node in front of the comment is a valid rewrite target —
[§3](../visimark-design.md#3-document-model)'s "the anchor rewrites the text
content of the inline node immediately preceding it."

**Delimited node** (`strong`, `emphasis`, `inlineCode`) — accepted for any
anchor type, exactly as today, on one added condition: the node must contain
exactly one child and that child must be a plain text node (§4). Content is
not otherwise inspected — `**0**`, `**hello**`, and `**_**` are equally valid
seeds, because the wrapping itself is the explicit "this is the anchor's
target" signal, independent of what the wrapped text says.
[§7](../visimark-design.md#7-numeric-semantics)'s "precision does not come
from prose" already establishes that a delimited placeholder's content is
never read for meaning; this spec does not change that.

**Bare text node** — accepted only when its trailing whitespace-delimited
token, taken as-is, unambiguously denotes a value of the anchor's own
resolved type:
- numeric anchor: the token parses as a number, decorated or not
  (`parseDecorated`, `packages/visimark/src/eval/units.ts` — the same
  function `matchesStored` already uses).
- date anchor: the token matches strict ISO 8601, `^\d{4}-\d{2}-\d{2}$`, and
  denotes a real calendar date (`parseIsoDate`,
  `packages/visimark/src/eval/dates.ts`). A non-ISO but decidable shape
  (`01/15/2026`) does not qualify here — that is a separate, unrelated `DATE`
  finding if it appears elsewhere in the document.
- string anchor: never. Bare prose cannot unambiguously denote an arbitrary
  string — any word could be part of it or not — so a string anchor only ever
  accepts a delimited node.

**No new reserved token.** `_` is not new grammar. It is documented (tutorial
migration, §7 below) as the recommended seed digit, always wrapped:
`**_**<!--vmark=sheet.name-->` — already legal today under the delimited-node
rule above, the same rule `**0**` uses. A bare, unwrapped `_` is exactly as
before: `_` does not parse as a number or a date, so it is rejected under the
bare-text-node rule like any other non-qualifying word.

**Nothing in front of the anchor** is unaffected: still `ANCHOR`, still the
paragraph-start case, same default message as today.

## 3. Semantics

One table, by resolved binding type and what precedes the anchor comment.

| Anchor type | What's in front | Today | This spec |
|---|---|---|---|
| numeric | delimited, any content (`**0**`) | seeded / `STALE` if content ≠ stored | unchanged |
| numeric | bare, numeric-shaped (`110.00`) | seeded / `STALE` if ≠ stored | unchanged |
| numeric | bare, not numeric-shaped (`to`) | seeded — **silently claims the word** | `ANCHOR` |
| numeric | nothing | `ANCHOR` | unchanged |
| date | delimited, any content (`**0**`) | seeded, but never `STALE`-checked (no date write-back exists) | unchanged — still never `STALE`-checked |
| date | bare, ISO-shaped, real date (`2026-01-15`) | seeded, but never `STALE`-checked | unchanged acceptance; still never `STALE`-checked |
| date | bare, not date-shaped (`soon`) | seeded — **silently claims the word**, never verified either way | `ANCHOR` |
| date | nothing | `ANCHOR` | unchanged |
| string | delimited, any content (`**all clear**`) | seeded, but never `STALE`-checked (no string write-back exists) | unchanged — still never `STALE`-checked |
| string | bare prose (`no problem`) | seeded — **silently claims the word**, never verified either way | `ANCHOR` |
| string | nothing | `ANCHOR` | unchanged |

**What this spec does not add**, stated plainly because it is easy to
misread the date/string rows above as a verification fix: date and string
scalars still have no `STALE` comparison and no `fmt` write-back at all,
regardless of what is in front of the anchor, before or after this change.
This spec only decides whether a span **qualifies as a target** — never
whether its content agrees with the stored value, for types where that
comparison doesn't exist. See §7 non-goals.

## 4. Type rules and errors

No new [§10](../visimark-design.md#10-error-taxonomy) code. `ANCHOR`'s
existing definition — "anchor with no rewritable target" — already covers a
refusal on a non-qualifying span; this widens its trigger set, the way
`STALE` was already widened for artifacts and import stamps.

| Condition | Code | Message |
|---|---|---|
| Bare token in front of a numeric anchor, not numeric-shaped | `ANCHOR` | `no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**` |
| Bare token in front of a date anchor, not a valid ISO date | `ANCHOR` | `no date to rewrite in front of this anchor — wrap a placeholder instead, such as **2026-01-01** or **_**` |
| Bare prose in front of a string anchor | `ANCHOR` | `a string anchor cannot rewrite bare prose — wrap a placeholder instead, such as **_**` |
| Delimited node (`strong`/`emphasis`) whose content is not exactly one plain text child | `ANCHOR` | reuses today's default, `no value to rewrite in front of this anchor` |
| Nothing in front of the anchor | `ANCHOR` | unchanged, today's default |

**The delimited-node one-child rule** (row 4) is a correctness fix bundled
into this change because it shares the same code path
(`innerValueSpan`, `packages/visimark/src/parse/document.ts`). Verified against
`master`:

````
$ cat embed.md
Claim: **a **bold** claim**<!--vmark=s.x-->.

```vmark #s
x = "a bold claim"
```
````

Today, `innerValueSpan` takes only `node.children?.[0]` with no check that it
is the node's only child. The nested `**bold**` produces a `strong` node with
three children (`"a "`, a nested `strong` "bold", `" claim"`); `innerValueSpan`
silently returns the span of just `"a "` — the rewrite target is mis-scoped,
not refused. `collectFigures` elsewhere in the same file already guards this
with `child.children?.length === 1`
(`packages/visimark/src/parse/document.ts:458`); `innerValueSpan` gets the
same guard. Where it fails, the node is not a rewritable target — `ANCHOR`,
same as a bare word that doesn't qualify.

This is also where the multi-word string answer lives:
`**a multi-word string**<!--vmark=sheet.name-->` is legal (single text child,
value `"a multi-word string"`). A value needing a literal `**` inside it does
not fit the delimited-node rule at all — use `` `a **literal** string` ``
(`inlineCode`, verbatim content, no nesting question) instead. No new
escaping syntax; inline code already exists for exactly this.

**Static vs evaluation.** The delimited-node one-child check is static
(parse-time, like today's `strong`/`emphasis`/`inlineCode`/`text` node-type
check). The bare-text-node type check is evaluation-time: it needs the
binding's resolved value type (`v0.t`), so it runs in `evalScalar`
(`packages/visimark/src/eval/check.ts`) once that type is known, for every
anchor of the binding — not only numeric ones, which is where today's parallel
logic stops (`evalScalar`'s existing `STALE` loop is gated
`prec !== null && v.t === "num"`; this spec's acceptance check runs
independently of that gate, before it, for every type).

**Suppression ([§8](../visimark-design.md#8-evaluation)).** If the scalar is
unevaluable from an upstream finding, its anchors produce no `ANCHOR` from
this rule — they fold into the existing per-binding suppression, same as a
numeric anchor's `STALE` does today.

## 5. Interaction with the rest of the language

- **Shape ([§4](../visimark-design.md#4-syntax)).** Unchanged. No new
  expression syntax, no new mapper/operator/reducer.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Unchanged structurally. The new check runs inside the existing per-binding
  evaluation, once the value's type is known; it adds no new dependency.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** The tool still
  owns exactly the same three categories. A span this spec refuses was
  already an anchor's nominal target being written incorrectly; refusing it
  writes nothing, rather than writing the wrong thing. One changed input
  still produces at most one changed span; a refused anchor now produces zero
  edits instead of a wrong one.
- **Anchors ([§3](../visimark-design.md#3-document-model)).** The rewrite-target
  rule ("the anchor rewrites the text content of the inline node immediately
  preceding it... a bare text node need not show a number") is amended: a
  bare text node's content is now read once, to check it denotes a value of
  the anchor's type, before it is accepted as a target — not to determine
  precision or width, which still come only from the binding
  ([§7](../visimark-design.md#7-numeric-semantics), unchanged).
- **Numeric semantics ([§7](../visimark-design.md#7-numeric-semantics)).**
  Unchanged. Write precision is still declared or derived on the binding,
  never from prose. This spec reads a bare token's *shape*, never its
  *value*, to decide whether it's a target — the shape check is discarded
  once the span is accepted; `fmt` still writes the binding's own width.
- **Error taxonomy ([§10](../visimark-design.md#10-error-taxonomy)).** `ANCHOR`
  widened as in §4. No new code.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).**
  Unchanged.
- **Imports, `param`, `assert`, `chart`, column aliases.** Unchanged — this
  spec touches only scalar prose-anchor acceptance, not columns, charts, or
  imported values.
- **`%` display sigil (#140).** Unchanged and orthogonal: the percent-legality
  check (is the sigil on a numeric scalar, `TYPE` if not) runs independently
  of this spec's acceptance check, over the same anchor list, so the two can
  both fire on one anchor. A `%` comment on a refused string-anchor span
  produces **both** `ANCHOR` (the target doesn't qualify) and `TYPE` (a `%`
  sigil is only legal on a numeric scalar) — two independently true findings
  about the same span, not one superseding the other.
- **#297 (future display rules).** Not required by this spec and this spec
  does not depend on it. If #297 introduces its own locator convention for
  finding a display rule's owned span, that convention and this spec's
  bare-text-node acceptance rule both answer "what span does the tool own
  here" for overlapping syntax (a bare or delimited node in front of an
  anchor comment) — reconciling them, if #297 lands with a different
  mechanism, is that issue's job when it is decided, not this spec's.

**CLI**

- `check`: reports the new `ANCHOR` cases from §4. Exit codes unchanged (`0`
  clean, `1` findings). `--json` envelope unchanged in shape; these are
  ordinary `ANCHOR` findings.
- `fmt`: does not write a span this spec refuses — same rule as any other
  non-`STALE` finding ([§10](../visimark-design.md#10-error-taxonomy)).
- `infer`: unaffected — it does not seed or read anchor prose today and does
  not start doing so here.
- `explain`, `eval`, `eval --json`: unaffected — none reads the prose in
  front of an anchor.
- Did-you-mean: unaffected, no new name.

**What does not change:** the anchor comment grammar itself, expression
syntax, evaluation order, write precision, units, the `%` sigil mechanism,
`STALE`/write-back for date- or string-valued scalars (still absent, before
and after), every CLI surface not listed above.

**Documents that pass `check` today:** `docs/playground/tutorial/03-sheets.md`
and every anchor in `docs/example-invoice.md` use a numeric-shaped bare token
or a `**…**`-delimited node — both keep passing unchanged. No in-tree document
anchors a string scalar today. `docs/tutorial.md` ch. 9's own worked example
(`Net of tax it comes to <!--vmark=order.net_total-->`) is the one place in
the repo that currently relies on the removed behaviour; §7 covers its
rewrite.

## 6. Acceptance

**Fixture** `packages/visimark/test/fixtures/anchor-placeholder-acceptance.md`,
covering every row of §3 and §4:

````markdown
Order total: **110.00**<!--vmark=s.order-->.
It comes to <!--vmark=s.bad--> PLN.
Due by 2026-01-15<!--vmark=s.due-->.
Due sometime soon<!--vmark=s.due_bad-->.
Status: **all clear**<!--vmark=s.status-->.
The status is no problem<!--vmark=s.status_bad--> today.
Seed: **_**<!--vmark=s.seed-->.
Claim: **a **bold** claim**<!--vmark=s.embed-->.

```vmark #s
order precision 2 = 110.00
bad precision 2 = 0.25
due = 2026-01-15
due_bad = 2026-02-01
status = "all clear"
status_bad = "all clear"
seed precision 2 = 7
embed = "a bold claim"
```
````

```
$ bun run packages/visimark/src/cli/main.ts check fixtures/anchor-placeholder-acceptance.md

  ANCHOR  s.bad          no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**
  ANCHOR  s.due_bad      no date to rewrite in front of this anchor — wrap a placeholder instead, such as **2026-01-01** or **_**
  ANCHOR  s.status_bad   a string anchor cannot rewrite bare prose — wrap a placeholder instead, such as **_**
  ANCHOR  s.embed        no value to rewrite in front of this anchor
  STALE   s.seed         _ ≠ 7.00
  STALE   1 prose anchors bound to the values above

  6 problems (2 stale, 4 errors)
$ echo $?
1
```

`fmt` rewrites `s.seed`'s span to `**7.00**` and leaves every `ANCHOR` span
untouched — same "does not write what it does not own" rule any other
non-`STALE` finding already gets. `s.order`, `s.due`, and `s.status` are
already correct and produce no findings; a second `fmt` is a no-op on the
whole file except for `s.seed`.

**In-tree document.** `docs/tutorial.md` ch. 9's "Always give an anchor a
placeholder" section is rewritten (§7): its worked example moves from a bare
`to` placeholder to `**_**`, and its prose states the new `ANCHOR` refusal
instead of describing the word-deletion as accepted behaviour.

## 7. Non-goals

- **`STALE` verification or `fmt` write-back for date- or string-valued
  scalars.** Both remain entirely unimplemented, independent of this spec —
  see §3's explicit callout. A correctly-accepted date or string placeholder
  is still never checked against the stored value or rewritten. That is
  separate, larger, unrequested work.
- **#297's display-rule mechanism** (named "filter" in earlier discussion,
  renamed "display rule" going forward — a terminology decision applying to
  new writing only, not retroactively to the shipped `%` sigil). Not built,
  not depended on, here.
- **Custom escaping syntax** (e.g. `\*\*`) for a literal `**` inside a
  delimited string value. `` `…` `` (inline code) is the answer instead — see
  §4. If escaping is ever needed for an unrelated reason, it belongs on a
  future display rule, not this spec.
- **Non-ISO date acceptance.** A bare token shaped like a non-ISO date
  (`01/15/2026`) does not qualify as a date anchor's target under this spec;
  it is unaffected by, and unrelated to, the existing `DATE` finding.

## 8. Open questions

None.

<!--vmark:no-formulas-->
