# VisiMark for Joplin

Marks every value a note computes in Joplin's Markdown editor and viewer, and
flags the ones that no longer match their formula. In the editor it also lists
each finding as a lint diagnostic, in the CLI's words.

It is built from this repository and **not published** to npm or to Joplin's
plugin repository (#378). You install it from a file.

## Get the plugin

- From CI: open a recent [CI run on `master`](https://github.com/michal-niedzwiedzki/visimark/actions/workflows/ci.yml?query=branch%3Amaster),
  download the `visimark-joplin` artifact, and unzip it to get
  `com.visimark.joplin.jpl`.
- Or build it:

  ```console
  $ bun install
  $ bun run --filter joplin-plugin-visimark build
  $ ls editors/joplin/publish
  com.visimark.joplin.jpl
  ```

## Install

In Joplin desktop 3.7.1 or later: **Tools → Options → Plugins** (on macOS,
**Joplin → Settings → Plugins**), then **⚙ → Install from file**. Choose the
`.jpl` and restart Joplin.

## What it does

- A computed value has a dotted underline. A value that disagrees with its
  formula has a red wavy one. The same marks show in the editor and the viewer.
- In PDF export and print, the disagree mark stays and computed values print
  plain.
- A note with no `vmark` block renders exactly as before.
- Commands, in the command palette and under **Tools → VisiMark**:
  - **VisiMark: Check this note** opens the findings panel on the note: one
    row per finding, in the CLI's words. Click a row to move the cursor to it.
    It works in both editors, and reads the note as last saved.
  - **VisiMark: Format this note** repairs every stale value, as
    `visimark fmt` would, in one step that one undo reverts.
  - **VisiMark: Evaluate this note** lists every name and its value.
  - **VisiMark: Explain this value** shows the formula, the value and the
    inputs of the value under the cursor. It is also in the editor's context
    menu.
  - **VisiMark: Infer the formulas** works out the formulas behind a pasted
    table and shows them before adding anything. Select a table first to
    work on that table only.
  - **VisiMark: Insert … template** (invoice, monthly budget, team capacity,
    experiment log) inserts a starter note at the cursor. A note that already
    has a `vmark` block is refused.
  - **VisiMark: Show findings panel** shows or hides the panel.
  - **VisiMark: Sweep this notebook** checks every note in a notebook and the
    notebooks inside it, and lists the ones that disagree with themselves.
    It is also in a notebook's context menu. It reads notes one at a time,
    changes none, and can be cancelled.
- In the viewer, hovering a marked value shows its formula, what it comes to
  and what it reads.
- Settings, under **Tools → Options → VisiMark**:
  - **Show marks on computed values** (on by default). Off hides the marks in
    the editor and the viewer, and the viewer's tooltip with them. The editor's
    diagnostics and quick fixes stay.
  - **When formatting, rewrite dates to ISO 8601 where the date is
    unambiguous** (off by default), the same as `visimark fmt --fix-dates`.
- Each lint diagnostic offers a quick fix where one is obvious: update a stale
  value, rewrite an unambiguous date, take the suggested name, or wrap a
  column in `SUM(…)`.

## Limits

- **One note at a time.** A value that reads an imported file
  (`from rows.csv`) is not marked, checked or repaired. The commands say so
  when a note has one.
- **Commands other than Check, the panel and the sweep need the Markdown
  editor.** In the Rich Text editor they ask you to switch.
- **No `vmark` block highlighting.** Joplin gives plugins no way to add a code
  language to its editor.
- **Desktop only.**
- With Joplin's **typographer** setting on, a quoted text value is rendered
  with curly quotes and left unmarked. Numbers are unaffected.
