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

## Limits

- **One note at a time.** A value that reads an imported file
  (`from rows.csv`) is not marked.
- **No `vmark` block highlighting.** Joplin gives plugins no way to add a code
  language to its editor.
- **Desktop only**, and no settings.
- With Joplin's **typographer** setting on, a quoted text value is rendered
  with curly quotes and left unmarked. Numbers are unaffected.
