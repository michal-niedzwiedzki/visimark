# markdown-it-visimark — feature spec

**Status:** approved (#373) · **Date:** 2026-10-12 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/373#issuecomment-6123728493

## 1. Purpose

VisiMark already marks computed values in CodeMirror (`codemirror-visimark`) and in Obsidian's reading view. A markdown-it render has neither. The VS Code Markdown preview is markdown-it, so a document open in preview shows the numbers and hides which of them the sheet computed and which of them no longer match.

This spec adds `packages/markdown-it-visimark`, a published package whose default export is a markdown-it plugin. The plugin runs the engine once over the source and writes the same classes and `data-vmark*` attributes the editor package writes. Anchor comments stay in the HTML, so a later host can still see them. The VS Code extension adopts the plugin for its built-in preview.

The package ships no stylesheet. A host that wants the underline the editor README suggests copies two CSS rules. The VS Code extension contributes those two rules to the preview.

This is a tooling change, catalogued in [`docs/vocabulary-catalogue.md`](../vocabulary-catalogue.md) section F. It follows [§1](../visimark-design.md#1-purpose): the rendered view shows which numbers are computed and which disagree. [§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 4 holds because the one host callback returns the text of a file and nothing else. A host with no callback gets imports withheld, not guessed.

No document syntax, evaluation, finding, write-back, CLI option, exit code, or `--json` shape changes.

## 2. The surface

### 2.1 The package

`packages/markdown-it-visimark` is an npm package named `markdown-it-visimark`. The name was free on 2026-10-12 (`npm view` returned 404).

The manifest matches `packages/codemirror-visimark/package.json` on the points that are the same kind of package:

| Field | Value |
|---|---|
| `version` | The engine version. The package bundles the engine and does not depend on the published `visimark` package. |
| `license` | `MIT` |
| `author` | `Michał Niedźwiedzki <michal@epsi.pl>` |
| `repository.directory` | `packages/markdown-it-visimark` |
| `type` | `module` |
| `files` | `dist`, `README.md`, `LICENSE` |
| `engines.node` | `>=24` |
| `exports["."]` | `types` → `./dist/index.d.ts`, `default` → `./dist/index.js` |
| keywords | `markdown-it-plugin`, `markdown-it`, `markdown`, `visimark` |
| `bin` | Absent. There is no launcher and no `node` shebang in a `bin` slot. |
| runtime dependencies | None. No `markdown-it`, no `visimark`, no `codemirror-visimark`. |
| `peerDependencies` | None. |
| `devDependencies` | `markdown-it` at the current 15.x, `markdown-it-footnote` 4.x and `@happy-dom/global-registrator`, for the package's own tests. |
| `prepublishOnly` | `bun run typecheck && bun test && bun run build` |

The build bundles three things into `dist/`:

- the engine from `packages/visimark/src/browser.ts`, the browser-safe entry;
- `decorationsFor` from `packages/codemirror-visimark/src/decorations.ts` and `importDependentNames` from `packages/codemirror-visimark/src/import-deps.ts`, compiled from source;
- a `node:path` shim (section 2.6) in place of the builtin.

`dist/` contains no `node:` specifier. A test asserts that, the same way `packages/codemirror-visimark/test/bundle.test.ts` does. There is no runtime import of the published editor package, so a second copy of "which values are marked" is not written here.

`packages/*` is already a workspace. The root `package.json` `workspaces` array does not change.

### 2.2 Plugin options

The default export is the plugin. Both of these are legal:

```js
md.use(markdownItVisimark)
md.use(markdownItVisimark, options)
```

```ts
/**
 * Read one absolute path the engine's gate has already accepted.
 * Return the file's UTF-8 text, or null when the read does not happen.
 * Synchronous. codemirror-visimark's `ReadImport` is the asynchronous one.
 */
export type ReadImportSync = (path: string) => string | null;

export interface MarkdownItVisimarkOptions {
  /** Filesystem path of the document being rendered, or null when it has none. */
  path?: (env: unknown) => string | null;
  readImport?: ReadImportSync;
}
```

Omitted `path` means `() => null`. Omitted `readImport` means imports are withheld. The option keeps the name `readImport` in both packages, because it means the same thing in both. The exported type is `ReadImportSync`, so a caller that imports both packages sees the sync/async difference in the type name. The two packages do not share a type. The README says this one is synchronous and the editor package's is asynchronous.

The public exports are the default export (the plugin), `MarkdownItVisimarkOptions` and `ReadImportSync`. Nothing else.

`env` is the object the host passes to the **render** call — `md.render(source, env)`, or `md.renderer.render(tokens, options, env)` when the host parses and renders separately, as VS Code does (section 2.6). The plugin does not read a fixed key on it. VS Code's key is one host's convention (section 2.7).

No short forms. There is no usage error and no refusal message. An option that throws is section 3.

### 2.3 What gets a mark

`decorationsFor(model, result)` is the list. The plugin does not invent a second list.

A mark is a computed column cell, or an anchor whose value is not an image and whose comment is not in `result.refusedAnchors`. `DATE`, `UNDEF`, `VECTOR`, and `CYCLE` do not remove a mark. A finding removes nothing from the list except by the two rules below.

`visimark-disagrees` is added only when a `STALE` finding's span is exactly the decoration's span. Matching is by span, the same `start:end` key `decorations.ts` uses. A name anchored twice can disagree in one place.

Import-dependent names come from `importDependentNames(model)`. The plugin withholds them (no class, no `data-vmark*`) when either of these is true:

- this render has no document file (no `readImport`, or `path(env)` returned null);
- `check` reported any finding whose code is `IMPORT`.

One `IMPORT` withholds every import-dependent name, which is what `codemirror-visimark`'s snapshot pass does. Names that do not depend on an import are still marked.

### 2.4 Attributes on a mark

The plugin sets these on the element that carries the mark, in this order, through markdown-it's `attrSet` on a token the plugin rendered from (section 2.6 says which tokens those are):

| Order | Attribute | When |
|---|---|---|
| 1 | `class` | Always. `visimark-computed`, plus `visimark-disagrees` when section 2.3 says so. |
| 2 | `data-vmark` | Always. The decoration's qualified name (`s.total`, `s.Net`). |
| 3 | `data-vmark-row` | Cells only. The decoration's `row` as a decimal integer with no padding. |
| 4 | `data-vmark-path` | Only when `path(env)` returned a string. The string, unchanged. |

`column` and `anchorKind` choose the element. They are not attributes. `data-vmark-path` is not written on the fence.

markdown-it's renderer escapes attribute values with `escapeHtml`: `&`, `<`, `>`, and `"` become `&amp;`, `&lt;`, `&gt;`, and `&quot;`. `'` is not escaped and needs no escape inside a double-quoted attribute. A `<span>` the plugin adds is a token too (type `visimark_open` / `visimark_close`, tag `span`), rendered by markdown-it's default `renderToken`, so it uses that same escape.

Where the mark sits in the rendered tree. `anchorKind` takes the engine's `AnchorTargetKind` values:

| Decoration | Where the attributes go |
|---|---|
| Anchor whose `anchorKind` is `strong` or `emphasis` | On the `strong_open` or `em_open` token, so on `<strong>` or `<em>`. The empty text token between the closing mark and the comment is not an element and is not wrapped. |
| Anchor whose `anchorKind` is `inlineCode` | On the `code_inline` token, so on `<code>`. |
| Anchor whose `anchorKind` is `text` | The preceding text token is split. Only the value is wrapped in `<span>`. The comment stays where it was. |
| Cell | The nth `tr` in `tbody` is model row n. The nth `td` in that row is the decoration's `column`. `thead` is the header and is never marked. The cell's inner HTML is wrapped in one `<span>`. The `<td>` keeps its own attributes, including `style="text-align:right"`. |

An anchor is found by its comment. Inside the inline token whose `map` covers the comment's source line, the kth `html_inline` token that is a `<!--vmark=…-->` comment is the kth anchor comment the engine located on that line. The value is the token range that ends right before that comment.

A computed cell whose source is `**10.00**` renders as `<td …><span class="visimark-computed" …><strong>10.00</strong></span></td>`. The `<strong>` does not also receive the class.

A rendered table is paired with a model table when its `table_open.map[0]` is the source line of that table's span; a table token with no `map` is not marked. A table the engine read from a CSV has no source and is never paired. A table separated from its fence by anything but blank lines is not the sheet's table at all — [§3](../visimark-design.md#3-document-model)'s table association makes that a `SHEET` error — so there is no decoration to place, and that case needs no rule here.

A decoration is placed only where the rendered text matches the source: the split-off suffix of a text token, the text between a `strong_open`/`em_open` and its close, a `code_inline` token's content, or a cell's `inline` content must equal the source text of the decoration's span (for a cell and for inline code, after markdown-it's own trimming). A decoration the mapper cannot place is skipped. The other marks and `data-vmark-info` still apply. The plugin does not throw for a miss.

### 2.5 The fence attribute

A fence token is a VisiMark fence when the first whitespace-delimited word of `token.info` is exactly `vmark`. `data-vmark-info` is the rest of `token.info` after that word and the whitespace that follows it. When `token.info` is exactly `vmark`, the value is empty. The wrapper adds nothing when the render's `options.html` is false (section 2.8).

markdown-it 15 gives `token.info` as the full info string. For a fence opened with `` ```vmark #order from rows.csv labelled Item, Qty ``, `token.info` is `vmark #order from rows.csv labelled Item, Qty` and `data-vmark-info` is `#order from rows.csv labelled Item, Qty`.

The plugin wraps `renderer.rules.fence` at `md.use` time, calls the renderer it replaced, and inserts `data-vmark-info` into the first opening `<pre` or `<code` tag of that HTML. Insertion uses the same `escapeHtml` as section 2.4. An opening tag that already has attributes gains this one before `>`, separated by a space. A tag that already has `data-vmark-info` is left as the previous renderer wrote it.

This is what keeps the attribute when a highlight callback returns a full `<pre>…</pre>` and markdown-it then drops `token.attrs`. A highlight result whose first tag is neither `<pre` nor `<code` is returned unchanged.

A plugin used after this one that replaces `renderer.rules.fence` without calling the previous rule drops `data-vmark-info`. That is `md.use` order.

The attribute is written for every VisiMark fence, including a fence that produced no marks. A document that contains a `vmark` fence is therefore not byte-identical to markdown-it alone.

### 2.6 Engine pass, reader, and path shim

The plugin does its work in two places, because a markdown-it host may parse and render separately, with **different** `env` objects and with the token stream cached in between. VS Code does exactly that (`extensions/markdown-language-features/src/markdownEngine.ts`): it parses with an `env` whose `currentDocument` is `undefined`, caches the tokens per document version in its `TokenCache`, and passes `currentDocument` only to `renderer.render`. An engine pass inside a core rule would therefore never see the document's path in VS Code — imports would always be withheld and `data-vmark-path` never written — and any mark written into the tokens would be baked into a cache the next render reuses.

1. **Core rule — records the source.** `md.core.ruler.push("visimark", …)` stores `state.src` in a module-level `WeakMap` keyed by the `state.tokens` array. It runs no engine code and changes no token. Pushed last, it sits after `inline`, `linkify`, the typographer rules and `text_join`, as the deciding discussion asked; VS Code's outline, folding and link features tokenize through the same instance, and this keeps that cheap.
2. **Render wrapper — applies the marks.** The plugin replaces `md.renderer.render` with a wrapper. It looks up the source for the `tokens` it was handed. No entry (the tokens did not come from this instance's parse), `options.html` false, or no `vmark` fence in the model: it calls the original `render` unchanged. Otherwise it runs the engine (with the cache below), computes `decorationsFor`, and renders a **copy** of the token stream: the top-level array is copied, each touched `inline` token is cloned with a new `children` array, each touched child token is cloned with its own `attrs` array, and the `visimark_open` / `visimark_close` tokens are new. The tokens the host passed in, and so the host's cache, are never mutated. Two renders of the same cached tokens give the same HTML.

By the time the wrapper runs, every core rule, including those of plugins used after this one, has finished. A plugin that changed tokens so that a decoration cannot be placed (section 2.4) leaves that value unmarked. A decoration is never placed on a token that does not match it. Tests cover the default render, `typographer: true`, `linkify: true`, and `markdown-it-footnote`.

**One cache entry.** The engine result is cached in the plugin's closure (one per `md.use` call), keyed on the pair (source text, `path(env)` result). A render with the same pair reuses it; any other pair replaces it. A render whose `readImport` is set re-reads nothing on a cache hit, so an edit to an imported CSV shows on the next render after the document text or path changes, or after the host makes a new instance (VS Code's `markdown.api.reloadPlugins`). Nothing is stored on the shared `md` instance or on `env`. VS Code uses one instance for every open preview, so a cache on `md` would show one document's marks on another.

`check` receives a document file only when both `readImport` is set and `path(env)` returned a string. Otherwise `check` is called with no `doc`, imports are skipped, and no `IMPORT` finding is produced. The import root is the directory of that path. The engine's `gatePath` is the gate: relative `.csv` only, no absolute path, no escape of the document directory. `readImport` is called with the absolute path the gate returned, not with the relative text from the fence.

The `ReaderPort` is the engine's own `memoryReader` (exported by `packages/visimark/src/browser.ts`) over `readImport`, with each path's answer memoized for the one engine pass so a file is read once even though the gate and the import phase ask more than once. `memoryReader` hashes with the engine's synchronous `sha256Hex`, so the bundle carries no `node:crypto` and the plugin writes no reader and no hash of its own.

`memoryReader`'s `realpath` returns its input, so the gate's symlink-escape check does not see a link. The plugin does not open with `O_NOFOLLOW`. A host that must not follow a symlink returns null from `readImport` for that path. The engine then reports `IMPORT` (`imported file not found`), and section 2.3 withholds import-dependent marks. This is the specified behaviour. The VS Code host does that refusal itself (section 2.7).

The published bundle replaces `node:path` with a local shim, `packages/markdown-it-visimark/src/browser-path.ts`, that exports the four names `gate.ts` imports: `dirname`, `isAbsolute`, `resolve`, and `sep`. Unlike `codemirror-visimark`'s POSIX-only shim (Obsidian hands it vault paths), this one receives real host paths, so it accepts an absolute POSIX path and an absolute Windows path with a drive letter (`C:\notes\note.md` and `C:/notes/note.md`). `isAbsolute` is true for both. `sep` is a single constant the gate's `contains` reads, so it cannot follow the path: it is `/`, and a drive-letter path is normalised to `/` separators instead. `dirname` and `resolve` on a drive-letter path return what `node:path.win32` returns with every `\` replaced by `/` (`resolve("C:\\notes", "sub\\rows.csv")` is `C:/notes/sub/rows.csv`), and agree with `node:path.posix` on every other path the tests feed them. `readImport` therefore receives `C:/notes/rows.csv` on Windows, which every Windows file API accepts; the README says so. A relative `path()` result is resolved against `/`, the same fallback as `codemirror-visimark`'s shim. The VS Code extension does not use this shim: it bundles the plugin from source for Node, where `node:path` is the real module.

The shim is tested against those two Node path modules on the calls the gate makes: `dirname(resolve(doc.path))`, `resolve(base, "rows.csv")`, `isAbsolute`, and `sep`.

### 2.7 The VS Code extension

`editors/vscode` contributes:

```json
"markdown.markdownItPlugins": true,
"markdown.previewStyles": ["./media/preview.css"]
```

`media/preview.css` is only these two rules, copied from the editor package's README:

```css
.visimark-computed { text-decoration: underline dotted; }
.visimark-disagrees { text-decoration-color: red; }
```

`.visimark-disagrees` also carries `.visimark-computed`, so the second rule colours the same dotted underline.

A new setting:

| Setting | Type | Default | Effect |
|---|---|---|---|
| `visimark.preview.enable` | boolean | `true` | When false, the preview plugin is not applied. |

`visimark.enable` stays the language-server switch. It does not gate the preview. The preview setting does not gate the language server.

`activate` keeps starting the language client and returns `{ extendMarkdownIt }`. An async `activate` returns a promise of that object. VS Code awaits activation before it calls `extendMarkdownIt`. The extension keeps the activation event `onLanguage:markdown` and does not add a second one. The relied-on host behaviour is the one in VS Code's markdown-extension document: an extension that contributes `markdown.markdownItPlugins` is activated when a preview is shown, and `extendMarkdownIt` runs only after `activate` resolves. The first preview is marked. A host that rendered before that await would show an unmarked preview until refresh. This extension does not add a workaround for that host.

`extendMarkdownIt` reads `visimark.preview.enable` on each call, not only during `activate`. When the setting is false, `extendMarkdownIt` returns `md` without calling `md.use`, so the preview is the unmarked markdown-it output, fences included.

VS Code calls `extendMarkdownIt` only when it builds its markdown-it instance, and it keeps that instance until its contributions change. Reading the setting there alone would not reach an open preview. So the extension also registers `vscode.workspace.onDidChangeConfiguration`, and when `e.affectsConfiguration("visimark.preview.enable")` it runs the built-in command `markdown.api.reloadPlugins`. That command drops the instance and the token cache and refreshes every open preview (`extensions/markdown-language-features/src/commands/reloadPlugins.ts`). A toggle therefore shows on the next render of every open preview without a window reload. A failure of that command is caught and ignored; the next instance VS Code builds still reads the setting.

When the setting is true, the options are:

- `path(env)` reads `env.currentDocument`, which VS Code sets on the render `env` (section 2.6). When that value is a `file`-scheme `Uri`, the path is its `fsPath`. When `env` is missing, the property is missing, or the scheme is not `file`, the path is null and imports are withheld. The adapter does not throw on a missing property.
- `readImport(absolutePath)` uses `fs.lstatSync`. When the final path is a symbolic link, it returns null and does not read. Otherwise it uses `fs.readFileSync(absolutePath, "utf8")` and returns the string. Any error returns null.

The import root is the previewed file's directory. The deciding discussion asked for the file's workspace folder (or the file's directory outside every folder), chosen to match the language server's root. Both halves of that reduce to the file's directory:

- The language server has no import root to match. It calls `analyze(text)` with no document file (`packages/visimark-lsp/src/analysis.ts`), so it reads no import today. That stays unchanged here; the preview is the first VS Code surface that reads imports.
- The engine's `gatePath` already confines every import, lexically, to the document's own directory, which lies inside its workspace folder. A lexical workspace-folder check in the adapter could never refuse a path the gate has let through, so it is not written.

What neither check sees is a symlinked **intermediate** directory (`rows/` linking out of the tree): `memoryReader`'s `realpath` is identity, and `readImport` refuses only a link at the final component. That is the same limit the playground and Obsidian hosts carry. Here it reveals no file content — the preview shows only whether values are computed or disagree — and it is accepted and stated in the extension README.

Untitled documents and non-file schemes have no path, so imports are withheld.

The extension does not declare `capabilities.untrustedWorkspaces`. In Restricted Mode it does not activate. The preview stays unmarked and no read runs.

`editors/vscode/dist/extension.js` carries a second copy of the engine. The language server already carries one. That is accepted. The browser-bundle size ceiling (#191) stays where it is. This package gets no new ceiling.

### 2.8 `html: true` is required

With `html: true`, markdown-it 15 leaves `<!--vmark=s.total-->` as a comment token. With `html: false` it escapes the comment to text and there is no `html_inline` token. The plugin requires `html: true`. With `html: false` it changes nothing: the output equals markdown-it without the plugin, byte for byte, and nothing is marked. The VS Code preview runs with HTML enabled.

### 2.9 Pre-review forks

Each open question from the pre-review on #373 is settled as follows.

| Fork | Settlement |
|---|---|
| 1 | Section 2.4 and 2.8. `html: false` is unchanged. Anchors are found by their comment, in order, inside the inline token covering their line. Strong, emphasis and inline code take the attributes on the element; bare text is split and wrapped in `<span>`. Cells wrap inner HTML. A table separated from its fence is a `SHEET` error with nothing to mark. |
| 2 | Section 2.6 and 2.7. The root is the file's directory; section 2.7 says why the discussion's workspace-folder root reduces to it. Untitled and non-file paths withhold imports. Restricted Mode does not activate the extension. |
| 3 | Section 2.6. A single-entry cache keyed on (source, path), held in the plugin's closure, never on `md`. |
| 4 | Section 2.4 and 2.5. Acceptance round-trips `"`, `<`, `&`, and `'`. |
| 5 | Section 2.2. `path(env) => string \| null`, default `() => null`, read from the render `env`. |
| 6 | Section 2.4. `data-vmark-path` is emitted when `path` returns a string. |
| 7 | Section 2.2. The option keeps the name `readImport`; its type is exported as `ReadImportSync`. |
| 8 | Section 2.6. `md.core.ruler.push("visimark")` records the source; marks are applied at render time, after every core rule. Tests cover default, typographer, linkify, and `markdown-it-footnote`. A value another plugin has rewritten is left unmarked. |
| 9 | Section 2.1 and 2.3. Marks come from `decorationsFor`, bundled from source. |
| 10 | Section 2.5. Overridden by the deciding comment: `data-vmark-info` ships now, injected into the first opening tag of the rendered fence. |
| 11 | Section 2.3. A mark follows `decorationsFor`. Only an exact `STALE` span adds `visimark-disagrees`. The README states the rule. |
| 12 | Section 2.1 and 4. Floor `markdown-it@14.3.2`, the version VS Code's built-in Markdown extension locks today; the other leg runs `markdown-it@latest`. No peer dependency. |
| 13 | Section 2.7. The second engine copy is accepted. No new size ceiling. |
| 14 | Section 2.7. New setting `visimark.preview.enable`, default true, applied to open previews through `markdown.api.reloadPlugins`. `activate` returns `{ extendMarkdownIt }`. |
| 15 | Section 4. |

## 3. The machine contract

The package is a library. It does not start a process, write stdout or stderr, return an exit code, or emit `--json`. The CLI's exit codes stay `0` clean, `1` findings, `2` usage. No new code is added.

The only result is the string `md.render` returns.

| Condition | What `md.render` returns |
|---|---|
| `html: false` | Byte-identical to the same markdown-it without this plugin. |
| No `vmark` fence and no decoration placed | Byte-identical to markdown-it without this plugin. |
| A `vmark` fence | That fence's first opening tag carries `data-vmark-info`. The rest of an unmarked document is unchanged. |
| A decoration the mapper placed | The element in section 2.4 carries the attributes in section 2.4. |
| A decoration withheld or unplaced | That value's HTML is markdown-it's own. |
| `locate`, `build`, or `check` throws | The render wrapper catches it and renders the host's tokens unchanged. The fence wrapper still adds `data-vmark-info` when the fence renderer succeeds. |
| `readImport` or `path` throws | The render wrapper catches it and renders the host's tokens unchanged. Same fence rule as the row above. |
| The same tokens rendered twice (a host token cache) | The same string both times. The host's tokens are not mutated. |
| VS Code setting `visimark.preview.enable` is false | The plugin is not applied. The preview equals VS Code's unmarked preview. Toggling it refreshes open previews through `markdown.api.reloadPlugins`. |

The engine's own `check` of a file is unchanged. The fixture in section 4 is clean, and the one-cell edit is one `STALE`. Those are facts about the fixture, not a new CLI result.

## 4. Behaviour table

The fixture below is the acceptance document. It has one anchor of each prose kind the mapper handles — strong, bare text, and inline code — in the same paragraph, plus one computed column. It lives at `packages/markdown-it-visimark/test/fixtures/three-anchors.md`. `bun run packages/visimark/src/cli/main.ts check` on it, run on 2026-10-12, exits 0 and prints (after the file name line):

```text
  0 problems (0 stale, 0 errors)
```

The same file with the Net cell changed from `10.00` to `9.00` exits 1 and prints:

```text
  STALE   s.Net           · pen                        9.00 ≠ 10.00      Qty * 5

  1 problem (1 stale, 0 errors)
```

The fixture:

````markdown
Total **12.50**<!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax `2.50`<!--vmark=s.tax-->.

| Item | Qty | Net |
|------|----:|----:|
| pen  |  2  | 10.00 |

```vmark #s
Net precision 2 = Qty * 5
sub precision 2 = SUM(Net)
tax precision 2 = sub * 0.25
total precision 2 = sub + tax
```
````

markdown-it 15.0.2 with `html: true` and without the plugin renders that source as this string (the final newline is part of it):

```html
<p>Total <strong>12.50</strong><!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax <code>2.50</code><!--vmark=s.tax-->.</p>
<table>
<thead>
<tr>
<th>Item</th>
<th style="text-align:right">Qty</th>
<th style="text-align:right">Net</th>
</tr>
</thead>
<tbody>
<tr>
<td>pen</td>
<td style="text-align:right">2</td>
<td style="text-align:right">10.00</td>
</tr>
</tbody>
</table>
<pre><code class="language-vmark">Net precision 2 = Qty * 5
sub precision 2 = SUM(Net)
tax precision 2 = sub * 0.25
total precision 2 = sub + tax
</code></pre>
```

With the plugin, `html: true`, and `path` returning null, that HTML changes in exactly these places, and the test compares the whole string:

- the paragraph is `<p>Total <strong class="visimark-computed" data-vmark="s.total">12.50</strong><!--vmark=s.total-->, subtotal <span class="visimark-computed" data-vmark="s.sub">10.00</span><!--vmark=s.sub--> and tax <code class="visimark-computed" data-vmark="s.tax">2.50</code><!--vmark=s.tax-->.</p>`;
- the Net cell is `<td style="text-align:right"><span class="visimark-computed" data-vmark="s.Net" data-vmark-row="0">10.00</span></td>`;
- the fence opens with `<pre data-vmark-info="#s">`.

The Qty cell, the prose between the values, the three comments, and the fence body stay as markdown-it wrote them. `data-vmark-path` is absent.

The same render with `path` returning `/tmp/note.md` adds `data-vmark-path="/tmp/note.md"` as the last attribute of each of the four marks. The `<pre>` does not gain `data-vmark-path`.

The stale variant (`9.00`) uses `class="visimark-computed visimark-disagrees"` on the Net span. The three prose marks stay `visimark-computed` only.

`html: false`, with or without the plugin, is the unmarked string above except each comment is escaped, `&lt;!--vmark=s.total--&gt;` and so on.

A fence whose info string is `vmark #s "a<b>&'"` renders `data-vmark-info="#s &quot;a&lt;b&gt;&amp;'&quot;"`, and reading that attribute back with an HTML parser (`@happy-dom/global-registrator`, a devDependency here as it is in `codemirror-visimark`) gives `#s "a<b>&'"`.

Further acceptance, each with an assertion:

| Case | Assertion |
|---|---|
| `docs/example-invoice-drift.md`, `html: true` | The number of `visimark-disagrees` elements equals the number of decorations whose span is exactly a `STALE` span. The count is computed by the test from `check` and `decorationsFor`. It is not a hardcoded 22. A value suppressed upstream has no `STALE` span and gains no `visimark-disagrees`. The README's marking-under-errors paragraph (section 7) describes exactly this rule. |
| A clean example document (`docs/example-invoice.md`) | Zero `visimark-disagrees`; at least one `visimark-computed`. |
| `docs/example-invoice-csv-import.md` without `readImport`, and again with `path` null | Every decoration whose name is in `importDependentNames` is absent (no class, no `data-vmark`). Other decorations are present. |
| The same file with `path` set and `readImport` returning the CSV the fence names | Those import-dependent decorations are present. A null return from `readImport` withholds them again and does not throw. |
| Parse with one `env`, render with another (VS Code's shape: `md.parse(src, {})`, then `md.renderer.render(tokens, md.options, { currentDocument })`) | `path` is called with the render `env`; `data-vmark-path` and import-dependent marks follow it. |
| The same token array rendered twice | Identical strings. The token array and every token in it are deep-equal to a snapshot taken before the first render. |
| Two documents rendered alternately on one `md` instance | Each render's marks are only that document's. |
| The same (source, path) rendered twice in a row | The engine runs once (a counting `readImport` is called on the first render only). A changed source or a changed path runs it again. |
| Default, `typographer: true`, `linkify: true`, and `md.use(markdownItFootnote)` before and after the plugin | The fixture's four marks and `data-vmark-info="#s"` still land. |
| An unrelated table earlier in the document, before the sheet's table | The Net mark lands in the sheet's table only; the earlier table has no mark. |
| A document with no `vmark` fence | Byte-identical to markdown-it without the plugin. |
| `dist/` | No `node:` specifier. |
| Packed tarball under `smoke-node` and `smoke-bun` | Imports, renders the fixture, and sees `visimark-computed`, `data-vmark="s.total"`, `data-vmark="s.sub"`, and `data-vmark-info="#s"`, once against `markdown-it@14.3.2` and once against `markdown-it@latest`. |

`scripts/markdown-it-smoke.mjs` is that packed-tarball script. It sits beside `scripts/codemirror-smoke.mjs`. The smoke jobs install the tarball, then each markdown-it version in turn, and run the script. They do not use the workspace copy.

The VS Code side has a manual test, recorded in `editors/vscode/README.md`'s development notes the way the extension's other manual checks are: open `docs/example-invoice-drift.md`, open the preview to the side, and see the stale values flagged on the **first** render with no refresh; set `visimark.preview.enable` to false and see the marks disappear from the open preview without reloading the window; set it back and see them return.

## 5. Compatibility

No existing CI job, script, or composite Action invocation changes its result. `docs/ci.md`'s current recipes, `dogfood.yml`, and `action.yml` stay as they are. A document that passes `visimark check` today still passes. `fmt` output is unchanged.

What gains a step:

| Surface | Before | After |
|---|---|---|
| `.github/workflows/ci.yml` version agreement | Twenty-two files and fields. | Twenty-four. The new pair is `packages/markdown-it-visimark/package.json` `version` and the matching `bun.lock` workspace `version`. Own version only, the same reason `codemirror-visimark` joins on its version alone. |
| `ci.yml` pack and smoke | Packs `codemirror-visimark` and copies `codemirror-smoke.mjs` into `smoke-node` and `smoke-bun`. | Also packs `markdown-it-visimark`. The artifact glob is `markdown-it-visimark-*.tgz`, which does not match `visimark-*`. Both smoke jobs run `scripts/markdown-it-smoke.mjs`. |
| `scripts/prepare-release.ts` | Seven manifests. The comment and `scripts/prepare-release.test.ts` say so. | Eight. The new entry does not pin `visimark`. |
| `.github/workflows/release.yml` | Publishes `codemirror-visimark` with a skip-if-present leg, a dry-run line, and a post-publish `npm view`. | The same three for `markdown-it-visimark`, after the CodeMirror leg. It pins no engine package, so it has no order constraint against the engine publish. |
| VS Code extension | Preview is unmarked markdown-it. `activate` returns `Promise<void>`. | Preview is marked when `visimark.preview.enable` is true (the default). Users who do not want marks set that to false. `visimark.enable` still gates only the language server. |
| Installed `visimark` CLI, MCP server, lint plugins, Obsidian | Unchanged. | Unchanged. |

Reversibility: until the first tag that publishes `markdown-it-visimark`, deleting the package removes it. After that tag the package name, the option names, the class names, and the `data-vmark*` attributes are public. Unpublishing is not the rollback. The VS Code setting can turn the preview marks off without another package release.

`docs/distribution.md` opens with "five separate published artifacts" and then names six, and its sections omit `codemirror-visimark`. This change rewrites that sentence so the count and the sections name the same artifacts, adds the missing `codemirror-visimark` section (npm, automatic, the same release leg as the other npm packages), and adds `markdown-it-visimark` (npm, automatic once the first tag that contains it ships; keyword `markdown-it-plugin`; no other directory in this issue).

## 6. Interaction with the rest of the tooling

Unchanged, stated so a later plan does not go looking for a hook:

- CLI commands `check`, `fmt`, `infer`, `explain`, `eval`, `simulate`, their exit codes, and `--json`.
- LSP diagnostics, code actions, inlay hints, CodeLens, the status bar, and `visimark.enable`.
- Obsidian's reading-view post-processor and Live Preview.
- The playground bundle and its size ceiling (#191).
- `docs/cli-reference.md`, `docs/issue-runbook.md`, and `.github/ISSUE_TEMPLATE/`. This change does not alter what an issue must state or what the CLI prints.
- `dogfood.yml` and `action.yml`.

The release set gains one package. `docs/releasing.md` is the procedure that must name it. The editor-plugins design note is a design record: section 9 gains the preview responsibilities, and section 10's version sentence gains `packages/markdown-it-visimark` as own-version-only. The publish procedure stays `docs/releasing.md`. Section 10 is not rewritten into a second copy of that procedure.

A Joplin plugin is a later issue. This spec does not reserve an option for it beyond the public surface in section 2, which Joplin can call when that issue exists.

## 7. Documentation to update

The implementation plan's documentation task is this list:

- `packages/markdown-it-visimark/README.md` — install with both `npm i` and `bun add`; the two options, including that `readImport` is synchronous and the editor package's is not; the selectors `.visimark-computed`, `.visimark-disagrees`, `[data-vmark]`, `[data-vmark-row]`, `[data-vmark-path]`, and `[data-vmark-info]`; the two CSS rules as a suggestion; the statement that the package ships no CSS; `html: true` required; that marks are applied at render time from the render `env`, so a host that parses and renders separately passes its path on the render call; a paragraph on marking under errors — every computed-column cell and every anchored value is marked `visimark-computed` whatever else `check` reports, only a value with its own `STALE` finding also gets `visimark-disagrees`, refused and image anchors are never marked, and import-dependent values are withheld when imports cannot be read; supported from `markdown-it` 14.3.2 upward, tested on 14.3.2 and the latest release; no peer dependency.
- `packages/codemirror-visimark/README.md` — not edited. The editor does not emit `data-vmark-info`. This package's README is the one that lists it.
- `README.md` — the paragraph that points at `codemirror-visimark` also points at this package.
- `CONTRIBUTING.md` — the version-lockstep sentence that says `codemirror-visimark` carries only its own version gains this package for the same reason. The browser-bundle note that names `browser-path.ts` stays about the editor package.
- `docs/releasing.md` — the version-carrying file list and the `bun.lock` comment under it (seven versions becomes eight; the three `visimark` pins stay three); the "what one tag publishes" table, which gains `markdown-it-visimark` and also gains `codemirror-visimark` if that table still omits a package `release.yml` already publishes; the `workflow_dispatch` sentence that says "five npm packages" (it becomes six); and the first-publish note's package list.
- `docs/distribution.md` — section 5.
- `docs/ci.md` — the smoke jobs gain this tarball and `scripts/markdown-it-smoke.mjs`.
- `docs/visimark-editor-plugins-design.md` — section 9 and the version sentence in section 10, as section 6 says.
- `.agents/rules/runtime-parity.md` — the list of published packages with no `bin` gains `markdown-it-visimark`.
- `editors/vscode/README.md` — the preview marks, `visimark.preview.enable`, imports read from the previewed file's directory (none for untitled files), the symlinked-intermediate-directory limit from section 2.7, and the manual preview test from section 4.
- `editors/vscode/CHANGELOG.md` — one line under the unreleased notes: preview marks, and the setting that turns them off.
- `CHANGELOG.md` — an `## Unreleased` / `### Added` entry for the package.
- `docs/vocabulary-catalogue.md` — the section F row for #373 moves into the Shipped register as `UNRELEASED` when the implementation lands. That move is the plan's documentation task, not this spec's commit.

`docs/cli-reference.md`, `docs/issue-runbook.md`, and `.github/ISSUE_TEMPLATE/` are not on this list.

## 8. Non-goals

- A Joplin plugin, a rich-text round trip, or any consumer of `data-vmark-info` beyond writing the attribute.
- A stylesheet in the npm package, a theme, or a change to the editor package's CSS suggestion.
- A shared TypeScript type for `readImport` across the two packages.
- A cache beyond the single entry in section 2.6, a worker, or a second engine pass per render.
- `O_NOFOLLOW` inside the published plugin. Hosts that must refuse a symlink return null.
- A size ceiling for this bundle or for `editors/vscode/dist/extension.js`.
- A `peerDependency` on `markdown-it`, a `bin`, or support for a markdown-it older than 14.3.2. The `latest` smoke leg is what notices a new major.
- Any change to what a document means, to `fmt`, or to the CLI.

## 9. Open questions

None.

<!--vmark:no-formulas-->
