import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasLocalWork } from "./repo-pr-clone.js";
import { run } from "./proc-run.js";

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
