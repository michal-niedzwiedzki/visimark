import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The repository's own Markdown is checked by two hands: the pre-commit hook
 * (.pre-commit-config.yaml, the `visimark` hook's `files`/`exclude`) and CI
 * (dogfood.yml's "compute the doc set" step). They must select the same files,
 * and every file they select must pass `visimark check` — the second test is
 * what makes `bun test` catch a missing `<!--vmark:no-formulas-->` even on a
 * clone where nobody ran `pre-commit install`.
 */

const root = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const tracked = (): string[] => {
  const r = Bun.spawnSync(["git", "ls-files", "*.md"], { cwd: root, stdout: "pipe" });
  return new TextDecoder().decode(r.stdout).split("\n").filter(Boolean);
};

/** The hook's selection: pre-commit `re.search`es `files` and `exclude`. */
function hookSet(files: string[]): string[] {
  const cfg = read(".pre-commit-config.yaml");
  const hook = cfg.slice(cfg.indexOf("- id: visimark"), cfg.indexOf("- id: gen-articles"));
  const field = (name: string) => new RegExp(`^\\s+${name}: (.+)$`, "m").exec(hook)![1]!;
  const include = new RegExp(field("files"));
  const exclude = new RegExp(field("exclude"));
  return files.filter((f) => include.test(f) && !exclude.test(f));
}

/** CI's selection: `git ls-files '*.md' | grep -vE <dirs>`, minus the `exclude=(…)` list. */
function dogfoodSet(files: string[]): string[] {
  const wf = read(".github/workflows/dogfood.yml");
  const dirs = new RegExp(/grep -vE '([^']+)'/.exec(wf)![1]!);
  const list = /exclude=\(([\s\S]*?)\)/.exec(wf)![1]!;
  const named = new Set([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
  return files.filter((f) => !dirs.test(f) && !named.has(f));
}

test("the pre-commit hook and dogfood.yml check the same documents", () => {
  const files = tracked();
  expect(hookSet(files)).toEqual(dogfoodSet(files));
});

test("the set reaches past docs/: package READMEs and the editor plugins", () => {
  const set = new Set(hookSet(tracked()));
  for (const f of [
    "packages/codemirror-visimark/README.md",
    "packages/markdownlint-visimark/README.md",
    "editors/obsidian/README.md",
    "editors/vscode/README.md",
    "AGENTS.md",
  ]) {
    expect([f, set.has(f)]).toEqual([f, true]);
  }
});

test("every document in the set passes visimark check", () => {
  const files = hookSet(tracked());
  const r = Bun.spawnSync(["bun", "packages/visimark/src/cli/main.ts", "check", ...files], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr);
  expect(r.exitCode, out).toBe(0);
}, 60_000);
