# Joplin plugin (`joplin-plugin-visimark`) — feature spec

**Status:** approved (#378) · **Date:** 2026-10-13 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/378#issuecomment-6148869639

## 1. Purpose

Joplin is the first host outside this repository's own clients that can
consume both published editor packages: `codemirror-visimark` (#360) in its
CodeMirror 6 Markdown editor, and `markdown-it-visimark` (#373) in its
markdown-it viewer. A Joplin plugin is therefore the first outside test of the
host-agnostic contract those two packages claim. Demand from Joplin users is
unproved, and the issue is justified by that test, not by users.

Today nothing in the repository mentions Joplin except the two non-goal lines
in the #360 and #373 specs:

```console
$ ls editors
obsidian  vscode
```

**v1 is build-only.** CI builds and packs the plugin as a `.jpl` workflow
artifact, and a user side-loads it. Nothing is published to npm or to Joplin's
plugin repository, so the release set, `release.yml`, `prepare-release.ts` and
the version-agreement step do not change, and no npm name or manifest id
becomes permanent. This narrows the issue as filed, which proposed publishing
on the core tag; the discussion on #378 settled the narrower scope. Publishing
is a later issue if someone asks for it.

The plugin has no logic of its own. It is two content scripts and the entry
point that registers them:

- an editor content script that adds `visimark()` and `visimarkLint()` from
  `codemirror-visimark` to Joplin's CodeMirror 6 editor;
- a viewer content script that calls `md.use(markdownItVisimark)` on Joplin's
  markdown-it renderer.

It reads one note at a time. `path` is null, there is no `readImport`, nothing
calls `joplin.data`, and the plugin has no settings. A note with a
`from x.csv` import gets the marks that read it withheld, which is what both
packages do without a reader. That keeps
[§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 4
with no hash binding: nothing outside the note can change what it computes.

## 2. The surface

### 2.1 The workspace package

A new workspace member, `editors/joplin`:

| Path | What it is |
|---|---|
| `package.json` | `"name": "joplin-plugin-visimark"`, `"private": true`, **no `version` field**, `"type": "module"`. Scripts: `"typecheck": "tsc --noEmit"`, `"build": "bun build.ts"`. Dependencies `visimark`, `codemirror-visimark` and `markdown-it-visimark`, each `workspace:*`. Dev dependencies `esbuild`, `@codemirror/state`, `@codemirror/view` and `markdown-it`, at the ranges other workspace members already use. No `engines` field. |
| `tsconfig.json` | Same pattern as `editors/obsidian/tsconfig.json`: `paths` resolve `visimark`, `codemirror-visimark`, `codemirror-visimark/lint` and `markdown-it-visimark` to their `src/`. |
| `src/manifest.json` | The Joplin manifest **without** `version` (§2.3). |
| `src/index.ts` | The plugin's entry point (§2.4). |
| `src/codemirrorContentScript.ts` | The editor content script (§2.4). |
| `src/markdownItContentScript.ts` | The viewer content script (§2.4). |
| `src/joplin.d.ts` | Hand-written ambient types for the part of the Joplin API the plugin calls: the `joplin` global, `plugins.register` and `contentScripts.register`. No Joplin typings package is added. |
| `src/visimark.css` | The one stylesheet (§2.5). |
| `build.ts` | The esbuild build and the packer call (§2.6). It exports `options` so the tests build exactly what ships. |
| `pack.ts` | The in-repo ustar writer (§2.7). |
| `test/` | `bundle.test.ts`, `pack.test.ts` and `content-scripts.test.ts` (§4). |
| `README.md` | Building, side-loading, what the plugin does, and its limits (§7). |

`dist/` is already ignored by the root `.gitignore`. `editors/joplin/publish/`
is added to `.gitignore` with the comment `# built by editors/joplin/build.ts;
a CI artifact, never committed`.

### 2.2 The command

```console
$ bun run --filter joplin-plugin-visimark build
```

The root `bun run build` builds it too, because it runs every workspace's
`build`. Output:

```
editors/joplin/dist/manifest.json
editors/joplin/dist/index.js
editors/joplin/dist/codemirrorContentScript.js
editors/joplin/dist/markdownItContentScript.js
editors/joplin/dist/visimark.css
editors/joplin/publish/com.visimark.joplin.jpl
```

### 2.3 The manifest

`src/manifest.json`, committed:

```json
{
  "manifest_version": 1,
  "id": "com.visimark.joplin",
  "app_min_version": "3.7.1",
  "name": "VisiMark",
  "description": "Marks every value a note computes in Joplin's editor and viewer, and flags the ones that no longer match their formula.",
  "author": "Michał Niedźwiedzki",
  "homepage_url": "https://github.com/michal-niedzwiedzki/visimark/tree/master/editors/joplin#readme",
  "repository_url": "https://github.com/michal-niedzwiedzki/visimark",
  "keywords": ["visimark", "markdown", "calculations", "formulas"],
  "categories": ["editor", "viewer"],
  "platforms": ["desktop"]
}
```

`build.ts` writes `dist/manifest.json` as this object plus
`"version": <packages/visimark/package.json version>`, inserted after `"id"`.
The engine's version is the only version the plugin carries. No committed file
gains a version, so `ci.yml`'s version-agreement step and
`scripts/prepare-release.ts` do not change.

**Why 3.7.1.** `codemirror-visimark` declares `@codemirror/state ^6.5.2` and
`@codemirror/view ^6.36.2`. Joplin's editor ships state 6.5.4 and view 6.39.9
from v3.7.1. Every 3.6 release ships view 6.35.0, below the peer floor. The
first stable 3.7 release is v3.7.16 (2026-09-06). Lowering the peer floors to
reach older Joplin versions is a non-goal (§8).

**The id.** `com.visimark.joplin` is 19 characters from `[0-9a-zA-Z._-]`,
starting and ending with a letter. That satisfies Joplin's manifest validator,
and the id was unused on 2026-10-12. It is not reserved anywhere, because
nothing is published.

### 2.4 The scripts

`src/index.ts`:

```ts
joplin.plugins.register({
  onStart: async () => {
    await joplin.contentScripts.register(
      "codeMirrorPlugin",
      "visimark-codemirror",
      "./codemirrorContentScript.js",
    );
    await joplin.contentScripts.register(
      "markdownItPlugin",
      "visimark-markdown-it",
      "./markdownItContentScript.js",
    );
  },
});
```

The string literals are the values of Joplin's `ContentScriptType` enum. The
enum is not imported, because it lives in Joplin's API source and not in a
package.

`src/codemirrorContentScript.ts`:

```ts
export default (_context: unknown) => ({
  plugin: (control: { cm6?: unknown; addExtension(ext: unknown): void }) => {
    if (!control.cm6) return; // the legacy CodeMirror 5 editor: do nothing
    control.addExtension([visimark(), visimarkLint()]);
  },
  assets: () => [{ name: "visimark.css" }],
});
```

`visimark()` takes its defaults: `path` null, no `readImport`,
`recompute: "debounced"`, no focusable marks. Highlighting
(`codemirror-visimark/highlight`) is not added. Joplin passes
`codeLanguages: lookUpLanguage` to `markdown()` itself and offers plugins no
way to add a language (§8).

`src/markdownItContentScript.ts`:

```ts
export default (_context: unknown) => ({
  plugin: (md: unknown) => markdownItVisimark(md),
  assets: () => [{ name: "visimark.css" }],
});
```

No options are passed, so `path` is null and there is no reader. Joplin
builds its markdown-it instance with `html: true`, which the plugin requires.

### 2.5 The stylesheet

`src/visimark.css`, served to both the editor and the viewer through the
content scripts' `assets`:

```css
/* VisiMark marks in Joplin. Computed values take their colour from the text,
   so light and dark themes need no rules of their own. */
.visimark-computed {
  text-decoration: underline dotted;
  text-decoration-color: color-mix(in srgb, currentColor 55%, transparent);
  text-underline-offset: 0.2em;
}
.visimark-disagrees {
  text-decoration: underline wavy;
  text-decoration-color: #e5484d;
}
@media print {
  .visimark-computed:not(.visimark-disagrees) {
    text-decoration: none;
  }
}
```

The disagree flag is a fixed red that reads on both light and dark
backgrounds. Following #373, it stays visible in print and PDF export, and
computed values export plain.

### 2.6 The build

`build.ts` runs esbuild three times. All three builds share these options:
`bundle: true`, `platform: "browser"`, `target: "es2020"`,
`minify: true`, `metafile: true`, and these aliases:

| Specifier | Resolves to |
|---|---|
| `visimark` | `packages/visimark/src/browser.ts` |
| `codemirror-visimark` | `packages/codemirror-visimark/src/index.ts` |
| `codemirror-visimark/lint` | `packages/codemirror-visimark/src/lint.ts` |
| `markdown-it-visimark` | `packages/markdown-it-visimark/src/index.ts` |
| `node:path` | `packages/codemirror-visimark/src/browser-path.ts` |

Each package resolves to its source rather than its `exports`, for the same
reason `editors/obsidian/esbuild.config.mjs` gives: the plugin must not ship a
stale `dist/`.

| Entry | Output | `format` | `external` |
|---|---|---|---|
| `src/index.ts` | `dist/index.js` | `iife` | none |
| `src/codemirrorContentScript.ts` | `dist/codemirrorContentScript.js` | `cjs` | `@codemirror/*`, `@lezer/*` |
| `src/markdownItContentScript.ts` | `dist/markdownItContentScript.js` | `cjs` | none |

The editor script's externals are what Joplin's `codeMirrorRequire` provides
to CodeMirror content scripts at run time: a second copy of CodeMirror would be
a second editor state. CommonJS output gives each content script the
`module.exports.default` shape Joplin loads. The entry point is a plain script
that uses the `joplin` global and touches no `module`, because Joplin documents
`module.exports` only for content scripts.

After the three builds, `build.ts` writes `dist/manifest.json` (§2.3), copies
`src/visimark.css` to `dist/`, and calls the packer.

### 2.7 The packer

`pack.ts` exports `ustar(entries: { name: string; bytes: Uint8Array }[]):
Uint8Array`. It writes a POSIX ustar archive: one 512-byte header per entry
(mode `0644`, uid and gid 0, mtime 0, typeflag `0`, magic `ustar\0`, version
`00`), the data padded to 512 bytes, and two zero blocks at the end. With
mtime fixed at 0, the same inputs give the same bytes. It has no dependency
and runs no process. `build.ts` writes the archive to
`publish/com.visimark.joplin.jpl` with entries in this order:

```
manifest.json
index.js
codemirrorContentScript.js
markdownItContentScript.js
visimark.css
```

### 2.8 CI

In `ci.yml`'s `build` job, right after the existing `visimark-vsix` upload:

```yaml
      - uses: actions/upload-artifact@v7
        with:
          name: visimark-joplin
          path: editors/joplin/publish/com.visimark.joplin.jpl
```

`bun run build` already runs earlier in that job, and `bun test` runs the
plugin's tests.

In `smoke-node` and `smoke-bun`, the markdown-it plugin step's loop becomes
`for v in 13.0.2 14.3.2 latest`. Each step's name becomes "… at 13.0.2, 14.3.2
and latest", and its comment gains: "13.0.2 is the markdown-it Joplin's
renderer pins (#378)." `scripts/markdown-it-smoke.mjs`'s header comment names
the three versions.

### 2.9 `markdown-it-visimark`'s supported floor

`markdown-it-visimark` is still unreleased (catalogue: `UNRELEASED`), so its
floor moves from 14.3.2 to **13.0.2** before it is ever published. No
published contract changes. The README's Compatibility section becomes:

> Supported from markdown-it 13.0.2 upward. CI tests 13.0.2, the version
> Joplin's renderer uses; 14.3.2, the version VS Code's built-in Markdown
> extension uses; and the latest release.

## 3. The machine contract

No CLI command, option, exit code, stream or `--json` shape changes, and the
composite Action does not change. The contract this spec adds is the build's:

| Condition | Exit | stdout / stderr | Artifact |
|---|---|---|---|
| `bun run --filter joplin-plugin-visimark build` succeeds | 0 | esbuild's info lines | `dist/` (5 files) and `publish/com.visimark.joplin.jpl` |
| any esbuild error, such as an unresolved import | non-zero | esbuild's error on stderr | none guaranteed |
| `packages/visimark/package.json` has no `version` | non-zero | stderr: `editors/joplin: packages/visimark/package.json has no version` | none |
| CI `build` job on any push or PR | job result | — | workflow artifact `visimark-joplin`, holding the `.jpl` |

## 4. Behaviour table

Automated checks, all run by the root `bun test`:

| # | Where | Check | Expected |
|---|---|---|---|
| A1 | `editors/joplin/test/bundle.test.ts` | Build all three entries in memory from `build.ts`'s exported `options`, with `metafile`. Every `metafile.inputs` key | none contains `node_modules/@codemirror/` or `node_modules/@lezer/` |
| A2 | same | Every `imports[].path` of every output | none starts with `node:` |
| A3 | same | External imports of `codemirrorContentScript.js` | every one matches `^@codemirror/` or `^@lezer/` |
| A4 | same | External imports of `index.js` and `markdownItContentScript.js` | none |
| A5 | `editors/joplin/test/pack.test.ts` | `ustar()` on two known entries, read back by a header parser in the test | names, sizes and bytes match; total length a multiple of 512; ends with two zero blocks; equal inputs give byte-identical output |
| A6 | same | Run `build.ts` into a temp directory and parse the `.jpl` | entry names exactly the five in §2.7, in that order |
| A7 | same | `manifest.json` inside the `.jpl` | `version` equals `packages/visimark/package.json`'s; `id` `com.visimark.joplin`; `app_min_version` `3.7.1`; `platforms` `["desktop"]`; `manifest_version` 1 |
| A8 | `editors/joplin/test/content-scripts.test.ts` | Import `src/markdownItContentScript.ts`, call `default({}).plugin(md)` on `new MarkdownIt({ html: true })`, render the fixture in `scripts/markdown-it-smoke.mjs` | output contains `class="visimark-computed"`, `data-vmark="s.total"`, `data-vmark="s.sub"`, `data-vmark-info="#s"` |
| A9 | same | Editor script, `plugin({ addExtension })` with no `cm6` | `addExtension` never called |
| A10 | same | Editor script, `plugin({ cm6: {}, addExtension })` | `addExtension` called once, with an array of two extensions |
| A11 | same | Both scripts' `assets()` | `[{ name: "visimark.css" }]` |
| A12 | `packages/markdown-it-visimark/test/host-options.test.ts` | Render the document below with `{ html: true }` plus each of `{}`, `{ typographer: true }`, `{ breaks: true }`, `{ linkify: true }` and all three together | see below |

A12's document:

````markdown
Label **Q3 -- "final"**<!--vmark=s.label--> and total **12.50**<!--vmark=s.total--> line
next line www.example.com

```vmark #s
label = "Q3 -- \"final\""
total precision 2 = 10 + 2.5
```
````

A12's expected output, as observed on 2026-10-13 against the current source:

- **Every combination:** contains
  `<strong class="visimark-computed" data-vmark="s.total">12.50</strong>` and
  `data-vmark-info="#s"`, and never contains `visimark-disagrees`.
- **Without `typographer`:** contains
  `<strong class="visimark-computed" data-vmark="s.label">Q3 -- &quot;final&quot;</strong>`.
- **With `typographer`:** contains `<strong>Q3 – “final”</strong>` and no
  `data-vmark="s.label"`. The rewritten value is left unmarked, as the
  README's "rewritten by another markdown-it plugin" rule says. It is never
  falsely flagged as disagreeing.

The test pins this behaviour. It is not a fix.

CI: the `smoke-node` and `smoke-bun` markdown-it steps print
`markdown-it-visimark ok` three times each (13.0.2, 14.3.2, latest) and
exit 0. The `build` job uploads `visimark-joplin`.

Manual checks, recorded in a new `docs/design/joplin-manual-test.md` in the
same style as `docs/design/obsidian-manual-test.md` ("record what you observe,
not what you expect"). They run in Joplin desktop ≥ 3.7.16 with the CI-built
`.jpl` installed through **Settings → Plugins → Install from file**:

| # | Scenario | Required |
|---|---|---|
| M1 | Install, restart, open any note | plugin listed as enabled; no error in **Help → Toggle development tools** |
| M2 | A note with the body of `docs/example-invoice-drift.md` | editor and viewer: every value the CLI reports `STALE` shows the wavy mark; the editor shows lint diagnostics |
| M3 | A note with the body of `docs/example-invoice.md` | editor and viewer: dotted marks only, no wavy mark, no diagnostics |
| M4 | A note with no `vmark` block, exported to HTML with the plugin enabled and then disabled | the two exports' note bodies are identical |
| M5 | M2's note in light and dark themes | both marks visible in both |
| M6 | M2's note exported to PDF | wavy marks visible; dotted marks absent |
| M7 | M2's note, Joplin's typographer setting on | numeric marks unchanged; quoted string values may be unmarked (A12) |
| M8 | M2's note opened in the Rich Text editor: make one unrelated edit, save, switch back, diff against the original | **recorded, not required.** If any `<!--vmark=…-->` anchor or `vmark` block changed, `editors/joplin/README.md` gains the limitation "Edit VisiMark notes in the Markdown editor: the Rich Text editor can drop the comments that bind values to formulas." |
| M9 | The viewer's DOM for M2's `vmark` block | **recorded, not required:** whether `data-vmark-info="#lines"` survives Joplin's fence rendering |
| M10 | The legacy editor, if this Joplin version still offers it | no error; no marks |

M1–M7 and M10 must pass before the implementation PR is merged. M8 and M9 are
recorded. The PR body says so. Promoting the PR out of draft on green CI does
not wait for them.

## 5. Compatibility

| Consumer | Before | After |
|---|---|---|
| `ci.yml` `build` job | uploads `visimark-vsix` | also uploads `visimark-joplin`; `bun run build`, `typecheck`, `lint`, `format:check` and `test` now cover `editors/joplin` |
| `ci.yml` version-agreement step | 24 fields | unchanged: `editors/joplin` carries no version |
| `ci.yml` `node-support-policy` | 6 manifests | unchanged: `editors/joplin` is private and runs in Joplin's Electron |
| `ci.yml` `pack`, `smoke-node`, `smoke-bun` | markdown-it at 14.3.2 and latest | adds 13.0.2; nothing new packed |
| `release.yml`, `scripts/prepare-release.ts`, `docs/releasing.md` | — | unchanged; nothing new is published |
| `.github/workflows/dogfood.yml`, the composite Action, `docs/ci.md` | — | unchanged |
| `editors/obsidian`, `editors/vscode`, the playground | consume `codemirror-visimark` / `markdown-it-visimark` source | unchanged |
| `bun.lock` | — | gains an `editors/joplin` workspace entry with no `version` |

Nothing breaks, so there is no migration note. Everything is reversible
without a release: delete `editors/joplin`, the artifact step and the 13.0.2
smoke legs.

## 6. Interaction with the rest of the tooling

- **`codemirror-visimark`**: consumed as is, with no option or export added. Its
  peer floors are unchanged, and they set `app_min_version`.
- **`markdown-it-visimark`**: consumed as is. Only its documented floor
  changes (§2.9), plus the A12 test.
- **The engine**: unchanged. The plugin bundles `packages/visimark/src/browser.ts`.
- **The runtime-parity rule**: unchanged. It covers published packages, and
  this one is private with no `bin`.
- **The review workflow and issue templates**: unchanged.
- **CLI, LSP, VS Code extension, MCP server**: unchanged.

## 7. Documentation to update

The plan's final task, verbatim:

1. `editors/joplin/README.md` (new): what the plugin does, how to get the
   `.jpl` (the `visimark-joplin` artifact of a CI run on `master`, or build it
   locally), how to install it (**Settings → Plugins → Install from file**),
   desktop only, Joplin ≥ 3.7.1, and the limits: no imports, no `vmark`
   highlighting, no settings, plus the Rich Text line if M8 failed.
2. `docs/design/joplin-manual-test.md` (new): the M1–M10 scenarios and a
   *Recording* section for results.
3. `CONTRIBUTING.md`: a section **Building the Joplin plugin and side-loading
   it**, after the Obsidian one. It covers the build command, the `.jpl` path,
   install from file, and that `bundle.test.ts` enforces no bundled CodeMirror
   and no `node:` import.
4. `README.md`: after the `markdown-it-visimark` paragraph, one paragraph
   saying the Joplin plugin wires both packages into Joplin desktop, is not
   published, and is installed from a CI build. Link `editors/joplin/README.md`.
5. `docs/visimark-editor-plugins-design.md` §1: one paragraph saying
   `editors/joplin` is a client of the two published packages rather than of
   the engine or the server, and carries no version of its own.
6. `packages/markdown-it-visimark/README.md`: the Compatibility text in §2.9.
7. `scripts/markdown-it-smoke.mjs`: the header comment (§2.8).
8. `.gitignore`: `editors/joplin/publish/` (§2.1).
9. `CHANGELOG.md`, under `## Unreleased` → `### Added`: a Joplin plugin
   entry (build-only, side-loaded, desktop, Joplin ≥ 3.7.1, #378). In the
   existing `markdown-it-visimark` entry, add one sentence: "Supported from
   markdown-it 13.0.2, the version Joplin uses."
10. `docs/vocabulary-catalogue.md`: move the #378 row from section F into the
    Shipped register as `UNRELEASED` (Landed = the implementation PR,
    Released = `—`, Decision = the deciding comment).

Not touched: `docs/releasing.md`, `docs/distribution.md`,
`.agents/rules/runtime-parity.md`, `docs/cli-reference.md`, `docs/ci.md`,
`.github/ISSUE_TEMPLATE/`, `editors/vscode/CHANGELOG.md`.

## 8. Non-goals

> #384 took up plugin settings, commands and a findings panel with a notebook
> sweep. See
> [`chore-bring-joplin-plugin-visimark-to-spec.md`](chore-bring-joplin-plugin-visimark-to-spec.md).

- Publishing to npm or to Joplin's plugin repository, the `publish/*.json`
  file, and any `release.yml` leg. That is a later issue, which re-opens the
  version fields, `engines.node` and the unverified Joplin listing.
- `vmark` block highlighting. It needs either a push into Joplin's shared
  `@codemirror/language-data` `languages` array, which depends on Joplin
  internals, or a plugin hook from Joplin (an upstream request).
- Imports, including Joplin attachments as `from x.csv`. That needs its own
  issue.
- Mobile.
- Plugin settings of any kind.
- Fixing the Rich Text editor round trip.
- Lowering `codemirror-visimark`'s peer floors to reach Joplin before 3.7.1.
- Marking values that markdown-it's `typographer` rewrote.

## 9. Open questions

None.

<!--vmark:no-formulas-->
