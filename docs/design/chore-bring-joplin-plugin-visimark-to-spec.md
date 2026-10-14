# Joplin commands, repair, settings, and notebook sweep — feature spec

**Status:** approved (#384) · **Date:** 2026-10-14 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/384#issuecomment-6164291939

## 1. Purpose

`joplin-plugin-visimark` (#378, implementation PR #381) has two content scripts
and nothing else. It marks computed values in the editor and the viewer, and
lists findings as lint diagnostics. It has no command, no setting and no
repair. An author can see a stale value in Joplin, but to fix it they have to
leave Joplin and run `visimark fmt` on an exported copy. The issue's session
against the #381 branch shows this:

```console
$ git grep -c -E "commands\.register|settings\.|menuItems|views\.panels" origin/issue/378-joplin-plugin-visimark-a-joplin-plugin-impl -- editors/joplin/src
$ echo $?
1
$ git show origin/issue/378-joplin-plugin-visimark-a-joplin-plugin-impl:editors/joplin/src/index.ts | grep -c "contentScripts.register"
2
```

This spec brings the plugin up to the Obsidian and VS Code feature set, as far
as Joplin's plugin API allows. It has four groups, and each one ships on its own:

1. **Commands and repair.** Check, Format, Evaluate and Explain, plus a
   per-finding quick fix on each lint diagnostic. Every write goes through the
   CodeMirror 6 editor as one transaction.
2. **Authoring.** Infer the formulas, with a preview and a selection that
   scopes it. Plus the four starter templates.
3. **Settings and a viewer tooltip.**
4. **A findings panel and a notebook sweep.**

The work needs two changes outside the plugin. The first is a private
workspace package, `editors/shared`, which holds the editor logic that Joplin
and Obsidian now share (§2.1). The second is quick-fix `actions` on the
published `codemirror-visimark/lint` (§2.2). Neither depends on #381. Every
Joplin group does.

**Wording.** Joplin uses the CLI's wording everywhere: `formatCheck` for Check,
and `describeFinding` for each finding in the panel. That is the wording its
diagnostics already show. The Obsidian plugin's plain sentences (`findings.ts`,
`forReader`) come from #176's constraint 6, which applies to Obsidian only.
They stay in Obsidian.

**Imports.** The plugin reads one note at a time, `path` is null, and there is
no reader, so a `from x.csv` import cannot resolve inside Joplin. Every command,
the panel and the sweep follow the rule the editor marks already follow
(`importDependentNames` in `codemirror-visimark`). They drop each finding, edit
and value whose name depends on an import, check everything else, and say once
that they did (§3, message I1). Constraint 4 of
[§2](../visimark-design.md#2-constraints-that-shaped-the-design) still holds.
The sweep reads other notes one at a time, and no note's text ever supplies
another note's value.

## 2. The surface

### 2.1 `editors/shared` (PR 0)

A new private workspace member. `package.json`: `"name":
"visimark-editor-shared"`, `"private": true`, no `version`, `"type": "module"`,
scripts `typecheck` and `test`, dependencies `visimark` and
`codemirror-visimark` (`workspace:*`). It has no build. Its consumers bundle it
from source, and its `tsconfig.json` resolves `visimark` and
`codemirror-visimark/*` to source, as `editors/obsidian/tsconfig.json` does.
Neither published artifact gains a dependency. The Obsidian plugin's
behaviour, its bundle contents and its tests' assertions are unchanged, so it
needs no Obsidian release.

What moves from `editors/obsidian/src/`, and in what form:

| Module in `editors/shared/src/` | From | Change |
|---|---|---|
| `at-cursor.ts` | `at-cursor.ts` | moved as is |
| `values.ts` | `values.ts` | moved as is |
| `infer-plan.ts` | `infer-plan.ts` | moved as is |
| `templates.ts` | `templates.ts` (generated) | moved; the generator writes it here (below) |
| `template-insert.ts` | `template-insert.ts` | moved as is |
| `hover.ts` | `hover.ts` | moved; imports `Explanation` from `./explain.js` |
| `explain.ts` | `api.ts` | `Explanation`, `explainBinding`, `bindingOf` and `qualifiedInputs` move here. `api.ts` stays in Obsidian and imports them, and `apiVersion` and the API shape do not change. |
| `repairs.ts` | `report.ts` | new `planRepairs(model, result, opts: { fixDates?: boolean; doc?: DocumentFile }): { byFinding: Map<Finding, Edit[]>; all: Edit[] }`. It holds the `planFmt` call (`noArtifacts: true`) and the anchor-group adoption logic, unchanged. Obsidian's `reportFor` keeps its signature, calls `planRepairs`, and still builds `FindingRow`s with `forReader`. |
| `sweep.ts` | `sweep.ts` | generalised (below) |

`analysis.ts`, `api.ts` (minus the moved functions), `chart.ts`, `findings.ts`,
`report.ts` (rows), `settings.ts`, `snapshot.ts`, `status.ts`,
`vault-index.ts` and every module that imports `obsidian` stay in
`editors/obsidian`. The moved modules' tests move with them, and their
assertions do not change. `report.test.ts`'s fmt-equivalence property stays in
Obsidian and still passes.

**The sweep's generalisation.** `sweep<T>(source, checkNote, options)`:

- `SweepSource.paths()` may return `readonly string[]` or a `Promise` of one.
  Joplin collects note ids asynchronously.
- `checkNote(text: string, path: string): Promise<{ problems: number; advice:
  number; detail: T }>` replaces the inline `readNote` + `check` +
  `reportFor`. It throws for a note that cannot be checked, and that note lands
  in `unreadable`, as today.
- `SweptNote<T>` carries `detail: T` in place of `report`. The prefilter
  (`mightHaveBlock`, `hasVmarkBlock`), chunking, `pause`, `onProgress`,
  `signal`, `adviceOnly` and the "advice alone never lists a note" rule are
  unchanged.
- Obsidian passes a `checkNote` that does exactly what the loop does today and
  returns `detail: report`. `vault-index.ts` and `sweep-view.ts` read `detail`
  where they read `report`.

**Templates.** `editors/obsidian/templates/*.md` moves to
`editors/shared/templates/`. `scripts/gen-obsidian-templates.ts` becomes
`scripts/gen-editor-templates.ts` and writes `editors/shared/src/templates.ts`.
The root script `gen:obsidian-templates` becomes `gen:editor-templates`. The
staleness test moves with `templates.ts` and names the new command.

Obsidian's `tsconfig.json`, its `esbuild.config.mjs` aliases, and the
Joplin build resolve `visimark-editor-shared/*` to `editors/shared/src/*`.

### 2.2 Quick fixes in `codemirror-visimark/lint`

`visimarkLint()` keeps its signature. There is no new option and no new
export. Each diagnostic gains `actions`, chosen to match the quick fixes in
`visimark-lsp`'s `codeActionsFor`:

| Finding | Button (`Action.name`) | Edit, applied over the diagnostic's current `from`–`to` as one transaction |
|---|---|---|
| `STALE` with a span | `Update to {text}` | `{text}`, the `planFmt` edit whose span is the finding's |
| `DATE` with `isoFix` | `Rewrite to {isoFix}` | `{isoFix}`. Always offered, as the LSP offers it, whatever the host's Format setting. |
| `UNDEF` with `suggestion` | `Change to {suggestion}` | `{suggestion}` |
| `VECTOR` with `raw` | `Wrap in SUM({raw})` | `SUM({raw})` |

Every other finding has no action. The spanless anchor-group `STALE` has no
diagnostic, as today, so it has no quick fix either. Format repairs it.

**Where the replacement comes from.** The recompute in `plugin.ts` already
holds `model` and `result`. It now also runs
`planFmt(model, result, { noArtifacts: true, fixDates: true })` and attaches
each edit's text to the finding with the same span, as an internal `fix`
field on the entries of `findingsField`. The field's span mapping carries
each finding across an edit and marks it as moved. A moved finding gets no
action until the next recompute replaces the set, because its replacement
was planned against the old text (#387 review). `findingsField`'s type is internal and not
exported, so the published surface does not change. The cost is one `planFmt`
per recompute.

This is a published-package change. `codemirror-visimark` gets a `CHANGELOG.md`
entry and ships in the next core release, independent of the unpublished
`.jpl`. Every host that uses `visimarkLint()` gains the buttons. That includes
the playground (`packages/visimark/src/playground/app/main.ts`), and the
buttons are wanted there. The non-goal in
`docs/design/extract-live-preview-codemirror-spec.md` §8 ("quick-fix UI in the
package") is revised by this spec. That document gets a one-line note pointing
here.

### 2.3 Joplin commands (groups 1, 2, 4)

Registered with `joplin.commands.register`. Each command shows in the command
palette and in a **Tools → VisiMark** submenu (`joplin.views.menus.create`,
`MenuItemLocation.Tools`), in the order below.

| Id | Label | Also in | Group |
|---|---|---|---|
| `visimark.check` | VisiMark: Check this note | — | 1 |
| `visimark.format` | VisiMark: Format this note | — | 1 |
| `visimark.evaluate` | VisiMark: Evaluate this note | — | 1 |
| `visimark.explain` | VisiMark: Explain this value | editor context menu (`EditorContextMenu`) | 1 |
| `visimark.infer` | VisiMark: Infer the formulas | — | 2 |
| `visimark.insertInvoiceTemplate` | VisiMark: Insert invoice template | — | 2 |
| `visimark.insertBudgetTemplate` | VisiMark: Insert monthly budget template | — | 2 |
| `visimark.insertCapacityTemplate` | VisiMark: Insert team capacity template | — | 2 |
| `visimark.insertExperimentTemplate` | VisiMark: Insert experiment log template | — | 2 |
| `visimark.toggleFindings` | VisiMark: Show findings panel | — | 4 |
| `visimark.sweep` | VisiMark: Sweep this notebook | notebook context menu (`FolderContextMenu`) | 4 |

**The route to the editor.** The CodeMirror content script registers editor
commands on the control it receives (`control.registerCommand`). The main
script calls `joplin.commands.execute("editor.execCommand", { name, args })`
and gets back the command's return value. Both exist in Joplin v3.7.1's source:
`CodeMirrorControl.registerCommand` in `packages/editor/CodeMirror/CodeMirrorControl.ts`,
and the `editor.execCommand` handler in
`packages/app-desktop/gui/NoteEditor/NoteBody/CodeMirror/v6/useEditorCommands.ts`,
which returns `editorRef.current.execCommand(...)`. All engine work for groups
1 and 2 runs in the content script. It reads the document, plans, and applies
one transaction. The engine is already in that bundle, so groups 1–3 add no
engine to `index.js`.

Editor commands. They are internal, returned as plain JSON, and named `visimark.cm.*` so
they cannot collide with the palette ids:

| Editor command | Args | Returns |
|---|---|---|
| `visimark.cm.check` | — | `{ kind: "no-block" }` · `{ kind: "checked", text, problems, importsDropped }` |
| `visimark.cm.format` | `{ fixDates: boolean }` | `{ kind: "no-block" }` · `{ kind: "clean", importsDropped }` · `{ kind: "applied", repairs, importsDropped }` · `{ kind: "failed" }` |
| `visimark.cm.evaluate` | — | `{ kind: "no-block" }` · `{ kind: "values", rows, importsDropped }` |
| `visimark.cm.explain` | — | `{ kind: "no-block" }` · `{ kind: "not-on-value" }` · `{ kind: "explained", explanation, row }` |
| `visimark.cm.inferPreview` | — | `{ kind: "preview", version, description, empty, edits }` |
| `visimark.cm.apply` | `{ version, edits }` | `{ kind: "applied" }` · `{ kind: "changed" }` |
| `visimark.cm.insertTemplate` | `{ id }` | `{ kind: "has-block" }` · `{ kind: "no-place" }` · `{ kind: "inserted" }` |
| `visimark.cm.setMarks` | `{ show: boolean }` | `{ kind: "ok" }` |
| `visimark.cm.reveal` (group 4) | `{ start, end }` | `{ kind: "ok" }` |

- `text` is `formatCheck(<note title>, findings)`, the CLI's `check` output.
  Joplin passes the title as an argument.
- `version` counts document changes in a state field. `apply` refuses with
  `changed` when the count has moved since the preview.
- Every command that writes dispatches one transaction, so one Ctrl+Z undoes
  it. That covers `format`, `apply`, `insertTemplate` and the lint actions.
- An engine throw inside any command returns `{ kind: "failed" }`. It never
  leaves a half-applied edit or an unhandled rejection.

**Which editor.** Before calling an editor command, the main script reads
`joplin.settings.globalValue("editor.codeView")`. When it is `false` (the Rich
Text editor), or when `editor.execCommand` returns `undefined` (no CodeMirror 6
content script loaded), the command shows message R1 and does nothing. Group 4
changes this for Check only (§2.5).

**Group 2 details.**

- **Infer.** It scopes to the editor selection when the selection is non-empty
  (`previewInfer(source, span)`), and to the whole note otherwise. The main
  script shows `description` in a dialog (`joplin.views.dialogs`) with
  **Apply** and **Cancel**. When `empty` is true, it shows the description with
  **OK** only. **Apply** calls `visimark.cm.apply` with the preview's
  `version`. Infer is not gated on an existing block, same as Obsidian.
- **Templates.** One command each, inserted at the cursor through
  `safeTemplateInsertion`. They are refused when the note already has a `vmark`
  block (`has-block`, message T1), or when no safe place exists (`no-place`,
  message T2).

### 2.4 Settings and the tooltip (group 3)

`joplin.settings.registerSection("visimark", { label: "VisiMark" })` and two
settings, both `public: true`:

| Key | Type | Default | Label | Effect |
|---|---|---|---|---|
| `showMarks` | bool | `true` | Show marks on computed values | Off hides the dotted and wavy marks in the editor and the viewer, and with them the viewer tooltip. Lint diagnostics and their quick fixes stay. |
| `fixDatesOnFormat` | bool | `false` | When formatting, rewrite dates to ISO 8601 where the date is unambiguous | Passed to Format as `fixDates`. The same exception as `visimark fmt --fix-dates`, and off by default like the flag. |

- **Editor.** `showMarks` off adds the class `visimark-marks-off` to the editor
  through a compartment (`EditorView.editorAttributes`). `visimark.css` gains a
  rule that removes `text-decoration` from `.visimark-computed` under it. The
  content script asks for the current value on load
  (`context.postMessage({ kind: "settings" })`, answered by
  `joplin.contentScripts.onMessage`). The main script pushes changes from
  `joplin.settings.onChange` through `visimark.cm.setMarks`.
- **Viewer.** The markdown-it content script reads
  `pluginOptions.settingValue("showMarks")`, which v3.7.1 documents for
  renderer scripts. When it is false, the script does not install
  `markdown-it-visimark` and renders the note untouched. The change shows on
  the viewer's next render.
- **Tooltip.** When `showMarks` is on, the markdown-it content script adds its
  own core rule after VisiMark's. It runs one analysis of the note source and
  sets `title` on every element that carries `data-vmark`. The value is
  `summaryFor(explainBinding(model, result, name), rowFrom(data-vmark-row))`,
  for example `Net = Qty * Rate · comes to 5200 · reads lines.Qty, lines.Rate`.
  An import-dependent name gets no title. `markdown-it-visimark` does not
  change. The cost is a second analysis per render.

### 2.5 The findings panel and the sweep (group 4)

The engine joins `index.js` in this group.

**Panel.** `joplin.views.panels.create("visimark.findings")`. `visimark.toggleFindings` shows
and hides it. It has two sections:

- **This note.** Computed in the main script from
  `joplin.workspace.selectedNote().body`, so it works in either editor. It is
  refreshed on `onNoteSelectionChange` and `onNoteChange`. Because it reads
  the body, it reflects the last save, and Joplin saves an edit shortly after
  typing stops. It shows one row per finding, in document order: `{CODE}
  {name}{ · rowLabel}` and below it `describeFinding(f)`. `NOTE` gets no row.
  The header is `N problems`, counted with `isProblem`, or message C1 when
  there are none, or N1 when the note has no block. Line I1 is added when
  findings were dropped. Clicking a row with a span calls `visimark.cm.reveal`
  in the Markdown editor, and does nothing in the Rich Text editor. The panel
  writes nothing.
- **Sweep.** Empty until a sweep runs.

From group 4, `visimark.check` opens the panel and refreshes it, in either
editor, instead of showing the group 1 dialog. That is read-only Check in the
Rich Text editor. Explain stays Markdown-only, because it needs a cursor
offset in the Markdown text.

**Sweep.** `visimark.sweep` takes an optional `folderId`, which the notebook
context menu passes. Without one it uses `joplin.workspace.selectedFolder()`.
It covers that notebook and every notebook nested under it:

1. Folders: `joplin.data.get(["folders"], { fields: ["id", "parent_id", "title"], page })`, paged until `has_more` is false. Then the descendants of the root.
2. Note ids: `joplin.data.get(["folders", id, "notes"], { fields: ["id", "title"], page })` for each folder, paged.
3. Bodies: `joplin.data.get(["notes", id], { fields: ["body"] })`, one at a time, through the shared `sweep()`'s `read`.

`checkNote` locates, builds and checks the note with no reader. It drops
import-dependent findings, then counts `isProblem` findings as problems and
`WARN` as advice (`NOTE` is neither). The panel's Sweep section shows
`Checked n of N notes` while it runs, with a **Cancel** button that sets the
`signal`. When it finishes, it lists each note that disagrees with itself,
with its title and problem count. Clicking one runs `openNote`. Below the list
it shows counts for advice-only notes, unreadable notes and notes with dropped
import findings. A cancelled sweep shows what it found so far, marked
`Cancelled`. Starting a sweep while one is running cancels the first. The sweep
never calls `joplin.data.put`, and it changes no note.

### 2.6 Messages

| Id | Text |
|---|---|
| N1 | This note has no VisiMark block, so there is nothing to check in it yet. |
| C1 | Everything in this note agrees with its formulas. |
| F1 | Applied {n} repair. / Applied {n} repairs. |
| F2 | This note could not be checked, so nothing was changed. |
| X1 | Put the cursor on a value VisiMark works out, and ask again. |
| A1 | This note changed while VisiMark was working it out. Try again. |
| R1 | VisiMark commands work in the Markdown editor. Switch to it and try again. |
| T1 | This note already has a VisiMark block. Insert the template into a new note instead. |
| T2 | Could not find a place to insert the template. Try a new, empty note. |
| I1 | This note reads another file, which Joplin cannot open. Values that depend on it were not checked. |

N1, C1, X1, T1 and T2 match the Obsidian plugin's wording. Messages appear in
`joplin.views.dialogs.showMessageBox`, except Check's output and Evaluate's
table, which appear in a dialog in a monospace block and an HTML table. When
I1 applies, it is appended as a last line.

## 3. The machine contract

No CLI command, option, exit code, stream or `--json` shape changes. The
composite Action does not change. The contracts this spec adds are:

| Surface | Contract | Who consumes it |
|---|---|---|
| `codemirror-visimark/lint` | each diagnostic's `actions` (§2.2): names and edits | any CodeMirror host, including the playground |
| Joplin command ids | the eleven ids in §2.3 | Joplin keyboard shortcuts a user binds |
| Joplin settings keys | `showMarks`, `fixDatesOnFormat` | stored per profile by Joplin |
| `editors/shared` | none outside the repository: private and unversioned | the two plugins |

Plugin id `com.visimark.joplin`, the `.jpl` packing, `app_min_version`
`3.7.1` and `platforms: ["desktop"]` are unchanged. Every API this spec uses
exists in v3.7.1: commands, menus, settings sections, `settingValue`, dialogs,
panels, `joplin.data`, `registerCommand`, and `editor.execCommand`. The
implementation records that check in the manual test (M-A1).

## 4. Behaviour table

### 4.1 Automated, run by the root `bun test`

| # | Where | Check | Expected |
|---|---|---|---|
| S1 | `editors/shared/test/` | the moved tests | pass with unchanged assertions |
| S2 | `editors/obsidian/test/` | the whole suite, including `report.test.ts`'s fmt-equivalence, `sweep.test.ts` and `vault-index.test.ts` | passes; only import paths and `report` → `detail` change |
| S3 | `editors/shared/test/sweep.test.ts` | `paths()` returning a `Promise` | same result as the array form |
| S4 | `scripts`/templates test | `bun run gen:editor-templates` then `git diff --exit-code` | clean |
| L1 | `packages/codemirror-visimark/test/lint.test.ts` | `docs/example-invoice-drift.md` in an editor with `visimark()` + `visimarkLint()`; the `lines.Net` On-call support cell's diagnostic | one action, `Update to 5200.00`; applying it changes exactly that cell, and the document is otherwise byte-identical |
| L2 | same | the `15.10.2026` `DATE` diagnostic | action `Rewrite to 2026-10-15` |
| L3 | same | the ambiguous `11/12/2026` `DATE` diagnostic | no action |
| L4 | same | the `UNDEF` on `fx_rate` | action `Change to fx_eur` |
| L5 | same | the `VECTOR` on `recon.variance` | action `Wrap in SUM(schedule.Amount)` |
| L6 | same | applying every `Update to` action | each is one transaction; one undo restores the previous document |
| J1 | `editors/joplin/test/commands.test.ts` | `visimark.cm.format` with `fixDates: false` on the drift invoice | the document equals the bytes `visimark fmt` writes to the same file |
| J2 | same | `fixDates: true` | equals `visimark fmt --fix-dates` |
| J3 | same | `visimark.cm.check` on the drift invoice titled `example-invoice-drift.md` | `text` equals `visimark check docs/example-invoice-drift.md`'s stdout with the leading path replaced by the title |
| J4 | same | a note whose sheet imports `from x.csv` and has a stale value in a second sheet that does not read it | `format` repairs the second sheet's value only; `check` lists no `UNDEF` for imported columns; `importsDropped` true |
| J5 | same | `visimark.cm.insertTemplate` on a note with a block / on an empty note | `has-block` / `inserted`, with the body containing the template's block |
| J6 | same | `visimark.cm.apply` after a document change | `changed`, and the document is untouched |
| J7 | same | a note with no `vmark` block, every command | `no-block`, no transaction dispatched |
| J8 | `editors/joplin/test/index.test.ts` | `onStart` against a fake `joplin` global | registers exactly the §2.3 ids and labels for the groups landed so far; Tools submenu in table order |
| J9 | `editors/joplin/test/content-scripts.test.ts` | markdown-it script with `settingValue("showMarks")` false | output has no `visimark-computed` and no `title` |
| J10 | same | `showMarks` true, drift invoice | every `data-vmark` element has a `title` starting with its binding line |
| J11 | `editors/joplin/test/sweep.test.ts` | the sweep over a fake `joplin.data` of three folders (root, child, unrelated) | visits root and child only; lists the disagreeing notes; never calls `put` |
| J12 | same | `signal.aborted` set after the first chunk | `cancelled: true`, partial list |
| A1–A12 | #381's tests | unchanged, except A10 | A10: `addExtension` is called once with the marks, the lint and the marks-off compartment |

Bundle: #381's A2 (no `node:` import) still holds, now with the engine in
`index.js` from group 4. The bundle sizes before and after each group are
recorded in that group's PR body. There is no size limit.

### 4.2 Manual, in `docs/design/joplin-manual-test.md`

Run in Joplin desktop at or above 3.7.16, with the CI-built `.jpl`, on a note
that has the body of `docs/example-invoice-drift.md`.

| # | Group | Scenario | Required |
|---|---|---|---|
| M-A1 | all | the v3.7.1 API check of §3 | recorded |
| M-1.1 | 1 | the command palette | lists the §2.3 labels for the landed groups; Tools → VisiMark lists the same |
| M-1.2 | 1 | **Format this note** | message F1 with 15 repairs; one Ctrl+Z restores the drifted note exactly; copied out, the note is byte-identical to `visimark fmt`'s output, and `visimark check` on it reports `5 problems (0 stale, 5 errors)` and exits 1 |
| M-1.3 | 1 | the quick fix on the On-call support `Net` cell | that cell becomes `5200.00`; nothing else changes |
| M-1.4 | 1 | **Check this note** | the dialog text matches `visimark check`'s output (the `27 problems` summary) |
| M-1.5 | 1 | **Explain this value** with the cursor on a stale `Net` cell, then on prose | formula, value and inputs; then X1 |
| M-1.6 | 1 | a note with no block, every command | N1 (or T-success for templates); nothing changes |
| M-1.7 | 1 | the Rich Text editor, every command | R1; the note is unchanged |
| M-2.1 | 2 | paste a plain table with a computed column, select it, **Infer** | the preview dialog; **Apply** writes one block, and one Ctrl+Z removes it |
| M-2.2 | 2 | each template in an empty note, then again | inserted; then T1 |
| M-3.1 | 3 | Settings → VisiMark | both settings, with the §2.4 labels and defaults |
| M-3.2 | 3 | `showMarks` off | marks gone from the editor at once and from the viewer on its next render; diagnostics remain |
| M-3.3 | 3 | hover a marked value in the viewer | the tooltip states the binding line |
| M-4.1 | 4 | the panel on the drift note, in both editors | the rows; clicking one in the Markdown editor moves the cursor there |
| M-4.2 | 4 | sweep a notebook with a sub-notebook holding the drift note | the drift note is listed; Cancel stops it; no note's `updated_time` changes |

## 5. Compatibility

| Consumer | Before | After |
|---|---|---|
| `visimark` CLI, `--json`, `action.yml`, `docs/ci.md`, `.github/workflows/dogfood.yml` | — | unchanged |
| `editors/obsidian` | modules in `src/` | imports the moved modules from `editors/shared`; behaviour, `manifest.json`, `versions.json` and bundle contents are unchanged; no Obsidian release |
| `codemirror-visimark` users (playground, third-party hosts) | diagnostics without actions | diagnostics with actions (§2.2); additive; minor release with a changelog entry |
| `editors/vscode`, `visimark-lsp`, `markdown-it-visimark`, `remark-visimark`, `markdownlint-visimark`, MCP | — | unchanged |
| `ci.yml` | builds and tests the workspace | also typechecks and tests `editors/shared`; the version-agreement step is unchanged, because `editors/shared` has no version |
| `release.yml`, `scripts/prepare-release.ts` | — | unchanged; `editors/shared` is never published |
| root `package.json` | `gen:obsidian-templates` | `gen:editor-templates` (the only rename) |
| `joplin-plugin-visimark` | two content scripts | §2.3–§2.5; plugin id, packing and `app_min_version` unchanged |

Nothing a user runs breaks, so no migration note is needed. Everything here
except §2.2 can be reverted without a release. §2.2 is reverted by a later
`codemirror-visimark` release.

## 6. Interaction with the rest of the tooling

- **The engine.** It gets no new export. Everything is built from `planFmt`,
  `formatCheck`, `describeFinding`, `isProblem`, `evalValues`, `dependencies`
  and `check`, which the browser entry already exports.
- **`codemirror-visimark`.** Lint gains actions (§2.2). `visimark()`'s options,
  its exports and its peer floors are unchanged.
- **`markdown-it-visimark`.** Unchanged. The tooltip is plugin-side.
- **The Obsidian plugin.** Its structure changes (§2.1) and its behaviour does
  not. Obsidian's lint is still not used: #176 constraint 6 still governs it.
- **Release workflow.** Only `codemirror-visimark`'s changelog entry rides the
  next core release. The plugin stays build-only.
- **The review workflow and issue templates.** Unchanged.

## 7. Documentation to update

Each group's PR updates the lines its group makes stale. The last group's PR
closes the list.

- `editors/joplin/README.md`: commands, settings, panel and sweep. Remove its
  "no settings" and "reads one note, never calls `joplin.data`" limits, and add
  "write commands work in the Markdown editor only".
- `docs/design/joplin-plugin-visimark-a-joplin-plugin-spec.md`: a note under
  its §8 non-goals pointing here for the ones this spec takes up.
- `docs/design/joplin-manual-test.md`: the §4.2 rows, one section per group.
- `docs/editor-feature-catalog.md`: the Joplin column for every feature this
  adds, §3 gap 1 closed, and the stale "templates are not gated" sentence about
  Obsidian corrected (the source refuses a second block).
- `docs/design/extract-live-preview-codemirror-spec.md` §8: the one-line note
  that quick-fix actions were added by #384.
- `packages/codemirror-visimark/README.md` and `CHANGELOG.md`: the actions.
- `editors/obsidian/README.md`, `CONTRIBUTING.md` and any doc that names
  `gen:obsidian-templates` or `editors/obsidian/templates/`: the new paths.
- `docs/vocabulary-catalogue.md`: the #378 row's "no logic of its own" and
  "no setting" wording, and the #384 row moved to the Shipped register as
  `UNRELEASED`.
- `CHANGELOG.md` under `## Unreleased`.

`docs/visimark-editor-plugins-design.md` has no Joplin section and does not
gain one. The issue's mention of it was wrong (pre-review 11).

## 8. Non-goals

- Fix on save and a status-bar count. Joplin's plugin API has no save event and
  no status-bar namespace.
- Chart SVG regeneration (pre-review 10). Joplin gives a note no path, so there
  is nowhere beside it to write an SVG. Format declines artifacts
  (`noArtifacts: true`). A stale chart still gets its finding, with no repair.
- `vmark` block highlighting, imports through Joplin attachments, mobile, and
  the Rich Text editor round trip. These are #378 non-goals, unchanged.
- Writing through `joplin.data.put`.
- A public API for other plugins.
- Publishing the plugin.
- Plain-sentence wording in Joplin (§1).
- Any change to what `check` means.

## 9. Delivery

1. **PR 0, this spec's PR.** The spec, the plan and §2.1. Obsidian only, and it
   does not wait on #381.
2. **PR 1a.** §2.2, `codemirror-visimark/lint` actions, with its changelog entry.
3. **PR 1.** Group 1, after #381 merges.
4. **PRs 2–4.** Groups 2, 3 and 4, in order.

Each PR cites this spec. #384 stays open until the last ships in a tagged
release.

## 10. Open questions

None.

<!--vmark:no-formulas-->
