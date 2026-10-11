# codemirror-visimark

[VisiMark](https://github.com/michal-niedzwiedzki/visimark) checks the numbers
in a Markdown document against the formulas that produce them. This package
brings that check into any [CodeMirror 6](https://codemirror.net/) editor: it
marks every computed value in the document, flags the ones that no longer
match their formula, and can report the full set of findings as lint
diagnostics in the same words the `visimark` command line uses.

The VisiMark Obsidian plugin uses it for Live Preview, and the
[VisiMark Playground](https://visimark.dev/playground.html) uses it for its
editor.

## Install

```bash
npm i codemirror-visimark @codemirror/state @codemirror/view
bun add codemirror-visimark @codemirror/state @codemirror/view
```

For the lint diagnostics, add `@codemirror/lint` too:

```bash
npm i @codemirror/lint
bun add @codemirror/lint
```

The VisiMark engine is bundled into this package, so there is nothing else to
install. This package's version is always the version of the engine it
bundles.

## Use

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { visimark, refresh } from "codemirror-visimark";
import { visimarkLint } from "codemirror-visimark/lint";

const view = new EditorView({
  state: EditorState.create({
    doc: source,
    extensions: [
      visimark({
        path: () => "notes/q3.md",
        readImport: async (path) => readFileSomehow(path),
      }),
      visimarkLint(),
    ],
  }),
  parent: document.body,
});

// recompute now, for example after the host rewrote the document
view.dispatch({ effects: refresh.of(null) });
```

`visimark()` does nothing to a document with no `vmark` block. It never edits
the document: a mark is a class on rendered text.

## Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `active` | `(state) => boolean` | always `true` | Whether to show marks for this state. When it turns false, the marks go; when it turns true, they are recomputed at once. |
| `path` | `(state) => string \| null` | always `null` | The document's path, relative to the root its imports resolve within. `null` means the document gets no reader. |
| `readImport` | `(path) => Promise<string \| null>` | none | Reads a file the document declares as an import. Return the text, or `null` if it cannot be read. Without it, no imports are read. |
| `recompute` | `"debounced"` \| `"on-refresh"` | `"debounced"` | When marks are recomputed. `"debounced"`: 400 ms after typing stops. `"on-refresh"`: only when you dispatch `refresh`. Either way, existing marks move with each edit. |
| `focusableMarks` | `boolean` | `false` | Puts `tabindex="0"` on every mark, for hosts that open something when a mark is tapped. |

A value computed from an imported file is not marked until the file has been
read and the value checked against it. If the file cannot be read, the value
stays unmarked.

## Styling

The package ships no theme. Style these classes and attributes:

| Selector | Meaning |
|---|---|
| `.visimark-computed` | A value the document computes. |
| `.visimark-disagrees` | A computed value whose text no longer matches its formula. It also carries `.visimark-computed`. |
| `[data-vmark]` | The qualified name of the value, such as `lines.net_total`. |
| `[data-vmark-row]` | For a table cell, its row index. |
| `[data-vmark-path]` | The document path, when `path` gave one. |

```css
.visimark-computed { text-decoration: underline dotted; }
.visimark-disagrees { text-decoration-color: red; }
```

## Lint

`visimarkLint()` reads the findings that `visimark()` computed for the same
editor, so it runs no check of its own and does nothing without `visimark()`.
Each finding with a position becomes one diagnostic. Problems that fail a
`visimark check` are errors, values that disagree with their formulas are
warnings, and advice is a hint. A document that imports a file shows no
diagnostics until that file has been read.

## Peer versions

| Package | Range |
|---|---|
| `@codemirror/state` | `^6.5.2` |
| `@codemirror/view` | `^6.36.2` |
| `@codemirror/lint` | `^6.4.0` (only for `codemirror-visimark/lint`) |

## Licence

MIT.
