import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * **Why this file exists.** PR #99 fixed one crash: `fs/open.ts` read
 * `constants.O_NOFOLLOW` at module scope, `bun build --target browser` had
 * replaced `node:fs` with `(()=>({}))`, and the public playground was dead for
 * 74 minutes. It did not close the class. The bundle still carried
 * `existsSync`, `realpathSync`, `openSync` and `createHash` call sites over
 * those stubs, and the only thing keeping them unreached was every caller
 * happening to pass no document path — an invariant held by comments
 * (`docs/reviews/2026-09-16.md` §3.1 row 3, §4.2).
 *
 * The reader port (`src/fs/reader.ts`) removed `node:fs` and `node:crypto`
 * from the browser's module graph. These tests are what keep them out. They
 * check the same property from both ends, because each end can go blind on its
 * own: the source walk is exact about *which file* re-introduced an import but
 * cannot see what the bundler actually emitted, and the bundle grep sees the
 * shipped bytes but cannot say whose import put them there.
 *
 * **If one of these fails, a `node:` builtin has re-entered the browser
 * bundle.** The fix is in the named source file — give the phase what it needs
 * through `ReaderPort` and keep the `node:fs` implementation in
 * `src/fs/node-reader.ts`, which this graph must never reach. Do not relax the
 * check: the last time this property was asserted rather than tested, it was
 * false and the playground was down.
 */

const src = resolve(import.meta.dir, "../../src");
const entry = join(src, "playground/browser-entry.ts");
const bundle = resolve(import.meta.dir, "../../../../docs/vendor/visimark-browser.js");

/**
 * `node:` builtins the browser graph may reach. `node:path` is pure string
 * manipulation, has a real browser polyfill in `bun build`, and is what the
 * path gate uses to decide containment — it touches no filesystem. Adding to
 * this list is a decision, not a fix: a builtin belongs here only if the
 * bundler's browser build of it *works*, never merely because it is unreached.
 */
const ALLOWED_BUILTINS = new Set(["node:path"]);

/** `import … from "x";` / `export … from "x";` / `import "x";`, oxfmt style */
const FROM_RE = /^(?:import|export)\b[^;]*?\bfrom\s*"([^"]+)";/gm;
const BARE_IMPORT_RE = /^import\s*"([^"]+)";/gm;
/** a dynamic import would be invisible to the walk above, so it is banned outright */
const DYNAMIC_RE = /\bimport\s*\(/;

/** every `.ts` file reachable from the browser entry, entry included */
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
      const target = resolve(dirname(file), spec).replace(/\.js$/, ".ts");
      queue.push(target);
    }
  }
  return out;
}

function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(FROM_RE)) found.push(m[1]!);
  for (const m of text.matchAll(BARE_IMPORT_RE)) found.push(m[1]!);
  return found;
}

const shortName = (f: string) => relative(resolve(src, ".."), f);

test("no module reachable from the browser entry imports a node: builtin outside the allowlist", () => {
  const offenders: string[] = [];
  for (const [file, text] of browserGraph()) {
    for (const spec of specifiers(text)) {
      if (!spec.startsWith("node:") || ALLOWED_BUILTINS.has(spec)) continue;
      offenders.push(`${shortName(file)} imports ${spec}`);
    }
  }
  expect(
    offenders,
    `${offenders.join("; ")} — a node: builtin is back in the browser playground's module graph, ` +
      `where 'bun build --target browser' replaces it with a stub whose every call site is a ` +
      `latent crash (PR #99). Route the need through ReaderPort (src/fs/reader.ts) and keep the ` +
      `node:fs implementation in src/fs/node-reader.ts. Fix the import named above, not this test.`,
  ).toEqual([]);
});

test("src/fs/node-reader.ts is not reachable from the browser entry", () => {
  // the one module that is allowed to import node:fs and node:crypto, stated
  // separately from the allowlist test so that renaming it cannot quietly
  // disable the check that matters most
  const graph = [...browserGraph().keys()].map(shortName);
  expect(
    graph,
    "the node:fs reader must stay out of the browser bundle — see src/fs/reader.ts",
  ).not.toContain("src/fs/node-reader.ts");
});

test("the browser graph contains no dynamic import the static walk could miss", () => {
  const offenders = [...browserGraph()]
    .filter(([, text]) => DYNAMIC_RE.test(text))
    .map(([file]) => shortName(file));
  expect(
    offenders,
    `${offenders.join(", ")} uses import() — the walk above resolves static imports only, so a ` +
      `dynamic one would hide a node: builtin from it. Import statically, or teach the walk.`,
  ).toEqual([]);
});

test("the committed bundle contains no node:fs or node:crypto call site", () => {
  const text = readFileSync(bundle, "utf8");
  // the call sites `bun build --target browser` used to resolve to `(()=>({}))`
  const banned = ["existsSync", "realpathSync", "openSync", "closeSync", "createHash"];
  const present = banned.filter((name) => text.includes(name));
  expect(
    present,
    `docs/vendor/visimark-browser.js still contains ${present.join(", ")}. Something in ` +
      `src/playground/browser-entry.ts's import graph reached node:fs or node:crypto again; the ` +
      `source-walk test above names the file. Rebuild with ` +
      `'bun run --filter visimark build:playground' after fixing it.`,
  ).toEqual([]);
});

/**
 * The size of docs/vendor/visimark-browser.js the day this check was added
 * (2026-09-23), measured the same way the assertion below measures it —
 * statSync(...).size, matching `wc -c`, not a UTF-8 character count.
 *
 * Bump this only when the growth is real and reviewed. Record the date, the
 * new value, and why, directly above this constant — the way ALLOWED_BUILTINS
 * above records why node:path is the one builtin let through. A bump with no
 * reason is indistinguishable from a bundle nobody looked at.
 */
const BASELINE_BYTES = 299_700;

/** 10% over the baseline — a margin, not a byte-exact pin, so an unrelated
 * minifier version bump doesn't fail this check the way a byte-exact pin
 * would (the exact churn `playground-bundle` is pinned to Bun 1.4.2 to avoid). */
const MAX_BUNDLE_BYTES = Math.ceil(BASELINE_BYTES * 1.1); // 329,670

test("the committed bundle stays under a size ceiling with margin over the recorded baseline", () => {
  const actual = statSync(bundle).size;
  expect(
    actual,
    `docs/vendor/visimark-browser.js is ${actual} bytes, over the ${MAX_BUNDLE_BYTES}-byte ` +
      `ceiling (10% over the ${BASELINE_BYTES}-byte baseline recorded 2026-09-23). If this ` +
      `growth is real and reviewed, bump BASELINE_BYTES above with the date and reason and ` +
      `rebuild; if not, something new was pulled into src/playground/browser-entry.ts's ` +
      `import graph — the source-walk test above names the file.`,
  ).toBeLessThanOrEqual(MAX_BUNDLE_BYTES);
});
