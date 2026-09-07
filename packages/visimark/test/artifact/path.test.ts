import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveArtifactPath } from "../../src/artifact/path.js";

const dir = mkdtempSync(join(tmpdir(), "vmark-path-"));
const doc = join(dir, "report.md");
writeFileSync(doc, "# x\n");

const ok = (url: string) => resolveArtifactPath(doc, url);
const err = (url: string) => {
  const r = resolveArtifactPath(doc, url);
  if ("ok" in r) throw new Error(`expected refusal for ${url}, got ${r.ok}`);
  return r.err;
};

test("a plain relative .svg beside the document is accepted", () => {
  expect(ok("chart.svg")).toEqual({ ok: join(dir, "chart.svg") });
});

test("a subdirectory under the document's directory is accepted", () => {
  expect(ok("charts/a/b.svg")).toEqual({ ok: join(dir, "charts/a/b.svg") });
});

test("absolute paths are refused", () => {
  expect(err("/etc/x.svg")).toBe("artifact path must be relative");
  expect(err("C:\\windows\\x.svg")).toContain("drive letter");
});

test("traversal out of the document's directory is refused", () => {
  expect(err("../x.svg")).toBe("artifact path escapes the document's directory");
  expect(err("charts/../../x.svg")).toBe("artifact path escapes the document's directory");
});

test("traversal that stays inside is accepted", () => {
  expect(ok("charts/../x.svg")).toEqual({ ok: join(dir, "x.svg") });
});

test("a non-svg extension is refused", () => {
  expect(err("x.png")).toBe("artifact path must end in `.svg`");
  expect(err("x.SVG")).toBe("artifact path must end in `.svg`");
  expect(err("notes.md")).toBe("artifact path must end in `.svg`");
});

test("a URL is refused", () => {
  expect(err("https://example.com/x.svg")).toContain("not a URL");
});

test("windows device names are refused", () => {
  expect(err("CON.svg")).toContain("reserved device name");
  expect(err("charts/com1.svg")).toContain("reserved device name");
});

test("control characters are refused", () => {
  expect(err("a\u0000b.svg")).toBe("artifact path contains a control character");
});

test("a symlink escaping the directory is refused", () => {
  const outside = mkdtempSync(join(tmpdir(), "vmark-out-"));
  mkdirSync(join(dir, "linked"), { recursive: true });
  const link = join(dir, "escape");
  try {
    symlinkSync(outside, link, "dir");
  } catch {
    return; // no symlink permission on this platform
  }
  expect(err("escape/x.svg")).toContain("symlink");
});
