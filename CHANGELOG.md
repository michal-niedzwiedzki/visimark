# Changelog

## Unreleased

### Added
- `visimark infer FILE... [--write]` — read a document that has arithmetic and
  no formulas, work out which rules reproduce the numbers already in it, and
  propose them. Verification runs the real evaluator, so anything it proposes
  `check` re-proves. The result is an acyclic set rather than a list of
  findings, and `--write` only ever inserts. A rule that fits every row but one
  is reported as a near-miss — evidence the document is already wrong.
- `DUP` — a name bound twice in one scope is an error rather than a silent
  overwrite.
- `UNIT` — a column may carry a currency symbol or a physical unit, inferred
  from its own cells and re-applied on write-back. A column that mixes
  decorations is an error, not a sum.
- A language server and a VS Code extension: live diagnostics, formatting
  through the editor's own format-on-save, quick fixes, inlay hints showing the
  computed value without changing the file, CodeLens per `vmark` block, hover,
  and a status bar item.
