import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const launcher = join(pkgDir, "bin", "visimark");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version as string;
const expectedVersion = `visimark ${version}`;

function toolPath(name: string): string {
  return spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
}

test("launcher prints the version and exits 0", () => {
  const r = spawnSync(launcher, ["--version"], { encoding: "utf8" });
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe(expectedVersion);
});

test("launcher runs `check` on a document", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const doc = join(dir, "smoke.md");
  writeFileSync(doc, "# smoke\n\nNo arithmetic here.\n");
  const r = spawnSync(launcher, ["check", doc], { encoding: "utf8" });
  expect(r.status).toBe(0);
});

test("launcher resolves through a symlink chain", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const link = join(dir, "visimark");
  symlinkSync(launcher, link);
  const r = spawnSync(link, ["--version"], { encoding: "utf8" });
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe(expectedVersion);
});

test("launcher exits 127 with a message when no runtime is on PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const fakeBin = join(dir, "bin");
  mkdirSync(fakeBin);
  for (const tool of ["readlink", "dirname"]) {
    const p = toolPath(tool);
    if (p) symlinkSync(p, join(fakeBin, tool));
  }
  const r = spawnSync("/bin/sh", [launcher, "--version"], {
    encoding: "utf8",
    env: { PATH: fakeBin },
  });
  expect(r.status).toBe(127);
  expect(r.stderr).toContain("needs Node.js or Bun on PATH");
});
