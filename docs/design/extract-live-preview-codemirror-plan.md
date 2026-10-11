# Published CodeMirror 6 extension (`codemirror-visimark`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Obsidian client's Live Preview marks into a published, host-agnostic CodeMirror 6 package, `codemirror-visimark`, with a lint subpath, and make the playground (moved from CodeMirror 5 to CodeMirror 6) its second host.

**Architecture:** The package owns the analysis, the gate, the decorations, the snapshot reader and one `ViewPlugin`, configured by a closed options object; a module-level `StateField` carries the finding set from the plugin to the lint extension. Obsidian and the playground both bundle the package **from source** through an alias — esbuild's `alias` for Obsidian, a `Bun.build` resolve plugin for the playground — so each ships one engine copy; only the published `dist` is a separate ESM build with CodeMirror external.

**Tech Stack:** TypeScript 7 (`tsc`), Bun 1.4.2 (`bun test`, `Bun.build`), esbuild 0.28 (Obsidian), CodeMirror 6 (`@codemirror/state`, `view`, `commands`, `language`, `lang-markdown`, `lint`, `search`, `@lezer/highlight`), happy-dom for DOM tests.

**Spec:** [`extract-live-preview-codemirror-spec.md`](extract-live-preview-codemirror-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) names for the session doing the work; the Git author stays the maintainer.
- npm name and directory: `codemirror-visimark`, `packages/codemirror-visimark`.
- Package `version` equals `packages/visimark/package.json`'s `version` at the time of the change (0.2.0 when this plan was written).
- `peerDependencies`: `@codemirror/state` `^6.5.2`, `@codemirror/view` `^6.36.2`, `@codemirror/lint` `^6.4.0`; `peerDependenciesMeta`: `@codemirror/lint` optional.
- No `dependencies`, no `bin`, and no `visimark` key anywhere in the package's `package.json`.
- `engines.node`: `>=24`, as every published manifest.
- Published `exports`: exactly `"."` and `"./lint"`. Shipped `.d.ts` files import nothing but `@codemirror/*`.
- Public API exactly as spec §2.2: `visimark(options?)`, `refresh`, `ReadImport`, `VisimarkOptions` (keys `active`, `path`, `readImport`, `recompute`, `focusableMarks`), and `visimarkLint()` from `./lint`.
- Mark DOM contract: classes `visimark-computed` / `visimark-computed visimark-disagrees`; attributes `data-vmark`, `data-vmark-row` (cells only), `data-vmark-path` (path non-null only), `tabindex="0"` (only with `focusableMarks`).
- Recompute debounce: 400 ms.
- Obsidian never imports `codemirror-visimark/lint`.
- No dynamic `import()` in any file the Obsidian bundle reaches (its bundle guard bans them).
- Install lines in any doc this plan writes come in both forms: `npm i` and `bun add` (runtime-parity rule).
- Before every push: `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun test` from the repo root.
- Delivery is a `gh stack` on top of PR #362 (branch `issue/360-extract-live-preview-codemirror-impl`, which holds the spec and this plan). Four layers, one PR each, merged bottom-up; the first npm publish happens only after all four are merged:
  1. `issue/360-cm-1-extract` — Tasks 1–5
  2. `issue/360-cm-2-playground-cm6` — Task 6
  3. `issue/360-cm-3-playground-marks` — Task 7
  4. `issue/360-cm-4-lint-release` — Tasks 8–11

## Review Focus

1. **The playground's engine global is missing at boot** (opened from `file://`, or `visimark-browser.js` failed): `engine-global.ts` must not touch `window.VisiMark` at import time, so the boot overlay can still report the failure. Pinned in Task 7.
2. **Two copies of `@codemirror/state` in one bundle**: an extension from one copy is silently rejected (or throws "Unrecognized extension value") by the other. Pinned by the single-copy assertion in `build-playground.ts` (Task 6) and the externals test in the package's bundle test (Task 5).
3. **The editor is destroyed while a snapshot read is in flight** (a closed pane, a file switch): no dispatch may reach a destroyed view. Pinned in Task 3.
4. **`readImport` rejects or returns null**: withheld marks stay withheld, nothing is thrown or logged as unhandled. Pinned in Task 3.
5. **A document loses its last `vmark` block**: every mark and every diagnostic disappears on the next recompute rather than lingering mapped. Pinned in Task 3 (marks) and Task 8 (diagnostics).

---

## Layer 1 — `issue/360-cm-1-extract`

Create the layer branch before Task 1:

```bash
git switch issue/360-extract-live-preview-codemirror-impl
gh stack init   # if the stack is not initialised yet; see the gh-stack skill
git switch -c issue/360-cm-1-extract
```

### Task 1: One CodeMirror copy in the workspace, and the package scaffold

**Files:**
- Modify: `package.json` (root) — add `overrides`
- Create: `packages/codemirror-visimark/package.json`
- Create: `packages/codemirror-visimark/tsconfig.json`
- Create: `packages/codemirror-visimark/bunfig.toml`
- Create: `packages/codemirror-visimark/test/preload.ts`
- Create: `packages/codemirror-visimark/LICENSE` (copy of `packages/remark-visimark/LICENSE`)
- Create: `packages/codemirror-visimark/src/index.ts` (placeholder export replaced in Task 3)
- Create: `packages/codemirror-visimark/test/scaffold.test.ts`

**Interfaces:**
- Produces: a workspace package `codemirror-visimark` whose `bun test` runs under happy-dom, and whose `tsconfig.json` maps `visimark` to `../visimark/src/browser.ts`.

- [ ] **Step 1: Add the root overrides**

In the root `package.json`, after `"devDependencies"`, add:

```json
  "overrides": {
    "@codemirror/state": "6.7.6",
    "@codemirror/view": "6.43.13"
  },
```

Use the versions `bun.lock` resolves on the day (`grep '"@codemirror/state": \["@codemirror/state@' bun.lock`); the point is one version of each.

- [ ] **Step 2: Install and prove one copy of each**

Run: `bun install && ls node_modules/.bun | grep -E '^@codemirror\+(state|view)@'`
Expected: exactly one `@codemirror+state@…` line and one `@codemirror+view@…` line.

Run: `bun test editors/obsidian`
Expected: PASS (the harness's `cm-state.ts` still works with one copy).

- [ ] **Step 3: Write the package manifest**

`packages/codemirror-visimark/package.json`:

```json
{
  "name": "codemirror-visimark",
  "version": "0.2.0",
  "description": "A CodeMirror 6 extension for VisiMark: marks every computed value in a Markdown document, flags the ones that disagree with their formulas, and reports findings as lint diagnostics.",
  "keywords": ["codemirror", "codemirror6", "lint", "markdown", "visimark"],
  "homepage": "https://github.com/michal-niedzwiedzki/visimark#readme",
  "bugs": "https://github.com/michal-niedzwiedzki/visimark/issues",
  "license": "MIT",
  "author": "Michał Niedźwiedzki <michal@epsi.pl>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/michal-niedzwiedzki/visimark.git",
    "directory": "packages/codemirror-visimark"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./lint": { "types": "./dist/lint.d.ts", "default": "./dist/lint.js" }
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.build.json && bun build.ts",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  },
  "peerDependencies": {
    "@codemirror/lint": "^6.4.0",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.2"
  },
  "peerDependenciesMeta": {
    "@codemirror/lint": { "optional": true }
  },
  "devDependencies": {
    "@codemirror/lint": "^6.9.7",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.13",
    "@happy-dom/global-registrator": "^20.14.5"
  },
  "engines": {
    "node": ">=24"
  }
}
```

The `build` script is wired in Task 5; until then `bun run build` from the root would fail on the missing `tsconfig.build.json`, so create that file in this step too, empty of emit for now:

`packages/codemirror-visimark/tsconfig.build.json`:

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

and a stub `packages/codemirror-visimark/build.ts` containing `console.log("codemirror-visimark: build lands in Task 5");`. Add `packages/codemirror-visimark/.types/` to the root `.gitignore` under the `dist` line.

- [ ] **Step 4: Write the tsconfig, bunfig and preload**

`packages/codemirror-visimark/tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    // `visimark` is the engine's browser-safe entry, from source, exactly as
    // editors/obsidian/tsconfig.json maps it: the package bundles that graph
    // and never resolves `visimark` from npm.
    "paths": {
      "visimark": ["../visimark/src/browser.ts"]
    }
  },
  "include": ["src", "test", "build.ts"]
}
```

`packages/codemirror-visimark/bunfig.toml`:

```toml
[test]
preload = ["./test/preload.ts"]
```

`packages/codemirror-visimark/test/preload.ts`:

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// The root bunfig.toml's preload registers happy-dom for a run from the repo
// root; this one covers `bun test` run from this directory. Guarded the same
// way, since both can load in one process.
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register();
}
```

`packages/codemirror-visimark/src/index.ts` (replaced in Task 3):

```ts
export {};
```

- [ ] **Step 5: Write the scaffold test**

`packages/codemirror-visimark/test/scaffold.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
const engine = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "..", "visimark", "package.json"), "utf8"),
);

test("the package version is the engine's", () => {
  expect(manifest.version).toBe(engine.version);
});

test("the manifest names no engine and no runtime dependency", () => {
  expect(manifest.dependencies).toBeUndefined();
  expect(manifest.bin).toBeUndefined();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    expect(Object.keys(manifest[field] ?? {})).not.toContain("visimark");
  }
});

test("the peer floors are the spec's", () => {
  expect(manifest.peerDependencies).toEqual({
    "@codemirror/lint": "^6.4.0",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.2",
  });
  expect(manifest.peerDependenciesMeta).toEqual({ "@codemirror/lint": { optional: true } });
});

test("the exports are exactly the root and ./lint", () => {
  expect(Object.keys(manifest.exports)).toEqual([".", "./lint"]);
});

test("a DOM is registered for the editor tests", () => {
  expect(typeof document.createElement).toBe("function");
});
```

- [ ] **Step 6: Run it**

Run: `bun install && cd packages/codemirror-visimark && bun test && cd ../.. && bun test packages/codemirror-visimark`
Expected: 5 pass, both ways.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock .gitignore packages/codemirror-visimark
git commit -m "feat(codemirror): scaffold codemirror-visimark and dedupe CodeMirror in the workspace

<trailer from .agents/rules/ai-attribution.md>"
```

### Task 2: Move the host-agnostic modules and their tests

**Files:**
- Move (`git mv`): `editors/obsidian/src/{browser-path,decorations,gate,import-deps,snapshot,analysis}.ts` → `packages/codemirror-visimark/src/`
- Move (`git mv`): `editors/obsidian/test/{browser-path,decorations,gate,import-deps,snapshot,analysis,analysis-snapshot}.test.ts` → `packages/codemirror-visimark/test/`
- Modify: `packages/codemirror-visimark/src/snapshot.ts` (rename `VaultRead` → `ReadImport`, drop the symlink section to a pointer)
- Modify: `packages/codemirror-visimark/src/analysis.ts` (no `report`; add `doc`)
- Modify: `packages/codemirror-visimark/src/import-deps.ts` (add `hasImportedSheet`)
- Modify: `packages/codemirror-visimark/test/analysis-snapshot.test.ts` (drop the `report` assertion)
- Create: `editors/obsidian/src/snapshot.ts` (thin re-export)
- Create: `editors/obsidian/src/analysis.ts` (thin wrapper adding `report`)
- Create: `editors/obsidian/test/analysis-report.test.ts`
- Modify: `editors/obsidian/tsconfig.json`, `editors/obsidian/esbuild.config.mjs`, `editors/obsidian/package.json`
- Modify: every `editors/obsidian/src/*.ts` that imports `./gate.js`, `./decorations.js`, `./import-deps.js` or `./browser-path.js`
- Modify: `editors/obsidian/test/bundle.test.ts` (the walk follows the alias)

**Interfaces:**
- Produces (package-internal, reached by Obsidian through `codemirror-visimark/<module>.js`):
  - `analysis.ts`: `analyse(source: string): Analysis`; `locatedFor(source: string): LocatedDoc`; `analyseWithSnapshot(source: string, path: string, read: ReadImport): Promise<SnapshotAnalysis>` where `SnapshotAnalysis = { source, path, model: DocModel, result: CheckResult, decorations: readonly Decoration[], doc: DocumentFile }`.
  - `gate.ts`: `hasVmarkBlock(source: string): boolean`, `mightHaveBlock(source: string): boolean`.
  - `decorations.ts`: `decorationsFor(model, result): Decoration[]`, `decorationsIn(all, from, to): Decoration[]`, types `Decoration`, `Mark`.
  - `import-deps.ts`: `importDependentNames(model): ReadonlySet<string>`, `hasImportedSheet(model): boolean`.
  - `snapshot.ts`: `type ReadImport = (path: string) => Promise<string | null>`, `toVaultPath`, `vaultSnapshot`, `readNote`, `type Snapshot`.
- Produces (Obsidian): `editors/obsidian/src/analysis.ts` exports `analyse`, `locatedFor`, `type Analysis`, `analyseWithSnapshot(source, path, read): Promise<SnapshotAnalysis & { report: NoteReport }>`; `editors/obsidian/src/snapshot.ts` exports `readNote`, `toVaultPath`, `vaultSnapshot`, `type Snapshot`, `type VaultRead`.

- [ ] **Step 1: Move the files**

```bash
cd editors/obsidian
for m in browser-path decorations gate import-deps snapshot analysis; do
  git mv src/$m.ts ../../packages/codemirror-visimark/src/$m.ts
done
for t in browser-path decorations gate import-deps snapshot analysis analysis-snapshot; do
  git mv test/$t.test.ts ../../packages/codemirror-visimark/test/$t.test.ts
done
cd ../..
```

The moved tests' `../../../docs` and `../../../packages/visimark/src/index.js` paths stay correct: `packages/codemirror-visimark/test` is the same depth as `editors/obsidian/test`.

- [ ] **Step 2: Rename `VaultRead` in the package's snapshot**

In `packages/codemirror-visimark/src/snapshot.ts`:
- Replace the `VaultRead` type and its doc comment with:

```ts
/**
 * Read one file the document declares, by its path relative to the root
 * imports resolve within (`notes/q3.csv`), or `null` for anything unreadable —
 * missing, a folder, outside the root, or refused. Obsidian passes a vault
 * adapter read; the playground passes its in-memory store; the tests pass a
 * `Map`.
 */
export type ReadImport = (path: string) => Promise<string | null>;
```

- Replace every other `VaultRead` in the file with `ReadImport`.
- Replace the whole `## What this does not catch — a symlink …` section of the header comment with one paragraph:

```ts
 * ## What this does not catch
 *
 * `memoryReader`'s `realpath` is identity, so the engine's symlink half of its
 * containment check is a no-op through this snapshot. A host whose files can
 * be symlinks says what that means for it — Obsidian's answer is in
 * `docs/design/obsidian-plugin-spec.md` §2.6 (#233).
```

In `packages/codemirror-visimark/test/snapshot.test.ts`, `decorations.test.ts`, `analysis-snapshot.test.ts`: replace `VaultRead` with `ReadImport` in imports and annotations.

- [ ] **Step 3: Drop `report` from the package's `analyseWithSnapshot`**

In `packages/codemirror-visimark/src/analysis.ts`:
- Remove `import { reportFor, type NoteReport } from "./report.js";`.
- Change the snapshot import to `import { readNote, type ReadImport } from "./snapshot.js";` and the engine import to `import { build, check, locate, type CheckResult, type DocModel, type DocumentFile, type LocatedDoc } from "visimark";`.
- Replace the `SnapshotAnalysis` interface with:

```ts
export interface SnapshotAnalysis {
  readonly source: string;
  readonly path: string;
  readonly model: DocModel;
  readonly result: CheckResult;
  readonly decorations: readonly Decoration[];
  /** the `doc` the snapshot-backed `check` ran with — a host that builds its own report passes it on */
  readonly doc: DocumentFile;
}
```

- Replace `read: VaultRead` with `read: ReadImport` in `SnapshotEntry` and in `analyseWithSnapshot`'s signature.
- Replace the promise body with:

```ts
  const promise = (async (): Promise<SnapshotAnalysis> => {
    const { model, snapshot } = await readNote(source, path, read);
    const doc: DocumentFile = { path: snapshot.path, reader: snapshot.reader };
    const result = check(model, { doc });
    const decorations = decorationsFor(model, result);
    return { source, path, model, result, decorations, doc };
  })();
```

- In the doc comment above `analyseWithSnapshot`, replace "`main.ts`'s `refreshState` and both renderers" with "every host caller" — the rest stands.

If `DocumentFile` is not `{ path: string; reader: ReaderPort }` in `packages/visimark/src/fs/reader.ts`, use whatever `CheckOptions["doc"]` is (`NonNullable<Parameters<typeof check>[1]>["doc"]`) and keep the field name `doc`.

In `packages/codemirror-visimark/test/analysis-snapshot.test.ts` change line 45 to `const { result, decorations } = await analyseWithSnapshot(source, "note.md", read);` and delete the `expect(report.problems.length)…` line; that assertion moves to Obsidian in Step 6.

- [ ] **Step 4: Add `hasImportedSheet`**

Append to `packages/codemirror-visimark/src/import-deps.ts`:

```ts
/**
 * Whether any sheet in the document is an imported one. A reader-less `check`
 * of such a document reports every imported column as `UNDEF`, so the lint
 * extension shows nothing for it until a snapshot-backed check has run.
 */
export function hasImportedSheet(model: DocModel): boolean {
  for (const sheet of model.sheets.values()) if (sheet.imported !== null) return true;
  return false;
}
```

Append to `packages/codemirror-visimark/test/import-deps.test.ts`:

```ts
test("hasImportedSheet is true only for a document that declares an import", () => {
  const plain = build(locate("```vmark #s\na = 1\n```\n"));
  expect(hasImportedSheet(plain)).toBe(false);
  const imports = readFileSync(
    join(import.meta.dir, "../../../docs/playground/tutorial/13-imports.md"),
    "utf8",
  );
  expect(hasImportedSheet(build(locate(imports)))).toBe(true);
});
```

and add `hasImportedSheet` to that file's `import-deps.js` import, plus `import { readFileSync } from "node:fs"; import { join } from "node:path";` if absent.

- [ ] **Step 5: Thin Obsidian modules**

`editors/obsidian/src/snapshot.ts`:

```ts
/**
 * The vault-backed reader moved to `codemirror-visimark` (#360), where any
 * CodeMirror host can use it; this module keeps the plugin's own name for the
 * read function, `VaultRead`, so the vault, chart, API and sweep code does not
 * change. The symlink limitation (#233) is the plugin's, and is written down in
 * docs/design/obsidian-plugin-spec.md §2.6.
 */
export { readNote, toVaultPath, vaultSnapshot, type Snapshot } from "codemirror-visimark/snapshot.js";
export type { ReadImport as VaultRead } from "codemirror-visimark/snapshot.js";
```

`editors/obsidian/src/analysis.ts`:

```ts
import {
  analyseWithSnapshot as analyseCore,
  type SnapshotAnalysis as CoreSnapshotAnalysis,
} from "codemirror-visimark/analysis.js";
import { reportFor, type NoteReport } from "./report.js";
import type { VaultRead } from "./snapshot.js";

export { analyse, locatedFor, type Analysis } from "codemirror-visimark/analysis.js";

/** The package's snapshot analysis plus the findings view's report, computed once per fetch. */
export interface SnapshotAnalysis extends CoreSnapshotAnalysis {
  readonly report: NoteReport;
}

/**
 * Keyed on the package's own promise: concurrent callers for one
 * `(path, source, read)` already share that promise (every section of one
 * reading-mode render), so they share one `reportFor` too. A `WeakMap` lets
 * the entry go when the package drops the promise.
 */
const withReport = new WeakMap<Promise<CoreSnapshotAnalysis>, Promise<SnapshotAnalysis>>();

export function analyseWithSnapshot(
  source: string,
  path: string,
  read: VaultRead,
): Promise<SnapshotAnalysis> {
  const core = analyseCore(source, path, read);
  let out = withReport.get(core);
  if (out === undefined) {
    out = core.then((c) => ({ ...c, report: reportFor(c.model, c.result, c.doc) }));
    withReport.set(core, out);
  }
  return out;
}
```

- [ ] **Step 6: The report test stays with the plugin**

`editors/obsidian/test/analysis-report.test.ts` — copy the first test of `packages/codemirror-visimark/test/analysis-snapshot.test.ts` (the one that destructured `report` before Step 3), importing `analyseWithSnapshot` from `../src/analysis.js` and `VaultRead` from `../src/snapshot.js`, keeping its `report.problems.length` assertion, and add:

```ts
test("concurrent callers for one note share one report", async () => {
  const [a, b] = await Promise.all([
    analyseWithSnapshot(source, "note.md", read),
    analyseWithSnapshot(source, "note.md", read),
  ]);
  expect(a.report).toBe(b.report);
});
```

(`source` and `read` are the fixtures the copied test already defines.)

- [ ] **Step 7: Point Obsidian's resolvers at the package source**

`editors/obsidian/tsconfig.json` `paths`:

```jsonc
    "paths": {
      "visimark": ["../../packages/visimark/src/browser.ts"],
      "codemirror-visimark": ["../../packages/codemirror-visimark/src/index.ts"],
      "codemirror-visimark/*": ["../../packages/codemirror-visimark/src/*"]
    }
```

and add a comment line above the two new entries: `// The extension's source, never its dist — the same rule as the engine (#360).`

`editors/obsidian/esbuild.config.mjs`: add beside `engineBrowserSrc`

```js
const extensionSrc = join(here, "..", "..", "packages", "codemirror-visimark", "src");
```

and set `alias` to

```js
  alias: {
    visimark: engineBrowserSrc,
    "codemirror-visimark": extensionSrc,
    "node:path": join(extensionSrc, "browser-path.ts"),
  },
```

(esbuild's alias maps `codemirror-visimark` to `src/index.ts` and `codemirror-visimark/x.js` to `src/x.ts`; verified against esbuild 0.28 while planning.) Update the file's header comment: "`node:path` is aliased" now names `packages/codemirror-visimark/src/browser-path.ts`, and add one paragraph: "**`codemirror-visimark` resolves to its source** for the same reason the engine does: the plugin is built from this checkout and must not depend on, or ship, a stale `dist/`."

`editors/obsidian/package.json` `dependencies`: add `"codemirror-visimark": "workspace:*"`. Run `bun install`.

- [ ] **Step 8: Rewrite the plugin's imports of moved modules**

Run: `grep -rln 'from "\./\(gate\|decorations\|import-deps\|browser-path\)\.js"' editors/obsidian/src`

In each listed file, replace `from "./gate.js"` with `from "codemirror-visimark/gate.js"`, `from "./decorations.js"` with `from "codemirror-visimark/decorations.js"`, `from "./import-deps.js"` with `from "codemirror-visimark/import-deps.js"`. Leave `./analysis.js` and `./snapshot.js` imports as they are — Step 5 kept those modules.

Run the same grep over `editors/obsidian/test` and apply the same replacement with `../src/` prefixes.

- [ ] **Step 9: Teach the bundle guard's walk the alias**

In `editors/obsidian/test/bundle.test.ts`, beside `engineSrc`:

```ts
const extensionSrc = resolve(here, "../../packages/codemirror-visimark/src");
```

and in `graph()`, after the `visimark` branch:

```ts
      // the extension's source, aliased exactly as the engine is (#360)
      if (spec === "codemirror-visimark" || spec.startsWith("codemirror-visimark/")) {
        const sub = spec.slice("codemirror-visimark".length);
        queue.push(sub === "" ? join(extensionSrc, "index.ts") : join(extensionSrc, sub.slice(1).replace(/\.js$/, ".ts")));
        continue;
      }
```

Add to the "the walk actually reaches the engine" test:

```ts
  expect(files).toContain("packages/codemirror-visimark/src/analysis.ts");
```

- [ ] **Step 10: Run everything**

Run: `bun run typecheck && bun test editors/obsidian packages/codemirror-visimark && (cd editors/obsidian && bun run build)`
Expected: typecheck clean; all tests pass; `main.js` builds.

- [ ] **Step 11: Commit**

```bash
git add -A editors/obsidian packages/codemirror-visimark bun.lock
git commit -m "refactor(codemirror): move the host-agnostic analysis into codemirror-visimark

<trailer>"
```

### Task 3: The extension — `visimark()`, `refresh`, and the findings field

**Files:**
- Create: `packages/codemirror-visimark/src/timer.ts`
- Create: `packages/codemirror-visimark/src/findings-field.ts`
- Create: `packages/codemirror-visimark/src/plugin.ts`
- Modify: `packages/codemirror-visimark/src/index.ts`
- Create: `packages/codemirror-visimark/test/plugin.test.ts`
- Create: `packages/codemirror-visimark/test/options.test.ts`

**Interfaces:**
- Consumes: Task 2's `analyse`, `analyseWithSnapshot`, `hasVmarkBlock`, `importDependentNames`, `hasImportedSheet`, `Decoration`.
- Produces:
  - `index.ts`: `visimark(options?: VisimarkOptions): Extension`, `refresh: StateEffectType<null>`, `type ReadImport` (re-declared here, identical to `snapshot.ts`'s), `interface VisimarkOptions`.
  - `findings-field.ts`: `type FindingSet = readonly Finding[] | null`, `setFindings: StateEffectType<FindingSet>`, `findingsField: StateField<FindingSet>` — read by Task 8's lint.
  - `plugin.ts`: `RECOMPUTE_DEBOUNCE_MS = 400`, `refreshEffect`, `visimarkExtension(resolved: ResolvedOptions): Extension`, and the test helper `marksIn(view): { from; to; name; disagrees }[]` (not exported from `index.ts`).

- [ ] **Step 1: Write the failing tests**

`packages/codemirror-visimark/test/plugin.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { check, build, locate } from "visimark";
import { refresh, visimark, type VisimarkOptions } from "../src/index.js";
import { findingsField } from "../src/findings-field.js";
import { marksIn } from "../src/plugin.js";

const docs = resolve(import.meta.dir, "../../../docs");
const read = (p: string): string => readFileSync(join(docs, p), "utf8");
const invoice = read("example-invoice.md");
const drift = read("example-invoice-drift.md");
// The imports chapter declares `grand_total = SUM(Total)` over an imported CSV
// but anchors it nowhere; one anchored sentence gives the extension a mark
// that depends on the import. Without a reader it is withheld; with one, the
// snapshot shows it disagreeing (its stored text is 0). Checked against the
// engine while planning.
const imports = read("playground/tutorial/13-imports.md");
const importsAnchored = imports + "\nGrand total: **0**<!--vmark=order.grand_total-->\n";
const IMPORT_PATH = "playground/tutorial/13-imports.md";
const GRAND = "order.grand_total";
const NAME = "lines.net_total";
const ANCHORED_TEXT = "23300.00 PLN";
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(r));

/** A test-only stand-in for a host's mode: Obsidian's Live Preview field, say. */
const setOn = StateEffect.define<boolean>();
const onField = StateField.define<boolean>({
  create: () => true,
  update: (v, tr) => tr.effects.reduce((acc, e) => (e.is(setOn) ? e.value : acc), v),
});

function viewOver(doc: string, options: VisimarkOptions = {}): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [onField, visimark({ active: (s) => s.field(onField), ...options })],
  });
  return new EditorView({ state, parent: document.body });
}
const marks = (view: EditorView): Element[] => [...view.dom.querySelectorAll("[data-vmark]")];
const named = (view: EditorView, name: string): Element[] => [
  ...view.dom.querySelectorAll(`[data-vmark="${name}"]`),
];

test("E1: an ordinary note shows nothing and publishes an empty finding set", async () => {
  const view = viewOver("# notes\n\nplain text\n");
  await tick();
  expect(marks(view)).toHaveLength(0);
  expect(view.state.field(findingsField)).toEqual([]);
  view.destroy();
});

test("E2: computed and disagrees marks match the engine's STALE set", async () => {
  // counted from the plugin's decoration set, not the DOM: CodeMirror renders
  // only the viewport, and the drift invoice is longer than happy-dom's
  const view = viewOver(drift);
  const result = check(build(locate(drift)));
  const staleStarts = result.findings
    .filter((f) => f.code === "STALE" && f.span)
    .map((f) => f.span!.start)
    .sort((a, b) => a - b);
  const all = marksIn(view);
  const disagreeStarts = all.filter((m) => m.disagrees).map((m) => m.from);
  expect(disagreeStarts).toEqual(staleStarts); // 14 on the drift invoice today
  expect(all.length).toBeGreaterThan(disagreeStarts.length);
  view.destroy();
});

test("E3: active false shows nothing; flipping it recomputes in the same update", () => {
  const view = viewOver(invoice);
  view.dispatch({ effects: setOn.of(false) });
  expect(marks(view)).toHaveLength(0);
  view.dispatch({ effects: setOn.of(true) });
  expect(named(view, NAME)).toHaveLength(1);
  view.destroy();
});

const ANCHOR_LINE = `Net of tax the engagement comes to **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;
const insertAt = invoice.indexOf(ANCHOR_LINE) + ANCHOR_LINE.length;
const duplicate = ` Again: **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;

test("E4: debounced — an edit maps marks at once, the recompute waits 400 ms", async () => {
  const view = viewOver(invoice);
  view.dispatch({ changes: [{ from: 0, insert: "x".repeat(50) }, { from: insertAt, insert: duplicate }] });
  expect(named(view, NAME)).toHaveLength(1);
  expect(named(view, NAME)[0]?.textContent).toBe(ANCHORED_TEXT);
  await wait(600);
  expect(named(view, NAME)).toHaveLength(2);
  view.destroy();
});

test("E5: on-refresh — an edit only maps; refresh recomputes synchronously", async () => {
  const view = viewOver(invoice, { recompute: "on-refresh" });
  view.dispatch({ changes: { from: insertAt, insert: duplicate } });
  await wait(600);
  expect(named(view, NAME)).toHaveLength(1);
  view.dispatch({ effects: refresh.of(null) });
  expect(named(view, NAME)).toHaveLength(2);
  view.destroy();
});

test("E6: an import-dependent mark is withheld without a reader", async () => {
  const view = viewOver(importsAnchored);
  await tick();
  expect(view.state.field(findingsField)).toBeNull(); // imported sheet, no snapshot
  expect(named(view, GRAND)).toHaveLength(0);
  view.destroy();
});

const repoRead = async (p: string): Promise<string | null> => {
  try {
    return readFileSync(join(docs, p), "utf8");
  } catch {
    return null;
  }
};

test("E7: with a path and a reader, the snapshot fills the withheld marks and findings", async () => {
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: repoRead,
    recompute: "on-refresh",
  });
  await wait(50);
  const grand = named(view, GRAND);
  expect(grand).toHaveLength(1);
  expect(grand[0]!.classList.contains("visimark-disagrees")).toBe(true);
  expect(grand[0]!.getAttribute("data-vmark-path")).toBe(IMPORT_PATH);
  expect(view.state.field(findingsField)?.some((f) => f.code === "STALE")).toBe(true);
  view.destroy();
});

test("E8: a snapshot that lands after an edit is dropped", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: async (p) => {
      await gate;
      return repoRead(p);
    },
    recompute: "on-refresh",
  });
  view.dispatch({ changes: { from: 0, insert: "# edited\n\n" } });
  release();
  await wait(50);
  expect(named(view, GRAND)).toHaveLength(0);
  view.destroy();
});

test("E9: focusableMarks puts tabindex on every mark; the default puts it on none", () => {
  const plain = viewOver(invoice);
  expect(plain.dom.querySelectorAll("[data-vmark][tabindex]")).toHaveLength(0);
  plain.destroy();
  const focusable = viewOver(invoice, { focusableMarks: true });
  for (const el of marks(focusable)) expect(el.getAttribute("tabindex")).toBe("0");
  focusable.destroy();
});

test("Review 3: destroying the view while a read is in flight dispatches nothing", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: async (p) => {
      await gate;
      return repoRead(p);
    },
    recompute: "on-refresh",
  });
  view.destroy();
  release();
  await wait(50); // a dispatch on a destroyed view would throw here
});

test("Review 4: a reader that rejects or returns null leaves withheld marks withheld", async () => {
  for (const readImport of [async () => null, async () => Promise.reject(new Error("gone"))]) {
    const view = viewOver(importsAnchored, {
      path: () => IMPORT_PATH,
      readImport,
      recompute: "on-refresh",
    });
    await wait(50);
    expect(named(view, GRAND)).toHaveLength(0);
    view.destroy();
  }
});

test("Review 5: deleting the last vmark block clears every mark on the next recompute", () => {
  const view = viewOver(invoice, { recompute: "on-refresh" });
  expect(marks(view).length).toBeGreaterThan(0);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# gone\n" } });
  view.dispatch({ effects: refresh.of(null) });
  expect(marks(view)).toHaveLength(0);
  view.destroy();
});
```

`packages/codemirror-visimark/test/options.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { VisimarkOptions } from "../src/index.js";

type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const keys: Exactly<keyof VisimarkOptions, "active" | "path" | "readImport" | "recompute" | "focusableMarks"> = true;

test("E13: the options interface is closed at exactly five keys", () => {
  expect(keys).toBe(true); // the real check is `tsc --noEmit`: a sixth key makes `keys` a type error
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test packages/codemirror-visimark/test/plugin.test.ts`
Expected: FAIL — `visimark` is not exported from `../src/index.js`.

- [ ] **Step 3: Write `timer.ts`**

```ts
/**
 * A trailing debounce with `cancel`: the one thing the extension used
 * `obsidian`'s `debounce(fn, ms, true)` for. A further call before the timer
 * fires replaces the pending one outright.
 */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const call = (...args: A): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  return Object.assign(call, {
    cancel(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  });
}
```

- [ ] **Step 4: Write `findings-field.ts`**

```ts
import { StateEffect, StateField } from "@codemirror/state";
import type { Finding } from "visimark";

/**
 * The finding set the last recompute produced, for `visimarkLint()` to read.
 *
 * `null` means "nothing to show yet": the document has an imported sheet and
 * no snapshot-backed check has landed (a reader-less check would report every
 * imported column as UNDEF — a wrong error, not a missing one).
 *
 * One module-level field shared by `index.js` and `lint.js` — the published
 * build splits them into a common chunk so there is exactly one.
 */
export type FindingSet = readonly Finding[] | null;

export const setFindings = StateEffect.define<FindingSet>();

export const findingsField = StateField.define<FindingSet>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFindings)) return effect.value;
    if (value === null || !tr.docChanged) return value;
    // carry each span across the edit, as RangeSet.map carries the marks
    return value.map((f) => {
      if (f.span === undefined) return f;
      const start = tr.changes.mapPos(f.span.start, 1);
      const end = Math.max(start, tr.changes.mapPos(f.span.end, -1));
      return { ...f, span: { start, end } };
    });
  },
});
```

- [ ] **Step 5: Write `plugin.ts`**

```ts
import {
  RangeSetBuilder,
  StateEffect,
  type EditorState,
  type Extension,
  type Text,
} from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { analyse, analyseWithSnapshot } from "./analysis.js";
import type { Decoration as VmarkDecoration } from "./decorations.js";
import { findingsField, setFindings, type FindingSet } from "./findings-field.js";
import { hasVmarkBlock } from "./gate.js";
import { hasImportedSheet, importDependentNames } from "./import-deps.js";
import type { ReadImport } from "./snapshot.js";
import { debounce } from "./timer.js";

/**
 * The marks: Live Preview's half of #176 row 2, extracted from the Obsidian
 * client (#360). The design notes that used to live in
 * editors/obsidian/src/live-preview.ts still hold and are summarised here:
 *
 * - **Local phase, then snapshot phase.** A reader-less `check` cannot tell
 *   `computed` from `disagrees` for a value that reads an imported sheet, so
 *   such a mark is withheld, and a snapshot-backed `check` fills it in once
 *   the host's `readImport` has served the files (review row 6).
 * - **Map now, recompute later.** An edit maps existing marks through the
 *   change (`RangeSet.map`), which can move a mark but never change its
 *   verdict; only a recompute decides `computed` vs `disagrees` (row 17).
 * - **Nothing writes.** A `Decoration.mark` is a class on rendered text.
 * - **Stale answers are dropped.** An async answer applies only if the view
 *   is alive, `active` still holds, and the document is unchanged.
 */

export const RECOMPUTE_DEBOUNCE_MS = 400;

/** Each live view's plugin value, for `marksIn` — tests only, never exported from index.ts. */
const instances = new WeakMap<EditorView, { decorations: DecorationSet }>();

/** Every mark the plugin holds for `view`, whether or not CodeMirror rendered it. */
export function marksIn(view: EditorView): { from: number; to: number; name: string; disagrees: boolean }[] {
  const set = instances.get(view)?.decorations ?? Decoration.none;
  const out: { from: number; to: number; name: string; disagrees: boolean }[] = [];
  set.between(0, view.state.doc.length, (from, to, value) => {
    const spec = value.spec as { class?: string; attributes?: Record<string, string> };
    out.push({
      from,
      to,
      name: spec.attributes?.["data-vmark"] ?? "",
      disagrees: (spec.class ?? "").includes("visimark-disagrees"),
    });
  });
  return out;
}

export const refreshEffect = StateEffect.define<null>();
const setMarks = StateEffect.define<DecorationSet>();

export interface ResolvedOptions {
  readonly active: (state: EditorState) => boolean;
  readonly path: (state: EditorState) => string | null;
  readonly readImport: ReadImport | undefined;
  readonly recompute: "debounced" | "on-refresh";
  readonly focusableMarks: boolean;
}

function markFor(d: VmarkDecoration, path: string | null, focusable: boolean): Decoration {
  const attributes: Record<string, string> = { "data-vmark": d.name };
  if (focusable) attributes.tabindex = "0";
  if (path !== null) attributes["data-vmark-path"] = path;
  if (d.row !== undefined) attributes["data-vmark-row"] = String(d.row);
  return Decoration.mark({
    class: d.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed",
    attributes,
  });
}

function marksFrom(
  decorations: readonly VmarkDecoration[],
  path: string | null,
  focusable: boolean,
  skip: ReadonlySet<string>,
): { set: DecorationSet; skipped: boolean } {
  const builder = new RangeSetBuilder<Decoration>();
  let skipped = false;
  for (const d of decorations) {
    if (skip.has(d.name)) {
      skipped = true;
      continue;
    }
    builder.add(d.span.start, d.span.end, markFor(d, path, focusable));
  }
  return { set: builder.finish(), skipped };
}

interface Local {
  readonly decorations: DecorationSet;
  readonly findings: FindingSet;
  readonly needsSnapshot: boolean;
}

const NOTHING: Local = { decorations: Decoration.none, findings: [], needsSnapshot: false };

/** The gate, then the reader-less pipeline. */
function localFor(state: EditorState, o: ResolvedOptions): Local {
  if (!o.active(state)) return NOTHING;
  const source = state.doc.toString();
  if (!hasVmarkBlock(source)) return NOTHING;
  const { model, result, decorations } = analyse(source);
  const imported = hasImportedSheet(model);
  const { set, skipped } = marksFrom(
    decorations,
    o.path(state),
    o.focusableMarks,
    importDependentNames(model),
  );
  return {
    decorations: set,
    findings: imported ? null : result.findings,
    needsSnapshot: skipped || imported,
  };
}

export function visimarkExtension(o: ResolvedOptions): Extension {
  const plugin = ViewPlugin.define(
    (view: EditorView) => {
      let destroyed = false;

      const publish = (decorations: DecorationSet, findings: FindingSet): void => {
        view.dispatch({ effects: [setMarks.of(decorations), setFindings.of(findings)] });
      };

      /** Findings for a recompute done during construction or `update()`,
       *  where dispatching is not allowed: queued, and dropped if the
       *  document moved on first. */
      const publishFindingsSoon = (findings: FindingSet, doc: Text): void => {
        queueMicrotask(() => {
          if (!destroyed && view.state.doc === doc) view.dispatch({ effects: setFindings.of(findings) });
        });
      };

      const runSnapshot = (source: string, path: string, read: ReadImport): void => {
        analyseWithSnapshot(source, path, read)
          .then((snapshot) => {
            if (destroyed) return;
            if (!o.active(view.state)) return;
            if (view.state.doc.toString() !== source) return;
            const { set } = marksFrom(snapshot.decorations, path, o.focusableMarks, new Set());
            publish(set, snapshot.result.findings);
          })
          .catch(() => {
            // a failed read leaves withheld marks withheld; the host reports
            // its own read failures where it reports everything else
          });
      };
      const scheduleSnapshot = debounce(runSnapshot, RECOMPUTE_DEBOUNCE_MS);

      const recompute = (state: EditorState): Local => {
        const local = localFor(state, o);
        const path = o.path(state);
        if (local.needsSnapshot && path !== null && o.readImport !== undefined) {
          const source = state.doc.toString();
          if (o.recompute === "debounced") scheduleSnapshot(source, path, o.readImport);
          else runSnapshot(source, path, o.readImport);
        }
        return local;
      };

      const scheduleRecompute = debounce((doc: Text) => {
        if (destroyed || view.state.doc !== doc) return;
        const local = recompute(view.state);
        publish(local.decorations, local.findings);
      }, RECOMPUTE_DEBOUNCE_MS);

      const initial = recompute(view.state);
      publishFindingsSoon(initial.findings, view.state.doc);

      const value = {
        decorations: initial.decorations,
        update(update: ViewUpdate) {
          for (const tr of update.transactions) {
            for (const effect of tr.effects) if (effect.is(setMarks)) this.decorations = effect.value;
          }
          const switched = o.active(update.startState) !== o.active(update.state);
          const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshEffect)));
          if (switched || forced) {
            const local = recompute(update.state);
            this.decorations = local.decorations;
            publishFindingsSoon(local.findings, update.state.doc);
            return;
          }
          if (!o.active(update.state)) {
            this.decorations = Decoration.none;
            return;
          }
          if (update.docChanged) {
            this.decorations = this.decorations.map(update.changes);
            if (o.recompute === "debounced") scheduleRecompute(update.state.doc);
          }
        },
        destroy() {
          destroyed = true;
          scheduleSnapshot.cancel();
          scheduleRecompute.cancel();
          instances.delete(view);
        },
      };
      instances.set(view, value);
      return value;
    },
    { decorations: (p) => p.decorations },
  );
  return [findingsField, plugin];
}
```

- [ ] **Step 6: Write the public `index.ts`**

Replace `packages/codemirror-visimark/src/index.ts`:

```ts
import type { EditorState, Extension, StateEffectType } from "@codemirror/state";
import { refreshEffect, visimarkExtension } from "./plugin.js";

/**
 * codemirror-visimark — VisiMark's marks for any CodeMirror 6 editor (#360).
 *
 * The whole published surface is this file and `./lint`. Everything else in
 * src/ is internal; no engine type appears in a published declaration, and
 * the options are closed — `readImport` returns text and nothing else, so no
 * option can carry an evaluation hook (docs/visimark-design.md §2,
 * constraint 4).
 */

/** Read one file a document declares as an import. Text, or null when unreadable. */
export type ReadImport = (path: string) => Promise<string | null>;

export interface VisimarkOptions {
  /** Whether to decorate this state at all. Default: always. */
  readonly active?: (state: EditorState) => boolean;
  /**
   * The document's path, relative to the root its imports resolve within
   * (`notes/q3.md`, `tutorial/13-imports.md`). The engine sees it as `/` + path.
   * null: this document gets no reader. Default: always null.
   */
  readonly path?: (state: EditorState) => string | null;
  /** How declared imports are read. Absent: no reader, whatever `path` says. */
  readonly readImport?: ReadImport;
  /** When marks are recomputed. Default: "debounced". */
  readonly recompute?: "debounced" | "on-refresh";
  /** Put tabindex="0" on every mark. Default: false. */
  readonly focusableMarks?: boolean;
}

export function visimark(options: VisimarkOptions = {}): Extension {
  return visimarkExtension({
    active: options.active ?? (() => true),
    path: options.path ?? (() => null),
    readImport: options.readImport,
    recompute: options.recompute ?? "debounced",
    focusableMarks: options.focusableMarks ?? false,
  });
}

/** Dispatch `refresh.of(null)` to recompute now, whatever `recompute` says. */
export const refresh: StateEffectType<null> = refreshEffect;
```

- [ ] **Step 7: Run the tests**

Run: `bun test packages/codemirror-visimark && (cd packages/codemirror-visimark && bun run typecheck)`
Expected: PASS, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add packages/codemirror-visimark
git commit -m "feat(codemirror): the visimark() extension, refresh, and the findings field

<trailer>"
```

### Task 4: Obsidian consumes the extension

**Files:**
- Modify: `editors/obsidian/src/live-preview.ts` (shrinks to host wiring)
- Modify: `editors/obsidian/src/settings-tab.ts`
- Modify: `editors/obsidian/test/live-preview.test.ts`
- Modify: `editors/obsidian/test/bundle.test.ts`

**Interfaces:**
- Consumes: `visimark`, `refresh` from `codemirror-visimark` (Task 3).
- Produces: unchanged `livePreviewMarks(enabled: () => boolean, read: VaultRead): Extension` and `editorViewOf(editor: Editor): EditorView | undefined`; `forceLivePreviewRecompute` is removed.

- [ ] **Step 1: Rewrite the Obsidian tests first**

Replace the body of `editors/obsidian/test/live-preview.test.ts` from the `import { editorViewOf, forceLivePreviewRecompute, livePreviewMarks }` line down: import `{ editorViewOf, livePreviewMarks }` from `../src/live-preview.js` and `{ refresh }` from `codemirror-visimark`; keep `viewOver`, `marksNamed`, `invoice`, `NAME`, `ANCHORED_TEXT`, `insertAt`, `duplicateAnchor` as they are; keep these tests unchanged: "an ordinary note…", "a computed value is marked immediately…", "Source mode shows nothing…", "switching back to Source mode…", both `editorViewOf` tests; delete the "an edit maps the existing mark…" test (it is E4 in the package now); rename the `forceLivePreviewRecompute` test to "the settings toggle's refresh recomputes immediately" and dispatch `refresh.of(null)` instead. Add:

```ts
test("every Obsidian mark is focusable, for the tap listener", () => {
  const view = viewOver(invoice);
  for (const el of view.dom.querySelectorAll("[data-vmark]")) {
    expect(el.getAttribute("tabindex")).toBe("0");
  }
  view.destroy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test editors/obsidian/test/live-preview.test.ts`
Expected: FAIL — the old `live-preview.ts` exports `forceLivePreviewRecompute`, not the package's `refresh`, so the settings test sees no recompute.

- [ ] **Step 3: Rewrite `live-preview.ts`**

```ts
import {
  editorInfoField,
  editorLivePreviewField,
  type Editor,
  type MarkdownFileInfo,
} from "obsidian";
import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { visimark } from "codemirror-visimark";
import type { VaultRead } from "./snapshot.js";

/**
 * Live Preview's marks are `codemirror-visimark`'s (#360). What stays here is
 * the part only Obsidian can answer: which note this editor is backed by, and
 * whether Live Preview (not Source mode) is showing.
 *
 * **The bridge from a `StateField` Obsidian exports.** `obsidian.d.ts` types
 * `editorInfoField` and `editorLivePreviewField` against its own declaration
 * of `@codemirror/state`; at run time they are Obsidian's own field objects
 * and the plugin uses Obsidian's CodeMirror (every `@codemirror/*` is
 * external in esbuild.config.mjs), so `state.field` finds them. The cast only
 * crosses two type declarations. **This is the only `as unknown as` in the
 * codebase.**
 */
function fieldValue<T>(state: EditorState, field: unknown): T | undefined {
  return state.field(field as Parameters<typeof state.field>[0], false) as T | undefined;
}

// absent only for an editor not yet backed by a note Obsidian knows the path of
function pathFor(state: EditorState): string | null {
  return fieldValue<MarkdownFileInfo>(state, editorInfoField)?.file?.path ?? null;
}

/** True only in Live Preview, never Source mode or reading mode — review row 17. */
function isLivePreview(state: EditorState): boolean {
  return fieldValue<boolean>(state, editorLivePreviewField) ?? false;
}

/**
 * The extension to register: the package's, gated on the setting and on Live
 * Preview, debounced as it always was, with focusable marks for the tap
 * listener in main.ts (#176 row 3).
 */
export function livePreviewMarks(enabled: () => boolean, read: VaultRead): Extension {
  return visimark({
    active: (state) => enabled() && isLivePreview(state),
    path: pathFor,
    readImport: read,
    recompute: "debounced",
    focusableMarks: true,
  });
}
```

Then append the existing `editorViewOf` function and its doc comment unchanged, replacing "dispatch `forceLivePreviewRecompute`" in that comment with "dispatch the package's `refresh`".

- [ ] **Step 4: Point the settings toggle at `refresh`**

In `editors/obsidian/src/settings-tab.ts` change the import to `import { editorViewOf } from "./live-preview.js";` plus `import { refresh } from "codemirror-visimark";`, and the dispatch to `cm?.dispatch({ effects: refresh.of(null) });`.

- [ ] **Step 5: Guard the bundle against lint and a second engine**

Append to `editors/obsidian/test/bundle.test.ts`:

```ts
test("Obsidian never ships the lint extension (#176 constraint 6: no red)", async () => {
  const text = await bundleText();
  expect(text.includes("@codemirror/lint"), "main.js references @codemirror/lint").toBe(false);
  const walked = [...graph().keys()].map(shortName);
  expect(walked).not.toContain("packages/codemirror-visimark/src/lint.ts");
});

test("the engine's source graph is bundled once", () => {
  const walked = [...graph().keys()].map(shortName);
  const browserEntries = walked.filter((f) => f === "packages/visimark/src/browser.ts");
  expect(browserEntries).toHaveLength(1);
});
```

- [ ] **Step 6: Run everything**

Run: `bun run typecheck && bun test editors/obsidian packages/codemirror-visimark && (cd editors/obsidian && bun run build)`
Expected: PASS. If the size-ceiling test fails, the bundle grew; record the new baseline above `BASELINE_BYTES` in `bundle.test.ts` with the date and "#360: the Live Preview extension now comes from codemirror-visimark" — only if `main.js` grew by less than 2 KB; more than that means something extra was pulled in, which is a bug to find.

- [ ] **Step 7: Commit**

```bash
git add editors/obsidian
git commit -m "refactor(obsidian): Live Preview marks come from codemirror-visimark

<trailer>"
```

### Task 5: The published build

**Files:**
- Modify: `packages/codemirror-visimark/build.ts`
- Create: `packages/codemirror-visimark/test/bundle.test.ts`
- Create: `packages/codemirror-visimark/README.md`

**Interfaces:**
- Consumes: Task 3's `index.ts`; Task 8 adds `lint.ts` to the entry list (the build already lists it and skips it while absent — see Step 1).
- Produces: `dist/index.js`, `dist/index.d.ts`, chunk files, and (from Task 8) `dist/lint.js`, `dist/lint.d.ts`.

- [ ] **Step 1: Write `build.ts`**

```ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The published build (#360). ESM for browsers, CodeMirror external, the
 * engine bundled from its browser-safe source with `node:path` replaced by the
 * string shim — the same two substitutions editors/obsidian/esbuild.config.mjs
 * makes. `splitting` puts the findings field in one shared chunk, so `index.js`
 * and `lint.js` share it; two copies would be two StateFields.
 *
 * Declarations: `tsc -p tsconfig.build.json` (run first, by the `build`
 * script) emits into .types/ with rootDir `..`; only the two public files are
 * copied, and each must import nothing but @codemirror/*.
 */

const here = import.meta.dir;
const dist = join(here, "dist");
const engineBrowser = resolve(here, "../visimark/src/browser.ts");
const pathShim = resolve(here, "src/browser-path.ts");
const entries = ["index", "lint"].filter((e) => existsSync(join(here, "src", `${e}.ts`)));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: entries.map((e) => join(here, "src", `${e}.ts`)),
  outdir: dist,
  target: "browser",
  format: "esm",
  splitting: true,
  minify: true,
  external: ["@codemirror/state", "@codemirror/view", "@codemirror/lint"],
  naming: { entry: "[name].js", chunk: "chunk-[hash].js" },
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

for (const e of entries) {
  const from = join(here, ".types", "codemirror-visimark", "src", `${e}.d.ts`);
  const text = readFileSync(from, "utf8");
  const foreign = [...text.matchAll(/from\s+"([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((s) => !s.startsWith("@codemirror/"));
  if (foreign.length > 0) {
    console.error(`${e}.d.ts imports ${foreign.join(", ")}; the public declarations must be self-contained`);
    process.exit(1);
  }
  copyFileSync(from, join(dist, `${e}.d.ts`));
}
console.log(`codemirror-visimark: built ${entries.join(", ")}`);
```

- [ ] **Step 2: Write the bundle test**

`packages/codemirror-visimark/test/bundle.test.ts`:

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

const js = (): string[] => readdirSync(dist).filter((f) => f.endsWith(".js"));
const text = (f: string): string => readFileSync(join(dist, f), "utf8");

test("B1: index.js, at least one chunk, and index.d.ts are built", () => {
  const files = readdirSync(dist);
  expect(files).toContain("index.js");
  expect(files).toContain("index.d.ts");
});

test("B2: no node: specifier survives into any built file", () => {
  for (const f of js()) expect(text(f).includes("node:"), `${f} contains node:`).toBe(false);
});

test("B3: CodeMirror is imported, never inlined", () => {
  for (const f of js()) {
    expect(text(f).includes("Unrecognized extension value"), `${f} inlines @codemirror/state`).toBe(false);
  }
  expect(text("index.js")).toMatch(/from"@codemirror\/(state|view)"|from "@codemirror\/(state|view)"/);
});

test("B4: no shipped declaration imports the engine", () => {
  for (const f of readdirSync(dist).filter((n) => n.endsWith(".d.ts"))) {
    expect(text(f).includes('"visimark"'), `${f} imports visimark`).toBe(false);
  }
});
```

- [ ] **Step 3: Run the build and the test**

Run: `cd packages/codemirror-visimark && bun run build && bun test test/bundle.test.ts && cd ../..`
Expected: `codemirror-visimark: built index`; 4 pass.

- [ ] **Step 4: Pack and inspect (B5)**

Run: `cd packages/codemirror-visimark && npm pack --dry-run 2>&1 | tail -20; tar -xzOf "$(npm pack --pack-destination /tmp 2>/dev/null | tail -1 | sed 's|^|/tmp/|')" package/package.json | grep -c 'workspace:\|"visimark"'; cd ../..`
Expected: the file list holds only `dist/*`, `README.md`, `LICENSE`, `package.json`; the `grep -c` prints `0`. (On this machine `npm` may be an alias for `bun`; run it with the real npm, `command npm`, or check the tarball in CI's `pack` job in Task 9.)

- [ ] **Step 5: Write the package README**

`packages/codemirror-visimark/README.md` — sections: what it is (one paragraph from spec §1); Install:

```bash
npm i codemirror-visimark @codemirror/state @codemirror/view
bun add codemirror-visimark @codemirror/state @codemirror/view
```

(plus `@codemirror/lint` for the lint subpath); Usage with `visimark()` and `visimarkLint()` (the playground wiring from spec §2.6 as the example); the options table from spec §2.2; the DOM contract from spec §2.3 ("A mark" row) with a two-rule CSS example (`.visimark-computed { text-decoration: underline dotted; }`, `.visimark-disagrees { text-decoration-color: red; }`); peer floors; "The engine is bundled; this package's version is the engine's version"; licence line.

- [ ] **Step 6: Run all package tests and commit**

Run: `bun test packages/codemirror-visimark editors/obsidian`
Expected: PASS.

```bash
git add packages/codemirror-visimark
git commit -m "build(codemirror): the published ESM build, self-contained declarations, README

<trailer>"
git push -u origin HEAD
gh stack submit   # opens the layer PR against issue/360-extract-live-preview-codemirror-impl
```

---

## Layer 2 — `issue/360-cm-2-playground-cm6`

```bash
git switch -c issue/360-cm-2-playground-cm6
```

### Task 6: The playground on CodeMirror 6

**Files:**
- Create: `packages/visimark/src/playground/app/editor.ts`
- Create: `packages/visimark/build-playground.ts`
- Create: `packages/visimark/test/playground/app/editor.test.ts`
- Modify: `packages/visimark/package.json` (devDependencies, `build:playground`)
- Modify: `packages/visimark/src/playground/app/globals.d.ts` (remove CodeMirror)
- Modify: `packages/visimark/src/playground/app/{main,store,pipeline,infer,files,simulate}.ts` (type import; `setLabel`)
- Modify: `packages/visimark/test/playground/app/{store,persistence}.test.ts` (fakes)
- Modify: `packages/visimark/test/playground/a11y.test.ts:83-85`
- Modify: `docs/playground.html` (CodeMirror tags, CSS, CSP comment)
- Modify: `packages/visimark/test/playground/browser-graph.test.ts` (playground bundle ceiling)
- Regenerate: `docs/vendor/visimark-playground.js`

**Interfaces:**
- Produces (`editor.ts`):

```ts
export interface EditorPosition { line: number; ch: number }
export interface EditorPort {
  getValue(): string;
  setValue(text: string): void;
  getCursor(): EditorPosition;
  setCursor(pos: EditorPosition): void;
  getScrollInfo(): { top: number; height: number; clientHeight: number };
  scrollTo(x: number | null, y: number): void;
  on(event: "scroll", handler: () => void): void;
  on(event: "change", handler: (instance: EditorPort, change: { origin?: string }) => void): void;
  setLabel(text: string): void;
  refreshMarks(): void;
}
export interface EditorSetup {
  readonly extensions?: readonly Extension[];
  readonly refresh?: (view: EditorView) => void;
}
export function minimalChange(from: string, to: string): { from: number; to: number; insert: string } | null;
export function createEditor(textarea: HTMLTextAreaElement, setup?: EditorSetup): EditorPort & { readonly view: EditorView };
```

- [ ] **Step 1: Add the devDependencies**

```bash
cd packages/visimark
bun add -d @codemirror/state@^6.7.6 @codemirror/view@^6.43.13 @codemirror/commands @codemirror/language @codemirror/lang-markdown @codemirror/lint @codemirror/search @lezer/highlight @happy-dom/global-registrator@^20.14.5
cd ../..
ls node_modules/.bun | grep -E '^@codemirror\+(state|view)@'
```

Expected: still exactly one `state` and one `view` (the root overrides).

- [ ] **Step 2: Write the failing adapter test**

`packages/visimark/test/playground/app/editor.test.ts`:

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

import { expect, test } from "bun:test";
import { createEditor, minimalChange } from "../../../src/playground/app/editor.js";

function mount(text = ""): HTMLTextAreaElement {
  const host = document.createElement("div");
  const ta = document.createElement("textarea");
  ta.value = text;
  host.appendChild(ta);
  document.body.appendChild(host);
  return ta;
}

test("minimalChange replaces only the differing middle", () => {
  expect(minimalChange("a 1 b", "a 22 b")).toEqual({ from: 2, to: 3, insert: "22" });
  expect(minimalChange("same", "same")).toBeNull();
  expect(minimalChange("", "x")).toEqual({ from: 0, to: 0, insert: "x" });
  expect(minimalChange("abc", "")).toEqual({ from: 0, to: 3, insert: "" });
});

test("the textarea is replaced by the editor, which starts with its text", () => {
  const ta = mount("hello");
  const parent = ta.parentElement!;
  const ed = createEditor(ta);
  expect(parent.contains(ta)).toBe(false);
  expect(parent.contains(ed.view.dom)).toBe(true);
  expect(ed.getValue()).toBe("hello");
  ed.view.destroy();
});

test("setValue reports origin setValue; typing reports +input", () => {
  const ed = createEditor(mount("one"));
  const origins: (string | undefined)[] = [];
  ed.on("change", (_i, c) => origins.push(c.origin));
  ed.setValue("two");
  ed.view.dispatch({ changes: { from: 0, insert: "x" } });
  expect(origins).toEqual(["setValue", "+input"]);
  ed.view.destroy();
});

test("setValue with identical text dispatches no change", () => {
  const ed = createEditor(mount("same"));
  let n = 0;
  ed.on("change", () => n++);
  ed.setValue("same");
  expect(n).toBe(0);
  ed.view.destroy();
});

test("the cursor survives a setValue that rewrites text before it on the same line", () => {
  const ed = createEditor(mount("total = 10\nnext line"));
  ed.setCursor({ line: 1, ch: 4 });
  ed.setValue("total = 1000\nnext line");
  expect(ed.getCursor()).toEqual({ line: 1, ch: 4 });
  ed.view.destroy();
});

test("setCursor clamps to the document", () => {
  const ed = createEditor(mount("ab\ncd"));
  ed.setCursor({ line: 9, ch: 9 });
  expect(ed.getCursor()).toEqual({ line: 1, ch: 2 });
  ed.view.destroy();
});

test("setLabel names the editable surface for assistive tech", () => {
  const ed = createEditor(mount(""));
  ed.setLabel("Editor: notes.md");
  expect(ed.view.contentDOM.getAttribute("aria-label")).toBe("Editor: notes.md");
  ed.view.destroy();
});

test("refreshMarks calls the host's refresh with the view", () => {
  let seen: unknown = null;
  const ed = createEditor(mount(""), { refresh: (v) => (seen = v) });
  ed.refreshMarks();
  expect(seen).toBe(ed.view);
  ed.view.destroy();
});
```

Run: `bun test packages/visimark/test/playground/app/editor.test.ts`
Expected: FAIL — `editor.ts` does not exist.

- [ ] **Step 3: Write `editor.ts`**

```ts
import { Annotation, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { search, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";

/**
 * The editor (#360): CodeMirror 6, bundled, behind the same small surface the
 * store, pipeline and panels used to call on CodeMirror 5 — so none of them,
 * and none of their test fakes, had to learn a new editor.
 *
 * **`setValue` replaces only what changed.** `fmt` and infer hand back the
 * whole document; replacing it whole would drop the cursor to the top and
 * every mark with it. The longest common prefix and suffix bound the one
 * replacement, so the cursor and the marks map across it.
 *
 * **Search is CodeMirror's own.** CodeMirror 6 renders only the lines in
 * view, so the browser's find can miss text off screen; Ctrl/Cmd+F opens a
 * panel that sees the whole document.
 */

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorPort {
  getValue(): string;
  setValue(text: string): void;
  getCursor(): EditorPosition;
  setCursor(pos: EditorPosition): void;
  getScrollInfo(): { top: number; height: number; clientHeight: number };
  scrollTo(x: number | null, y: number): void;
  on(event: "scroll", handler: () => void): void;
  on(event: "change", handler: (instance: EditorPort, change: { origin?: string }) => void): void;
  /** `aria-label` on the editable surface — the one assistive tech reads. */
  setLabel(text: string): void;
  /** Recompute the marks (and, later, the diagnostics) for the text now showing. */
  refreshMarks(): void;
}

export interface EditorSetup {
  readonly extensions?: readonly Extension[];
  readonly refresh?: (view: EditorView) => void;
}

const programmatic = Annotation.define<boolean>();

export function minimalChange(
  from: string,
  to: string,
): { from: number; to: number; insert: string } | null {
  if (from === to) return null;
  const max = Math.min(from.length, to.length);
  let start = 0;
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let endFrom = from.length;
  let endTo = to.length;
  while (endFrom > start && endTo > start && from.charCodeAt(endFrom - 1) === to.charCodeAt(endTo - 1)) {
    endFrom--;
    endTo--;
  }
  return { from: start, to: endFrom, insert: to.slice(start, endTo) };
}

/** Today's dark editor, as the `.CodeMirror*` rules in playground.html had it. */
const theme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "transparent", color: "#e6e6e6", fontSize: "0.82rem" },
    ".cm-scroller": {
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
      lineHeight: "1.55",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      color: "#5c5c5c",
    },
    ".cm-cursor": { borderLeftColor: "#ff453a" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(255, 69, 58, 0.25)",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: tags.heading, color: "#7ee787" },
  { tag: tags.comment, color: "#7d7d7d" },
  { tag: [tags.url, tags.link, tags.monospace], color: "#79c0ff" },
  { tag: tags.list, color: "#ffb454" },
]);

export function createEditor(
  textarea: HTMLTextAreaElement,
  setup: EditorSetup = {},
): EditorPort & { readonly view: EditorView } {
  const changeHandlers: ((i: EditorPort, c: { origin?: string }) => void)[] = [];
  let port: EditorPort & { readonly view: EditorView };

  const listener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    const origin = update.transactions.some((tr) => tr.annotation(programmatic) === true)
      ? "setValue"
      : "+input";
    for (const handler of changeHandlers) handler(port, { origin });
  });

  const view = new EditorView({
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        lineNumbers(),
        history(),
        search(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(highlight),
        theme,
        ...(setup.extensions ?? []),
        listener,
      ],
    }),
    parent: textarea.parentElement ?? document.body,
  });
  textarea.remove();

  port = {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      const change = minimalChange(view.state.doc.toString(), text);
      if (change === null) return;
      view.dispatch({ changes: change, annotations: programmatic.of(true) });
    },
    getCursor() {
      const head = view.state.selection.main.head;
      const line = view.state.doc.lineAt(head);
      return { line: line.number - 1, ch: head - line.from };
    },
    setCursor(pos) {
      const doc = view.state.doc;
      const line = doc.line(Math.min(Math.max(pos.line + 1, 1), doc.lines));
      view.dispatch({ selection: { anchor: line.from + Math.min(Math.max(pos.ch, 0), line.length) } });
    },
    getScrollInfo: () => ({
      top: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      clientHeight: view.scrollDOM.clientHeight,
    }),
    scrollTo(_x, y) {
      view.scrollDOM.scrollTop = y;
    },
    on(event: "scroll" | "change", handler: (...args: never[]) => void) {
      if (event === "scroll") view.scrollDOM.addEventListener("scroll", handler as () => void);
      else changeHandlers.push(handler as (i: EditorPort, c: { origin?: string }) => void);
    },
    setLabel(text) {
      view.contentDOM.setAttribute("aria-label", text);
    },
    refreshMarks() {
      setup.refresh?.(view);
    },
  };
  return port;
}
```

Run: `bun test packages/visimark/test/playground/app/editor.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 4: Move the playground onto the port**

- `globals.d.ts`: delete `CodeMirrorEditor`, `CodeMirrorPosition` and `declare const CodeMirror`; in the header comment change "The three libraries" to "The two libraries" and add: "CodeMirror used to be the third; since #360 it is bundled (see ./editor.ts) and has real types."
- In `store.ts`, `pipeline.ts`, `infer.ts`, `files.ts`, `simulate.ts`: add `import type { EditorPort } from "./editor.js";` and replace the parameter type `CodeMirrorEditor` with `EditorPort`.
- `files.ts` `setEditorName`: replace `cm.getInputField().setAttribute("aria-label", \`Editor: ${name}\`);` with `cm.setLabel(\`Editor: ${name}\`);`. Update the comment near line 76 that mentions `#editor-ta`: "the editor replaces `#editor-ta` in the markup (./editor.ts), so the label goes on its editable surface instead".
- `main.ts`: replace the `CodeMirror.fromTextArea(...)` call with `const cm = createEditor(byId<HTMLTextAreaElement>("editor-ta"));` and add `import { createEditor } from "./editor.js";`.
- `test/playground/app/store.test.ts` and `persistence.test.ts`: `import type { EditorPort } from "../../../src/playground/app/editor.js";`, rename `CodeMirrorEditor` to `EditorPort` in both fakes; in `persistence.test.ts` replace `getInputField: () => ({ setAttribute: () => {} }),` with `setLabel: () => {},` and add `refreshMarks: () => {},`; in `store.test.ts` add `refreshMarks: () => {},` and `setLabel: () => {},`.
- `test/playground/a11y.test.ts:83-85`: the test becomes

```ts
  test("is set on the editable surface CodeMirror hands to assistive tech", () => {
    expect(files).toContain("cm.setLabel(`Editor: ${name}`)");
  });
```

and `editor.ts`'s `setLabel` is what puts it on `contentDOM` (covered by `editor.test.ts`).

- [ ] **Step 5: Write the playground build script**

`packages/visimark/build-playground.ts`:

```ts
import { resolve } from "node:path";

/**
 * The playground application bundle (docs/vendor/visimark-playground.js).
 * A script rather than a `bun build` command line since #360, because it
 * resolves two specifiers the command line cannot alias:
 *
 * - `codemirror-visimark` (and `/x.js` subpaths) to the package's source, as
 *   Obsidian does — never its dist;
 * - `visimark` to ./src/playground/app/engine-global.ts, which re-exports the
 *   engine the page already loaded as `window.VisiMark`, so the engine is not
 *   bundled a second time.
 *
 * And it refuses a bundle with two copies of @codemirror/state: an extension
 * built by one copy is not recognised by the other.
 */

const here = import.meta.dir;
const extensionSrc = resolve(here, "../codemirror-visimark/src");
const engineGlobal = resolve(here, "src/playground/app/engine-global.ts");
const out = resolve(here, "../../docs/vendor/visimark-playground.js");

const result = await Bun.build({
  entrypoints: [resolve(here, "src/playground/app/main.ts")],
  target: "browser",
  format: "iife",
  minify: true,
  plugins: [
    {
      name: "playground-aliases",
      setup(build) {
        build.onResolve({ filter: /^visimark$/ }, () => ({ path: engineGlobal }));
        build.onResolve({ filter: /^codemirror-visimark(\/.*)?$/ }, (args) => {
          const sub = args.path.slice("codemirror-visimark".length);
          return {
            path:
              sub === ""
                ? resolve(extensionSrc, "index.ts")
                : resolve(extensionSrc, sub.slice(1).replace(/\.js$/, ".ts")),
          };
        });
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const text = await result.outputs[0]!.text();
const copies = text.split("Unrecognized extension value").length - 1;
if (copies !== 1) {
  console.error(`visimark-playground.js holds ${copies} copies of @codemirror/state; expected 1`);
  process.exit(1);
}
await Bun.write(out, text);
```

`engine-global.ts` arrives in Task 7; until then the `visimark` filter never matches. In `packages/visimark/package.json` replace the second command of `build:playground`:

```
bun build src/playground/app/main.ts --target browser --format iife --minify --outfile ../../docs/vendor/visimark-playground.js
```

with `bun build-playground.ts`. Add `"build-playground.ts"` to `tsconfig.app.json`'s `include`.

- [ ] **Step 6: Update the page**

In `docs/playground.html`:
- Delete the CodeMirror `<link rel="stylesheet" …codemirror.min.css…>` and the five `<script>` tags for `codemirror.min.js`, `mode/xml`, `mode/markdown`, `addon/mode/overlay`, `mode/gfm`.
- Delete the CSS rules `.CodeMirror`, `.CodeMirror-gutters`, `.CodeMirror-linenumber`, `.CodeMirror-cursor`, `.cm-s-default .cm-header`, `.cm-s-default .cm-comment`, `.cm-s-default .cm-string`, `.cm-s-default .cm-variable-2`, `.CodeMirror-selected` (the theme in `editor.ts` replaces them); keep `.editor .panel-body`.
- In the CSP comment: "cdnjs for CodeMirror and marked" → "cdnjs for marked"; replace the `style-src` paragraph's second clause "and CodeMirror sets element styles as it lays out the editor" with "and CodeMirror 6 injects its theme as style rules at run time. Whether a policy without it would still let those apply is untested (#360 spec §8), so style-src does still carry it". Keep the phrase "style-src does still carry it" — `csp.test.ts` asserts it.
- In the preload comment, after the sentence ending "after them.", add: "Since #360 the editor is bundled into visimark-playground.js, so these two are the only scripts the page waits on besides marked."

- [ ] **Step 7: Build, measure, and add the size ceiling**

Run: `bun run --filter visimark build:playground && wc -c docs/vendor/visimark-playground.js`

Append to `packages/visimark/test/playground/browser-graph.test.ts`:

```ts
const playgroundBundle = resolve(import.meta.dir, "../../../../docs/vendor/visimark-playground.js");

/**
 * The size of docs/vendor/visimark-playground.js the day CodeMirror 6 was
 * bundled into it (#360), measured as `wc -c`. Before #360 it was ~39 KB and
 * CodeMirror 5 came from cdnjs. Same discipline as BASELINE_BYTES above.
 */
const PLAYGROUND_BASELINE_BYTES = /* the wc -c value from this step */ 0;
const PLAYGROUND_MAX_BYTES = Math.ceil(PLAYGROUND_BASELINE_BYTES * 1.1);

test("the playground application bundle stays under its ceiling", () => {
  const actual = statSync(playgroundBundle).size;
  expect(
    actual,
    `docs/vendor/visimark-playground.js is ${actual} bytes, over the ${PLAYGROUND_MAX_BYTES}-byte ` +
      `ceiling. If the growth is real and reviewed, bump PLAYGROUND_BASELINE_BYTES with the date ` +
      `and reason; if not, look for a second CodeMirror language or an engine import in the app.`,
  ).toBeLessThanOrEqual(PLAYGROUND_MAX_BYTES);
});
```

Replace `0` with the measured number and the comment marker with the date. Expected magnitude: 600–650 KB.

- [ ] **Step 8: Run everything and check the page by hand**

Run: `bun run typecheck && bun test packages/visimark && bun run --filter visimark build:playground && git diff --stat docs/vendor`
Expected: PASS; only `visimark-playground.js` changed in `docs/vendor`.

Run: `bun run serve` and open `/playground.html`. Check: the editor shows with line numbers and today's colours; typing reruns the pipeline after the pause; Ctrl/Cmd+F opens the search panel; undo works; switching files and reverting work; the editor and preview scroll together.

- [ ] **Step 9: Commit and submit**

```bash
git add packages/visimark docs/playground.html docs/vendor/visimark-playground.js bun.lock
git commit -m "feat(playground): CodeMirror 6, bundled, behind the same editor surface

<trailer>"
git push -u origin HEAD
gh stack submit
```

---

## Layer 3 — `issue/360-cm-3-playground-marks`

```bash
git switch -c issue/360-cm-3-playground-marks
```

### Task 7: The playground uses the extension

**Files:**
- Create: `packages/visimark/src/playground/app/engine-global.ts`
- Create: `packages/visimark/test/playground/app/engine-global.test.ts`
- Modify: `packages/visimark/src/playground/browser-entry.ts` (add `describeFinding` to `api`)
- Modify: `packages/visimark/tsconfig.app.json` (`paths`)
- Modify: `packages/visimark/src/playground/app/{main,store,pipeline}.ts`
- Modify: `packages/visimark/test/playground/app/persistence.test.ts` (a refresh-ordering test)
- Modify: `docs/playground.html` (mark styles)
- Regenerate: `docs/vendor/visimark-browser.js`, `docs/vendor/visimark-playground.js`

**Interfaces:**
- Consumes: `visimark`, `refresh` (Task 3); `createEditor`, `EditorSetup` (Task 6).
- Produces: `FileStore.enginePath(name: string): string | null`; `FileStore.readImport(path: string): string | null`; `engine-global.ts` exports `locate`, `build`, `check`, `memoryReader`, `topoOrder`, `describeFinding`.

- [ ] **Step 1: Write the failing engine-global tests**

`packages/visimark/test/playground/app/engine-global.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const extensionSrc = resolve(import.meta.dir, "../../../../codemirror-visimark/src");
const globalSrc = readFileSync(
  resolve(import.meta.dir, "../../../src/playground/app/engine-global.ts"),
  "utf8",
);

/** every value (not `type`) name the extension imports from "visimark" */
function runtimeImports(): Set<string> {
  const names = new Set<string>();
  for (const f of readdirSync(extensionSrc).filter((n) => n.endsWith(".ts"))) {
    const text = readFileSync(join(extensionSrc, f), "utf8");
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"visimark";/g)) {
      for (const part of m[1]!.split(",")) {
        const name = part.trim();
        if (name !== "" && !name.startsWith("type ")) names.add(name);
      }
    }
  }
  return names;
}

test("engine-global exports every runtime name the extension imports from visimark", () => {
  const exported = new Set([...globalSrc.matchAll(/export const (\w+)/g)].map((m) => m[1]!));
  const missing = [...runtimeImports()].filter((n) => !exported.has(n));
  expect(missing, `engine-global.ts lacks ${missing.join(", ")}`).toEqual([]);
});

test("Review 1: importing engine-global without window.VisiMark does not throw", async () => {
  const saved = (globalThis as { VisiMark?: unknown }).VisiMark;
  delete (globalThis as { VisiMark?: unknown }).VisiMark;
  await import("../../../src/playground/app/engine-global.js");
  (globalThis as { VisiMark?: unknown }).VisiMark = saved;
});
```

Run: `bun test packages/visimark/test/playground/app/engine-global.test.ts`
Expected: FAIL — the file does not exist.

- [ ] **Step 2: Write `engine-global.ts` and export `describeFinding`**

In `packages/visimark/src/playground/browser-entry.ts`: add `describeFinding` to the import from `../report/format.js` (beside `formatCheck`) and to the `api` object after `formatCheck`.

`packages/visimark/src/playground/app/engine-global.ts`:

```ts
import type { VisiMarkApi } from "../browser-entry.js";

/**
 * `visimark`, as the playground bundle sees it (#360). codemirror-visimark
 * imports the engine by name; build-playground.ts resolves that name here,
 * and here is the engine the page already loaded as `window.VisiMark` — so
 * one copy of the engine is on the page, not two.
 *
 * **Every export is a function that reads the global when called, never at
 * import.** main.ts reports a missing engine (a `file://` visit, a failed
 * script) through the boot overlay; a module that touched `window.VisiMark`
 * on load would throw before main.ts could say anything.
 *
 * engine-global.test.ts fails when the extension starts importing a name
 * this file does not export.
 */
const vm = (): VisiMarkApi => window.VisiMark;

export const locate: VisiMarkApi["locate"] = (...args) => vm().locate(...args);
export const build: VisiMarkApi["build"] = (...args) => vm().build(...args);
export const check: VisiMarkApi["check"] = (...args) => vm().check(...args);
export const memoryReader: VisiMarkApi["memoryReader"] = (...args) => vm().memoryReader(...args);
export const topoOrder: VisiMarkApi["topoOrder"] = (...args) => vm().topoOrder(...args);
export const describeFinding: VisiMarkApi["describeFinding"] = (...args) => vm().describeFinding(...args);
```

If `tsc` rejects a `(...args) =>` form for an overloaded function, write that one as `(a, b) => vm().check(a, b)` with the parameters of its signature.

`packages/visimark/tsconfig.app.json` `compilerOptions`: add

```jsonc
    // codemirror-visimark from source, and `visimark` as its source types —
    // the bundle swaps the runtime for ./src/playground/app/engine-global.ts
    // (build-playground.ts), the types stay the engine's own (#360)
    "paths": {
      "visimark": ["./src/browser.ts"],
      "codemirror-visimark": ["../codemirror-visimark/src/index.ts"],
      "codemirror-visimark/*": ["../codemirror-visimark/src/*"]
    }
```

Run: `bun test packages/visimark/test/playground/app/engine-global.test.ts`
Expected: PASS. (Lint's `describeFinding` import arrives in Task 8; it is already exported.)

- [ ] **Step 3: The store serves the reader paths**

In `store.ts`'s `FileStore` interface add:

```ts
  /**
   * The path codemirror-visimark should give the engine for `name` — the
   * READER_FS key without its leading `/` — or null for a file that gets no
   * reader (every file but the imports chapter; see READER_FS above).
   */
  enginePath(name: string): string | null;
  /** The text of a reader-served file, by the path enginePath gave, or null. */
  readImport(path: string): string | null;
```

and in the returned object:

```ts
    enginePath(name) {
      for (const path of Object.keys(READER_FS)) if (READER_FS[path] === name) return path.slice(1);
      return null;
    },
    readImport(path) {
      const name = READER_FS["/" + path];
      return name === undefined ? null : (text(name) ?? null);
    },
```

Add to `test/playground/app/store.test.ts` (using that file's existing `createStore` setup):

```ts
test("enginePath names only reader-served files, and readImport reads them", () => {
  // after creating the store with 13-imports.md and 13-imports.csv loaded:
  expect(store.enginePath("13-imports.md")).toBe("tutorial/13-imports.md");
  expect(store.enginePath("12-charts.md")).toBeNull();
  expect(store.readImport("tutorial/13-imports.csv")).toBe(csvText);
  expect(store.readImport("tutorial/elsewhere.csv")).toBeNull();
});
```

Build the store in that test the way the file's neighbouring tests do, with `13-imports.md` and `13-imports.csv` in its contents and `csvText` the CSV string you gave it.

- [ ] **Step 4: Wire the extension into the editor**

In `main.ts`:

```ts
import { refresh, visimark } from "codemirror-visimark";
import type { FileStore } from "./store.js";
```

(`FileStore` is already imported as a type; reuse it.) Replace `const cm = createEditor(...)` and the `createStore` line with:

```ts
  // The extension asks the store which file is open and what it imports; the
  // store needs the editor to exist first, so the extension reads it through
  // this reference, which is set before anything can recompute (#360).
  let storeRef: FileStore | null = null;
  const cm = createEditor(byId<HTMLTextAreaElement>("editor-ta"), {
    extensions: [
      visimark({
        path: () => (storeRef === null ? null : storeRef.enginePath(storeRef.current())),
        readImport: async (path) => storeRef?.readImport(path) ?? null,
        recompute: "on-refresh",
      }),
    ],
    refresh: (view) => view.dispatch({ effects: refresh.of(null) }),
  });

  const store = createStore(VM, cm, buffers, files, initial);
  storeRef = store;
```

In `pipeline.ts`, at the very end of `refreshDerived()` (after the preview `try`/`catch`), add:

```ts
    // the marks (and, with lint, the diagnostics) follow the text this pass
    // just settled on — never a cell fmt is about to overwrite (#360)
    cm.refreshMarks();
```

- [ ] **Step 5: Pin the refresh in the pipeline test**

In `test/playground/app/persistence.test.ts`, give `fakeEditor` a counter: `refreshes: 0,` and `refreshMarks: () => { cm.refreshes++; },` (add `refreshes: number` to its return type), then add a test using the file's existing pipeline setup:

```ts
test("every pass ends by refreshing the marks", () => {
  // build the pipeline as the neighbouring tests do, then:
  pipeline.runNow();
  expect(cm.refreshes).toBe(1);
});
```

- [ ] **Step 6: Style the marks**

In `docs/playground.html`, after the `.editor .panel-body` rule, add:

```css
      .visimark-computed {
        text-decoration: underline dotted rgba(126, 231, 135, 0.6);
        text-underline-offset: 3px;
      }
      .visimark-disagrees {
        text-decoration: underline wavy #ff453a;
      }
```

- [ ] **Step 7: Rebuild and check by hand**

Run: `bun run typecheck && bun test packages/visimark && bun run --filter visimark build:playground && bun test packages/visimark/test/playground`
Expected: PASS; `visimark-browser.js` still under its ceiling (the `describeFinding` export adds bytes only for the export, `format.js` was already in the graph).

Run: `bun run serve`, open `/playground.html?file=example-invoice-drift.md`. Check (spec P1–P5): the drifted values carry the wavy red underline on open; changing a computed cell and pausing restores it and leaves it dotted-green with the cursor where it was; in the imports chapter, editing `13-imports.csv` and switching back to `13-imports.md` updates the marks; `12-charts.md` shows no new error; the editor's `aria-label` follows the file.

- [ ] **Step 8: Commit and submit**

```bash
git add packages/visimark docs/playground.html docs/vendor
git commit -m "feat(playground): mark computed and disagreeing values with codemirror-visimark

<trailer>"
git push -u origin HEAD
gh stack submit
```

---

## Layer 4 — `issue/360-cm-4-lint-release`

```bash
git switch -c issue/360-cm-4-lint-release
```

### Task 8: The lint subpath, enabled in the playground

**Files:**
- Create: `packages/codemirror-visimark/src/severity.ts`
- Create: `packages/codemirror-visimark/src/lint.ts`
- Create: `packages/codemirror-visimark/test/lint.test.ts`
- Modify: `packages/codemirror-visimark/test/bundle.test.ts` (lint files)
- Modify: `packages/visimark/src/playground/app/main.ts`
- Regenerate: `docs/vendor/visimark-playground.js`; update its ceiling only if needed

**Interfaces:**
- Consumes: `findingsField`, `setFindings` (Task 3); `describeFinding` from `visimark`.
- Produces: `visimarkLint(): Extension` from `codemirror-visimark/lint`; `SEVERITY: Record<FindingCode, "error" | "warning" | "info" | "hint">`.

- [ ] **Step 1: Write the failing tests**

`packages/codemirror-visimark/test/lint.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forEachDiagnostic, forceLinting, type Diagnostic } from "@codemirror/lint";
import { build, check, describeFinding, locate } from "visimark";
import { refresh, visimark } from "../src/index.js";
import { visimarkLint } from "../src/lint.js";
import { SEVERITY } from "../src/severity.js";

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");
const imports = readFileSync(join(docs, "playground/tutorial/13-imports.md"), "utf8");
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function view(doc: string, withMarks = true): EditorView {
  const extensions = withMarks ? [visimark({ recompute: "on-refresh" }), visimarkLint()] : [visimarkLint()];
  return new EditorView({ state: EditorState.create({ doc, extensions }), parent: document.body });
}
async function diagnostics(v: EditorView): Promise<Diagnostic[]> {
  await wait(20);
  forceLinting(v);
  await wait(20);
  const out: Diagnostic[] = [];
  forEachDiagnostic(v.state, (d) => out.push(d));
  return out;
}

test("E10: one warning per spanned STALE, in the CLI's words", async () => {
  const v = view(drift);
  const stale = check(build(locate(drift))).findings.filter((f) => f.code === "STALE" && f.span);
  const found = await diagnostics(v);
  const warnings = found.filter((d) => d.severity === "warning");
  expect(warnings).toHaveLength(stale.length);
  for (const d of found) expect(d.source).toBe("visimark");
  expect(warnings.map((d) => d.message).sort()).toEqual(stale.map((f) => describeFinding(f)).sort());
  v.destroy();
});

test("E11: a document with an imported sheet and no reader gets no diagnostics", async () => {
  const v = view(imports);
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("E12: lint without visimark() yields nothing and does not throw", async () => {
  const v = view(drift, false);
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("Review 5: deleting the last vmark block clears every diagnostic", async () => {
  const v = view(drift);
  expect((await diagnostics(v)).length).toBeGreaterThan(0);
  v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: "# gone\n" } });
  v.dispatch({ effects: refresh.of(null) });
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("the severity table: problems are errors, STALE and ANCHOR warn, WARN hints", () => {
  expect(SEVERITY.STALE).toBe("warning");
  expect(SEVERITY.ANCHOR).toBe("warning");
  expect(SEVERITY.WARN).toBe("hint");
  expect(SEVERITY.NOTE).toBe("info");
  for (const code of ["DATE", "UNIT", "UNDEF", "DUP", "VECTOR", "CYCLE", "TYPE", "SHEET", "ASSERT", "DOMAIN", "ARTIFACT", "IMPORT", "PRECISION", "COVERAGE"] as const) {
    expect(SEVERITY[code]).toBe("error");
  }
});
```

Run: `bun test packages/codemirror-visimark/test/lint.test.ts`
Expected: FAIL — `../src/lint.js` does not exist.

- [ ] **Step 2: Write `severity.ts` and `lint.ts`**

`packages/codemirror-visimark/src/severity.ts`:

```ts
import type { FindingCode } from "visimark";

/**
 * A finding's diagnostic severity. The LSP's table
 * (packages/visimark-lsp/src/diagnostics.ts) for every code it lists; plus
 * `PRECISION` and `COVERAGE`, which fail `check` and which the LSP shows as
 * information only because its table omits them. Typed on `FindingCode`, so a
 * code the engine adds does not compile here until it has a row.
 */
export const SEVERITY: Record<FindingCode, "error" | "warning" | "info" | "hint"> = {
  STALE: "warning",
  DATE: "error",
  UNIT: "error",
  UNDEF: "error",
  DUP: "error",
  VECTOR: "error",
  CYCLE: "error",
  TYPE: "error",
  SHEET: "error",
  ANCHOR: "warning",
  ASSERT: "error",
  PRECISION: "error",
  DOMAIN: "error",
  ARTIFACT: "error",
  IMPORT: "error",
  WARN: "hint",
  NOTE: "info",
  COVERAGE: "error",
};
```

`packages/codemirror-visimark/src/lint.ts`:

```ts
import type { Extension } from "@codemirror/state";
import { linter, type Diagnostic } from "@codemirror/lint";
import { describeFinding } from "visimark";
import { findingsField, setFindings } from "./findings-field.js";
import { SEVERITY } from "./severity.js";

/**
 * codemirror-visimark/lint — diagnostics over the finding set `visimark()`
 * computed for this editor, in the CLI's own words (#360). It runs no engine
 * pass of its own: it reads the field the marks' recompute fills, and re-reads
 * it whenever that field is replaced. Without `visimark()` in the same editor
 * there is no field, and there are no diagnostics.
 *
 * Obsidian does not use this — #176's constraint 6 forbids red and finding
 * codes in its UI.
 */
export function visimarkLint(): Extension {
  return linter(
    (view) => {
      const findings = view.state.field(findingsField, false);
      if (!findings) return [];
      const length = view.state.doc.length;
      const out: Diagnostic[] = [];
      for (const f of findings) {
        if (f.span === undefined) continue; // NOTE, the collapsed anchor group
        const from = Math.min(f.span.start, length);
        out.push({
          from,
          to: Math.min(Math.max(f.span.end, from), length),
          severity: SEVERITY[f.code],
          source: "visimark",
          message: describeFinding(f),
        });
      }
      return out;
    },
    {
      delay: 0,
      needsRefresh: (update) =>
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setFindings))),
    },
  );
}
```

Run: `bun test packages/codemirror-visimark && (cd packages/codemirror-visimark && bun run typecheck)`
Expected: PASS.

- [ ] **Step 3: The published build includes lint**

Append to `packages/codemirror-visimark/test/bundle.test.ts`:

```ts
test("B1: lint.js and lint.d.ts are built, and share a chunk with index.js", () => {
  const files = readdirSync(dist);
  expect(files).toContain("lint.js");
  expect(files).toContain("lint.d.ts");
  expect(files.some((f) => f.startsWith("chunk-"))).toBe(true);
  const chunkOf = (f: string): string[] => [...text(f).matchAll(/"\.\/(chunk-[^"]+\.js)"/g)].map((m) => m[1]!);
  const shared = chunkOf("index.js").filter((c) => chunkOf("lint.js").includes(c));
  expect(shared.length).toBeGreaterThan(0);
});

test("only lint.js imports @codemirror/lint", () => {
  for (const f of js()) {
    if (f === "lint.js") continue;
    expect(text(f).includes("@codemirror/lint"), `${f} imports @codemirror/lint`).toBe(false);
  }
});
```

Run: `bun test packages/codemirror-visimark/test/bundle.test.ts`
Expected: PASS (build.ts already lists `lint` when `src/lint.ts` exists).

- [ ] **Step 4: The playground turns lint on**

In `packages/visimark/src/playground/app/main.ts`:

```ts
import { visimarkLint } from "codemirror-visimark/lint.js";
import { forceLinting } from "@codemirror/lint";
```

add `visimarkLint(),` after the `visimark({...})` entry in `extensions`, and make `refresh`:

```ts
    refresh: (view) => {
      view.dispatch({ effects: refresh.of(null) });
      forceLinting(view);
    },
```

Rebuild: `bun run --filter visimark build:playground && bun test packages/visimark/test/playground/browser-graph.test.ts`. If the playground ceiling fails by less than the lint package's size (~15 KB), bump `PLAYGROUND_BASELINE_BYTES` to the new `wc -c` with a dated line "#360 layer 4: @codemirror/lint for the diagnostics". Check by hand with `bun run serve`: the drift invoice shows warnings on the drifted values; hovering one shows the CLI's sentence.

- [ ] **Step 5: Commit**

```bash
git add packages/codemirror-visimark packages/visimark docs/vendor
git commit -m "feat(codemirror): lint diagnostics over the finding set, on in the playground

<trailer>"
```

### Task 9: CI — pack, smoke at the peer floor and the latest, version agreement

**Files:**
- Create: `scripts/codemirror-smoke.mjs`
- Modify: `.github/workflows/ci.yml` (`pack`, `smoke-node`, `smoke-bun`, the version-agreement step, `node-support-policy`)

**Interfaces:**
- Consumes: the package's `npm pack` tarball `codemirror-visimark-<version>.tgz`.

- [ ] **Step 1: Write the smoke script**

`scripts/codemirror-smoke.mjs`:

```js
// Library smoke for codemirror-visimark, run by ci.yml's smoke-node (peer
// floor) and smoke-bun (latest peers) from a scratch project that installed
// the *packed* tarball. It renders a real EditorView under happy-dom: the
// marks appear, refresh recomputes, and lint reports the one STALE with a
// span. Anything else is a broken artifact.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

const { EditorState } = await import("@codemirror/state");
const { EditorView } = await import("@codemirror/view");
const { forEachDiagnostic, forceLinting } = await import("@codemirror/lint");
const { visimark, refresh } = await import("codemirror-visimark");
const { visimarkLint } = await import("codemirror-visimark/lint");

const doc =
  "# smoke\n\n```vmark #s\na = 2\nb = a * 3\nc = a + 1\n```\n\nB is **6**<!--vmark=s.b--> and C is **4**<!--vmark=s.c-->.\n";

const view = new EditorView({
  state: EditorState.create({ doc, extensions: [visimark({ recompute: "on-refresh" }), visimarkLint()] }),
  parent: document.body,
});
view.dispatch({ effects: refresh.of(null) });
await new Promise((r) => setTimeout(r, 20));
forceLinting(view);
await new Promise((r) => setTimeout(r, 20));

const marks = view.dom.querySelectorAll(".visimark-computed").length;
const disagrees = view.dom.querySelectorAll(".visimark-disagrees").length;
let diagnostics = 0;
forEachDiagnostic(view.state, () => diagnostics++);
view.destroy();

if (marks !== 2 || disagrees !== 1 || diagnostics !== 1) {
  console.error(`::error::codemirror-visimark: ${marks} marks, ${disagrees} disagrees, ${diagnostics} diagnostics; expected 2, 1, 1`);
  process.exit(1);
}
console.log(`codemirror-visimark ok — ${marks} marks, ${disagrees} disagrees, ${diagnostics} diagnostic`);
await GlobalRegistrator.unregister();
```

Check it locally against a packed tarball:

```bash
(cd packages/codemirror-visimark && bun run build && command npm pack --pack-destination /tmp)
mkdir -p /tmp/cm-smoke && cd /tmp/cm-smoke && echo '{"name":"s","private":true,"type":"module"}' > package.json
bun add /tmp/codemirror-visimark-*.tgz @codemirror/state@6.5.2 @codemirror/view@6.36.2 @codemirror/lint@6.4.0 @happy-dom/global-registrator@20
cp ~/Projects/visimark/scripts/codemirror-smoke.mjs . && bun codemirror-smoke.mjs; cd -
```

Expected: `codemirror-visimark ok — 2 marks, 1 disagrees, 1 diagnostic`. If the floor versions fail, the extension uses an API newer than the floor: find it (`bun test` with the floor versions installed in the scratch project shows which import is undefined) and either avoid it or raise the floor in the spec and `package.json` together.

- [ ] **Step 2: Pack it in CI**

In `.github/workflows/ci.yml`'s `pack` job, after "pack the markdownlint rule tarball":

```yaml
      # codemirror-visimark has no `bin`; packed to prove the tarball imports and
      # renders as a library at both ends of its peer ranges (#360). Its name
      # does not match `visimark-*`, so the engine/MCP shapes stay unambiguous.
      - name: pack the CodeMirror extension tarball
        working-directory: packages/codemirror-visimark
        run: npm pack --pack-destination "$RUNNER_TEMP"
```

add `${{ runner.temp }}/codemirror-visimark-*.tgz` to the `visimark-tarball` upload `path`, and add `cp scripts/codemirror-smoke.mjs "$RUNNER_TEMP/codemirror-smoke.mjs"` to the copy step and `${{ runner.temp }}/codemirror-smoke.mjs` to the `mcp-handshake` upload `path`.

- [ ] **Step 3: Smoke under Node at the floor**

In `smoke-node`, after the lint-plugins step:

```yaml
      - name: the CodeMirror extension renders under Node only, at its peer floor
        run: |
          set -e
          # The floor of every peer range, exactly: an API the extension uses
          # that is newer than its declared floor fails here, not for a user
          # (#360 spec §6). smoke-bun runs the same script at the latest peers.
          cm_tgz="$(pwd)/$(ls codemirror-visimark-*.tgz)"
          mkdir cm && cd cm
          printf '{"name":"cm","private":true,"type":"module"}' > package.json
          npm i "$cm_tgz" @codemirror/state@6.5.2 @codemirror/view@6.36.2 @codemirror/lint@6.4.0 @happy-dom/global-registrator@20
          packed=$(tar -xzOf "$cm_tgz" package/package.json | tr -d ' \n')
          installed=$(tr -d ' \n' < node_modules/codemirror-visimark/package.json)
          [ "$packed" = "$installed" ] || { echo "::error::the extension under test is not the packed one"; exit 1; }
          cp ../codemirror-smoke.mjs .
          node codemirror-smoke.mjs
```

- [ ] **Step 4: Smoke under Bun at the latest**

In `smoke-bun`, after the lint-plugins step:

```yaml
      - name: the CodeMirror extension renders under Bun only, at the latest peers
        run: |
          set -e
          export PATH="$(bun pm bin -g):/usr/local/bin:/usr/bin:/bin"
          if command -v node >/dev/null 2>&1; then
            echo "::error::node still on PATH; smoke-bun must be Bun-only"; exit 1
          fi
          cm_tgz="$(pwd)/$(ls codemirror-visimark-*.tgz)"
          mkdir cm && cd cm
          printf '{"name":"cm","private":true,"type":"module"}' > package.json
          bun add "$cm_tgz" @codemirror/state @codemirror/view @codemirror/lint @happy-dom/global-registrator@20
          packed=$(tar -xzOf "$cm_tgz" package/package.json | tr -d ' \n')
          installed=$(tr -d ' \n' < node_modules/codemirror-visimark/package.json)
          [ "$packed" = "$installed" ] || { echo "::error::the extension under test is not the packed one"; exit 1; }
          cp ../codemirror-smoke.mjs .
          bun codemirror-smoke.mjs
```

- [ ] **Step 5: Version agreement and the Node policy**

In "every version-carrying file must agree":
- after the `mcp_dep=` line add `cm_version=$(bun -e 'console.log(require("./packages/codemirror-visimark/package.json").version)')`;
- wherever the step compares `mcp_version` with `engine` (and reads `lock_field` for `packages/visimark-mcp`), add the same comparison for `cm_version` and for `lock_field packages/codemirror-visimark version`, with the error text `packages/codemirror-visimark/package.json version`; there is no `visimark` pin to compare;
- in the step's header comment change "Twenty files/fields carry the version and all twenty must agree. The six package manifests" to "Twenty-two files/fields carry the version and all twenty-two must agree. The seven package manifests", and add one sentence: "packages/codemirror-visimark/package.json joins on its own `version` only: it bundles the engine rather than depending on it, so there is no pin (#360)."; change "bun.lock mirrors all six manifests'" to "all seven".

In `node-support-policy`'s manifest loop add `packages/codemirror-visimark/package.json`.

- [ ] **Step 6: Lint the workflow and commit**

Run: `bun run format:check && bun run lint && bun test` (and `actionlint .github/workflows/ci.yml` if installed).
Expected: clean.

```bash
git add scripts/codemirror-smoke.mjs .github/workflows/ci.yml
git commit -m "ci: pack codemirror-visimark and smoke it at the peer floor and the latest

<trailer>"
```

### Task 10: Release wiring

**Files:**
- Modify: `scripts/prepare-release.ts`
- Modify: `scripts/prepare-release.test.ts`
- Modify: `scripts/verify-release.sh`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: `prepare-release.ts`**

- In `manifests`, after `["packages/visimark-mcp/package.json", true],` add `["packages/codemirror-visimark/package.json", false],`.
- Change the comment above it to "The seven package manifests: own version, and the exact `visimark` pin where there is one (the lsp and the extension use `workspace:*`, which stays; codemirror-visimark bundles the engine and has none)."
- In the file's header comment change "bumps the eight version-carrying files" to "bumps the version-carrying files".

In `scripts/prepare-release.test.ts`, add `"packages/codemirror-visimark/package.json",` to `FILES` after the `visimark-mcp` entry. The existing "bumps every version-carrying file" test then checks the new manifest's `version`; its `dependencies.visimark` loop filters on `/remark|markdownlint|mcp/`, which does not match, as intended. Add `"packages/codemirror-visimark"` to the workspace list in "bumps bun.lock's mirrored version…" (around line 119).

Run: `bun test scripts/prepare-release.test.ts`
Expected: PASS.

- [ ] **Step 2: `verify-release.sh`**

Change the loop to `for pkg in visimark remark-lint-visimark markdownlint-rule-visimark visimark-mcp codemirror-visimark; do`.

- [ ] **Step 3: `release.yml`**

- In the `dry_run` input's description: "for the four packages" → "for the five packages".
- After the "Publish the MCP server to npm" step add:

```yaml
      # codemirror-visimark bundles the engine rather than pinning it, so it
      # does not depend on the engine leg having landed; it follows it only to
      # keep the npm legs in one place (#360).
      - name: Publish the CodeMirror extension to npm
        id: codemirror-extension
        continue-on-error: true
        working-directory: packages/codemirror-visimark
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          DRY_RUN: ${{ inputs.dry_run }}
        run: |
          if [ "$DRY_RUN" = true ]; then
            npm publish --dry-run --access public
          elif npm view "codemirror-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; then
            echo "codemirror-visimark@$ENGINE_VERSION is already on npm; skipping."
          else
            npm publish --provenance --access public
          fi
```

- In "dry run verdict": add `CODEMIRROR_OUTCOME: ${{ steps.codemirror-extension.outcome }}` to `env` and `"npm publish --dry-run (codemirror-visimark)=$CODEMIRROR_OUTCOME" \` after the `visimark-mcp` pair.
- In "every leg must have landed": add the same env line, `"Publish the CodeMirror extension to npm=$CODEMIRROR_OUTCOME" \` after the MCP server pair, an `on_npm_codemirror() { npm view "codemirror-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; }` beside `on_npm_mcp`, and the registry check that calls it, written exactly as the `on_npm_mcp` check is (same retry loop and message shape, package name swapped).

- [ ] **Step 4: Check and commit**

Run: `bun run format:check && bun run lint` (and `actionlint .github/workflows/release.yml` if installed).

```bash
git add scripts/prepare-release.ts scripts/prepare-release.test.ts scripts/verify-release.sh .github/workflows/release.yml
git commit -m "release: publish codemirror-visimark with every tag

<trailer>"
```

### Task 11: Documentation

**Files:** every file in spec §7, plus the catalogue.

- [ ] **Step 1: `docs/design/obsidian-plugin-spec.md`**

- §2.1 layout tree: replace the `snapshot.ts` and `live.ts` lines with `live-preview.ts  host wiring for codemirror-visimark's extension (Live Preview)` and add below the tree: "The analysis, the gate, the decorations and the vault snapshot live in `packages/codemirror-visimark` since #360; the plugin bundles them from source."
- §2.6: add a first paragraph: "Since #360 the snapshot is `packages/codemirror-visimark/src/snapshot.ts`, where any CodeMirror host can use it; the plugin's `VaultRead` is its `ReadImport`." Keep the symlink discussion here (it was cut from the moved file's header in Task 2).
- §5 first row: "The published npm packages (`visimark`, `visimark-mcp`, `remark-lint-visimark`, `markdownlint-rule-visimark`)" | "four packages" | "unchanged by this spec; `codemirror-visimark` joined them in #360. The plugin is not published to npm".

- [ ] **Step 2: `CONTRIBUTING.md`**

- "Building the Obsidian plugin": after the paragraph that names `browser-path.ts`, change its path to `packages/codemirror-visimark/src/browser-path.ts` and add: "The Live Preview marks come from `packages/codemirror-visimark`, which the plugin bundles from source through the same kind of alias as the engine — `esbuild.config.mjs` and `tsconfig.json` both map it."
- "Every version-carrying file must agree": "Eleven fields carry the version — six package manifests" → "Thirteen fields carry the version — seven package manifests"; add "(`codemirror-visimark` carries only its own version: it bundles the engine)".
- In the command table row for `build:playground`, add: "The application bundle is built by `packages/visimark/build-playground.ts`, which also bundles CodeMirror 6 and `codemirror-visimark`."

- [ ] **Step 3: `docs/releasing.md`**

- Line ~109 "the four packages" → "the five packages"; line ~368 "all four npm packages" → "all five npm packages"; line ~405 "the four npm" → "the five npm".
- Line ~229 "all nine version-carrying files" and line ~305 "all eight version-carrying files": both become "all version-carrying files (`bun scripts/prepare-release.ts` edits them all)".
- In "Publishing a new package for the first time", after point 1, add: "`codemirror-visimark` (#360) went through this list: its name was free on 2026-10-11, it pins nothing so point 3 does not apply, and its leg runs after the MCP server's."

- [ ] **Step 4: `.agents/rules/runtime-parity.md`**

"A published package with no `bin` — `remark-visimark`, `markdownlint-visimark`, `visimark-lsp`, the VS Code extension —" → "— `remark-visimark`, `markdownlint-visimark`, `codemirror-visimark`, `visimark-lsp`, the VS Code extension —".

- [ ] **Step 5: `docs/design/playground-pipeline-cost-plan.md`**

Add a dated paragraph at the end: "2026-10 (#360): each pass now ends with `cm.refreshMarks()`, which runs one more reader-less `check` (plus, for the imports chapter, one snapshot-backed `check`) for the editor's marks and diagnostics. `measure()` times it with the rest of the pass, so the adaptive debounce already accounts for it."

- [ ] **Step 6: `README.md`**

After the Obsidian plugin paragraph (the one ending "says what each feature does."), add:

```markdown
The same Live Preview marks are published as
[`codemirror-visimark`](packages/codemirror-visimark/README.md), a CodeMirror 6
extension for any editor built on it, with lint diagnostics in the CLI's words
on a separate `codemirror-visimark/lint` import. The playground uses both.
```

- [ ] **Step 7: `CHANGELOG.md`**

Under `## Unreleased` → `### Added`:

```markdown
- **`codemirror-visimark`, the editor marks as a CodeMirror 6 extension.** A
  new npm package: `visimark()` marks every computed value in a Markdown
  document and flags the ones that disagree with their formulas;
  `codemirror-visimark/lint` adds diagnostics in the CLI's words. The Obsidian
  plugin now uses it for Live Preview, with no visible change.
  ([#360](https://github.com/michal-niedzwiedzki/visimark/issues/360))
```

and add a `### Changed` heading (if absent) with:

```markdown
- **The Playground editor is CodeMirror 6.** It now marks computed values,
  underlines values that disagree with their formulas, shows findings as
  diagnostics, and has its own search on Ctrl/Cmd+F. CodeMirror is bundled
  instead of loaded from a CDN.
  ([#360](https://github.com/michal-niedzwiedzki/visimark/issues/360))
```

- [ ] **Step 8: The catalogue row moves to the Shipped register**

In `docs/vocabulary-catalogue.md`, delete the "Published CodeMirror 6 extension (`codemirror-visimark`)" row from section F and add to the Shipped register table, in its columns: `Name` = "Published CodeMirror 6 extension (`codemirror-visimark`)", `Kind` = the value the register uses for section-F rows (copy from a neighbouring F row there), `Request` = `[#360](https://github.com/michal-niedzwiedzki/visimark/issues/360)`, `Landed` = the top layer PR's link, `Released` = `—`, `Decision` = `[APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/360#issuecomment-6113324260)`. Status `UNRELEASED` as the register writes it.

- [ ] **Step 9: Check and commit**

Run: `bun run format:check && bun run lint && bun run typecheck && bun test && bun run build && for f in docs/example-*.md; do bun packages/visimark/src/cli/main.ts check "$f" >/dev/null || echo "FAIL $f"; done` — the only expected failure is `docs/example-invoice-drift.md`, which must fail.

```bash
git add -A docs CONTRIBUTING.md README.md CHANGELOG.md .agents/rules/runtime-parity.md
git commit -m "docs: codemirror-visimark across the release, contributing and design docs

<trailer>"
git push -u origin HEAD
gh stack submit
```

Then wait for CI on every layer (`gh pr checks <n> --watch` for each), fix and push until green, and promote the stack bottom-up.

<!--vmark:no-formulas-->
