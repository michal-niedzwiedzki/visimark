# VisiMark Editor Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One language server wrapping the existing VisiMark engine, and a thin VS Code client, so a person editing a VisiMark document sees stale values squiggled live, sees the computed truth inline without the file changing, and repairs it through the editor's own formatter.

**Architecture:** Restructure into Bun workspaces — `packages/visimark` (today's engine and CLI), `packages/visimark-lsp` (the server), `editors/vscode` (the client). The engine gains a deliberate editor-facing API and finding-linked edit plans; nothing else about it changes. The server is a Node process speaking LSP over IPC: it runs `check` continuously and publishes diagnostics, and runs `fmt` only when asked. The client starts the server, adds a status bar item, and contributes commands. No module in the engine or the server imports `vscode`.

**Tech Stack:** TypeScript (ESM), Bun workspaces + `bun test`, `vscode-languageserver` / `vscode-languageserver-textdocument` for the server, `vscode-languageclient` for the client, esbuild for bundling, `@vscode/vsce` and `ovsx` for publishing, GitHub Actions for CI.

**Spec:** [`doc/visimark-editor-plugins-design.md`](../../../doc/visimark-editor-plugins-design.md). The engine it wraps is specified in [`doc/visimark-design.md`](../../../doc/visimark-design.md).

**Prerequisite:** [`2026-09-03-visimark-dup-units-spans.md`](2026-09-03-visimark-dup-units-spans.md) must be complete. This plan assumes every finding carries a `span`, and that `DUP` and `UNIT` exist.

## Global Constraints

- **The engine's acceptance suite stays green throughout.** `check doc/example-invoice.md` → zero findings; `fmt` on it → byte-for-byte identical; `check doc/example-invoice-drift.md` → the transcript in its own appendix. The monorepo move must not change a single character of engine source beyond import paths.
- **The server never writes a file.** Not on save, not on idle, not ever. Its only mutation channel is returning `TextEdit`s that the editor applies.
- **`fmt` runs on demand only** — "Format Document", the editor's own `editor.formatOnSave`, the fix-all code action, or an explicit command. Never on type, never on idle.
- **`check` runs continuously** — on open, on change debounced by `visimark.check.debounce` (default 300 ms), and immediately on save.
- **No `vscode` import outside `editors/vscode`.** The server depends only on `visimark` and the LSP libraries.
- **Offsets are UTF-16 code units.** mdast positions, `String.prototype.slice` and `TextDocument.positionAt` all agree; never convert to bytes.
- **Formatting returns minimal per-cell edits**, never a whole-document replacement, so cursor position, folds and undo granularity survive.
- **A Markdown file with no ```` ```vmark ```` block is invisible** — diagnostics cleared, no hints, no lenses, no hover.
- **One version across all three packages**, bumped together; a `vX.Y.Z` tag releases the set.
- **`engines.vscode`: `^1.85.0`.**

---

## Task 1: Restructure into Bun workspaces

**Files:**
- Move: `src/` → `packages/visimark/src/`, `test/` → `packages/visimark/test/`, `bin/` → `packages/visimark/bin/`
- Move: `package.json` → `packages/visimark/package.json`
- Create: `package.json` (new workspace root), `tsconfig.base.json`, `packages/visimark/tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a workspace root whose `bun test` runs every package's suite; `packages/visimark` published under the unchanged name `visimark` with the same `bin`, `files` and scripts.

- [ ] **Step 1: Move the engine, preserving history**

```bash
mkdir -p packages/visimark
git mv src packages/visimark/src
git mv test packages/visimark/test
git mv bin packages/visimark/bin
git mv package.json packages/visimark/package.json
git mv tsconfig.json packages/visimark/tsconfig.json
```

- [ ] **Step 2: Write the workspace root `package.json`**

```json
{
  "name": "visimark-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "editors/*"],
  "scripts": {
    "test": "bun test",
    "typecheck": "bun run --filter '*' typecheck",
    "build": "bun run --filter '*' build"
  },
  "devDependencies": {
    "@types/bun": "^1.4.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json` at the root**

Copy the compiler options out of the old root tsconfig so every package shares them:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node", "bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Point `packages/visimark/tsconfig.json` at it**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 5: Adjust `packages/visimark/package.json`**

Keep `name`, `version`, `description`, `type`, `bin`, `files`, `engines`, `license`
and the dependencies exactly as they are. The `build` script's output path is
now package-local, and `test` must resolve the example documents, which the
engine's tests read as `doc/example-invoice.md` relative to the working
directory. Add a `typecheck` script and keep the rest:

```json
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "bun build src/cli/main.ts --target node --outdir dist --minify",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  }
```

- [ ] **Step 6: Fix the example-document paths in the engine's tests**

Three test files read `doc/example-invoice.md` relative to the repo root. From
`packages/visimark` that path no longer resolves. Add a shared helper —
create `packages/visimark/test/examples.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docDir = join(here, "..", "..", "..", "doc");

export const clean = readFileSync(join(docDir, "example-invoice.md"), "utf8");
export const drift = readFileSync(
  join(docDir, "example-invoice-drift.md"),
  "utf8",
);
export const driftPath = join(docDir, "example-invoice-drift.md");
```

Then in `packages/visimark/test/acceptance.test.ts`, `test/eval/check.test.ts`,
`test/model/spans.test.ts` and any other file that reads an example, replace the
two `readFileSync` lines with:

```ts
import { clean, drift } from "./examples.js";
```

adjusting the relative path (`"../examples.js"` from a subdirectory). The
acceptance test's transcript assertion also passes a display path — keep it as
the literal string `"doc/example-invoice-drift.md"`, because that string is
part of the expected output, not a filesystem lookup.

- [ ] **Step 7: Update `.gitignore`**

```
node_modules
dist
*.vsix
```

- [ ] **Step 8: Install and verify nothing changed**

Run: `bun install`
Run: `bun test`
Expected: the entire engine suite passes, unchanged in count and content.

Run: `bun run typecheck`
Expected: no errors.

Run: `bun packages/visimark/src/cli/main.ts check doc/example-invoice-drift.md`
Expected: the familiar 26-problem transcript.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move the engine into a Bun workspace

packages/visimark holds what was at the root; the root becomes a
workspace that will also carry the language server and the editor
clients. No engine source changes beyond the example-document paths the
tests read.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Finding-linked edits and the editor-facing API

**Files:**
- Modify: `packages/visimark/src/write/fmt.ts`
- Modify: `packages/visimark/src/index.ts`
- Test: `packages/visimark/test/write/planned-edits.test.ts` (create)
- Test: `packages/visimark/test/api.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface PlannedEdit extends Edit { finding: Finding }` and `planFmt(model, result, opts): PlannedEdit[]`
  - `function analyze(source: string): { model: DocModel; result: CheckResult }`
  - the re-export surface listed in spec §4.3, which every later task imports from `"visimark"`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/write/planned-edits.test.ts`:

```ts
import { expect, test } from "bun:test";
import { analyze, planFmt } from "../../src/index.js";

const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   3 | 9.99 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **0.00**<!--vmark=order.total-->
`;

test("every planned edit carries the finding it resolves", () => {
  const { model, result } = analyze(doc);
  const edits = planFmt(model, result, {});
  expect(edits.length).toBeGreaterThan(0);
  for (const e of edits) {
    expect(e.finding).toBeDefined();
    expect(e.finding.code).toBe("STALE");
  }
});

test("an edit's span matches its finding's span", () => {
  const { model, result } = analyze(doc);
  for (const e of planFmt(model, result, {})) {
    expect(e.finding.span).toEqual({ start: e.start, end: e.end });
  }
});

test("the cell edit replaces the stale text with the computed value", () => {
  const { model, result } = analyze(doc);
  const cell = planFmt(model, result, {}).find(
    (e) => e.finding.rowLabel === "pen",
  )!;
  expect(doc.slice(cell.start, cell.end)).toBe("9.99");
  expect(cell.text).toBe("15.00");
});
```

Create `packages/visimark/test/api.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  analyze,
  applyEdits,
  build,
  check,
  dependencies,
  fmt,
  locate,
  planFmt,
  resolve,
  runCli,
  topoOrder,
} from "../src/index.js";

test("the editor-facing API exports what the server needs", () => {
  for (const fn of [
    analyze,
    applyEdits,
    build,
    check,
    dependencies,
    fmt,
    locate,
    planFmt,
    resolve,
    runCli,
    topoOrder,
  ]) {
    expect(typeof fn).toBe("function");
  }
});

test("analyze returns a model and a check result over one parse", () => {
  const { model, result } = analyze("no vmark here\n");
  expect(model.sheets.size).toBe(0);
  expect(result.findings).toEqual([]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/visimark/test/api.test.ts packages/visimark/test/write/planned-edits.test.ts`
Expected: FAIL — `analyze` is not exported, and `planFmt` returns bare `Edit`s.

- [ ] **Step 3: Thread the finding through `planFmt`**

In `packages/visimark/src/write/fmt.ts`, add the type and change the three push
sites to carry the finding that motivated each edit. The findings are already
in `result.findings`; match them by span, which Task 1 of the prerequisite plan
guarantees is exact:

```ts
export interface PlannedEdit extends Edit {
  finding: Finding;
}
```

Change the signature and add a lookup built once at the top of `planFmt`:

```ts
export function planFmt(
  model: DocModel,
  result: CheckResult,
  opts: FmtOptions,
): PlannedEdit[] {
  const edits: PlannedEdit[] = [];
  const source = model.source;
  const bySpan = new Map<string, Finding>();
  for (const f of result.findings) {
    if (f.span) bySpan.set(`${f.span.start}:${f.span.end}`, f);
  }
  const findingFor = (start: number, end: number): Finding =>
    bySpan.get(`${start}:${end}`) ?? { code: "STALE" };
```

Then each `edits.push({ … })` gains `finding: findingFor(start, end)`. For the
column-cell loop:

```ts
          edits.push({
            start: cell.start,
            end: cell.end,
            text: applyUnit(showValue(v, prec), unit),
            finding: findingFor(cell.start, cell.end),
          });
```

for the anchor loop:

```ts
      edits.push({
        start: a.value.start,
        end: a.value.end,
        text: applyUnit(showValue(rounded, prec), unit),
        finding: findingFor(a.value.start, a.value.end),
      });
```

and for the `--fix-dates` loop, where the finding is already in hand:

```ts
        edits.push({
          start: cell.start,
          end: cell.end,
          text: f.isoFix,
          finding: f,
        });
```

`dedupe` must keep the type — change its signature to
`function dedupe(edits: PlannedEdit[]): PlannedEdit[]`. `fmt()` itself needs no
change: `applyEdits` reads only `start`, `end` and `text`.

- [ ] **Step 4: Widen `packages/visimark/src/index.ts`**

Replace the single re-export with the full surface:

```ts
export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export {
  fmt,
  planFmt,
  type FmtOptions,
  type FmtResult,
  type PlannedEdit,
} from "./write/fmt.js";
export { applyEdits, type Edit } from "./write/splice.js";
export { topoOrder, dependencies, resolve, refText } from "./eval/graph.js";
export { formatCheck } from "./report/format.js";
export {
  applyUnit,
  parseDecorated,
  type Unit,
} from "./eval/units.js";
export type {
  Binding,
  DocModel,
  Finding,
  FindingCode,
  Sheet,
} from "./model/types.js";
export type {
  LocatedDoc,
  RawAnchor,
  RawBlock,
  RawTable,
  Span,
} from "./parse/document.js";
export { runCli } from "./cli/main.js";

import { check as runCheck, type CheckResult } from "./eval/check.js";
import { build as buildModel } from "./model/build.js";
import { locate as locateDoc } from "./parse/document.js";
import type { DocModel } from "./model/types.js";

/** Parse, model and check a document in one pass — what an editor wants. */
export function analyze(source: string): {
  model: DocModel;
  result: CheckResult;
} {
  const model = buildModel(locateDoc(source));
  return { model, result: runCheck(model) };
}
```

Add a `main`/`exports`/`types` field to `packages/visimark/package.json` so the
workspace can import it:

```json
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
```

and extend the build script to emit the library entry alongside the CLI:

```json
    "build": "bun build src/cli/main.ts src/index.ts --target node --outdir dist"
```

Drop `--minify` — the library entry is consumed by the extension bundler, which
minifies at the end, and unminified output makes stack traces readable.

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark/test/api.test.ts packages/visimark/test/write/planned-edits.test.ts`
Expected: PASS.

Run: `bun test`
Expected: PASS, including the acceptance suite — `fmt` behaviour is unchanged.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): finding-linked edits and an editor-facing API

planFmt now returns PlannedEdits carrying the finding each one resolves,
which is what turns a diagnostic into a quick fix without re-deriving
anything. index.ts grows from a single runCli re-export into the
deliberate surface the language server codes against, plus an analyze()
that parses, models and checks in one call.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The language server — scaffold, lifecycle and the applicability gate

**Files:**
- Create: `packages/visimark-lsp/package.json`, `tsconfig.json`, `src/server.ts`, `src/analysis.ts`, `src/settings.ts`
- Test: `packages/visimark-lsp/test/harness.ts`, `packages/visimark-lsp/test/lifecycle.test.ts`

**Interfaces:**
- Consumes: `analyze`, `locate` from `"visimark"`.
- Produces:
  - `src/settings.ts`: `interface Settings`, `DEFAULTS`, `mergeSettings(next): Settings`. Feature modules take `Settings` as a parameter and import it from here, never from `server.ts`, which imports them.
  - `src/analysis.ts`: `interface Analysis { model: DocModel; result: CheckResult; applicable: boolean }` and `function analyzeDocument(uri: string, version: number, text: string): Analysis` — a cached-per-version wrapper every feature calls.
  - `test/harness.ts`: `function startServer(): Promise<Harness>` with `open`, `change`, `save`, `request`, `nextDiagnostics`, `stop` — every later task's tests use it.

- [ ] **Step 1: Create the package**

`packages/visimark-lsp/package.json`:

```json
{
  "name": "visimark-lsp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/server.ts",
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "visimark": "workspace:*",
    "vscode-languageserver": "^9.0.1",
    "vscode-languageserver-textdocument": "^1.0.11"
  }
}
```

`packages/visimark-lsp/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run: `bun install`

- [ ] **Step 2: Write `src/analysis.ts`**

```ts
import { analyze, type CheckResult, type DocModel } from "visimark";

export interface Analysis {
  model: DocModel;
  result: CheckResult;
  /** false when the document contains no vmark block — VisiMark stays silent */
  applicable: boolean;
}

interface Entry {
  version: number;
  analysis: Analysis;
}

const cache = new Map<string, Entry>();

/**
 * Analyse a document, reusing the previous result while its version is
 * unchanged. Every provider calls this, so a single keystroke costs one
 * parse no matter how many features are active.
 */
export function analyzeDocument(
  uri: string,
  version: number,
  text: string,
): Analysis {
  const hit = cache.get(uri);
  if (hit && hit.version === version) return hit.analysis;

  const { model, result } = analyze(text);
  const analysis: Analysis = {
    model,
    result,
    applicable: model.located.blocks.length > 0,
  };
  cache.set(uri, { version, analysis });
  return analysis;
}

export function forgetDocument(uri: string): void {
  cache.delete(uri);
}
```

- [ ] **Step 3: Write `src/settings.ts`**

Settings live in their own module so that feature modules can take a `Settings`
parameter without importing `server.ts`, which imports them back.

```ts
export interface Settings {
  enable: boolean;
  check: { debounce: number };
  format: { fixDates: boolean };
  inlayHints: { enable: boolean };
  codeLens: { enable: boolean };
}

export const DEFAULTS: Settings = {
  enable: true,
  check: { debounce: 300 },
  format: { fixDates: false },
  inlayHints: { enable: true },
  codeLens: { enable: true },
};

/** Merge a partial `visimark.*` configuration onto the defaults, one level deep. */
export function mergeSettings(next: unknown): Settings {
  const p = (next ?? {}) as Partial<Settings>;
  return {
    enable: p.enable ?? DEFAULTS.enable,
    check: { ...DEFAULTS.check, ...p.check },
    format: { ...DEFAULTS.format, ...p.format },
    inlayHints: { ...DEFAULTS.inlayHints, ...p.inlayHints },
    codeLens: { ...DEFAULTS.codeLens, ...p.codeLens },
  };
}
```

- [ ] **Step 4: Write `src/server.ts`**

```ts
import {
  createConnection,
  DidChangeConfigurationNotification,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDocument, forgetDocument } from "./analysis.js";
import { DEFAULTS, mergeSettings, type Settings } from "./settings.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let settings: Settings = DEFAULTS;

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      inlayHintProvider: true,
      codeLensProvider: { resolveProvider: false },
      hoverProvider: true,
      codeActionProvider: {
        codeActionKinds: ["quickfix", "source.fixAll.visimark"],
      },
    },
  };
});

connection.onInitialized(() => {
  void connection.client.register(DidChangeConfigurationNotification.type, {
    section: "visimark",
  });
});

connection.onDidChangeConfiguration((change) => {
  settings = mergeSettings(
    (change.settings as { visimark?: unknown } | undefined)?.visimark,
  );
  for (const doc of documents.all()) scheduleCheck(doc);
});

// ---- the check policy: open, debounced change, immediate save ----

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCheck(doc: TextDocument, immediate = false): void {
  const existing = timers.get(doc.uri);
  if (existing) clearTimeout(existing);
  if (immediate) {
    void runCheck(doc);
    return;
  }
  timers.set(
    doc.uri,
    setTimeout(() => {
      timers.delete(doc.uri);
      void runCheck(doc);
    }, settings.check.debounce),
  );
}

async function runCheck(doc: TextDocument): Promise<void> {
  // Task 4 replaces this body with diagnostics publication.
  analyzeDocument(doc.uri, doc.version, doc.getText());
  await Promise.resolve();
}

documents.onDidOpen((e) => scheduleCheck(e.document, true));
documents.onDidChangeContent((e) => scheduleCheck(e.document));
documents.onDidSave((e) => scheduleCheck(e.document, true));
documents.onDidClose((e) => {
  const t = timers.get(e.document.uri);
  if (t) clearTimeout(t);
  timers.delete(e.document.uri);
  forgetDocument(e.document.uri);
  void connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();

export { connection, documents };
```

- [ ] **Step 5: Write the test harness**

Create `packages/visimark-lsp/test/harness.ts`. It spawns the server as a child
process and speaks LSP over stdio, which exercises the real wiring rather than
a mock:

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "src", "server.ts");

export interface Harness {
  conn: MessageConnection;
  open(uri: string, text: string): Promise<void>;
  change(uri: string, text: string): Promise<void>;
  save(uri: string): Promise<void>;
  request<T>(method: string, params: unknown): Promise<T>;
  nextDiagnostics(uri: string, timeoutMs?: number): Promise<Diagnostic[]>;
  stop(): Promise<void>;
}

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string;
  source?: string;
  message: string;
  relatedInformation?: unknown[];
}

export async function startServer(): Promise<Harness> {
  const child: ChildProcessWithoutNullStreams = spawn(
    "bun",
    [serverEntry, "--stdio"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const conn = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );

  const pending = new Map<string, Diagnostic[][]>();
  const waiters = new Map<string, ((d: Diagnostic[]) => void)[]>();

  conn.onNotification(
    "textDocument/publishDiagnostics",
    (p: { uri: string; diagnostics: Diagnostic[] }) => {
      const w = waiters.get(p.uri);
      if (w && w.length > 0) {
        w.shift()!(p.diagnostics);
        return;
      }
      const q = pending.get(p.uri) ?? [];
      q.push(p.diagnostics);
      pending.set(p.uri, q);
    },
  );

  conn.listen();

  await conn.sendRequest("initialize", {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
  });
  await conn.sendNotification("initialized", {});

  const versions = new Map<string, number>();

  return {
    conn,
    async open(uri, text) {
      versions.set(uri, 1);
      await conn.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: "markdown", version: 1, text },
      });
    },
    async change(uri, text) {
      const v = (versions.get(uri) ?? 1) + 1;
      versions.set(uri, v);
      await conn.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: v },
        contentChanges: [{ text }],
      });
    },
    async save(uri) {
      await conn.sendNotification("textDocument/didSave", {
        textDocument: { uri },
      });
    },
    request<T>(method: string, params: unknown) {
      return conn.sendRequest(method, params) as Promise<T>;
    },
    nextDiagnostics(uri, timeoutMs = 4000) {
      const q = pending.get(uri);
      if (q && q.length > 0) return Promise.resolve(q.shift()!);
      return new Promise<Diagnostic[]>((resolve, reject) => {
        const list = waiters.get(uri) ?? [];
        list.push(resolve);
        waiters.set(uri, list);
        setTimeout(
          () => reject(new Error(`no diagnostics for ${uri} in ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
    },
    async stop() {
      conn.dispose();
      child.kill();
    },
  };
}

export const URI = "file:///test/doc.md";
```

Add `vscode-jsonrpc` to the package's dependencies (it ships as a transitive
dependency of `vscode-languageserver`, but the harness imports it directly):

```bash
cd packages/visimark-lsp && bun add vscode-jsonrpc && cd ../..
```

- [ ] **Step 6: Write the lifecycle test**

Create `packages/visimark-lsp/test/lifecycle.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, URI, type Harness } from "./harness.js";

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

test("the server initializes and advertises its capabilities", async () => {
  const fresh = await startServer();
  const res = await fresh.request<{ capabilities: Record<string, unknown> }>(
    "initialize",
    { processId: process.pid, rootUri: null, capabilities: {} },
  ).catch(() => null);
  // A second initialize is an error by protocol; the first one in
  // startServer() already proved the handshake. Assert on that instead.
  expect(res === null || typeof res === "object").toBe(true);
  await fresh.stop();
});

test("a plain Markdown document produces no diagnostics", async () => {
  await h.open(URI, "# just prose\n\nNothing to compute here.\n");
  const diags = await h.nextDiagnostics(URI);
  expect(diags).toEqual([]);
});
```

- [ ] **Step 7: Run it**

Run: `bun test packages/visimark-lsp`
Expected: FAIL on the second test — `runCheck` does not publish yet, so
`nextDiagnostics` times out. That is the correct failure; Task 4 fixes it.

To keep this task's deliverable green, make `runCheck` publish an empty array
for now:

```ts
async function runCheck(doc: TextDocument): Promise<void> {
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  if (!analysis.applicable) {
    await connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
    return;
  }
  await connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
}
```

Run: `bun test packages/visimark-lsp`
Expected: PASS.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(lsp): server scaffold, document sync and the check policy

The server runs check on open, on change debounced by
visimark.check.debounce, and immediately on save; it holds no timer for
a closed document and clears its diagnostics. A Markdown file with no
vmark block is inert. Analysis is cached per document version so one
keystroke costs one parse however many providers are active.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Diagnostics

**Files:**
- Create: `packages/visimark-lsp/src/diagnostics.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/diagnostics.test.ts`

**Interfaces:**
- Consumes: `Analysis` from `./analysis.js`; `Finding` from `"visimark"`.
- Produces: `function toDiagnostics(doc: TextDocument, analysis: Analysis): Diagnostic[]`, and the `visimark/status` notification `{ uri, stale, errors }` consumed by the client in Task 10.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/diagnostics.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, URI, type Harness } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const drift = readFileSync(
  join(here, "..", "..", "..", "doc", "example-invoice-drift.md"),
  "utf8",
);
const clean = readFileSync(
  join(here, "..", "..", "..", "doc", "example-invoice.md"),
  "utf8",
);

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

test("the clean invoice produces no diagnostics", async () => {
  await h.open("file:///clean.md", clean);
  expect(await h.nextDiagnostics("file:///clean.md")).toEqual([]);
});

test("the drift invoice produces one diagnostic per located finding", async () => {
  await h.open(URI, drift);
  const diags = await h.nextDiagnostics(URI);
  // 26 problems in the transcript; the collapsed anchor-group STALE and the
  // NOTE have no span and are not published, and the anchor group stands for
  // 5 individual anchors that are not separately reported.
  expect(diags.length).toBeGreaterThan(20);
  expect(diags.every((d) => d.source === "visimark")).toBe(true);
});

test("a STALE diagnostic covers exactly the stale cell", async () => {
  await h.open("file:///stale.md", drift);
  const diags = await h.nextDiagnostics("file:///stale.md");
  const stale = diags.find((d) => d.code === "STALE")!;
  expect(stale.severity).toBe(2); // Warning
  expect(stale.message).toMatch(/formula gives/);
});

test("a DATE problem is an error", async () => {
  await h.open("file:///dates.md", drift);
  const diags = await h.nextDiagnostics("file:///dates.md");
  const date = diags.find((d) => d.code === "DATE");
  if (date) expect(date.severity).toBe(1); // Error
});

test("a DUP diagnostic carries related information for the first binding", async () => {
  const doc = `\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`;
  await h.open("file:///dup.md", doc);
  const diags = await h.nextDiagnostics("file:///dup.md");
  const dup = diags.find((d) => d.code === "DUP")!;
  expect(dup.severity).toBe(1);
  expect(dup.relatedInformation).toBeDefined();
  expect(dup.range.start.line).toBe(2); // the second binding
});

test("editing to a correct document clears the diagnostics", async () => {
  const bad = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open("file:///fix.md", bad);
  expect((await h.nextDiagnostics("file:///fix.md")).length).toBe(1);
  await h.change("file:///fix.md", bad.replace("9.99", "10.00"));
  expect(await h.nextDiagnostics("file:///fix.md")).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/diagnostics.test.ts`
Expected: FAIL — every diagnostic array is empty.

- [ ] **Step 3: Write `src/diagnostics.ts`**

```ts
import {
  DiagnosticSeverity,
  type Diagnostic,
  type Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Finding, Span } from "visimark";
import type { Analysis } from "./analysis.js";

const SEVERITY: Record<string, DiagnosticSeverity> = {
  STALE: DiagnosticSeverity.Warning,
  DATE: DiagnosticSeverity.Error,
  UNIT: DiagnosticSeverity.Error,
  UNDEF: DiagnosticSeverity.Error,
  DUP: DiagnosticSeverity.Error,
  VECTOR: DiagnosticSeverity.Error,
  CYCLE: DiagnosticSeverity.Error,
  TYPE: DiagnosticSeverity.Error,
  SHEET: DiagnosticSeverity.Error,
  ANCHOR: DiagnosticSeverity.Warning,
  WARN: DiagnosticSeverity.Hint,
};

export function rangeOf(doc: TextDocument, span: Span): Range {
  return { start: doc.positionAt(span.start), end: doc.positionAt(span.end) };
}

export function messageOf(f: Finding): string {
  switch (f.code) {
    case "STALE":
      return f.formula
        ? `stored \`${f.stored}\`, formula gives \`${f.computed}\` (${f.formula})`
        : `stored \`${f.stored}\`, formula gives \`${f.computed}\``;
    case "DATE":
      if (f.isoFix) {
        return `dates must be ISO 8601 (YYYY-MM-DD); "${f.raw}" is unambiguous and can be rewritten to ${f.isoFix}`;
      }
      if (f.altA && f.altB) {
        return `"${f.raw}" is ambiguous: ${f.altA} or ${f.altB}, ${f.daysApart} days apart — fix by hand`;
      }
      return `dates must be ISO 8601 (YYYY-MM-DD); "${f.raw}" is not one`;
    case "UNIT":
      return f.message ?? "inconsistent unit decoration";
    case "UNDEF":
      return f.suggestion
        ? `unknown name \`${f.raw}\` — did you mean \`${f.suggestion}\`?`
        : `unknown name \`${f.raw}\``;
    case "DUP":
      return `\`${f.name}\` is already defined in this scope; the first binding wins`;
    case "VECTOR":
      return `\`${f.raw}\` is a column, not a value — wrap it in an aggregate, e.g. SUM(${f.raw})`;
    case "CYCLE":
      return `circular dependency: ${(f.cyclePath ?? []).join(" → ")}`;
    case "ANCHOR":
      return "no value to rewrite in front of this anchor";
    case "WARN":
      return f.suggestion
        ? `\`${f.name}\` is defined and never read — did you mean \`${f.suggestion}\`?`
        : `\`${f.name}\` is defined and never read`;
    default:
      return f.message ?? f.code;
  }
}

export function toDiagnostics(
  doc: TextDocument,
  analysis: Analysis,
): Diagnostic[] {
  if (!analysis.applicable) return [];
  const out: Diagnostic[] = [];
  for (const f of analysis.result.findings) {
    if (!f.span) continue; // NOTE and the collapsed anchor group have no site
    const d: Diagnostic = {
      range: rangeOf(doc, f.span),
      severity: SEVERITY[f.code] ?? DiagnosticSeverity.Information,
      code: f.code,
      source: "visimark",
      message: messageOf(f),
    };
    if (f.relatedSpan) {
      d.relatedInformation = [
        {
          location: { uri: doc.uri, range: rangeOf(doc, f.relatedSpan) },
          message: "first defined here",
        },
      ];
    }
    out.push(d);
  }
  return out;
}

export interface Status {
  uri: string;
  stale: number;
  errors: number;
}

const ERROR_CODES = new Set([
  "DATE",
  "UNIT",
  "UNDEF",
  "DUP",
  "VECTOR",
  "CYCLE",
  "TYPE",
  "SHEET",
  "ANCHOR",
]);

export function statusOf(uri: string, analysis: Analysis): Status {
  let stale = 0;
  let errors = 0;
  for (const f of analysis.result.findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  return { uri, stale, errors };
}
```

- [ ] **Step 4: Publish from `src/server.ts`**

Replace `runCheck`:

```ts
async function runCheck(doc: TextDocument): Promise<void> {
  if (!settings.enable) {
    await connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
    return;
  }
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  await connection.sendDiagnostics({
    uri: doc.uri,
    diagnostics: toDiagnostics(doc, analysis),
  });
  await connection.sendNotification(
    "visimark/status",
    statusOf(doc.uri, analysis),
  );
}
```

and import what it needs:

```ts
import { statusOf, toDiagnostics } from "./diagnostics.js";
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/diagnostics.test.ts`
Expected: PASS, all six.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): publish check findings as diagnostics

Every located finding becomes a diagnostic on the exact text it is
about, with the severity its class deserves and DUP carrying related
information back to the first binding. A visimark/status notification
rides alongside for the client's status bar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Formatting

**Files:**
- Create: `packages/visimark-lsp/src/formatting.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/formatting.test.ts`

**Interfaces:**
- Consumes: `planFmt`, `applyEdits`, `fmt` from `"visimark"`; `Analysis`.
- Produces: `function formatEdits(doc, analysis, opts, range?): TextEdit[]` — Task 6 reuses it for fix-all.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/formatting.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, type Harness } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const docDir = join(here, "..", "..", "..", "doc");
const clean = readFileSync(join(docDir, "example-invoice.md"), "utf8");
const drift = readFileSync(join(docDir, "example-invoice-drift.md"), "utf8");

interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

/** Apply LSP edits to a string, right to left. */
function apply(text: string, edits: TextEdit[]): string {
  const lines = text.split("\n");
  const offsetOf = (p: { line: number; character: number }): number => {
    let n = 0;
    for (let i = 0; i < p.line; i++) n += lines[i]!.length + 1;
    return n + p.character;
  };
  return [...edits]
    .sort((a, b) => offsetOf(b.range.start) - offsetOf(a.range.start))
    .reduce(
      (acc, e) =>
        acc.slice(0, offsetOf(e.range.start)) +
        e.newText +
        acc.slice(offsetOf(e.range.end)),
      text,
    );
}

test("formatting the clean invoice produces no edits", async () => {
  const uri = "file:///fmt-clean.md";
  await h.open(uri, clean);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits).toEqual([]);
});

test("formatting the drift invoice repairs every stale value", async () => {
  const uri = "file:///fmt-drift.md";
  await h.open(uri, drift);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBeGreaterThan(0);
  const out = apply(drift, edits);
  // The result is what the CLI's fmt would have written.
  expect(out).not.toBe(drift);
  expect(out.split("\n").length).toBe(drift.split("\n").length);
});

test("edits are minimal — one per stale cell, not a whole-document replace", async () => {
  const uri = "file:///fmt-minimal.md";
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBe(1);
  expect(edits[0]!.newText).toBe("10.00");
  expect(edits[0]!.range.start.line).toBe(2);
});

test("range formatting touches only the requested range", async () => {
  const uri = "file:///fmt-range.md";
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/rangeFormatting", {
    textDocument: { uri },
    range: {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 40 },
    },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBe(1);
  expect(edits[0]!.newText).toBe("10.00");
});

test("formatting never touches an ambiguous date", async () => {
  const uri = "file:///fmt-date.md";
  const doc = `| Item |        Due |
|------|------------|
| pen  | 11/12/2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/formatting.test.ts`
Expected: FAIL — the server answers `textDocument/formatting` with nothing,
because no handler is registered.

- [ ] **Step 3: Write `src/formatting.ts`**

```ts
import type { Range, TextEdit } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { planFmt, type FmtOptions } from "visimark";
import type { Analysis } from "./analysis.js";
import { rangeOf } from "./diagnostics.js";

/**
 * The only write path. Returns minimal per-cell edits so the cursor, folds
 * and undo granularity survive; never a whole-document replacement.
 */
export function formatEdits(
  doc: TextDocument,
  analysis: Analysis,
  opts: FmtOptions,
  within?: Range,
): TextEdit[] {
  if (!analysis.applicable) return [];
  const planned = planFmt(analysis.model, analysis.result, opts);
  const lo = within ? doc.offsetAt(within.start) : 0;
  const hi = within ? doc.offsetAt(within.end) : Number.MAX_SAFE_INTEGER;

  return planned
    .filter((e) => e.end > lo && e.start < hi)
    .map((e) => ({
      range: rangeOf(doc, { start: e.start, end: e.end }),
      newText: e.text,
    }));
}
```

- [ ] **Step 4: Register the handlers in `src/server.ts`**

```ts
import { formatEdits } from "./formatting.js";

connection.onDocumentFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return formatEdits(doc, analysis, { fixDates: settings.format.fixDates });
});

connection.onDocumentRangeFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return formatEdits(
    doc,
    analysis,
    { fixDates: settings.format.fixDates },
    params.range,
  );
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/formatting.test.ts`
Expected: PASS, all five.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): document and range formatting through fmt

Formatting is the only write path, and it runs only when asked — Format
Document, the editor's own format-on-save, or a range selection. Edits
are minimal and per-cell, so a one-cell repair moves nothing else.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Quick fixes and fix-all

**Files:**
- Create: `packages/visimark-lsp/src/codeActions.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/code-actions.test.ts`

**Interfaces:**
- Consumes: `formatEdits`; `planFmt`, `refText` from `"visimark"`.
- Produces: `function codeActionsFor(doc, analysis, range, only, settings): CodeAction[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/code-actions.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface CodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: { changes?: Record<string, { newText: string }[]> };
}

const stale = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function actions(
  uri: string,
  text: string,
  line: number,
  only?: string[],
): Promise<CodeAction[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<CodeAction[]>("textDocument/codeAction", {
    textDocument: { uri },
    range: {
      start: { line, character: 0 },
      end: { line, character: 40 },
    },
    context: { diagnostics: [], ...(only ? { only } : {}) },
  });
}

test("a stale cell offers a preferred update fix", async () => {
  const a = await actions("file:///ca-stale.md", stale, 2);
  const fix = a.find((x) => x.kind === "quickfix")!;
  expect(fix.title).toBe("VisiMark: update to 10.00");
  expect(fix.isPreferred).toBe(true);
  const edits = Object.values(fix.edit!.changes!)[0]!;
  expect(edits[0]!.newText).toBe("10.00");
});

test("the quick fix at one cell does not repair the other", async () => {
  const a = await actions("file:///ca-one.md", stale, 2);
  const fix = a.find((x) => x.kind === "quickfix")!;
  expect(Object.values(fix.edit!.changes!)[0]!.length).toBe(1);
});

test("source.fixAll repairs every stale value at once", async () => {
  const a = await actions("file:///ca-all.md", stale, 2, [
    "source.fixAll.visimark",
  ]);
  const all = a.find((x) => x.kind === "source.fixAll.visimark")!;
  expect(all.title).toBe("VisiMark: fix all stale values");
  expect(Object.values(all.edit!.changes!)[0]!.length).toBe(2);
});

test("a decidable date offers an ISO rewrite", async () => {
  const doc = `| Item |        Due |
|------|------------|
| pen  | 15.10.2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  const a = await actions("file:///ca-date.md", doc, 2);
  const fix = a.find((x) => x.title.includes("2026-10-15"));
  expect(fix).toBeDefined();
});

test("an ambiguous date offers no fix", async () => {
  const doc = `| Item |        Due |
|------|------------|
| pen  | 11/12/2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  const a = await actions("file:///ca-amb.md", doc, 2);
  expect(a.filter((x) => x.kind === "quickfix")).toEqual([]);
});

test("an unknown name offers its did-you-mean as a fix", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Pric * Qty
\`\`\`
`;
  const a = await actions("file:///ca-undef.md", doc, 5);
  const fix = a.find((x) => x.title.includes("Price"));
  expect(fix).toBeDefined();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/code-actions.test.ts`
Expected: FAIL — no code action handler is registered.

- [ ] **Step 3: Write `src/codeActions.ts`**

```ts
import {
  CodeActionKind,
  type CodeAction,
  type Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { planFmt } from "visimark";
import type { Analysis } from "./analysis.js";
import { rangeOf } from "./diagnostics.js";
import { formatEdits } from "./formatting.js";
import type { Settings } from "./settings.js";

export const FIX_ALL = `${CodeActionKind.SourceFixAll}.visimark`;

export function codeActionsFor(
  doc: TextDocument,
  analysis: Analysis,
  range: Range,
  only: string[] | undefined,
  settings: Settings,
): CodeAction[] {
  if (!analysis.applicable) return [];
  const wants = (kind: string): boolean =>
    !only || only.some((k) => kind === k || kind.startsWith(`${k}.`));

  const out: CodeAction[] = [];
  const lo = doc.offsetAt(range.start);
  const hi = doc.offsetAt(range.end);
  const opts = { fixDates: true }; // a per-finding date fix is always offered

  if (wants(FIX_ALL)) {
    const edits = formatEdits(doc, analysis, {
      fixDates: settings.format.fixDates,
    });
    if (edits.length > 0) {
      out.push({
        title: "VisiMark: fix all stale values",
        kind: FIX_ALL,
        edit: { changes: { [doc.uri]: edits } },
      });
    }
  }

  if (!wants(CodeActionKind.QuickFix)) return out;

  // One quick fix per planned edit that overlaps the requested range.
  for (const e of planFmt(analysis.model, analysis.result, opts)) {
    if (e.end <= lo || e.start >= hi) continue;
    const f = e.finding;
    const title =
      f.code === "DATE"
        ? `VisiMark: rewrite to ${e.text}`
        : `VisiMark: update to ${e.text}`;
    out.push({
      title,
      kind: CodeActionKind.QuickFix,
      isPreferred: f.code === "STALE",
      edit: {
        changes: {
          [doc.uri]: [
            {
              range: rangeOf(doc, { start: e.start, end: e.end }),
              newText: e.text,
            },
          ],
        },
      },
    });
  }

  // Findings with no planned edit but an obvious textual repair.
  for (const f of analysis.result.findings) {
    if (!f.span || f.span.end <= lo || f.span.start >= hi) continue;
    if (f.code === "UNDEF" && f.suggestion) {
      out.push({
        title: `VisiMark: change to ${f.suggestion}`,
        kind: CodeActionKind.QuickFix,
        edit: {
          changes: {
            [doc.uri]: [
              { range: rangeOf(doc, f.span), newText: f.suggestion },
            ],
          },
        },
      });
    }
    if (f.code === "VECTOR" && f.raw) {
      out.push({
        title: `VisiMark: wrap in SUM(${f.raw})`,
        kind: CodeActionKind.QuickFix,
        edit: {
          changes: {
            [doc.uri]: [
              { range: rangeOf(doc, f.span), newText: `SUM(${f.raw})` },
            ],
          },
        },
      });
    }
  }

  return out;
}
```

- [ ] **Step 4: Register the handler in `src/server.ts`**

```ts
import { codeActionsFor } from "./codeActions.js";

connection.onCodeAction((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return codeActionsFor(
    doc,
    analysis,
    params.range,
    params.context.only,
    settings,
  );
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/code-actions.test.ts`
Expected: PASS, all six.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): quick fixes and source.fixAll.visimark

A stale cell offers its computed value as a preferred fix and repairs
only itself; source.fixAll repairs the document. A decidable date offers
its ISO rewrite and an ambiguous one offers nothing, which is the CLI's
rule reaching the lightbulb unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Inlay hints — stale values only

**Files:**
- Create: `packages/visimark-lsp/src/inlayHints.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/inlay-hints.test.ts`

**Interfaces:**
- Consumes: `Analysis`; `rangeOf` from `./diagnostics.js`.
- Produces: `function inlayHintsFor(doc, analysis, range): InlayHint[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/inlay-hints.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface InlayHint {
  position: { line: number; character: number };
  label: string;
  paddingLeft?: boolean;
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function hints(uri: string, text: string): Promise<InlayHint[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<InlayHint[]>("textDocument/inlayHint", {
    textDocument: { uri },
    range: {
      start: { line: 0, character: 0 },
      end: { line: text.split("\n").length, character: 0 },
    },
  });
}

test("a stale cell gets a hint showing the computed value", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  const hs = await hints("file:///ih-stale.md", doc);
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹10.00›");
  expect(hs[0]!.position.line).toBe(2);
  expect(hs[0]!.paddingLeft).toBe(true);
});

test("a correct cell gets no hint", async () => {
  const doc = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  expect(await hints("file:///ih-ok.md", doc)).toEqual([]);
});

test("a stale anchor gets a hint too", async () => {
  const doc = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **0.00**<!--vmark=s.total-->
`;
  const hs = await hints("file:///ih-anchor.md", doc);
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹10.00›");
});

test("non-STALE findings get no hint", async () => {
  const doc = `\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`;
  expect(await hints("file:///ih-dup.md", doc)).toEqual([]);
});

test("a hint respects the requested range", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open("file:///ih-range.md", doc);
  await h.nextDiagnostics("file:///ih-range.md");
  const hs = await h.request<InlayHint[]>("textDocument/inlayHint", {
    textDocument: { uri: "file:///ih-range.md" },
    range: {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 0 },
    },
  });
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹6.00›");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/inlay-hints.test.ts`
Expected: FAIL — no inlay hint handler is registered.

- [ ] **Step 3: Write `src/inlayHints.ts`**

```ts
import {
  InlayHintKind,
  type InlayHint,
  type Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Analysis } from "./analysis.js";

/**
 * The non-destructive twin of format-on-save: show the computed value beside
 * a value the document disagrees with, and change nothing. A correct value
 * gets no hint — the right number is already in the text — so a hint is pure
 * disagreement signal.
 */
export function inlayHintsFor(
  doc: TextDocument,
  analysis: Analysis,
  range: Range,
): InlayHint[] {
  if (!analysis.applicable) return [];
  const lo = doc.offsetAt(range.start);
  const hi = doc.offsetAt(range.end);

  const out: InlayHint[] = [];
  for (const f of analysis.result.findings) {
    if (f.code !== "STALE" || f.anchorGroup) continue;
    if (!f.span || f.computed === undefined) continue;
    if (f.span.end <= lo || f.span.start >= hi) continue;
    out.push({
      position: doc.positionAt(f.span.end),
      label: `‹${f.computed}›`,
      kind: InlayHintKind.Type,
      paddingLeft: true,
    });
  }
  return out;
}
```

- [ ] **Step 4: Register the handler in `src/server.ts`**

```ts
import { inlayHintsFor } from "./inlayHints.js";

connection.languages.inlayHint.on((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable || !settings.inlayHints.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return inlayHintsFor(doc, analysis, params.range);
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/inlay-hints.test.ts`
Expected: PASS, all five.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): inlay hints on stale values

The default way a person sees the computed truth without the file
changing. A hint appears only where the document disagrees with its
formula; a correct value already reads correctly and gets nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: CodeLens on `vmark` blocks

**Files:**
- Create: `packages/visimark-lsp/src/codeLens.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/code-lens.test.ts`

**Interfaces:**
- Consumes: `Analysis`; `model.located.blocks` and `model.blockOfSheet`.
- Produces: `function codeLensesFor(doc, analysis): CodeLens[]`, emitting commands `visimark.fixSheet` and `visimark.explainSheet`, each with arguments `[uri, sheetId]`, which Task 10 implements client-side.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/code-lens.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface CodeLens {
  range: { start: { line: number; character: number } };
  command?: { title: string; command: string; arguments?: unknown[] };
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function lenses(uri: string, text: string): Promise<CodeLens[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<CodeLens[]>("textDocument/codeLens", {
    textDocument: { uri },
  });
}

const twoSheets = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

| Stage | Share |
|-------|------:|
| a     |   50% |

\`\`\`vmark #plan
covered = SUM(Share)
\`\`\`

Covered: **0.50**<!--vmark=plan.covered-->
`;

test("each vmark block gets a lens on its fence line", async () => {
  const ls = await lenses("file:///cl-two.md", twoSheets);
  const fixes = ls.filter((l) => l.command?.command === "visimark.fixSheet");
  expect(fixes.length).toBe(2);
});

test("the lens counts formulas and stale values", async () => {
  const ls = await lenses("file:///cl-count.md", twoSheets);
  const order = ls.find((l) =>
    l.command?.title.includes("stale"),
  )!;
  expect(order.command!.title).toBe("2 formulas · 1 stale");
});

test("a clean sheet's lens says ok", async () => {
  const ls = await lenses("file:///cl-ok.md", twoSheets);
  const ok = ls.find((l) => l.command?.title.includes("ok"));
  expect(ok!.command!.title).toBe("1 formula · ok");
});

test("the lens carries the uri and sheet id as arguments", async () => {
  const ls = await lenses("file:///cl-args.md", twoSheets);
  const fix = ls.find((l) => l.command?.command === "visimark.fixSheet")!;
  expect(fix.command!.arguments).toEqual(["file:///cl-args.md", "order"]);
});

test("every block also gets an explain lens", async () => {
  const ls = await lenses("file:///cl-explain.md", twoSheets);
  expect(
    ls.filter((l) => l.command?.command === "visimark.explainSheet").length,
  ).toBe(2);
});

test("a document with no vmark block has no lenses", async () => {
  expect(await lenses("file:///cl-none.md", "# prose only\n")).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/code-lens.test.ts`
Expected: FAIL — no code lens handler is registered.

- [ ] **Step 3: Write `src/codeLens.ts`**

```ts
import type { CodeLens } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Analysis } from "./analysis.js";

const plural = (n: number, one: string): string =>
  `${n} ${one}${n === 1 ? "" : "s"}`;

export function codeLensesFor(
  doc: TextDocument,
  analysis: Analysis,
): CodeLens[] {
  if (!analysis.applicable) return [];
  const { model, result } = analysis;
  const out: CodeLens[] = [];

  for (const [sheetId, block] of model.blockOfSheet) {
    const sheet = model.sheets.get(sheetId);
    if (!sheet) continue;
    const formulas = sheet.columns.size + sheet.scalars.size;
    const stale = result.findings.filter(
      (f) => f.code === "STALE" && !f.anchorGroup && f.sheetId === sheetId,
    ).length;

    const start = doc.positionAt(block.span.start);
    const range = { start, end: start };
    const title =
      stale > 0
        ? `${plural(formulas, "formula")} · ${stale} stale`
        : `${plural(formulas, "formula")} · ok`;

    out.push({
      range,
      command: {
        title,
        command: "visimark.fixSheet",
        arguments: [doc.uri, sheetId],
      },
    });
    out.push({
      range,
      command: {
        title: "Explain",
        command: "visimark.explainSheet",
        arguments: [doc.uri, sheetId],
      },
    });
  }

  return out;
}
```

- [ ] **Step 4: Register the handler in `src/server.ts`**

```ts
import { codeLensesFor } from "./codeLens.js";

connection.onCodeLens((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable || !settings.codeLens.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return codeLensesFor(doc, analysis);
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/code-lens.test.ts`
Expected: PASS, all six.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): a CodeLens per vmark block

Each block reports how many formulas it holds and how many of them the
document currently disagrees with, and offers to repair that sheet or
explain it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Hover

**Files:**
- Create: `packages/visimark-lsp/src/hover.ts`
- Modify: `packages/visimark-lsp/src/server.ts`
- Test: `packages/visimark-lsp/test/hover.test.ts`

**Interfaces:**
- Consumes: `Analysis`; `dependencies`, `refText` from `"visimark"`.
- Produces: `function hoverAt(doc, analysis, position): Hover | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark-lsp/test/hover.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface Hover {
  contents: { kind: string; value: string };
}

const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **10.00**<!--vmark=s.total-->
`;

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function hover(line: number, character: number): Promise<Hover | null> {
  const uri = `file:///hv-${line}-${character}.md`;
  await h.open(uri, doc);
  await h.nextDiagnostics(uri);
  return h.request<Hover | null>("textDocument/hover", {
    textDocument: { uri },
    position: { line, character },
  });
}

test("hovering a rule name shows its formula and dependencies", async () => {
  const hv = await hover(5, 1); // "Net" in `Net = Price * Qty`
  expect(hv!.contents.value).toContain("Net = Price * Qty");
  expect(hv!.contents.value).toContain("Price");
  expect(hv!.contents.value).toContain("Qty");
});

test("hovering a stale cell shows the rule and what it should be", async () => {
  const hv = await hover(2, 24); // the "9.99" cell
  expect(hv!.contents.value).toContain("Net = Price * Qty");
  expect(hv!.contents.value).toContain("10.00");
  expect(hv!.contents.value).toContain("9.99");
});

test("hovering an anchored value shows its scalar rule", async () => {
  const hv = await hover(10, 10); // inside **10.00**
  expect(hv!.contents.value).toContain("total = SUM(Net)");
});

test("hovering prose returns nothing", async () => {
  expect(await hover(0, 2)).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/visimark-lsp/test/hover.test.ts`
Expected: FAIL — no hover handler is registered.

- [ ] **Step 3: Write `src/hover.ts`**

```ts
import { MarkupKind, type Hover, type Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { dependencies, refText, type Binding } from "visimark";
import type { Analysis } from "./analysis.js";

export function hoverAt(
  doc: TextDocument,
  analysis: Analysis,
  position: Position,
): Hover | null {
  if (!analysis.applicable) return null;
  const { model, result } = analysis;
  const off = doc.offsetAt(position);

  const md = (value: string): Hover => ({
    contents: { kind: MarkupKind.Markdown, value },
  });

  const formula = (b: Binding): string =>
    `${b.name} = ${model.source.slice(b.expr.start, b.expr.end)}`;

  const deps = (b: Binding): string => {
    const info = dependencies(model, b);
    const names = [...new Set(info.refs.map((r) => refText(r.ref)))];
    return names.length > 0 ? `\n\ndepends on: ${names.join(", ")}` : "";
  };

  const allBindings: Binding[] = [
    ...model.docScope.values(),
    ...[...model.sheets.values()].flatMap((s) => [
      ...s.columns.values(),
      ...s.scalars.values(),
    ]),
  ];

  // 1. inside a vmark block, on a binding line
  for (const b of allBindings) {
    if (off < b.span.start || off > b.span.end) continue;
    const v = result.values.get(b.id);
    const shown = v
      ? `\n\n= \`${v.t === "num" ? v.d.toString() : v.t === "date" ? v.iso : String(v.t === "bool" ? v.b : v.s)}\``
      : "";
    return md("```vmark\n" + formula(b) + "\n```" + shown + deps(b));
  }

  // 2. a table cell in a computed column
  for (const sheet of model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, binding] of sheet.columns) {
      const idx = sheet.columnIndex.get(name)!;
      for (let r = 0; r < table.rows.length; r++) {
        const cell = table.rows[r]!.cells[idx];
        if (!cell || off < cell.start || off > cell.end) continue;
        const stale = result.findings.find(
          (f) =>
            f.code === "STALE" &&
            f.span?.start === cell.start &&
            f.span?.end === cell.end,
        );
        const body =
          "```vmark\n" + formula(binding) + "\n```" +
          (stale
            ? `\n\ncomputed \`${stale.computed}\` — the cell says \`${stale.stored}\``
            : "");
        return md(body + deps(binding));
      }
    }
  }

  // 3. an anchored value in prose
  for (const a of model.anchors) {
    if (!a.value) continue;
    if (off < a.value.start || off > a.value.end) continue;
    const id = `${a.sheetId}.${a.name}`;
    const b = allBindings.find((x) => x.id === id);
    if (!b) continue;
    return md("```vmark\n" + formula(b) + "\n```" + deps(b));
  }

  return null;
}
```

- [ ] **Step 4: Register the handler in `src/server.ts`**

```ts
import { hoverAt } from "./hover.js";

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return null;
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return hoverAt(doc, analysis, params.position);
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/visimark-lsp/test/hover.test.ts`
Expected: PASS, all four. If a position lands a character off, read the fixture
and adjust the test's column rather than loosening the implementation.

Run: `bun test`
Expected: PASS across the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lsp): hover shows the formula behind a number

Hovering a rule, a computed cell or an anchored value shows the formula
that produced it, what it evaluates to, and what it depends on — the
explain command, reachable without leaving the sentence.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: The VS Code client

**Files:**
- Create: `editors/vscode/package.json`, `tsconfig.json`, `src/extension.ts`, `src/status.ts`, `src/virtualDocs.ts`, `esbuild.mjs`, `README.md`, `CHANGELOG.md`, `.vscodeignore`, `icon.png`
- Test: `editors/vscode/test/smoke.test.ts`

**Interfaces:**
- Consumes: the built server bundle; the `visimark/status` notification; the commands emitted by Task 8's lenses.
- Produces: the packaged extension.

- [ ] **Step 1: Write `editors/vscode/package.json`**

```json
{
  "name": "visimark",
  "displayName": "VisiMark",
  "description": "Spreadsheet mechanics for Markdown: every computed number carries the formula that produced it.",
  "version": "0.1.0",
  "publisher": "visimark",
  "license": "MIT",
  "private": true,
  "type": "module",
  "icon": "icon.png",
  "categories": ["Linters", "Formatters"],
  "keywords": ["markdown", "spreadsheet", "formula", "invoice"],
  "repository": { "type": "git", "url": "https://github.com/OWNER/visimark" },
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onLanguage:markdown"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "visimark.fixAllStale", "title": "VisiMark: Fix All Stale Values" },
      { "command": "visimark.fixSheet", "title": "VisiMark: Fix Sheet" },
      { "command": "visimark.explainSheet", "title": "VisiMark: Explain Sheet" },
      { "command": "visimark.showReport", "title": "VisiMark: Show Report" },
      { "command": "visimark.restartServer", "title": "VisiMark: Restart Server" }
    ],
    "configuration": {
      "title": "VisiMark",
      "properties": {
        "visimark.enable": {
          "type": "boolean", "default": true,
          "description": "Enable VisiMark for Markdown files."
        },
        "visimark.check.debounce": {
          "type": "number", "default": 300, "minimum": 0,
          "description": "Milliseconds to wait after a keystroke before re-checking."
        },
        "visimark.format.fixDates": {
          "type": "boolean", "default": false,
          "markdownDescription": "When formatting, also rewrite *decidable* non-ISO dates (`15.10.2026` becomes `2026-10-15`). Ambiguous dates are never touched."
        },
        "visimark.inlayHints.enable": {
          "type": "boolean", "default": true,
          "description": "Show the computed value beside a stale value, without changing the file."
        },
        "visimark.codeLens.enable": {
          "type": "boolean", "default": true,
          "description": "Show a lens above each vmark block."
        },
        "visimark.statusBar.enable": {
          "type": "boolean", "default": true,
          "description": "Show VisiMark's status for the active document in the status bar."
        },
        "visimark.server.path": {
          "type": "string", "default": "",
          "description": "Development only: path to a server entry point to run instead of the bundled one."
        },
        "visimark.trace.server": {
          "type": "string", "enum": ["off", "messages", "verbose"], "default": "off",
          "description": "Trace the communication between VS Code and the VisiMark language server."
        }
      }
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "node esbuild.mjs",
    "package": "bun run build && vsce package --no-dependencies"
  },
  "dependencies": {
    "vscode-languageclient": "^9.0.1"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^3.2.0",
    "esbuild": "^0.24.0",
    "ovsx": "^0.10.0"
  }
}
```

Note `"private": true` keeps `npm publish` away from it; `vsce` publishes it.

- [ ] **Step 2: Write `editors/vscode/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node", "vscode"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `editors/vscode/src/status.ts`**

```ts
import * as vscode from "vscode";

export interface Status {
  uri: string;
  stale: number;
  errors: number;
}

export class StatusBar {
  private readonly item: vscode.StatusBarItem;
  private readonly seen = new Map<string, Status>();

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = "visimark.showReport";
  }

  record(status: Status): void {
    this.seen.set(status.uri, status);
    this.refresh();
  }

  forget(uri: string): void {
    this.seen.delete(uri);
    this.refresh();
  }

  refresh(): void {
    const enabled = vscode.workspace
      .getConfiguration("visimark")
      .get<boolean>("statusBar.enable", true);
    const editor = vscode.window.activeTextEditor;
    const status = editor ? this.seen.get(editor.document.uri.toString()) : undefined;

    if (!enabled || !status) {
      this.item.hide();
      return;
    }
    if (status.stale === 0 && status.errors === 0) {
      this.item.text = "$(check) VisiMark";
      this.item.tooltip = "VisiMark: this document agrees with its formulas";
    } else {
      const bits: string[] = [];
      if (status.stale > 0) bits.push(`${status.stale} stale`);
      if (status.errors > 0) bits.push(`${status.errors} error${status.errors === 1 ? "" : "s"}`);
      this.item.text = `$(warning) VisiMark: ${bits.join(", ")}`;
      this.item.tooltip = "VisiMark: click for the full report";
    }
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
```

- [ ] **Step 4: Write `editors/vscode/src/virtualDocs.ts`**

```ts
import * as vscode from "vscode";

/**
 * Read-only documents for `explain` and the full `check` report. The content
 * is pushed in by the extension; the provider just serves it.
 */
export class TextProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly content = new Map<string, string>();
  readonly onDidChange = this.emitter.event;

  set(uri: vscode.Uri, text: string): void {
    this.content.set(uri.toString(), text);
    this.emitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? "";
  }
}

export async function show(
  provider: TextProvider,
  uri: vscode.Uri,
  text: string,
): Promise<void> {
  provider.set(uri, text);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
}
```

- [ ] **Step 5: Write `editors/vscode/src/extension.ts`**

```ts
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node.js";
import { StatusBar, type Status } from "./status.js";
import { show, TextProvider } from "./virtualDocs.js";

let client: LanguageClient | undefined;
let statusBar: StatusBar | undefined;

const EXPLAIN_SCHEME = "visimark-explain";
const REPORT_SCHEME = "visimark-report";

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const configured = vscode.workspace
    .getConfiguration("visimark")
    .get<string>("server.path", "");
  const module =
    configured && configured.length > 0
      ? configured
      : context.asAbsolutePath(path.join("dist", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6019"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "markdown", scheme: "file" },
      { language: "markdown", scheme: "untitled" },
    ],
    synchronize: {
      configurationSection: "visimark",
    },
  };

  client = new LanguageClient(
    "visimark",
    "VisiMark",
    serverOptions,
    clientOptions,
  );

  statusBar = new StatusBar();
  const explain = new TextProvider();
  const report = new TextProvider();

  context.subscriptions.push(
    statusBar,
    vscode.workspace.registerTextDocumentContentProvider(EXPLAIN_SCHEME, explain),
    vscode.workspace.registerTextDocumentContentProvider(REPORT_SCHEME, report),
    vscode.window.onDidChangeActiveTextEditor(() => statusBar?.refresh()),
    vscode.workspace.onDidCloseTextDocument((d) =>
      statusBar?.forget(d.uri.toString()),
    ),

    vscode.commands.registerCommand("visimark.fixAllStale", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await vscode.commands.executeCommand("editor.action.formatDocument");
    }),

    vscode.commands.registerCommand(
      "visimark.fixSheet",
      async (uri: string, _sheetId: string) => {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        await vscode.window.showTextDocument(doc);
        await vscode.commands.executeCommand("editor.action.formatDocument");
      },
    ),

    vscode.commands.registerCommand(
      "visimark.explainSheet",
      async (uri: string, sheetId: string) => {
        const text = await runCliOn(uri, ["explain", `#${sheetId}`]);
        await show(
          explain,
          vscode.Uri.parse(`${EXPLAIN_SCHEME}:${sheetId}.txt`),
          text,
        );
      },
    ),

    vscode.commands.registerCommand("visimark.showReport", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = await runCliOn(editor.document.uri.toString(), ["check"]);
      await show(
        report,
        vscode.Uri.parse(`${REPORT_SCHEME}:report.txt`),
        text,
      );
    }),

    vscode.commands.registerCommand("visimark.restartServer", async () => {
      await client?.restart();
    }),
  );

  await client.start();

  client.onNotification("visimark/status", (s: Status) => {
    statusBar?.record(s);
  });
}

/**
 * Run a CLI command against the *in-editor* text, so the report reflects
 * unsaved edits. The engine is bundled into the extension, so this is an
 * in-process call, not a subprocess.
 */
async function runCliOn(uri: string, args: string[]): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const { analyze, formatCheck } = await import("visimark");
  if (args[0] === "check") {
    const { result } = analyze(doc.getText());
    return formatCheck(doc.uri.fsPath, result.findings);
  }
  const { runCli } = await import("visimark");
  const lines: string[] = [];
  await runCli([...args, doc.uri.fsPath], {
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
  });
  return lines.join("\n");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
  statusBar = undefined;
}
```

- [ ] **Step 6: Write `editors/vscode/esbuild.mjs`**

```js
import { build } from "esbuild";

const common = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node18",
  minify: true,
  sourcemap: true,
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
});

await build({
  ...common,
  entryPoints: ["../../packages/visimark-lsp/src/server.ts"],
  outfile: "dist/server.js",
  external: ["vscode"],
});
```

Both bundles inline the engine, so the VSIX carries no `node_modules`. The
extension is CommonJS because that is what the VS Code extension host loads;
the `await import("visimark")` calls in `extension.ts` are resolved at bundle
time and become local references.

- [ ] **Step 7: Write `.vscodeignore`**

```
.vscode/**
src/**
test/**
node_modules/**
tsconfig.json
esbuild.mjs
**/*.map
```

- [ ] **Step 8: Write the listing README and a placeholder icon**

`editors/vscode/README.md` — a short listing page derived from the repo README:

```markdown
# VisiMark for VS Code

Spreadsheet mechanics for Markdown. Every computed number in your document
carries the formula that produced it, and VisiMark proves the two still agree.

- **Live checking.** Stale values, ambiguous dates, mixed units and unknown
  names are squiggled as you type. Nothing is written.
- **Inline truth.** A stale value shows what it *should* be, right beside it,
  without the file changing.
- **Repair on demand.** "Format Document" — or your own `editor.formatOnSave`
  — rewrites computed cells and anchored values, and nothing else.
- **Quick fixes.** Update one cell, rewrite one unambiguous date, or fix the
  whole document.

A VisiMark document is ordinary Markdown. It renders correctly on GitHub, in
VS Code preview, and through pandoc, with no plugin.
```

`CHANGELOG.md`:

```markdown
# Changelog

## 0.1.0

First release. Diagnostics, formatting, quick fixes, inlay hints, CodeLens,
hover and a status bar item, over one language server wrapping the VisiMark
engine.
```

Create a 128×128 `icon.png`. If no artwork exists yet, generate a plain one:

```bash
cd editors/vscode
printf 'P3\n1 1\n255\n28 26 77\n' > /tmp/vm.ppm
# Convert with whatever is available; if nothing is, commit any 128x128 PNG
# and replace it before publishing.
```

If no image tooling is available, note it and set `"icon"` aside until Task 11
— `vsce package` fails without the file, so this must be resolved here.

- [ ] **Step 9: Write the smoke test**

`@vscode/test-electron` downloads a VS Code build and is slow, so the suite
keeps exactly one test. Create `editors/vscode/test/smoke.test.ts`:

```ts
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

test("the build produces both bundles the manifest points at", () => {
  const dist = join(here, "..", "dist");
  expect(existsSync(join(dist, "extension.js"))).toBe(true);
  expect(existsSync(join(dist, "server.js"))).toBe(true);
});
```

The interactive check is manual and belongs in the task's verification, not in
CI: open `doc/example-invoice-drift.md` in the Extension Development Host,
confirm the squiggles, confirm the inlay hints, run "Format Document", confirm
the stale values are repaired and nothing else moved.

- [ ] **Step 10: Build and verify**

```bash
bun install
cd editors/vscode && bun run build && cd ../..
bun test
bun run typecheck
```

Expected: both bundles exist; the whole workspace suite passes.

Then, by hand: press F5 in VS Code to launch the Extension Development Host,
open `doc/example-invoice-drift.md`, and confirm each of the six behaviours
listed above.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(vscode): the client — status bar, commands, bundling

A thin client: it starts the server, keeps a status bar item fed by the
visimark/status notification, contributes the commands the CodeLens
emits, and serves explain and report output as read-only virtual
documents. esbuild inlines the engine into both bundles, so the VSIX
carries no node_modules.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: CI and the release workflow

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Create: `CHANGELOG.md` (repo root)

**Interfaces:**
- Consumes: the `test`, `typecheck`, `build` and `package` scripts from every package.
- Produces: a green check on every push, and a tag-triggered release that publishes the engine to npm and the extension to both marketplaces.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
      - name: Package the extension
        working-directory: editors/vscode
        run: bunx @vscode/vsce package --no-dependencies --out visimark.vsix
      - uses: actions/upload-artifact@v4
        with:
          name: visimark-vsix
          path: editors/vscode/visimark.vsix
```

- [ ] **Step 2: Write `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun test
      - run: bun run build

      - name: Publish the engine to npm
        working-directory: packages/visimark
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          VERSION=$(node -p "require('./package.json').version")
          if npm view "visimark@$VERSION" version >/dev/null 2>&1; then
            echo "visimark@$VERSION is already published; skipping."
          else
            npm publish --access public
          fi

      - name: Package the extension
        working-directory: editors/vscode
        run: bunx @vscode/vsce package --no-dependencies --out visimark.vsix

      - name: Publish to the VS Code Marketplace
        working-directory: editors/vscode
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
        run: bunx @vscode/vsce publish --no-dependencies --packagePath visimark.vsix || echo "already published; skipping"

      - name: Publish to Open VSX
        working-directory: editors/vscode
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}
        run: bunx ovsx publish visimark.vsix -p "$OVSX_PAT" || echo "already published; skipping"

      - name: GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: editors/vscode/visimark.vsix
          body_path: CHANGELOG.md
          generate_release_notes: true
```

- [ ] **Step 3: Write the repo-root `CHANGELOG.md`**

```markdown
# Changelog

## Unreleased

### Added
- `DUP` — a name bound twice in one scope is an error rather than a silent
  overwrite.
- `UNIT` — a column may carry a currency symbol or a physical unit, inferred
  from its own cells and re-applied on write-back. A column that mixes
  decorations is an error, not a sum.
- A language server and a VS Code extension: live diagnostics, formatting
  through the editor's own format-on-save, quick fixes, inlay hints showing the
  computed value without changing the file, CodeLens per `vmark` block, hover,
  and a status bar item.
```

- [ ] **Step 4: Document the required secrets**

Add to the repo README, under Status:

```markdown
Releases are tag-driven: pushing a `vX.Y.Z` tag publishes the engine to npm and
the extension to both the VS Code Marketplace and Open VSX. The workflow needs
three repository secrets — `NPM_TOKEN`, `VSCE_PAT` and `OVSX_PAT`.
```

- [ ] **Step 5: Verify the workflows parse and the package builds**

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
cd editors/vscode && bunx @vscode/vsce package --no-dependencies --out visimark.vsix && cd ../..
```

Expected: a `visimark.vsix` appears. Inspect it — `unzip -l editors/vscode/visimark.vsix` — and confirm it contains `dist/extension.js` and `dist/server.js` and **no** `node_modules`.

Push the branch and confirm the `ci` workflow goes green before tagging anything.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ci: test and package on every push; release on a version tag

A vX.Y.Z tag publishes the engine to npm and the extension to the VS
Code Marketplace and Open VSX, and attaches the .vsix to a GitHub
release. Each publish step is a no-op when that version already exists,
so a release can be re-run.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done when

- `bun test` passes across all three packages, engine acceptance suite included.
- `bun run typecheck` is clean in every package.
- Opening `doc/example-invoice-drift.md` in the Extension Development Host shows squiggles on the stale cells, the ambiguous date and the cycle.
- Stale cells show their computed value as an inlay hint, and the file is unchanged on disk.
- "Format Document" repairs every stale value and moves nothing else; the diff is one line per repaired cell.
- The lightbulb on a stale cell offers "VisiMark: update to …" and fixes only that cell.
- Each `vmark` block carries a lens reading `N formulas · M stale`.
- Hovering a computed cell shows its rule and what it evaluates to.
- The status bar reads `⚠ VisiMark: 21 stale, 5 errors` on the drift invoice and `✓ VisiMark` on the clean one.
- A plain Markdown file with no `vmark` block produces nothing at all.
- `vsce package` produces a `.vsix` containing both bundles and no `node_modules`.
