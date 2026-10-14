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

## Recording

| Row | Joplin version | Date | Observed |
|---|---|---|---|
| | | | |

<!--vmark:no-formulas-->
