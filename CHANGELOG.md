# Changelog

## Unreleased

### Added
- A composite GitHub Action (`action.yml`) wrapping `visimark check`/`fmt`,
  and a `dogfood` CI workflow that runs it against this repo's own worked
  examples on every push. The README's CI section documents the plain
  `npx visimark check **/*.md` one-liner alongside it.
- `visimark check FILE... --require-formulas` — opt-in flag that fails
  (exit 1) a document with zero `vmark` rules anywhere in it, closing the gap
  the SKILL.md warning already called out: `check` reports `0 problems` on a
  document with nothing to disagree with. Checked document-wide, so a sheet
  that is legitimately all-input never trips it as long as some other sheet
  carries a rule.
- `visimark infer FILE... [--write]` — read a document that has arithmetic and
  no formulas, work out which rules reproduce the numbers already in it, and
  propose them. Verification runs the real evaluator, so anything it proposes
  `check` re-proves. The result is an acyclic set rather than a list of
  findings, and `--write` only ever inserts. A rule that fits every row but one
  is reported as a near-miss — evidence the document is already wrong.
- A third worked example, `docs/example-quote-plain.md`: a quote with no
  VisiMark in it at all, whose appendix carries the real `infer` transcript and
  is pinned by the acceptance suite.
- `check` points at `infer` instead of leaving "0 problems" to stand alone: a
  document with no rules that `infer` can recover rules from now prints
  `no rules found — try visimark infer FILE` under the count. Gated on what
  `infer` would actually report, so the hint never promises more than the tool
  can deliver, and advisory — the exit code is unchanged, and
  `--require-formulas` remains what turns the case into a failure.

### Fixed
- The `COVERAGE` code fills the eight-column code field exactly, so its message
  ran straight into it: `COVERAGEdocument has no ...`. A code that fills the
  field now keeps one space, the rule `labelField` already stated for labels.
- A document with findings but no stale values had a doubled blank line under
  its path — the separator that closes the stale block was emitted even when
  there was no stale block to close.
- `infer` proposed an anchor wherever a prose figure and a value agreed as
  numbers, so `00` in a postal code claimed a fractional `MIN` and `#unnamed1`
  claimed a `SUM` of `1`. A figure now states a value only when it is already
  written the way `fmt` would write that value back — the value at the figure's
  own decimals, carrying the column's decoration. Rounding at an anchor stays
  legal; a currency-prefixed `**$750.00**` over a `$` column anchors as it
  should; a figure written `25%` does not, because `fmt` would write `0.25`.
- `DUP` — a name bound twice in one scope is an error rather than a silent
  overwrite.
- `UNIT` — a column may carry a currency symbol or a physical unit, inferred
  from its own cells and re-applied on write-back. A column that mixes
  decorations is an error, not a sum.
- A language server and a VS Code extension: live diagnostics, formatting
  through the editor's own format-on-save, quick fixes, inlay hints showing the
  computed value without changing the file, CodeLens per `vmark` block, hover,
  and a status bar item.
