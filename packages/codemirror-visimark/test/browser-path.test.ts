import { expect, test } from "bun:test";
import { posix } from "node:path";
import { dirname, isAbsolute, resolve, sep } from "../src/browser-path.js";

/**
 * `src/browser-path.ts` is what `main.js` carries in place of `node:path`, and
 * the engine's containment check runs on it. A shim that is subtly wrong here
 * is a path gate that is subtly wrong, which is the one kind of bug in this
 * repository that has a security shape.
 *
 * So it is not tested against expectations typed out by hand; it is pinned
 * against `node:path.posix`, the thing it replaces, over every input shape the
 * gate can produce.
 */

const PATHS = [
  "/",
  "/a",
  "/a/b",
  "/a/b/",
  "/a/b/c.md",
  "a",
  "a/b",
  "a/b/c.md",
  "./a/b",
  "../a",
  "/a/../b",
  "/a/./b",
  "/a//b",
  "notes/2026/q3.md",
  "notes with spaces/a b.md",
  "",
];

test("dirname agrees with path.posix", () => {
  for (const p of PATHS) {
    expect(dirname(p), `dirname(${JSON.stringify(p)})`).toBe(posix.dirname(p));
  }
});

test("isAbsolute agrees with path.posix", () => {
  for (const p of PATHS) {
    expect(isAbsolute(p), `isAbsolute(${JSON.stringify(p)})`).toBe(posix.isAbsolute(p));
  }
});

test("sep is the posix separator", () => {
  expect(sep).toBe(posix.sep);
});

test("resolve of an absolute path agrees with path.posix", () => {
  const absolute = PATHS.filter((p) => p.startsWith("/"));
  for (const p of absolute) {
    expect(resolve(p), `resolve(${JSON.stringify(p)})`).toBe(posix.resolve(p));
  }
});

test("resolve of two segments agrees with path.posix", () => {
  for (const base of ["/", "/a", "/a/b", "/notes/2026"]) {
    for (const rel of ["c.md", "./c.md", "../c.md", "d/e.md", "../../x.md", "/abs.md"]) {
      expect(resolve(base, rel), `resolve(${base}, ${rel})`).toBe(posix.resolve(base, rel));
    }
  }
});

test("resolve of a bare relative path roots it at the vault root, not a cwd", () => {
  // the one documented difference from path.posix: a browser has no
  // process.cwd(), and a vault path is relative to the vault root, so `/` is
  // the only honest base — and it is the containment boundary the plugin wants
  for (const p of ["a", "a/b", "a/b/c.md", "./a/b", "notes/2026/q3.md"]) {
    expect(resolve(p), `resolve(${JSON.stringify(p)})`).toBe(posix.resolve("/", p));
  }
});

test("resolve cannot climb above the vault root", () => {
  // what the gate's containment check leans on: nothing relative escapes `/`
  for (const p of ["..", "../..", "../../etc/passwd", "a/../../..", "/../.."]) {
    expect(resolve(p).startsWith("/"), `resolve(${JSON.stringify(p)})`).toBe(true);
    expect(resolve(p)).not.toContain("..");
  }
});
