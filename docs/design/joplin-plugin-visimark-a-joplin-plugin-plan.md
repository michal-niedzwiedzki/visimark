# Joplin plugin (`joplin-plugin-visimark`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `editors/joplin`, a private, build-only Joplin plugin that wires `codemirror-visimark` into Joplin's CodeMirror 6 editor and `markdown-it-visimark` into its viewer. CI packs it as a `.jpl` artifact. `markdown-it-visimark`'s supported floor drops to markdown-it 13.0.2.

**Architecture:** Three esbuild bundles: an entry point that registers two content scripts, built as a plain script (IIFE), and an editor script and a viewer script, built as CommonJS. Each workspace package resolves to its source. An in-repo ustar writer packs them with a generated manifest that carries the engine's version. Tests build in memory and check the esbuild metafile, the archive and the content scripts' behaviour. CI uploads the `.jpl` from the existing `build` job.

**Tech Stack:** Bun (workspaces, `bun test`), TypeScript, esbuild 0.28, markdown-it, CodeMirror 6, GitHub Actions.

**Spec:** [`docs/design/joplin-plugin-visimark-a-joplin-plugin-spec.md`](joplin-plugin-visimark-a-joplin-plugin-spec.md)

## Global Constraints

- Every commit carries the `Co-Authored-By:` trailer that [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) assigns to the agent running this session. The commit commands below pass it as `-m "$TRAILER"`: set `TRAILER` to that line once per shell. Never set `GIT_AUTHOR_*`.
- `typecheck` resolves `markdown-it` types the way `packages/markdown-it-visimark` already does. If `tsc` cannot find them in `editors/joplin`, mirror that package's setup; do not add `@types/*` that the workspace does not already have.
- `editors/joplin/package.json`: `"name": "joplin-plugin-visimark"`, `"private": true`, **no `version`**, **no `engines`**.
- Manifest: `"id": "com.visimark.joplin"`, `"app_min_version": "3.7.1"`, `"platforms": ["desktop"]`, `"manifest_version": 1`. `version` is stamped at build time from `packages/visimark/package.json` and is never committed.
- The editor script declares `@codemirror/*` and `@lezer/*` external. Nothing else is external. No `node:` import may survive in any output.
- Every workspace package is bundled from **source**, never from `dist/`.
- No new third-party dependency beyond the dev dependencies the workspace already uses (esbuild, `@codemirror/*`, markdown-it). No Joplin typings package. No tar library.
- Nothing is published: no `release.yml`, `prepare-release.ts`, version-agreement or `node-support-policy` change.
- Archive entry order: `manifest.json`, `index.js`, `codemirrorContentScript.js`, `markdownItContentScript.js`, `visimark.css`.
- Before each push, run `bun run format`, `bun run lint`, `bun run typecheck`, `bun run build` and `bun test` from the repo root, and get all of them green.
- Markdown with a nested fence widens the outer fence to four backticks ([`.agents/rules/nested-code-fences.md`](../../.agents/rules/nested-code-fences.md)).

## Review Focus

1. **The `.jpl` has to be a tar that a real tar reader accepts.** A header checksum or padding bug would pass a hand-written parser and still fail in Joplin. Task 1 also lists the archive with the system `tar -tf`.
2. **A file whose size is an exact multiple of 512 bytes** must get no extra padding block. Task 1 tests a 512-byte entry.
3. **A name longer than 100 bytes** cannot be stored in a plain ustar header. The writer must throw rather than truncate. Task 1 tests this.
4. **`index.ts` must register both scripts with the exact type strings and relative paths Joplin expects.** A typo means a plugin that loads silently and does nothing. Task 2 runs `onStart` against a mocked `joplin` global.
5. **The viewer script on a markdown-it instance with `html: false`** must leave markdown-it's output untouched. Joplin uses `html: true`, but a stray instance must not break. Task 2 tests this.

---

### Task 1: Package scaffold and the ustar writer

**Files:**
- Create: `editors/joplin/package.json`
- Create: `editors/joplin/tsconfig.json`
- Create: `editors/joplin/pack.ts`
- Test: `editors/joplin/test/pack.test.ts`
- Modify: `.gitignore` (append)
- Modify: `bun.lock` (by `bun install`)

**Interfaces:**
- Produces: `export interface TarEntry { name: string; bytes: Uint8Array }` and `export function ustar(entries: readonly TarEntry[]): Uint8Array` from `editors/joplin/pack.ts`.
- Produces: `untar(buf: Uint8Array): TarEntry[]`, a test-only helper exported from `editors/joplin/test/untar.ts` and used again in Task 3.

- [ ] **Step 1: Create the package**

`editors/joplin/package.json`:

```json
{
  "name": "joplin-plugin-visimark",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun build.ts"
  },
  "dependencies": {
    "codemirror-visimark": "workspace:*",
    "markdown-it-visimark": "workspace:*",
    "visimark": "workspace:*"
  },
  "devDependencies": {
    "@codemirror/language": "^6.13.1",
    "@codemirror/lint": "^6.9.7",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.14",
    "esbuild": "^0.28.2",
    "markdown-it": "^15.0.2"
  }
}
```

The spec lists `@codemirror/state` and `@codemirror/view`. `@codemirror/lint` and `@codemirror/language` are added too, because `codemirror-visimark`'s source imports them and the tests in Task 2 construct its extensions. The ranges are the ones `packages/codemirror-visimark` already uses.

`editors/joplin/tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun", "node"],
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    // Source, never dist, for tsc and `bun test` alike — the same mapping
    // build.ts's esbuild aliases make. Three resolvers that disagree typecheck,
    // test and ship three different plugins.
    "paths": {
      "visimark": ["../../packages/visimark/src/browser.ts"],
      "codemirror-visimark": ["../../packages/codemirror-visimark/src/index.ts"],
      "codemirror-visimark/*": ["../../packages/codemirror-visimark/src/*"],
      "markdown-it-visimark": ["../../packages/markdown-it-visimark/src/index.ts"]
    }
  },
  "include": ["src", "test", "build.ts", "pack.ts"]
}
```

Append to `.gitignore`:

```
# built by editors/joplin/build.ts; a CI artifact, never committed
editors/joplin/publish/
```

Run: `bun install`
Expected: exit 0. `bun.lock` gains an `editors/joplin` workspace entry with no `version`.

- [ ] **Step 2: Write the test-only tar reader**

`editors/joplin/test/untar.ts`:

```ts
import type { TarEntry } from "../pack.ts";

const dec = new TextDecoder();
const field = (h: Uint8Array, from: number, len: number): string =>
  dec.decode(h.subarray(from, from + len)).replace(/\0.*$/s, "");

/** Read back a ustar archive, checking each header's checksum. Test-only. */
export function untar(buf: Uint8Array): TarEntry[] {
  const out: TarEntry[] = [];
  let at = 0;
  while (at + 512 <= buf.length) {
    const h = buf.subarray(at, at + 512);
    if (h.every((b) => b === 0)) break;
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]!;
    const stored = parseInt(field(h, 148, 8).trim(), 8);
    if (sum !== stored) throw new Error(`bad checksum at ${at}: ${stored} != ${sum}`);
    const size = parseInt(field(h, 124, 12).trim(), 8);
    out.push({ name: field(h, 0, 100), bytes: buf.slice(at + 512, at + 512 + size) });
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
```

- [ ] **Step 3: Write the failing tests**

`editors/joplin/test/pack.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ustar } from "../pack.ts";
import { untar } from "./untar.ts";

const enc = new TextEncoder();
const two = [
  { name: "manifest.json", bytes: enc.encode('{"id":"x"}\n') },
  { name: "index.js", bytes: enc.encode("console.log(1);\n") },
];

test("A5: entries round-trip with their names, sizes and bytes", () => {
  const got = untar(ustar(two));
  expect(got.map((e) => e.name)).toEqual(["manifest.json", "index.js"]);
  expect(got.map((e) => [...e.bytes])).toEqual(two.map((e) => [...e.bytes]));
});

test("A5: length is a multiple of 512 and ends with two zero blocks", () => {
  const tar = ustar(two);
  expect(tar.length % 512).toBe(0);
  expect(tar.length).toBe(4 * 512 + 2 * 512);
  expect(tar.subarray(tar.length - 1024).every((b) => b === 0)).toBe(true);
});

test("A5: equal inputs give byte-identical archives", () => {
  expect(ustar(two)).toEqual(ustar(two));
});

test("a 512-byte entry takes exactly one data block", () => {
  const tar = ustar([{ name: "a", bytes: new Uint8Array(512).fill(97) }]);
  expect(tar.length).toBe(512 + 512 + 1024);
  expect(untar(tar)[0]!.bytes.length).toBe(512);
});

test("a name longer than 100 bytes is refused, not truncated", () => {
  expect(() => ustar([{ name: "n".repeat(101), bytes: new Uint8Array() }])).toThrow(
    "ustar: name longer than 100 bytes",
  );
});

test("the system tar lists what ustar wrote", () => {
  const dir = mkdtempSync(join(tmpdir(), "jpl-"));
  const file = join(dir, "t.tar");
  writeFileSync(file, ustar(two));
  const run = Bun.spawnSync(["tar", "-tf", file]);
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual(["manifest.json", "index.js"]);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `bun test editors/joplin/test/pack.test.ts`
Expected: FAIL, because `../pack.ts` cannot be resolved.

- [ ] **Step 5: Write `pack.ts`**

`editors/joplin/pack.ts`:

```ts
/**
 * A POSIX ustar writer, just enough for a Joplin `.jpl` (spec §2.7). No
 * dependency and no `tar` process: mtime, uid and gid are 0, so equal inputs
 * give equal bytes on every OS.
 */
export interface TarEntry {
  name: string;
  bytes: Uint8Array;
}

const BLOCK = 512;
const enc = new TextEncoder();
const octal = (n: number, width: number): Uint8Array =>
  enc.encode(n.toString(8).padStart(width - 1, "0") + "\0");
const padded = (n: number): number => Math.ceil(n / BLOCK) * BLOCK;

export function ustar(entries: readonly TarEntry[]): Uint8Array {
  const size = entries.reduce((t, e) => t + BLOCK + padded(e.bytes.length), 0) + 2 * BLOCK;
  const out = new Uint8Array(size);
  let at = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    if (name.length > 100) throw new Error(`ustar: name longer than 100 bytes: ${e.name}`);
    const h = out.subarray(at, at + BLOCK);
    h.set(name, 0);
    h.set(octal(0o644, 8), 100);
    h.set(octal(0, 8), 108);
    h.set(octal(0, 8), 116);
    h.set(octal(e.bytes.length, 12), 124);
    h.set(octal(0, 12), 136);
    h.fill(0x20, 148, 156);
    h[156] = 0x30; // typeflag '0': a regular file
    h.set(enc.encode("ustar\0"), 257);
    h.set(enc.encode("00"), 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.set(enc.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
    out.set(e.bytes, at + BLOCK);
    at += BLOCK + padded(e.bytes.length);
  }
  return out;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test editors/joplin/test/pack.test.ts`
Expected: 6 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
bun run format
git add .gitignore bun.lock editors/joplin/package.json editors/joplin/tsconfig.json editors/joplin/pack.ts editors/joplin/test/pack.test.ts editors/joplin/test/untar.ts
git commit -m "feat(joplin): package scaffold and a dependency-free ustar writer (#378)" -m "$TRAILER"
```

---

### Task 2: Entry point, content scripts, stylesheet and manifest

**Files:**
- Create: `editors/joplin/src/joplin.d.ts`
- Create: `editors/joplin/src/index.ts`
- Create: `editors/joplin/src/codemirrorContentScript.ts`
- Create: `editors/joplin/src/markdownItContentScript.ts`
- Create: `editors/joplin/src/visimark.css`
- Create: `editors/joplin/src/manifest.json`
- Test: `editors/joplin/test/content-scripts.test.ts`

**Interfaces:**
- Consumes: `visimark()` from `codemirror-visimark`, `visimarkLint()` from `codemirror-visimark/lint`, and the default export of `markdown-it-visimark`.
- Produces: each content script's default export, `(context: unknown) => { plugin: …; assets: () => { name: string }[] }`. The asset name `"visimark.css"` must match the file Task 3 copies into `dist/`.

- [ ] **Step 1: Write the failing tests**

`editors/joplin/test/content-scripts.test.ts`:

```ts
import { expect, mock, test } from "bun:test";
import MarkdownIt from "markdown-it";
import codemirror from "../src/codemirrorContentScript.ts";
import markdownIt from "../src/markdownItContentScript.ts";

// The fixture scripts/markdown-it-smoke.mjs renders (spec A8).
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

test("A8: the viewer script marks the fixture", () => {
  const md = new MarkdownIt({ html: true });
  markdownIt({}).plugin(md);
  const html = md.render(fixture);
  for (const want of [
    'class="visimark-computed"',
    'data-vmark="s.total"',
    'data-vmark="s.sub"',
    'data-vmark-info="#s"',
  ])
    expect(html).toContain(want);
});

test("the viewer script leaves an html:false instance's output alone", () => {
  const md = new MarkdownIt({ html: false });
  markdownIt({}).plugin(md);
  expect(md.render(fixture)).toBe(new MarkdownIt({ html: false }).render(fixture));
});

test("A9: no CodeMirror 6 editor, no extension", () => {
  const addExtension = mock(() => {});
  codemirror({}).plugin({ addExtension });
  expect(addExtension).not.toHaveBeenCalled();
});

test("A10: a CodeMirror 6 editor gets marks and lint, once", () => {
  const addExtension = mock((_ext: unknown) => {});
  codemirror({}).plugin({ cm6: {}, addExtension });
  expect(addExtension).toHaveBeenCalledTimes(1);
  const [ext] = addExtension.mock.calls[0]!;
  expect(Array.isArray(ext) && ext.length).toBe(2);
});

test("A11: both scripts ship the one stylesheet", () => {
  expect(codemirror({}).assets()).toEqual([{ name: "visimark.css" }]);
  expect(markdownIt({}).assets()).toEqual([{ name: "visimark.css" }]);
});

test("onStart registers both content scripts with Joplin's type strings", async () => {
  const register = mock(async (..._args: unknown[]) => {});
  let onStart: (() => Promise<void>) | undefined;
  (globalThis as Record<string, unknown>).joplin = {
    plugins: { register: async (s: { onStart(): Promise<void> }) => void (onStart = s.onStart) },
    contentScripts: { register },
  };
  await import("../src/index.ts");
  await onStart!();
  expect(register.mock.calls).toEqual([
    ["codeMirrorPlugin", "visimark-codemirror", "./codemirrorContentScript.js"],
    ["markdownItPlugin", "visimark-markdown-it", "./markdownItContentScript.js"],
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test editors/joplin/test/content-scripts.test.ts`
Expected: FAIL, because `../src/codemirrorContentScript.ts` cannot be resolved.

- [ ] **Step 3: Write the sources**

`editors/joplin/src/joplin.d.ts`:

```ts
/**
 * The part of Joplin's plugin API this plugin calls, typed by hand (spec §2.1).
 * The strings are the values of Joplin's `ContentScriptType` enum, which lives
 * in Joplin's source rather than in a package.
 */
declare const joplin: {
  plugins: { register(script: { onStart(): Promise<void> }): Promise<void> };
  contentScripts: {
    register(
      type: "codeMirrorPlugin" | "markdownItPlugin",
      id: string,
      scriptPath: string,
    ): Promise<void>;
  };
};
```

`editors/joplin/src/index.ts`:

```ts
/**
 * The Joplin plugin (#378): two content scripts and no logic of its own. It
 * reads one note — no `joplin.data`, no reader, no settings — so nothing
 * outside the note changes what it computes (visimark-design.md §2, constraint 4).
 */
void joplin.plugins.register({
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

`editors/joplin/src/codemirrorContentScript.ts`:

```ts
import { visimark } from "codemirror-visimark";
import { visimarkLint } from "codemirror-visimark/lint";

interface EditorControl {
  cm6?: unknown;
  addExtension(extension: unknown): void;
}

/**
 * Marks and lint in Joplin's CodeMirror 6 editor. No highlighting: Joplin
 * passes its own `codeLanguages` to `markdown()` and gives plugins no way in
 * (spec §2.4). `@codemirror/*` comes from Joplin at run time.
 */
export default (_context: unknown) => ({
  plugin: (control: EditorControl) => {
    if (!control.cm6) return; // the legacy CodeMirror 5 editor: do nothing
    control.addExtension([visimark(), visimarkLint()]);
  },
  assets: () => [{ name: "visimark.css" }],
});
```

`editors/joplin/src/markdownItContentScript.ts`:

```ts
import markdownItVisimark from "markdown-it-visimark";

/** Marks in Joplin's viewer. No options: `path` is null and there is no reader. */
export default (_context: unknown) => ({
  plugin: (md: unknown) => markdownItVisimark(md),
  assets: () => [{ name: "visimark.css" }],
});
```

`editors/joplin/src/visimark.css`:

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

`editors/joplin/src/manifest.json`:

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test editors/joplin/test/content-scripts.test.ts && bun run --filter joplin-plugin-visimark typecheck`
Expected: 6 pass, 0 fail; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
bun run format
git add editors/joplin/src editors/joplin/test/content-scripts.test.ts
git commit -m "feat(joplin): entry point, editor and viewer content scripts, stylesheet (#378)" -m "$TRAILER"
```

---

### Task 3: The build, the bundle guard and the packed `.jpl`

**Files:**
- Create: `editors/joplin/build.ts`
- Test: `editors/joplin/test/bundle.test.ts`
- Modify: `editors/joplin/test/pack.test.ts` (append A6, A7 and the missing-version case)

**Interfaces:**
- Consumes: `ustar`, `TarEntry` (Task 1); `untar` (Task 1, tests); `src/*` (Task 2).
- Produces, from `editors/joplin/build.ts`:
  - `export const ENTRIES: readonly { name: "index" | "codemirrorContentScript" | "markdownItContentScript"; external: string[] }[]`
  - `export const JPL_ORDER: readonly string[]`
  - `export function options(entry: (typeof ENTRIES)[number], outDir: string): BuildOptions`
  - `export function engineVersion(pkgPath?: string): string`
  - `export function manifestWithVersion(src: Record<string, unknown>, version: string): string`
  - `export async function buildPlugin(outDir?: string, publishDir?: string): Promise<{ metafiles: Record<string, Metafile>; jpl: string }>`

`options` is a function of the entry here, not the single object the spec's §2.1 sentence suggests, because three entries share one option set. Aliases point at package **directories**, as `editors/obsidian/esbuild.config.mjs` does, so `codemirror-visimark/lint` resolves through the same alias as `codemirror-visimark`.

- [ ] **Step 1: Write the failing bundle test**

`editors/joplin/test/bundle.test.ts`:

```ts
import { expect, test } from "bun:test";
import { build, type Metafile } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENTRIES, options } from "../build.ts";

/**
 * Builds exactly what ships — `options` from build.ts, in memory — and reads
 * esbuild's metafile, not the minified bytes: `{node:e}` object keys in the
 * engine make a grep for `node:` lie (#378 pre-review, question 8).
 */
const out = mkdtempSync(join(tmpdir(), "joplin-bundle-"));
const metas: Record<string, Metafile> = {};
for (const entry of ENTRIES) {
  const r = await build({ ...options(entry, out), write: false });
  metas[entry.name] = r.metafile!;
}
const imports = (m: Metafile) => Object.values(m.outputs).flatMap((o) => o.imports);

test("A1: no CodeMirror or Lezer source is bundled", () => {
  for (const m of Object.values(metas))
    for (const input of Object.keys(m.inputs))
      expect(input).not.toMatch(/node_modules\/@(codemirror|lezer)\//);
});

test("A2: no node: import survives", () => {
  for (const m of Object.values(metas))
    for (const i of imports(m)) expect(i.path.startsWith("node:")).toBe(false);
});

test("A3: the editor script imports only what Joplin provides", () => {
  const ext = imports(metas.codemirrorContentScript!).filter((i) => i.external);
  expect(ext.length).toBeGreaterThan(0);
  for (const i of ext) expect(i.path).toMatch(/^@(codemirror|lezer)\//);
});

test("A4: the entry point and the viewer script import nothing", () => {
  expect(imports(metas.index!).filter((i) => i.external)).toEqual([]);
  expect(imports(metas.markdownItContentScript!).filter((i) => i.external)).toEqual([]);
});
```

- [ ] **Step 2: Append the failing packing tests**

Append to `editors/joplin/test/pack.test.ts` (merge the imports into the top of the file):

```ts
import { readFileSync } from "node:fs";
import { buildPlugin, engineVersion, JPL_ORDER } from "../build.ts";

const repo = join(import.meta.dir, "..", "..", "..");
const engine = JSON.parse(readFileSync(join(repo, "packages/visimark/package.json"), "utf8"));

test("A6 and A7: a real build packs the five files in order, at the engine's version", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "joplin-build-"));
  const { jpl } = await buildPlugin(join(tmp, "dist"), join(tmp, "publish"));
  expect(jpl).toBe(join(tmp, "publish", "com.visimark.joplin.jpl"));
  const entries = untar(new Uint8Array(readFileSync(jpl)));
  expect(entries.map((e) => e.name)).toEqual([...JPL_ORDER]);
  expect(JPL_ORDER).toEqual([
    "manifest.json",
    "index.js",
    "codemirrorContentScript.js",
    "markdownItContentScript.js",
    "visimark.css",
  ]);
  const manifest = JSON.parse(new TextDecoder().decode(entries[0]!.bytes));
  expect(manifest.version).toBe(engine.version);
  expect(Object.keys(manifest).slice(0, 3)).toEqual(["manifest_version", "id", "version"]);
  expect(manifest).toMatchObject({
    manifest_version: 1,
    id: "com.visimark.joplin",
    app_min_version: "3.7.1",
    platforms: ["desktop"],
  });
});

test("a missing engine version stops the build with the spec's message", () => {
  const tmp = mkdtempSync(join(tmpdir(), "joplin-nover-"));
  const pkg = join(tmp, "package.json");
  writeFileSync(pkg, '{"name":"visimark"}');
  expect(() => engineVersion(pkg)).toThrow(
    "editors/joplin: packages/visimark/package.json has no version",
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test editors/joplin/test/bundle.test.ts editors/joplin/test/pack.test.ts`
Expected: FAIL, because `../build.ts` cannot be resolved.

- [ ] **Step 4: Write `build.ts`**

`editors/joplin/build.ts`:

```ts
import { build, type BuildOptions, type Metafile } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ustar } from "./pack.ts";

/**
 * The Joplin plugin build (#378, spec §2.6). A plain-script entry point and two
 * CommonJS content scripts — Joplin loads one as `require(file).default` — then
 * a manifest stamped with the engine's version, the stylesheet, and the `.jpl`.
 *
 * Every workspace package resolves to its **source**, for the reason
 * `editors/obsidian/esbuild.config.mjs` gives: the plugin must not ship a stale
 * `dist/`. `node:path` is the engine's one builtin, and it is used for string
 * work only, so it is swapped for the browser-safe copy the extension ships.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, "..", "..", "packages");

export const ENTRIES: readonly {
  name: "index" | "codemirrorContentScript" | "markdownItContentScript";
  format: "iife" | "cjs";
  external: string[];
}[] = [
  // The entry point runs as a plain script with the `joplin` global; nothing
  // promises it a `module`, so it must not touch one.
  { name: "index", format: "iife", external: [] },
  // What Joplin's `codeMirrorRequire` hands a CodeMirror content script. A
  // second copy of CodeMirror would be a second editor state.
  { name: "codemirrorContentScript", format: "cjs", external: ["@codemirror/*", "@lezer/*"] },
  { name: "markdownItContentScript", format: "cjs", external: [] },
];

export const JPL_ORDER = [
  "manifest.json",
  "index.js",
  "codemirrorContentScript.js",
  "markdownItContentScript.js",
  "visimark.css",
] as const;

export function options(entry: (typeof ENTRIES)[number], outDir: string): BuildOptions {
  return {
    entryPoints: [join(here, "src", `${entry.name}.ts`)],
    outfile: join(outDir, `${entry.name}.js`),
    bundle: true,
    format: entry.format,
    platform: "browser",
    target: "es2020",
    minify: true,
    metafile: true,
    logLevel: "info",
    alias: {
      visimark: join(packages, "visimark", "src", "browser.ts"),
      "codemirror-visimark": join(packages, "codemirror-visimark", "src"),
      "markdown-it-visimark": join(packages, "markdown-it-visimark", "src"),
      "node:path": join(packages, "codemirror-visimark", "src", "browser-path.ts"),
    },
    external: [...entry.external],
  };
}

export function engineVersion(pkgPath = join(packages, "visimark", "package.json")): string {
  const version: unknown = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  if (typeof version !== "string" || version === "")
    throw new Error("editors/joplin: packages/visimark/package.json has no version");
  return version;
}

/** The committed manifest with `version` inserted right after `id` (spec §2.3). */
export function manifestWithVersion(src: Record<string, unknown>, version: string): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = v;
    if (k === "id") out.version = version;
  }
  return JSON.stringify(out, null, 2) + "\n";
}

export async function buildPlugin(
  outDir = join(here, "dist"),
  publishDir = join(here, "publish"),
): Promise<{ metafiles: Record<string, Metafile>; jpl: string }> {
  const version = engineVersion();
  mkdirSync(outDir, { recursive: true });
  mkdirSync(publishDir, { recursive: true });
  const metafiles: Record<string, Metafile> = {};
  for (const entry of ENTRIES) metafiles[entry.name] = (await build(options(entry, outDir))).metafile!;
  const manifest = JSON.parse(readFileSync(join(here, "src", "manifest.json"), "utf8"));
  writeFileSync(join(outDir, "manifest.json"), manifestWithVersion(manifest, version));
  copyFileSync(join(here, "src", "visimark.css"), join(outDir, "visimark.css"));
  const jpl = join(publishDir, "com.visimark.joplin.jpl");
  writeFileSync(
    jpl,
    ustar(JPL_ORDER.map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(outDir, name))) }))),
  );
  return { metafiles, jpl };
}

if (import.meta.main) {
  try {
    await buildPlugin();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
```

- [ ] **Step 5: Run the tests and the real build**

Run: `bun test editors/joplin && bun run --filter joplin-plugin-visimark build && tar -tf editors/joplin/publish/com.visimark.joplin.jpl`
Expected: all joplin tests pass. The build exits 0. `tar` prints exactly:

```
manifest.json
index.js
codemirrorContentScript.js
markdownItContentScript.js
visimark.css
```

If A1 fails because a `@codemirror/*` or `@lezer/*` package is reached by a path that is not covered by the wildcard, add that path to the editor entry's `external`. Do not loosen the test. If A2 fails, find which source imported the builtin through the metafile's `inputs[…].imports`, and alias it the way `node:path` is aliased.

- [ ] **Step 6: Full checks and commit**

Run: `bun run format && bun run lint && bun run typecheck && bun run build && bun test`
Expected: all green. `git status` shows no `editors/joplin/dist` or `publish` file.

```bash
git add editors/joplin/build.ts editors/joplin/test/bundle.test.ts editors/joplin/test/pack.test.ts
git commit -m "feat(joplin): build, metafile bundle guard and the packed .jpl (#378)" -m "$TRAILER"
```

---

### Task 4: `markdown-it-visimark` at markdown-it 13.0.2, and Joplin's render options

**Files:**
- Test: `packages/markdown-it-visimark/test/host-options.test.ts`
- Modify: `.github/workflows/ci.yml` (the `pack` comment above "pack the markdown-it plugin tarball"; the `smoke-node` and `smoke-bun` markdown-it steps)
- Modify: `scripts/markdown-it-smoke.mjs:1-5`
- Modify: `packages/markdown-it-visimark/README.md:110-111`

**Interfaces:**
- Consumes: the default export of `packages/markdown-it-visimark/src/index.ts`.
- Produces: nothing new.

- [ ] **Step 1: Write the test (A12)**

`packages/markdown-it-visimark/test/host-options.test.ts`:

```ts
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import visimark from "../src/index.js";

/**
 * Joplin renders with `typographer`, `breaks` and `linkify` following user
 * settings (#378). This pins what each does to the marks. It pins, it does not
 * fix: a value typographer rewrites is left unmarked, as the README's "another
 * markdown-it plugin has rewritten" rule says, and never flagged as disagreeing.
 */
const doc = [
  'Label **Q3 -- "final"**<!--vmark=s.label--> and total **12.50**<!--vmark=s.total--> line',
  "next line www.example.com",
  "",
  "```vmark #s",
  'label = "Q3 -- \\"final\\""',
  "total precision 2 = 10 + 2.5",
  "```",
  "",
].join("\n");

const combos = [
  {},
  { typographer: true },
  { breaks: true },
  { linkify: true },
  { typographer: true, breaks: true, linkify: true },
];
const render = (o: object): string => new MarkdownIt({ html: true, ...o }).use(visimark).render(doc);

for (const o of combos) {
  const typographer = "typographer" in o;
  test(`A12 ${JSON.stringify(o)}`, () => {
    const html = render(o);
    expect(html).toContain('<strong class="visimark-computed" data-vmark="s.total">12.50</strong>');
    expect(html).toContain('data-vmark-info="#s"');
    expect(html).not.toContain("visimark-disagrees");
    if (typographer) {
      expect(html).toContain("<strong>Q3 – “final”</strong>");
      expect(html).not.toContain('data-vmark="s.label"');
    } else {
      expect(html).toContain(
        '<strong class="visimark-computed" data-vmark="s.label">Q3 -- &quot;final&quot;</strong>',
      );
    }
  });
}
```

- [ ] **Step 2: Run it**

Run: `bun test packages/markdown-it-visimark/test/host-options.test.ts`
Expected: 5 pass, 0 fail. This test pins behaviour that already exists (observed on 2026-10-13), so it passes on first run. If it fails, stop and report: the spec's A12 no longer describes the code.

- [ ] **Step 3: Add 13.0.2 to the CI smoke legs**

In `.github/workflows/ci.yml`:

1. Change the comment above `- name: pack the markdown-it plugin tarball` to:

```yaml
      # markdown-it-visimark has no `bin`; packed to prove the tarball imports
      # and renders under each runtime, at markdown-it 13.0.2 (Joplin's, #378),
      # 14.3.2 (VS Code's) and latest (#373). Its name does not match `visimark-*`.
```

2. In `smoke-node`, rename the step to `the markdown-it plugin renders under Node only, at 13.0.2, 14.3.2 and latest`. Change its comment to:

```yaml
          # 13.0.2 is the markdown-it Joplin's renderer pins (#378); 14.3.2 is
          # the one VS Code's built-in Markdown extension locks; latest is what
          # a new host installs (#373). smoke-bun runs the same three under Bun.
```

   Change `for v in 14.3.2 latest; do` to `for v in 13.0.2 14.3.2 latest; do`.

3. In `smoke-bun`, rename the step to `the markdown-it plugin renders under Bun only, at 13.0.2, 14.3.2 and latest`, and make the same `for v in 13.0.2 14.3.2 latest; do` change.

Run: `grep -n 'for v in' .github/workflows/ci.yml`
Expected: the two markdown-it lines read `for v in 13.0.2 14.3.2 latest; do`.

- [ ] **Step 4: Prove 13.0.2 locally against a packed tarball**

```bash
tmp=$(mktemp -d) && (cd packages/markdown-it-visimark && bun run build && npm pack --pack-destination "$tmp") \
  && cd "$tmp" && printf '{"name":"mi","private":true,"type":"module"}' > package.json \
  && bun add ./markdown-it-visimark-*.tgz markdown-it@13.0.2 \
  && cp "$OLDPWD/scripts/markdown-it-smoke.mjs" . && bun markdown-it-smoke.mjs; cd "$OLDPWD"
```

Expected: `markdown-it-visimark ok`.

- [ ] **Step 5: Update the smoke header and the README**

`scripts/markdown-it-smoke.mjs` lines 1–5 become:

```js
// Library smoke for markdown-it-visimark, run by ci.yml's smoke-node and
// smoke-bun from a scratch project that installed the *packed* tarball and
// one markdown-it version (13.0.2, the version Joplin's renderer pins; 14.3.2,
// the version VS Code's built-in Markdown extension locks; and latest). It
// renders the spec's fixture and expects the marks and the fence attribute.
// Anything else is a broken artifact.
```

In `packages/markdown-it-visimark/README.md`, replace the paragraph that starts `Supported from markdown-it 14.3.2 upward.` with:

```markdown
Supported from markdown-it 13.0.2 upward. CI tests 13.0.2, the version Joplin's
renderer uses; 14.3.2, the version VS Code's built-in Markdown extension uses;
and the latest release. There is no peer dependency: the plugin uses only the
instance it is given.
```

- [ ] **Step 6: Commit**

```bash
bun run format
git add packages/markdown-it-visimark/test/host-options.test.ts packages/markdown-it-visimark/README.md scripts/markdown-it-smoke.mjs .github/workflows/ci.yml
git commit -m "test(markdown-it-visimark): support markdown-it 13.0.2 and pin Joplin's render options (#378)" -m "$TRAILER"
```

---

### Task 5: Upload the `.jpl` from CI

**Files:**
- Modify: `.github/workflows/ci.yml` (the `build` job, after the `visimark-vsix` upload)

**Interfaces:**
- Consumes: `editors/joplin/publish/com.visimark.joplin.jpl`, written by `bun run build` (Task 3), which the `build` job already runs.

- [ ] **Step 1: Add the step**

Right after the `actions/upload-artifact@v7` step named `visimark-vsix`, insert:

```yaml
      # editors/joplin is build-only (#378): this artifact is how a Joplin
      # user gets the plugin. Nothing publishes it.
      - uses: actions/upload-artifact@v7
        with:
          name: visimark-joplin
          path: editors/joplin/publish/com.visimark.joplin.jpl
          if-no-files-found: error
```

`if-no-files-found: error` makes a build that silently stops writing the `.jpl` fail the job, instead of uploading nothing.

- [ ] **Step 2: Check the YAML**

Run: `bun -e 'const y = Bun.YAML.parse(await Bun.file(".github/workflows/ci.yml").text()); if (!JSON.stringify(y).includes("visimark-joplin")) process.exit(1)'`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: upload the Joplin plugin as the visimark-joplin artifact (#378)" -m "$TRAILER"
```

---

### Task 6: Documentation

**Files:**
- Create: `editors/joplin/README.md`
- Create: `docs/design/joplin-manual-test.md`
- Modify: `CONTRIBUTING.md` (new section after "Building the Obsidian plugin and side-loading it")
- Modify: `README.md` (after the paragraph ending "…for the built-in Markdown preview.")
- Modify: `docs/visimark-editor-plugins-design.md` §1 (after the "One of them is not a language-server client" paragraph)
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Modify: `docs/vocabulary-catalogue.md` (move the #378 row)

**Interfaces:** none.

- [ ] **Step 1: `editors/joplin/README.md`**

````markdown
# VisiMark for Joplin

Marks every value a note computes in Joplin's Markdown editor and viewer, and
flags the ones that no longer match their formula. In the editor it also lists
each finding as a lint diagnostic, in the CLI's words.

It is built from this repository and **not published** to npm or to Joplin's
plugin repository (#378). You install it from a file.

## Get the plugin

- From CI: open a recent [CI run on `master`](https://github.com/michal-niedzwiedzki/visimark/actions/workflows/ci.yml?query=branch%3Amaster),
  download the `visimark-joplin` artifact, and unzip it to get
  `com.visimark.joplin.jpl`.
- Or build it:

  ```console
  $ bun install
  $ bun run --filter joplin-plugin-visimark build
  $ ls editors/joplin/publish
  com.visimark.joplin.jpl
  ```

## Install

In Joplin desktop 3.7.1 or later: **Tools → Options → Plugins → ⚙ → Install
from file**, choose the `.jpl`, and restart Joplin.

## What it does

- A computed value has a dotted underline. A value that disagrees with its
  formula has a red wavy one. The same marks show in the editor and the viewer.
- In PDF export and print, the disagree mark stays and computed values print
  plain.
- A note with no `vmark` block renders exactly as before.

## Limits

- **One note at a time.** A value that reads an imported file
  (`from rows.csv`) is not marked.
- **No `vmark` block highlighting.** Joplin gives plugins no way to add a code
  language to its editor.
- **Desktop only**, and no settings.
- With Joplin's **typographer** setting on, a quoted text value is rendered
  with curly quotes and left unmarked. Numbers are unaffected.
````

If M8 in the manual test fails, add this bullet to **Limits**: "**Edit VisiMark notes in the Markdown editor.** The Rich Text editor can drop the comments that bind values to formulas." Leave it out otherwise.

- [ ] **Step 2: `docs/design/joplin-manual-test.md`**

Write it in the style of `docs/design/obsidian-manual-test.md`. Its content:

```markdown
# Joplin: a manual test scenario

**What this tests.** The CI-built `.jpl` (#378) in a running Joplin. CI checks
the bundle, the archive and the content scripts against fakes. It cannot see a
screen, so these rows can't be automated.

**Record what you observe, not what you expect.** Each row states what the
spec requires. Record what Joplin actually did under *Recording*.

## Setup

1. Joplin desktop 3.7.16 or later.
2. Download the `visimark-joplin` artifact from the PR's CI run, or build it
   with `bun run --filter joplin-plugin-visimark build`.
3. **Tools → Options → Plugins → ⚙ → Install from file**, choose
   `com.visimark.joplin.jpl`, and restart Joplin.
4. Open **Help → Toggle development tools** and keep the console visible.

## Rows

| # | Do this | Required |
|---|---|---|
| M1 | Install, restart, open any note | The plugin is listed as enabled; no error in the console |
| M2 | New note; paste the body of `docs/example-invoice-drift.md` | In the editor and the viewer, every value `visimark check docs/example-invoice-drift.md` reports `STALE` has the wavy mark; the editor shows lint diagnostics |
| M3 | New note; paste the body of `docs/example-invoice.md` | Dotted marks only, no wavy mark, no diagnostics |
| M4 | A note with no `vmark` block: **File → Export → HTML** with the plugin enabled, then disabled | The two exported note bodies are identical |
| M5 | M2's note in a light and a dark theme | Both marks visible in both |
| M6 | M2's note, **File → Export → PDF** | Wavy marks visible; dotted marks absent |
| M7 | **Options → Markdown → Enable typographer support** on; reopen M2's note | Numeric marks unchanged |
| M8 | M2's note in the Rich Text editor: one unrelated edit, save, back to Markdown, diff against the original | **Recorded, not required.** Did any `<!--vmark=…-->` anchor or `vmark` block change? |
| M9 | In development tools, inspect the viewer's `vmark` block for `#lines` | **Recorded, not required.** Is `data-vmark-info="#lines"` present? |
| M10 | If this Joplin still offers the legacy editor, switch to it and open M2's note | No error; no marks |

M1–M7 and M10 must pass before the implementation PR is merged.

## Recording

| Row | Joplin version | Date | Observed |
|---|---|---|---|
| | | | |
```

- [ ] **Step 3: `CONTRIBUTING.md`**

After the Obsidian side-loading section, before the next `###` heading, insert:

````markdown
### Building the Joplin plugin and side-loading it

`editors/joplin` is a client of the two published editor packages: it adds
`codemirror-visimark` to Joplin's editor and `markdown-it-visimark` to its
viewer. It is build-only (#378). Nothing publishes it, and it carries no
version of its own; the build stamps the engine's into the manifest.

```console
$ bun run --filter joplin-plugin-visimark build
$ ls editors/joplin/publish
com.visimark.joplin.jpl
```

Install it in Joplin desktop 3.7.1 or later with **Tools → Options → Plugins →
⚙ → Install from file**. CI uploads the same file as the `visimark-joplin`
artifact.

`editors/joplin/test/bundle.test.ts` reads esbuild's metafile. It fails if
any `@codemirror/*` or `@lezer/*` source is bundled (Joplin provides them) or
if any `node:` import survives. `docs/design/joplin-manual-test.md` is the
check a screen needs.
````

- [ ] **Step 4: `README.md`**

After the paragraph ending "the VS Code extension uses it for the built-in Markdown preview.", insert:

```markdown
The **Joplin plugin** puts both of those into Joplin desktop: marks and lint in
the Markdown editor, marks in the viewer. It is not published. Install the
`.jpl` from a CI build —
[`editors/joplin/README.md`](editors/joplin/README.md) has the steps and its
limits.
```

- [ ] **Step 5: `docs/visimark-editor-plugins-design.md` §1**

After the paragraph that ends with the link to `design/obsidian-plugin-spec.md` §2.1, insert:

```markdown
**Another is a client of the published packages.** `editors/joplin` (#378)
uses neither the server nor the engine API directly. It adds
`codemirror-visimark` to Joplin's editor and `markdown-it-visimark` to its
viewer, and has no logic of its own. It is build-only and carries no version:
its build stamps the engine's. See
[`design/joplin-plugin-visimark-a-joplin-plugin-spec.md`](design/joplin-plugin-visimark-a-joplin-plugin-spec.md).
```

- [ ] **Step 6: `CHANGELOG.md`**

Under `## Unreleased` → `### Added`, as a new first bullet:

```markdown
- **A Joplin plugin, built but not published.** `editors/joplin` adds
  `codemirror-visimark`'s marks and lint to Joplin's Markdown editor and
  `markdown-it-visimark`'s marks to its viewer. Desktop only, Joplin 3.7.1 and
  up. CI uploads it as the `visimark-joplin` artifact for installing from a
  file. ([#378](https://github.com/michal-niedzwiedzki/visimark/issues/378))
```

In the existing `markdown-it-visimark` bullet, add before its issue link: "Supported from markdown-it 13.0.2, the version Joplin uses."

- [ ] **Step 7: The catalogue row**

In `docs/vocabulary-catalogue.md`, delete the section-F row that starts `| Joplin plugin (\`joplin-plugin-visimark\`)`. Insert this row as the first row of the **Shipped** register table, above the `markdown-it-visimark` row:

```markdown
| Joplin plugin (`joplin-plugin-visimark`), build-only | tooling | [#378](https://github.com/michal-niedzwiedzki/visimark/issues/378) | [#381](https://github.com/michal-niedzwiedzki/visimark/pull/381) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/378#issuecomment-6148869639) |
```

- [ ] **Step 8: Check the docs and commit**

Run: `bun run format && bun run packages/visimark/src/cli/main.ts check README.md CONTRIBUTING.md CHANGELOG.md editors/joplin/README.md docs/design/joplin-manual-test.md docs/visimark-editor-plugins-design.md docs/vocabulary-catalogue.md docs/example-invoice.md`
Expected: `0 problems` for each. If a new Markdown file reports `COVERAGE` (a table with no `vmark` rules), add `<!--vmark:no-formulas-->` as its last line, as other design docs do.

Then the full suite: `bun run lint && bun run typecheck && bun run build && bun test`, all green.

```bash
git add editors/joplin/README.md docs/design/joplin-manual-test.md CONTRIBUTING.md README.md docs/visimark-editor-plugins-design.md CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "docs: Joplin plugin README, manual test, and the #378 row in the Shipped register" -m "$TRAILER"
```
