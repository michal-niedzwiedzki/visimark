# Changelog

## Unreleased

### Added

- **`EOMONTH(d, months)`** — the tenth builtin, and the first primitive to come
  through the vocabulary catalogue (issue #6). A map, `(date, whole number) →
  date`, returning the last day of the month `months` calendar months from `d`;
  the day of `d` is discarded, so `EOMONTH(2026-01-31, 1)` is `2026-02-28` and
  `EOMONTH(2024-01-31, 1)` is `2024-02-29`. It exists because "net two months,
  end of month" payment terms cannot be reached by `date ± number` and a
  hand-typed due date is exactly the derived value that drifts silently after an
  edit. A `months` value with a fractional part is a `TYPE` error; a result
  outside years 1–9999 is a `DATE` error. A general `date ± n months` is
  deliberately still absent — it carries a day-clamp ambiguity `EOMONTH` sidesteps.
- **`SQRT(x)`** — the eleventh builtin, and the second primitive to come through
  the vocabulary catalogue (issue #18). A map, `number → number`, returning the
  non-negative square root of a non-negative number. It exists because a
  diagonal-brace cutting schedule computes each length as
  `SQRT(Width^2 + Height^2)` from two columns in the same table, and a
  hand-typed length is exactly the derived value that drifts silently after an
  edit. `(Width^2 + Height^2) ^ 0.5` already reaches the value; `SQRT` is the
  spelling that says what the line does, and carries the same rounding —
  `Decimal.js` `.sqrt()` is correctly-rounded decimal, so it is not in the
  binary-float class that keeps `SIN` / `LN` deferred. A negative operand is a
  `TYPE` error — no complex result, no silent `SQRT(ABS(x))`.
- [`docs/vocabulary-catalogue.md`](docs/vocabulary-catalogue.md): the register
  of every proposed mapper, operator and aggregate and the decision taken on
  each, so a request is not re-argued from scratch and a "no" carries a citable
  reason. New requests go through a GitHub issue template
  ([`.github/ISSUE_TEMPLATE/vocabulary-request.yml`](.github/ISSUE_TEMPLATE/vocabulary-request.yml))
  and are judged against the design doc's constraints, not against Excel. Seeded
  from the 2026-09-06 discussion — string concatenation, date helpers, the
  predicate aggregates, `TODAY()`, and the sorting-rule question — with nothing
  approved at the outset.

### Changed

- npm releases now carry a [provenance attestation](https://docs.npmjs.com/generating-provenance-statements):
  the publish is signed with a statement of the exact commit and workflow run
  that built the tarball, verifiable with `npm audit signatures` and shown on
  the package page. The release workflow was also reworked so that a registry
  rejecting a publish fails the release, instead of being logged as
  already-done.

### Fixed

- The `N rows not verified` note after a column rule no longer counts rows that
  raised their own error and already carry a per-row finding — only rows
  suppressed by an upstream dependency error are summarised.

## 0.1.1 - 2026-09-05

First release. VisiMark is a spreadsheet-mechanics tool for Markdown: a
`vmark` block declares formulas for the table above it, and `visimark check`
proves the numbers in the document still agree with them.

### Added

- **The engine** (`packages/visimark`): a tokenizer and Pratt parser for the
  expression grammar; a parser that locates `vmark` blocks, tables and
  anchors by byte offset; a sheet model of scopes, column rules and inputs;
  and an evaluator that builds the cross-sheet dependency graph, sorts it
  topologically, and computes in decimal arithmetic with ISO-8601 date
  support. Circular dependencies are reported with the full path through the
  cycle.
- **The checker**: `visimark check` reads a document and reports every
  disagreement — stale values, ambiguous or malformed dates, undefined
  names, a column referenced where a scalar is required, dependency cycles,
  and a table with no rules attached to it at all — exiting non-zero on any
  problem, in a transcript-exact format designed to be read by both humans
  and CI. `WARN` and `NOTE` are advice: printed, never counted, and never the
  reason a run fails, so the printed count and the exit code always agree.
- **`DUP`**: a name bound twice in the same scope is an error, not a silent
  overwrite.
- **`UNIT`**: a column may carry a currency symbol or a physical unit,
  inferred from its own cells and reapplied on write-back. A column that
  mixes decorations is an error, not a sum.
- **`visimark fmt`**: repairs stale values and only stale values, by
  splicing the original byte buffer at each value it owns. Input columns,
  prose and headings are never touched, so a one-cell change stays a
  one-cell diff. `--fix-dates` rewrites unambiguous non-ISO dates in place.
- **`visimark infer FILE... [--write]`**: reads a document that has
  arithmetic and no formulas, works out which column rules and aggregates
  reproduce the numbers already in it, and proposes them. Every proposal is
  re-verified through the real evaluator; a rule that fits every row but one
  is reported as a near-miss rather than written, since that's evidence the
  document is already wrong. `--write` only ever inserts.
- **`COVERAGE`**: a document whose tables carry no `vmark` rules fails, rather
  than reporting `0 problems` for having nothing to disagree with. It is keyed
  on a table being present, so prose is never asked for arithmetic it does not
  have, and counted document-wide, so a reference table that is legitimately
  all-input passes as long as another table in the document carries a rule.
  The way out is `visimark infer`, or `<!--vmark:no-formulas-->` for a document
  with nothing to derive — a claim in the document rather than a flag in a
  workflow, and checked like any other: a marked document that later grows
  rules is reported. `infer --write` writes the marker when it finds nothing
  whatsoever, and refuses to when it finds a near-miss or an ambiguity.
- **`visimark eval` and `visimark explain`**, plus the `check`/`fmt` CLI
  surface, backed by a finding-linked, editor-facing API in the engine.
- **A language server** (`packages/visimark-lsp`) and **VS Code extension**
  (`editors/vscode`): live diagnostics from `check`, formatting through the
  editor's own format-on-save, quick fixes (`source.fixAll.visimark`),
  inlay hints showing computed values without touching the file, a CodeLens
  per `vmark` block, hover showing the formula behind a number, and a status
  bar item.
- **A composite GitHub Action** (`action.yml`) wrapping `visimark check`/
  `fmt`, plus a `dogfood` CI workflow that runs it against this repo's own
  worked examples on every push.
- **Three worked examples** pinned by the acceptance suite:
  [`docs/example-invoice.md`](docs/example-invoice.md), a complete B2B
  invoice that computes itself; [`docs/example-invoice-drift.md`](docs/example-invoice-drift.md),
  the same invoice with an unpropagated edit that `check` catches as 26
  problems; and [`docs/example-quote-plain.md`](docs/example-quote-plain.md),
  a quote with no VisiMark in it at all, whose appendix carries the real
  `infer` transcript.
- **An agent skill** ([`skills/visimark/SKILL.md`](skills/visimark/SKILL.md))
  for authoring and verifying VisiMark documents, and a
  [CLI reference](docs/cli-reference.md) tabulating every command, option,
  exit code and finding code.

### Fixed

- The `COVERAGE` finding code fills the eight-column code field exactly, so
  its message ran straight into it (`COVERAGEa table with no ...`) and its
  second line sat one column left of its first. A code that fills the field
  now keeps one space, matching the rule `labelField` already followed for
  labels, and a continuation line is indented to the head it follows.
- A document with findings but no stale values printed a doubled blank line
  under its path — the separator that closes the stale block was emitted
  even when there was no stale block to close.
- A row label that fills the value field dropped the space before it in the
  report.
- `infer` proposed an anchor wherever a prose figure and a value agreed as
  plain numbers, so `00` in a postal code could claim a fractional `MIN`. A
  figure now anchors a value only when it is written exactly the way `fmt`
  would write that value back — at the value's own decimals, carrying the
  column's decoration.
- The installed `visimark` binary did not run when invoked directly.

## 0.1.0 — not a release

`visimark@0.1.0` on npm was published by hand from a work-in-progress tree,
before any tag existed and before the `COVERAGE` rule, the CLI reference and
the single definition of "problem". It has no matching commit, no tag and no
provenance. Use 0.1.1.

It is left on the registry rather than unpublished: the version is a true
record that the publish happened, and making the history read clean after the
fact is the kind of underived edit this project exists to catch. There is no
0.1.0 of the VS Code extension.

[0.1.1]: https://github.com/michal-niedzwiedzki/visimark/releases/tag/v0.1.1
