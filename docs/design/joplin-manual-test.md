# Joplin: a manual test scenario

**What this tests.** The CI-built `.jpl` (#378) in a running Joplin. CI checks
the bundle, the archive and the content scripts against fakes. It cannot see a
screen, so these rows can't be automated.

**Record what you observe, not what you expect.** Each row states what the
spec requires. Record what Joplin actually did under *Recording*.

## Setup

1. Joplin desktop 3.7.16 or later.
2. Download the `visimark-joplin` artifact from the PR's CI run, or build it
   with `bun run --filter joplin-plugin-visimark build`.
3. **Tools → Options → Plugins** (on macOS, **Joplin → Settings → Plugins**),
   **⚙ → Install from file**, choose `com.visimark.joplin.jpl`, and restart
   Joplin.
4. Open **Help → Toggle development tools** and keep the console visible.

## Rows

| # | Do this | Required |
|---|---|---|
| M1 | Install, restart, open any note | The plugin is listed as enabled; no error in the console |
| M2 | New note; paste the body of `docs/example-invoice-drift.md` | In the editor and the viewer, every value `visimark check docs/example-invoice-drift.md` reports `STALE` has the wavy mark; the editor shows lint diagnostics |
| M3 | New note; paste the body of `docs/example-invoice.md` | Dotted marks only, no wavy mark, no diagnostics |
| M4 | A note with no `vmark` block: **File → Export → HTML** with the plugin enabled, then disabled | The two exported note bodies are identical |
| M5 | M2's note in a light and a dark theme | Both marks visible in both |
| M6 | M2's note, **File → Export → PDF** | Wavy marks visible; dotted marks absent |
| M7 | **Options → Markdown → Enable typographer support** on; reopen M2's note | Numeric marks unchanged |
| M8 | M2's note in the Rich Text editor: one unrelated edit, save, back to Markdown, diff against the original | **Recorded, not required.** Did any `<!--vmark=…-->` anchor or `vmark` block change? |
| M9 | In development tools, inspect the viewer's `vmark` block for `#lines` | **Recorded, not required.** Is `data-vmark-info="#lines"` present? |
| M10 | If this Joplin still offers the legacy editor, switch to it and open M2's note | No error; no marks |

M1–M7 and M10 must pass before the implementation PR is merged.

## #384, group 1: commands and repair

Spec: `docs/design/chore-bring-joplin-plugin-visimark-to-spec.md` §4.2. Use a
note with the body of `docs/example-invoice-drift.md`.

| # | Do this | Required |
|---|---|---|
| M-A1 | Confirm in Joplin v3.7.1's source that `joplin.commands`, `joplin.views.menus`, `joplin.views.menuItems`, `joplin.views.dialogs`, `joplin.settings.globalValue`, `CodeMirrorControl.registerCommand` and the `editor.execCommand` command exist | Recorded |
| M-1.1 | Open the command palette; open **Tools → VisiMark** | Both list Check this note, Format this note, Evaluate this note, Explain this value, in that order |
| M-1.2 | **Format this note** | "Applied 15 repairs."; one Ctrl+Z restores the drifted note exactly; copied out, the note is byte-identical to `visimark fmt`'s output, and `visimark check` on it reports `5 problems (0 stale, 5 errors)` and exits 1 |
| M-1.3 | The quick fix on the On-call support `Net` cell | That cell becomes `5200.00`; nothing else changes |
| M-1.4 | **Check this note** | The dialog text matches `visimark check`'s output (the `27 problems` summary) |
| M-1.5 | **Explain this value** with the cursor on a stale `Net` cell, then on prose | Formula, value and inputs; then "Put the cursor on a value VisiMark works out, and ask again." |
| M-1.6 | A note with no block, every command | "This note has no VisiMark block, so there is nothing to check in it yet."; nothing changes |
| M-1.7 | The Rich Text editor, every command | "VisiMark commands work in the Markdown editor. Switch to it and try again."; the note is unchanged |

## #384, group 2: authoring

| # | Do this | Required |
|---|---|---|
| M-2.1 | Paste a plain table with a computed column, select it, **Infer the formulas** | The preview dialog; **Apply** writes one block, and one Ctrl+Z removes it |
| M-2.2 | Each template in an empty note, then again in the same note | Inserted; then "This note already has a VisiMark block. Insert the template into a new note instead." |

## #384, group 3: settings and the tooltip

| # | Do this | Required |
|---|---|---|
| M-3.1 | **Tools → Options → VisiMark** | "Show marks on computed values", on; "When formatting, rewrite dates to ISO 8601 where the date is unambiguous", off |
| M-3.2 | Turn **Show marks on computed values** off, with the drift note open | The marks leave the editor at once and the viewer on its next render; the editor's diagnostics remain |
| M-3.3 | With the setting back on, hover a marked value in the viewer | The tooltip starts with the binding line, then "comes to" and "reads" |

## Recording

| Row | Joplin version | Date | Observed |
|---|---|---|---|
| M-1.1–M-1.7 | 3.7.21 (AppImage) | 2026-10-14 | All passed, reported by the maintainer |

<!--vmark:no-formulas-->
