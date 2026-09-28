/**
 * Fails when the repository-root `manifest.json` / `versions.json` differ from
 * the copies in `editors/obsidian/`.
 *
 * The Obsidian community registry reads both from the default branch's root at
 * submission time, while the plugin build and release read `editors/obsidian/`.
 * They are meant to be the same bytes, and nothing else notices when a release
 * bumps one and not the other. `ci.yml` runs this.
 *
 * Usage: `bun scripts/check-obsidian-root-mirror.ts [root]` — `root` defaults
 * to the repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-obsidian-root-mirror [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const read = (file: string): Buffer | null => {
  try {
    return readFileSync(join(root, file));
  } catch {
    return null;
  }
};

let failed = false;
for (const file of ["manifest.json", "versions.json"]) {
  const mirror = `editors/obsidian/${file}`;
  const a = read(file);
  const b = read(mirror);
  if (a === null || b === null) {
    console.log(
      `::error file=${a === null ? file : mirror}::cannot read ${a === null ? file : mirror}. Fix scripts/check-obsidian-root-mirror.ts if the layout moved.`,
    );
    failed = true;
  } else if (!a.equals(b)) {
    console.log(
      `::error file=${file}::${file} differs from ${mirror}. Copy ${mirror} to ${file} in the release commit — see docs/releasing.md.`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("obsidian root mirror: manifest.json, versions.json");
