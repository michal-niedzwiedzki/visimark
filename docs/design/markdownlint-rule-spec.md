# A `markdownlint` custom rule wrapping `visimark check` — feature spec

**Status:** approved (#153) · **Date:** 2026-09-22 · **Decision:** [#153 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/153#issuecomment-5782250622)

## 1. Purpose

A project that already runs [`markdownlint`](https://github.com/DavidAnson/markdownlint)
or `markdownlint-cli2` has no way to see VisiMark findings in that same run.
The two tools are disconnected, and a wrong total is invisible to the linter
the team already maintains:

```console
$ cat .markdownlint-cli2.jsonc
{ "config": { "default": true } }
$ npx markdownlint-cli2 "docs/**/*.md"
docs/quote.md:1 MD041/first-line-heading ...

Summary: 1 error(s)

# visimark's findings are invisible to this run:
$ npx visimark check docs/quote.md
docs/quote.md:12  ASSERT  Total should equal 1068.00, found 948.00
1 problem (0 stale, 1 error)
$ echo $?
1
```

This spec adds a new package, `markdownlint-rule-visimark`, exposing custom
`markdownlint` rules so two lines in an existing config report VisiMark
findings alongside every other rule that project already accepted:

```console
$ cat .markdownlint-cli2.jsonc
{
  "config": {
    "extends": "markdownlint-rule-visimark/recommended",
    "default": true
  },
  "customRules": ["markdownlint-rule-visimark"]
}
$ npx markdownlint-cli2 "docs/**/*.md"
docs/quote.md:12 error visimark-assert An assert statement evaluated false [assert spent <= budget: 5 <= 1 is false]

Summary: 1 error(s)
$ echo $?
1
```

This is the second of the two distribution surfaces roadmap item 2.2 names,
and the sibling of #152 (`remark-lint-visimark`, shipped). It reaches a
different toolchain population, not a subset of the `unified` one:
`markdownlint` is not built on `unified`/mdast at all, shares no parser and no
tree, and so this is a from-scratch bridge into a different rule API rather
than a variant of the same integration.

It is a new distribution surface only. No document's meaning changes,
[§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 4
is untouched (`analyze()` stays a pure function of the source string; the rules
add no environment, clock, or ambient-config dependency), and existing
`visimark` exports are reused, not reinvented — this spec adds **no new engine
surface at all**, not even the one small export #152 needed.

This is not a reopening of the "no plugin architecture" refusal
([§2](../visimark-design.md#2-constraints-that-shaped-the-design),
`docs/tutorial.md`): that constraint is about a *document* selecting
host-supplied code — an extension point inside a VisiMark document. This is the
opposite direction, VisiMark running as a rule inside someone else's linter,
and does not touch it.

## 2. The surface

### 2.1 The package

- **Directory:** `packages/markdownlint-visimark` (new workspace member; the
  root `workspaces: ["packages/*", "editors/*"]` glob picks it up with no
  change). The directory name drops the `-rule` the way
  `packages/remark-visimark` drops the `-lint`.
- **npm name:** `markdownlint-rule-visimark` — `markdownlint`'s own documented
  naming convention for a custom rule package, which is what a consumer
  searching for one expects.
- **No runtime dependency on `markdownlint` itself.** A rule is a plain object;
  the package imports nothing from `markdownlint` at runtime, and the rule-API
  types it uses are declared structurally in `src/types.ts` so a consumer's
  `.d.ts` resolution never reaches a devDependency. `markdownlint` and
  `markdownlint-cli2` are devDependencies, used by the tests to drive a real
  lint run.
- **Default export:** an **array of rule objects, one per `FindingCode`** ([§2.3](#23-one-rule-per-finding-code)).
- **A second export, `./recommended`:** a `markdownlint` config fragment ([§2.4](#24-recommended-and-the-severity-question)).
- **Dependency on the engine.** Exactly as #152: this package is published
  externally, so `workspace:*` is not a valid specifier. `package.json`
  declares `"dependencies": { "visimark": "0.1.7" }`, exact-pinned to the
  engine release it was built against and bumped in the same release commit as
  every other version-carrying file ([§5](#5-compatibility)).
- **Engine surface used:** `analyze`, `lineOf`, `describeFinding` — all three
  already public on `packages/visimark/src/index.ts`, the last of them added by
  #152. `isProblem` and `ERROR_CODES` are **not** used; the severity question
  is answered by configuration instead ([§2.4](#24-recommended-and-the-severity-question)). **No new engine export.**

### 2.2 The integration shape, and why there is only one

`markdownlint` hands a custom rule `params.lines` (the document's lines, front
matter removed) and `params.parsers` (its own `markdown-it` or `micromark`
token stream), then expects `onError({ lineNumber, ... })` per violation.
There is no tree `visimark` understands — `markdownlint`'s parsers are
unrelated to mdast. So unlike #152, which had a deferred option (b), there is
exactly one shape available: reconstruct the source from what `markdownlint`
hands the rule and call the already-public `analyze(source)`.

> **Corrected during implementation (#164).** This section originally said the
> source is `params.lines.join("\n")` and that each rule declares
> `parser: "none"`. Both were wrong, and the prototype that produced this
> spec's numbers was wrong with them.
>
> `markdownlint` replaces **the content of every HTML comment with dots**
> before it hands a rule `params.lines`, so that its own rules do not flag
> prose nobody renders. VisiMark's prose anchors (`<!--vmark=sheet.name-->`)
> and its `<!--vmark:no-formulas-->` marker *are* HTML comments. Joining
> `params.lines` therefore produces a document in which every anchor-bound
> binding has vanished and every opt-out marker has been erased — which loses
> real errors (six of them on `docs/example-invoice-drift.md`) and reports a
> `COVERAGE` violation on a document `visimark check` passes.
>
> The fix needs no new engine surface either. The micromark token stream is
> parsed from the document *before* that blanking and carries each comment's
> original text with exact positions, and the blanking is length-preserving —
> every non-whitespace character becomes one dot — so writing each `htmlFlow`
> and `htmlText` token's text back over its own span restores that comment —
> except inside a fenced/indented code block or inline code span (VisiMark's
> own parser is blind there too, so nothing is lost) and except a CRLF
> document's multi-line comment (the length-preservation guard declines
> rather than corrupting the offset; unreached today since no VisiMark
> construct spans lines). Each rule therefore declares `parser: "micromark"`
> rather than `"none"`, and `markdownlint` parses each document once, shared
> across all eighteen rules (seventeen finding-kind rules plus
> `visimark-engine-error`, [§2.3](#23-one-rule-per-finding-code)).
> See `packages/markdownlint-visimark/src/source.ts`.

**Front matter needs no handling in this package.** Verified against
`markdownlint` v0.41.1's source and by running it: front matter is absent from
`params.lines`, and `markdownlint` itself adds `frontMatterLines.length` back
to every `lineNumber` a rule reports before emitting the result. So the rule
reports the line `lineOf()` gives for the front-matter-free source and is
correct either way. `params.frontMatterLines` is never read.

```console
# doc.md, and front.md — the same content behind five lines of YAML front matter
$ npx markdownlint-cli2 "doc.md" "front.md"
doc.md:3 error visimark-stale ... [lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)]
front.md:8 error visimark-stale ... [lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)]
```

### 2.3 One rule per finding code

The default export is an array of **eighteen** rule objects: seventeen, one
for each member of `FindingCode` (`packages/visimark/src/model/types.ts`), plus
`visimark-engine-error` — not built from `FindingCode` at all, since it
reports when the engine itself fails to analyse a document rather than a
finding about that document's content (issue #173). The seventeen
finding-kind rules share this shape:

| Field | Value |
|---|---|
| `names` | `` [`visimark-${code.toLowerCase()}`] `` — `visimark-stale`, `visimark-assert`, `visimark-coverage`, … |
| `description` | the code's **Meaning** cell from [§10](../visimark-design.md#10-error-taxonomy), verbatim, sentence-cased and with its cross-reference links stripped ([§2.5](#25-rule-descriptions)) |
| `tags` | `["visimark"]`, plus `"visimark-advisory"` for `WARN` and `NOTE` |
| `parser` | `"micromark"` — see the correction in [§2.2](#22-the-integration-shape-and-why-there-is-only-one); `"none"` cannot see inside an HTML comment |
| `information` | `new URL("https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy")` — a `URL` **instance**, not a string; `markdownlint` v0.41.1 throws on a string here, confirmed by running it |
| `function` | emits this code's findings ([§3](#3-the-machine-contract)) |

Per-code ids rather than one `visimark` rule, for three reasons:

1. They are the **same identifiers #152 already ships** as `remark`'s
   `ruleId` — `visimark-assert` means the same thing in both packages, so the
   two integrations read as one product rather than two.
2. `markdownlint`'s entire configuration model is per-rule. A consumer turns
   one finding kind off exactly the way they turn `MD013` off.
3. `tags` give the coarse switches for free, with no option to invent: every
   rule carries `visimark`, and the two advisory rules carry
   `visimark-advisory`.

All four levers, confirmed by running `markdownlint-cli2` v0.23.3:

| `config` entry | Effect |
|---|---|
| `"default": true` | custom rules are on; nothing extra needed to enable them |
| `"visimark-warn": false` | one finding code off |
| `"visimark-advisory": false` | `WARN` and `NOTE` off |
| `"visimark": false` | every VisiMark rule off |

**The re-parse is paid once per document, not eighteen times.** The module
holds a one-entry cache keyed by the source string; the first rule to run for a
file fills it and the other seventeen hit it — including `visimark-engine-error`,
whose own report depends on that same cache having recorded a failure
(issue #173). `markdownlint` runs a file's rules consecutively within one
synchronous pass (every rule here is synchronous — no `asynchronous: true`),
so no two files can interleave through the cache even when `markdownlint-cli2`
lints files concurrently. Confirmed by instrumenting `analyze()` during a real
run: **one call per file, eighteen rules.**

### 2.4 `recommended`, and the severity question

`markdownlint` has no fatal/non-fatal split: every `onError` call is a
violation and every violation fails the run. `remark`'s host does have one,
which is why #152 could report `WARN`/`NOTE` as non-fatal messages that only
`remark --frail` escalates. That option does not exist here.

Reporting everything by default would mean a document `visimark check` passes
with exit 0 fails `markdownlint-cli2` with exit 1 — `docs/example-invoice.md`
is exactly such a document, clean under `check` and carrying five `WARN`
findings. Suppressing `WARN`/`NOTE` unconditionally would make them
unreachable through this host at any setting.

**The decision:** all eighteen rules are registered, and the package publishes
a config fragment that switches the advisory tag off. `visimark-engine-error`
is never advisory (issue #173) — an engine failure is a hard failure, not a
downgradable finding kind, so `recommended` never turns it off.

`packages/markdownlint-visimark/recommended.json`:

```json
{ "visimark-advisory": false }
```

exported as `"./recommended"`, consumed through `markdownlint`'s own `extends`:

```jsonc
{
  "config": {
    "extends": "markdownlint-rule-visimark/recommended",
    "default": true
  },
  "customRules": ["markdownlint-rule-visimark"]
}
```

`extends` belongs **inside** `config`, not at the top level of
`.markdownlint-cli2.jsonc` — it is a `markdownlint` config property, not a
`markdownlint-cli2` one. This is the single easiest thing for a consumer to get
wrong, so `docs/ci.md` and the package README both show the nesting rather than
describing it.

A consumer who extends `recommended` gets a run that agrees with `check`'s exit
code. A consumer who does not gets every finding and can still flip
`"visimark-advisory"` by hand. Nothing bespoke is invented: `extends`, `tags`
and per-rule config are all `markdownlint`'s own mechanisms.

### 2.5 Rule descriptions

`markdownlint` prints `description` before the per-violation `detail`, so the
description is the fixed "what this rule is" half and `detail` carries the
specifics. The descriptions are [§10](../visimark-design.md#10-error-taxonomy)'s
**Meaning** column, sentence-cased — the taxonomy is the documentation, so this
package does not author a second copy of it that could drift:

| Rule name | `description` |
|---|---|
| `visimark-stale` | Stored value or artifact disagrees with its formula |
| `visimark-date` | Not an ISO 8601 calendar date |
| `visimark-unit` | A column mixes unit decorations, a value is decorated on both sides, or a `%` display sigil shares a span with a unit |
| `visimark-undef` | Unresolvable name |
| `visimark-dup` | A name is bound twice in one scope, or two header cells sharing text |
| `visimark-vector` | Foreign column outside an aggregate |
| `visimark-cycle` | Circular dependency |
| `visimark-type` | Illegal operand types, a malformed call, or a `%` display sigil on a non-numeric scalar or a chart/image |
| `visimark-sheet` | Column rules with no table, or an `assert` in a document-scope block |
| `visimark-anchor` | Anchor with no rewritable target |
| `visimark-precision` | A numeric binding with no declared width and none derivable, a value too large to carry the width it has, or a `%` display sigil on a binding whose width is below 2 |
| `visimark-assert` | An `assert` statement evaluated false |
| `visimark-artifact` | A declared artifact cannot be built or written |
| `visimark-import` | A declared local import cannot be resolved |
| `visimark-warn` | Scalar defined and never read, or an alias declared and never used |
| `visimark-note` | Finding suppressed by an upstream error |
| `visimark-coverage` | A table with no `vmark` rules, or a `no-formulas` marker on a document that has them |

`COVERAGE` has no [§10](../visimark-design.md#10-error-taxonomy) row today; its
description above is taken from the two messages `emitCoverage`
(`packages/visimark/src/eval/check.ts`) actually emits. Adding the missing
`COVERAGE` row to the taxonomy table is part of this spec's documentation task
([§7](#7-documentation-to-update)) — the gap is pre-existing, and this package is what surfaced it.

## 3. The machine contract

Not a CLI change — `visimark`'s own exit codes and `--json` shape are
untouched; this is a new package exposing `markdownlint` rule objects, consumed
by `markdownlint`/`markdownlint-cli2`'s own machinery. No new flag on the
existing binary. Exit codes in the sessions below are `markdownlint-cli2`'s own
(`0` clean, `1` violations), not `visimark`'s.

Per finding, the rule for `finding.code` calls:

| Outcome | `onError` called? | `lineNumber` | `detail` | `range` | `fixInfo` |
|---|---|---|---|---|---|
| Finding has a `span` | yes | `lineOf(source, finding.span.start)` (1-based; `markdownlint` adds any front-matter offset itself) | `describeFinding(finding)` | omitted | omitted |
| Finding has no `span` and is not the anchor-group rollup — e.g. the document-scope `COVERAGE`, or `NOTE` | yes | `1` — `markdownlint` requires a line, and line 1 is its only way to say "the file" | `describeFinding(finding)` | omitted | omitted |
| The collapsed anchor-group `STALE` (`finding.anchorGroup`, "N prose anchors bound to the values above") | **no** | — | — | — | — |
| Document has zero findings | no calls | — | — | — | — |

Three deliberate omissions, each closed for this version rather than left open:

- **`range`.** `markdownlint` accepts an optional `[column, length]` highlight.
  Deriving it from `Finding.span` needs offset-to-column arithmetic no engine
  export provides today, and #152 made the same call for `remark`'s `Position`.
  Line-only keeps the two integrations at the same maturity for their first
  release. `range` is optional in `onError` and its absence degrades nothing —
  `markdownlint` simply reports the line, which is what most of its own
  built-in rules do.
- **`fixInfo`.** [§8](#8-non-goals).
- **`context`.** `markdownlint`'s optional "surrounding text" field. Every
  `describeFinding` string already names the sheet, binding and row label, so a
  `context` would repeat what `detail` says.

The anchor-group rollup is skipped because it is a *summary* of stale prose
anchors derived from cells whose own `STALE` findings do have spans and are
reported. Reporting the summary at line 1 as well would double-count. The
visible consequence is stated with numbers in [§5](#5-compatibility).

## 4. Behaviour table

Every session below was produced by running a working prototype of this rule
under `markdownlint-cli2` v0.23.3 / `markdownlint` v0.41.1 against the named
document, with `"extends": "markdownlint-rule-visimark/recommended"` in force
unless the row says otherwise. Output is trimmed to the `visimark-*` lines.
These double as acceptance.

| Case | Document | Output | Exit |
|---|---|---|---|
| Clean document, no findings | `docs/example-invoice.md` (five `WARN`s, no problems) | `Summary: 0 issues in 0 files` | `0` |
| Same document, **without** `recommended` | `docs/example-invoice.md` | five `visimark-warn` violations at lines 28, 29, 48, 57, 58 | `1` |
| A stale cell | `docs/example-invoice-drift.md` | `drift.md:22 error visimark-stale ... [lines.Net (On-call support): stored 3120.00 ≠ computed 5200.00 (Qty * Rate)]` | `1` |
| A failing `assert` | a `vmark` block with `spent = 5`, `budget = 1`, `assert spent <= budget` | `assert.md:5 error visimark-assert ... [assert spent <= budget: 5 <= 1 is false]` | `1` |
| Ambiguous date | `docs/example-invoice-drift.md` | `drift.md:44 error visimark-date ... ["11/12/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-12-11 or 2026-11-12, 29 days apart]` | `1` |
| Cycle | `docs/example-invoice-drift.md` | `drift.md:74 error visimark-cycle ... [late_fees.base → late_fees.fee → late_fees.total → late_fees.base]` | `1` |
| **Document-scope `COVERAGE`, no span** | a heading and a table, no `vmark` block | `roadmap.md:1 error visimark-coverage ... [a table with no \`vmark\` rules — nothing in this document is checked]` | `1` |
| Front matter present | `docs/example-invoice-drift.md`-style content behind a YAML block | every line number shifted by the block's length plus the blank line that terminates it, by `markdownlint`, not by this package | `1` |
| Anchor-group rollup | any document whose stale cell has ≥2 prose anchors (`docs/example-invoice-drift.md`, `suppressedCount: 8`) | no violation for the rollup; the underlying cells' own `STALE` violations still report | `1` |
| One code disabled | `docs/example-invoice-drift.md`, `"visimark-date": false` | the two `visimark-date` violations disappear; the rest stand | `1` |
| All VisiMark rules off | any document, `"visimark": false` | no `visimark-*` violations; other rules unaffected | per other rules |
| Seventeen rules, one parse | any document | `analyze()` called **once**; verified by instrumentation | — |
| **A `no-formulas` marker** | a table under `<!--vmark:no-formulas-->` | no violation — the marker survives `markdownlint`'s comment blanking ([§2.2](#22-the-integration-shape-and-why-there-is-only-one)) | `0` |
| **An anchor-bound scalar** | `docs/example-invoice-drift.md`'s `lines.net_total` | `drift.md:34 error visimark-stale ... [lines.net_total: stored 23300.00 ≠ computed 25380.00 (SUM(Net))]` | `1` |

The full `docs/example-invoice-drift.md` run under `recommended` is **eighteen**
violations — thirteen `STALE`, two `DATE`, and one each of `UNDEF`, `CYCLE` and
`VECTOR`. The twelve first recorded here were the prototype's, taken before the
comment-blanking correction in [§2.2](#22-the-integration-shape-and-why-there-is-only-one); the six it was missing are the scalar
totals on lines 34, 35, 36, 53, 64 and 65, each bound through a prose anchor.
The twelve below are the subset that never depended on an anchor:

```console
$ npx markdownlint-cli2 "docs/example-invoice-drift.md"
...:19 error visimark-stale ... [lines.Gross (Discovery workshop): stored 4428.50 ≠ computed 4428.00 (Net + VAT)]
...:22 error visimark-stale ... [lines.Net (On-call support): stored 3120.00 ≠ computed 5200.00 (Qty * Rate)]
...:22 error visimark-stale ... [lines.VAT (On-call support): stored 717.60 ≠ computed 1196.00 (Net * vat)]
...:22 error visimark-stale ... [lines.Gross (On-call support): stored 3837.60 ≠ computed 6396.00 (Net + VAT)]
...:42 error visimark-stale ... [schedule.Amount (Signature): stored 8597.70 ≠ computed 9365.22 (Share * lines.gross_total)]
...:43 error visimark-date  ... ["15.10.2026" is not an ISO 8601 date (YYYY-MM-DD); unambiguous fix is 2026-10-15]
...:43 error visimark-stale ... [schedule.Amount (Delivery of backend): stored 11463.60 ≠ computed 12486.96 (Share * lines.gross_total)]
...:44 error visimark-date  ... ["11/12/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-12-11 or 2026-11-12, 29 days apart]
...:44 error visimark-stale ... [schedule.Amount (Acceptance): stored 8597.70 ≠ computed 9365.22 (Share * lines.gross_total)]
...:60 error visimark-undef ... [unknown name `fx_rate`; did you mean `fx_eur`?]
...:74 error visimark-cycle ... [late_fees.base → late_fees.fee → late_fees.total → late_fees.base]
...:83 error visimark-vector... [`schedule.Amount` is a column, not a value — wrap it in an aggregate]

Summary: 18 issues in 1 file   # the six anchor-bound totals are not shown above
$ echo $?
1
```

## 5. Compatibility

- **No existing CI job, script, or the composite Action changes behaviour.**
  `action.yml`, `.github/workflows/ci.yml` (beyond the version-carrying-file
  addition below), `.github/workflows/dogfood.yml` and
  `.github/workflows/release.yml` (beyond the new publish leg below) are
  otherwise unmodified. Additive and opt-in: a project not depending on
  `markdownlint-rule-visimark` sees no change at all.
- **`ci.yml`'s "every version-carrying file must agree" step** tracks seven
  files today: `packages/visimark/package.json` (the reference the others are
  compared against), `packages/visimark-lsp/package.json`,
  `editors/vscode/package.json`, `action.yml`'s pinned default,
  `scripts/precommit-visimark-check.sh`'s pins, and — per #152 —
  `packages/remark-visimark/package.json` twice over, its own `version` and its
  `dependencies.visimark` pin.
  `packages/markdownlint-visimark/package.json`'s `"version"` and its
  `"visimark"` dependency pin join as an **eighth** and **ninth**. This is #152's
  answer applied unchanged, which is what #153 asked for: one answer for both
  new packages, not two.
- **`release.yml` gains a new publish leg**, `Publish the markdownlint rule to
  npm`, mirroring `Publish the remark plugin to npm` exactly — same
  `working-directory` pattern, same "ask the registry whether this exact
  version is already there, publish or skip" idempotency, same `--provenance
  --access public`, same independent `continue-on-error: true` gating, and the
  same existing `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. It also joins the
  release gate's leg-outcome loop and its registry-presence retry, beside the
  `remark` plugin's entry.
- **`docs/releasing.md`'s "Bump the version" step** gains
  `packages/markdownlint-visimark/package.json` (both its own `version` and its
  `visimark` dependency pin) as the eighth/ninth entry in its file list.
- **The reported count differs from `check`'s footer, by design.**
  `visimark check docs/example-invoice-drift.md` prints `27 problems (22 stale,
  5 errors)`; the same document under `recommended` is `19 issues`. The
  difference is exactly the eight prose anchors folded into the skipped
  anchor-group rollup ([§3](#3-the-machine-contract)). `WARN` and `NOTE` are advice: `check` does not count
  them in that footer either, so the advisory tag changes which findings are
  *reported*, not this arithmetic. **The exit code agrees in every case**, which is the property a
  CI gate depends on; only the headline number differs, and `docs/ci.md` says
  so rather than leaving a reader to discover it.
- Fully reversible: deleting the package and its `release.yml` leg is undone by
  a normal commit. An already-published npm version is not unpublished (npm's
  own policy, unrelated to this project), the same as every other npm leg.

## 6. Interaction with the rest of the tooling

- **`--json`, `fmt`, `infer`, `explain`, `eval`, `ref`** are untouched. The
  rules only ever call `analyze()`, which runs `locate` + `build` + `check` —
  the same three phases `check`'s CLI command runs, and nothing else.
- **`remark-lint-visimark` (#152)** shares no code with this package. Both
  depend on the same public `analyze()`, `lineOf()` and `describeFinding()`;
  neither imports the other, and neither is a reason to make one depend on the
  other. They deliberately share *identifiers* — `visimark-assert` names the
  same finding kind in both — and this spec's per-code rule names exist to keep
  that true.
- **The pre-commit hook (#149) and the composite Action** are unaffected and
  share no code path beyond the same public engine entry point.
- **The LSP and the VS Code extension** are unaffected; no diagnostic changes,
  so no `editors/vscode/CHANGELOG.md` entry is owed.
- **The review workflow itself** — `docs/issue-runbook.md`,
  `.agents/commands/` — is unaffected.
- **No new engine export.** Unlike #152, which added `describeFinding`, this
  package needs nothing the engine does not already expose.

Nothing about what a VisiMark *document* means changes. No new finding code, no
new syntax, no widened taxonomy entry — the one taxonomy edit in [§7](#7-documentation-to-update) fills a
pre-existing gap (`COVERAGE` has always been emitted and has never had a row),
it does not add behaviour.

## 7. Documentation to update

- **`docs/ci.md`** — a new chapter 25, after chapter 24 ("The `remark`/`unified`
  plugin") and before the current chapter 25, documenting: the
  `.markdownlint-cli2.jsonc` entry with `extends` **nested inside `config`**,
  the per-code rule names, the three config levers
  (`visimark-<code>`, `visimark-advisory`, `visimark`), what `recommended`
  does and why, and the count-vs-`check` note from [§5](#5-compatibility). It lands **inside
  Part 6**, immediately before the `# Part 7 — Rolling it out` divider, which
  does not move; the existing chapters 25–27 renumber to 26–28. Confirmed
  against the working tree: the only cross-reference to a `ci.md` chapter
  number is `README.md`'s link to chapter 24, which is unaffected
  (`docs/tutorial.md`'s "chapter 24/26/27" mentions are that document's own,
  independent numbering).
- **`docs/visimark-design.md` [§10](../visimark-design.md#10-error-taxonomy)** —
  add the missing `COVERAGE` row (meaning, and `Auto-fixable: no`), per [§2.5](#25-rule-descriptions).
- **`docs/releasing.md`** — "Bump the version" step's file list gains
  `packages/markdownlint-visimark/package.json` ([§5](#5-compatibility)).
- **`.github/workflows/ci.yml`** — the version-agreement step's comment and
  extraction logic gain the eighth/ninth value ([§5](#5-compatibility)).
- **`.github/workflows/release.yml`** — the new publish leg, its entry in the
  gate's leg-outcome loop, and its registry-presence retry ([§5](#5-compatibility)).
- **`CHANGELOG.md`** — an `## Unreleased` → `### Added` entry.
- **`README.md`** — the "In CI" section gains one sentence pointing at the new
  `docs/ci.md` chapter, the same weight the composite Action and the `remark`
  plugin get there today.
- **`packages/markdownlint-visimark/README.md`** — the package's own npm page:
  install, the config entry, the rule names, the config levers, and the
  no-options / no-autofix / line-only contract.
- **`docs/cli-reference.md`** — unaffected; this package exposes no CLI surface
  of its own (no `bin` entry).
- **`docs/vocabulary-catalogue.md`** — the section F row moves into the Shipped
  register as `UNRELEASED`.

## 8. Non-goals

- **No autofix (`fixInfo`).** Closed for this version, not merely set aside —
  the same call #152 made. `fmt`'s write-back is deliberately explicit
  ([§9](../visimark-design.md#9-write-back)), and `markdownlint-cli2 --fix`
  applies every rule's `fixInfo` automatically as part of a run. Wiring `fmt`
  into that path is its own decision, worth taking once report-only has shipped
  in both packages and it is clear whether consumers want it.
- **No `range` (column highlight) and no `context`.** [§3](#3-the-machine-contract).
- **No rule-options.** No rule reads `params.config` beyond `markdownlint`'s own
  enable/disable handling. Severity and selection are configuration, through
  `markdownlint`'s existing per-rule and per-tag mechanisms ([§2.4](#24-recommended-and-the-severity-question)); there is
  nothing package-specific to configure.
- **No engine entry point accepting a pre-parsed tree.** `markdownlint` has
  none to offer ([§2.2](#22-the-integration-shape-and-why-there-is-only-one)); the question does not arise here the way it did in #152.
- **No shared package between this and `remark-lint-visimark`.** [§6](#6-interaction-with-the-rest-of-the-tooling).
- **No `visimark` CLI, exit-code or `--json` change.**

## 9. Open questions

None.
