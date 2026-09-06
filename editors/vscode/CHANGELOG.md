# Changelog

## Unreleased

- The engine now recognises `EOMONTH(d, months)` (end-of-month date
  arithmetic), so a formula that uses it no longer shows an "unknown function"
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
