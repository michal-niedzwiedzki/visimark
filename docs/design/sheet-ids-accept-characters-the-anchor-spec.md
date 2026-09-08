# Sheet-id / anchor-comment grammar hardening — feature spec

**Status:** approved (#38) · **Date:** 2026-09-08 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/38#issuecomment-5588230949

## 1. Purpose

Three parts of the codebase disagree about what a sheet id may contain: the
fence info string (`parseSheetId`) accepts any run of non-whitespace, while
the anchor grammar (`ANCHOR_RE`) and the expression lexer both accept only
`[A-Za-z_][A-Za-z0-9_]*`. A sheet id such as `#cost-centre` is therefore legal
in the fence but unanchorable and unreferenceable — and the anchor case fails
**silently**, because a `<!--vmark=cost-centre.total-->` comment simply does
not match `ANCHOR_RE` and is treated as an ordinary, inert HTML comment.

The motivating document (issue #38, repro 1):

````markdown
| Item | Price | Qty | Net |
|------|-----:|----:|----:|
| pen  | 2.00 |  10 | 20.00 |

```vmark #cost-centre
Net = Price * Qty
total = SUM(Net)
```

Total: **999.00**<!--vmark=cost-centre.total-->
````

`total` is `20.00`; the document says `999.00`. Today `visimark check` reports
this document clean (exit 0), with only a `WARN` that misleadingly suggests
`Net` as a typo target. This is the exact failure mode the project exists to
prevent ([§1](../visimark-design.md#1-purpose)): a number that disagrees with
its formula, in a document CI calls green.

Existing vocabulary cannot reach this — it is not a missing function but a
grammar mismatch between three components that were never made to agree.

## 2. Syntax

No new surface syntax. This tightens two existing grammars that are already
part of the language:

1. **Sheet id** (fence info string, `#<id>` in ` ```vmark #<id> `): the
   accepted grammar narrows from "any run of non-whitespace" to the identifier
   grammar already used by `ANCHOR_RE` and the expression lexer:
   `[A-Za-z_][A-Za-z0-9_]*`.
2. **Anchor comment** (`<!--vmark=<sheetId>.<name>-->`): no change to what a
   *valid* anchor may contain — `ANCHOR_RE` is unchanged. What changes is which
   malformed comments are silently ignored versus reported. A comment matching
   the loose prefix `/^<!--\s*vmark\s*=/` that does **not** fully match
   `ANCHOR_RE` is now a finding instead of being treated as an ordinary HTML
   comment.

Both remain plain HTML/fence syntax with no renderer impact
(constraint 1, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)) —
this is validation tightening, not new grammar a renderer would see differently.

**Why tighten rather than loosen.** The alternative — loosening `ANCHOR_RE`
and the lexer to accept hyphens — is not viable: a hyphen in an expression is
unavoidably minus (confirmed by issue #38 repro 2, where `cost-centre.total`
lexes as `cost` `-` `centre.total`). The identifier grammar is therefore the
only grammar all three components can share.

## 3. Semantics

### 3.1 Sheet-id validation

| Input (fence info string) | Today | After this change |
|---|---|---|
| `` ```vmark #lines `` | sheet id `lines` | unchanged — valid identifier |
| `` ```vmark #cost-centre `` | sheet id `cost-centre`, silently unanchorable/unreferenceable | `SHEET` error: `sheet id \`cost-centre\` is not a valid identifier — invalid character \`-\`` |
| `` ```vmark #a/b..c `` | sheet id `a/b..c`, accepted everywhere, checks clean | `SHEET` error: `sheet id \`a/b..c\` is not a valid identifier — invalid characters \`/\`, \`.\`` |
| `` ```vmark #1abc `` | sheet id `1abc` (leading digit already invalid in `ANCHOR_RE`/lexer today, but silently unreachable) | `SHEET` error: `sheet id \`1abc\` is not a valid identifier — invalid character \`1\`` (leading digit) |
| `` ```vmark `` (no id) | document-scope block | unchanged — a block with no id is not sheet-id validated |

Invalid characters are named **uniquely, in order of first appearance** in the
raw id — `a/b..c` names `/` and `.` once each, not twice for the repeated `.`.
A leading digit is reported as an "invalid character" like any other
non-identifier character, rather than a distinct message, since the grammar is
a single regex with no separate "starts with a digit" case today.

**The sheet is still built and evaluated when its id is invalid** — this
matches the existing precedent for a detached-table `SHEET` error
([`model/build.ts`](../../packages/visimark/src/model/build.ts), "this block
declares column rules but no table immediately precedes it"): the block still
becomes a sheet, its columns and scalars still evaluate and still produce
their own findings (`STALE`, `UNDEF`, etc.), and the invalid-id `SHEET` finding
is reported *in addition*, once per offending block (not once per document,
so a bad id repeated across merged blocks is named each time it is declared).

### 3.2 Anchor-comment hardening

| Input (HTML comment) | Today | After this change |
|---|---|---|
| `<!--vmark=lines.total-->` | valid anchor | unchanged |
| `<!--vmark=cost-centre.total-->` | silently inert (no anchor, no finding) | `ANCHOR` error: `malformed anchor comment — expected `<!--vmark=sheet.name-->`` |
| `<!--vmark=lines.tot al-->` (stray space) | silently inert | `ANCHOR` error, same message |
| `<!--vmark=lines.-->` (empty name) | silently inert | `ANCHOR` error, same message |
| `<!--vmark:no-formulas-->` | the no-formulas marker | unchanged — does not match the loose `vmark\s*=` prefix (`:`, not `=`) |
| `<!-- TODO: fix this -->` | ordinary comment | unchanged — does not match the loose prefix at all |
| `<!--vmarkFoo=bar.baz-->` | ordinary comment | unchanged — `vmark` is not followed by whitespace/`=`, so the loose prefix does not match |

Detection order in `collectAnchors`: try the full `ANCHOR_RE` first (existing
valid-anchor path, unchanged); on no match, try the loose prefix
`/^<!--\s*vmark\s*=/`; a match there and no full match is the new `ANCHOR`
finding; no match on either is unchanged — an ordinary, silently-ignored HTML
comment.

The finding's span is the comment's own span. It carries no `sheetId`/`name`
— unlike every other `ANCHOR` finding today, the comment never parsed far
enough to have one — so the existing `id(f)` helper renders the empty id
field as a bare `.` (as implemented; confirmed against the real formatter):

```
  ANCHOR  .                 malformed anchor comment — expected `<!--vmark=sheet.name-->`
```

## 4. Type rules and errors

| Case | Code | Auto-fixable | Notes |
|---|---|---|---|
| Sheet id contains a character outside `[A-Za-z0-9_]`, or starts with a digit | `SHEET` (existing code) | no | Static — detected when the block is parsed, before evaluation; independent of table association. Same "no" as the existing detached-table `SHEET` error ([§10](../visimark-design.md#10-error-taxonomy)). |
| An HTML comment matches `/^<!--\s*vmark\s*=/` but not the full `ANCHOR_RE` | `ANCHOR` (existing code) | no | Static — detected during anchor collection, before evaluation. Same "no" as every other `ANCHOR` case. |

No new `FindingCode` is introduced — both cases reuse the existing `SHEET` and
`ANCHOR` codes, which already cover "structural, non-auto-fixable, detected
before evaluation" findings of this shape.

**Suppression.** Neither finding is suppressed by an upstream error — they are
themselves the root cause, detected before the dependency graph runs
([§8](../visimark-design.md#8-evaluation)). A `SHEET` finding on a bad sheet id
does not suppress the sheet's own `STALE`/`UNDEF`/etc. findings (3.1); they are
independent findings about independent things, matching the detached-table
precedent.

## 5. Interaction with the rest of the language

- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).**
  Unchanged. A sheet with an invalid id is still a sheet with that id as a
  string internally — `cost-centre.total` still fails to resolve as a
  qualified reference for the same reason it does today (the lexer cannot
  spell it), now additionally flagged at the point of declaration rather than
  only at the point of reference.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** No new write
  behaviour. `fmt` does not invent a corrected sheet id or repair a malformed
  anchor comment — both are `SHEET`/`ANCHOR`, neither auto-fixable — it
  continues to fix whatever `STALE` cells it can in the same document
  independently.
- **Anchors ([§3](../visimark-design.md#3-document-model)).** The document
  model of what a *valid* anchor is does not change. This only removes one
  silent-failure path: a comment that looks like an anchor and isn't one now
  says so.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Both findings are detected in the parse/model-build phase, before the
  dependency graph is built — same phase as the existing detached-table
  `SHEET` check and the `assert`/`chart`-outside-a-sheet `SHEET` checks in
  `model/build.ts`.
- **`explain`.** Unaffected in shape — a sheet with a bad id still lists its
  rules and evaluation order; the `SHEET` finding surfaces only via `check`
  and `eval`, consistent with how the detached-table `SHEET` finding behaves
  today.
- **`infer`.** Unaffected. `infer` proposes anchors for un-anchored prose
  figures; a figure following a malformed `vmark=` comment is not specially
  recognized as "already anchored" (the malformed comment never produces a
  `RawAnchor.value`), so `infer` may propose adding a *second* anchor comment
  next to a malformed one. This is accepted as an existing, unrelated `infer`
  behavior (it already does not attempt to detect or repair a malformed
  anchor) — not a new gap introduced by this change.
- **`--json`.** No schema change. Both findings serialize through the existing
  `Finding` shape (`code`, `message`, `span`, optionally `sheetId`); the
  `ANCHOR` case simply omits `sheetId`/`name`, which are already optional
  fields.
- **What does not change.** `ANCHOR_RE` itself; the set of valid anchor
  targets (`strong`/`emphasis`/`inlineCode`/text-trailing-number/image); the
  `<!--vmark:no-formulas-->` marker and its own regex; the lexer's identifier
  grammar; the shape system; numeric semantics and precision; units.

## 6. Acceptance

No new fixture file — the repo's convention for a targeted case like this is
an inline markdown string in the relevant test file (`test/model/build.test.ts`
for the sheet-id `SHEET` check, alongside its existing detached-table `SHEET`
cases; `test/parse/document.test.ts` for the anchor-comment `ANCHOR` hardening,
alongside its existing anchor-parsing cases), not a standalone fixture. The
combined-document case below illustrates the full-pipeline behavior and is
covered end to end in `test/eval/check.test.ts`:

````markdown
| Item | Price | Qty | Net |
|------|-----:|----:|----:|
| pen  | 2.00 |  10 | 20.00 |

```vmark #cost-centre
Net = Price * Qty
total = SUM(Net)
```

Total: **999.00**<!--vmark=cost-centre.total-->
````

Required `visimark check` output (exit 1), confirmed against the implemented
formatter:

```
  SHEET   cost-centre.      sheet id `cost-centre` is not a valid identifier — invalid character `-`

  ANCHOR  .                 malformed anchor comment — expected `<!--vmark=sheet.name-->`

  WARN    cost-centre.total  defined and never read — did you mean `Net`?

  2 problems (0 stale, 2 errors)
```

`SHEET` and `ANCHOR` render through the existing `id(f)` helper
(`${sheetId ?? ""}.${name ?? ""}`), which is why the id field reads
`cost-centre.` (name absent) and `.` (both absent) rather than a `#`-prefixed
form — this matches the pre-existing detached-table `SHEET` rendering, not a
new format.

The three existing acceptance-suite documents
([§13](../visimark-design.md#13-testing)) — `example-invoice.md`,
`example-charts.md`, `example-invoice-drift.md` — use only plain identifier
sheet ids and well-formed anchors, so none of their required transcripts
change.

Additional targeted unit coverage:
- `#a/b..c` → `SHEET` naming `/` and `.` (each once).
- `#1abc` → `SHEET` naming `1`.
- `<!--vmark=lines.tot al-->` (stray space) → `ANCHOR`, no `RawAnchor` produced.
- `<!--vmark=lines.-->` (empty name) → `ANCHOR`.
- `<!--vmark:no-formulas-->` still parses as the no-formulas marker, not
  flagged `ANCHOR`.
- An ordinary HTML comment (`<!-- TODO -->`) is still silently ignored.
- A bad sheet id repeated across two merged `` ```vmark #bad-id `` blocks
  produces two `SHEET` findings, one per block.

## 7. Non-goals

- No change to what characters a *column header* or a *scalar name* may
  contain — those already follow the identifier grammar via the lexer, and
  are out of scope here.
- No relaxation of `ANCHOR_RE` or the lexer to accept hyphens or other
  punctuation — ruled out in §2.
- No hardening of `assert`/`chart` malformed-syntax detection — both already
  produce a `TYPE` finding today when malformed (verified: `asert Net > 0` →
  `TYPE … binding has no \`=\``; a bad `chart` clause → `TYPE … a chart takes
  a column, not an expression`), because a line inside a `vmark` fence has no
  silent-inert fallback the way an arbitrary HTML comment does. The bug class
  this issue addresses does not exist there.
- No changelog / version-note requirement for the breaking change to
  non-identifier sheet ids — the project is pre-1.0.
- No migration tool or `--fix` path for either finding — both are `SHEET`/
  `ANCHOR`, already non-auto-fixable codes; a human renames the sheet id or
  corrects the comment by hand.

## 8. Open questions

None. The four questions raised in pre-review and discussion (sheet-id
grammar direction, breaking-change handling, `ANCHOR` hardening scope,
`assert`/`chart` extension) are resolved above (§2, §7); test placement is
resolved in §6 against the repo's existing `test/model/` and `test/parse/`
layout.
