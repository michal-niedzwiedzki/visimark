# Changelog

## 0.1.0 - 2026-09-05

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
  finding, in a transcript-exact format designed to be read by both humans
  and CI.
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
  for authoring and verifying VisiMark documents.

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

[0.1.0]: https://github.com/michal-niedzwiedzki/visimark/releases/tag/v0.1.0
