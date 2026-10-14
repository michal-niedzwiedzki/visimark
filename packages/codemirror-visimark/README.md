# codemirror-visimark

[VisiMark](https://github.com/michal-niedzwiedzki/visimark) checks the numbers
in a Markdown document against the formulas that produce them. This package
brings that check into any [CodeMirror 6](https://codemirror.net/) editor: it
marks every computed value in the document, flags the ones that no longer
match their formula, and can report the full set of findings as lint
diagnostics in the same words the `visimark` command line uses. A third
subpath, `codemirror-visimark/highlight`, highlights the inside of `vmark`
blocks.

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

For highlighting, add `@codemirror/language`, and `@codemirror/lang-markdown`
for the Markdown language the example below passes it to. An editor that
already uses `@codemirror/lang-markdown` has both:

```bash
npm i @codemirror/language @codemirror/lang-markdown
bun add @codemirror/language @codemirror/lang-markdown
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

Some diagnostics carry a quick fix, the same ones the VS Code extension
offers. Each applies as one transaction, so one undo reverts it:

| Finding | Quick fix |
|---|---|
| a value that disagrees with its formula | **Update to** the value `visimark fmt` would write |
| a date whose ISO form is unambiguous | **Rewrite to** that date |
| an unknown name with a close match | **Change to** the match |
| a column used where a single value belongs | **Wrap in SUM(…)** |

## Highlighting

`codemirror-visimark/highlight` exports `visimarkLanguage`, the language for
the body of a `vmark` block, and `isVmarkFence(info)`, which is `true` when a
fence's info string opens one. Its first word must be exactly `vmark`. Pass
both to the Markdown language:

```ts
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { isVmarkFence, visimarkLanguage } from "codemirror-visimark/highlight";

markdown({
  base: markdownLanguage,
  codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null),
});
```

The package ships no colours. Style these standard
[`@lezer/highlight`](https://lezer.codemirror.net/docs/ref/#highlight.tags)
tags with your own `HighlightStyle`. A symbol gets the tag of the word it
stands for: `Σ` is a function, like `SUM`.

| Tag | What gets it |
|---|---|
| `keyword` | `assert`, `chart`, `precision`, `is`; on a `param`, `chart` or `report` line, that statement's own words (`default`, `lattice`, `as`, `of`, `labelled`, `among`, …) |
| `operatorKeyword` | `and`, `or`, `not`; `in` and `∈` on a `param` line |
| `typeName` | `integer`, `positive`, `natural`, `ℤ`, `ℕ`, `ℤ⁺` on a `param` line |
| `atom` | a report name, `feasible`/`infeasible`/`all`, `max`/`min`; a chart type |
| `function(variableName)` | a name followed by `(`; `Σ`, `∑`, `√` |
| `definition(variableName)` | the name a line binds |
| `variableName` | every other name |
| `definitionOperator` | `=` |
| `operator` | `+ - * / ^ < > <= >= == != ⋅` |
| `paren`, `bracket`, `squareBracket`, `brace` | `( )`; `\|` `⌊⌋` `⌈⌉`; the `[ ]` of a domain; `{ }` |
| `separator`, `derefOperator`, `punctuation` | `,`; the `.` in `sheet.name`; the `:` in `aspect 16:9` |
| `number`, `literal`, `string`, `unit` | `12`, `19%`; a date; `"…"`; `[kg]` |
| `lineComment` | `#` to the end of the line |

```ts
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

syntaxHighlighting(HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: "#d73a49" },
  { tag: tags.function(tags.variableName), color: "#6f42c1" },
  { tag: [tags.number, tags.unit], color: "#005cc5" },
]));
```

`param`, `chart` and `report` are coloured as keywords only where they start
their statement. A column called `in`, or a binding `report = 5`, stays a
plain name. The tokenizer never throws, so a half-typed line is still
coloured.

## Peer versions

| Package | Range |
|---|---|
| `@codemirror/state` | `^6.5.2` |
| `@codemirror/view` | `^6.36.2` |
| `@codemirror/lint` | `^6.4.0` (only for `codemirror-visimark/lint`) |
| `@codemirror/language` | `^6.3.0` (only for `codemirror-visimark/highlight`) |

## Licence

MIT.

<!--vmark:no-formulas-->
