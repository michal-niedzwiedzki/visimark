import { expect, test } from "bun:test";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { EXTERNALS, options } from "../esbuild.config.mjs";

/**
 * **Why this file exists.** `main.js` is the whole plugin. Obsidian desktop is
 * Electron and has Node; **Obsidian mobile is not and does not**, and mobile is
 * the entire reason fork B is not a VS Code feature (#176). A `node:` specifier
 * that resolves on the desktop is a plugin that fails to load on a phone, and
 * it fails on the first line, for every note, before anything can report it.
 *
 * This is stricter than the playground's rule and deliberately so.
 * `packages/visimark/test/playground/browser-graph.test.ts` permits exactly one
 * builtin, `node:path`, because Bun's browser build of it works in a tab. That
 * permission does not transfer: there is no allowlist here, and the number is
 * zero.
 *
 * **Checked from both ends**, because each end goes blind on its own — the
 * same two-ended method as the playground guard. A source walk from
 * `src/main.ts` is exact about which file introduced an import but cannot see
 * what the bundler emitted; a scan of the shipped bytes sees what ships but
 * cannot say whose import put it there. Dynamic `import()` is banned outright
 * so the walk cannot be fooled.
 *
 * **It builds what ships.** The test imports `options` from
 * `esbuild.config.mjs` rather than restating them, and builds in memory. A
 * guard configured differently from the build it guards is a guard over
 * nothing, and it would also make this test depend on `bun run build` having
 * been run first — which is true in CI, where `build` precedes `test`, and
 * false on a fresh clone.
 */

const here = resolve(import.meta.dir, "..");
const engineSrc = resolve(here, "../../packages/visimark/src");

/** `import … from "x";` / `export … from "x";` / `import "x";`, oxfmt style */
const FROM_RE = /^(?:import|export)\b[^;]*?\bfrom\s*"([^"]+)";/gm;
const BARE_IMPORT_RE = /^import\s*"([^"]+)";/gm;
/** a dynamic import would be invisible to the walk below, so it is banned outright */
const DYNAMIC_RE = /\bimport\s*\(/;

function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(FROM_RE)) found.push(m[1]!);
  for (const m of text.matchAll(BARE_IMPORT_RE)) found.push(m[1]!);
  return found;
}

/**
 * Every `.ts` file the plugin bundles, plus every one it is *going* to —
 * the plugin's own source and the engine's, since `visimark` is an alias into
 * `packages/visimark/src/browser.ts` and not an external.
 *
 * **The roots are every file in `src/`, not just `main.ts`.** A module that
 * `main.ts` does not import yet is still a module written to be bundled, and
 * checking it only once a row wires it in means finding out about a `node:`
 * import at the moment someone is trying to ship a feature. `src/snapshot.ts`
 * was exactly that case: written for the rows that need a vault reader, not
 * reachable from `main.ts` until one of them lands.
 */
function graph(): Map<string, string> {
  const out = new Map<string, string>();
  const src = join(here, "src");
  const queue = readdirSync(src)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(src, f));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (out.has(file)) continue;
    const text = readFileSync(file, "utf8");
    out.set(file, text);
    for (const spec of specifiers(text)) {
      // the one bare specifier the bundle resolves. Three resolvers have to
      // agree on what it means — tsconfig.json's `paths` for tsc and
      // `bun test`, and esbuild.config.mjs's alias for the build — and this
      // walk is the fourth. All four name packages/visimark/src/browser.ts.
      if (spec === "visimark") {
        queue.push(join(engineSrc, "browser.ts"));
        continue;
      }
      if (!spec.startsWith(".")) continue;
      // the source is written in ESM style: `./x.js` names `./x.ts` on disk
      queue.push(resolve(dirname(file), spec).replace(/\.js$/, ".ts"));
    }
  }
  return out;
}

const shortName = (f: string) => relative(resolve(here, "../.."), f);

async function bundleText(): Promise<string> {
  const result = await build({ ...options, write: false, logLevel: "silent" });
  const file = result.outputFiles?.[0];
  expect(file, "esbuild produced no output file").toBeDefined();
  return new TextDecoder().decode(file!.contents);
}

test("no node: specifier survives into the shipped bytes", async () => {
  const text = await bundleText();
  const found = [...new Set([...text.matchAll(/["'`](node:[a-z_/]+)["'`]/g)].map((m) => m[1]!))];
  expect(
    found,
    `main.js contains ${found.join(", ")}. Obsidian mobile has no Node: a plugin that ` +
      `requires a builtin does not load there at all. Give the need a browser implementation ` +
      `and alias it in esbuild.config.mjs, as src/browser-path.ts does for node:path. ` +
      `There is no allowlist in this file on purpose.`,
  ).toEqual([]);
});

test("the only modules the bundle requires are the ones Obsidian provides", async () => {
  const text = await bundleText();
  const required = [...new Set([...text.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]!))];
  const unexpected = required.filter((m) => !EXTERNALS.includes(m));
  expect(
    unexpected,
    `main.js requires ${unexpected.join(", ")}, which Obsidian does not provide. Anything not ` +
      `in EXTERNALS has to be bundled, or it is a module resolution error at load time.`,
  ).toEqual([]);
});

test("the bundle reaches for no Node global", async () => {
  const text = await bundleText();
  // the class of failure `node:` alone would miss: a bundler polyfill or a
  // library feature-detecting its way onto a global that exists on the
  // desktop and not on a phone
  const globals = ["process.", "Buffer.", "__dirname", "__filename"];
  const present = globals.filter((g) => text.includes(g));
  expect(
    present,
    `main.js references ${present.join(", ")}. Electron has these and Obsidian mobile does not.`,
  ).toEqual([]);
});

test("node:path is the only builtin in the source graph, and it is aliased away", () => {
  const builtins = new Set<string>();
  const offenders: string[] = [];
  for (const [file, text] of graph()) {
    for (const spec of specifiers(text)) {
      if (!spec.startsWith("node:")) continue;
      builtins.add(spec);
      if (spec !== "node:path") offenders.push(`${shortName(file)} imports ${spec}`);
    }
  }
  expect(
    offenders,
    `${offenders.join("; ")} — only node:path may appear in the source graph, because it is ` +
      `the only one esbuild.config.mjs substitutes. Anything else reaches the bundle.`,
  ).toEqual([]);
  // and the substitution is actually configured, or the test above passes for
  // the wrong reason the day someone edits the alias out
  if (builtins.has("node:path")) {
    expect(
      options.alias["node:path"] ?? "",
      "the source graph imports node:path but esbuild.config.mjs no longer aliases it",
    ).toContain("browser-path");
  }
});

test("the plugin's bundled graph contains no dynamic import the static walk could miss", () => {
  const offenders = [...graph()]
    .filter(([, text]) => DYNAMIC_RE.test(text))
    .map(([file]) => shortName(file));
  expect(
    offenders,
    `${offenders.join(", ")} uses import() — the walk above resolves static imports only, so a ` +
      `dynamic one would hide a builtin from it. Import statically, or teach the walk.`,
  ).toEqual([]);
});

test("the walk actually reaches the engine, not just the plugin's own few files", () => {
  // a walk that silently stopped at the `visimark` specifier would pass every
  // test above while checking nothing that matters
  const files = [...graph().keys()].map(shortName);
  expect(files).toContain("packages/visimark/src/browser.ts");
  expect(files).toContain("packages/visimark/src/fs/gate.ts");
  expect(files.length).toBeGreaterThan(20);
});

test("every file in src/ is a walk root, so none can hide until a row wires it in", () => {
  const roots = readdirSync(join(here, "src")).filter((f) => f.endsWith(".ts"));
  const walked = [...graph().keys()].map(shortName);
  for (const root of roots) {
    expect(walked, `${root} is in src/ but not in the guarded graph`).toContain(
      `editors/obsidian/src/${root}`,
    );
  }
});

/**
 * The size of `main.js` the day this plugin was first built (2026-09-23),
 * measured as `wc -c` measures it, with the build in `esbuild.config.mjs`
 * (minified, engine bundled, Obsidian and CodeMirror external).
 *
 * The same discipline as `BASELINE_BYTES` in the playground guard, and its own
 * number as `docs/design/obsidian-plugin-spec.md` §2.2 requires: a plugin
 * ships one `main.js` and the community registry's reviewers read its size.
 * Bump this only when the growth is real and reviewed, and record the date,
 * the new value and why directly above.
 */
const BASELINE_BYTES = 270_440;

/*
 * 2026-09-24, 267,817 → 270,440 (+2,623). v1 row 2: both renderers. Small
 * because CodeMirror is external — Obsidian provides it — so what enters the
 * bundle is the decoration model and two adapters, not an editor.
 */

/* 2026-09-24, 266,316 → 267,817 (+1,501). v1 row 12: the status bar's states
 * and the ribbon icon. */

/* 2026-09-24, 265,875 → 266,316 (+441). v1 row 11: copy the values as JSON. */

/*
 * 2026-09-24, 262,083 → 265,875 (+3,792). v1 row 4: the five commands, and
 * the two dialogs Explain and Evaluate answer in. Small for the same reason
 * row 9 was — the work was already here, and the row is the way in.
 */

/*
 * 2026-09-24, 260,667 → 262,083 (+1,416). v1 row 9: the public plugin API.
 * Small because it is a facade — `check`, `evalValues` and `dependencies` were
 * already in the bundle, and the row is the surface rather than the work.
 * That smallness is itself the architectural claim #176 wanted tested.
 */

/*
 * 2026-09-23, 243,239 → 260,667 (+17,428). v1 row 5: Infer and its preview.
 * `infer/propose.ts` and `infer/write.ts` are a substantial part of the engine
 * and nothing had reached them before — the findings view calls `check` and
 * `planFmt`, which do not.
 */

/*
 * 2026-09-23, 238,664 → 243,239 (+4,575). v1 row 8: the vault sweep and its
 * pane. Small, as expected — the sweep reuses `check`, `planFmt` and the
 * report model that row 6 already brought in, and adds a loop and some DOM.
 */

/*
 * 2026-09-23, 161,078 → 238,664 (+77,586, +48%). v1 row 6: the findings view
 * is the first surface that calls `check` and `planFmt`, so the evaluator, the
 * writer and decimal.js enter the bundle. Row 1 reached only `locate`.
 *
 * This is the step change, not a trend: every later row uses the same three
 * entry points. A growth of this size again means something new was pulled in,
 * and the walk above names the file.
 *
 * #211 records 168,543 for the same constant, from the four templates. The two
 * are independent and both real; whichever lands second re-measures and says
 * so here. That is the mechanism working, not a conflict to avoid.
 */

/** 10% over the baseline — a margin, not a byte-exact pin, so an unrelated
 * esbuild version bump does not fail this for a reason unrelated to the
 * change under review. */
const MAX_BUNDLE_BYTES = Math.ceil(BASELINE_BYTES * 1.1);

test("the bundle stays under a size ceiling with margin over the recorded baseline", async () => {
  const actual = (await bundleText()).length;
  expect(
    actual,
    `main.js is ${actual} bytes, over the ${MAX_BUNDLE_BYTES}-byte ceiling (10% over the ` +
      `${BASELINE_BYTES}-byte baseline recorded 2026-09-23). If the growth is real and ` +
      `reviewed, bump BASELINE_BYTES above with the date and reason; if not, something new was ` +
      `pulled into src/main.ts's import graph — the walk above names the files.`,
  ).toBeLessThanOrEqual(MAX_BUNDLE_BYTES);
});

test("tsconfig and esbuild resolve the engine specifier to the same file", () => {
  // the failure this catches is silent and nasty: the plugin typechecks and
  // tests against one engine surface and ships another. tsconfig.json's
  // `paths` is what tsc and `bun test` follow; `alias` is what the build
  // follows; they are two files and nothing but this ties them together.
  const tsconfig = readFileSync(join(here, "tsconfig.json"), "utf8");
  const declared = /"visimark":\s*\[\s*"([^"]+)"/.exec(tsconfig)?.[1];
  expect(declared, "tsconfig.json no longer maps the visimark specifier").toBeDefined();
  expect(
    resolve(here, declared!),
    "tsconfig.json's paths and esbuild.config.mjs's alias name different files",
  ).toBe(resolve(options.alias["visimark"] ?? ""));
});
