/**
 * Fails on a relative Markdown link, in a tracked `.md` file, whose target
 * does not exist in the tree.
 *
 * Link drift is not caught any other way: the 2026-10-15 review found two
 * links in `editors/obsidian/README.md` pointing at files that had moved, and
 * a README link into the gitignored `docs/superpowers/`, which 404s on GitHub
 * and in every clone. A gitignored target counts as missing, because nobody
 * but the person who wrote the link has it.
 *
 * Checked: inline links and images, `[text](target)`, whose target is not a
 * URL (`scheme:`), a pure `#fragment`, or site-absolute (`/…`). The fragment
 * and query are dropped and the rest is resolved against the file's own
 * directory. Not checked: anchors inside the target, reference-style links,
 * and anything inside a fenced or inline code span, which is example text.
 *
 * Skipped, because they are records of a moment rather than documentation
 * someone navigates today: specs and plans (`*-spec.md`, `*-plan.md`, which
 * name files as they were when written) and dated reviews in `docs/reviews/`.
 * Also skipped: `docs/WIP/` (scratch), test fixtures, and
 * `packages/visimark-mcp/docs/`, which are generated copies whose relative
 * links pointed at siblings of the source and are served as MCP resources,
 * not browsed; their sources are checked.
 *
 * Usage: `bun scripts/check-links.ts [root]` — `root` defaults to the
 * repository root and must be a git work tree, since the file list is
 * `git ls-files`. Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { existsSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-links [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

function git(...cmd: string[]): string[] {
  const r = Bun.spawnSync(["git", ...cmd], { cwd: root });
  if (r.exitCode !== 0) {
    console.error(`check-links: git ${cmd.join(" ")} failed in ${root}`);
    process.exit(2);
  }
  return r.stdout
    .toString()
    .split("\0")
    .filter((s) => s !== "");
}

// Tracked files plus new ones not yet added, so a local run sees a fresh
// file; never ignored ones.
const tracked = new Set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard"));
const SKIP = [
  /^docs\/WIP\//,
  /^docs\/reviews\//,
  /-(plan|spec)\.md$/,
  /\/test\/fixtures\//,
  /^packages\/visimark-mcp\/docs\//,
];
const files = [...tracked]
  .filter((f) => f.endsWith(".md") && !SKIP.some((re) => re.test(f)))
  .sort();

/** The file's text with fenced blocks and inline code blanked, so offsets and line numbers survive. */
function prose(text: string): string {
  const blank = (s: string): string => s.replace(/[^\n]/g, " ");
  const fenced = text.replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[`~]*[ \t]*$|(?![\s\S]))/gm,
    blank,
  );
  return fenced.replace(/(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, blank);
}

/** Whether the path exists in the tree: a tracked file, or a directory holding one. */
function exists(path: string): boolean {
  if (tracked.has(path)) return true;
  const dir = path.endsWith("/") ? path : `${path}/`;
  for (const f of tracked) if (f.startsWith(dir)) return true;
  // A symlinked directory (`.agents/skills/visimark`) is tracked as one entry.
  return path === "" || (existsSync(join(root, path)) && tracked.has(path.replace(/\/$/, "")));
}

let fail = false;
for (const file of files) {
  const text = prose(await Bun.file(join(root, file)).text());
  for (const m of text.matchAll(/!?\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const target = m[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("/")) {
      continue;
    }
    const path = decodeURIComponent(target.replace(/[?#].*$/, ""));
    const resolved = normalize(join(dirname(file), path)).replace(/\\/g, "/");
    if (resolved.startsWith("../")) continue; // outside the repository, e.g. a GitHub-relative link
    if (!exists(resolved === "." ? "" : resolved)) {
      const line = text.slice(0, m.index).split("\n").length;
      console.log(
        `::error file=${file},line=${line}::${file}:${line} links to ${target}, which is not in the repository.`,
      );
      fail = true;
    }
  }
}
if (!fail) console.log(`check-links: ${files.length} Markdown files, every relative link resolves`);
process.exit(fail ? 1 : 0);
