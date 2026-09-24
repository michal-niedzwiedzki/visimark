import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as browser from "../../src/browser.js";
import * as index from "../../src/index.js";

/**
 * **Why this file exists.** `src/browser.ts` is the engine's browser-safe
 * entry point (issue #201). Its whole value is a property that is invisible
 * from inside it: that nothing it re-exports drags a `node:` builtin into a
 * bundle. `src/index.ts` does — nine specifiers from five builtins — and
 * nobody noticed for as long as no browser consumer went through it.
 *
 * Two properties, because either can break without the other:
 *
 * 1. **No Node in the graph.** The same source walk
 *    `test/playground/browser-graph.test.ts` runs over the playground entry,
 *    run over this one. `node:path` is the single admitted builtin, for the
 *    reason that file's `ALLOWED_BUILTINS` records.
 * 2. **The browser surface is a subset of the public one.** Every value
 *    `browser.ts` exports must also be exported by `index.ts`. A missing
 *    export is a gap and is allowed; an *extra* one is a second API, and a
 *    second API drifts. This is the assertion that keeps "one engine, thin
 *    client" true rather than aspirational.
 *
 * **This deliberately restates the walk** rather than sharing a helper with
 * `test/playground/browser-graph.test.ts`. Those are two guards over two
 * graphs that can be broken independently, and the playground guard's header
 * says in as many words that it must not be relaxed; a shared walker is one
 * file whose edit relaxes both. Extract one when there is a third caller.
 *
 * **If test 1 fails**, a `node:` builtin re-entered the browser-safe surface —
 * either `browser.ts` grew an export that reaches one, or a module it already
 * re-exports grew an import. Fix the import named in the message, or leave the
 * export out of `browser.ts`; do not widen the allowlist.
 */

const src = resolve(import.meta.dir, "../../src");
const entry = join(src, "browser.ts");

/**
 * `node:` builtins this graph may reach — the same single entry the playground
 * guard permits, for the same reason: `node:path` is string manipulation,
 * `fs/gate.ts` uses `dirname`/`isAbsolute`/`resolve`/`sep` to decide
 * containment, and it touches no filesystem. Unlike the playground, the
 * consumer here does not get a bundler's polyfill for free — `editors/obsidian`
 * ships its own shim, because Obsidian mobile is not Electron. Adding to this
 * list is a decision, not a fix.
 */
const ALLOWED_BUILTINS = new Set(["node:path"]);

/** `import … from "x";` / `export … from "x";` / `import "x";`, oxfmt style */
const FROM_RE = /^(?:import|export)\b[^;]*?\bfrom\s*"([^"]+)";/gm;
const BARE_IMPORT_RE = /^import\s*"([^"]+)";/gm;
/** a dynamic import would be invisible to the walk above, so it is banned outright */
const DYNAMIC_RE = /\bimport\s*\(/;

function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(FROM_RE)) found.push(m[1]!);
  for (const m of text.matchAll(BARE_IMPORT_RE)) found.push(m[1]!);
  return found;
}

/** every `.ts` file reachable from the browser-safe entry, entry included */
function browserGraph(): Map<string, string> {
  const out = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (out.has(file)) continue;
    const text = readFileSync(file, "utf8");
    out.set(file, text);
    for (const spec of specifiers(text)) {
      if (!spec.startsWith(".")) continue;
      // the source is written in ESM style: `./x.js` names `./x.ts` on disk
      queue.push(resolve(dirname(file), spec).replace(/\.js$/, ".ts"));
    }
  }
  return out;
}

const shortName = (f: string) => relative(resolve(src, ".."), f);

test("no module reachable from src/browser.ts imports a node: builtin outside the allowlist", () => {
  const offenders: string[] = [];
  for (const [file, text] of browserGraph()) {
    for (const spec of specifiers(text)) {
      if (!spec.startsWith("node:") || ALLOWED_BUILTINS.has(spec)) continue;
      offenders.push(`${shortName(file)} imports ${spec}`);
    }
  }
  expect(
    offenders,
    `${offenders.join("; ")} — src/browser.ts is the entry a browser client bundles, and a ` +
      `bundler resolves before it shakes, so an unreachable import is still a build failure ` +
      `there and a stubbed call site here. Drop the export from src/browser.ts, or route the ` +
      `need through ReaderPort (src/fs/reader.ts). Do not widen ALLOWED_BUILTINS.`,
  ).toEqual([]);
});

test("the five node-only exports of src/index.ts are absent from src/browser.ts", () => {
  // stated by name, and separately from the allowlist test, so that renaming a
  // module cannot quietly disable the check that matters most
  const nodeOnly = ["nodeReader", "onDisk", "runCli", "readVersion", "writeArtifact"];
  const present = nodeOnly.filter((name) => name in browser);
  expect(
    present,
    `src/browser.ts exports ${present.join(", ")} — each reaches node:fs, node:crypto, ` +
      `node:module or node:url directly. A browser host supplies its own ReaderPort.`,
  ).toEqual([]);
});

test("src/fs/node-reader.ts is not reachable from src/browser.ts", () => {
  const graph = [...browserGraph().keys()].map(shortName);
  expect(
    graph,
    "the node:fs reader must stay out of any browser bundle — see src/fs/reader.ts",
  ).not.toContain("src/fs/node-reader.ts");
});

test("the browser-safe graph contains no dynamic import the static walk could miss", () => {
  const offenders = [...browserGraph()]
    .filter(([, text]) => DYNAMIC_RE.test(text))
    .map(([file]) => shortName(file));
  expect(
    offenders,
    `${offenders.join(", ")} uses import() — the walk above resolves static imports only, so a ` +
      `dynamic one would hide a node: builtin from it. Import statically, or teach the walk.`,
  ).toEqual([]);
});

test("every value src/browser.ts exports is also exported by src/index.ts", () => {
  // `memoryReader` and `sha256Hex` are the two deliberate additions: the
  // browser's ReaderPort and the synchronous digest it runs on, which
  // index.ts has never exported because no Node caller needs them. Every
  // other name must be the same object the public entry point serves, or the
  // two surfaces are two APIs.
  const ADDITIONS = new Set(["memoryReader", "sha256Hex"]);
  const extra = Object.keys(browser).filter((k) => !ADDITIONS.has(k) && !(k in index));
  expect(
    extra,
    `src/browser.ts exports ${extra.join(", ")}, which src/index.ts does not. The browser ` +
      `surface is a subset of the public one: export it from index.ts first, or add it to ` +
      `ADDITIONS here with a reason. A name that exists only in the browser entry is a second API.`,
  ).toEqual([]);
});

test("the shared exports are the same objects, not lookalikes", () => {
  const shared = Object.keys(browser).filter((k) => k in index);
  const different = shared.filter(
    (k) => (browser as Record<string, unknown>)[k] !== (index as Record<string, unknown>)[k],
  );
  expect(
    different,
    `${different.join(", ")} differ between src/browser.ts and src/index.ts. Both must ` +
      `re-export the same module: a re-implementation is the drift this file exists to stop.`,
  ).toEqual([]);
});
