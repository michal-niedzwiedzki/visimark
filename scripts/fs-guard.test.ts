import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isConfined } from "./fs-guard.js";

function withTempDir(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "fs-guard-test-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("isConfined", () => {
  test("a plain path that doesn't exist yet is confined", () => {
    withTempDir((root) => {
      expect(isConfined(root, join(root, "a", "b.txt"))).toBe(true);
    });
  });

  test("a plain existing file under root is confined", () => {
    withTempDir((root) => {
      const target = join(root, "b.txt");
      writeFileSync(target, "x");
      expect(isConfined(root, target)).toBe(true);
    });
  });

  test("refuses a target outside root", () => {
    withTempDir((root) => {
      expect(isConfined(root, join(root, "..", "escaped.txt"))).toBe(false);
    });
  });

  test("refuses root itself", () => {
    withTempDir((root) => {
      expect(isConfined(root, root)).toBe(false);
    });
  });

  test("refuses when the target itself is a symlink", () => {
    withTempDir((root) => {
      const outside = mkdtempSync(join(tmpdir(), "fs-guard-outside-"));
      try {
        const target = join(root, "link.txt");
        symlinkSync(join(outside, "nonexistent"), target);
        expect(isConfined(root, target)).toBe(false);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  test("refuses when a parent directory component is a symlink", () => {
    withTempDir((root) => {
      const outside = mkdtempSync(join(tmpdir(), "fs-guard-outside-"));
      try {
        symlinkSync(outside, join(root, "workflows"));
        expect(isConfined(root, join(root, "workflows", "visimark.yml"))).toBe(false);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  test("an ordinary nested directory that exists is confined", () => {
    withTempDir((root) => {
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      expect(isConfined(root, join(root, ".github", "workflows", "visimark.yml"))).toBe(true);
    });
  });
});
