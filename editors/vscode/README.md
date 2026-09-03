# VisiMark for VS Code

Spreadsheet mechanics for Markdown. Every computed number in your document
carries the formula that produced it, and VisiMark proves the two still agree.

- **Live checking.** Stale values, ambiguous dates, mixed units and unknown
  names are squiggled as you type. Nothing is written.
- **Inline truth.** A stale value shows what it *should* be, right beside it,
  without the file changing.
- **Repair on demand.** "Format Document" — or your own `editor.formatOnSave`
  — rewrites computed cells and anchored values, and nothing else.
- **Repair on save, if you ask.** Turn on `visimark.format.fixOnSave` and every
  stale value is brought up to date as the file is written. Off by default, and
  never triggered by autosave.
- **Quick fixes.** Update one cell, rewrite one unambiguous date, or fix the
  whole document.

A VisiMark document is ordinary Markdown. It renders correctly on GitHub, in
VS Code preview, and through pandoc, with no plugin.
