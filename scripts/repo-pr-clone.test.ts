import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hasLocalWork,
  scanMeta,
  usesVisimarkActionAt,
  type PreparedClone,
} from "./repo-pr-clone.js";
import { listTrackedFiles, run } from "./proc-run.js";

function withGitRepo(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "repo-pr-clone-test-"));
  try {
    run(["git", "init", "--quiet"], dir);
    run(["git", "config", "user.email", "test@example.com"], dir);
    run(["git", "config", "user.name", "test"], dir);
    writeFileSync(join(dir, "a.txt"), "x");
    run(["git", "add", "-A"], dir);
    run(["git", "commit", "-m", "init", "--quiet"], dir);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("hasLocalWork", () => {
  test("false for a directory that doesn't exist yet", () => {
    expect(hasLocalWork(join(tmpdir(), "does-not-exist-at-all-xyz"))).toBe(false);
  });

  test("false for a clean repo with no work branch", () => {
    withGitRepo((dir) => {
      expect(hasLocalWork(dir)).toBe(false);
    });
  });

  test("true when the visimark-check branch exists", () => {
    withGitRepo((dir) => {
      run(["git", "checkout", "-b", "visimark-check", "--quiet"], dir);
      expect(hasLocalWork(dir)).toBe(true);
    });
  });

  test("true when there are uncommitted changes", () => {
    withGitRepo((dir) => {
      writeFileSync(join(dir, "b.txt"), "uncommitted");
      expect(hasLocalWork(dir)).toBe(true);
    });
  });
});

describe("usesVisimarkActionAt", () => {
  test("reads the workflows at the commit, not the work tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "uses-action-"));
    const git = (...args: string[]) =>
      run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
        dir,
      );
    try {
      git("init", "-q");
      mkdirSync(join(dir, ".github/workflows"), { recursive: true });
      writeFileSync(
        join(dir, ".github/workflows/ci.yml"),
        "steps:\n  - uses: actions/checkout@v4\n",
      );
      git("add", "-A");
      git("commit", "-q", "-m", "ci");
      const plain = git("rev-parse", "HEAD").stdout;
      expect(usesVisimarkActionAt(dir, plain)).toBe(false);

      // repo:pr's own workflow on its work branch does not count as adoption.
      writeFileSync(
        join(dir, ".github/workflows/visimark.yml"),
        "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.4.1\n",
      );
      git("add", "-A");
      git("commit", "-q", "-m", "add");
      expect(usesVisimarkActionAt(dir, plain)).toBe(false);
      expect(usesVisimarkActionAt(dir, git("rev-parse", "HEAD").stdout)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("false when the commit has no workflows", () => {
    const dir = mkdtempSync(join(tmpdir(), "uses-action-"));
    try {
      run(["git", "init", "-q"], dir);
      expect(usesVisimarkActionAt(dir, "HEAD")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("inherited git repository-context variables", () => {
  test("usesVisimarkActionAt and listTrackedFiles still use the supplied cwd", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-env-"));
    const other = mkdtempSync(join(tmpdir(), "git-env-other-"));
    const saved = {
      GIT_DIR: process.env.GIT_DIR,
      GIT_WORK_TREE: process.env.GIT_WORK_TREE,
      GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
    };
    try {
      run(["git", "init", "-q"], dir);
      run(["git", "init", "-q"], other);
      mkdirSync(join(dir, ".github/workflows"), { recursive: true });
      writeFileSync(
        join(dir, ".github/workflows/ci.yml"),
        "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.4.1\n",
      );
      writeFileSync(join(dir, "a.md"), "x");
      const git = (...args: string[]) =>
        run(
          [
            "git",
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@t",
            "-c",
            "commit.gpgsign=false",
            ...args,
          ],
          dir,
        );
      git("add", "-A");
      git("commit", "-q", "-m", "init");

      process.env.GIT_DIR = join(other, ".git");
      process.env.GIT_WORK_TREE = other;
      process.env.GIT_INDEX_FILE = join(other, ".git", "index");
      expect(usesVisimarkActionAt(dir, "HEAD")).toBe(true);
      expect(listTrackedFiles(dir, ["*.md"])).toEqual(["a.md"]);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(dir, { recursive: true, force: true });
      rmSync(other, { recursive: true, force: true });
    }
  });
});

describe("scanMeta", () => {
  const clone: PreparedClone = {
    status: "ready",
    host: "github.com",
    label: "o/r",
    cloneUrl: "https://github.com/o/r.git",
    sha: "remote-sha",
    workdir: "/cache/o-r",
    defaultBranch: "main",
    reusedLocalWork: false,
  };

  test("a fresh clone is the remote commit, with permalinks", () => {
    expect(scanMeta(clone, () => "local-head")).toEqual({
      label: "o/r",
      host: "github.com",
      commit: "remote-sha",
      clonePath: "/cache/o-r",
    });
  });

  test("reused local work is its own HEAD, with no permalinks", () => {
    expect(scanMeta({ ...clone, reusedLocalWork: true }, () => "local-head")).toEqual({
      label: "o/r",
      host: null,
      commit: "local-head",
      clonePath: "/cache/o-r",
    });
  });
});
