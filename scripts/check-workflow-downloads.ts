/**
 * Fails when a workflow step downloads a file without pinning what it gets.
 *
 * `release.yml` used to fetch `mcp-publisher` from `releases/latest` and run
 * it, unverified, in a job that can mint an OIDC token (review 2026-10-15
 * §2.3). zizmor audits `uses:` pins, not what a `run:` step fetches with
 * `curl`, so this covers that gap. Two rules, per step:
 *
 * - a URL into `releases/latest/` is refused anywhere: it names no version;
 * - a `curl` or `wget` that saves a file (`-o`, `--output`, `-O`, or `wget`
 *   without `-O -`) must be followed, in the same step, by `sha256sum -c`
 *   (or `shasum -a 256 -c`). Saving to `/dev/null` or piping to stdout is a
 *   probe, not a download, and is not checked.
 *
 * A step is everything from one `- ` list item under `steps:` to the next.
 * Lines ending in `\` are joined first, so a split command reads as one.
 * The rule it enforces is `.agents/rules/dependencies-and-pins.md`.
 *
 * Usage: `bun scripts/check-workflow-downloads.ts [root]` — `root` defaults to
 * the repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-workflow-downloads [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const annotate = (file: string, line: number, message: string): void =>
  console.log(`::error file=${file},line=${line}::${file}:${line} ${message}`);

const WORKFLOWS = ".github/workflows";
const files = [
  ...(existsSync(join(root, WORKFLOWS))
    ? readdirSync(join(root, WORKFLOWS))
        .filter((f) => /\.ya?ml$/.test(f))
        .sort()
        .map((f) => `${WORKFLOWS}/${f}`)
    : []),
  ...(existsSync(join(root, "action.yml")) ? ["action.yml"] : []),
];

/** Whether a (joined) command line saves a download to a file. */
function savesFile(command: string): boolean {
  if (/\bcurl\b/.test(command)) {
    // Every output flag counts: one `-o /dev/null` probe in a command does
    // not excuse a second `-o file`, or a `-O`, in the same one.
    const outputs = [
      ...command.matchAll(/(?:^|\s)(?:-[a-zA-Z]*o|--output)\s+("[^"]*"|'[^']*'|\S+)/g),
    ].map((m) => m[1]!.replace(/^["']|["']$/g, ""));
    if (outputs.some((target) => target !== "/dev/null")) return true;
    return /(?:^|\s)(?:-[a-zA-Z]*O|--remote-name)\b/.test(command);
  }
  if (/\bwget\b/.test(command)) return !/(?:^|\s)-[a-zA-Z]*O\s*-(?:\s|$)/.test(command);
  return false;
}

const VERIFIES = /\bsha256sum\b[^\n]*\s-c\b|\bshasum\s+-a\s*256\b[^\n]*\s-c\b/;

let fail = false;
let downloads = 0;
for (const file of files) {
  const raw = readFileSync(join(root, file), "utf8").split("\n");
  // Join continuations, keeping each command's first line number.
  const lines: Array<{ n: number; text: string }> = [];
  for (let i = 0; i < raw.length; i++) {
    let text = raw[i]!;
    const n = i + 1;
    while (text.endsWith("\\") && i + 1 < raw.length)
      text = text.slice(0, -1) + " " + raw[++i]!.trim();
    lines.push({ n, text });
  }
  // A step starts at a list item indented deeper than its `steps:` key.
  const steps: Array<typeof lines> = [];
  let stepsIndent = -1;
  for (const line of lines) {
    const key = /^(\s*)steps:\s*$/.exec(line.text);
    if (key) {
      stepsIndent = key[1]!.length;
      continue;
    }
    const item = /^(\s*)- /.exec(line.text);
    if (
      stepsIndent >= 0 &&
      item &&
      item[1]!.length > stepsIndent &&
      item[1]!.length <= stepsIndent + 2
    ) {
      steps.push([line]);
    } else if (steps.length > 0) steps[steps.length - 1]!.push(line);
  }
  for (const step of steps) {
    step.forEach((line, i) => {
      if (/https?:\/\/\S*\/releases\/latest\//.test(line.text)) {
        annotate(
          file,
          line.n,
          "fetches from releases/latest, which names no version. Name a release.",
        );
        fail = true;
      }
      if (/^\s*#/.test(line.text) || !savesFile(line.text)) return;
      downloads++;
      if (!step.slice(i + 1).some((later) => VERIFIES.test(later.text))) {
        annotate(
          file,
          line.n,
          "downloads a file and never checks it. Pin a version and verify a committed SHA-256 with `sha256sum -c` before using it.",
        );
        fail = true;
      }
    });
  }
}
if (!fail)
  console.log(
    `check-workflow-downloads: ${files.length} files, ${downloads} download(s), each verified`,
  );
process.exit(fail ? 1 : 0);
