# Published markdown-it plugin (`markdown-it-visimark`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `markdown-it-visimark`, a markdown-it plugin that marks computed and disagreeing values in rendered HTML with `codemirror-visimark`'s classes and `data-vmark*` attributes, and adopt it in the VS Code extension's built-in Markdown preview.

**Architecture:** A core rule only records the source text per token stream (a `WeakMap` keyed by the token array). A wrapper around `md.renderer.render` runs the engine on that source with the **render** `env` (one cached result per `(source, path)`), takes the mark list from `codemirror-visimark`'s `decorationsFor`, and renders a copy of the token stream with the marks applied, never mutating the host's tokens. A wrapper around `renderer.rules.fence` injects `data-vmark-info` into the first opening tag of a `vmark` fence. The published `dist/` bundles the engine's browser entry and the two `codemirror-visimark` modules from source, with a Windows-aware `node:path` shim; the VS Code extension bundles the plugin from source for Node.

**Tech Stack:** TypeScript 7 (`tsc`), Bun 1.4 (`bun test`, `Bun.build`), esbuild 0.28 (VS Code extension), markdown-it 15.0.2 and 14.3.2 (dev / smoke only), markdown-it-footnote 4.0.0 (dev only), happy-dom (dev only).

**Spec:** [`markdown-it-visimark-a-published-markdown-spec.md`](markdown-it-visimark-a-published-markdown-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) names for the session doing the work; the Git author stays the maintainer.
- npm name and directory: `markdown-it-visimark`, `packages/markdown-it-visimark`.
- Package `version` equals `packages/visimark/package.json`'s `version` at the time of the change (0.2.0 when this plan was written).
- No `dependencies`, no `peerDependencies`, no `bin`, and no `visimark` key anywhere in the package's `package.json`. `engines.node`: `>=24`.
- Published `exports`: exactly `"."`. Public API exactly: the default export (the plugin), `MarkdownItVisimarkOptions` (keys `path`, `readImport`), `ReadImportSync`. The shipped `index.d.ts` imports nothing.
- HTML contract: classes `visimark-computed` / `visimark-computed visimark-disagrees`; attributes in the order `class`, `data-vmark`, `data-vmark-row` (cells only), `data-vmark-path` (only when `path(env)` returned a string); `data-vmark-info` on the first opening `<pre`/`<code` tag of a `vmark` fence, never `data-vmark-path` there.
- With `html: false` (on the render's `options`) the output is byte-identical to markdown-it without the plugin. A document with no `vmark` fence is byte-identical too.
- The host's token array and tokens are never mutated. Nothing is stored on the `md` instance beyond the two wrapped functions and the core rule, and nothing on `env`.
- No `node:` specifier in `dist/`.
- VS Code: setting `visimark.preview.enable`, boolean, default `true`; toggling it runs `markdown.api.reloadPlugins`. `visimark.enable` stays the language-server switch only.
- Smoke floor `markdown-it@14.3.2`; the other leg `markdown-it@latest`.
- Install lines in any doc this plan writes come in both forms: `npm i` and `bun add` (runtime-parity rule).
- Before every push: `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun test` from the repo root.
- Work lands on `issue/373-markdown-it-visimark-a-published-markdown-impl` (draft PR #377), one commit per task.

## Review Focus

1. **A host that parses and renders separately with a cached token array** (VS Code): marks must come from the render `env` and must not accumulate across renders. Pinned in Task 3 (parse/render split, immutability, double render).
2. **A value another plugin rewrote** (linkify turning text into a link, a typographer change, footnotes moving tokens): the value is left unmarked, never marked on the wrong token. Pinned in Task 3 (text mismatch) and Task 5 (typographer, linkify, footnote).
3. **An imported sheet's synthetic table**: its cells have no source, and must never be mapped onto a document table. Pinned in Task 5 (CSV import with and without a reader).
4. **`readImport` or `path` throws**: the render is the host's own HTML, no exception escapes. Pinned in Task 3.
5. **A highlight callback that returns its own `<pre>`**, or another fence plugin wrapped before this one: `data-vmark-info` still lands on the first tag, and a tag that already carries it is left alone. Pinned in Task 4.

---

### Task 1: Package scaffold and the Windows-aware path shim

**Files:**
- Create: `packages/markdown-it-visimark/package.json`
- Create: `packages/markdown-it-visimark/tsconfig.json`
- Create: `packages/markdown-it-visimark/tsconfig.build.json`
- Create: `packages/markdown-it-visimark/bunfig.toml`
- Create: `packages/markdown-it-visimark/test/preload.ts`
- Create: `packages/markdown-it-visimark/LICENSE` (copy of `packages/codemirror-visimark/LICENSE`)
- Create: `packages/markdown-it-visimark/src/browser-path.ts`
- Test: `packages/markdown-it-visimark/test/browser-path.test.ts`
- Modify: `bun.lock` (by `bun install`)

**Interfaces:**
- Produces: `browser-path.ts` exporting `sep: "/"`, `isAbsolute(p: string): boolean`, `dirname(p: string): string`, `resolve(...parts: string[]): string`, and a default object of the four. Later tasks never import it directly; Task 6's build aliases `node:path` to it.

- [ ] **Step 1: Write the manifest and configs**

`packages/markdown-it-visimark/package.json`:

```json
{
  "name": "markdown-it-visimark",
  "version": "0.2.0",
  "description": "A markdown-it plugin for VisiMark: marks every computed value in rendered HTML and flags the ones that disagree with their formulas.",
  "keywords": ["markdown-it-plugin", "markdown-it", "markdown", "visimark"],
  "homepage": "https://github.com/michal-niedzwiedzki/visimark#readme",
  "bugs": "https://github.com/michal-niedzwiedzki/visimark/issues",
  "license": "MIT",
  "author": "Michał Niedźwiedzki <michal@epsi.pl>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/michal-niedzwiedzki/visimark.git",
    "directory": "packages/markdown-it-visimark"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.build.json && bun build.ts",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "^20.14.5",
    "markdown-it": "^15.0.2",
    "markdown-it-footnote": "^4.0.0"
  },
  "engines": {
    "node": ">=24"
  }
}
```

Use the version actually in `packages/visimark/package.json` if it moved past 0.2.0. markdown-it 15 ships its own declarations, so there is no `@types/markdown-it`.

`tsconfig.json` (the `visimark` mapping is the same one `codemirror-visimark` uses, and it is what `decorations.ts` and `import-deps.ts` need when they are compiled as part of this package):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "paths": {
      "visimark": ["../visimark/src/browser.ts"]
    }
  },
  "include": ["src", "test", "build.ts"]
}
```

`tsconfig.build.json` — identical to `packages/codemirror-visimark/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "..",
    "outDir": ".types"
  },
  "include": ["src"]
}
```

`bunfig.toml` and `test/preload.ts` — copies of `packages/codemirror-visimark/bunfig.toml` and `packages/codemirror-visimark/test/preload.ts`.

Add `.types/` and `dist/` to the package if `packages/codemirror-visimark/.gitignore` exists (copy it); otherwise confirm the root `.gitignore` already covers `packages/*/dist` and `.types` with `git check-ignore packages/codemirror-visimark/dist packages/codemirror-visimark/.types`.

- [ ] **Step 2: Install**

Run: `bun install`
Expected: `bun.lock` gains a `"packages/markdown-it-visimark"` workspace block with `"version": "0.2.0"`.

- [ ] **Step 3: Write the failing shim test**

`test/browser-path.test.ts`:

```ts
import { expect, test } from "bun:test";
import { posix, win32 } from "node:path";
import { dirname, isAbsolute, resolve, sep } from "../src/browser-path.js";

/**
 * The published bundle's `node:path`. The engine's containment check runs on
 * it, so it is pinned against the modules it replaces, over exactly the calls
 * `packages/visimark/src/fs/gate.ts` makes: `dirname(resolve(doc.path))`,
 * `resolve(base, url)`, `isAbsolute`, and `sep`. A drive-letter path is
 * compared with `node:path.win32` after `\` → `/`, because `sep` is one
 * constant and is `/` (spec §2.6).
 */

const fwd = (s: string): string => s.replace(/\\/g, "/");
const WINDOWS = [
  "C:\\notes\\note.md",
  "C:/notes/note.md",
  "c:\\a\\b\\",
  "D:\\",
  "C:\\a\\..\\b\\x.md",
  "C:/a//b/./c.md",
];
const POSIX = ["/", "/a", "/a/b/c.md", "/a/../b", "/a//b", "notes/q3.md"];
const IMPORTS = ["rows.csv", "sub/rows.csv", "../x.csv", "./a/../rows.csv"];

test("sep is the one constant the gate's contains() reads", () => {
  expect(sep).toBe("/");
});

test("drive-letter paths agree with node:path.win32, separators normalised", () => {
  for (const p of WINDOWS) {
    expect(isAbsolute(p)).toBe(true);
    const base = dirname(resolve(p));
    expect(base).toBe(fwd(win32.dirname(win32.resolve(p))));
    for (const url of [...IMPORTS, "sub\\rows.csv"]) {
      expect(resolve(base, url)).toBe(fwd(win32.resolve(win32.dirname(win32.resolve(p)), url)));
    }
  }
});

test("every other path agrees with node:path.posix, relative rooted at /", () => {
  for (const p of POSIX) {
    const rooted = p.startsWith("/") ? p : "/" + p;
    expect(isAbsolute(p)).toBe(posix.isAbsolute(p));
    const base = dirname(resolve(p));
    expect(base).toBe(posix.dirname(posix.resolve(rooted)));
    for (const url of IMPORTS) {
      expect(resolve(base, url)).toBe(posix.resolve(posix.dirname(posix.resolve(rooted)), url));
    }
  }
});

test("a drive-letter import URL is absolute, so the gate refuses it before resolving", () => {
  expect(isAbsolute("C:\\x.csv")).toBe(true);
  expect(isAbsolute("rows.csv")).toBe(false);
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd packages/markdown-it-visimark && bun test test/browser-path.test.ts`
Expected: FAIL — cannot resolve `../src/browser-path.js`.

- [ ] **Step 5: Implement the shim**

`src/browser-path.ts`:

```ts
import {
  dirname as posixDirname,
  resolve as posixResolve,
} from "../../codemirror-visimark/src/browser-path.js";

/**
 * The published bundle's `node:path` (spec §2.6), bundled in place of the
 * builtin so `dist/` carries no `node:` specifier.
 *
 * `codemirror-visimark`'s shim is POSIX-only because Obsidian hands it vault
 * paths. A markdown-it host hands this one real host paths, which on Windows
 * carry a drive letter, so a drive-letter path is handled here and everything
 * else is that shim's, unchanged — one POSIX implementation, not two.
 *
 * `sep` is a single constant `fs/gate.ts`'s `contains()` reads, so it cannot
 * follow the path. It is `/`, and a drive-letter path is normalised to `/`
 * instead: `C:\notes\note.md` resolves as `C:/notes/note.md`, and that is the
 * form `readImport` receives. Every Windows file API accepts it.
 *
 * `test/browser-path.test.ts` pins this against `node:path.win32` and
 * `node:path.posix` over the calls the gate makes.
 */

const DRIVE = /^[A-Za-z]:[\\/]/;

export const sep = "/";

export function isAbsolute(p: string): boolean {
  return p.startsWith("/") || DRIVE.test(p);
}

export function resolve(...parts: string[]): string {
  const last = parts.findLastIndex((p) => DRIVE.test(p));
  if (last < 0) return posixResolve(...parts);
  let drive = "";
  let segments: string[] = [];
  for (const part of parts.slice(last)) {
    if (part.length === 0) continue;
    if (DRIVE.test(part)) {
      drive = part.slice(0, 2);
      segments = part.slice(3).split(/[\\/]/);
    } else if (part.startsWith("/") || part.startsWith("\\")) {
      segments = part.slice(1).split(/[\\/]/);
    } else {
      segments.push(...part.split(/[\\/]/));
    }
  }
  const out: string[] = [];
  for (const segment of segments) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return drive + "/" + out.join("/");
}

export function dirname(p: string): string {
  if (!DRIVE.test(p)) return posixDirname(p);
  const norm = p.replace(/\\/g, "/");
  let end = norm.length;
  while (end > 3 && norm[end - 1] === "/") end--;
  const cut = norm.lastIndexOf("/", end - 1);
  return cut <= 2 ? norm.slice(0, 3) : norm.slice(0, cut);
}

export default { sep, isAbsolute, dirname, resolve };
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd packages/markdown-it-visimark && bun test test/browser-path.test.ts && bun run typecheck`
Expected: 4 pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/markdown-it-visimark bun.lock
git commit -m "feat(markdown-it-visimark): package scaffold and Windows-aware path shim (#373)" -m "<trailer>"
```

---

### Task 2: The engine pass and its single-entry cache

**Files:**
- Create: `packages/markdown-it-visimark/src/types.ts`
- Create: `packages/markdown-it-visimark/src/pass.ts`
- Test: `packages/markdown-it-visimark/test/pass.test.ts`
- Create: `packages/markdown-it-visimark/test/fixtures/three-anchors.md`

**Interfaces:**
- Consumes: from `../../visimark/src/browser.js` (the engine's browser entry, imported relatively): `locate`, `build`, `check`, `memoryReader`, types `CheckResult`, `DocModel`; from `../../codemirror-visimark/src/import-deps.js`: `importDependentNames(model): ReadonlySet<string>`.
- Produces (`types.ts`): `ReadImportSync = (path: string) => string | null`; `MarkdownItVisimarkOptions { path?: (env: unknown) => string | null; readImport?: ReadImportSync }`; structural markdown-it types `Token`, `TokenCtor`, `RenderRule`, `MarkdownItLike` (below).
- Produces (`pass.ts`): `interface Pass { model: DocModel; result: CheckResult; withheld: ReadonlySet<string> }`; `runPass(source: string, path: string | null, readImport: ReadImportSync | undefined): Pass`; `passCache(readImport): (source: string, path: string | null) => Pass`.

- [ ] **Step 1: Write the types**

`src/types.ts`:

```ts
/**
 * The public option types, and the structural slice of markdown-it this
 * package touches. There is no `markdown-it` dependency or peer (spec §2.1):
 * the plugin only uses the instance it is handed, so these describe that
 * instance rather than importing its declarations.
 */

/**
 * Read one absolute path the engine's gate has already accepted. Return the
 * file's UTF-8 text, or null when the read does not happen. Synchronous —
 * `codemirror-visimark`'s `ReadImport` is the asynchronous one.
 */
export type ReadImportSync = (path: string) => string | null;

export interface MarkdownItVisimarkOptions {
  /** Filesystem path of the document being rendered, from the render `env`, or null. */
  path?: (env: unknown) => string | null;
  readImport?: ReadImportSync;
}

export type Attr = [string, string];

export interface Token {
  type: string;
  tag: string;
  nesting: number;
  attrs: Attr[] | null;
  map: [number, number] | null;
  content: string;
  info: string;
  children: Token[] | null;
  block: boolean;
  attrSet(name: string, value: string): void;
}

export type TokenCtor = new (type: string, tag: string, nesting: number) => Token;

export interface RenderOptions {
  html?: boolean;
}

export interface RendererLike {
  render(tokens: Token[], options: RenderOptions, env: unknown): string;
  renderToken(tokens: Token[], idx: number, options: RenderOptions): string;
  rules: Record<string, RenderRule | undefined>;
}

export type RenderRule = (
  tokens: Token[],
  idx: number,
  options: RenderOptions,
  env: unknown,
  self: RendererLike,
) => string;

export interface CoreStateLike {
  src: string;
  tokens: Token[];
  Token: TokenCtor;
}

export interface MarkdownItLike {
  core: { ruler: { push(name: string, rule: (state: CoreStateLike) => void): void } };
  renderer: RendererLike;
  utils: { escapeHtml(s: string): string };
}
```

- [ ] **Step 2: Write the fixture**

`test/fixtures/three-anchors.md` — exactly the spec §4 fixture:

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

Run: `bun run packages/visimark/src/cli/main.ts check packages/markdown-it-visimark/test/fixtures/three-anchors.md` from the repo root.
Expected: `0 problems (0 stale, 0 errors)`, exit 0.

- [ ] **Step 3: Write the failing pass tests**

`test/pass.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { passCache, runPass } from "../src/pass.js";

const repo = join(import.meta.dir, "..", "..", "..");
const csvDoc = join(repo, "docs", "example-invoice-csv-import.md");
const csvSource = readFileSync(csvDoc, "utf8");
const disk = (p: string): string | null => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

test("no path or no reader: check runs without a doc and import-dependent names are withheld", () => {
  for (const [path, reader] of [
    [null, disk],
    [csvDoc, undefined],
  ] as const) {
    const pass = runPass(csvSource, path, reader);
    expect(pass.result.findings.filter((f) => f.code === "IMPORT")).toEqual([]);
    expect(pass.withheld.size).toBeGreaterThan(0);
  }
});

test("path and reader: imports resolve through the gate and nothing is withheld", () => {
  const asked: string[] = [];
  const pass = runPass(csvSource, csvDoc, (p) => {
    asked.push(p);
    return disk(p);
  });
  expect(pass.result.findings).toEqual([]);
  expect(pass.withheld.size).toBe(0);
  // the reader is called with the absolute, gated path, once per path
  for (const p of asked) expect(p.startsWith(dirname(resolve(csvDoc)))).toBe(true);
  expect(new Set(asked).size).toBe(asked.length);
});

test("a reader that returns null yields IMPORT and withholds every import-dependent name", () => {
  const pass = runPass(csvSource, csvDoc, () => null);
  expect(pass.result.findings.some((f) => f.code === "IMPORT")).toBe(true);
  expect(pass.withheld.size).toBeGreaterThan(0);
});

test("the cache holds one entry keyed on (source, path)", () => {
  let reads = 0;
  const get = passCache((p) => {
    reads++;
    return disk(p);
  });
  const a = get(csvSource, csvDoc);
  expect(get(csvSource, csvDoc)).toBe(a);
  const afterFirst = reads;
  expect(afterFirst).toBeGreaterThan(0);
  get(csvSource, csvDoc);
  expect(reads).toBe(afterFirst);
  expect(get(csvSource, null)).not.toBe(a);
  expect(get(csvSource + "\n", csvDoc)).not.toBe(a);
  expect(get(csvSource, csvDoc)).not.toBe(a); // the single entry was replaced
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `cd packages/markdown-it-visimark && bun test test/pass.test.ts`
Expected: FAIL — cannot resolve `../src/pass.js`.

- [ ] **Step 5: Implement the pass**

`src/pass.ts`:

```ts
// Relative, not `visimark`: `memoryReader` is exported only by the engine's
// browser entry, and every resolver that compiles this file — this package's
// tsconfig, Bun.build, and the VS Code extension's esbuild and tsc — agrees on
// a relative path without a mapping of its own.
import {
  build,
  check,
  locate,
  memoryReader,
  type CheckResult,
  type DocModel,
} from "../../visimark/src/browser.js";
import { importDependentNames } from "../../codemirror-visimark/src/import-deps.js";
import type { ReadImportSync } from "./types.js";

/**
 * One engine pass over a rendered document (spec §2.3, §2.6).
 *
 * `check` gets a document file only when there is both a path and a reader;
 * otherwise imports are skipped and produce no `IMPORT`. Import-dependent
 * names are withheld when there was no document file or when any `IMPORT`
 * was reported — one failed import withholds them all, as
 * `codemirror-visimark`'s snapshot pass does.
 */
export interface Pass {
  model: DocModel;
  result: CheckResult;
  withheld: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

export function runPass(
  source: string,
  path: string | null,
  readImport: ReadImportSync | undefined,
): Pass {
  const model = build(locate(source));
  // membership comes from the fences' own `from` clauses, so it is asked
  // before `check` populates imported sheets (import-deps.ts explains why)
  const dependent = importDependentNames(model);
  if (path === null || readImport === undefined) {
    return { model, result: check(model), withheld: dependent };
  }
  // The gate and the import phase each ask about a path; read it once.
  const memo = new Map<string, string | null>();
  const lookup = (p: string): string | null => {
    if (!memo.has(p)) memo.set(p, readImport(p));
    return memo.get(p) ?? null;
  };
  const result = check(model, { doc: { path, reader: memoryReader(lookup) } });
  const failed = result.findings.some((f) => f.code === "IMPORT");
  return { model, result, withheld: failed ? dependent : NONE };
}

/**
 * One cached pass per plugin instance, keyed on (source, path). VS Code
 * renders the same unchanged text repeatedly and shares one `md` across every
 * preview, which is why this lives in the plugin's closure and never on `md`.
 */
export function passCache(
  readImport: ReadImportSync | undefined,
): (source: string, path: string | null) => Pass {
  let last: { source: string; path: string | null; pass: Pass } | null = null;
  return (source, path) => {
    if (last === null || last.source !== source || last.path !== path) {
      last = { source, path, pass: runPass(source, path, readImport) };
    }
    return last.pass;
  };
}
```

If `memoryReader` or the `CheckOptions.doc` field is not exported under these names from `packages/visimark/src/browser.ts`, read that file and `packages/visimark/src/eval/check.ts:103` and use the exported names; do not add an export to the engine.

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd packages/markdown-it-visimark && bun test test/pass.test.ts && bun run typecheck`
Expected: 4 pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/markdown-it-visimark
git commit -m "feat(markdown-it-visimark): engine pass with a single-entry cache (#373)" -m "<trailer>"
```

---

### Task 3: Placing marks, and the render wrapper

**Files:**
- Create: `packages/markdown-it-visimark/src/place.ts`
- Create: `packages/markdown-it-visimark/src/index.ts`
- Test: `packages/markdown-it-visimark/test/render.test.ts`
- Create: `packages/markdown-it-visimark/test/fixtures/three-anchors.html` (the expected marked HTML)

**Interfaces:**
- Consumes: `Pass`, `passCache` (Task 2); `decorationsFor`, `type Decoration` from `../../codemirror-visimark/src/decorations.js`; types from `types.ts`.
- Produces (`place.ts`): `place(tokens: Token[], source: string, pass: Pass, path: string | null, Tok: TokenCtor): Token[]` — a new array; the input is unchanged.
- Produces (`index.ts`): `export default function markdownItVisimark(md: unknown, options?: MarkdownItVisimarkOptions): void`; `export type { MarkdownItVisimarkOptions, ReadImportSync }`. Task 4 adds the fence wrapper to the same function.

- [ ] **Step 1: Write the expected HTML**

`test/fixtures/three-anchors.html` (the final newline is part of it):

```html
<p>Total <strong class="visimark-computed" data-vmark="s.total">12.50</strong><!--vmark=s.total-->, subtotal <span class="visimark-computed" data-vmark="s.sub">10.00</span><!--vmark=s.sub--> and tax <code class="visimark-computed" data-vmark="s.tax">2.50</code><!--vmark=s.tax-->.</p>
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
<td style="text-align:right"><span class="visimark-computed" data-vmark="s.Net" data-vmark-row="0">10.00</span></td>
</tr>
</tbody>
</table>
<pre data-vmark-info="#s"><code class="language-vmark">Net precision 2 = Qty * 5
sub precision 2 = SUM(Net)
tax precision 2 = sub * 0.25
total precision 2 = sub + tax
</code></pre>
```

The `<pre data-vmark-info="#s">` line is Task 4's; until then the render tests below compare against this file with ` data-vmark-info="#s"` removed (`expected.replace(' data-vmark-info="#s"', "")`), and Task 4 deletes that `replace`.

- [ ] **Step 2: Write the failing render tests**

`test/render.test.ts`:

```ts
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import visimark from "../src/index.js";

const fixtures = join(import.meta.dir, "fixtures");
const source = readFileSync(join(fixtures, "three-anchors.md"), "utf8");
const expected = readFileSync(join(fixtures, "three-anchors.html"), "utf8").replace(
  ' data-vmark-info="#s"',
  "",
);
const plain = (src: string, html = true): string => new MarkdownIt({ html }).render(src);
const marked = (opts?: Parameters<typeof visimark>[1], html = true): InstanceType<typeof MarkdownIt> =>
  new MarkdownIt({ html }).use(visimark, opts);

test("the fixture renders exactly the spec's marked HTML", () => {
  expect(marked().render(source)).toBe(expected);
});

test("path adds data-vmark-path last on every mark, never on the fence", () => {
  const out = marked({ path: () => "/tmp/note.md" }).render(source);
  expect(out).toContain(
    '<strong class="visimark-computed" data-vmark="s.total" data-vmark-path="/tmp/note.md">',
  );
  expect(out).toContain(
    '<span class="visimark-computed" data-vmark="s.Net" data-vmark-row="0" data-vmark-path="/tmp/note.md">',
  );
  expect(out.match(/data-vmark-path=/g)?.length).toBe(4);
});

test("a stale cell is visimark-disagrees; the prose marks stay computed", () => {
  const out = marked().render(source.replace("| 10.00 |", "| 9.00 |"));
  expect(out).toContain(
    '<span class="visimark-computed visimark-disagrees" data-vmark="s.Net" data-vmark-row="0">9.00</span>',
  );
  expect(out.match(/visimark-disagrees/g)?.length).toBe(1);
});

test("html: false is byte-identical to markdown-it without the plugin", () => {
  expect(marked(undefined, false).render(source)).toBe(plain(source, false));
});

test("a document with no vmark fence is byte-identical", () => {
  const doc = "Total **12.50**<!--vmark=s.total-->.\n\n| a |\n|---|\n| 1 |\n";
  expect(marked().render(doc)).toBe(plain(doc));
});

test("VS Code's shape: parse with one env, render with another; path comes from the render env", () => {
  const md = marked({ path: (env) => (env as { file?: string } | undefined)?.file ?? null });
  const tokens = md.parse(source, {});
  const out = md.renderer.render(tokens, md.options, { file: "/tmp/note.md" });
  expect(out).toContain('data-vmark-path="/tmp/note.md"');
});

test("the host's tokens are never mutated, and a second render is identical", () => {
  const md = marked();
  const tokens = md.parse(source, {});
  const before = JSON.stringify(tokens);
  const first = md.renderer.render(tokens, md.options, {});
  const second = md.renderer.render(tokens, md.options, {});
  expect(second).toBe(first);
  expect(JSON.stringify(tokens)).toBe(before);
});

test("two documents alternating on one instance each get only their own marks", () => {
  const md = marked();
  const other = source.replaceAll("s.", "t.").replace("```vmark #s", "```vmark #t");
  expect(md.render(source)).toBe(expected);
  expect(md.render(other)).not.toContain('data-vmark="s.');
  expect(md.render(source)).toBe(expected);
});

test("the same instance follows the path of each render", () => {
  const md = marked({ path: (env) => (env as { p?: string }).p ?? null });
  expect(md.render(source, { p: "/a.md" })).toContain('data-vmark-path="/a.md"');
  expect(md.render(source, { p: "/b.md" })).toContain('data-vmark-path="/b.md"');
  expect(md.render(source, {})).not.toContain("data-vmark-path");
});

test("a value whose rendered text no longer matches its source is left unmarked", () => {
  // a rewrite in the spirit of linkify: the bare value's text token no longer ends in it
  const md = new MarkdownIt({ html: true });
  md.core.ruler.push("rewrite", (state) => {
    for (const t of state.tokens) {
      for (const c of t.children ?? []) if (c.content.endsWith("10.00")) c.content += "x";
    }
  });
  md.use(visimark);
  const out = md.render(source);
  expect(out).not.toContain('data-vmark="s.sub"');
  expect(out).toContain('data-vmark="s.total"');
  // a cell is addressed by position and its inline content is still the source's
  expect(out).toContain('data-vmark="s.Net"');
});

test("path() or readImport throwing renders the host's own HTML", () => {
  const boom = (): never => {
    throw new Error("boom");
  };
  // from Task 4 on the fence wrapper still adds data-vmark-info, so compare without it
  const bare = (html: string): string => html.replace(/ data-vmark-info="[^"]*"/g, "");
  expect(bare(marked({ path: boom }).render(source))).toBe(plain(source));
  const csvPath = join(import.meta.dir, "..", "..", "..", "docs", "example-invoice-csv-import.md");
  const csv = readFileSync(csvPath, "utf8");
  expect(bare(marked({ path: () => csvPath, readImport: boom }).render(csv))).toBe(plain(csv));
});
```

The pass cache itself (one engine run per `(source, path)`) is asserted in `pass.test.ts`; this file asserts what the HTML shows.

- [ ] **Step 3: Run them to verify they fail**

Run: `cd packages/markdown-it-visimark && bun test test/render.test.ts`
Expected: FAIL — cannot resolve `../src/index.js`.

- [ ] **Step 4: Implement `place.ts`**

```ts
import { decorationsFor, type Decoration } from "../../codemirror-visimark/src/decorations.js";
import type { Pass } from "./pass.js";
import type { Attr, Token, TokenCtor } from "./types.js";

/**
 * Apply the marks `decorationsFor` lists to a **copy** of a token stream
 * (spec §2.4, §2.6). The host's array and tokens are never written: a touched
 * `inline` token is cloned with a new `children` array, a touched child is
 * cloned with its own `attrs`, and the wrapping `<span>`s are new
 * `visimark_open` / `visimark_close` tokens that markdown-it's default
 * `renderToken` renders.
 *
 * A decoration is placed only where the rendered text equals the source text
 * of its span. Anything else — a value another plugin rewrote, a table the
 * engine read from a CSV — is skipped, never placed on a neighbour.
 */

interface Span {
  start: number;
  end: number;
}

function lineStarts(source: string): number[] {
  const out = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") out.push(i + 1);
  return out;
}

function lineOf(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function clone(t: Token): Token {
  const c = Object.assign(Object.create(Object.getPrototypeOf(t) as object), t) as Token;
  c.attrs = t.attrs ? t.attrs.map((a): Attr => [a[0], a[1]]) : null;
  return c;
}

function mark(t: Token, d: Decoration, path: string | null): void {
  t.attrSet("class", d.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed");
  t.attrSet("data-vmark", d.name);
  if (d.kind === "cell") t.attrSet("data-vmark-row", String(d.row));
  if (path !== null) t.attrSet("data-vmark-path", path);
}

function wrap(Tok: TokenCtor, d: Decoration, path: string | null): [Token, Token] {
  const open = new Tok("visimark_open", "span", 1);
  mark(open, d, path);
  return [open, new Tok("visimark_close", "span", -1)];
}

export function place(
  tokens: Token[],
  source: string,
  pass: Pass,
  path: string | null,
  Tok: TokenCtor,
): Token[] {
  const decorations = decorationsFor(pass.model, pass.result).filter(
    (d) => !pass.withheld.has(d.name),
  );
  if (decorations.length === 0) return tokens;

  const starts = lineStarts(source);
  const text = (s: Span): string => source.slice(s.start, s.end);

  // Anchors, in document order, each still waiting for its comment token.
  const byValue = new Map<number, Decoration>();
  for (const d of decorations) if (d.kind === "anchor") byValue.set(d.span.start, d);
  const anchors = pass.model.located.anchors.flatMap((a) => {
    const d = a.value === null ? undefined : byValue.get(a.value.start);
    return d === undefined
      ? []
      : [{ comment: text(a.commentSpan), line: lineOf(starts, a.commentSpan.start), d, done: false }];
  });

  // Cells, by the source line of the document table they sit in. A sheet
  // whose table came from a CSV is not in `located.tables` and is skipped.
  const documentTables = new Set(pass.model.located.tables);
  const cellsAt = new Map<number, { d: Decoration; source: string }[]>();
  for (const sheet of pass.model.sheets.values()) {
    const table = sheet.table;
    if (table === null || !documentTables.has(table)) continue;
    const line = lineOf(starts, table.span.start);
    const list = cellsAt.get(line) ?? [];
    for (const d of decorations) {
      if (d.kind !== "cell") continue;
      const cell = table.rows[d.row!]?.cells[d.column!];
      if (cell === undefined || cell.start !== d.span.start || cell.cellSpan === undefined) continue;
      list.push({ d, source: text(cell.cellSpan) });
    }
    cellsAt.set(line, list);
  }

  const out = tokens.slice();
  let range: [number, number] | null = null;
  let cells: { d: Decoration; source: string }[] | null = null;
  let inBody = false;
  let row = -1;
  let column = -1;

  for (let i = 0; i < out.length; i++) {
    const t = out[i]!;
    if (t.map !== null && t.nesting === 1) range = t.map;
    switch (t.type) {
      case "table_open":
        cells = t.map === null ? null : (cellsAt.get(t.map[0]) ?? null);
        inBody = false;
        row = -1;
        continue;
      case "table_close":
        cells = null;
        continue;
      case "tbody_open":
        inBody = true;
        continue;
      case "tr_open":
        if (inBody) row++;
        column = -1;
        continue;
      case "td_open":
      case "th_open":
        column++;
        continue;
      case "inline":
        break;
      default:
        continue;
    }

    let owned: Token | null = null;
    const own = (): Token => {
      if (owned === null) {
        owned = clone(t);
        owned.children = (t.children ?? []).slice();
        out[i] = owned;
      }
      return owned;
    };

    if (cells !== null && inBody && out[i - 1]?.type === "td_open") {
      const hit = cells.find((c) => c.d.row === row && c.d.column === column);
      if (hit !== undefined && hit.source === t.content.trim()) {
        const c = own();
        const [open, close] = wrap(Tok, hit.d, path);
        c.children = [open, ...c.children!, close];
      }
    }

    if (range === null) continue;
    const [from, to] = range;
    for (const comment of t.children ?? []) {
      if (comment.type !== "html_inline") continue;
      const a = anchors.find(
        (x) => !x.done && x.comment === comment.content && x.line >= from && x.line < to,
      );
      if (a === undefined) continue;
      a.done = true;
      const want = text(a.d.span);
      const children = own().children!;
      let j = children.indexOf(comment) - 1;
      while (j >= 0 && children[j]!.type === "text" && children[j]!.content === "") j--;
      const prev = children[j];
      if (prev === undefined) continue;
      const kind = a.d.anchorKind;
      if (
        (kind === "strong" && prev.type === "strong_close") ||
        (kind === "emphasis" && prev.type === "em_close")
      ) {
        const openType = kind === "strong" ? "strong_open" : "em_open";
        let o = j - 1;
        while (o >= 0 && children[o]!.type !== openType) o--;
        if (o < 0) continue;
        const inner = children.slice(o + 1, j).map((x) => x.content).join("");
        if (inner !== want) continue;
        const opened = clone(children[o]!);
        mark(opened, a.d, path);
        children[o] = opened;
      } else if (kind === "inlineCode" && prev.type === "code_inline") {
        if (prev.content !== want) continue;
        const code = clone(prev);
        mark(code, a.d, path);
        children[j] = code;
      } else if (kind === "text" && prev.type === "text" && prev.content.endsWith(want)) {
        const before = clone(prev);
        before.content = prev.content.slice(0, prev.content.length - want.length);
        const value = clone(prev);
        value.content = want;
        const [open, close] = wrap(Tok, a.d, path);
        children.splice(j, 1, ...(before.content === "" ? [] : [before]), open, value, close);
      }
    }
  }
  return out;
}
```

Notes for the implementer, decided here so nothing is invented later:
- `range` is the `map` of the most recent opening block token, so an inline token inside a `td` (which has no `map`) uses its `tr_open`'s line. That is how an anchor inside a table cell is found.
- A `children.indexOf(comment)` search is used because earlier splices in the same inline token shift indices.
- If `sheet.table`, `table.span`, `cell.cellSpan` or `located.tables` do not have these names, read `packages/visimark/src/parse/document.ts` (`RawTable`, `RawCell`, `LocatedDoc`) and `packages/visimark/src/model/types.ts:156`; the logic stays the same.

- [ ] **Step 5: Implement `index.ts`**

```ts
import { passCache } from "./pass.js";
import { place } from "./place.js";
import type { MarkdownItLike, MarkdownItVisimarkOptions, Token, TokenCtor } from "./types.js";

export type { MarkdownItVisimarkOptions, ReadImportSync } from "./types.js";

/**
 * The markdown-it plugin (spec §2). `md.use(markdownItVisimark, options?)`.
 *
 * The core rule only remembers which source produced which token array; the
 * marks are applied by the render wrapper, with the **render** `env`. A host
 * may parse and render separately and cache the tokens in between — VS Code
 * does both, and parses with an `env` that has no document — so an engine
 * pass at parse time would never see the path and would bake marks into the
 * host's cache (spec §2.6).
 */
const sources = new WeakMap<Token[], { source: string; Tok: TokenCtor }>();

// `md: unknown`, as the published declaration says: any markdown-it instance
// satisfies it, so no markdown-it type is part of this package's contract, and
// markdown-it's own (stricter) declarations cannot disagree with ours.
export default function markdownItVisimark(
  instance: unknown,
  options: MarkdownItVisimarkOptions = {},
): void {
  const md = instance as MarkdownItLike;
  const pathOf = options.path ?? ((): null => null);
  const passFor = passCache(options.readImport);

  md.core.ruler.push("visimark", (state) => {
    sources.set(state.tokens, { source: state.src, Tok: state.Token });
  });

  const render = md.renderer.render;
  md.renderer.render = function (this: unknown, tokens, opts, env) {
    const seen = sources.get(tokens);
    if (seen === undefined || opts.html !== true) return render.call(this, tokens, opts, env);
    let out = tokens;
    try {
      const path = pathOf(env);
      const pass = passFor(seen.source, path);
      if (pass.model.located.blocks.length > 0) out = place(tokens, seen.source, pass, path, seen.Tok);
    } catch {
      out = tokens;
    }
    return render.call(this, out, opts, env);
  };
}
```

- [ ] **Step 6: Run the tests, typecheck, lint**

Run: `cd packages/markdown-it-visimark && bun test && bun run typecheck && cd ../.. && bun run lint`
Expected: all pass; clean.

- [ ] **Step 7: Commit**

```bash
git add packages/markdown-it-visimark
git commit -m "feat(markdown-it-visimark): place marks on a copy of the tokens at render time (#373)" -m "<trailer>"
```

---

### Task 4: `data-vmark-info` on the fence

**Files:**
- Create: `packages/markdown-it-visimark/src/fence.ts`
- Modify: `packages/markdown-it-visimark/src/index.ts`
- Test: `packages/markdown-it-visimark/test/fence.test.ts`
- Modify: `packages/markdown-it-visimark/test/render.test.ts` (drop the `data-vmark-info` `replace`)

**Interfaces:**
- Consumes: `MarkdownItLike`, `RenderRule` (Task 2).
- Produces: `vmarkInfo(info: string): string | null`; `injectInfo(html: string, value: string, escapeHtml: (s: string) => string): string`; `wrapFence(md: MarkdownItLike): void`, called from `markdownItVisimark`.

- [ ] **Step 1: Write the failing tests**

`test/fence.test.ts`:

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import visimark from "../src/index.js";
import { injectInfo, vmarkInfo } from "../src/fence.js";

if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

const fence = (info: string, body = "a = 1\n"): string => "```" + info + "\n" + body + "```\n";
const md = (opts: ConstructorParameters<typeof MarkdownIt>[0] = { html: true }): InstanceType<typeof MarkdownIt> =>
  new MarkdownIt(opts).use(visimark);

test("vmarkInfo takes the rest of the info string after the word vmark", () => {
  expect(vmarkInfo("vmark #order from rows.csv labelled Item, Qty")).toBe(
    "#order from rows.csv labelled Item, Qty",
  );
  expect(vmarkInfo("vmark")).toBe("");
  expect(vmarkInfo("vmark   #s")).toBe("#s");
  expect(vmarkInfo("vmarkx #s")).toBeNull();
  expect(vmarkInfo("js")).toBeNull();
});

test("the first opening tag gets the attribute; one already there is kept", () => {
  const esc = new MarkdownIt().utils.escapeHtml;
  expect(injectInfo('<pre><code class="language-vmark">x</code></pre>\n', "#s", esc)).toBe(
    '<pre data-vmark-info="#s"><code class="language-vmark">x</code></pre>\n',
  );
  expect(injectInfo('<pre class="hljs"><code>x</code></pre>', "#s", esc)).toBe(
    '<pre class="hljs" data-vmark-info="#s"><code>x</code></pre>',
  );
  expect(injectInfo('<pre data-vmark-info="#t"><code>x</code></pre>', "#s", esc)).toBe(
    '<pre data-vmark-info="#t"><code>x</code></pre>',
  );
  expect(injectInfo("<div>x</div>", "#s", esc)).toBe("<div>x</div>");
});

test("escaping round-trips through an HTML parser", () => {
  const out = md().render(fence(`vmark #s "a<b>&'"`));
  expect(out).toContain(`data-vmark-info="#s &quot;a&lt;b&gt;&amp;'&quot;"`);
  const host = document.createElement("div");
  host.innerHTML = out;
  expect(host.querySelector("pre")!.getAttribute("data-vmark-info")).toBe(`#s "a<b>&'"`);
});

test("a highlight callback that returns its own <pre> still gets the attribute", () => {
  const out = md({ html: true, highlight: () => '<pre class="hl"><code>x</code></pre>' }).render(
    fence("vmark #s"),
  );
  expect(out.startsWith('<pre class="hl" data-vmark-info="#s">')).toBe(true);
});

test("a fence that is not vmark, and html: false, are untouched", () => {
  expect(md().render(fence("js"))).toBe(new MarkdownIt({ html: true }).render(fence("js")));
  expect(md({ html: false }).render(fence("vmark #s"))).toBe(
    new MarkdownIt({ html: false }).render(fence("vmark #s")),
  );
});

test("a fence rule replaced before this plugin is called, not lost", () => {
  const m = new MarkdownIt({ html: true });
  const prev = m.renderer.rules.fence!;
  m.renderer.rules.fence = (t, i, o, e, s) => '<div class="wrap">' + prev(t, i, o, e, s) + "</div>";
  m.use(visimark);
  // first tag is <div>, so the spec says: unchanged
  expect(m.render(fence("vmark #s"))).not.toContain("data-vmark-info");
});
```

In `render.test.ts`, change `expected` to the file contents unchanged (delete the `.replace(...)`).

- [ ] **Step 2: Run them to verify they fail**

Run: `cd packages/markdown-it-visimark && bun test`
Expected: FAIL — `../src/fence.js` missing; the fixture test fails on `<pre data-vmark-info="#s">`.

- [ ] **Step 3: Implement**

`src/fence.ts`:

```ts
import type { MarkdownItLike } from "./types.js";

/**
 * `data-vmark-info` (spec §2.5): the fence's info string after the word
 * `vmark`, so a rendered sheet keeps its id, `from` clause and column labels
 * (`#order from rows.csv labelled Item, Qty`) that HTML would otherwise drop.
 *
 * It is injected into the first opening tag of whatever the fence renderer
 * this one replaced produced, rather than set on `token.attrs`: markdown-it
 * drops `token.attrs` when a host's `highlight` returns its own `<pre>`.
 */

export function vmarkInfo(info: string): string | null {
  const m = /^vmark(?:\s+([\s\S]*))?$/.exec(info);
  return m === null ? null : (m[1] ?? "");
}

export function injectInfo(html: string, value: string, escapeHtml: (s: string) => string): string {
  const first = /<([A-Za-z][\w-]*)([^>]*)>/.exec(html);
  if (first === null || (first[1] !== "pre" && first[1] !== "code")) return html;
  if (/\sdata-vmark-info=/.test(first[2]!)) return html;
  const at = first.index + first[0].length - 1;
  return html.slice(0, at) + ` data-vmark-info="${escapeHtml(value)}"` + html.slice(at);
}

export function wrapFence(md: MarkdownItLike): void {
  const prev = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const html = prev ? prev(tokens, idx, opts, env, self) : self.renderToken(tokens, idx, opts);
    if (opts.html !== true) return html;
    const value = vmarkInfo(tokens[idx]!.info);
    return value === null ? html : injectInfo(html, value, md.utils.escapeHtml);
  };
}
```

In `index.ts`, import `wrapFence` and call `wrapFence(md);` as the last line of `markdownItVisimark`.

- [ ] **Step 4: Run the tests, typecheck, lint**

Run: `cd packages/markdown-it-visimark && bun test && bun run typecheck && cd ../.. && bun run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/markdown-it-visimark
git commit -m "feat(markdown-it-visimark): data-vmark-info on the rendered vmark fence (#373)" -m "<trailer>"
```

---

### Task 5: Acceptance against the example documents and other plugins

**Files:**
- Test: `packages/markdown-it-visimark/test/acceptance.test.ts`
- Create: `packages/markdown-it-visimark/test/footnote.d.ts`

**Interfaces:**
- Consumes: the default export (Tasks 3–4); `runPass` (Task 2); `decorationsFor` and `importDependentNames` from `../../codemirror-visimark/src/`.

- [ ] **Step 1: Write the tests**

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decorationsFor } from "../../codemirror-visimark/src/decorations.js";
import { importDependentNames } from "../../codemirror-visimark/src/import-deps.js";
import visimark from "../src/index.js";
import { runPass } from "../src/pass.js";

if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

const repo = join(import.meta.dir, "..", "..", "..");
const read = (p: string): string => readFileSync(p, "utf8");
const doc = (name: string): string => join(repo, "docs", name);
const fixture = read(join(import.meta.dir, "fixtures", "three-anchors.md"));
const disk = (p: string): string | null => {
  try {
    return read(p);
  } catch {
    return null;
  }
};
const parse = (html: string): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};

test("drift invoice: one visimark-disagrees per decoration on an exact STALE span", () => {
  const source = read(doc("example-invoice-drift.md"));
  const pass = runPass(source, null, undefined);
  const want = decorationsFor(pass.model, pass.result).filter(
    (d) => d.mark === "disagrees" && !pass.withheld.has(d.name),
  ).length;
  expect(want).toBeGreaterThan(0);
  const el = parse(new MarkdownIt({ html: true }).use(visimark).render(source));
  expect(el.querySelectorAll(".visimark-disagrees").length).toBe(want);
});

test("a clean example has computed marks and no disagrees", () => {
  const el = parse(new MarkdownIt({ html: true }).use(visimark).render(read(doc("example-invoice.md"))));
  expect(el.querySelectorAll(".visimark-computed").length).toBeGreaterThan(0);
  expect(el.querySelectorAll(".visimark-disagrees").length).toBe(0);
});

test("CSV import: withheld without a reader or a path, present with both", () => {
  const path = doc("example-invoice-csv-import.md");
  const source = read(path);
  const pass = runPass(source, path, disk);
  const dependent = importDependentNames(pass.model);
  const names = (html: string): string[] =>
    [...parse(html).querySelectorAll("[data-vmark]")].map((e) => e.getAttribute("data-vmark")!);

  const without = names(new MarkdownIt({ html: true }).use(visimark, { readImport: disk }).render(source));
  const noPath = names(
    new MarkdownIt({ html: true }).use(visimark, { path: () => null, readImport: disk }).render(source),
  );
  const nullReader = names(
    new MarkdownIt({ html: true }).use(visimark, { path: () => path, readImport: () => null }).render(source),
  );
  const withBoth = names(
    new MarkdownIt({ html: true }).use(visimark, { path: () => path, readImport: disk }).render(source),
  );
  for (const list of [without, noPath, nullReader]) {
    expect(list.filter((n) => dependent.has(n))).toEqual([]);
  }
  expect(withBoth.some((n) => dependent.has(n))).toBe(true);
  // every non-dependent mark is present in all four
  for (const n of withBoth.filter((n) => !dependent.has(n))) expect(without).toContain(n);
});

for (const [label, make] of [
  ["typographer", () => new MarkdownIt({ html: true, typographer: true }).use(visimark)],
  ["linkify", () => new MarkdownIt({ html: true, linkify: true }).use(visimark)],
  ["footnote before", () => new MarkdownIt({ html: true }).use(footnote).use(visimark)],
  ["footnote after", () => new MarkdownIt({ html: true }).use(visimark).use(footnote)],
] as const) {
  test(`${label}: the fixture's four marks and data-vmark-info still land`, () => {
    const el = parse(make().render(fixture + "\nA note.[^1]\n\n[^1]: Footnote text.\n"));
    const names = [...el.querySelectorAll("[data-vmark]")].map((e) => e.getAttribute("data-vmark"));
    expect(names.sort()).toEqual(["s.Net", "s.sub", "s.tax", "s.total"]);
    expect(el.querySelector('pre[data-vmark-info="#s"]')).not.toBeNull();
  });
}

test("an unrelated table before the sheet's table: only the sheet's table is marked", () => {
  const source = "| Net |\n|----:|\n| 10.00 |\n\n" + fixture;
  const el = parse(new MarkdownIt({ html: true }).use(visimark).render(source));
  const tables = el.querySelectorAll("table");
  expect(tables[0]!.querySelector("[data-vmark]")).toBeNull();
  expect(tables[1]!.querySelector('td [data-vmark="s.Net"]')).not.toBeNull();
});
```

`markdown-it-footnote` 4 ships no declarations. Add `test/footnote.d.ts`:

```ts
declare module "markdown-it-footnote" {
  const footnote: (md: unknown) => void;
  export default footnote;
}
```

- [ ] **Step 2: Run them**

Run: `cd packages/markdown-it-visimark && bun test test/acceptance.test.ts`
Expected: all pass. A failure here is a mapping bug in Task 3 — fix `place.ts`, never the expectation.

- [ ] **Step 3: Check the example documents still pass `check`**

Run from the repo root: `for f in docs/example-invoice.md docs/example-invoice-drift.md docs/example-invoice-csv-import.md; do bun run packages/visimark/src/cli/main.ts check "$f"; done`
Expected: the clean two exit 0; the drift invoice reports its usual findings (exit 1) — unchanged from `master`.

- [ ] **Step 4: Commit**

```bash
git add packages/markdown-it-visimark
git commit -m "test(markdown-it-visimark): acceptance on the example documents and other plugins (#373)" -m "<trailer>"
```

---

### Task 6: Published build and bundle checks

**Files:**
- Create: `packages/markdown-it-visimark/build.ts`
- Test: `packages/markdown-it-visimark/test/bundle.test.ts`

**Interfaces:**
- Produces: `dist/index.js` (ESM, browser target, minified) and `dist/index.d.ts` (self-contained).

- [ ] **Step 1: Write the failing bundle test**

```ts
import { beforeAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const here = join(import.meta.dir, "..");
const dist = join(here, "dist");

beforeAll(() => {
  const r = Bun.spawnSync(["bun", "run", "build"], { cwd: here, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
});

const text = (f: string): string => readFileSync(join(dist, f), "utf8");

test("index.js and index.d.ts are built, nothing else is published from dist", () => {
  expect(readdirSync(dist).sort()).toEqual(["index.d.ts", "index.js"]);
});

test("no node: specifier survives into the bundle", () => {
  const found = [...text("index.js").matchAll(/["'`](node:[a-z_/]+)["'`]/g)].map((m) => m[1]);
  expect(found).toEqual([]);
});

test("the declarations import nothing and export only the public surface", () => {
  const d = text("index.d.ts");
  expect(/from\s+"/.test(d)).toBe(false);
  for (const name of ["MarkdownItVisimarkOptions", "ReadImportSync"]) expect(d).toContain(name);
});

test("the built bundle renders the fixture", async () => {
  const { default: plugin } = await import(join(dist, "index.js"));
  const { default: MarkdownIt } = await import("markdown-it");
  const fixture = readFileSync(join(here, "test", "fixtures", "three-anchors.md"), "utf8");
  const expected = readFileSync(join(here, "test", "fixtures", "three-anchors.html"), "utf8");
  expect(new MarkdownIt({ html: true }).use(plugin).render(fixture)).toBe(expected);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/markdown-it-visimark && bun test test/bundle.test.ts`
Expected: FAIL — no `build.ts`.

- [ ] **Step 3: Implement `build.ts`**

```ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The published build (#373). One ESM file for any markdown-it host, the
 * engine bundled from its browser-safe source, `decorations.ts` and
 * `import-deps.ts` compiled from `codemirror-visimark`'s source, and
 * `node:path` replaced by `src/browser-path.ts` — so `dist/` has no `node:`
 * specifier and no runtime dependency.
 *
 * Declarations: `tsc -p tsconfig.build.json` (run first by the `build`
 * script) emits into .types/ with rootDir `..`. Only `index.d.ts` is public;
 * its re-exports from `./types.js` are inlined here so the shipped file
 * imports nothing.
 */

const here = import.meta.dir;
const dist = join(here, "dist");
const engineBrowser = resolve(here, "../visimark/src/browser.ts");
const pathShim = resolve(here, "src/browser-path.ts");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(here, "src", "index.ts")],
  outdir: dist,
  target: "browser",
  format: "esm",
  minify: true,
  naming: { entry: "[name].js" },
  plugins: [
    {
      name: "engine-from-source",
      setup(build) {
        build.onResolve({ filter: /^visimark$/ }, () => ({ path: engineBrowser }));
        build.onResolve({ filter: /^node:path$/ }, () => ({ path: pathShim }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const types = join(here, ".types", "markdown-it-visimark", "src");
const publicTypes = readFileSync(join(types, "types.d.ts"), "utf8");
const option = /(?:\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?export type ReadImportSync[\s\S]*?export interface MarkdownItVisimarkOptions \{[\s\S]*?\n\}/.exec(publicTypes);
if (option === null) {
  console.error("types.d.ts no longer starts with ReadImportSync and MarkdownItVisimarkOptions");
  process.exit(1);
}
writeFileSync(
  join(dist, "index.d.ts"),
  option[0] +
    "\n\n/** The markdown-it plugin: `md.use(markdownItVisimark, options?)`. */\n" +
    "declare function markdownItVisimark(md: unknown, options?: MarkdownItVisimarkOptions): void;\n" +
    "export default markdownItVisimark;\n",
);
console.log("markdown-it-visimark: built index");
```

`types.ts` must therefore keep `ReadImportSync` first and `MarkdownItVisimarkOptions` right after it (Task 2 already writes them in that order). The public declaration types `md` as `unknown`, which any markdown-it instance satisfies, so the declarations carry no markdown-it type and no structural type a newer markdown-it could contradict.

- [ ] **Step 4: Run, typecheck, lint, format**

Run: `cd packages/markdown-it-visimark && bun test && bun run typecheck && cd ../.. && bun run lint && bun run format:check`
Expected: all pass. Run `bun run build` at the root too: the new package's `build` runs under `--filter '*'`.

- [ ] **Step 5: Commit**

```bash
git add packages/markdown-it-visimark
git commit -m "build(markdown-it-visimark): published ESM bundle with self-contained declarations (#373)" -m "<trailer>"
```

---

### Task 7: VS Code preview adoption

**Files:**
- Modify: `editors/vscode/package.json` (`contributes`)
- Create: `editors/vscode/media/preview.css`
- Modify: `editors/vscode/src/extension.ts`
- Create: `editors/vscode/src/preview.ts`
- Modify: `editors/vscode/esbuild.mjs`
- Modify: `editors/vscode/tsconfig.json`
- Modify: `editors/vscode/test/host.ts`
- Test: `editors/vscode/test/preview.test.ts`

**Interfaces:**
- Consumes: the default export and `MarkdownItVisimarkOptions` from `markdown-it-visimark` (resolved to `packages/markdown-it-visimark/src/index.ts`).
- Produces: `previewOptions(): MarkdownItVisimarkOptions` and `extendMarkdownIt(md)` in `src/preview.ts`; `activate` returns `{ extendMarkdownIt }`.

- [ ] **Step 1: Contribute the preview and the setting**

In `editors/vscode/package.json` `contributes`, add beside `commands` and `configuration`:

```json
"markdown.markdownItPlugins": true,
"markdown.previewStyles": ["./media/preview.css"],
```

and in `configuration.properties`, after `visimark.enable`:

```json
"visimark.preview.enable": {
  "type": "boolean",
  "default": true,
  "markdownDescription": "Mark computed values in the built-in Markdown preview, and flag the ones that disagree with their formulas. Independent of `visimark.enable`, which switches the language server."
},
```

`editors/vscode/media/preview.css`:

```css
.visimark-computed { text-decoration: underline dotted; }
.visimark-disagrees { text-decoration-color: red; }
```

Check that `.vscodeignore` (if present) does not exclude `media/`; `vsce package` must include it.

- [ ] **Step 2: Resolve the plugin from source**

`editors/vscode/esbuild.mjs` — beside `engineSrc`:

```js
const markdownItSrc = join(here, "..", "..", "packages", "markdown-it-visimark", "src", "index.ts");
```

and extend the existing `alias` (keep its comment; add one line saying the plugin is bundled from source for the same reason):

```js
  alias: { visimark: engineSrc, "markdown-it-visimark": markdownItSrc },
```

The plugin's `pass.ts` imports the engine's browser entry relatively (Task 2), and `decorations.ts` / `import-deps.ts` import `visimark`, which this alias sends to `index.ts`; both entries re-export the same modules, so the bundle holds one engine. `platform: "node"` stays, so the plugin's `node:path` is the real module, not the shim.

`editors/vscode/tsconfig.json` — add under `compilerOptions`:

```json
"paths": {
  "markdown-it-visimark": ["../../packages/markdown-it-visimark/src/index.ts"]
}
```

`bun run typecheck` in `editors/vscode` must pass with that alone; if it reports errors inside `packages/markdown-it-visimark/src` or `packages/codemirror-visimark/src`, stop and report them on the PR rather than loosening the extension's compiler options.

- [ ] **Step 3: Write the adapter**

`editors/vscode/src/preview.ts`:

```ts
import * as fs from "node:fs";
import * as vscode from "vscode";
import markdownItVisimark, { type MarkdownItVisimarkOptions } from "markdown-it-visimark";

/**
 * The built-in Markdown preview's VisiMark marks (#373, spec §2.7).
 *
 * VS Code builds one markdown-it instance for every preview and calls
 * `extendMarkdownIt` only when it builds it, so the setting is read here and
 * a change to it reloads the instance through `markdown.api.reloadPlugins`
 * (registered in `extension.ts`).
 *
 * The path comes from the **render** env's `currentDocument`; VS Code parses
 * with an env that has none. Imports are read from disk next to the
 * previewed file, refusing a symlink at the final component; the engine's
 * gate confines them to the file's directory.
 */

export function previewOptions(): MarkdownItVisimarkOptions {
  return {
    path: (env) => {
      const uri = (env as { currentDocument?: vscode.Uri } | undefined)?.currentDocument;
      return uri !== undefined && uri.scheme === "file" ? uri.fsPath : null;
    },
    readImport: (absolutePath) => {
      try {
        if (fs.lstatSync(absolutePath).isSymbolicLink()) return null;
        return fs.readFileSync(absolutePath, "utf8");
      } catch {
        return null;
      }
    },
  };
}

export function previewEnabled(): boolean {
  return vscode.workspace.getConfiguration("visimark").get<boolean>("preview.enable", true);
}

// `md` is VS Code's markdown-it instance. VS Code types it `any`; nothing
// here needs more than `use`, and the instance itself is what goes back.
export function extendMarkdownIt<T>(md: T): T {
  if (!previewEnabled()) return md;
  (md as { use(plugin: unknown, options: unknown): unknown }).use(
    markdownItVisimark,
    previewOptions(),
  );
  return md;
}
```

- [ ] **Step 4: Wire it into `activate`**

In `editors/vscode/src/extension.ts`:

- `import { extendMarkdownIt } from "./preview.js";`
- change the signature to `export async function activate(context: vscode.ExtensionContext): Promise<{ extendMarkdownIt: typeof extendMarkdownIt }>`;
- inside the `context.subscriptions.push(...)` list add:

```ts
    // The preview's markdown-it instance is built once and kept; a toggle
    // has to rebuild it to reach previews that are already open.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("visimark.preview.enable")) return;
      void Promise.resolve(vscode.commands.executeCommand("markdown.api.reloadPlugins")).catch(
        () => undefined,
      );
    }),
```

- end `activate` with `return { extendMarkdownIt };` after the `client.onNotification(...)` call. If `client.start()` throws, `activate` already rejects today; leave that behaviour as it is (decoupling the preview from the server's first start is not in #373);
- also re-export it from the module, `export { extendMarkdownIt } from "./preview.js";`, so the test host can reach it without a running language server — under `test/host.ts` the client's `start()` rejects (`n.map is not a function`), so `activate` never gets to its `return` there.

- [ ] **Step 5: Teach the test host the new surface**

In `editors/vscode/test/host.ts`:
- add to `Host`: `configListeners: ((e: { affectsConfiguration(s: string): boolean }) => void)[]` and a method `changeConfig(key: string, value: unknown): void` that sets `config` and fires every listener with `{ affectsConfiguration: (s) => key === s || key.startsWith(s + ".") }`;
- add `onDidChangeConfiguration: (fn) => { configListeners.push(fn); return disposable; }` under `workspace`;
- add `export function loadExtension(): Record<string, unknown>` that `require`s `dist/extension.js` the same way `activateExtension` does (factor the `createRequire` + path into it and have `activateExtension` call it).

- [ ] **Step 6: Write the failing extension tests**

`editors/vscode/test/preview.test.ts`:

```ts
import { beforeAll, expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activateExtension, createHost, fakeUri, loadExtension, type Host } from "./host.js";

const root = join(import.meta.dir, "..");
const repo = join(root, "..", "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const csvPath = join(repo, "docs", "example-invoice-csv-import.md");

let host: Host;
let api: { extendMarkdownIt<T>(md: T): T };

beforeAll(async () => {
  host = createHost();
  // registers the configuration listener; the language client's start fails
  // under this host, which is why the API is read off the module below
  await activateExtension();
  api = loadExtension() as unknown as typeof api;
});

test("the manifest contributes the preview plugin, its stylesheet and the setting", () => {
  expect(pkg.contributes["markdown.markdownItPlugins"]).toBe(true);
  expect(pkg.contributes["markdown.previewStyles"]).toEqual(["./media/preview.css"]);
  expect(pkg.contributes.configuration.properties["visimark.preview.enable"].default).toBe(true);
});

test("activate returns extendMarkdownIt", () => {
  const src = readFileSync(join(root, "src", "extension.ts"), "utf8");
  expect(src).toContain("return { extendMarkdownIt };");
});

test("extendMarkdownIt marks a preview rendered VS Code's way", () => {
  const md = api.extendMarkdownIt(new MarkdownIt({ html: true }));
  const source = readFileSync(csvPath, "utf8");
  const tokens = md.parse(source, { currentDocument: undefined });
  const out = md.renderer.render(tokens, md.options, { currentDocument: fakeUri("file://" + csvPath) });
  expect(out).toContain("visimark-computed");
  expect(out).toContain(`data-vmark-path="${csvPath}"`);
});

test("an untitled document has no path, so no data-vmark-path", () => {
  const md = api.extendMarkdownIt(new MarkdownIt({ html: true }));
  const out = md.render(readFileSync(join(repo, "docs", "example-invoice.md"), "utf8"), {
    currentDocument: fakeUri("untitled:Untitled-1"),
  });
  expect(out).toContain("visimark-computed");
  expect(out).not.toContain("data-vmark-path");
});

test("visimark.preview.enable false: the instance is returned unextended", () => {
  host.config.set("visimark.preview.enable", false);
  const md = new MarkdownIt({ html: true });
  const src = readFileSync(join(repo, "docs", "example-invoice.md"), "utf8");
  expect(api.extendMarkdownIt(md).render(src)).toBe(new MarkdownIt({ html: true }).render(src));
  host.config.delete("visimark.preview.enable");
});

test("toggling the setting reloads the preview's plugins; other settings do not", () => {
  host.executed.length = 0;
  host.changeConfig("visimark.check.debounce", 500);
  expect(host.executed).not.toContain("markdown.api.reloadPlugins");
  host.changeConfig("visimark.preview.enable", false);
  expect(host.executed).toContain("markdown.api.reloadPlugins");
  host.config.delete("visimark.preview.enable");
});
```

`markdown-it` becomes a `devDependency` of `editors/vscode` (`bun add -d markdown-it@^15.0.2` in `editors/vscode`) for this test; it is not bundled because the extension never imports it. Run `bun install` at the root afterwards.

- [ ] **Step 7: Run them to verify they fail, then pass**

Run: `cd editors/vscode && bun run build && bun test test/preview.test.ts`
Expected before Steps 3–5 are complete: FAIL. After: all pass. Then run the whole extension suite, `bun test` in `editors/vscode`, and `bun run typecheck`.

- [ ] **Step 8: Manual check (record the result in the PR description)**

`bun run vscode-install`, open `docs/example-invoice-drift.md`, *Markdown: Open Preview to the Side*: stale values are flagged on the first render with no refresh. Set `visimark.preview.enable` to false: marks disappear from the open preview without reloading the window. Set it back: they return.

- [ ] **Step 9: Commit**

```bash
git add editors/vscode bun.lock
git commit -m "feat(vscode): mark computed values in the built-in Markdown preview (#373)" -m "<trailer>"
```

---

### Task 8: CI and release wiring

**Files:**
- Create: `scripts/markdown-it-smoke.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/prepare-release.ts:158-169`
- Modify: `scripts/prepare-release.test.ts:8-21,113-125`

**Interfaces:**
- Consumes: the packed tarball `markdown-it-visimark-<version>.tgz`.

- [ ] **Step 1: Write the smoke script**

`scripts/markdown-it-smoke.mjs`:

```js
// Library smoke for markdown-it-visimark, run by ci.yml's smoke-node and
// smoke-bun from a scratch project that installed the *packed* tarball and
// one markdown-it version (14.3.2, the version VS Code's built-in Markdown
// extension locks, and latest). It renders the spec's fixture and expects the
// marks and the fence attribute. Anything else is a broken artifact.
import MarkdownIt from "markdown-it";
import visimark from "markdown-it-visimark";

const fixture = [
  "Total **12.50**<!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax `2.50`<!--vmark=s.tax-->.",
  "",
  "| Item | Qty | Net |",
  "|------|----:|----:|",
  "| pen  |  2  | 10.00 |",
  "",
  "```vmark #s",
  "Net precision 2 = Qty * 5",
  "sub precision 2 = SUM(Net)",
  "tax precision 2 = sub * 0.25",
  "total precision 2 = sub + tax",
  "```",
  "",
].join("\n");

const html = new MarkdownIt({ html: true }).use(visimark).render(fixture);
const want = [
  'class="visimark-computed"',
  'data-vmark="s.total"',
  'data-vmark="s.sub"',
  'data-vmark-info="#s"',
];
const missing = want.filter((w) => !html.includes(w));
if (missing.length > 0) {
  console.error(`::error::markdown-it-visimark: missing ${missing.join(", ")} in:\n${html}`);
  process.exit(1);
}
console.log("markdown-it-visimark ok");
```

Run locally: `cd packages/markdown-it-visimark && bun run build && npm pack --pack-destination "$TMPDIR"`, then in a scratch directory `printf '{"name":"s","private":true,"type":"module"}' > package.json && bun add "$TMPDIR"/markdown-it-visimark-*.tgz markdown-it@14.3.2 && cp <repo>/scripts/markdown-it-smoke.mjs . && bun markdown-it-smoke.mjs`, and again with `markdown-it@latest`.
Expected: `markdown-it-visimark ok` both times.

- [ ] **Step 2: `ci.yml` — version agreement**

In the `every version-carrying file must agree` step and its comment block:
- comment: "Twenty-two files/fields" → "Twenty-four", "all twenty-two" → "all twenty-four", "The seven package manifests" → "The eight package manifests", "bun.lock mirrors all seven manifests'" → "all eight manifests'"; after the `codemirror-visimark` paragraph add: `# packages/markdown-it-visimark/package.json joins on its own \`version\` only, for the same reason: it bundles the engine (#373).`
- add `mi_version=$(bun -e 'console.log(require("./packages/markdown-it-visimark/package.json").version)')` beside `cm_version`;
- add `lock_mi_version=$(lock_field "packages/markdown-it-visimark" version)` beside `lock_cm_version`;
- append ` markdown-it-plugin=$mi_version` to the `echo` before ` bun.lock=`, and `,$lock_mi_version` at the end of its `bun.lock=` list;
- append `"packages/markdown-it-visimark version:$lock_mi_version"` to the `lock_check` loop list;
- append `"packages/markdown-it-visimark/package.json (version):$mi_version"` and `"bun.lock (packages/markdown-it-visimark version):$lock_mi_version"` to the `pair` loop list, each beside its `codemirror-visimark` counterpart.

- [ ] **Step 3: `ci.yml` — Node support policy, pack, artifacts, smoke**

- `node-support-policy`'s `for manifest in …` list gains `packages/markdown-it-visimark/package.json`.
- In `pack`, after the CodeMirror pack step:

```yaml
      # markdown-it-visimark has no `bin`; packed to prove the tarball imports
      # and renders under each runtime, at markdown-it 14.3.2 (VS Code's) and
      # latest (#373). Its name does not match `visimark-*`.
      - name: pack the markdown-it plugin tarball
        working-directory: packages/markdown-it-visimark
        run: npm pack --pack-destination "$RUNNER_TEMP"
```

  The job's earlier `bun run build` (root, `--filter '*'`) already builds this package's `dist/`, because it has a `build` script; no extra step.
- `visimark-tarball` upload `path:` gains `${{ runner.temp }}/markdown-it-visimark-*.tgz`.
- The copy step gains `cp scripts/markdown-it-smoke.mjs "$RUNNER_TEMP/markdown-it-smoke.mjs"`, and the `mcp-handshake` upload `path:` gains `${{ runner.temp }}/markdown-it-smoke.mjs`.
- `smoke-node`, after the CodeMirror step:

```yaml
      - name: the markdown-it plugin renders under Node only, at 14.3.2 and latest
        run: |
          set -e
          mi_tgz="$(pwd)/$(ls markdown-it-visimark-*.tgz)"
          for v in 14.3.2 latest; do
            rm -rf mi && mkdir mi && cd mi
            printf '{"name":"mi","private":true,"type":"module"}' > package.json
            npm i "$mi_tgz" "markdown-it@$v"
            packed=$(tar -xzOf "$mi_tgz" package/package.json | tr -d ' \n')
            installed=$(tr -d ' \n' < node_modules/markdown-it-visimark/package.json)
            [ "$packed" = "$installed" ] || { echo "::error::the plugin under test is not the packed one"; exit 1; }
            cp ../markdown-it-smoke.mjs .
            node markdown-it-smoke.mjs
            cd ..
          done
```

- `smoke-bun`, after the CodeMirror step: the same, with the Bun-only `PATH` reset and node check copied from the CodeMirror step, `bun add` instead of `npm i`, and `bun markdown-it-smoke.mjs`.

- [ ] **Step 4: `prepare-release.ts` and its test**

- `scripts/prepare-release.ts`: comment "The seven package manifests" → "The eight package manifests" and "codemirror-visimark bundles the engine and has none" → "codemirror-visimark and markdown-it-visimark bundle the engine and have none"; add `["packages/markdown-it-visimark/package.json", false],` after the CodeMirror entry. If the script edits `bun.lock` workspace blocks from a list, add `packages/markdown-it-visimark` there too (read the file).
- `scripts/prepare-release.test.ts`: add `"packages/markdown-it-visimark/package.json"` to `FILES` after the CodeMirror manifest, and `"packages/markdown-it-visimark"` to the workspace list in "bumps bun.lock's mirrored version…".

Run: `bun test scripts/prepare-release.test.ts`
Expected: pass.

- [ ] **Step 5: `release.yml`**

- After `Publish the CodeMirror extension to npm`:

```yaml
      # markdown-it-visimark bundles the engine rather than pinning it, so it
      # does not depend on the engine leg having landed; it follows the
      # CodeMirror leg only to keep the npm legs in one place (#373).
      - name: Publish the markdown-it plugin to npm
        id: markdown-it-plugin
        continue-on-error: true
        working-directory: packages/markdown-it-visimark
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          DRY_RUN: ${{ inputs.dry_run }}
        run: |
          if [ "$DRY_RUN" = true ]; then
            npm publish --dry-run --access public
          elif npm view "markdown-it-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; then
            echo "markdown-it-visimark@$ENGINE_VERSION is already on npm; skipping."
          else
            npm publish --provenance --access public
          fi
```

- `dry run verdict`: env `MARKDOWN_IT_OUTCOME: ${{ steps.markdown-it-plugin.outcome }}` and the pair `"npm publish --dry-run (markdown-it-visimark)=$MARKDOWN_IT_OUTCOME"` after the CodeMirror pair.
- `every leg must have landed`: env `MARKDOWN_IT_OUTCOME` likewise; wherever that step lists `CODEMIRROR_OUTCOME` in its outcome loop, add the markdown-it one beside it; add `on_npm_markdown_it() { npm view "markdown-it-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; }` and an `if retry on_npm_markdown_it; then … fi` block after the CodeMirror one, with the message text changed to "markdown-it plugin leg".

- [ ] **Step 6: Validate and commit**

Run: `bun run format:check && bun run lint && bun test scripts/` and, if `actionlint` is installed, `actionlint .github/workflows/ci.yml .github/workflows/release.yml`.
Expected: clean.

```bash
git add scripts/markdown-it-smoke.mjs scripts/prepare-release.ts scripts/prepare-release.test.ts .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci: pack, smoke and publish markdown-it-visimark with the engine's version (#373)" -m "<trailer>"
```

---

### Task 9: Documentation

**Files:**
- Create: `packages/markdown-it-visimark/README.md`
- Modify: `README.md`, `CONTRIBUTING.md`, `docs/releasing.md`, `docs/distribution.md`, `docs/ci.md`, `docs/visimark-editor-plugins-design.md`, `.agents/rules/runtime-parity.md`, `editors/vscode/README.md`, `editors/vscode/CHANGELOG.md`, `CHANGELOG.md`, `docs/vocabulary-catalogue.md`

This is the spec's §7 list, verbatim in substance. `docs/cli-reference.md`, `docs/issue-runbook.md` and `.github/ISSUE_TEMPLATE/` are **not** edited.

- [ ] **Step 1: The package README**

`packages/markdown-it-visimark/README.md`, sections in this order:
- one-paragraph purpose;
- **Install**: `npm i markdown-it-visimark` and `bun add markdown-it-visimark`;
- **Use**: `md.use(markdownItVisimark, { path, readImport })` example with `new MarkdownIt({ html: true })`; the sentence that `html: true` is required and that with `html: false` the plugin changes nothing;
- **Options**: `path(env)` is read from the **render** env, so a host that parses and renders separately passes the path on the render call; `readImport` (type `ReadImportSync`) is synchronous, unlike `codemirror-visimark`'s asynchronous `readImport`; without it imports are withheld; on Windows it receives `C:/…` paths with forward slashes;
- **What is marked** (marking under errors): every computed-column cell and every anchored value is marked `visimark-computed` whatever else `check` reports; only a value with its own `STALE` finding also gets `visimark-disagrees`; refused and image anchors are never marked; import-dependent values are withheld when imports cannot be read; a value another plugin has rewritten is left unmarked;
- **Styling**: the package ships no CSS; selectors table — `.visimark-computed`, `.visimark-disagrees`, `[data-vmark]`, `[data-vmark-row]`, `[data-vmark-path]`, `[data-vmark-info]` (on the first tag of a `vmark` fence: the info string after `vmark`) — and the two suggested rules;
- **Compatibility**: supported from `markdown-it` 14.3.2 upward, tested on 14.3.2 and the latest release; no peer dependency; a later `md.use` that replaces `renderer.rules.fence` without calling the previous rule drops `data-vmark-info`.

- [ ] **Step 2: Repository docs**

- `README.md` — the paragraph at the `codemirror-visimark` mention (around line 496) gains one sentence pointing at [`markdown-it-visimark`](packages/markdown-it-visimark/README.md) for rendered HTML and the VS Code preview.
- `CONTRIBUTING.md` — the version-lockstep sentence (around line 284) that says `codemirror-visimark` carries only its own version gains `markdown-it-visimark` for the same reason. The `browser-path.ts` note stays about the editor package.
- `docs/releasing.md` — the version-carrying file list (around line 251) gains `packages/markdown-it-visimark/package.json   # its own version only — it bundles the engine`, and `bun.lock`'s comment becomes "the same eight "version"s and three visimark pins"; the "What one tag publishes" table gains `markdown-it-visimark` (and `codemirror-visimark` if it is missing); the "five npm packages" sentences (around lines 369 and 406) become six; the first-publish note (around line 428) gains a `markdown-it-visimark` paragraph: name free on 2026-10-12, pins nothing, leg runs after the CodeMirror one.
- `docs/distribution.md` — rewrite the opening sentence so its count matches the sections; add the missing `codemirror-visimark` section (npm, automatic, same release leg as the other npm packages) and a `markdown-it-visimark` section (npm, automatic once the first tag containing it ships; npm keyword `markdown-it-plugin`, which markdown-it's README points readers to).
- `docs/ci.md` — the smoke-job description gains the markdown-it tarball, `scripts/markdown-it-smoke.mjs`, and the 14.3.2 / latest legs.
- `docs/visimark-editor-plugins-design.md` — §9 (VS Code) gains the preview responsibilities: `markdown.markdownItPlugins`, `extendMarkdownIt`, `visimark.preview.enable` and the `markdown.api.reloadPlugins` reload, imports from the file's directory; §10's version sentence gains `packages/markdown-it-visimark` as own-version-only. Do not copy the publish procedure into §10.
- `.agents/rules/runtime-parity.md` — the list of published packages with no `bin` (line 26) gains `markdown-it-visimark`.

- [ ] **Step 3: VS Code extension docs**

- `editors/vscode/README.md` — a "Markdown preview" section: what is marked, `visimark.preview.enable`, imports read from the previewed file's directory (none for untitled files), the symlinked-intermediate-directory limit (spec §2.7), and the manual preview test from Task 7 Step 8 under the development notes.
- `editors/vscode/CHANGELOG.md` — add `## Unreleased` above `## 0.2.0` if `scripts/check-changelog-entries.ts` and `scripts/prepare-release.ts` accept that heading (read both; if the extension changelog takes entries another way, follow it) with: `- The built-in Markdown preview marks computed values and flags the ones that disagree with their formulas. Turn it off with \`visimark.preview.enable\`.`

- [ ] **Step 4: Changelog and catalogue**

- `CHANGELOG.md` `## Unreleased` → `### Added`: a bold-lead entry in the house style of the `codemirror-visimark/highlight` entry: **`markdown-it-visimark`, VisiMark marks in rendered HTML** — `md.use(markdownItVisimark)` wraps each computed value with `visimark-computed` (and `visimark-disagrees` when it no longer matches), carries `codemirror-visimark`'s `data-vmark*` attributes, and puts the fence's info string on the rendered `vmark` block as `data-vmark-info`; no CSS, no dependency; the VS Code preview uses it (#373).
- `docs/vocabulary-catalogue.md` — move the #373 row out of section F into the Shipped register as `UNRELEASED`: `Name` = `Published markdown-it plugin (markdown-it-visimark)`, `Kind` = the Kind used by the `codemirror-visimark` (#360) Shipped row, `Request` = `[#373](https://github.com/michal-niedzwiedzki/visimark/issues/373)`, `Landed` = `[#377](https://github.com/michal-niedzwiedzki/visimark/pull/377)`, `Released` = `—`, `Decision` = `[APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/373#issuecomment-6123728493)`. Delete the section-F row.

- [ ] **Step 5: Check and commit**

Run: `bun run format:check && bun run lint && bun test && bun run typecheck && bun run build`, and `bun run packages/visimark/src/cli/main.ts check` on every Markdown file this task touched that contains a `vmark` block (`git diff --name-only master -- '*.md' | xargs grep -l '```vmark'`).
Expected: all green; each checked document exits as it did on `master`.

```bash
git add -A packages/markdown-it-visimark/README.md README.md CONTRIBUTING.md docs .agents/rules/runtime-parity.md editors/vscode/README.md editors/vscode/CHANGELOG.md CHANGELOG.md
git commit -m "docs: markdown-it-visimark and the VS Code preview marks (#373)" -m "<trailer>"
```

---

## Self-review notes

- Spec §2.1 manifest → Task 1; §2.2 options and exports → Tasks 2, 3, 6; §2.3 what is marked → Tasks 2, 3, 5; §2.4 attributes and placement → Task 3; §2.5 fence → Task 4; §2.6 two-phase design, cache, reader, shim → Tasks 1–3; §2.7 VS Code → Task 7; §2.8 `html: false` → Tasks 3–4; §3 contract rows → Tasks 3, 4, 7; §4 behaviour table → Tasks 3–5, 8 (smoke), 7 (manual); §5 compatibility → Task 8; §7 documentation → Task 9.
- `<trailer>` in every commit command is the `Co-Authored-By:` line from `.agents/rules/ai-attribution.md` for the executing session.
