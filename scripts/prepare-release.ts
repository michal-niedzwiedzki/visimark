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
 * Usage: `bun scripts/prepare-release.ts [FIX|MINOR|MAJOR|X.Y.Z] [--date YYYY-MM-DD] [--root path]`
 * — a bump word (case-insensitive) computes the next version from the current
 * one; omitting it defaults to FIX. An explicit X.Y.Z sets the version
 * outright (the escape hatch for the odd case, e.g. the first 1.0.0), but
 * whichever component it moves is still checked against the rule below.
 * `date` defaults to today, `root` to the repository root (it exists so this
 * can run against a temp tree). Exit 0 done, 1 refused, 2 usage.
 *
 * A MINOR bump needs a "### Added" entry in CHANGELOG.md's Unreleased
 * section; MAJOR needs "### Removed" (a breaking change). "### Fixed" /
 * "### Changed" alone — a bug fix, a wording tweak, content filed under the
 * wrong heading — never justifies more than FIX; the tool refuses rather
 * than let a cosmetic change move a number nobody meant to move.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = (): never => {
  console.error("usage: prepare-release [FIX|MINOR|MAJOR|X.Y.Z] [--date YYYY-MM-DD] [--root path]");
  process.exit(2);
};

const args = process.argv.slice(2);
let date = new Date().toLocaleDateString("sv"); // ISO 8601 in local time
let rootArg: string | undefined;
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--date") {
    const value = args[++i];
    if (value === undefined) usage();
    date = value;
  } else if (args[i] === "--root") {
    const value = args[++i];
    if (value === undefined) usage();
    rootArg = value;
  } else positional.push(args[i]!);
}
if (positional.length > 1) usage();
const spec = positional[0] ?? "FIX";

const BUMPS = ["FIX", "MINOR", "MAJOR"] as const;
type Bump = (typeof BUMPS)[number];
const asBump = (s: string): Bump | null =>
  (BUMPS as readonly string[]).includes(s.toUpperCase()) ? (s.toUpperCase() as Bump) : null;
// Strict semver: no leading zeros, which npm refuses to publish.
const isSemver = (v: string): boolean => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v);

const bump = asBump(spec);
if (bump === null && !isSemver(spec)) usage();

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
const root = resolve(rootArg ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

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
const [curMajor, curMinor, curPatch] = current.split(".").map(Number) as [number, number, number];

// The Unreleased section decides both the release content and, below, what
// bump it can justify — read it once, before any file is touched.
const rootChangelog = read("CHANGELOG.md");
const unreleasedMatch = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## )/m.exec(rootChangelog);
if (unreleasedMatch === null)
  refuse("CHANGELOG.md", 'CHANGELOG.md has no "## Unreleased" section to release.');
const unreleasedBody = unreleasedMatch[1]!;
if (unreleasedBody.trim() === "") {
  refuse(
    "CHANGELOG.md",
    'the "## Unreleased" section of CHANGELOG.md is empty, so there is nothing to release. Write what changed first — see docs/releasing.md.',
  );
}

const nextFor: Record<Bump, string> = {
  FIX: `${curMajor}.${curMinor}.${curPatch + 1}`,
  MINOR: `${curMajor}.${curMinor + 1}.0`,
  MAJOR: `${curMajor + 1}.0.0`,
};
const version = bump !== null ? nextFor[bump] : spec;
if (cmp(version, current) <= 0) {
  refuse(engineFile, `${version} is not newer than the current version ${current}.`);
}

// Whatever moved — a bump word or an explicit X.Y.Z — it has to earn it: a
// MAJOR needs a breaking "### Removed" entry, a MINOR needs a "### Added"
// one. "### Fixed" / "### Changed" alone never justifies more than FIX. The
// heading alone is not an entry: "### Added\n" with nothing under it (the
// next "### " or the end of the section) must not count.
const sectionEntry = (heading: string): string => {
  const start = unreleasedBody.search(new RegExp(`^### ${heading}[ \\t]*$`, "m"));
  if (start === -1) return "";
  const rest = unreleasedBody.slice(unreleasedBody.indexOf("\n", start) + 1);
  const next = rest.search(/^### /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
};
const [verMajor, verMinor] = version.split(".").map(Number) as [number, number, number];
const level: Bump = verMajor !== curMajor ? "MAJOR" : verMinor !== curMinor ? "MINOR" : "FIX";
const hasAdded = sectionEntry("Added") !== "";
const hasRemoved = sectionEntry("Removed") !== "";
const ceiling: Bump = hasRemoved ? "MAJOR" : hasAdded ? "MINOR" : "FIX";
const rank: Record<Bump, number> = { FIX: 0, MINOR: 1, MAJOR: 2 };
if (rank[level] > rank[ceiling]) {
  const need =
    level === "MAJOR" ? '"### Removed" (a breaking change)' : '"### Added" (new functionality)';
  refuse(
    "CHANGELOG.md",
    `${version} is a ${level} bump, but the "## Unreleased" section has no ${need} entry — ` +
      `it only justifies ${ceiling}. Use ${ceiling}, or add an entry that genuinely warrants ${level}.`,
  );
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

// bun.lock mirrors every manifest's own "version" (and, for the three
// exact-pinned packages, the visimark dependency) in its "workspaces" block
// for bookkeeping — bun never refuses --frozen-lockfile over this drifting,
// since it links a workspace-named dependency locally regardless of what the
// pin says, so it sat two releases stale (0.1.8, through v0.1.9 and v0.1.10)
// before anyone noticed. Each pattern is anchored at its own `"<workspace>":
// {` line so it cannot touch a same-named field in a different workspace.
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const lockFile = "bun.lock";
for (const [file, pinsEngine] of manifests) {
  const workspace = escapeRegExp(file.replace(/\/package\.json$/, ""));
  edit(
    lockFile,
    new RegExp(`("${workspace}": \\{[\\s\\S]*?"version": ")[^"]+(")`),
    `$1${version}$2`,
    `"${file.replace(/\/package\.json$/, "")}"'s "version" in bun.lock`,
  );
  if (pinsEngine) {
    edit(
      lockFile,
      new RegExp(`("${workspace}": \\{[\\s\\S]*?"visimark": ")\\d+\\.\\d+\\.\\d+(")`),
      `$1${version}$2`,
      `"${file.replace(/\/package\.json$/, "")}"'s "visimark" dependency pin in bun.lock`,
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

console.log(`Prepared ${current} -> ${version} (${date}, ${level}) in ${pending.size} files.`);
console.log(`Now: read the diff, and rewrite the placeholder line in ${vscodeChangelog} if the`);
console.log('extension has editor-visible changes (docs/releasing.md, "Preparing the changelog").');
console.log("Fill the Shipped-register Released cells (step 5), run the pre-push checks, then");
console.log(`commit as "chore: release v${version}". The Obsidian plugin is not touched.`);
