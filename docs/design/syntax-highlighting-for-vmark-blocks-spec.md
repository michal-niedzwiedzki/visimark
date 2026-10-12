# Syntax highlighting for `vmark` blocks — feature spec

**Status:** approved (#367) · **Date:** 2026-10-12 · **Decision:** [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/367#issuecomment-6119706001)

## 1. Purpose

A `vmark` fence in a CodeMirror 6 editor shows as one flat code colour, while
the Markdown around it is highlighted. Hosts that use
[`codemirror-visimark`](../../packages/codemirror-visimark/README.md) get
computed-value marks and lint diagnostics, but nothing that tokenizes the
block itself. The playground is the first such host:

```console
$ ls packages/codemirror-visimark/src
analysis.ts browser-path.ts decorations.ts findings-field.ts gate.ts
import-deps.ts index.ts lint.ts plugin.ts severity.ts snapshot.ts timer.ts

$ grep -n 'markdown(' packages/visimark/src/playground/app/editor.ts
132:    markdown({ base: markdownLanguage }),
```

This spec adds a third subpath to the package, `codemirror-visimark/highlight`.
It holds a forgiving tokenizer for the body of a `vmark` fence, which a host
passes to `markdown({ codeLanguages })` and styles with its own
`HighlightStyle`.

**Three things are kept small on purpose:**

- **Dependencies.** The tokenizer imports nothing from CodeMirror. One thin
  adapter wraps it in a `StreamLanguage`, and only that adapter touches
  CodeMirror.
- **Peers.** The adapter names tags with strings, which `StreamLanguage`
  resolves itself, so it never imports `@lezer/highlight`. The only new peer is
  `@codemirror/language`, and it is optional. Any host that calls `markdown()`
  already has it, because `@codemirror/lang-markdown` depends on it.
- **Engine API.** The engine's public API does not change. The tokenizer keeps
  its own word tables, and a drift test pins them to the engine's lexer and
  parser.

The engine's `lex()` is not reused, because it throws on bad input. A
highlighter has to colour a half-typed line. The block grammar is one
statement per line, with `#` starting a comment outside a string
(`packages/visimark/src/parse/blocks.ts`). So a tokenizer whose state lasts one
line can follow the grammar exactly.

## 2. The surface

### 2.1 Package exports

`packages/codemirror-visimark/package.json` gains one `exports` entry:

```json
"./highlight": {
  "types": "./dist/highlight.d.ts",
  "default": "./dist/highlight.js"
}
```

`./highlight` exports two names and nothing else:

| Export | Type | Meaning |
|---|---|---|
| `visimarkLanguage` | `StreamLanguage<unknown>` | The `vmark` block language. A value, with no options. |
| `isVmarkFence(info: string): boolean` | function | `true` exactly when the first whitespace-delimited word of `info`, after trimming, is `vmark`. This mirrors the engine, which takes a fence when mdast's `node.lang === "vmark"` (`parse/document.ts`). It is case-sensitive. `vmark#s` is not a match. |

The host wiring, as the README documents it:

```ts
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { isVmarkFence, visimarkLanguage } from "codemirror-visimark/highlight";

markdown({
  base: markdownLanguage,
  codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null),
});
```

`lang-markdown` cuts the info string at the first whitespace before calling
`codeLanguages`. `isVmarkFence` also accepts the full info string, so a host
that never cuts it gets the same answer.

### 2.2 Peers

| Package | Range | Optional | Needed by |
|---|---|---|---|
| `@codemirror/state` | `^6.5.2` | no (unchanged) | `.` |
| `@codemirror/view` | `^6.36.2` | no (unchanged) | `.` |
| `@codemirror/lint` | `^6.4.0` | yes (unchanged) | `./lint` |
| `@codemirror/language` | `^6.3.0` | **yes (new)** | `./highlight` |

`@lezer/highlight` is **not** a peer, and nothing in `dist/` imports it.

The floor is `6.3.0`, the floor `@codemirror/lang-markdown` itself declares.
If `smoke-node` fails at `6.3.0`, the floor rises to the lowest `6.x.0` minor
that passes. `package.json`, the README's peer table and `smoke-node`'s install
line all state that one version.

### 2.3 Source layout

| File | Contents | Imports |
|---|---|---|
| `src/tokenize.ts` | `tokenizeLine(line: string): Span[]`, where `Span = { from: number; to: number; kind: Kind }`; the `Kind` union; the word tables; `isVmarkFence` | nothing |
| `src/highlight.ts` | the public entry: the `Kind` → tag-name table, `visimarkLanguage`, and the re-export of `isVmarkFence` | `@codemirror/language`, `./tokenize.js` |

`tokenize.ts` is not a published subpath. Obsidian already builds this package
from source, so a later Obsidian issue can import it without a new export
(§8).

`visimarkLanguage` is
`StreamLanguage.define({ name: "vmark", startState, token })`. At the start of
each line, `token()` runs `tokenizeLine(stream.string)` and caches the spans in
its state. Each call then advances the stream to the end of the next span, or
by one character over a gap, and returns that span's tag name, or `null` for a
gap. No state carries from one line to the next.

### 2.4 Build

`packages/codemirror-visimark/build.ts`:

- `entries` gains `"highlight"`.
- `external` gains `"@codemirror/language"`. Without it the bundle carries its
  own copy of the highlight tags. The host's `HighlightStyle` would then never
  match them, and nothing would be coloured, with no error.
- The check on public declaration files is unchanged. `highlight.d.ts` imports
  only `@codemirror/language`, which the existing `@codemirror/*` filter
  already allows.

## 3. The machine contract

The CLI is untouched: no command, option, exit code, stream or `--json` shape
changes. The contract here is the package's.

| Surface | Before | After |
|---|---|---|
| `import "codemirror-visimark"` | works with the required peers | unchanged; does not load `@codemirror/language` |
| `import "codemirror-visimark/lint"` | needs `@codemirror/lint` | unchanged |
| `import "codemirror-visimark/highlight"` | `ERR_PACKAGE_PATH_NOT_EXPORTED` | resolves; needs `@codemirror/language` |
| `dist/highlight.js` runtime imports | — | exactly `@codemirror/language`: no shared chunk, no engine code, no `node:` specifier |
| `dist/highlight.d.ts` imports | — | exactly `@codemirror/language` |
| `visimark` (engine) package exports | `.` | unchanged; no new named export from `index.ts` or `browser.ts` |

### 3.1 The styling contract: kinds and tags

Hosts style the language through these tags. The table is published in the
README and versioned like an API: moving a kind to a different tag recolours
every host. **A glyph gets the colour of the word it stands for.**

| Kind | Tag name | What gets it |
|---|---|---|
| `keyword` | `keyword` | always: `assert`, `chart`, `precision`, `is`. On a statement line (§3.2): that statement's keywords |
| `wordOperator` | `operatorKeyword` | always: `and`, `or`, `not`. On a `param` line: `in` and `∈` |
| `domainPreset` | `typeName` | on a `param` line: `integer`, `positive`, `natural`, `ℤ`, `ℕ`, `ℤ⁺` |
| `atom` | `atom` | on a `report` line: the report name, `feasible`, `infeasible`, `all`, `max`, `min`. On a `chart` line: the chart type after `as` (including a hyphenated `stacked-bar`) |
| `function` | `variableName.function` | a name whose next non-blank character on the line is `(`; `Σ`, `∑`, `√` always |
| `definition` | `variableName.definition` | the name being bound: on a binding line, the first name before `=`; on a `param` line, the name after `param`; on a `chart` line, the name after `chart`; on an alias line, the name after `is` |
| `name` | `variableName` | every other name, including a contextual word used outside its statement, and `true`/`false` (the engine refuses those; colouring them is not refusing them) |
| `assign` | `definitionOperator` | `=` |
| `operator` | `operator` | `==` `!=` `<=` `>=` `^` `*` `/` `+` `-` `<` `>` `⋅` |
| `paren` | `paren` | `(` `)` |
| `bracket` | `bracket` | `\|` `⌊` `⌋` `⌈` `⌉` |
| `domainBracket` | `squareBracket` | `[` and `]` of a domain interval (§3.2) |
| `brace` | `brace` | `{` `}` |
| `separator` | `separator` | `,` |
| `deref` | `derefOperator` | `.` in `sheet.name` |
| `punctuation` | `punctuation` | `:` in `aspect w:h` |
| `number` | `number` | `12`, `3.50`, and a percent with its sign, `19%` |
| `date` | `literal` | `2026-10-12`: ten characters, not followed by a digit |
| `string` | `string` | `"…"`, a string literal or a quoted header alike; an unclosed one runs to the end of the line |
| `unit` | `unit` | `[…]` everywhere except a domain interval, brackets included; an unclosed one runs to the end of the line |
| `comment` | `lineComment` | `#` outside a string or unit bracket, to the end of the line |
| — | no tag | any other character, including whitespace. Never `invalid`, which would flash on every half-typed line |

Every tag name must resolve in `@codemirror/language` without the
"Unknown highlighting tag" warning. A unit test enforces this (§4, H6).

### 3.2 Statements and context

A line's **statement** is decided the way the parser decides it
(`parser.ts`, the statement dispatch). The tokenizer copies these three rules
by hand, and a comment in `tokenize.ts` cites the parser lines they mirror:

| Statement | When | Its keywords (kind `keyword`) | Its other words |
|---|---|---|---|
| param | the first word is `param` **and** the next token is a name or a string. So `param = 5` and `param precision 2 = 5` stay bindings | `param`, `in`, `lattice`, `default` | `in`/`∈` → `wordOperator`; `integer`, `positive`, `natural`, `ℤ`, `ℕ`, `ℤ⁺` → `domainPreset` |
| chart | the first word is `chart`. `chart` is reserved, so it can never start a binding | `chart`, `as`, `of`, `labelled`, `aspect` | the chart type → `atom` |
| report | the first word is `report` **and** the line has no `=` outside a string, unit bracket or comment. So `report = 5` stays a binding | `report`, `assertions`, `broken`, `on`, `among`, `scalar`, `direction` | report names, `feasible`, `infeasible`, `all`, `max`, `min` → `atom` |
| binding, alias or assert | anything else | none beyond the reserved words | — |

The reserved words `assert`, `chart`, `precision`, `is`, `and`, `or` and `not`
take their kind on every line, as the engine's lexer reserves them everywhere.
`in` appears in both columns of the param row on purpose: it is a param
keyword, and its kind there is `wordOperator`. Off a `param` line it is a
plain name.

**The domain-bracket rule mirrors the lexer exactly.** A `[` directly after the
word `in`, or after `∈`, with only blanks between, opens a domain interval, on
any line. That `[` and its matching `]` are `domainBracket`, and what lies
between is tokenized normally (numbers, percents, commas). Every other `[`
opens a `unit` that runs to the next `]`.

## 4. Behaviour table and acceptance

### 4.1 Tokenizer cases

Spans written as `text:tag`. Whitespace is never tagged.

| # | Line | Spans |
|---|---|---|
| T1 | `total = SUM(Net)` | `total:variableName.definition` `=:definitionOperator` `SUM:variableName.function` `(:paren` `Net:variableName` `):paren` |
| T2 | `total = SUM(` (half-typed) | `total:variableName.definition` `=:definitionOperator` `SUM:variableName.function` `(:paren`, with no throw |
| T3 | `Net = Qty * Price  # per row` | `Net:variableName.definition` `=:definitionOperator` `Qty:variableName` `*:operator` `Price:variableName` `# per row:lineComment` |
| T4 | `label = "a#b"` | `label:variableName.definition` `=:definitionOperator` `"a#b":string`; the `#` inside the string is not a comment |
| T5 | `name = "unclosed` | `…` `"unclosed:string` to the end of the line |
| T6 | `param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%` | `param:keyword` `volume_disc:variableName.definition` `precision:keyword` `3:number` `in:operatorKeyword` `[:squareBracket` `0%:number` `,:separator` `10%:number` `]:squareBracket` `lattice:keyword` `1%:number` `=:definitionOperator` `default:keyword` `0%:number` |
| T7 | `param seats precision 0 ℤ⁺ = default 3` | `param:keyword` `seats:variableName.definition` `precision:keyword` `0:number` `ℤ⁺:typeName` `=:definitionOperator` `default:keyword` `3:number` |
| T8 | `param share precision 2 ∈ [0, 1] = default 0.5` | `∈:operatorKeyword` `[:squareBracket` … `]:squareBracket` |
| T9 | `weight [kg] = 12` | `weight:variableName.definition` `[kg]:unit` `=:definitionOperator` `12:number` |
| T10 | `in = 3` | `in:variableName.definition` `=:definitionOperator` `3:number`. `in` is a legal name outside a `param` line |
| T11 | `report best scalar event.profit direction max among feasible` | `report:keyword` `best:atom` `scalar:keyword` `event:variableName` `.:derefOperator` `profit:variableName` `direction:keyword` `max:atom` `among:keyword` `feasible:atom` |
| T12 | `chart cost as stacked-bar of Net, Tax labelled Item aspect 16:9` | `chart:keyword` `cost:variableName.definition` `as:keyword` `stacked-bar:atom` `of:keyword` `Net:variableName` `,:separator` `Tax:variableName` `labelled:keyword` `Item:variableName` `aspect:keyword` `16:number`, then the colon as `punctuation`, then `9:number` |
| T13 | `"Unit price" is price` | `"Unit price":string` `is:keyword` `price:variableName.definition` |
| T14 | `assert total == SUM(Net) and total > 0` | `assert:keyword` `total:variableName` `==:operator` `SUM:variableName.function` … `and:operatorKeyword` … `>:operator` `0:number` |
| T15 | `root = √(area) + Σ(Net) + \|delta\| + ⌊x⌋` | `√:variableName.function` `Σ:variableName.function` `\|:bracket` … `\|:bracket` `⌊:bracket` … `⌋:bracket` |
| T16 | `due = 2026-10-12` and `n = 2026101` | `2026-10-12:literal`; `2026101:number` |
| T17 | `x = a € b` | `€` gets no tag; the rest are tagged |
| T18 | `report = 5` | `report:variableName.definition` `=:definitionOperator` `5:number`. The line has an `=`, so it is a binding, and it checks clean |
| T19 | `param = 5` and `param precision 2 = 5` | `param:variableName.definition` …, and `precision:keyword`: bindings, as the parser reads them |
| T20 | `lattice = in + 1` | `lattice:variableName.definition` `=:definitionOperator` `in:variableName` `+:operator` `1:number`. Contextual words outside their statement are plain names, and this line checks clean |

The tokenizer follows the parser on *which statement* a line is (§3.2). It
never tries to agree with the parser on whether the line is *valid*: a
statement with a mistake in it is still coloured as that statement.

### 4.2 Tests

| # | File | Asserts |
|---|---|---|
| H1 | `test/tokenize.test.ts` | T1–T20, span for span |
| H2 | `test/tokenize.test.ts` | **No unclassified character:** every non-whitespace character of every `vmark` fence body in `docs/example-*.md` and `docs/playground/**/*.md` lies inside a span |
| H3 | `test/tokenize.test.ts` | `tokenizeLine` never throws, for every prefix of every line in the H2 corpus |
| H4 | `test/tokenize.test.ts` | `isVmarkFence`: `vmark` → true; `vmark #order from rows.csv labelled Item, Qty` → true; `  vmark ` → true; `vmark#s`, `VMARK`, `vmarkx`, `""`, `js` → false |
| H5 | `test/tokenize-drift.test.ts` | see §4.3 |
| H6 | `test/highlight.test.ts` | every tag name in the kind → tag table resolves with no `console.warn` from `@codemirror/language` |
| H7 | `test/highlight.test.ts` | in an `EditorState` with `markdown({ codeLanguages })` wired as in §2.1, over a document holding a ` ```vmark #s from rows.csv ` fence with `total = SUM(Net)`, the syntax tree inside the fence has nodes named `variableName.definition`, `definitionOperator`, `variableName.function`, `paren` and `variableName` |
| H8 | `test/bundle.test.ts` | `highlight.js` and `highlight.d.ts` are built; `highlight.js`'s only import specifier is `@codemirror/language` (no `./chunk-*`); `highlight.d.ts` imports only `@codemirror/language`; no other built file imports `@codemirror/language`; the existing `node:` and "only lint.js imports `@codemirror/lint`" checks still pass |

### 4.3 The drift test

The tokenizer's word tables are its own copy. H5 fails if the engine gains a
word the tokenizer does not classify, or the tokenizer lists a word the engine
does not have. Its sources, by relative path, with no change to the package
API:

- `packages/visimark/src/lang/lexer.ts` changes `WORD_OPS` and `SYMBOL_OPS`
  from module-private to module-level `export`s. It also gains
  `export const RESERVED_WORDS = ["assert", "chart", "precision", "is"] as const`,
  which the lexer's own branch uses in place of the four `text === …` tests, so
  the list is not a second copy within the engine. Behaviour is unchanged.
- `packages/visimark/src/lang/parser.ts` changes `PARAM_DOMAIN_PRESETS` to a
  module-level `export`.
- `GLYPH_IDENTS`, `POSITIVE_INTEGER_GLYPH` and `DELIM_PAIRS` (`lang/notation.ts`)
  and `REPORT_NAMES` (`lang/ast.ts`) are already module exports.
- **The parser scan:** H5 reads `parser.ts` as text and collects every lowercase-letter
  string literal (`[a-z]+`) in `word("…")`, `isWord("…")`, `.value === "…"` and
  `.value !== "…"`. Every collected word must appear in the tokenizer's
  contextual tables, or in an ignore list in the test. The ignore list starts
  empty. A word goes on it only with a one-line comment saying why it is not a
  surface keyword.

None of these is re-exported from `index.ts` or `browser.ts`.
`packages/visimark/test/` gains nothing. The existing engine tests prove the
lexer refactor changes no behaviour.

### 4.4 CI and the session

```console
$ bun run --filter codemirror-visimark build
codemirror-visimark: built index, lint, highlight
$ bun test packages/codemirror-visimark
# H1–H8 pass
```

`scripts/codemirror-smoke.mjs` gains one block after the existing checks. It
imports `visimarkLanguage` and `isVmarkFence` from
`codemirror-visimark/highlight` and asserts `isVmarkFence("vmark #s")`. It
builds `EditorState.create({ doc: "total = SUM(Net)", extensions: [visimarkLanguage] })`,
forces a full parse with `ensureSyntaxTree(state, state.doc.length, 5000)`,
and asserts the tree holds a `variableName.function` node over `SUM`. It needs
no `@codemirror/lang-markdown`. Its final line becomes:

```console
codemirror-visimark ok — 2 marks, 1 disagrees, 1 diagnostic, highlight ok
```

`.github/workflows/ci.yml`:

- `smoke-node`'s install line adds `@codemirror/language@6.3.0`, or the floor
  §2.2 settles on.
- `smoke-bun`'s install line adds `@codemirror/language`, at the latest
  version.

### 4.5 Playground

`packages/visimark/src/playground/app/editor.ts`:

- `markdown({ base: markdownLanguage })` gains the `codeLanguages` function
  from §2.1.
- The `HighlightStyle` gains these rules, reusing only the hues it already has:

  | Tags | Style | Contrast on `#030303` |
  |---|---|---|
  | `keyword`, `operatorKeyword`, `atom` | `#ffb454` | 11.7:1 |
  | `function(variableName)`, `typeName` | `#79c0ff` | 10.6:1 |
  | `number`, `literal`, `unit` | `#7ee787` | 13.4:1 |
  | `string` | `#e6e6e6`, italic | 16.5:1 |
  | `definition(variableName)` | `#e6e6e6`, weight 600 | 16.5:1 |
  | `lineComment` | covered by the existing `tags.comment` rule, `#7d7d7d` | 5.0:1 |

  Every other token keeps the editor's default text colour, `#e6e6e6`.
- `#030303` is the editor's composited background: `.editor` is
  `rgba(0, 0, 0, 0.9)` over the page's `#1b1b1b`.

The colours move into an exported `const` in `editor.ts`, so a new
`packages/visimark/test/playground/highlight-contrast.test.ts` can assert that
every rule's colour has a WCAG contrast of at least 4.5:1 on `#030303`.

By hand, in the playground: typing `total = SUM(` into a `vmark` fence colours
`total`, `SUM` and the numbers, and raises no console error.

## 5. Compatibility

| Consumer | Before | After |
|---|---|---|
| A host importing `.` or `./lint` | works | unchanged; it does not need `@codemirror/language` |
| `docs/ci.md`, `.github/workflows/dogfood.yml`, `action.yml` | do not touch the package | unchanged |
| The Obsidian plugin | builds the package from source; `@codemirror/language` is in its `EXTERNALS` | unchanged; it does not import `highlight.ts` |
| `release.yml` | publishes the package at the engine's version | unchanged; the new subpath rides the next tag |
| The engine's public API | — | unchanged |
| A document that passes `check` | passes | passes; meaning is untouched |

This can be undone freely until the first tag that contains it. After that,
`./highlight`, its two export names and the kind → tag table in §3.1 are public
contract.

## 6. Interaction with the rest of the tooling

- **What does not change:** the `visimark()` marks and their classes; the
  `./lint` diagnostics; the CLI; the LSP and the VS Code extension. The VS Code
  extension stays without highlighting, and its "No syntax highlighting" line
  in `visimark-editor-plugins-design.md` stays true. The `pack` job is
  unchanged: it already packs the package.
- The tokenizer ignores the fence info string and the anchor comments
  `<!--vmark=…-->`. CodeMirror's Markdown parser already tags both, as
  `CodeInfo` and as an HTML comment, so a host styles them through Markdown.
- Highlighting works without `visimark()` installed, and `visimark()` works
  without highlighting. Neither reads the other's state.

## 7. Documentation to update

- `packages/codemirror-visimark/README.md`: a **Highlighting** section with the
  §2.1 wiring, the §3.1 kind → tag table, and a short `HighlightStyle` example;
  the peer table gains the `@codemirror/language` row from §2.2. The opening
  paragraph mentions the third subpath.
- `packages/codemirror-visimark/package.json`: the `exports` entry, the peer
  and its `peerDependenciesMeta` optional flag, `@codemirror/language` and
  `@codemirror/lang-markdown` (for H7 only) in `devDependencies`, and `"highlighting"` added to `keywords`. The
  `description` gains "and highlights `vmark` blocks".
- `docs/visimark-editor-plugins-design.md`: the deferred item "Semantic tokens
  / highlighting for the expression grammar" gains "— the CodeMirror 6
  extension highlights `vmark` blocks since #367; the LSP still has none".
- `docs/design/extract-live-preview-codemirror-spec.md`: a one-line note under
  the "no `codeLanguages`" sentence: "Superseded for `vmark` blocks by #367;
  see `syntax-highlighting-for-vmark-blocks-spec.md`". This spec is a record,
  so the sentence itself stays.
- `CHANGELOG.md`: an entry under `## Unreleased` → `### Added`.
- `docs/vocabulary-catalogue.md`: the #367 row moves from section F to the
  Shipped register as `UNRELEASED`.
- **Not changed, on purpose:** `docs/ci.md` (it does not mention the package);
  `docs/cli-reference.md` (no CLI change); `editors/vscode/CHANGELOG.md` (no
  extension change); `docs/design/obsidian-plugin-spec.md` (Obsidian is out of
  scope).

## 8. Non-goals

- **Obsidian.** It adds no dependency: a `ViewPlugin` applying CSS classes from
  `tokenizeLine`. But finding the fence in Obsidian's own syntax tree, checking
  Live Preview by hand, and the plugin's own release track are a separate
  issue.
- VS Code: a TextMate injection grammar, or LSP semantic tokens.
- Colouring the fence info string (`#sheet`, `from … labelled …`) or anchor
  comments.
- A default `HighlightStyle` or any theme in the package.
- A Lezer grammar, or any parse tree beyond tokens: no folding, no
  indentation, no bracket pairing. A host that wants matching-bracket
  highlighting gets it from CodeMirror's `bracketMatching()` over the
  `paren`/`bracket` tokens.
- A published `tokenize` subpath. It waits for a host with no CodeMirror to ask
  for one.
- Any change to the engine's public exports.

## 9. Open questions

None.

<!--vmark:no-formulas-->
