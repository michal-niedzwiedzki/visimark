# Changelog

## Unreleased

- Writing `Σ`/`∑` no longer shows as a parse-error diagnostic; it's treated
  as `SUM`.
- A sheet id that is not a valid identifier now shows as a `SHEET` diagnostic
  on its block, and an anchor comment beginning `vmark=` that fails to parse
  now shows as an `ANCHOR` diagnostic on the comment, instead of both being
  silently ignored.
- `assert` statements are now supported: a false `assert` shows as an `ASSERT`
  diagnostic on that line, like any other `visimark check` finding.
- `chart` declarations are now supported: a chart that cannot be built or
  written shows as an `ARTIFACT` diagnostic on that line, and a stale or
  missing artifact as `STALE`.
- The engine now recognises `EOMONTH(d, months)` (end-of-month date
  arithmetic), so a formula that uses it no longer shows an "unknown function"
  diagnostic.
- The engine now recognises `SQRT(x)` (square root), so a formula that uses it
  no longer shows an "unknown function" diagnostic.
- The engine now recognises `FLOOR(number, significance)` (round down to a
  multiple), so a formula that uses it no longer shows an "unknown function"
  diagnostic.
- The engine now recognises `CEILING(number, significance)` (round up to a
  multiple), so a formula that uses it no longer shows an "unknown function"
  diagnostic.
- Requires VS Code 1.91.0 or newer (was 1.85.0), the floor of
  `vscode-languageclient` 10.

## 0.1.1 - 2026-09-05

First release, versioned in lockstep with the `visimark` engine.

One language server wraps the engine and drives:

- **Diagnostics** — every `visimark check` finding, live as you type.
- **Format on save** — stale computed values and anchors brought up to date
  through the editor's own formatter. Turn off `visimark.format.fixOnSave`
  (on by default) for repair-on-demand only; `visimark.format.fixDates` also
  rewrites unambiguous non-ISO dates.
- **Quick fixes**, including `source.fixAll.visimark`.
- **Inlay hints** — the computed value shown beside a stale one, without
  changing the file.
- **CodeLens** on each `vmark` block, **hover** showing the formula behind a
  number, and a **status bar** item for the active document.
