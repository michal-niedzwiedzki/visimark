/**
 * Prints one version's section of a changelog, for use as a GitHub Release body.
 *
 * `release.yml` and `obsidian-release.yml` used to hand the whole changelog to
 * `body_path`, so every release page opened with the newest entry and then
 * hundreds of lines of history. This prints only the body under
 * `## <version> - YYYY-MM-DD` (heading excluded: the release is already titled
 * by its tag), up to the next `## ` heading. In the last section the trailing
 * link-reference block (`[0.1.0]: https://...`) is dropped.
 *
 * Usage: `bun scripts/changelog-section.ts <file> <version>`. Exit 0 with the
 * section on stdout, 1 when the heading is missing or its section is empty,
 * 2 usage. Annotations go to stdout, as GitHub reads them there.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("usage: changelog-section <file> <version>");
  process.exit(2);
}
const [file, version] = args as [string, string];

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let text: string;
try {
  text = readFileSync(file, "utf8");
} catch {
  console.log(`::error file=${file}::cannot read ${file}.`);
  process.exit(1);
}

const heading = new RegExp(`^## ${escapeRegExp(version)}( - \\d{4}-\\d{2}-\\d{2})?[ \\t]*$`);
const lines = text.split(/\r?\n/);
const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.log(
    `::error file=${file}::${file} has no "## ${version}" heading, so there are no release notes to extract — see docs/releasing.md.`,
  );
  process.exit(1);
}

let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end === -1) end = lines.length;
const body = lines.slice(start + 1, end);
if (end === lines.length) {
  while (body.length > 0 && /^(\[[^\]]+\]:\s|\s*$)/.test(body[body.length - 1]!)) body.pop();
}

const notes = body.join("\n").trim();
if (notes === "") {
  console.log(`::error file=${file}::the "## ${version}" section of ${file} is empty.`);
  process.exit(1);
}
console.log(notes);
