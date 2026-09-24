import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeWriter } from "../../src/fs/node-writer.js";

const dir = mkdtempSync(join(tmpdir(), "vmark-writer-"));

test("writeText replaces a file's content in full", () => {
  const f = join(dir, "a.md");
  writeFileSync(f, "before\n");
  const r = nodeWriter.writeText(f, "after\n");
  expect(r).toEqual({ ok: true });
  expect(readFileSync(f, "utf8")).toBe("after\n");
});

test("writeText creates a file that does not exist yet", () => {
  const f = join(dir, "new.md");
  const r = nodeWriter.writeText(f, "hello\n");
  expect(r).toEqual({ ok: true });
  expect(readFileSync(f, "utf8")).toBe("hello\n");
});

test("writeText reports an error rather than throwing, for a path whose directory does not exist", () => {
  const f = join(dir, "no-such-dir", "a.md");
  const r = nodeWriter.writeText(f, "x\n");
  expect("err" in r).toBe(true);
  expect("ok" in r).toBe(false);
});
