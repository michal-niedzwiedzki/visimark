# Obsidian plugin on the core release line — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Obsidian plugin on the core release number. `check-versions.ts` holds the plugin's `manifest.json` and newest `versions.json` key to the engine's version. `prepare-release.ts` bumps the plugin with core. The PR lands as the 0.4.0 release commit.

**Architecture:** The plugin stays out of `RELEASE_MANIFESTS`, because it is not a `package.json` and has no `bun.lock` block. Instead, `release-manifests.ts` exports two path constants. `check-versions.ts` adds two `expectEngine` calls, and `prepare-release.ts` adds plugin edits to its all-or-nothing `pending` map. `check-obsidian-engine-line.ts` is deleted. `docs/releasing.md` becomes the one place that states the versioning policy, and every other file links to its `#versioning` section. The last commit is `chore: release v0.4.0`, made with the new `prepare-release.ts`.

**Tech Stack:** Bun scripts (TypeScript run directly with `bun`), `bun:test`, GitHub Actions YAML, Markdown. oxlint and oxfmt. No new dependencies.

**Spec:** [`obsidian-plugin-on-core-release-line-spec.md`](obsidian-plugin-on-core-release-line-spec.md). Read it before starting. Its §3 and §4 hold the literal annotation strings and sessions this plan tests.

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer for **this** session, from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md). Do not copy a trailer from this plan or an old commit. The Git author stays the maintainer's configured identity.
- Exit codes stay `0` clean, `1` findings or refusal, `2` usage. Annotations go to stdout as `::error file=<file>::<message>`.
- Reuse `expectEngine`'s existing sentence for both new comparisons. Do not add a second drift wording.
- New `prepare-release.ts` refusals use exactly the wording in spec §3:
  - `${version} is not newer than the Obsidian plugin's current version ${plugin}.`
  - `${file} differs from editors/obsidian/${file}. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.`
  - `editors/obsidian/versions.json already has a "${version}" key.`
  - `editors/obsidian/manifest.json: cannot find "minAppVersion". The layout moved; fix scripts/prepare-release.ts.`
- The plugin changelog placeholder line is exactly `No plugin changes. Bundles engine ${version}.`
- `prepare-release.ts` stays all-or-nothing: every new edit goes through `edit()` or `pending`, and every refusal happens before `writeFileSync`.
- No new runtime or dev dependency, and no new public export from a published package. `scripts/` is not published.
- `docs/releasing.md#versioning` is the one statement of the policy. Everywhere else links to it ([`dependencies-and-pins.md`](../../.agents/rules/dependencies-and-pins.md), "State each fact in one place").
- Never link to a gitignored path. `bun scripts/check-links.ts` must pass.
- Every Markdown file this plan creates or edits passes `bun run packages/visimark/src/cli/main.ts check <file>`. A file with no formulas ends with `<!--vmark:no-formulas-->`.
- Do not tag, and do not merge the PR. Tagging and merging belong to the maintainer (`docs/releasing.md`, "Release order").
- **Between Task 5 and Task 6 the suite is red, on purpose.** After Task 5, `check-versions` "passes on the real repository" fails, because the real tree is still core 0.2.0 against plugin 0.3.0. Task 6 (the release commit) turns it green. Do not push between the two tasks, and do not weaken that test to get past it.

## Review Focus

1. **The real tree's plugin state at the time a test runs.** Before Task 6, plugin is 0.3.0 and core is 0.2.0. After it, both are 0.4.0. Every temp-tree test must set the plugin files itself, so its result does not depend on which side of the release commit it runs. Pinned in Task 1's and Task 5's fixtures.
2. **A plugin changelog `## Unreleased` holding only whitespace.** A reasonable person expects that to count as empty, which gives the placeholder and never an empty dated section, since `changelog-section.ts` refuses an empty section. Pinned in Task 1.
3. **A plugin changelog with no `## Unreleased` at all.** The placeholder entry goes above the newest dated heading, and no `## Unreleased` is invented. Pinned in Task 1.
4. **`versions.json` that is `{}` or has lost its layout.** `check-versions` reports a layout-moved annotation, never a crash and never a pass. `prepare-release` refuses and writes nothing. Pinned in Task 1 and Task 5.
5. **A root copy that drifted before the run.** `prepare-release` refuses and does not repair the drift silently. Pinned in Task 1.

---

### Task 1: `prepare-release.ts` bumps the plugin

**Files:**
- Modify: `scripts/release-manifests.ts` (exports, header comment)
- Modify: `scripts/prepare-release.ts` (header comment, plugin refusals and edits, closing message)
- Test: `scripts/prepare-release.test.ts`

**Interfaces:**
- Produces, in `scripts/release-manifests.ts`:
  ```ts
  /** The Obsidian plugin's manifest; its version is the release's (docs/releasing.md#versioning). */
  export const OBSIDIAN_MANIFEST = "editors/obsidian/manifest.json";
  /** Plugin version -> minAppVersion; the newest key is the release's version. */
  export const OBSIDIAN_VERSIONS = "editors/obsidian/versions.json";
  ```
  Task 5 consumes both.

- [ ] **Step 1: Add the two constants and rewrite the header of `scripts/release-manifests.ts`**

Replace the header's last sentence ("The Obsidian plugin is not here: its version is its own (docs/releasing.md, "Release order").") with:

```ts
 * The Obsidian plugin carries the same version (docs/releasing.md#versioning)
 * but is not in RELEASE_MANIFESTS: it is no package.json and has no bun.lock
 * block. Its two files are named below, and both scripts handle them apart.
```

Add `OBSIDIAN_MANIFEST` and `OBSIDIAN_VERSIONS` (above) right after `ENGINE_MANIFEST`.

- [ ] **Step 2: Make the test tree start in lockstep and carry the plugin files**

In `scripts/prepare-release.test.ts`:

```ts
import { OBSIDIAN_MANIFEST, OBSIDIAN_VERSIONS } from "./release-manifests.ts";
```

Append the five plugin files to `FILES`:

```ts
  OBSIDIAN_MANIFEST,
  OBSIDIAN_VERSIONS,
  "manifest.json",
  "versions.json",
  "editors/obsidian/CHANGELOG.md",
```

Give `tree()` a third parameter, `pluginUnreleased = ""`. At the end of `tree()`, before `return root`, add:

```ts
  // The plugin starts in lockstep with the engine, which check-versions
  // requires. The real tree may not be there yet: until v0.4.0 it is plugin
  // 0.3.0 against engine 0.2.0. Pin it, so no test depends on which side of
  // that release it runs on.
  const engine = current();
  const manifest = JSON.parse(read(root, OBSIDIAN_MANIFEST));
  const manifestText = read(root, OBSIDIAN_MANIFEST).replace(
    /^(\s*"version": ")[^"]+(",?)$/m,
    `$1${engine}$2`,
  );
  const versionsText =
    JSON.stringify(
      { ...JSON.parse(read(root, OBSIDIAN_VERSIONS)), [engine]: manifest.minAppVersion },
      null,
      2,
    ) + "\n";
  for (const [a, b, text] of [
    [OBSIDIAN_MANIFEST, "manifest.json", manifestText],
    [OBSIDIAN_VERSIONS, "versions.json", versionsText],
  ] as const) {
    writeFileSync(join(root, a), text);
    writeFileSync(join(root, b), text);
  }
  const plugin = read(root, "editors/obsidian/CHANGELOG.md").replace(
    /^## Unreleased[ \t]*\n[\s\S]*?(?=^## )/m,
    pluginUnreleased === "" ? "## Unreleased\n\n" : `## Unreleased\n\n${pluginUnreleased}\n`,
  );
  writeFileSync(join(root, "editors/obsidian/CHANGELOG.md"), plugin);
```

`current()` is defined after `tree()` in the file. Move the `read` and `current` helpers above `tree()` so they exist when it runs. They are `const` arrow functions, so the order matters.

- [ ] **Step 3: Write the failing tests**

Add this block inside `describe("prepare-release", …)`, after "turns the changelogs over":

```ts
  describe("the Obsidian plugin", () => {
    const min = (root: string): string => JSON.parse(read(root, OBSIDIAN_MANIFEST)).minAppVersion;

    test("bumps both manifests to the new version, byte-equal", () => {
      const root = tree();
      expect(runAt(root, next).code).toBe(0);
      expect(JSON.parse(read(root, OBSIDIAN_MANIFEST)).version).toBe(next);
      expect(read(root, "manifest.json")).toBe(read(root, OBSIDIAN_MANIFEST));
    });

    test("appends the new version to versions.json as its last key, in both copies", () => {
      const root = tree();
      expect(runAt(root, next).code).toBe(0);
      const versions = read(root, OBSIDIAN_VERSIONS);
      expect(versions.endsWith(`,\n  "${next}": "${min(root)}"\n}\n`)).toBe(true);
      expect(Object.keys(JSON.parse(versions)).at(-1)).toBe(next);
      expect(read(root, "versions.json")).toBe(versions);
    });

    test("an empty Unreleased gets the placeholder entry and stays", () => {
      const root = tree();
      runAt(root, next, "--date", "2030-01-02");
      expect(read(root, "editors/obsidian/CHANGELOG.md")).toContain(
        `## Unreleased\n\n## ${next} - 2030-01-02\n\nNo plugin changes. Bundles engine ${next}.\n\n## `,
      );
    });

    test("a whitespace-only Unreleased counts as empty", () => {
      const root = tree(undefined, undefined, "   \n\n");
      runAt(root, next, "--date", "2030-01-02");
      expect(read(root, "editors/obsidian/CHANGELOG.md")).toContain(
        `## ${next} - 2030-01-02\n\nNo plugin changes. Bundles engine ${next}.`,
      );
    });

    test("with no Unreleased, the placeholder goes above the newest entry and none is invented", () => {
      const root = tree();
      const file = join(root, "editors/obsidian/CHANGELOG.md");
      writeFileSync(file, read(root, "editors/obsidian/CHANGELOG.md").replace(/^## Unreleased\n+/m, ""));
      expect(runAt(root, next, "--date", "2030-01-02").code).toBe(0);
      const text = read(root, "editors/obsidian/CHANGELOG.md");
      expect(text).not.toContain("## Unreleased");
      expect(text).toMatch(
        new RegExp(`^## ${next.replace(/\./g, "\\.")} - 2030-01-02\\n\\nNo plugin changes\\. Bundles engine `, "m"),
      );
    });

    test("an Unreleased with content is dated, reopened above, and gets no placeholder", () => {
      const root = tree(undefined, undefined, "- Something.\n");
      runAt(root, next, "--date", "2030-01-02");
      const text = read(root, "editors/obsidian/CHANGELOG.md");
      expect(text).toContain(`## Unreleased\n\n## ${next} - 2030-01-02\n\n- Something.\n`);
      expect(text).not.toContain(`No plugin changes. Bundles engine ${next}.`);
    });

    test("refuses a version that is not newer than the plugin's, writing nothing", () => {
      // spec §4 session 4: the plugin sits where MINOR would land
      const root = tree("### Added\n\n- Something new.\n");
      const ahead = minorOf(current());
      for (const f of [OBSIDIAN_MANIFEST, "manifest.json"]) {
        writeFileSync(
          join(root, f),
          read(root, f).replace(/^(\s*"version": ")[^"]+/m, `$1${ahead}`),
        );
      }
      const before = snapshot(root);
      const r = runAt(root, "MINOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain(
        `::error file=${OBSIDIAN_MANIFEST}::${ahead} is not newer than the Obsidian plugin's current version ${ahead}.`,
      );
      expect(snapshot(root)).toEqual(before);
    });

    test("an explicit version past the plugin's is accepted, in 19 files", () => {
      // spec §4 session 5: the one-time skip
      const root = tree("### Added\n\n- Something new.\n");
      const ahead = minorOf(current());
      for (const f of [OBSIDIAN_MANIFEST, "manifest.json"]) {
        writeFileSync(
          join(root, f),
          read(root, f).replace(/^(\s*"version": ")[^"]+/m, `$1${ahead}`),
        );
      }
      const skip = minorOf(ahead);
      const r = runAt(root, skip, "--date", "2030-01-02");
      expect(r.code).toBe(0);
      expect(r.out).toContain(`Prepared ${current()} -> ${skip} (2030-01-02, MINOR) in 19 files.`);
      expect(r.out).toContain(`commit as "chore: release v${skip}".`);
      expect(r.out).not.toContain("The Obsidian plugin is not touched.");
    });

    for (const file of ["manifest.json", "versions.json"]) {
      test(`refuses when the root ${file} has drifted, writing nothing`, () => {
        const root = tree();
        writeFileSync(join(root, file), read(root, file) + " ");
        const before = snapshot(root);
        const r = runAt(root, next);
        expect(r.code).toBe(1);
        expect(r.out).toContain(
          `::error file=${file}::${file} differs from editors/obsidian/${file}. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.`,
        );
        expect(snapshot(root)).toEqual(before);
      });
    }

    test("refuses when versions.json already has the new key, writing nothing", () => {
      const root = tree();
      const v = JSON.stringify({ ...JSON.parse(read(root, OBSIDIAN_VERSIONS)), [next]: "1.8.7" }, null, 2) + "\n";
      writeFileSync(join(root, OBSIDIAN_VERSIONS), v);
      writeFileSync(join(root, "versions.json"), v);
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain(`::error file=${OBSIDIAN_VERSIONS}::${OBSIDIAN_VERSIONS} already has a "${next}" key.`);
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses when minAppVersion is missing, writing nothing", () => {
      const root = tree();
      const m = read(root, OBSIDIAN_MANIFEST).replace(/^\s*"minAppVersion": "[^"]*",?\n/m, "");
      writeFileSync(join(root, OBSIDIAN_MANIFEST), m);
      writeFileSync(join(root, "manifest.json"), m);
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain('cannot find "minAppVersion"');
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses a versions.json with no entry to append after, writing nothing", () => {
      const root = tree();
      writeFileSync(join(root, OBSIDIAN_VERSIONS), "{}\n");
      writeFileSync(join(root, "versions.json"), "{}\n");
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain(OBSIDIAN_VERSIONS);
      expect(snapshot(root)).toEqual(before);
    });

    test("leaves a tree every release check passes on", () => {
      // spec §4 session 9
      const root = tree();
      expect(runAt(root, next, "--date", "2030-01-02").code).toBe(0);
      for (const check of ["check-versions.ts", "check-changelog-entries.ts", "check-obsidian-root-mirror.ts"]) {
        const r = Bun.spawnSync(["bun", join(import.meta.dir, check), root]);
        expect({ check, code: r.exitCode }).toEqual({ check, code: 0 });
      }
    });
  });
```

The last test runs `check-versions.ts` before Task 5 has taught it the plugin. It passes either way, and it starts to mean something once Task 5 lands.

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `bun test scripts/prepare-release.test.ts`
Expected: the new "the Obsidian plugin" tests FAIL. The plugin files are untouched, the refusals do not exist, and the message still says the plugin is not touched. The existing tests still PASS, because `tree()` now pins the plugin to the engine's version.

- [ ] **Step 5: Implement it in `scripts/prepare-release.ts`**

Header: replace "It does not touch the Obsidian plugin, whose version is its own." with:

```ts
 * The Obsidian plugin carries the same version (docs/releasing.md#versioning):
 * both manifest.json copies, a new versions.json key in both copies, and its
 * changelog move with the core files.
```

Import `OBSIDIAN_MANIFEST` and `OBSIDIAN_VERSIONS` from `./release-manifests.ts`.

Right after the `bump not earned` refusal block (the `if (rank[level] > rank[ceiling]) { … }`), before any `edit(…)` call, add:

```ts
// The Obsidian plugin carries the release's version (docs/releasing.md#versioning).
// Everything it needs is checked here, before the first edit, so a refusal
// still writes nothing.
const pluginManifest = JSON.parse(read(OBSIDIAN_MANIFEST)) as Record<string, unknown>;
const pluginVersion = pluginManifest.version;
if (typeof pluginVersion !== "string" || !isSemver(pluginVersion)) {
  refuse(
    OBSIDIAN_MANIFEST,
    `${OBSIDIAN_MANIFEST}: cannot find a top-level "version". The layout moved; fix scripts/prepare-release.ts.`,
  );
}
// Lockstep makes this the same test as the core one above, except once: the
// plugin tag 0.3.0 predates the shared line, so MINOR from 0.2.0 must not land on it.
if (cmp(version, pluginVersion as string) <= 0) {
  refuse(
    OBSIDIAN_MANIFEST,
    `${version} is not newer than the Obsidian plugin's current version ${pluginVersion}.`,
  );
}
const minApp = pluginManifest.minAppVersion;
if (typeof minApp !== "string" || minApp === "") {
  refuse(
    OBSIDIAN_MANIFEST,
    `${OBSIDIAN_MANIFEST}: cannot find "minAppVersion". The layout moved; fix scripts/prepare-release.ts.`,
  );
}
// The registry reads the root copies; check-obsidian-root-mirror.ts keeps them
// byte-equal. Refuse a drifted pair rather than repair it without a word.
for (const file of ["manifest.json", "versions.json"]) {
  if (read(file) !== read(`editors/obsidian/${file}`)) {
    refuse(
      file,
      `${file} differs from editors/obsidian/${file}. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.`,
    );
  }
}
if (Object.hasOwn(JSON.parse(read(OBSIDIAN_VERSIONS)), version)) {
  refuse(OBSIDIAN_VERSIONS, `${OBSIDIAN_VERSIONS} already has a "${version}" key.`);
}
```

`refuse` returns `never`, so TypeScript narrows after each guard. Keep the `as string` only where narrowing does not reach.

After the vscode changelog block, before the `for (const [file, text] of pending) writeFileSync(…)` loop, add:

```ts
// The Obsidian plugin: its manifest, a versions.json key, the root copies
// (same bytes), and its changelog.
edit(OBSIDIAN_MANIFEST, /^(\s*"version": ")[^"]+(",?)$/m, `$1${version}$2`, 'a top-level "version"');
edit(
  OBSIDIAN_VERSIONS,
  /("[^"\n]*": "[^"\n]*")(\n\}\s*)$/,
  `$1,\n  "${version}": "${minApp}"$2`,
  "a last entry to append after",
);
pending.set("manifest.json", pending.get(OBSIDIAN_MANIFEST)!);
pending.set("versions.json", pending.get(OBSIDIAN_VERSIONS)!);

// Its changelog keeps an Unreleased heading. With content, that becomes the
// release and a fresh one opens above it. Empty (or absent), the release gets
// the placeholder, as the extension's does.
const obsidianChangelog = "editors/obsidian/CHANGELOG.md";
const pluginUnreleased = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
  read(obsidianChangelog),
);
if (pluginUnreleased !== null && pluginUnreleased[1]!.trim() !== "") {
  edit(
    obsidianChangelog,
    /^## Unreleased[ \t]*$/m,
    `## Unreleased\n\n## ${version} - ${date}`,
    '"## Unreleased"',
  );
} else {
  edit(
    obsidianChangelog,
    /^(?=## \d+\.\d+\.\d+ - )/m,
    `## ${version} - ${date}\n\nNo plugin changes. Bundles engine ${version}.\n\n`,
    "an existing release heading",
  );
}
```

Replace the five closing `console.log` lines with:

```ts
console.log(`Prepared ${current} -> ${version} (${date}, ${level}) in ${pending.size} files.`);
console.log(`Now: read the diff, and rewrite the placeholder line in ${vscodeChangelog}`);
console.log(`or ${obsidianChangelog} if that editor has user-visible changes`);
console.log('(docs/releasing.md, "Preparing the changelog"). Fill the Shipped-register');
console.log(`Released cells (step 5), run the pre-push checks, then commit as "chore: release v${version}".`);
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `bun test scripts/prepare-release.test.ts`
Expected: PASS, every test.

- [ ] **Step 7: Lint, format, typecheck**

Run: `bun run format && bun run lint && bun run typecheck`
Expected: no diagnostics.

- [ ] **Step 8: Commit**

```bash
git add scripts/release-manifests.ts scripts/prepare-release.ts scripts/prepare-release.test.ts
git commit -m "feat(release): prepare-release bumps the Obsidian plugin with core (#396)" -m "<trailer from .agents/rules/ai-attribution.md>"
```

---

### Task 2: the plugin changelog hint follows the extension's

**Files:**
- Modify: `scripts/check-changelog-entries.ts` (the Obsidian pair's comment and hint)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. The pair, its exit codes and its annotation shape are unchanged.

- [ ] **Step 1: Replace the comment and the hint**

Replace the eight-line comment above the Obsidian pair ("The Obsidian plugin's version is deliberately its own …") with:

```ts
  // The Obsidian plugin carries the release's version (docs/releasing.md#versioning)
  // and, like the extension, gets an entry every release. It is read from
  // manifest.json, because the workspace package.json carries no version.
```

Replace its `hint` with:

```ts
    hint: (v) => `Add an entry, even "No plugin changes. Bundles engine ${v}."`,
```

- [ ] **Step 2: Run the check**

Run: `bun scripts/check-changelog-entries.ts; echo exit:$?`
Expected: `changelog entries: CHANGELOG.md 0.2.0, editors/vscode/CHANGELOG.md 0.2.0, editors/obsidian/CHANGELOG.md 0.3.0` and `exit:0`. The real tree is unchanged.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-changelog-entries.ts
git commit -m "chore(release): plugin changelog hint names the placeholder entry (#396)" -m "<trailer>"
```

---

### Task 3: delete the engine-line check

**Files:**
- Delete: `scripts/check-obsidian-engine-line.ts`
- Modify: `scripts/release-checks.test.ts` (delete `describe("check-obsidian-engine-line", …)`, including its closing comment)
- Modify: `.github/workflows/obsidian-release.yml` (delete the step and its comment)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Spec §4 session 10: the script does not exist and no workflow runs it.

- [ ] **Step 1: Delete the script and its tests**

```bash
git rm scripts/check-obsidian-engine-line.ts
```

In `scripts/release-checks.test.ts`, delete the whole `describe("check-obsidian-engine-line", () => { … });` block, from its `describe` line through its closing `});`, along with the "No 'passes on the real repository' case" comment inside it. `json` is still used by `check-mcp-name`. Keep it.

- [ ] **Step 2: Delete the workflow step**

In `.github/workflows/obsidian-release.yml`, delete these lines in full:

```yaml
      # Not in ci.yml: a core-only bump would turn every PR red until the
      # plugin was re-released. Here it asks the one question that matters, at
      # the one commit that is about to ship — does the "Bundles engine X."
      # line tell the truth about what main.js carries.
      - name: Verify the changelog names the bundled engine
        run: bun scripts/check-obsidian-engine-line.ts
```

Leave every other step as it is, including "Verify the tag matches manifest.json".

- [ ] **Step 3: Confirm nothing else references it**

Run: `git grep -n "check-obsidian-engine-line" -- . ':!docs/reviews' ':!docs/design/obsidian-plugin-on-core-release-line-*'`
Expected: only `docs/releasing.md` lines, which Task 4 rewrites. No script, test or workflow.

- [ ] **Step 4: Run the release checks and the workflow audit**

Run: `bun test scripts/release-checks.test.ts`
Expected: PASS.
Run: `bun scripts/check-bun-policy.ts && bun scripts/check-workflow-downloads.ts`
Expected: exit 0 for both.

- [ ] **Step 5: Commit**

```bash
git add -A scripts/release-checks.test.ts scripts/check-obsidian-engine-line.ts .github/workflows/obsidian-release.yml
git commit -m "chore(release): drop check-obsidian-engine-line; the version says it (#396)" -m "<trailer>"
```

---

### Task 4: documentation

**Files:**
- Modify: `docs/releasing.md`
- Modify: `docs/design/obsidian-plugin-spec.md` (§2.2 amendment only)
- Modify: `editors/obsidian/CHANGELOG.md` (header paragraph only)
- Modify: `editors/obsidian/README.md` ("Installing it" example tag, "Versioning")
- Modify: `CONTRIBUTING.md` (lines 149–152, 321–327)
- Modify: `.agents/rules/dependencies-and-pins.md` (one pin-table row)
- Modify: `scripts/check-versions.ts` header comment
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Changed`)
- Modify: `docs/vocabulary-catalogue.md` (move the #396 row into Shipped)

**Interfaces:**
- Produces: the anchor `docs/releasing.md#versioning` (heading `## Versioning`). Steps 2–7 link it.

- [ ] **Step 1: `docs/releasing.md`**

1. Add a new section, `## Versioning`, directly above `## Release order`:

   ```markdown
   ## Versioning

   Every artifact one release ships carries that release's version: the six
   npm packages, the VS Code extension, `visimark-lsp` (bundled into the
   extension), `action.yml`'s default, the pre-commit pin, `server.json`, and
   the Obsidian plugin (`editors/obsidian/manifest.json` and the newest key of
   its `versions.json`). `scripts/check-versions.ts` fails CI when any of them
   disagrees with `packages/visimark/package.json`, and
   `scripts/prepare-release.ts` bumps them all. The Joplin plugin carries no
   committed version; its build stamps the engine's into the packed manifest.

   A fix that touches only one artifact is a patch release of the whole line.
   There is no exception that lets one artifact run ahead: it would need its own
   carve-out in the check, and the next release would have to skip a number.
   An artifact with nothing to say gets a one-line entry in its changelog ("No
   plugin changes. Bundles engine X.Y.Z.").

   The Obsidian plugin joined the line at 0.4.0 (#396). It had been on its own
   number, which reached 0.3.0, and a tag is never reused, so core went from
   0.2.0 to 0.4.0. Before that, the plugin was kept off the line because each
   Obsidian release was expected to wait on a human registry review; after the
   one-time submission, releases are reviewed automatically (see
   [Submitting to the community registry](#submitting-to-the-community-registry)).
   ```

2. In step 3 ("Bump the version"), add five lines to the file list code block, after `server.json`:

   ```text
   editors/obsidian/manifest.json              # the plugin's version
   editors/obsidian/versions.json              # a new "X.Y.Z": "<minAppVersion>" key, appended
   manifest.json                               # byte copy of editors/obsidian/manifest.json
   versions.json                               # byte copy of editors/obsidian/versions.json
   editors/obsidian/CHANGELOG.md               # dated entry, or the placeholder
   ```

   After the sentence "The eight manifests are listed once, in `scripts/release-manifests.ts`, which `prepare-release.ts` and the CI check both import.", add: "The Obsidian plugin's two files are named there too, outside that list, because neither is a `package.json`."
   In the sentence "read the diff and rewrite the extension changelog's placeholder line afterwards", change "the extension changelog's placeholder line" to "either editor changelog's placeholder line".

3. Replace `## Release order` from its first paragraph through the end of the "A core bump leaves the plugin changelog behind, on purpose." paragraph with:

   ```markdown
   ## Release order

   One version, two tags, core first. The plugin bundles the engine, and its
   release must not exist before the npm packages it names are on the
   registries — #286 was once merged before core had shipped. Both tags name the
   same `X.Y.Z` ([Versioning](#versioning)); the plugin's has no `v`.

   1. Merge the release commit (`chore: release vX.Y.Z`) and wait for `ci`
      and `dogfood` on it.
   2. Tag it with `scripts/release-tag.sh vX.Y.Z` and wait for `release.yml`.
   3. Run `scripts/verify-release.sh vX.Y.Z` ([Verify every leg](#verify-every-leg)).
   4. Tag the same commit with `scripts/release-tag.sh X.Y.Z` and wait for
      `obsidian-release.yml`.
   5. Check the release page has `main.js`, `manifest.json` and `styles.css`, and
      that the attestation verifies (see below).

   Pushing a tag is the maintainer's action; an agent opens the PRs, watches the
   runs and verifies, and does not tag unless asked.
   ```

4. In `## Releasing the Obsidian plugin`, first paragraph:
   - Replace "The plugin's version is its own (`editors/obsidian/manifest.json`, not tied to the engine's — see `editors/obsidian/CHANGELOG.md`'s own header), and the community registry" with "The plugin's version is the release's ([Versioning](#versioning)), and the community registry".
   - Replace "Pushing `0.2.0` (not `v0.2.0`)" with "Pushing `0.4.0` (not `v0.4.0`)".
   - Delete the three sentences from "The workflow also fails unless the newest dated entry" through "re-released."
   In "Keeping the root copies in step", replace "so copy both in the plugin release commit." with "and `scripts/prepare-release.ts` writes both from the `editors/obsidian/` copies, refusing to start if they already differ."

5. In "Submitting to the community registry", item 4: replace "each fix is a normal plugin release, in the order above." with "each fix is a patch release of the whole line, in the order above."

6. In "Preparing the changelog": change "Two files." to "Three files." Replace the `editors/obsidian/CHANGELOG.md` bullet with:

   ```markdown
   - **[`editors/obsidian/CHANGELOG.md`](../editors/obsidian/CHANGELOG.md)** — the
     plugin release's body. Every release gets a dated entry, as the extension's
     does: `prepare-release.ts` dates `## Unreleased` when it has content and
     opens a fresh one, or writes "No plugin changes. Bundles engine X.Y.Z." when
     it is empty. List only what an Obsidian user sees.
   ```

   In step 4 ("Write the changelog"), change "`CHANGELOG.md` or `editors/vscode/CHANGELOG.md` has no dated" to "`CHANGELOG.md`, `editors/vscode/CHANGELOG.md` or `editors/obsidian/CHANGELOG.md` has no dated".

7. In "Rules that bite":
   - In the row starting "All eight `package.json` versions equal the tag", add to the rule cell: " So do the Obsidian plugin's `manifest.json` and the newest key of its `versions.json`."
   - In the row "Core ships before the plugin that bundles it", replace the consequence cell with: "The plugin release points at an engine version the registries do not have yet — #286 was merged before core shipped."

- [ ] **Step 2: `docs/design/obsidian-plugin-spec.md` §2.2**

Directly after the paragraph that begins "**Versioning is independent of the npm packages.**" (ending "…and in `CONTRIBUTING.md`."), insert:

```markdown
> **Amended 2026-10-15 ([#396](https://github.com/michal-niedzwiedzki/visimark/issues/396)).**
> Reversed: the plugin now carries the release's version, starting at 0.4.0.
> The premise above, a human registry review on every release, lapsed once the
> plugin was listed: after the one-time submission the registry reviews each
> release automatically. The policy is stated in
> [`releasing.md`](../releasing.md#versioning). The paragraph above, the §5
> table row and the §9 note stay as the record of v1.
```

Change nothing else in this file.

- [ ] **Step 3: `editors/obsidian/CHANGELOG.md` header**

Replace the paragraph between `# Changelog` and `## Unreleased` (it begins "The plugin's version is its own.") with:

```markdown
The plugin carries the version of the release it ships in, the same number as
the `visimark` npm packages and the VS Code extension
([`releasing.md`](../../docs/releasing.md#versioning)). Entries up to 0.3.0 are
from its own earlier line and end with the engine version they bundled.
```

- [ ] **Step 4: `editors/obsidian/README.md`**

In "Installing it", replace "tagged with the plugin's version and no `v` (`0.2.1`, not `v0.2.1`)" with "tagged with the release's version and no `v` (`0.4.0`, not `v0.4.0`)".
Replace the body of "## Versioning" with:

```markdown
The plugin's version is the release's: the same number as the `visimark` npm
packages and the VS Code extension, in `manifest.json` and nowhere else in this
folder (the workspace `package.json` carries none).
[`docs/releasing.md`](../../docs/releasing.md#versioning) states the policy;
`scripts/check-versions.ts` fails a build where it disagrees.
```

- [ ] **Step 5: `CONTRIBUTING.md`**

Replace lines 149–152 ("The plugin's version lives in `manifest.json` only … holds it honest instead.") with:

```markdown
The plugin's version lives in `manifest.json` and is the release's, like every
other shipped artifact's ([`docs/releasing.md`](docs/releasing.md#versioning)).
```

In "**Every version-carrying file must agree.**", change "and the two versions in `server.json`." to "the two versions in `server.json`, and the Obsidian plugin's `editors/obsidian/manifest.json` and the newest key of its `versions.json`."

- [ ] **Step 6: `.agents/rules/dependencies-and-pins.md`**

In the pin table, change the first row's left cell from "A package's own version, an exact engine pin, `action.yml`, the pre-commit hook, `server.json`" to "A package's own version, an exact engine pin, `action.yml`, the pre-commit hook, `server.json`, the Obsidian plugin's `manifest.json` and newest `versions.json` key". Leave the right cell as it is.

- [ ] **Step 7: `scripts/check-versions.ts` header**

In the file list of the header comment, after the `server.json` bullet, add:

```ts
 * - the Obsidian plugin's `editors/obsidian/manifest.json` version and the
 *   newest key of its `versions.json` (docs/releasing.md#versioning). The root
 *   copies are `check-obsidian-root-mirror.ts`'s job.
```

Task 5 adds the code. This step changes only the comment.

- [ ] **Step 8: `CHANGELOG.md`**

Under `## Unreleased` → `### Changed`, add as the first bullet:

```markdown
- **The Obsidian plugin carries the release's version.** Plugin 0.4.0 bundles
  engine 0.4.0, and the numbers match from here on. The plugin's own line had
  reached 0.3.0, so this release skips from 0.2.0 to 0.4.0
  ([#396](https://github.com/michal-niedzwiedzki/visimark/issues/396)).
```

- [ ] **Step 9: `docs/vocabulary-catalogue.md`**

Delete the "Obsidian plugin on the core version line" row from the section F table. Add it as the first row of the Shipped register's table:

```markdown
| Obsidian plugin on the core version line | tooling | [#396](https://github.com/michal-niedzwiedzki/visimark/issues/396) | [#399](https://github.com/michal-niedzwiedzki/visimark/pull/399) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/396#issuecomment-6187465115) |
```

Task 6 fills its **Released** cell.

- [ ] **Step 10: Verify the docs**

Run:
```bash
bun scripts/check-links.ts
for f in docs/releasing.md docs/design/obsidian-plugin-spec.md editors/obsidian/CHANGELOG.md editors/obsidian/README.md CONTRIBUTING.md .agents/rules/dependencies-and-pins.md CHANGELOG.md docs/vocabulary-catalogue.md; do bun run packages/visimark/src/cli/main.ts check "$f" || echo "FAIL $f"; done
bun run format:check
git grep -n -i "version is its own\|its own version, not\|does not move with it\|Bundles engine X\.\" line" -- docs CONTRIBUTING.md editors scripts ':!docs/reviews' ':!docs/design/obsidian-release-plan.md' ':!docs/design/obsidian-plugin-on-core-release-line-*' ':!docs/design/obsidian-plugin-spec.md'
```
Expected: check-links passes, no `FAIL` line, format clean. The grep finds no statement that the plugin version is independent outside the files spec §7 leaves alone.

- [ ] **Step 11: Commit**

```bash
git add docs/releasing.md docs/design/obsidian-plugin-spec.md editors/obsidian/CHANGELOG.md editors/obsidian/README.md CONTRIBUTING.md .agents/rules/dependencies-and-pins.md scripts/check-versions.ts CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "docs: one version for every shipped artifact (#396)" -m "<trailer>"
```

---

### Task 5: `check-versions.ts` holds the plugin

**Files:**
- Modify: `scripts/check-versions.ts`
- Test: `scripts/pin-checks.test.ts`

**Interfaces:**
- Consumes: `OBSIDIAN_MANIFEST`, `OBSIDIAN_VERSIONS` from `scripts/release-manifests.ts` (Task 1).
- Produces: two `seen` lines, `editors/obsidian/manifest.json "version"=X.Y.Z` and `editors/obsidian/versions.json newest key=X.Y.Z`.

- [ ] **Step 1: Write the failing tests**

In `scripts/pin-checks.test.ts`, import `OBSIDIAN_MANIFEST` and `OBSIDIAN_VERSIONS` alongside `RELEASE_MANIFESTS`. Add both to `COPY`. Inside `describe("check-versions", …)`, add:

```ts
  // The plugin's files, set explicitly so these cases do not depend on the
  // real tree's plugin state (0.3.0 against 0.2.0 until the v0.4.0 commit).
  const engine = (): string => JSON.parse(real("packages/visimark/package.json")).version;
  const plugin = (version: string, versions: Record<string, string>) => ({
    [OBSIDIAN_MANIFEST]: json({ ...JSON.parse(real(OBSIDIAN_MANIFEST)), version }),
    [OBSIDIAN_VERSIONS]: json(versions),
  });

  test("passes when the plugin agrees, without reading the root copies", () => {
    const r = run(
      "check-versions.ts",
      tree(COPY, plugin(engine(), { "0.1.0": "1.8.7", [engine()]: "1.8.7" })),
    );
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${OBSIDIAN_MANIFEST} "version"=${engine()}`);
    expect(r.out).toContain(`${OBSIDIAN_VERSIONS} newest key=${engine()}`);
  });

  test("fails when the plugin manifest drifts", () => {
    const r = run(
      "check-versions.ts",
      tree(COPY, plugin("9.9.9", { [engine()]: "1.8.7" })),
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      `::error file=${OBSIDIAN_MANIFEST}::${OBSIDIAN_MANIFEST} "version" says 9.9.9 but packages/visimark/package.json says ${engine()}. Bump every version-carrying file in the release commit — run bun scripts/prepare-release.ts, see docs/releasing.md.`,
    );
  });

  test("fails when versions.json's newest key drifts", () => {
    const r = run(
      "check-versions.ts",
      tree(COPY, plugin(engine(), { [engine()]: "1.8.7", "9.9.9": "1.8.7" })),
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      `::error file=${OBSIDIAN_VERSIONS}::${OBSIDIAN_VERSIONS} newest key says 9.9.9 but packages/visimark/package.json says ${engine()}.`,
    );
  });

  test("reports a layout move when versions.json has no keys", () => {
    const r = run("check-versions.ts", tree(COPY, plugin(engine(), {})));
    expect(r.code).toBe(1);
    expect(r.out).toContain(`::error file=${OBSIDIAN_VERSIONS}::cannot read newest key in ${OBSIDIAN_VERSIONS}.`);
  });

  test("reports a layout move when the plugin manifest is missing", () => {
    const root = tree(
      COPY.filter((f) => f !== OBSIDIAN_MANIFEST),
      { [OBSIDIAN_VERSIONS]: json({ [engine()]: "1.8.7" }) },
    );
    const r = run("check-versions.ts", root);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`::error file=${OBSIDIAN_MANIFEST}::cannot read "version" in ${OBSIDIAN_MANIFEST}.`);
  });
```

Note: in "reports a layout move when the plugin manifest is missing", `tree()` copies `COPY` first and then writes the files on top. Filtering the manifest out of the copy list is enough.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test scripts/pin-checks.test.ts`
Expected: the five new tests FAIL, because nothing reads the plugin. "passes on the real repository" still PASSES at this point.

- [ ] **Step 3: Implement it in `scripts/check-versions.ts`**

Import `OBSIDIAN_MANIFEST` and `OBSIDIAN_VERSIONS`. After the `server.json` block and before `for (const line of seen)`, add:

```ts
// The Obsidian plugin (docs/releasing.md#versioning). The newest versions.json
// key is the last one in the file, the one prepare-release appends.
expectEngine(OBSIDIAN_MANIFEST, '"version"', json(OBSIDIAN_MANIFEST)?.version);
const pluginVersions = json(OBSIDIAN_VERSIONS);
expectEngine(
  OBSIDIAN_VERSIONS,
  "newest key",
  pluginVersions !== null && !Array.isArray(pluginVersions)
    ? Object.keys(pluginVersions).at(-1)
    : undefined,
);
```

- [ ] **Step 4: Run the tests**

Run: `bun test scripts/pin-checks.test.ts`
Expected: the five new tests PASS. **"passes on the real repository" now FAILS** with `editors/obsidian/manifest.json "version" says 0.3.0 but packages/visimark/package.json says 0.2.0` and `editors/obsidian/versions.json newest key says 0.3.0 …`. That failure is expected (Global Constraints), and Task 6 clears it. Every other test in the file PASSES.

Run: `bun test scripts/prepare-release.test.ts`
Expected: PASS. "leaves a tree every release check passes on" now exercises the plugin comparison.

- [ ] **Step 5: Lint, format, typecheck**

Run: `bun run format && bun run lint && bun run typecheck`
Expected: no diagnostics.

- [ ] **Step 6: Commit (do not push)**

```bash
git add scripts/check-versions.ts scripts/pin-checks.test.ts
git commit -m "feat(release): check-versions holds the Obsidian plugin to the engine (#396)" -m "<trailer>"
```

---

### Task 6: the 0.4.0 release commit

**Files:**
- Modify (by `prepare-release.ts`): the 19 files it reports
- Modify (by hand): `editors/obsidian/CHANGELOG.md` (the 0.4.0 entry), `editors/vscode/CHANGELOG.md` (only if its entry needs rewording), `docs/vocabulary-catalogue.md` (**Released** cells)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a tree at 0.4.0 where every check passes. The PR's last commit is `chore: release v0.4.0`.

- [ ] **Step 1: Prepare**

Run: `bun scripts/prepare-release.ts 0.4.0 --date "$(date +%F)"`
Expected: `Prepared 0.2.0 -> 0.4.0 (<today>, MINOR) in 19 files.`, followed by the closing lines naming both editor changelogs and `commit as "chore: release v0.4.0".`

`bun scripts/prepare-release.ts MINOR` would refuse here, with `0.3.0 is not newer than the Obsidian plugin's current version 0.3.0.` That is spec §4 session 4 against the real tree. Running it once is a good check: it writes nothing.

- [ ] **Step 2: Write the plugin's 0.4.0 entry**

The plugin's `## Unreleased` is empty today, so step 1 wrote the placeholder. Replace `No plugin changes. Bundles engine 0.4.0.` with an entry that opens with this paragraph, verbatim:

```markdown
The plugin now carries the version of the release it ships in: 0.4.0 bundles
engine 0.4.0, and the two numbers match from here on
([`releasing.md`](../../docs/releasing.md#versioning)). The plugin's own line had
reached 0.3.0, so the shared line starts at 0.4.0.
```

Then write what an Obsidian user sees from the engine changes in the release. Draft it from the new `## 0.4.0` section of `CHANGELOG.md` and the `## 0.4.0` section of `editors/vscode/CHANGELOG.md`, and keep only what reaches the plugin through the engine: findings and their codes, anchors and display rules, hovers, Live Preview marks (from `codemirror-visimark`), and the sweep. Leave out anything specific to VS Code, such as the built-in Markdown preview or `visimark.server.path`. Leave out npm packaging and anything that only affects the CLI. Follow the 0.3.0 entry's style: a short lead paragraph, then bold-led bullets, with a **Pre-1.0 break, from the engine.** paragraph if `### Removed` lists one that changes how a note is read. End with `Bundles engine 0.4.0.`. The maintainer reviews this text on the PR.

Read `editors/vscode/CHANGELOG.md`'s new `## 0.4.0` entry. `prepare-release` dated its `## Unreleased` content, so it needs no rewrite unless it is wrong.

- [ ] **Step 3: Fill the Released cells**

In `docs/vocabulary-catalogue.md`'s Shipped register, every row whose **Released** cell is `—` ships now, the #396 row included. First, for each one, confirm the behaviour is specified where `docs/releasing.md` step 5 says. Then:

```bash
bun -e '
const p = "docs/vocabulary-catalogue.md";
const t = await Bun.file(p).text();
const i = t.indexOf("\n## Shipped");
const rel = "[v0.4.0](https://github.com/michal-niedzwiedzki/visimark/releases/tag/v0.4.0)";
const out = t.slice(0, i) + t.slice(i).replace(/^(\|(?:[^|\n]*\|){4}) — (\|[^|\n]*\|)$/gm, `$1 ${rel} $2`);
await Bun.write(p, out);
'
git diff --stat docs/vocabulary-catalogue.md
grep -c "| — |" <(sed -n '/^## Shipped/,$p' docs/vocabulary-catalogue.md)
```
Expected: only Shipped-register rows change, and the final count is `0`.

- [ ] **Step 4: Run every check**

```bash
bun scripts/check-versions.ts | tail -3; echo "exit:${PIPESTATUS[0]}"
bun scripts/check-versions.ts | grep -c .
bun scripts/check-changelog-entries.ts
bun scripts/check-obsidian-root-mirror.ts
bun scripts/check-links.ts
bun test
bun run typecheck
bun run build
bun run lint
bun run format:check
for f in CHANGELOG.md editors/obsidian/CHANGELOG.md editors/vscode/CHANGELOG.md docs/vocabulary-catalogue.md; do bun run packages/visimark/src/cli/main.ts check "$f" || echo "FAIL $f"; done
```
Expected: `check-versions` ends with the two plugin `seen` lines at `0.4.0`, `exit:0`, and the count is `28`. `changelog entries: CHANGELOG.md 0.4.0, editors/vscode/CHANGELOG.md 0.4.0, editors/obsidian/CHANGELOG.md 0.4.0`. The root mirror passes, and every other command exits 0 with no `FAIL` line. In `bun test`, "check-versions > passes on the real repository" now PASSES.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore: release v0.4.0" -m "<trailer>"
git push
```

- [ ] **Step 6: Leave the maintainer the merge notes**

Append this to PR #399's body (`gh pr edit 399 --body …`, keeping the existing text):

```markdown
**Merging.** The last commit is the v0.4.0 release commit. Squash-merge with the
subject `chore: release v0.4.0 (#399)`. Then follow `docs/releasing.md`,
"Release order": `scripts/release-tag.sh v0.4.0`, wait for `release.yml`,
`scripts/verify-release.sh v0.4.0`, then `scripts/release-tag.sh 0.4.0`.

**If the merge is on a later day than the headings' date**, first push a
`chore: date v0.4.0` commit that changes the date of `## 0.4.0 - …` in
`CHANGELOG.md`, `editors/vscode/CHANGELOG.md` and
`editors/obsidian/CHANGELOG.md` to the merge day, and wait for CI to go green
again.
```

<!--vmark:no-formulas-->
