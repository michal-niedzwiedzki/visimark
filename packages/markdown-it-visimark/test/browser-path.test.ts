import { expect, test } from "bun:test";
import { posix, win32 } from "node:path";
import { dirname, isAbsolute, resolve, sep } from "../src/browser-path.js";

/**
 * The published bundle's `node:path`. The engine's containment check runs on
 * it, so it is pinned against the modules it replaces, over exactly the calls
 * `packages/visimark/src/fs/gate.ts` makes: `dirname(resolve(doc.path))`,
 * `resolve(base, url)`, `isAbsolute`, and `sep`. A drive-letter path is
 * compared with `node:path.win32` after `\` → `/`, because `sep` is one
 * constant and is `/` (spec §2.6).
 */

const fwd = (s: string): string => s.replace(/\\/g, "/");
const WINDOWS = [
  "C:\\notes\\note.md",
  "C:/notes/note.md",
  "c:\\a\\b\\",
  "D:\\",
  "C:\\a\\..\\b\\x.md",
  "C:/a//b/./c.md",
];
const POSIX = ["/", "/a", "/a/b/c.md", "/a/../b", "/a//b", "notes/q3.md"];
const IMPORTS = ["rows.csv", "sub/rows.csv", "../x.csv", "./a/../rows.csv"];

test("sep is the one constant the gate's contains() reads", () => {
  expect(sep).toBe("/");
});

test("drive-letter paths agree with node:path.win32, separators normalised", () => {
  for (const p of WINDOWS) {
    expect(isAbsolute(p)).toBe(true);
    const base = dirname(resolve(p));
    expect(base).toBe(fwd(win32.dirname(win32.resolve(p))));
    for (const url of [...IMPORTS, "sub\\rows.csv"]) {
      expect(resolve(base, url)).toBe(fwd(win32.resolve(win32.dirname(win32.resolve(p)), url)));
    }
  }
});

test("every other path agrees with node:path.posix, relative rooted at /", () => {
  for (const p of POSIX) {
    const rooted = p.startsWith("/") ? p : "/" + p;
    expect(isAbsolute(p)).toBe(posix.isAbsolute(p));
    const base = dirname(resolve(p));
    expect(base).toBe(posix.dirname(posix.resolve(rooted)));
    for (const url of IMPORTS) {
      expect(resolve(base, url)).toBe(posix.resolve(posix.dirname(posix.resolve(rooted)), url));
    }
  }
});

test("a drive-letter import URL is absolute, so the gate refuses it before resolving", () => {
  expect(isAbsolute("C:\\x.csv")).toBe(true);
  expect(isAbsolute("rows.csv")).toBe(false);
});
