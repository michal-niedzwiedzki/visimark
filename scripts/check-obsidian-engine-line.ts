/**
 * Fails when the Obsidian changelog's newest entry claims a different engine
 * than the one in the tree.
 *
 * Each plugin entry ends "Bundles engine X." and the bundle really does carry
 * `packages/visimark`'s version at the tagged commit. `obsidian-release.yml`
 * runs this, and ordinary CI deliberately does not: a core-only bump would
 * turn every PR red until the plugin was re-released.
 *
 * Usage: `bun scripts/check-obsidian-engine-line.ts [root]` — `root` defaults
 * to the repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-obsidian-engine-line [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const CHANGELOG = "editors/obsidian/CHANGELOG.md";
const ENGINE = "packages/visimark/package.json";
const LAYOUT = "Fix scripts/check-obsidian-engine-line.ts if the layout moved.";
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

let engine: unknown;
let text: string;
try {
  engine = JSON.parse(readFileSync(join(root, ENGINE), "utf8")).version;
  text = readFileSync(join(root, CHANGELOG), "utf8");
} catch {
  annotate(CHANGELOG, `cannot read ${ENGINE} or ${CHANGELOG}. ${LAYOUT}`);
  process.exit(1);
}
if (typeof engine !== "string" || engine === "") {
  annotate(ENGINE, `cannot read version in ${ENGINE}. ${LAYOUT}`);
  process.exit(1);
}

const lines = text.split(/\r?\n/);
const dated = /^## (\S+) - \d{4}-\d{2}-\d{2}[ \t]*$/;
const start = lines.findIndex((line) => dated.test(line));
if (start === -1) {
  annotate(CHANGELOG, `${CHANGELOG} has no dated "## X.Y.Z - YYYY-MM-DD" entry. ${LAYOUT}`);
  process.exit(1);
}
const version = dated.exec(lines[start]!)![1];
let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end === -1) end = lines.length;
const claim = /^Bundles engine (\S+?)\.[ \t]*$/m.exec(lines.slice(start + 1, end).join("\n"));
if (claim === null) {
  annotate(
    CHANGELOG,
    `the ${version} entry in ${CHANGELOG} has no "Bundles engine X." line. Say which engine version the bundle carries — see docs/releasing.md.`,
  );
  process.exit(1);
}
if (claim[1] !== engine) {
  annotate(
    CHANGELOG,
    `the ${version} entry says "Bundles engine ${claim[1]}." but ${ENGINE} is ${engine}. Update the line, or release the plugin from a commit that still bundles ${claim[1]} — see docs/releasing.md.`,
  );
  process.exit(1);
}
console.log(`obsidian engine line: ${version} bundles engine ${engine}`);
