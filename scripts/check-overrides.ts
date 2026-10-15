/**
 * Fails when a root `overrides` version does not satisfy a range some
 * workspace declares for the same package.
 *
 * The root `overrides` keep one copy of each CodeMirror package in the
 * workspace (two `@codemirror/state` copies are two editor states). They are a
 * second source of truth that Dependabot does not read: #359 bumped five
 * manifests to `@codemirror/view ^6.43.14`, #363 then pinned the override at
 * 6.43.13, and every workspace ran below its own declared minimum while
 * `bun install --frozen-lockfile` accepted it. Review 2026-10-15 §2.6.
 *
 * Bump an overridden package by hand, override and manifests in one commit;
 * `.github/dependabot.yml` ignores the four for that reason.
 *
 * Usage: `bun scripts/check-overrides.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-overrides [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

type Manifest = Record<string, unknown>;
function manifest(file: string): Manifest | null {
  try {
    return JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
  } catch {
    return null;
  }
}

const ROOT = "package.json";
const rootManifest = manifest(ROOT);
if (rootManifest === null) {
  annotate(ROOT, `cannot read ${ROOT}.`);
  process.exit(1);
}
const overrides = (rootManifest.overrides ?? {}) as Record<string, string>;

/** Every workspace manifest the root's `workspaces` globs (`dir/*`) name. */
const files = [ROOT];
for (const glob of (rootManifest.workspaces ?? []) as string[]) {
  const dir = glob.replace(/\/\*$/, "");
  if (!existsSync(join(root, dir))) continue;
  for (const name of readdirSync(join(root, dir)).sort()) {
    const file = `${dir}/${name}/package.json`;
    if (existsSync(join(root, file))) files.push(file);
  }
}

const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
let fail = false;
for (const [name, version] of Object.entries(overrides)) {
  let ranges = 0;
  for (const file of files) {
    const m = manifest(file);
    if (m === null) {
      annotate(file, `cannot read ${file}.`);
      fail = true;
      continue;
    }
    for (const field of FIELDS) {
      const range = (m[field] as Record<string, string> | undefined)?.[name];
      if (range === undefined || range.startsWith("workspace:")) continue;
      ranges++;
      if (!Bun.semver.satisfies(version, range)) {
        annotate(
          file,
          `${file} declares ${name} "${range}" in ${field}, but the root override pins ${version}, which does not satisfy it. Bump the override and the manifests together.`,
        );
        fail = true;
      }
    }
  }
  console.log(`${name}@${version} — checked against ${ranges} declared range(s)`);
}
process.exit(fail ? 1 : 0);
