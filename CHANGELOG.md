# Changelog

## Unreleased

### Changed

- **A table with no `vmark` rules is now a finding, with no flag to pass.**
  `check` used to report `0 problems` on a document with nothing to disagree
  with, and `--require-formulas` was the opt-in that turned that into a
  failure — a flag you had to already know about to close a hole you would not
  think to look for. The requirement is now the default, and two things make
  that safe to turn on: it is keyed on a table being present, so prose is never
  asked for arithmetic it does not have, and it stays counted document-wide, so
  a reference table that is legitimately all-input passes as long as some other
  table in the document carries a rule.

- **`--require-formulas` is gone.** Passing it is harmless — unknown flags are
  ignored — so an existing workflow keeps working and gets the behaviour it was
  asking for. A per-run flag was always the wrong shape for a per-document
  question: it could not say "these three reference tables are fine, that
  fourth document is a quote someone forgot to formalise."

### Added

- **`<!--vmark:no-formulas-->`**: the per-document way out, in the document
  rather than in a CI flag. It travels with the content, shows up in review,
  and can be found with `grep`. Only a top-level comment counts, so a marker
  shown inside a fenced example is documentation rather than an assertion.

- **`visimark infer --write` writes that marker** when it finds nothing
  whatsoever to derive — the negative result recorded rather than printed and
  forgotten. It deliberately does not write it when it found a near-miss or an
  ambiguity: those mean the document does have arithmetic, and marking it would
  silence exactly the document that most needs a reader.

- **The marker is checked like any other claim.** A marked document that has
  since grown rules is reported, so the assertion cannot quietly outlive the
  state it was written for.

### Removed

- The advisory `no rules found — try visimark infer FILE` line under the count.
  The case it pointed at is now a finding that names the same way out, so the
  hint would only repeat it.

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
  names, a column referenced where a scalar is required, and dependency
  cycles — exiting non-zero on any finding, in a transcript-exact format
  designed to be read by both humans and CI.
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
- **`visimark check FILE... --require-formulas`**: fails a document with
  zero `vmark` rules anywhere in it, instead of the default `0 problems` —
  checked document-wide, so a legitimately all-input sheet doesn't trip it
  as long as another sheet carries a rule. When it isn't set, `check` still
  points at `infer` with `no rules found — try visimark infer FILE` whenever
  `infer` would recover a rule from the document.
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
  its message ran straight into it (`COVERAGEdocument has no ...`). A code
  that fills the field now keeps one space, matching the rule `labelField`
  already followed for labels.
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
