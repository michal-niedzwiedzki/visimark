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
  // The Obsidian plugin's version is deliberately its own — it is not in the
  // version-agreement step above, because an Obsidian release goes through a
  // human registry review and must not be coupled to an engine patch
  // (docs/design/obsidian-plugin-spec.md §2.2). A version nothing checks is
  // exactly the drift that rule creates, so the changelog check holds it
  // instead, against manifest.json rather than package.json: manifest.json is
  // the plugin's single source of truth for its version, and the workspace
  // package.json deliberately carries none.
  {
    manifest: "editors/obsidian/manifest.json",
    changelog: "editors/obsidian/CHANGELOG.md",
    hint: (v) =>
      `Add a "## ${v} - YYYY-MM-DD" entry, even "No user-visible changes." — and say which engine version the bundle carries`,
  },
];

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-changelog-entries [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const LAYOUT =
  "The layout moved; fix scripts/check-changelog-entries.ts rather than deleting the check.";
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
