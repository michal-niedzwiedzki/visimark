/**
 * Prepares the release commit for a core version: bumps the eight
 * version-carrying files and turns the changelogs over.
 *
 * docs/releasing.md ("Before you tag", steps 3 and 4) lists what to touch by
 * hand, and `ci.yml`'s "every version-carrying file must agree" fails the build
 * if one is missed. This makes the misses impossible instead of merely caught.
 * It does not touch the Obsidian plugin, whose version is its own.
 *
 * It rewrites text in place, so file formatting survives. Every replacement
 * must match exactly as expected; if any does not, nothing is written.
 *
 * Usage: `bun scripts/prepare-release.ts X.Y.Z [--date YYYY-MM-DD] [root]` —
 * `date` defaults to today, `root` to the repository root (it exists so this
 * can run against a temp tree). Exit 0 done, 1 refused, 2 usage.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = (): never => {
  console.error("usage: prepare-release X.Y.Z [--date YYYY-MM-DD] [root]");
  process.exit(2);
};

const args = process.argv.slice(2);
let date = new Date().toLocaleDateString("sv"); // ISO 8601 in local time
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--date") {
    const value = args[++i];
    if (value === undefined) usage();
    date = value;
  } else positional.push(args[i]!);
}
if (positional.length < 1 || positional.length > 2) usage();
const version = positional[0]!;
// Strict semver: no leading zeros, which npm refuses to publish.
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) usage();
// The shape is not enough: 2030-02-30 has the shape. It has to round-trip.
const realDate = (d: string): boolean => {
  const t = new Date(`${d}T00:00:00Z`).getTime();
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(t) &&
    new Date(t).toISOString().slice(0, 10) === d
  );
};
if (!realDate(date)) usage();
const root = resolve(positional[1] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const refuse = (file: string, message: string): never => {
  console.log(`::error file=${file}::${message}`);
  process.exit(1);
};
const read = (file: string): string => {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return refuse(file, `cannot read ${file}. The layout moved; fix scripts/prepare-release.ts.`);
  }
};

const cmp = (a: string, b: string): number => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x!.reduce((acc, n, i) => acc || n - y![i]!, 0);
};

const pending = new Map<string, string>();
/** Replaces the one expected match in `file`; refuses when there is none. */
function edit(file: string, pattern: RegExp, replacement: string, what: string): void {
  const text = pending.get(file) ?? read(file);
  if (!pattern.test(text))
    refuse(file, `${file}: cannot find ${what}. The layout moved; fix scripts/prepare-release.ts.`);
  pending.set(file, text.replace(pattern, replacement));
}

const engineFile = "packages/visimark/package.json";
const current: string = JSON.parse(read(engineFile)).version;
if (cmp(version, current) <= 0) {
  refuse(engineFile, `${version} is not newer than the current version ${current}.`);
}

// The six package manifests: own version, and the exact `visimark` pin where
// there is one (the lsp and the extension use `workspace:*`, which stays).
const manifests: Array<[string, boolean]> = [
  [engineFile, false],
  ["packages/visimark-lsp/package.json", false],
  ["editors/vscode/package.json", false],
  ["packages/remark-visimark/package.json", true],
  ["packages/markdownlint-visimark/package.json", true],
  ["packages/visimark-mcp/package.json", true],
];
for (const [file, pinsEngine] of manifests) {
  edit(file, /^(\s*"version": ")[^"]+(",?)$/m, `$1${version}$2`, 'a top-level "version"');
  if (pinsEngine) {
    edit(
      file,
      /("visimark": ")\d+\.\d+\.\d+(")/,
      `$1${version}$2`,
      'an exact "visimark" dependency pin',
    );
  }
}

// The block is `version:` and the lines indented under it, so the match cannot
// run on into a later input's `default` if this one loses its own.
edit(
  "action.yml",
  /(^  version:[ \t]*\n(?:(?: {4}.*)?\n)*? {4}default: ")[^"]*(")/m,
  `$1${version}$2`,
  "the `version` input's own default",
);

// Exactly the two pins (the bunx and npx branches), both numeric. One branch
// drifting to `visimark@latest` must refuse, not be half-bumped.
const hook = "scripts/precommit-visimark-check.sh";
const pins = read(hook).match(/visimark@\S+/g) ?? [];
if (pins.length !== 2 || !pins.every((pin) => /^visimark@\d+\.\d+\.\d+$/.test(pin))) {
  refuse(
    hook,
    `${hook}: expected exactly two numeric visimark@<version> pins, found: ${pins.join(" ") || "none"}.`,
  );
}
edit(hook, /visimark@\d+\.\d+\.\d+/g, `visimark@${version}`, "a visimark@<version> pin");

// Root changelog: Unreleased becomes the release, a fresh Unreleased opens
// above it, and the link reference goes at the head of the reference block.
const rootChangelog = read("CHANGELOG.md");
const unreleased = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## )/m.exec(rootChangelog);
if (unreleased === null)
  refuse("CHANGELOG.md", 'CHANGELOG.md has no "## Unreleased" section to release.');
if (unreleased![1]!.trim() === "") {
  refuse(
    "CHANGELOG.md",
    'the "## Unreleased" section of CHANGELOG.md is empty, so there is nothing to release. Write what changed first — see docs/releasing.md.',
  );
}
edit(
  "CHANGELOG.md",
  /^## Unreleased[ \t]*$/m,
  `## Unreleased\n\n## ${version} - ${date}`,
  '"## Unreleased"',
);
edit(
  "CHANGELOG.md",
  /^(\[\d+\.\d+\.\d+\]: )/m,
  `[${version}]: https://github.com/michal-niedzwiedzki/visimark/releases/tag/v${version}\n$1`,
  "the link-reference block",
);

// The extension's changelog: a placeholder entry to edit, or the Unreleased
// section if someone kept one.
const vscodeChangelog = "editors/vscode/CHANGELOG.md";
if (/^## Unreleased[ \t]*$/m.test(read(vscodeChangelog))) {
  edit(vscodeChangelog, /^## Unreleased[ \t]*$/m, `## ${version} - ${date}`, '"## Unreleased"');
} else {
  edit(
    vscodeChangelog,
    /^## /m,
    `## ${version} - ${date}\n\nNo editor-visible changes. Bundles engine ${version}.\n\n## `,
    "an existing release heading",
  );
}

for (const [file, text] of pending) writeFileSync(join(root, file), text);

console.log(`Prepared ${current} -> ${version} (${date}) in ${pending.size} files.`);
console.log(`Now: read the diff, and rewrite the placeholder line in ${vscodeChangelog} if the`);
console.log('extension has editor-visible changes (docs/releasing.md, "Preparing the changelog").');
console.log("Fill the Shipped-register Released cells (step 5), run the pre-push checks, then");
console.log(`commit as "chore: release v${version}". The Obsidian plugin is not touched.`);
