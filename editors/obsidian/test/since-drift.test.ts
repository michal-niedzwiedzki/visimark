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
 *
 * **A top-level import isn't the only way to reach a versioned API.**
 * `this.app.isDarkMode()` never imports anything — `App`'s own `@since` is
 * `0.9.7`, but `isDarkMode` on it is `@since 1.10.0`. The plugin reaches
 * `App`'s surface only through `this.app.<member>(...)` (a method on `App`
 * itself) and `this.app.<prop>.<member>(...)` (one property deep — today
 * that's `workspace`, `vault`, `metadataCache` and `fileManager`), so the
 * third test below walks those two call shapes, resolves each member against
 * its declaring class body, and applies the same floor check.
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

/** the body of `export class|interface NAME { ... }`, brace-matched so nested braces don't cut it short */
function typeBody(typings: string, name: string): string | null {
  const re = new RegExp(
    String.raw`^export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface)\s+${name}\b[^{]*\{`,
    "m",
  );
  const match = re.exec(typings);
  if (!match) return null;
  let depth = 1;
  let i = match.index + match[0].length;
  while (i < typings.length && depth > 0) {
    if (typings[i] === "{") depth++;
    else if (typings[i] === "}") depth--;
    i++;
  }
  return typings.slice(match.index + match[0].length, i - 1);
}

/** the `@since` tag of a member (method or property) declared directly in a class/interface body */
function sinceForMember(body: string, member: string): string | null {
  const match = new RegExp(String.raw`^\s*${member}\s*[(:]`, "m").exec(body);
  if (!match) return null;
  const before = body.slice(0, match.index).trimEnd();
  if (!before.endsWith("*/")) return null;
  const commentStart = before.lastIndexOf("/**");
  if (commentStart === -1) return null;
  const since = /@since\s+(\S+)/.exec(before.slice(commentStart));
  return since?.[1] ?? null;
}

/** the declared type name of a non-method property in a class/interface body, e.g. `workspace: Workspace` */
function propertyType(body: string, prop: string): string | null {
  const match = new RegExp(String.raw`^\s*${prop}\s*:\s*([A-Za-z_$][\w$]*)`, "m").exec(body);
  return match?.[1] ?? null;
}

/**
 * every `this.app.<member>(...)` and `this.app.<prop>.<member>(...)` call in
 * `src/`, as `{ path: ["workspace", "getMostRecentLeaf"] }` (one entry) or
 * `{ path: ["isDarkMode"] }` (direct `App` member) plus the file it's in.
 */
function appMemberCalls(): Array<{ path: string[]; file: string }> {
  const calls: Array<{ path: string[]; file: string }> = [];
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
  // `this.app.workspace.on(` — a call one property deep from `app`. Requires
  // `(` right after the second identifier, so it never matches a bare
  // `this.app.<method>(` (nothing between `app` and the paren there).
  const twoDeep = /this\.app\.(\w+)\.(\w+)\s*\(/g;
  // `this.app.isDarkMode(` — a method directly on `App`. Requires `(` right
  // after the identifier, so `this.app.workspace.on(` never matches this one
  // (the character after `workspace` is `.`, not `(`).
  const oneDeep = /this\.app\.(\w+)\s*\(/g;
  for (const file of files) {
    const text = readFileSync(join(srcDir, file), "utf8");
    for (const m of text.matchAll(twoDeep)) calls.push({ path: [m[1]!, m[2]!], file });
    for (const m of text.matchAll(oneDeep)) calls.push({ path: [m[1]!], file });
  }
  return calls;
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

test("no this.app member call reached from src/ requires a later Obsidian than manifest.minAppVersion", () => {
  const calls = appMemberCalls();
  expect(
    calls.length,
    "found no `this.app.*(` calls at all — the member-call walk is broken",
  ).toBeGreaterThan(0);

  const appBody = typeBody(typings, "App");
  if (appBody === null)
    throw new Error("could not find App's declaration in the installed obsidian.d.ts");

  const offenders: string[] = [];
  for (const { path, file } of calls) {
    let since: string | null;
    let label: string;
    if (path.length === 1) {
      since = sinceForMember(appBody, path[0]!);
      label = `App#${path[0]}`;
    } else {
      const [propName, methodName] = path as [string, string];
      const propType = propertyType(appBody, propName);
      if (propType === null) continue; // not a property this walk knows App declares
      // the property itself can be newer than the method it exposes — a
      // future `App#secretStorage` could carry `@since 2.0.0` even if
      // `secretStorage.get` inherited an older tag from its own type
      const propSince = sinceForMember(appBody, propName);
      if (propSince !== null && exceeds(propSince, manifest.minAppVersion)) {
        offenders.push(
          `App#${propName} (@since ${propSince}, used by ${file}) exceeds minAppVersion ${manifest.minAppVersion}`,
        );
      }
      const propBody = typeBody(typings, propType);
      if (propBody === null) continue; // couldn't find that type's own declaration
      since = sinceForMember(propBody, methodName);
      label = `${propType}#${methodName}`;
    }
    if (since === null) continue; // predates versioning, or the tag isn't attached to this declaration shape
    if (exceeds(since, manifest.minAppVersion)) {
      offenders.push(
        `${label} (@since ${since}, used by ${file}) exceeds minAppVersion ${manifest.minAppVersion}`,
      );
    }
  }
  expect(
    offenders,
    `${offenders.join("; ")} — raise manifest.json's minAppVersion to cover it, or stop calling ` +
      `the member until the floor moves there on purpose.`,
  ).toEqual([]);
});

test("the member-call walk actually resolves a real @since tag on a known offender", () => {
  // isDarkMode is not called by the plugin today, but it's the exact shape
  // this walk exists to catch: App itself is @since 0.9.7, isDarkMode on it
  // is @since 1.10.0. Pinning it here (independent of src/'s current calls)
  // proves the App-body lookup and comment-scoping actually work, the same
  // way the displayTooltip test below pins the import walk.
  const appBody = typeBody(typings, "App");
  if (appBody === null)
    throw new Error("could not find App's declaration in the installed obsidian.d.ts");
  expect(sinceForMember(appBody, "isDarkMode")).toBe("1.10.0");

  const workspaceBody = typeBody(typings, propertyType(appBody, "workspace")!);
  if (workspaceBody === null)
    throw new Error("could not find Workspace's declaration in the installed obsidian.d.ts");
  expect(sinceForMember(workspaceBody, "getMostRecentLeaf")).not.toBeNull();

  // the property declaration itself, independent of any method on the type
  // it names — proves the offender loop's own `App#${propName}` check (not
  // just the method it exposes) actually resolves something real
  expect(sinceForMember(appBody, "workspace")).toBe("0.9.7");
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
