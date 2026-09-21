# Changelog entry for every release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fail CI when the root `CHANGELOG.md` or `editors/vscode/CHANGELOG.md` has no dated `## X.Y.Z - YYYY-MM-DD` heading for its own manifest's version, and document the rule.

**Architecture:** One bun script, `scripts/check-changelog-entries.ts`, reads two manifests and two changelogs and reports every failure as a GitHub `::error` annotation. A sibling step in `ci.yml` runs it. The rule and the documentation follow. No `visimark` CLI surface changes.

**Tech Stack:** Bun, TypeScript (`node:fs`, no dependencies), GitHub Actions, Markdown.

**Spec:** [`extension-changelog-check-spec.md`](extension-changelog-check-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer for the agent running the session, resolved from `.claude/rules/ai-attribution.md`. Never copy a trailer from this plan or an old commit; the PR body follows the same rule.
- Exit codes of the script: `0` clean, `1` findings, `2` usage. Annotations go to **stdout**; stderr carries only the usage line.
- The heading match is `^## V - \d{4}-\d{2}-\d{2}[ \t]*$` with every `.` in `V` escaped. Anchored; the date is required; the date is not validated as a calendar date; `## Unreleased` is ignored.
- Each changelog is checked against **its own** manifest: `packages/visimark/package.json` ↔ `CHANGELOG.md`, `editors/vscode/package.json` ↔ `editors/vscode/CHANGELOG.md`. Both pairs are always checked and every failure is reported.
- No new test file (spec §4 and #131 discussion): acceptance is the scripted temp-tree session in Task 1.
- No `CHANGELOG.md` or `editors/vscode/CHANGELOG.md` line: a CI-only change needs none unless a consumer can observe it (`releasing.md`).
- `bun test`, `bun run typecheck`, `bun run build`, `bun run lint` and `bun run format:check` stay green. Use `bun run packages/visimark/src/cli/main.ts`, never `bunx visimark`, to run the CLI.
- Do not close #131 and do not set the catalogue row to `SHIPPED`; `release.yml` and `releasing.md` do that.

---

### Task 1: The check script

**Files:**
- Create: `scripts/check-changelog-entries.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the command `bun scripts/check-changelog-entries.ts [root]`. Later tasks rely on this exact path, the optional `root` argument, exit codes `0`/`1`/`2`, and the stdout success line `changelog entries: CHANGELOG.md 0.1.6, editors/vscode/CHANGELOG.md 0.1.6`.

- [ ] **Step 1: Write the script**

```ts
/**
 * Fails when a changelog has no dated heading for its manifest's version.
 *
 * `CHANGELOG.md` becomes the GitHub Release body and `editors/vscode/CHANGELOG.md`
 * becomes the Marketplace page, so a tag ahead of either ships the previous
 * version's notes or a version the page silently skips. Nothing else in CI opens
 * them. `ci.yml` runs this right after the version-agreement step.
 *
 * Usage: `bun scripts/check-changelog-entries.ts [root]` — `root` defaults to
 * the repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout, as GitHub reads
 * them there. The check enforces presence, not accuracy.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Pair {
  manifest: string;
  changelog: string;
  hint: (version: string) => string;
}

const PAIRS: Pair[] = [
  {
    manifest: "packages/visimark/package.json",
    changelog: "CHANGELOG.md",
    hint: (v) =>
      `Rename "## Unreleased" to "## ${v} - YYYY-MM-DD" and open a fresh "## Unreleased" above it`,
  },
  {
    manifest: "editors/vscode/package.json",
    changelog: "editors/vscode/CHANGELOG.md",
    hint: (v) => `Add an entry, even "No editor-visible changes. Bundles engine ${v}."`,
  },
];

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-changelog-entries [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const LAYOUT = "The layout moved; fix scripts/check-changelog-entries.ts rather than deleting the check.";
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

function read(file: string): string | null {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return null;
  }
}

function versionOf(manifest: string): string | null {
  const text = read(manifest);
  if (text === null) return null;
  try {
    const version: unknown = JSON.parse(text).version;
    return typeof version === "string" && version !== "" ? version : null;
  } catch {
    return null;
  }
}

let failed = false;
const passed: string[] = [];

for (const { manifest, changelog, hint } of PAIRS) {
  const version = versionOf(manifest);
  if (version === null) {
    annotate(manifest, `cannot read version in ${manifest}. ${LAYOUT}`);
    failed = true;
    continue;
  }
  const text = read(changelog);
  if (text === null) {
    annotate(changelog, `cannot read ${changelog}. ${LAYOUT}`);
    failed = true;
    continue;
  }
  const v = escapeRegExp(version);
  const dated = new RegExp(`^## ${v} - \\d{4}-\\d{2}-\\d{2}[ \\t]*$`);
  const undated = new RegExp(`^## ${v}[ \\t]*$`);
  const lines = text.split(/\r?\n/);
  if (lines.some((line) => dated.test(line))) {
    passed.push(`${changelog} ${version}`);
  } else if (lines.some((line) => undated.test(line))) {
    annotate(
      changelog,
      `${changelog} has "## ${version}" with no date. Write it as "## ${version} - YYYY-MM-DD" — see docs/releasing.md.`,
    );
    failed = true;
  } else {
    annotate(
      changelog,
      `${manifest} says ${version} but ${changelog} has no "## ${version} - YYYY-MM-DD" heading. ${hint(version)} — see docs/releasing.md.`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`changelog entries: ${passed.join(", ")}`);
```

- [ ] **Step 2: Run it on today's tree**

Run: `bun scripts/check-changelog-entries.ts; echo "exit=$?"`
Expected: `changelog entries: CHANGELOG.md 0.1.6, editors/vscode/CHANGELOG.md 0.1.6` then `exit=0`.

- [ ] **Step 3: Run the spec §4 behaviour table against a temp tree**

Run this whole block; every `expect` line names the output the spec requires. `run` prints the combined output and the exit code.

```bash
T=$(mktemp -d); mkdir -p "$T/packages/visimark" "$T/editors/vscode"
run() { bun scripts/check-changelog-entries.ts "$@"; echo "exit=$?"; }
mk() { # engine-version ext-version
  printf '{"version":"%s"}\n' "$1" > "$T/packages/visimark/package.json"
  printf '{"version":"%s"}\n' "$2" > "$T/editors/vscode/package.json"
}
mk 0.1.7 0.1.7
printf '# Changelog\n\n## Unreleased\n\n## 0.1.6 - 2026-09-20\n' > "$T/CHANGELOG.md"
printf '# Changelog\n\n## 0.1.6 - 2026-09-20\n' > "$T/editors/vscode/CHANGELOG.md"

echo "--- both missing: expect two ::error lines (root hint 'Rename ...', extension hint 'Add an entry ...'), exit=1"
run "$T"

echo "--- extension only missing: expect one ::error file=editors/vscode/CHANGELOG.md ... 0.1.7 - YYYY-MM-DD ... exit=1"
printf '# Changelog\n\n## Unreleased\n\n## 0.1.7 - 2026-09-22\n\n## 0.1.6 - 2026-09-20\n' > "$T/CHANGELOG.md"
run "$T"

echo "--- extension heading added, no '## Unreleased' in the extension file: expect 'changelog entries: CHANGELOG.md 0.1.7, editors/vscode/CHANGELOG.md 0.1.7', exit=0"
printf '## 0.1.7 - 2026-09-22\n\n## 0.1.6 - 2026-09-20\n' > "$T/editors/vscode/CHANGELOG.md"
run "$T"

echo "--- undated heading: expect '... has \"## 0.1.7\" with no date. Write it as ...', exit=1"
printf '## 0.1.7\n' > "$T/editors/vscode/CHANGELOG.md"
run "$T"

echo "--- anchoring: manifest 0.1.6, changelog only has 0.1.60: expect the 'no heading' error, exit=1"
mk 0.1.6 0.1.6
printf '## 0.1.60 - 2026-09-30\n' > "$T/editors/vscode/CHANGELOG.md"
printf '## 0.1.6 - 2026-09-20\n' > "$T/CHANGELOG.md"
run "$T"

echo "--- extension changelog missing: expect 'cannot read editors/vscode/CHANGELOG.md. The layout moved; ...', exit=1"
rm "$T/editors/vscode/CHANGELOG.md"
run "$T"

echo "--- manifest without a version: expect 'cannot read version in packages/visimark/package.json. ...', exit=1"
printf '{}\n' > "$T/packages/visimark/package.json"
run "$T"

echo "--- two arguments: expect the usage line on stderr, exit=2"
run "$T" extra
rm -rf "$T"
```

Expected: each block prints what its `echo` line predicts. If a message differs from spec §3–§4 by even a character, fix the script, not the spec.

- [ ] **Step 4: Lint and format**

Run: `bun run lint && bun run format:check`
Expected: both pass. If `format:check` fails, run `bun run format` and re-run. (`typecheck` does not cover `scripts/`; no tsconfig reaches it.)

- [ ] **Step 5: Commit**

```bash
git add scripts/check-changelog-entries.ts
git commit -m "ci: check that each changelog has an entry for its release (#131)"   # + the attribution trailer
```

---

### Task 2: The CI step

**Files:**
- Modify: `.github/workflows/ci.yml` (insert after the "every version-carrying file must agree" step, before `- run: bun run lint`, currently line 60–61)

**Interfaces:**
- Consumes: `bun scripts/check-changelog-entries.ts` from Task 1 (exit `0`/`1`, no arguments).
- Produces: a CI step named `every release must have a changelog entry`. Task 3's docs quote this exact name.

- [ ] **Step 1: Add the step**

Insert this block after the agreement step's `exit $fail` line and its blank line, before `- run: bun run lint`:

```yaml
      # Each changelog is a release input: CHANGELOG.md becomes the GitHub
      # Release body and editors/vscode/CHANGELOG.md becomes the Marketplace
      # page. A tag ahead of either ships the previous version's notes, or a
      # version the page silently skips, and nothing above opens them. This
      # fails a release commit that bumps the manifests without a dated
      # `## X.Y.Z - YYYY-MM-DD` heading. It checks presence, not accuracy.
      # docs/releasing.md ("Preparing the changelog") is the rule; the check
      # lives in scripts/check-changelog-entries.ts so it can run against a temp
      # tree.
      - name: every release must have a changelog entry
        run: bun scripts/check-changelog-entries.ts

```

- [ ] **Step 2: Run the step body as CI would, and confirm the workflow parses**

Run: `bun scripts/check-changelog-entries.ts; echo "exit=$?"`
Expected: the success line, `exit=0`.
Run: `bun -e 'import("node:fs").then(f => console.log(f.readFileSync(".github/workflows/ci.yml","utf8").includes("every release must have a changelog entry")))'`
Expected: `true`. Also run `bun run format:check` — expected pass (the workflow file is not formatted by it, but a stray edit elsewhere would show).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the changelog-entry check on every build (#131)"   # + the attribution trailer
```

---

### Task 3: Documentation

**Files:**
- Modify: `docs/releasing.md` (step 4 near line 100; "Preparing the changelog" extension bullet; "Rules that bite" table)
- Modify: `CONTRIBUTING.md` (the "Every version-carrying file must agree" paragraph, line ~157)
- Modify: `docs/vocabulary-catalogue.md` (move the #131 row from section F to the Shipped register)

**Interfaces:**
- Consumes: the CI step name `every release must have a changelog entry` (Task 2) and the script path (Task 1).
- Produces: nothing later tasks rely on.

Deliberately **not** changed: `CHANGELOG.md`, `editors/vscode/CHANGELOG.md`, `docs/ci.md`, `docs/cli-reference.md`, `README.md`, `.github/ISSUE_TEMPLATE/`, `docs/issue-runbook.md` (spec §7).

- [ ] **Step 1: `docs/releasing.md` — step 4**

Replace

```
4. **Write the changelog** — see [Preparing the changelog](#preparing-the-changelog).
```

with

```
4. **Write the changelog** — see [Preparing the changelog](#preparing-the-changelog).
   `ci.yml`'s "every release must have a changelog entry" step fails the build if
   `CHANGELOG.md` or `editors/vscode/CHANGELOG.md` has no dated
   `## X.Y.Z - YYYY-MM-DD` heading for its own manifest's version, so step 6's
   green CI is the confirmation. It checks that the entry exists, not that it is
   right.
```

- [ ] **Step 2: `docs/releasing.md` — the extension changelog rule**

Replace

```
- **[`editors/vscode/CHANGELOG.md`](../editors/vscode/CHANGELOG.md)** — shown on
  the extension's Marketplace page. Keep it to what an extension user sees:
  editor features, settings, fixes. Same version, same date.
```

with

```
- **[`editors/vscode/CHANGELOG.md`](../editors/vscode/CHANGELOG.md)** — shown on
  the extension's Marketplace page.
  - Every release gets a dated `## X.Y.Z - YYYY-MM-DD` entry, even when it is
    one line: "No editor-visible changes. Bundles engine X.Y.Z." Same version,
    same date as the root file.
  - An entry lists only what an extension user sees: diagnostics, hover,
    highlighting, completion, settings, fixes. A language change belongs there
    only if the extension surfaces it.
  - To decide that, remember the language server calls the engine's `analyze()`
    (`packages/visimark-lsp/src/analysis.ts`). An engine finding reaches the
    editor as a diagnostic unless the language server maps it away, so a new or
    widened finding usually belongs here. CI cannot check this; you do.
  - `## Unreleased` is optional in this file. Write the entry when you cut the
    release.
```

Also replace the sentence that opens the section, `Two files. Both are read by machines at release time, so both are part of the release, not an afterthought.`, by appending ` CI checks that each has an entry for the release; it does not check what the entry says.` (keep it on the same paragraph).

- [ ] **Step 3: `docs/releasing.md` — "Rules that bite"**

Add this row directly after the existing row that begins `| The changelog entry is written, dated and merged **before** the tag.`:

```
| Each changelog has a dated `## X.Y.Z - YYYY-MM-DD` heading for the release's version, in the release commit. | `ci.yml`'s "every release must have a changelog entry" step fails the release commit. Without the entry the GitHub Release body ships the previous version's notes, or the Marketplace page silently skips the version. The check proves the heading exists, not that the entry is accurate. |
```

Replace the existing row

```
| Changelog dates are ISO 8601, `YYYY-MM-DD`. | The project's own date rule, unenforced here because nothing runs `check` with date repair on the changelog. |
```

with

```
| Changelog dates are ISO 8601, `YYYY-MM-DD`. | The project's own date rule. A release heading with no date fails CI; every other date in a changelog is unchecked, because nothing runs `check` with date repair on it. |
```

- [ ] **Step 4: `CONTRIBUTING.md`**

In the "Every version-carrying file must agree" paragraph, replace

```
installs. You only touch these in a release commit; see
[`docs/releasing.md`](docs/releasing.md).
```

with

```
installs. You only touch these in a release commit; see
[`docs/releasing.md`](docs/releasing.md). The same commit needs a dated
`## X.Y.Z - YYYY-MM-DD` heading in `CHANGELOG.md` and in
`editors/vscode/CHANGELOG.md`; a separate CI step checks that each has one.
```

- [ ] **Step 5: `docs/vocabulary-catalogue.md` — move the row**

Delete the whole `| Extension changelog entry for every release | … |` row from the section F table. Then append this row at the end of the Shipped register table, after the `Prose notation for unary vocabulary` row and before the blank line and `<!--vmark:no-formulas-->`:

```
| Extension changelog entry for every release | tooling | [#131](https://github.com/michal-niedzwiedzki/visimark/issues/131) | [#138](https://github.com/michal-niedzwiedzki/visimark/pull/138) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/131#issuecomment-5760479248) |
```

Leave `Released` as `—`. If the section F table is left with only its intro and no rows, keep its header and separator lines.

- [ ] **Step 6: Verify the documents and every local check**

Run each and expect it to pass:

```bash
bun run packages/visimark/src/cli/main.ts check docs/releasing.md CONTRIBUTING.md docs/vocabulary-catalogue.md; echo "exit=$?"    # expect exit=0
bun scripts/check-changelog-entries.ts                                                                                              # expect the success line
bun run lint && bun run format:check && bun run typecheck && bun run build && bun test
```

Expected: the `check` exits `0`, every command is green, no `.skip`/`.only` was added. Loop fix → re-run until all pass. Do not loosen an assertion.

- [ ] **Step 7: Commit, push, wait for CI**

```bash
git add docs/releasing.md CONTRIBUTING.md docs/vocabulary-catalogue.md
git commit -m "docs: the changelog-entry rule for releases (#131)"   # + the attribution trailer
git push
gh pr checks 138 --watch
```

Expected: every check passes, including the new "every release must have a changelog entry" step in the `ci` job. Only then `gh pr ready 138`.
