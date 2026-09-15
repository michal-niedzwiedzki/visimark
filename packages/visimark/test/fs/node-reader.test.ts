import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeReader, onDisk, realpathOr } from "../../src/fs/node-reader.js";

const dir = mkdtempSync(join(tmpdir(), "vmark-reader-"));

test("onDisk pairs a path with the node:fs reader", () => {
  expect(onDisk("/x/y.md")).toEqual({ path: "/x/y.md", reader: nodeReader });
});

test("readText returns the file's text, and null for anything unreadable", () => {
  const f = join(dir, "a.txt");
  writeFileSync(f, "hello\n");
  expect(nodeReader.readText(f)).toBe("hello\n");
  expect(nodeReader.readText(join(dir, "missing.txt"))).toBeNull();
  // a directory is the "exists but cannot be read" half that used to be a
  // separate branch in artifact/stale.ts; both still mean `missing`
  expect(nodeReader.readText(dir)).toBeNull();
});

test("readSealed returns the text and the SHA-256 of the bytes", () => {
  const f = join(dir, "b.csv");
  writeFileSync(f, "a,b\n1,2\n");
  const read = nodeReader.readSealed(f);
  expect(read?.text).toBe("a,b\n1,2\n");
  expect(read?.sha256).toBe(createHash("sha256").update("a,b\n1,2\n").digest("hex"));
});

test("readSealed refuses a symlink rather than following it", () => {
  const real = join(dir, "real.csv");
  const link = join(dir, "link.csv");
  writeFileSync(real, "x\n");
  try {
    symlinkSync(real, link);
  } catch {
    return; // Windows without elevation has no symlinks; nothing to assert
  }
  // O_NOFOLLOW, the guarantee fs/open.ts carries and the port must not lose
  expect(nodeReader.readSealed(link)).toBeNull();
  expect(nodeReader.readSealed(real)?.text).toBe("x\n");
});

test("readSealed returns null for a file that is not there", () => {
  expect(nodeReader.readSealed(join(dir, "nope.csv"))).toBeNull();
});

/**
 * The narrowing review §4.2 asks for. The old `catch { return p }` treated
 * *every* throw as "the path does not exist yet", including
 * `realpathSync is not a function` — a bundled `node:fs` stub reported as a
 * missing file, silently and forever. An errno error still takes the fallback;
 * anything else propagates.
 */
test("realpath falls back to the input for a filesystem error", () => {
  expect(nodeReader.realpath(join(dir, "not-there-yet", "x.svg"))).toBe(
    join(dir, "not-there-yet", "x.svg"),
  );
  const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  expect(
    realpathOr("/p", () => {
      throw enoent;
    }),
  ).toBe("/p");
});

test("realpath propagates a TypeError instead of mistaking it for a missing file", () => {
  expect(() =>
    realpathOr("/p", () => {
      throw new TypeError("realpathSync is not a function");
    }),
  ).toThrow("realpathSync is not a function");
});
