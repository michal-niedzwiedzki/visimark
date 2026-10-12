# markdown-it-visimark

A [markdown-it](https://github.com/markdown-it/markdown-it) plugin for
[VisiMark](https://github.com/michal-niedzwiedzki/visimark). It marks every
value a document computes in the rendered HTML, and flags the ones that no
longer match their formula. It uses the same classes and attributes as
[`codemirror-visimark`](../codemirror-visimark/README.md), so one stylesheet
styles the editor and the rendered view.

The VS Code extension uses it for the built-in Markdown preview.

## Install

```bash
npm i markdown-it-visimark
```

```bash
bun add markdown-it-visimark
```

## Use

```js
import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import markdownItVisimark from "markdown-it-visimark";

const md = new MarkdownIt({ html: true }).use(markdownItVisimark, {
  path: (env) => env?.path ?? null,
  readImport: (absolutePath) => readFileSync(absolutePath, "utf8"),
});

md.render(source, { path: "/notes/invoice.md" });
```

The plugin needs `html: true`. VisiMark binds a value to its formula with an
HTML comment (`**12.50**<!--vmark=s.total-->`), and with `html: false`
markdown-it prints that comment as text. With `html: false` the plugin changes
nothing: the output is exactly markdown-it's.

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `path` | `(env) => string \| null` | `() => null` | The rendered document's file path. |
| `readImport` | `ReadImportSync` — `(absolutePath) => string \| null` | none | Reads a file the document imports (`from rows.csv`). |

`path` is called with the `env` of the **render** call. A host that parses and
renders separately, as VS Code does, passes the path on the render call.

`readImport` is **synchronous**, because markdown-it renders synchronously.
`codemirror-visimark`'s `readImport` has the same meaning and is asynchronous.
It receives an absolute path that the engine has already checked: a relative
`.csv` path inside the document's own folder. Return the file's text, or `null`
to refuse the read. On Windows the path uses forward slashes
(`C:/notes/rows.csv`). Without `path` or without `readImport`, imports are not
read.

## What is marked

- Every cell of a computed column, and every value with a
  `<!--vmark=…-->` comment, gets `visimark-computed`. This is true whatever
  else the document's check reports: an unknown name or a cycle elsewhere does
  not remove a mark.
- A value whose own text no longer matches its formula (a `STALE` finding on
  that value) also gets `visimark-disagrees`.
- An anchor the engine refuses, and an image anchor, are never marked.
- A value that depends on an imported file is not marked when the import could
  not be read, or when there is no `path` or `readImport`.
- A value that another markdown-it plugin has rewritten, so that its rendered
  text no longer matches the source, is left unmarked.

Every `vmark` code block also carries its info string on its first tag, so a
renderer that turns HTML back into Markdown can recover the sheet id:

```html
<pre data-vmark-info="#s"><code class="language-vmark">…</code></pre>
```

## Styling

The package ships no CSS. Style these selectors:

| Selector | Meaning |
|---|---|
| `.visimark-computed` | A value the document computes. |
| `.visimark-disagrees` | A computed value whose text no longer matches its formula. It also carries `.visimark-computed`. |
| `[data-vmark]` | The qualified name of the value, such as `lines.net_total`. |
| `[data-vmark-row]` | For a table cell, its row index. |
| `[data-vmark-path]` | The document path, when `path` gave one. |
| `[data-vmark-info]` | On a `vmark` block's first tag: the info string after `vmark`. |

A starting point:

```css
.visimark-computed { text-decoration: underline dotted; }
.visimark-disagrees { text-decoration-color: red; }
```

## Compatibility

Supported from markdown-it 14.3.2 upward. CI tests 14.3.2, the version VS Code's
built-in Markdown extension uses, and the latest release. There is no peer
dependency: the plugin uses only the instance it is given.

The plugin adds a core rule, wraps `md.renderer.render`, and wraps
`renderer.rules.fence`. A plugin applied later that replaces
`renderer.rules.fence` without calling the previous rule drops
`data-vmark-info`.

## License

MIT
