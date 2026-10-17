import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// The spec's §4.3 sessions, run against a git repository built here, through
// the local-path form so nothing touches the network.
const ROOT = join(import.meta.dir, "..");
const SCRIPT = join(ROOT, "scripts/repo-investigate.ts");
const FIXTURES = join(ROOT, "packages/visimark-investigate/test/fixtures/rules");
const USAGE =
  "Usage: bun run repo:investigate <owner/repo|git-url|./path> [--branch NAME] [--force] [--json]";

let parent: string;
let sha: string;

function makeRepo(
  name: string,
  files: Record<string, string>,
  date = "2026-09-30T12:00:00Z",
): string {
  const dir = join(parent, name);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
  const git = (...args: string[]) =>
    Bun.spawnSync(
      ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      {
        cwd: dir,
        env,
      },
    );
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  return git("rev-parse", "HEAD").stdout.toString().trim();
}

function run(...args: string[]) {
  const p = Bun.spawnSync(["bun", SCRIPT, ...args], { cwd: parent });
  return { stdout: p.stdout.toString(), stderr: p.stderr.toString(), code: p.exitCode };
}

const budget = readFileSync(join(FIXTURES, "total-row/bad.md"), "utf8");
const quote = readFileSync(join(FIXTURES, "line-product/bad.md"), "utf8");
const lunch = readFileSync(join(ROOT, "docs/example-lunch-split-drift.md"), "utf8");
const numbered = (text: string, from: number, to: number) =>
  text
    .split("\n")
    .slice(from - 1, to)
    .map((l, i) => `${String(from + i).padStart(5)}  ${l}`);

beforeAll(() => {
  parent = mkdtempSync(join(tmpdir(), "repo-investigate-"));
  sha = makeRepo("fixture-repo", {
    "README.md": "# Fixture\n\n<!--vmark:no-formulas-->\n",
    LICENSE: "MIT\n",
    "test/fixture.md": budget,
    "docs/example-lunch-split-drift.md": lunch,
    "docs/budget.md": budget,
    "docs/quote.md": quote,
  });
  makeRepo("clean-repo", {
    "README.md": "# Fixture\n\n<!--vmark:no-formulas-->\n",
    LICENSE: "MIT\n",
  });
  makeRepo("lead-repo", {
    "docs/plan.md": [
      "| Item | Qty | Price | Cost |",
      "|---|---:|---:|---:|",
      "| A | 2 | 5.00 | 10.00 |",
      "| B | 3 | 4.00 | 12.00 |",
      "",
      "```vmark #q",
      "Cost = Qty * Prise",
      "```",
      "",
    ].join("\n"),
  });
  makeRepo(
    "late-repo",
    { "README.md": "# Late\n\n<!--vmark:no-formulas-->\n" },
    "2026-09-30T23:30:00-05:00",
  );
  mkdirSync(join(parent, "empty-dir"));
});

afterAll(() => rmSync(parent, { recursive: true, force: true }));

describe("repo:investigate", () => {
  test("the fixture session", () => {
    const r = run("./fixture-repo");
    expect(r.stdout).toBe(
      [
        `repo-investigate: fixture-repo at ${sha.slice(0, 12)}, 4 Markdown files`,
        "accuracy: 3 confirmed, 0 leads  (3 tables read, 3 checked, 0 unreadable)",
        "adoption: 2 tables with arithmetic and no rules, 0 inferable, 1 inferable after fix",
        "posture:  CONTRIBUTING no  PR template no  LICENSE yes  action no  last commit 2026-09-30",
        "skipped: test/fixture.md (excluded-directory)",
        "",
        "CONFIRMED  docs/budget.md:15  Cost / Total  · found by: sum check",
        ...numbered(budget, 3, 15),
        "  the table says 341.50; the rows add up to 340.50 (exact); off by 1.00",
        "",
        "CONFIRMED  docs/example-lunch-split-drift.md:17  lunch.Total  · found by: VisiMark",
        ...numbered(lunch, 17, 17),
        "  the document says 30.00; SUM(Price) computes 29.50",
        "",
        "CONFIRMED  docs/quote.md:6  Cost / B  · found by: line check",
        ...numbered(quote, 5, 7),
        "  the table says 13.00; Qty × Price is 12.00; the other 3 rows agree",
        "",
      ].join("\n"),
    );
    expect(r.code).toBe(1);
  });

  test("the fixture, JSON", () => {
    const r = run("./fixture-repo", "--json");
    const report = JSON.parse(r.stdout);
    expect(report.version).toBe(1);
    expect(report.repo.commit).toBe(sha);
    expect(report.accuracy).toEqual({
      verdict: "confirmed",
      confirmed: 3,
      leads: 0,
      tablesRead: 3,
      tablesChecked: 3,
      unreadable: 0,
    });
    expect(report.adoption).toEqual({
      withoutRules: 2,
      withArithmetic: 2,
      inferable: 0,
      inferableAfterFix: 1,
    });
    expect(report.findings.map((f: { id: string }) => f.id)).toEqual([
      "docs/budget.md#t1/Cost/Total",
      "docs/example-lunch-split-drift.md#lunch/Total",
      "docs/quote.md#t1/Cost/B",
    ]);
    expect(report.files.skipped).toEqual([
      { path: "test/fixture.md", reason: "excluded-directory" },
    ]);
    expect(report.clonePath).toBe(join(parent, "fixture-repo"));
    expect(r.code).toBe(1);
  });

  test("README and LICENSE only", () => {
    const r = run("./clean-repo");
    expect(r.stdout).toContain(
      "accuracy: 0 confirmed, 0 leads  (0 tables read, 0 checked, 0 unreadable)",
    );
    expect(r.stdout).not.toContain("CONFIRMED");
    expect(JSON.parse(run("./clean-repo", "--json").stdout).accuracy.verdict).toBe(
      "nothing-checkable",
    );
    expect(r.code).toBe(0);
  });

  test("a lead only", () => {
    const r = run("./lead-repo");
    expect(r.stdout).toMatch(/accuracy: 0 confirmed, [1-9]\d* leads/);
    expect(r.stdout).toContain("lead       docs/plan.md:");
    expect(r.stdout).toContain("· found by: VisiMark");
    expect(r.code).toBe(0);
  });

  test("last commit is the UTC date, as the widget reads it", () => {
    expect(JSON.parse(run("./late-repo", "--json").stdout).posture.lastCommit).toBe("2026-10-01");
  });

  test("no argument", () => {
    expect(run()).toEqual({ stdout: "", stderr: `${USAGE}\n`, code: 2 });
  });

  test("unknown option", () => {
    expect(run("acme/x", "--explain")).toEqual({
      stdout: "",
      stderr: `repo-investigate: unknown option --explain\n${USAGE}\n`,
      code: 2,
    });
  });

  test("--branch with a path", () => {
    expect(run("./fixture-repo", "--branch", "main")).toEqual({
      stdout: "",
      stderr: `repo-investigate: --branch and --force do not apply to a local path\n${USAGE}\n`,
      code: 2,
    });
  });

  test("not a work tree", () => {
    const dir = join(parent, "empty-dir");
    expect(run(dir)).toEqual({
      stdout: "",
      stderr: `repo-investigate: not a git work tree: ${dir}\n`,
      code: 2,
    });
  });

  test("bad shorthand", () => {
    expect(run("nope")).toEqual({
      stdout: "",
      stderr:
        "repo-investigate: not a recognized repo (want `owner/repo`, a git URL, or a path starting with / ./ ../): nope\n",
      code: 2,
    });
  });

  test("repo:scan is gone", () => {
    const p = Bun.spawnSync(["bun", "run", "repo:scan"], { cwd: ROOT });
    expect(p.exitCode).not.toBe(0);
    expect(p.stderr.toString()).toContain("Script not found");
  });
});
