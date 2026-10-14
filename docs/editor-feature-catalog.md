# Editor feature catalog

What each editor integration does today, read from the source on `master`. It is a
map for deciding what to build next, not a user guide; the per-editor READMEs
are that.

Editors covered:

| Editor | Package | Engine access | Status |
|---|---|---|---|
| VS Code | `editors/vscode` | Language server (`visimark-lsp`) over IPC, plus an in-process engine for reports | Private workspace package, published as a VSIX |
| Obsidian | `editors/obsidian` | Engine bundled into `main.js`, no server | Released as GitHub Releases; BRAT or manual install |
| Joplin | `editors/joplin` | Engine in the editor's content script, over `codemirror-visimark`; `markdown-it-visimark` in the viewer | Build-only, side-loaded |
| Any CodeMirror 6 host | `codemirror-visimark` | Engine bundled into the package | Published; also drives the playground |
| Any markdown-it host | `markdown-it-visimark` | Engine bundled into the package | Published |

## 1. Feature matrix

`●` built, `○` not built, `—` does not apply to that editor.

### Reading and marking

| Feature | VS Code | Obsidian | Joplin |
|---|---|---|---|
| Mark computed values in the rendered view | ● built-in Markdown preview | ● reading mode | ● viewer |
| Mark computed values while editing | ○ | ● Live Preview, with a setting to turn it off | ● CodeMirror 6 editor only |
| Stale value shown differently from a fresh one | ● preview | ● | ● red wavy underline |
| Print and PDF treatment | ○ | ○ | ● disagree mark stays, computed values print plain |
| Hover or tap a value for its formula | ● hover | ● hover, tap and keyboard | ● viewer tooltip |
| Hover on a function name for its signature | ● | ○ | ○ |
| Syntax highlighting inside `vmark` blocks | ○ | ○ | ○ Joplin gives plugins no way in |
| Imports (`from rows.csv`) resolved | ● from disk next to the file | ● through the vault | ○ one note only |

### Diagnostics and repair

| Feature | VS Code | Obsidian | Joplin |
|---|---|---|---|
| Findings listed as diagnostics in the editor | ● Problems panel and squiggles | ○ | ● lint diagnostics |
| Findings pane in the product's own words | ○ | ● findings view, no finding codes in the text | ○ |
| Per-finding repair | ● quick fix | ● button on each row | ● quick fix on each lint diagnostic |
| Fix every stale value in the note | ● command and source action | ● Format command | ● Format command, one undo |
| Fix on save | ● on by default, never on autosave | ● off by default, Ctrl/Cmd+S only | ○ |
| Rewrite decidable non-ISO dates | ● setting | ● setting | ● setting, and a quick fix |
| Format a selection only | ● range formatting | ○ | ○ |
| Regenerate chart SVGs | ○ not in the extension's own code | ● setting, off by default | ○ |

### Commands and views

| Feature | VS Code | Obsidian | Joplin |
|---|---|---|---|
| Check | ● Show Report | ● Check this note | ● Check this note, the CLI's output |
| Format / fix | ● Fix All Stale Values; Fix Sheet (the lens target, but it fixes the whole document) | ● Format this note | ● Format this note |
| Evaluate (every name and its value) | ○ | ● dialog, with copy as JSON | ● dialog |
| Explain one value or sheet | ● Explain Sheet, whole sheet | ● Explain this value, one value | ● Explain this value, also in the editor's context menu |
| Infer formulas from a pasted table | ○ | ● with a preview | ● with a preview, scoped to the selection |
| Insert a starter template | ○ | ● invoice, monthly budget, team capacity, experiment log | ● the same four, refused when the note has a block |
| Vault or workspace sweep | ○ | ● pane, cancellable, optional on open | ○ |
| Restart the engine | ● Restart Server | — no server | — |

### Ambient status and entry points

| Feature | VS Code | Obsidian | Joplin |
|---|---|---|---|
| Status bar item with stale and error counts | ● click opens the report | ● click opens the findings view; desktop only | ○ |
| Ribbon icon | — | ● opens the sweep | — |
| Command palette entries | ● 5 | ● 5 plus 4 templates plus sweep | ● 5 plus 4 templates, also under Tools → VisiMark |
| Settings | ● 10 | ● 5 | ● 2: show marks, fix dates on Format |
| Public API for other plugins or extensions | ○ | ● `plugins.plugins["visimark"].api`: check, evaluate, get, explain | ○ |

### Platform

| | VS Code | Obsidian | Joplin |
|---|---|---|---|
| Desktop | ● | ● | ● 3.7.1 and up |
| Mobile | — | ● `isDesktopOnly` is false; no `node:` builtins in the bundle | ○ desktop only |
| Minimum host version | VS Code 1.91 | Obsidian 1.8.7 | Joplin 3.7.1 |

## 2. Editor-specific features

Features that exist because the host offers a mechanism no other editor has.

### VS Code

Everything here arrives through the language server, so any LSP client gets the
first group for free.

- **Code lens above each `vmark` block.** Two lenses per block: `N formulas ·
  M stale` (or `· ok`), which runs Fix Sheet, and `Explain`, which runs Explain
  Sheet. Setting `visimark.codeLens.enable`.
- **Inlay hints.** The computed value shown as `‹value›` beside a stale one,
  with no change to the file. The non-destructive twin of fix-on-save.
  Setting `visimark.inlayHints.enable`.
- **Quick fixes with a preferred action.** Update a stale value, rewrite a date,
  change an undefined name to the suggested one, wrap a vector in `SUM(…)`.
- **`source.fixAll.visimark` code action**, so `editor.codeActionsOnSave` can
  run it.
- **Document and range formatting.** Edits are minimal per cell, so the cursor,
  folds and undo granularity survive. The extension calls this request itself
  rather than `editor.action.formatDocument`, because that runs the user's
  default formatter (usually Prettier), which would not fix stale values.
- **Diagnostics with severities.** Stale is a warning, a date or unit or undefined
  name or similar is an error, and `WARN` is a hint.
- **Fix on save through `onWillSave`**, so the file lands correct and the
  document is not dirtied again.
- **Read-only virtual documents** for Explain and the full report, opened beside
  the editor.
- **Markdown preview contribution** through `markdown.markdownItPlugins` and a
  preview stylesheet; `markdown.api.reloadPlugins` on setting change.
- **Language-server controls:** restart command and `visimark.trace.server`.
- **Per-document status** pushed by the server (`visimark/status`) to the status
  bar.

### Obsidian

- **Live Preview decorations** that coexist with the visible `<!--vmark=…-->`
  anchor comment; a setting turns them off.
- **Findings view written for a non-programmer.** Sentences instead of codes;
  the code lives in the row's `aria-label`. Not a Problems panel.
- **Vault sweep** with chunked scanning that yields to the UI thread, a
  cancel button, and a live ambient count kept current by a vault index.
  Optional sweep on vault open.
- **Infer with a preview modal** and selection scoping: highlight part of a
  table and only that part is inferred.
- **Evaluate dialog** with copy-values-as-JSON.
- **Starter templates**, one palette command each. A note that already has a
  block is refused, since a second block would declare the same names again.
- **Activation gate.** Reading surfaces stay silent in a note with no `vmark`
  block, so an ordinary vault looks identical with the plugin installed.
- **Tooltip or tap-to-explain** in the same delegated listener across pop-out
  windows.
- **Ribbon icon** and **clickable status bar** as the two entry points before a
  note is open.
- **Public plugin API** (`apiVersion: 1`) so other plugins can read checked
  values.
- **Mobile support**, including a tap path where desktop has hover.
- **Per-window listeners** for pop-out windows.

### Joplin

- **Two content scripts.** CodeMirror 6 marks and lint in the editor;
  markdown-it marks in the renderer.
- **Check, Format, Evaluate and Explain** (#384 group 1). The engine runs in
  the editor's content script, which the commands reach through
  `editor.execCommand`. Format writes one transaction. They work in the
  Markdown editor only, and drop whatever depends on an import.
- **Infer and the four templates** (#384 group 2). Infer's dialog previews
  the blocks, and Apply is refused if the note changed in between.
- **Two settings and a viewer tooltip** (#384 group 3). `showMarks` hides the
  marks and keeps the diagnostics; `fixDatesOnFormat` is Format's
  `--fix-dates`.
- **Legacy CodeMirror 5 editor is skipped** with no error.
- **Print and PDF export rules** in the stylesheet.
- **One shared stylesheet** shipped as a content-script asset.

### Any CodeMirror 6 host (`codemirror-visimark`)

Subpaths: the main extension, `/lint`, `/highlight`. Options: `active`,
`path`, `readImport`, `recompute` (`debounced` or `on-refresh`), and
`focusableMarks`. `refresh` recomputes on demand. This is the layer Obsidian
Live Preview, Joplin and the playground share. `/highlight` highlights the
inside of `vmark` blocks, but Obsidian and Joplin do not use it, so no
integrated editor except the playground currently gets block highlighting.

## 3. Gaps worth looking at

Read these as candidates, not decisions. Each one needs its own issue.

1. **Joplin has no findings panel or sweep yet.** Commands, templates,
   settings and the viewer tooltip are in (#384 groups 1–3); the panel and
   the sweep are #384's group 4. The plugin has no file path, so `path` stays null and
   imports stay out of reach.
2. **Obsidian has no inline diagnostics.** `codemirror-visimark/lint` exists
   and Joplin uses it. Obsidian shows findings only in its own pane.
3. **VS Code has no sweep, infer, evaluate or templates.** Sweep is the
   differentiator the Obsidian README claims for Obsidian over VS Code, so a
   workspace-wide equivalent is a larger feature than the others.
4. **Hover content differs.** VS Code's hover covers function signatures,
   binding lines, computed-column cells and anchored prose values. Obsidian's
   covers a marked value's formula and nothing else, but works by tap and
   keyboard too. Joplin's covers a marked value's formula in the viewer only,
   as a plain tooltip; its editor has no hover.
5. **Fix-on-save defaults differ.** VS Code is on by default; Obsidian is off
   and keyed to the Ctrl/Cmd+S keystroke because Obsidian exposes no explicit
   save event. A new editor has to pick one.
6. **Block highlighting is missing in three of four hosts**, and in Joplin it
   is blocked by the host.
7. **Obsidian is the only host with a public API**, and it is not mirrored
   anywhere else.

## 4. How this was gathered

Sources read: `editors/vscode/package.json` and `src/`, `packages/visimark-lsp/src/`,
`editors/obsidian/src/main.ts` and its README, `packages/codemirror-visimark/`,
and `editors/joplin/` on the #378 impl branch. Not run: no host was started, so
"built" means the code exists and registers, not that a person verified it.
Obsidian's README says Part 2 of its manual test has not been run whole, but
`docs/design/obsidian-manual-test.md` records every Part 2 section as pass on
desktop (not on a phone for §2.5), and says a person still needs to confirm the
sweep and findings panes render. The README line is stale.

<!--vmark:no-formulas-->
