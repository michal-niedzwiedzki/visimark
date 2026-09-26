import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * **Why this file exists.** `manifest.json`'s `minAppVersion` is a support
 * claim: every API the plugin calls must exist on that Obsidian version.
 * `package.json` pins `"obsidian": "^1.8.7"`, which today resolves to
 * `1.13.1` — a newer typings package than the floor, so `tsc` happily
 * type-checks a call to an API that shipped *after* `minAppVersion` and would
 * throw or return `undefined` on the oldest Obsidian the manifest promises to
 * support (2026-09-25 code review, row 20). Pinning the dependency to the
 * exact floor version was considered and rejected — a floor moves for a
 * reason (`869a819` raised it for `displayTooltip`), and pinning would just
 * trade this check for remembering to bump a version string. Instead, this
 * walks every symbol the plugin imports from `obsidian` back to its
 * declaration in the *installed* `obsidian.d.ts`, reads the `@since` tag the
 * package itself carries, and fails if any of them promises less than the
 * manifest claims.
 *
 * **This is static analysis, not a runtime check** — modelled on
 * `packages/visimark/test/browser/entry-graph.test.ts` (walk source, extract
 * import specifiers with a regex) and `test/bundle.test.ts` (source graph
 * built from `readdirSync(src)`, not from `main.ts` alone, so an unwired
 * module is still checked).
 *
 * **A symbol with no `@since` tag is not a failure.** Obsidian's typings only
 * started carrying the tag partway through the API's life; an untagged
 * symbol is assumed to predate versioning, exactly as
 * `docs/design/obsidian-plugin-spec.md` §2.2 argued for the whole surface
 * before `869a819` proved one case wrong. That assumption is also why this
 * test cannot simply assert "zero found `@since` tags exceed the floor" and
 * call it done: a bug in the walk or the lookup would silently find nothing
 * and pass. The second test below pins a known case — `displayTooltip`,
 * `@since 1.8.7`, the exact reason the floor was raised — so a regression in
 * the walk itself fails loudly instead of no-oping.
 */

const pluginRoot = join(import.meta.dir, "..");
const srcDir = join(pluginRoot, "src");
const typingsPath = join(pluginRoot, "node_modules", "obsidian", "obsidian.d.ts");

/** `import { A, B, type C } from "obsidian";` — spans multiple lines in this codebase (`main.ts`, `findings-view.ts`). */
const OBSIDIAN_IMPORT_RE = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*"obsidian";/gs;

/** every named import from `"obsidian"` across every `.ts` file directly under `src/` */
function importedObsidianSymbols(): Map<string, string[]> {
  const bySymbol = new Map<string, string[]>();
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const text = readFileSync(join(srcDir, file), "utf8");
    for (const m of text.matchAll(OBSIDIAN_IMPORT_RE)) {
      const clause = m[1]!;
      for (const rawSpecifier of clause.split(",")) {
        const specifier = rawSpecifier.trim();
        if (specifier === "") continue;
        // `type Foo`, `Foo`, or `Foo as Bar` (the plugin uses none of the
        // last today, but the declaration lookup needs the exported name,
        // not a local alias, if one ever appears)
        const withoutType = specifier.replace(/^type\s+/, "");
        const name = withoutType.split(/\s+as\s+/)[0]!.trim();
        const users = bySymbol.get(name) ?? [];
        users.push(file);
        bySymbol.set(name, users);
      }
    }
  }
  return bySymbol;
}

/**
 * `export [declare] [abstract] class|interface|function|const|type|enum NAME`
 * — every shape `obsidian.d.ts` uses for a top-level export. Declaration
 * merging and function overloads can produce more than one match; the first
 * is the one carrying the doc comment in every case this file has checked.
 */
function declarationRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    String.raw`^export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|function|const|type|enum)\s+${escaped}\b`,
    "m",
  );
}

/** the `@since` tag of the JSDoc comment immediately above a declaration, or `null` if there isn't one */
function sinceFor(typings: string, name: string): string | null {
  const match = declarationRegex(name).exec(typings);
  if (!match) return null;
  const before = typings.slice(0, match.index).trimEnd();
  if (!before.endsWith("*/")) return null;
  const commentStart = before.lastIndexOf("/**");
  if (commentStart === -1) return null;
  const comment = before.slice(commentStart);
  const since = /@since\s+(\S+)/.exec(comment);
  return since?.[1] ?? null;
}

/** `"1.8.7"` → `[1, 8, 7]`, padded so versions of different lengths still compare */
function parseVersion(version: string): number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

/** true when `a` names a later Obsidian release than `b` */
function exceeds(a: string, b: string): boolean {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const length = Math.max(av.length, bv.length);
  for (let i = 0; i < length; i++) {
    const an = av[i] ?? 0;
    const bn = bv[i] ?? 0;
    if (an !== bn) return an > bn;
  }
  return false;
}

const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8")) as {
  minAppVersion: string;
};
const typings = readFileSync(typingsPath, "utf8");

test("no symbol src/ imports from obsidian requires a later Obsidian than manifest.minAppVersion", () => {
  const symbols = importedObsidianSymbols();
  expect(
    symbols.size,
    "found no `obsidian` imports at all — the import walk is broken",
  ).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const [name, files] of symbols) {
    const since = sinceFor(typings, name);
    if (since === null) continue; // predates versioning, or the tag isn't attached to this declaration shape
    if (exceeds(since, manifest.minAppVersion)) {
      offenders.push(
        `${name} (@since ${since}, used by ${files.join(", ")}) exceeds minAppVersion ${manifest.minAppVersion}`,
      );
    }
  }
  expect(
    offenders,
    `${offenders.join("; ")} — raise manifest.json's minAppVersion to cover it, or stop using ` +
      `the symbol until the floor moves there on purpose.`,
  ).toEqual([]);
});

test("the walk actually resolves real @since tags, and displayTooltip is one of them", () => {
  // displayTooltip is exactly why the floor is 1.8.7 today (commit 869a819).
  // If this stops resolving, the test above would pass by finding nothing —
  // this pins the case that must never go quiet.
  const symbols = importedObsidianSymbols();
  expect(
    symbols.has("displayTooltip"),
    "src/main.ts should still import displayTooltip from obsidian",
  ).toBe(true);
  const since = sinceFor(typings, "displayTooltip");
  expect(since).toBe("1.8.7");
  expect(exceeds(since!, manifest.minAppVersion)).toBe(false);
});
