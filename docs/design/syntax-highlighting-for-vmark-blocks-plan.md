# Syntax highlighting for `vmark` blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `codemirror-visimark/highlight`: a `StreamLanguage` for the body of a `vmark` fence, plus the fence predicate `isVmarkFence`. Back it with a tokenizer that has no CodeMirror imports, and adopt it in the playground.

**Architecture:** `src/tokenize.ts` is a pure function from one line to spans of a closed `Kind` set, with no imports. `src/highlight.ts` is the only file that touches CodeMirror: it maps each `Kind` to a tag-name string and walks the spans inside `StreamLanguage.token()`. The tokenizer's word tables are its own copy of the engine's. A drift test pins them to the engine's lexer and parser, imported by relative path from module-level exports that the engine does not re-export publicly. `dist/highlight.js` imports `@codemirror/language` and nothing else.

**Tech Stack:** TypeScript (`tsc`), Bun 1.4.2 (`bun test`, `Bun.build`), CodeMirror 6 (`@codemirror/language` and, for tests only, `@codemirror/lang-markdown`), happy-dom for the existing DOM tests.

**Spec:** [`syntax-highlighting-for-vmark-blocks-spec.md`](syntax-highlighting-for-vmark-blocks-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer that [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) names for the session doing the work. The Git author stays the maintainer.
- Delivery is **one PR**, #369, on `issue/367-syntax-highlighting-for-vmark-blocks-impl`. It stays a draft until CI is green.
- `./highlight` exports exactly `visimarkLanguage` and `isVmarkFence` (spec §2.1). `tokenize.ts` is not a subpath.
- New peer: `@codemirror/language` `^6.3.0` (or the floor Task 5 settles), marked optional in `peerDependenciesMeta`. Never `@lezer/highlight`.
- `tokenize.ts` imports nothing. `highlight.ts` imports only `@codemirror/language` and `./tokenize.js`.
- The engine's `index.ts` and `browser.ts` export nothing new.
- The kind → tag table is spec §3.1, verbatim. The statement rules are spec §3.2, verbatim.
- One copy each of `@codemirror/language` and `@lezer/highlight` in the workspace: pin both in the root `overrides`, next to `@codemirror/state` and `@codemirror/view`.
- Install lines in any doc this plan writes come in both forms, `npm i` and `bun add` (runtime-parity rule).
- Before every push, from the repo root: `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun test`.

## Review Focus

1. **Two copies of the tags.** If `@codemirror/language` is bundled into `dist/highlight.js`, or the workspace resolves two copies, the host's `HighlightStyle` silently matches nothing. Pinned by H8 (Task 4) and by the single-copy check in `build-playground.ts` (Task 6).
2. **The tokenizer disagrees with the parser on a statement.** `report = 5` and `param = 5` are bindings. Pinned by T18–T20 (Task 2).
3. **A half-typed line throws.** Pinned by H3 over every prefix of the corpus (Task 3).
4. **`StreamLanguage.token()` fails to advance.** CodeMirror throws "Stream parser failed to advance stream". The adapter always moves `stream.pos` forward. Pinned by H6 and H7 (Task 4).

---

### Task 1: The engine's word lists become module exports

**Files:**
- Modify: `packages/visimark/src/lang/lexer.ts`
- Modify: `packages/visimark/src/lang/parser.ts`

**Interfaces:**
- `lexer.ts`: `export const WORD_OPS`, `export const SYMBOL_OPS`, and a new `export const RESERVED_WORDS = ["assert", "chart", "precision", "is"] as const`.
- `parser.ts`: `export const PARAM_DOMAIN_PRESETS`.

- [ ] **Step 1:** In `lexer.ts`, add `export` to `WORD_OPS` and `SYMBOL_OPS`, and declare `RESERVED_WORDS` next to them. Each one gets a one-line comment: "module export for `codemirror-visimark`'s drift test (#367); not part of the package API".
- [ ] **Step 2:** Replace the four `else if (text === "chart" | "assert" | "precision" | "is")` branches with one branch:
  ```ts
  } else if ((RESERVED_WORDS as readonly string[]).includes(text)) {
    push(text as TokenKind, text, start, i);
  }
  ```
  Move the four explanatory comments above that branch as one list, keeping their design-doc references.
- [ ] **Step 3:** In `parser.ts`, add `export` to `PARAM_DOMAIN_PRESETS`.
- [ ] **Step 4:** Confirm neither `packages/visimark/src/index.ts` nor `browser.ts` re-exports these names: `grep -n 'RESERVED_WORDS\|WORD_OPS\|SYMBOL_OPS\|PARAM_DOMAIN_PRESETS' packages/visimark/src/index.ts packages/visimark/src/browser.ts` prints nothing.
- [ ] **Step 5:** Run `bun test packages/visimark`. It passes unchanged, which proves the behaviour is unchanged.
- [ ] **Step 6:** Commit: `refactor(lang): reserved words as one list; module exports for the #367 drift test`.

### Task 2: The tokenizer

**Files:**
- Create: `packages/codemirror-visimark/src/tokenize.ts`
- Create: `packages/codemirror-visimark/test/tokenize.test.ts`

**Interfaces:**
```ts
export type Kind =
  | "keyword" | "wordOperator" | "domainPreset" | "atom" | "function" | "definition"
  | "name" | "assign" | "operator" | "paren" | "bracket" | "domainBracket" | "brace"
  | "separator" | "deref" | "punctuation" | "number" | "date" | "string" | "unit" | "comment";
export interface Span { from: number; to: number; kind: Kind }
export function tokenizeLine(line: string): Span[];
export function isVmarkFence(info: string): boolean;
/** the word tables, exported for the drift test only */
export const WORDS: {
  reserved: ReadonlySet<string>; wordOps: ReadonlySet<string>; symbolOps: readonly string[];
  paramWords: ReadonlySet<string>; paramPresets: ReadonlySet<string>;
  chartWords: ReadonlySet<string>; reportWords: ReadonlySet<string>; reportAtoms: ReadonlySet<string>;
  glyphs: Readonly<Record<string, "function" | "in" | "preset">>; positiveInteger: string;
  delims: ReadonlySet<string>;
};
```

- [ ] **Step 1: Write the failing tests.** Each T1–T20 case (spec §4.1) is one row of a `test.each` over `[line, expected]`. `expected` is an array of `[text, Kind]` pairs, and the test compares it with `tokenizeLine(line).map(s => [line.slice(s.from, s.to), s.kind])`. The cases written with `…` in the spec are written out in full here, every span listed. Add the H4 `isVmarkFence` cases. Run `bun test packages/codemirror-visimark/test/tokenize.test.ts` and see it fail on the missing module.
- [ ] **Step 2: Pass 1, the raw scan.** Walk the line once and produce raw tokens: `word`, `string`, `unit`, `number`, `date`, `comment`, `glyph`, and the punctuation kinds. Whitespace (space, tab) is skipped.
  - `#` makes a comment to the end of the line.
  - `"` makes a string to the next `"`, or to the end of the line.
  - `[` is a `domainBracket` when the previous raw token is the word `in` or the glyph `∈`. Otherwise it makes a `unit` to the next `]`, or to the end of the line. `]` is `domainBracket`.
  - A date matches `/^\d{4}-\d{2}-\d{2}(?!\d)/`. Otherwise digits, an optional `.digits`, and an optional `%` make a number.
  - `[A-Za-z_][A-Za-z0-9_]*` is a word.
  - `ℤ⁺` is checked before `ℤ`.
  - `Σ ∑ √`, `∈`, and `ℤ ℕ` are glyphs.
  - `| ⌊ ⌋ ⌈ ⌉` are `bracket`; `( )` are `paren`; `{ }` are `brace`; `,` is `separator`; `.` is `deref`; `:` is `punctuation`; `⋅` is `operator`.
  - Symbol operators match longest first (`==` before `=`). `=` is `assign`.
  - Any other character advances by one code point and produces nothing.
- [ ] **Step 3: Pass 2, statements and words.** Decide the statement from the raw tokens, exactly as spec §3.2 says:
  - **param**: the first token is the word `param` and the second is a word or a string.
  - **chart**: the first token is the word `chart`.
  - **report**: the first token is the word `report` and no `assign` token exists.

  Then give each word its kind, in this order:
  1. reserved → `keyword`; word operator → `wordOperator`;
  2. the statement's tables (`in` → `wordOperator` on param; presets → `domainPreset`; the chart type after `as` → `atom`, joined with an adjacent `-word` into one span, as the parser joins `stacked-bar`; report atoms → `atom`; the statement's other words → `keyword`);
  3. definition: index 1 on param and chart; the word after `is` when the line starts with a string; on any other line, the first token when it is a word and an `assign` follows;
  4. `function` when the next raw token is `(`;
  5. otherwise `name`.

  Glyphs: `Σ ∑ √` → `function`. `ℤ ℕ ℤ⁺` → `domainPreset` on param, otherwise `name`. `∈` → `wordOperator` on param, otherwise `name`. Put a comment above the statement rules citing the `parser.ts` dispatch they mirror (the `report` / `param` blocks).
- [ ] **Step 4: `isVmarkFence`:** `info.trim().split(/\s+/)[0] === "vmark"`.
- [ ] **Step 5:** Run the tests until T1–T20 and H4 pass. `bun run typecheck`.
- [ ] **Step 6:** Commit: `feat(codemirror-visimark): a line tokenizer for vmark blocks (#367)`.

### Task 3: Corpus and drift tests

**Files:**
- Modify: `packages/codemirror-visimark/test/tokenize.test.ts`
- Create: `packages/codemirror-visimark/test/tokenize-drift.test.ts`

- [ ] **Step 1: H2 and H3.** Collect the fence bodies with the engine's own `locate` (imported by relative path from `../../visimark/src/index.ts`, as `snapshot.test.ts` already imports engine source). Collect them from every file matched by `docs/example-*.md` and `docs/playground/**/*.md`, via `Bun.Glob` from the repo root, reading each block's body text.
  - **H2:** for each line, every non-whitespace UTF-16 index lies inside a span.
  - **H3:** for each line, `tokenizeLine(line.slice(0, k))` does not throw for every `k`.

  On failure, the message names the file and the line.
- [ ] **Step 2: H5, the drift test.** Import `RESERVED_WORDS`, `WORD_OPS`, `SYMBOL_OPS` (`lexer.ts`), `PARAM_DOMAIN_PRESETS` (`parser.ts`), `GLYPH_IDENTS`, `POSITIVE_INTEGER_GLYPH`, `DELIM_PAIRS` (`notation.ts`) and `REPORT_NAMES` (`ast.ts`), all by relative path. Assert:
  - `WORDS.reserved` equals `RESERVED_WORDS`, and `WORDS.wordOps` equals `WORD_OPS`, as sets.
  - `WORDS.symbolOps` equals `SYMBOL_OPS`, as a set.
  - `Object.keys(WORDS.glyphs)` equals `Object.keys(GLYPH_IDENTS)`. Each glyph's class agrees with what it stands for: `SUM`/`SQRT` → `function`, `in` → `in`, a preset → `preset`.
  - `WORDS.positiveInteger === POSITIVE_INTEGER_GLYPH`.
  - `WORDS.delims` equals the openers and closers of `DELIM_PAIRS`.
  - Every `REPORT_NAMES` entry is in `WORDS.reportAtoms`.
  - `WORDS.paramPresets` equals `PARAM_DOMAIN_PRESETS`.
  - **Parser scan:** read `parser.ts` as text, and collect `[a-z]+` literals from `word("…")`, `isWord("…")`, `.value === "…"` and `.value !== "…"`. Every word collected is in the union of the tokenizer's tables, or in `IGNORED` (an empty `Set` declared in the test, with a comment on how a word earns a place there). In the other direction, every contextual word in the tokenizer's tables is either collected, or in `REPORT_NAMES`, or in `PARAM_DOMAIN_PRESETS`.
- [ ] **Step 3:** Run `bun test packages/codemirror-visimark`. Fix the tokenizer, never the corpus, until everything passes.
- [ ] **Step 4:** Commit: `test(codemirror-visimark): corpus and drift tests for the tokenizer (#367)`.

### Task 4: The adapter, the export, the build

**Files:**
- Create: `packages/codemirror-visimark/src/highlight.ts`
- Create: `packages/codemirror-visimark/test/highlight.test.ts`
- Modify: `packages/codemirror-visimark/package.json`, `packages/codemirror-visimark/build.ts`, `packages/codemirror-visimark/test/bundle.test.ts`
- Modify: `package.json` (root `overrides`), `bun.lock`

**Interfaces:**
```ts
import { StreamLanguage } from "@codemirror/language";
export const visimarkLanguage: StreamLanguage<unknown>;
export { isVmarkFence } from "./tokenize.js";
```

- [ ] **Step 1: Manifests.**
  - Root `overrides` gains `"@codemirror/language": "6.13.1"` and `"@lezer/highlight": "1.2.5"`, the versions already locked.
  - The package's `package.json` gains the `./highlight` export (spec §2.1); `peerDependencies["@codemirror/language"]: "^6.3.0"`; `peerDependenciesMeta["@codemirror/language"]: { optional: true }`; and `devDependencies`: `@codemirror/language` `^6.13.1` and `@codemirror/lang-markdown` `^6.5.2`.
  - Run `bun install`, and check `ls node_modules/.bun | grep -E 'codemirror\+language@|lezer\+highlight@'` lists one of each.
- [ ] **Step 2: Failing tests.**
  - **H6:** spy on `console.warn`. Build `EditorState.create({ doc, extensions: [visimarkLanguage] })`, where `doc` is the T1–T20 lines joined by `\n`, and call `ensureSyntaxTree(state, state.doc.length, 5000)`. Assert that no warn was called, and that the set of node names in the tree, minus `Document`, equals the set of values in the `TAG` table.
  - **H7:** `markdown({ base: markdownLanguage, codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null) })` over a document whose fence is a ` ```vmark #s from rows.csv ` line, `total = SUM(Net)`, and a closing ` ``` ` line. Assert the nodes inside the fence include `variableName.definition`, `definitionOperator`, `variableName.function`, `paren` and `variableName`.
- [ ] **Step 3: `highlight.ts`.**
  - `const TAG: Record<Kind, string>` holds spec §3.1, verbatim.
  - The state is `{ line: string | null; spans: Span[]; at: number }`, with `copyState` copying it shallowly.
  - `token(stream, state)`: when `stream.sol()`, or when `state.line !== stream.string`, re-tokenize and reset `at`. Skip spans that end at or before `stream.pos`. If the next span starts at `stream.pos`, set `stream.pos = span.to` and return `TAG[span.kind]`. Otherwise set `stream.pos` to the next span's `from`, or to the end of the line, and return `null`. The stream always advances.
  - `StreamLanguage.define({ name: "vmark", startState, copyState, token })`.
- [ ] **Step 4: Build.** In `build.ts`, `entries` gains `"highlight"` and `external` gains `"@codemirror/language"`. Update the doc comment ("only the three public files"). The `.d.ts` filter is unchanged.
- [ ] **Step 5: H8 in `bundle.test.ts`.**
  - `highlight.js` and `highlight.d.ts` exist.
  - The `from"…"` / `import"…"` specifiers in `highlight.js` are exactly `["@codemirror/language"]`, with no `./chunk-`.
  - `highlight.d.ts`'s specifiers are exactly `["@codemirror/language"]`.
  - No file except `highlight.js` imports `@codemirror/language`.
  - The `node:` test covers the new file, because it already walks every `.js`.
- [ ] **Step 6:** `bun test packages/codemirror-visimark`, `bun run typecheck`, `bun run --filter codemirror-visimark build`. The last prints `codemirror-visimark: built index, lint, highlight`.
- [ ] **Step 7:** Commit: `feat(codemirror-visimark): the ./highlight subpath (#367)`.

### Task 5: Smoke and CI at the peer floor

**Files:**
- Modify: `scripts/codemirror-smoke.mjs`, `.github/workflows/ci.yml`

- [ ] **Step 1:** In `codemirror-smoke.mjs`, after the existing checks and before `GlobalRegistrator.unregister()`:
  - Import `{ ensureSyntaxTree }` from `@codemirror/language` and `{ visimarkLanguage, isVmarkFence }` from `codemirror-visimark/highlight`.
  - Assert `isVmarkFence("vmark #s")`.
  - Build `EditorState.create({ doc: "total = SUM(Net)", extensions: [visimarkLanguage] })` and call `ensureSyntaxTree`.
  - Assert a node named `variableName.function` spans offsets 8–11.
  - On failure, print `::error::codemirror-visimark/highlight: …` and exit 1. The success line becomes `codemirror-visimark ok — ${marks} marks, ${disagrees} disagrees, ${diagnostics} diagnostic, highlight ok`.
- [ ] **Step 2: Settle the floor locally.**
  - `bun run --filter codemirror-visimark build`, then `cd packages/codemirror-visimark && npm pack --pack-destination "$TMP"`.
  - In a fresh temp directory, run the `smoke-node` install line with `@codemirror/language@6.3.0` added, then `node codemirror-smoke.mjs`.
  - If it fails, try `6.4.0`, `6.5.0`, … and take the first that passes as the floor. Write that floor into `package.json`'s peer range, `smoke-node`, and the README (Task 7), and record it in the spec's §2.2 sentence.
- [ ] **Step 3:** `ci.yml`: `smoke-node`'s `npm i` line gains `@codemirror/language@<floor>`, and `smoke-bun`'s `bun add` line gains `@codemirror/language`.
- [ ] **Step 4:** Commit: `ci: smoke codemirror-visimark/highlight at the peer floor and the latest (#367)`.

### Task 6: The playground adopts it

**Files:**
- Create: `packages/visimark/src/playground/app/highlight-palette.ts`
- Modify: `packages/visimark/src/playground/app/editor.ts`, `packages/visimark/build-playground.ts`
- Create: `packages/visimark/test/playground/highlight-contrast.test.ts`
- Regenerate: `docs/vendor/visimark-playground.js`

- [ ] **Step 1: The palette module** has no imports:
  ```ts
  /** The playground's colours for vmark tokens (#367). Text on the editor's composited background, #030303. */
  export const EDITOR_BACKGROUND = "#030303";
  export const VMARK_PALETTE = {
    keyword: "#ffb454",   // keyword, operatorKeyword, atom
    callable: "#79c0ff",  // function(variableName), typeName
    literal: "#7ee787",   // number, literal, unit
    text: "#e6e6e6",      // string (italic), definition(variableName) (weight 600)
    comment: "#7d7d7d",   // the existing tags.comment rule
  } as const;
  ```
- [ ] **Step 2: Failing test.** `highlight-contrast.test.ts` computes the WCAG relative luminance and asserts every `VMARK_PALETTE` value has at least 4.5:1 contrast on `EDITOR_BACKGROUND`. Expected values: 11.7, 10.6, 13.4, 16.5, 5.0.
- [ ] **Step 3: `editor.ts`.**
  - `markdown({ base: markdownLanguage, codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null) })`, importing from `codemirror-visimark/highlight.js`, the way `main.ts` imports `/lint.js`.
  - The `HighlightStyle` gains the spec §4.5 rules, using the palette constants. The existing `tags.comment` rule uses `VMARK_PALETTE.comment`.
- [ ] **Step 4: `build-playground.ts`:** after the `@codemirror/state` check, refuse a bundle in which `"Unknown highlighting tag"` occurs other than exactly once ("holds N copies of @codemirror/language; expected 1").
- [ ] **Step 5:** Run `bun run --filter visimark build:playground`, `bun test packages/visimark/test/playground` (including `browser-graph.test.ts`; if it allowlists the playground's imports, add `codemirror-visimark/highlight.js` there with the same comment style), and `bun run typecheck`.
- [ ] **Step 6: By hand.** Open `docs/playground.html` from a local server (`bunx serve docs`, or the repo's usual way), type `total = SUM(` into a `vmark` fence, and check the colours and that the console is clean.
- [ ] **Step 7:** Commit the source and the regenerated `docs/vendor/visimark-playground.js`: `feat(playground): highlight vmark blocks (#367)`.

### Task 7: Documentation

**Files:** every file in spec §7.

- [ ] **Step 1:** `packages/codemirror-visimark/README.md`:
  - The opening paragraph mentions `codemirror-visimark/highlight`.
  - A new `## Highlighting` section after `## Lint` holds the §2.1 wiring, the §3.1 kind → tag table (tag name and what gets it), and a four-line `HighlightStyle.define([...])` example.
  - The optional peer gets an install line in both forms: `npm i @codemirror/language` / `bun add @codemirror/language`.
  - The `## Peer versions` table gains `@codemirror/language` | `^<floor>` (only for `codemirror-visimark/highlight`).
- [ ] **Step 2:** `packages/codemirror-visimark/package.json`: `keywords` gains `"highlighting"`, and the `description` ends "…as lint diagnostics, and highlights `vmark` blocks."
- [ ] **Step 3:** `docs/visimark-editor-plugins-design.md:435` becomes: "Semantic tokens / highlighting for the expression grammar — the CodeMirror 6 extension highlights `vmark` blocks since [#367](https://github.com/michal-niedzwiedzki/visimark/issues/367); the LSP still has none."
- [ ] **Step 4:** `docs/design/extract-live-preview-codemirror-spec.md`: after the paragraph containing "no `codeLanguages`", add one line: "_Superseded for `vmark` blocks by #367; see [`syntax-highlighting-for-vmark-blocks-spec.md`](syntax-highlighting-for-vmark-blocks-spec.md)._"
- [ ] **Step 5:** `CHANGELOG.md`, `## Unreleased` → `### Added`, at the top:
  ```markdown
  - **`codemirror-visimark/highlight`, syntax highlighting for `vmark` blocks.**
    `visimarkLanguage` colours a fence's keywords, names, functions, numbers,
    units and comments when a host passes it to `markdown({ codeLanguages })`,
    using `isVmarkFence` to pick the fence. The package still ships no colours:
    the host styles the standard highlight tags. `@codemirror/language` is a
    new optional peer, needed only by this subpath. The Playground uses it.
    ([#367](https://github.com/michal-niedzwiedzki/visimark/issues/367))
  ```
- [ ] **Step 6:** `docs/vocabulary-catalogue.md`: remove the #367 row from section F. Add to the top of the Shipped table: `| Syntax highlighting for \`vmark\` blocks in \`codemirror-visimark\` | tooling | [#367](https://github.com/michal-niedzwiedzki/visimark/issues/367) | [#369](https://github.com/michal-niedzwiedzki/visimark/pull/369) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/367#issuecomment-6119706001) |`.
- [ ] **Step 7:** Check that `docs/ci.md`, `docs/cli-reference.md`, `editors/vscode/CHANGELOG.md` and `docs/design/obsidian-plugin-spec.md` are unchanged (spec §7, "Not changed").
- [ ] **Step 8:** Run `bun run gen:docs` and `bun run --filter visimark build:playground`, and confirm `git status` shows no stale generated file. Run `bun packages/visimark/src/cli/main.ts check` on every Markdown file this task touched. Run the four pre-push checks.
- [ ] **Step 9:** Commit: `docs: codemirror-visimark/highlight (#367)`.

<!--vmark:no-formulas-->
