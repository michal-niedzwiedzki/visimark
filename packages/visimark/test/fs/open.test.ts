import { describe, expect, test } from "bun:test";
import { closeSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openForRead, openForWrite } from "../../src/fs/open.js";

const scratch = (): string => mkdtempSync(join(tmpdir(), "vmark-open-"));

const opened = (r: { ok: number } | { err: string }): number => {
  if ("err" in r) throw new Error("expected an fd, got: " + r.err);
  return r.ok;
};

test("openForWrite creates a file that was absent", () => {
  const d = scratch();
  const fd = opened(openForWrite(join(d, "new.svg"), false));
  closeSync(fd);
  expect(readFileSync(join(d, "new.svg"), "utf8")).toBe("");
});

test("openForWrite refuses a file that appeared since the verdict", () => {
  const d = scratch();
  writeFileSync(join(d, "planted.svg"), "someone else's");
  const r = openForWrite(join(d, "planted.svg"), false);
  expect(r).toEqual({
    err: "`" + join(d, "planted.svg") + "` changed between the check and the write",
  });
});

test("openForWrite opens an existing file when one was expected", () => {
  const d = scratch();
  writeFileSync(join(d, "ours.svg"), "<svg/>");
  closeSync(opened(openForWrite(join(d, "ours.svg"), true)));
});

test("openForWrite refuses an expected-existing file that vanished", () => {
  const d = scratch();
  const r = openForWrite(join(d, "gone.svg"), true);
  expect(r).toEqual({
    err: "`" + join(d, "gone.svg") + "` disappeared between the check and the write",
  });
});

test("openForRead reads a regular file", () => {
  const d = scratch();
  writeFileSync(join(d, "data.csv"), "a,b\n1,2\n");
  const fd = opened(openForRead(join(d, "data.csv")));
  expect(readFileSync(fd, "utf8")).toBe("a,b\n1,2\n");
  closeSync(fd);
});

// Windows has no symlink without Developer Mode or elevation, and no
// O_NOFOLLOW to refuse one with — see the note in src/fs/open.ts
describe.skipIf(process.platform === "win32")("symlinks", () => {
  const swapped = "` changed between the check and the write";

  test("O_EXCL refuses a symlink pointing at a live file", () => {
    const d = scratch();
    writeFileSync(join(d, "victim"), "SECRET");
    symlinkSync(join(d, "victim"), join(d, "link.svg"));
    expect(openForWrite(join(d, "link.svg"), false)).toEqual({
      err: "`" + join(d, "link.svg") + swapped,
    });
    expect(readFileSync(join(d, "victim"), "utf8")).toBe("SECRET");
  });

  // the case a plain existsSync() misses: the link is there, its target is not
  test("O_EXCL refuses a dangling symlink", () => {
    const d = scratch();
    symlinkSync(join(d, "nowhere"), join(d, "link.svg"));
    expect(openForWrite(join(d, "link.svg"), false)).toEqual({
      err: "`" + join(d, "link.svg") + swapped,
    });
  });

  test("O_NOFOLLOW refuses a symlink on the overwrite path", () => {
    const d = scratch();
    writeFileSync(join(d, "victim"), "SECRET");
    symlinkSync(join(d, "victim"), join(d, "link.svg"));
    expect(openForWrite(join(d, "link.svg"), true)).toEqual({
      err: "`" + join(d, "link.svg") + swapped,
    });
    expect(readFileSync(join(d, "victim"), "utf8")).toBe("SECRET");
  });

  test("O_NOFOLLOW refuses a symlink on the read path", () => {
    const d = scratch();
    writeFileSync(join(d, "victim.csv"), "secret,data\n");
    symlinkSync(join(d, "victim.csv"), join(d, "link.csv"));
    expect("err" in openForRead(join(d, "link.csv"))).toBe(true);
  });
});
