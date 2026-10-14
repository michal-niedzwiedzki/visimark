# Joplin commands, repair, settings, and notebook sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `joplin-plugin-visimark` up to the Obsidian and VS Code feature set, as far as Joplin's plugin API allows: commands and repair, authoring, settings and a viewer tooltip, and a findings panel with a notebook sweep.

**Architecture:** The work lands in six pull requests, in the order the spec's §9 sets.

- **PR 0** (this branch) extracts the editor logic both plugins need into a private workspace package, `editors/shared` (`visimark-editor-shared`). Both plugins bundle it from source. Obsidian's behaviour does not change.
- **PR 1a** adds quick-fix `actions` to `codemirror-visimark/lint`'s diagnostics. The replacement text comes from a `planFmt` run inside the marks' existing recompute.
- **PRs 1–4** are the four Joplin groups. They start after #381 merges. All engine work for groups 1–2 runs in the CodeMirror content script, which the main script reaches through `editor.execCommand`. Group 4 brings the engine into `index.js` for the panel and the sweep.

**Tech Stack:** TypeScript, Bun (`bun test`), esbuild, CodeMirror 6, markdown-it, Joplin plugin API v3.7.1.

**Spec:** [`chore-bring-joplin-plugin-visimark-to-spec.md`](chore-bring-joplin-plugin-visimark-to-spec.md)

## Global Constraints

- Every commit carries the `Co-Authored-By:` trailer for this session from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md).
- No CLI option, exit code, stream or `--json` shape changes. Nothing in `packages/visimark/src/index.ts` or `browser.ts` gains an export.
- `editors/shared` is private and has no `version`. Neither published artifact gains a runtime dependency (spec §2.1).
- No new public export from `codemirror-visimark` (spec §2.2). `visimarkLint()` keeps its signature.
- Obsidian's test assertions do not change. Only import paths and `report` → `detail` change (spec §4.1 S2).
- Messages are spelled exactly as spec §2.6 spells them. Command ids, labels and settings keys are exactly spec §2.3 and §2.4.
- Run `bun run format` and `bun run lint` before every push.
- After each task, run `bun test`, `bun run typecheck` and `bun run build` from the repo root.

## Decisions taken while planning

These settle what the spec leaves to the implementation. None changes a contract the spec names.

- **Obsidian keeps a `sweep.ts`, as an adapter.** The generic `sweep(source, checkNote, options)` lives in `editors/shared/src/sweep.ts`. `editors/obsidian/src/sweep.ts` becomes a thin adapter: it binds Obsidian's per-note checker (`noteChecker(read)` in a new `editors/obsidian/src/note-check.ts`) and re-exports the shared types specialised to `NoteReport`. `main.ts`, `sweep-view.ts`, `vault-index.ts` and `sweep.test.ts` keep their imports. `vault-index.ts`'s `verdictFor` calls the same `noteChecker`, so the two cannot drift.
- **`hover.test.ts` moves to `editors/shared`.** It builds its `Explanation`s with `explainBinding` over `check(build(locate(source)))` instead of through Obsidian's `createApi`. `docs/example-invoice.md` imports nothing, so the values are the same and the assertions do not change.
- **Resolution.** `visimark-editor-shared/*` resolves to `editors/shared/src/*` the way `codemirror-visimark/*` already does: a `paths` entry in each consumer's `tsconfig.json` (which `tsc` and `bun test` both read), and an `alias` in each esbuild config. `editors/shared` has no `exports` map and no build. Obsidian's `package.json` lists it as a `workspace:*` dependency, as it lists `codemirror-visimark`.
- **`api.ts` keeps `export type { Explanation }`,** because `VisiMarkApi`'s published shape names it. `main.ts` and `explain-modal.ts` import from the shared module directly.
- **The lint `fix` field.** `findingsField` keeps its `FindingSet` type for every reader. The fix texts live in a parallel internal field, `fixesField: readonly (string | null)[] | null`, set by the same `setFindings` dispatch through a second effect, `setFixes`. Entry `i` is the `planFmt` replacement for finding `i`. Nothing outside `src/` sees it. The field maps nothing, because a fix is text and the finding's span is what moves.

---

## PR 0 — `editors/shared` (this branch)

### Task 1: The package skeleton

**Files:**

- Create: `editors/shared/package.json`: `"name": "visimark-editor-shared"`, `"private": true`, `"type": "module"`, scripts `typecheck` (`tsc --noEmit`) and `test` (`bun test`), dependencies `visimark` and `codemirror-visimark` (`workspace:*`), devDependencies `@codemirror/state` and `@codemirror/view` at Obsidian's ranges (the type graph of `codemirror-visimark/decorations.js` reaches them).
- Create: `editors/shared/tsconfig.json`: extends `../../tsconfig.base.json`, the `paths` from `editors/obsidian/tsconfig.json` (engine browser entry, `codemirror-visimark`, `codemirror-visimark/*`), `include: ["src", "test"]`.
- Create: `editors/shared/README.md`: two paragraphs. What it is (private, unversioned, bundled from source by both plugins), and that `src/templates.ts` is generated.
- Modify: `editors/obsidian/package.json` (dependency), `editors/obsidian/tsconfig.json` (`"visimark-editor-shared/*": ["../shared/src/*"]`), `editors/obsidian/esbuild.config.mjs` (alias `visimark-editor-shared` → `editors/shared/src`).
- Modify: `bun.lock` through `bun install`.

- [ ] **Step 1:** Create the files and run `bun install`. `bun run typecheck` passes with an empty `src/`.
- [ ] **Step 2:** Commit as `chore(editors): add the private editors/shared package`.

### Task 2: Move the modules that move as they are

**Files:**

- Move (`git mv`) from `editors/obsidian/src/` to `editors/shared/src/`: `at-cursor.ts`, `values.ts`, `infer-plan.ts`, `template-insert.ts`.
- Move from `editors/obsidian/test/` to `editors/shared/test/`: `at-cursor.test.ts`, `infer-plan.test.ts`, `template-insert.test.ts`. Their `docs` path (`../../../docs`) is unchanged by the move.
- Modify: every Obsidian importer (`main.ts`, `values-modal.ts`, `infer-modal.ts`) to import from `visimark-editor-shared/<module>.js`.

- [ ] **Step 1:** Move, fix the imports, and run the root suite. The moved tests pass unchanged (S1), and the Obsidian suite passes (S2).
- [ ] **Step 2:** Commit as `refactor(obsidian): move the host-free modules to editors/shared`.

### Task 3: `explain.ts` and `hover.ts`

**Files:**

- Create: `editors/shared/src/explain.ts` with `Explanation`, `explainBinding`, `bindingOf` and `qualifiedInputs`, moved verbatim from `api.ts` with their comments. `bindingOf` and `qualifiedInputs` stay unexported.
- Move: `hover.ts` to `editors/shared/src/`, importing `Explanation` from `./explain.js`.
- Modify: `editors/obsidian/src/api.ts`: import `explainBinding` and `type Explanation` from the shared module, and `export type { Explanation }`. `apiVersion` and `VisiMarkApi` do not change.
- Modify: `main.ts`, `explain-modal.ts`: import from the shared modules.
- Move: `hover.test.ts`, with the setup change in **Decisions** above.

- [ ] **Step 1:** Move, then run `bun test editors/`. `api.test.ts` passes untouched, which shows the API shape did not move.
- [ ] **Step 2:** Commit as `refactor(obsidian): move explain and hover to editors/shared`.

### Task 4: `repairs.ts`, split out of `report.ts`

**Files:**

- Create: `editors/shared/src/repairs.ts`:

  ```ts
  export interface RepairOptions { fixDates?: boolean; doc?: DocumentFile }
  export interface Repairs { byFinding: Map<Finding, Edit[]>; all: Edit[] }
  export function planRepairs(model: DocModel, result: CheckResult, opts?: RepairOptions): Repairs
  ```

  The body is `reportFor`'s `planFmt` call (`noArtifacts: true`, `fixDates ?? false`, `doc` when given) and its anchor-group adoption, moved with their comments.
- Modify: `editors/obsidian/src/report.ts`: `reportFor` keeps its signature and calls `planRepairs`. `allRepairs` is `repairs.all`. The row loop, `forReader` and the sorting stay.
- Test: `editors/shared/test/repairs.test.ts`. On `docs/example-invoice-drift.md`: `applyEdits(source, all)` equals what `planFmt` + `applyEdits` gives directly. Every `byFinding` key is in `result.findings`. The spanless anchor-group `STALE` owns the anchor edits.

- [ ] **Step 1:** Write `repairs.test.ts` and watch it fail, then create the module and rewire `reportFor`.
- [ ] **Step 2:** `report.test.ts` passes untouched, including its fmt-equivalence property. Commit as `refactor(obsidian): split the repair plan out of report.ts`.

### Task 5: The generic sweep

**Files:**

- Create: `editors/shared/src/sweep.ts`, from `editors/obsidian/src/sweep.ts` with spec §2.1's changes:

  ```ts
  export interface SweepSource { paths(): readonly string[] | Promise<readonly string[]>; read: ReadImport }
  export interface NoteCheck<T> { problems: number; advice: number; detail: T }
  export type CheckNote<T> = (text: string, path: string) => Promise<NoteCheck<T>>
  export interface SweptNote<T> { path: string; problems: number; advice: number; detail: T }
  export interface SweepResult<T> { /* as today, with notes: SweptNote<T>[] */ }
  export function sweep<T>(source: SweepSource, checkNote: CheckNote<T>, options?: SweepOptions): Promise<SweepResult<T>>
  ```

  The prefilter, chunking, `pause`, `onProgress`, `signal`, `adviceOnly` and the "advice alone never lists a note" rule are unchanged. A throw from `checkNote` lands the note in `unreadable`.
- Create: `editors/obsidian/src/note-check.ts`: `noteChecker(read: VaultRead): CheckNote<NoteReport>`. It runs `readNote` + `check` + `reportFor` and returns `{ problems, advice, detail: report }`.
- Replace: `editors/obsidian/src/sweep.ts` with the adapter: `sweep(source, options)` calls the shared `sweep(source, noteChecker(source.read), options)`, and it exports `SweepSource`, `SweptNote = Shared.SweptNote<NoteReport>` and `SweepResult = Shared.SweepResult<NoteReport>`.
- Modify: `vault-index.ts` (`verdictFor` uses `noteChecker`, and builds `detail`), and `sweep.test.ts` and `vault-index.test.ts` (`.report` → `.detail`).
- Test: `editors/shared/test/sweep.test.ts`, with a stub `checkNote` that counts `"STALE"` substrings. It asserts the prefilter skip, `unreadable` on a `null` read and on a throw, `adviceOnly`, `cancelled`, and S3: `paths()` returning a `Promise` gives the same result as the array form.

- [ ] **Step 1:** Write the shared test and watch it fail. Then create the shared module, the checker and the adapter.
- [ ] **Step 2:** The Obsidian suite passes with only the `.detail` renames. Commit as `refactor(obsidian): generalise the sweep over a per-note checker`.

### Task 6: Templates and their generator

**Files:**

- Move: `editors/obsidian/templates/*.md` → `editors/shared/templates/`, `editors/obsidian/src/templates.ts` → `editors/shared/src/templates.ts`, `editors/obsidian/test/templates.test.ts` → `editors/shared/test/templates.test.ts`.
- Move: `scripts/gen-obsidian-templates.ts` → `scripts/gen-editor-templates.ts`. Its `dir`, `out`, header comment and generated preamble name the new paths and `bun run gen:editor-templates`.
- Modify: root `package.json`: `gen:obsidian-templates` → `gen:editor-templates`.
- Modify: `.oxfmtrc.json`: the ignore entry and its comment name `editors/shared/src/templates.ts`.
- Modify: `main.ts`'s import, and the moved test's generator import and stale-file message.

- [ ] **Step 1:** Move, run `bun run gen:editor-templates`, then `git diff --exit-code editors/shared/src/templates.ts` shows only the preamble's changed path lines. Commit the regenerated file (S4).
- [ ] **Step 2:** `bun run --filter visimark-obsidian build`, then confirm `editors/obsidian/test/bundle.test.ts` passes. The templates are still in `main.js`. Commit as `refactor(obsidian): move the templates and their generator to editors/shared`.

### Task 7: PR 0 documentation

**Files:** `CONTRIBUTING.md` (the `gen:editor-templates` row and the regenerate line), `editors/obsidian/README.md` and `docs/design/obsidian-plugin-spec.md` (only where they name a moved path; the historical spec gets a one-line pointer, not a rewrite), `.github/workflows/ci.yml` only if a step names a moved path, `CHANGELOG.md` (no entry: nothing a user sees changes).

- [ ] **Step 1:** `git grep -n "gen:obsidian-templates\|gen-obsidian-templates\|obsidian/templates/\|obsidian/src/templates"` returns only historical plans and reviews.
- [ ] **Step 2:** Commit as `docs: point at editors/shared for the moved editor modules`.

---

## PR 1a — quick fixes in `codemirror-visimark/lint`

Its own branch, `issue/384-lint-actions`, off `master`. It does not wait on #381.

### Task 8: The fix texts

**Files:**

- Modify: `packages/codemirror-visimark/src/findings-field.ts`: add `fixesField` and `setFixes` (see **Decisions**).
- Modify: `packages/codemirror-visimark/src/plugin.ts`: `localFor` and `runSnapshot` also compute `fixesFor(model, result, doc?)`. This runs `planFmt(model, result, { noArtifacts: true, fixDates: true, doc })`. For each finding with a span it returns the `text` of the planned edit whose `start`/`end` equal that span, or `null`. `publish` and `publishFindingsSoon` dispatch `setFixes` beside `setFindings`. `visimarkExtension` returns `[findingsField, fixesField, plugin]`.

- [ ] **Step 1:** Commit as `feat(codemirror): keep the planned fix for each finding`.

### Task 9: The actions

**Files:**

- Modify: `packages/codemirror-visimark/src/lint.ts`: each diagnostic gets `actions` per spec §2.2. `STALE` with a fix: `Update to {text}`. `DATE` with `isoFix`: `Rewrite to {isoFix}`. `UNDEF` with `suggestion`: `Change to {suggestion}`. `VECTOR` with `raw`: `Wrap in SUM({raw})`. Every other finding gets none. `apply(view, from, to)` dispatches one transaction, `{ changes: { from, to, insert } }`, using the `from`/`to` the lint package passes, which are the diagnostic's current span.
- Test: `packages/codemirror-visimark/test/lint.test.ts`, rows L1–L6 of spec §4.1 on `docs/example-invoice-drift.md`.

- [ ] **Step 1:** Write L1–L6 and watch them fail. Implement. Pass.
- [ ] **Step 2:** The playground bundle (`playground-bundle` job) still builds. Run `bun run build` and the job's command locally.
- [ ] **Step 3:** Docs: the `codemirror-visimark/README.md` lint section, a `CHANGELOG.md` `## Unreleased` → `### Added` entry, and the one-line note under `docs/design/extract-live-preview-codemirror-spec.md` §8. Commit as `feat(codemirror): quick-fix actions on lint diagnostics`. Open the PR, citing the spec.

---

## PRs 1–4 — the Joplin groups (after #381 merges)

Each group's branch starts from `master` after the previous group merges. Each task names the files #381 adds (`editors/joplin/src/index.ts`, `codemirrorContentScript.ts`, `markdownItContentScript.ts`, `joplin.d.ts`, `visimark.css`, `build.ts`).

### Task 10: Group 1, commands and repair

**Files:**

- Modify: `editors/joplin/src/joplin.d.ts`: add `commands.register/execute`, `views.menus.create`, `views.dialogs.*`, `settings.globalValue`, and the `MenuItemLocation` values used.
- Create: `editors/joplin/src/editor-commands.ts`, imported by the CodeMirror content script. It defines the `visimark.cm.check/format/evaluate/explain` handlers of spec §2.3 over an `EditorView`. Format calls `planRepairs(...).all` and dispatches one transaction. Every handler drops import-dependent findings, edits and values (`importDependentNames`) and reports `importsDropped`. An engine throw returns `{ kind: "failed" }`.
- Modify: `codemirrorContentScript.ts`: register the handlers with `control.registerCommand`.
- Create: `editors/joplin/src/commands.ts`, imported by `index.ts`. It registers the four palette commands and the Tools → VisiMark submenu, routes through `editor.execCommand`, applies the R1 rule, and shows the §2.6 messages.
- Test: `editors/joplin/test/commands.test.ts` (J1–J4, J7, against a real `EditorView`) and `index.test.ts` (J8 against a fake `joplin` global).

- [ ] **Step 1:** Write the tests, implement them, and pass. Record the bundle sizes in the PR body.
- [ ] **Step 2:** Run manual rows M-A1 and M-1.1–M-1.7. Commit and open the PR.

### Task 11: Group 2, authoring

**Files:** `editor-commands.ts` (`inferPreview`, `apply` with the `version` state field, `insertTemplate`), `commands.ts` (Infer's dialog, the four template commands), tests J5–J6.

- [ ] **Step 1:** Write the tests, implement them, and pass. Run M-2.1 and M-2.2. Commit and open the PR.

### Task 12: Group 3, settings and the tooltip

**Files:** `index.ts` (`registerSection` and the two settings, `onChange` → `visimark.cm.setMarks`, `contentScripts.onMessage`), `codemirrorContentScript.ts` (the marks-off compartment, A10's updated assertion), `visimark.css` (`.visimark-marks-off .visimark-computed { text-decoration: none }`), `markdownItContentScript.ts` (`settingValue("showMarks")`, and the `title` core rule using the shared `explain.ts` and `hover.ts`), tests J9–J10.

- [ ] **Step 1:** Write the tests, implement them, and pass. Run M-3.1–M-3.3. Commit and open the PR.

### Task 13: Group 4, the panel and the sweep

**Files:** `editors/joplin/src/panel.ts` (the HTML, and the `This note` and `Sweep` sections), `editors/joplin/src/notebook-sweep.ts` (folder and note paging over `joplin.data`, and a `checkNote` using `describeFinding`/`isProblem` with imports dropped, passed to the shared `sweep`), `commands.ts` (`toggleFindings`, `sweep`, Check → panel, `reveal`), tests J11–J12. #381's A2 (no `node:` import) must still hold with the engine in `index.js`.

- [ ] **Step 1:** Write the tests, implement them, and pass. Run M-4.1 and M-4.2. Commit and open the PR.

### Task 14: Documentation (closes the list)

Each group's PR updates the lines it makes stale. This PR, the last, finishes spec §7:

- `editors/joplin/README.md`: commands, settings, panel and sweep. Remove "no settings" and "reads one note, never calls `joplin.data`". Add "write commands work in the Markdown editor only".
- `docs/design/joplin-plugin-visimark-a-joplin-plugin-spec.md`: a note under §8 pointing here.
- `docs/design/joplin-manual-test.md`: the §4.2 rows, one section per group.
- `docs/editor-feature-catalog.md`: the Joplin column, §3 gap 1 closed, and the stale Obsidian "templates are not gated" sentence corrected.
- `docs/vocabulary-catalogue.md`: the #378 row's "no logic of its own" and "no setting" wording, and the #384 row moved to the Shipped register as `UNRELEASED`, condensed to `Name`, `Kind`, `Request`, `Landed` (this PR), `Released` (`—`) and `Decision` (the deciding comment).
- `CHANGELOG.md` under `## Unreleased` → `### Added`: one entry for the Joplin feature set.

<!--vmark:no-formulas-->
