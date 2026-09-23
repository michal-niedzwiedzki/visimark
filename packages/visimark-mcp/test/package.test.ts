import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import manifest from "../package.json" with { type: "json" };

const pkg = join(import.meta.dir, "..");

/** Every path an `exports` condition can resolve to, as a published path. */
function exportTargets(node: unknown, into: string[] = []): string[] {
  if (typeof node === "string") into.push(node);
  else if (node && typeof node === "object") {
    for (const value of Object.values(node)) exportTargets(value, into);
  }
  return into;
}

const shipped = manifest.files as string[];

function rootOf(target: string): string {
  return target.replace(/^\.\//, "").split("/")[0]!;
}

test("every exports target is inside a published files entry", () => {
  // `files` is what npm puts in the tarball. An `exports` condition pointing
  // outside it — the "bun" condition at ./src/index.ts, with only dist shipped
  // — is not a degraded run for that consumer: Bun resolves the condition
  // first, finds nothing, and fails the whole package resolution (#170).
  for (const target of exportTargets(manifest.exports)) {
    expect({ target, shipped }).toMatchObject({
      shipped: expect.arrayContaining([rootOf(target)]),
    });
  }
});

test("every bin target is inside a published files entry", () => {
  // Same failure mode one slot over: a `bin` outside `files` installs as a
  // dangling link rather than a command.
  for (const target of Object.values(manifest.bin)) {
    expect({ target, shipped }).toMatchObject({
      shipped: expect.arrayContaining([rootOf(target)]),
    });
  }
});

test("every bin target is executable", () => {
  // An unexecutable bin is a broken global install that no other unit test
  // catches — the failure only shows up after `npm i -g`.
  //
  // The assertion is the execute bits, not an exact mode: the group and other
  // permissions a checkout lands on come from the checking-out user's umask,
  // so `755` here and `775` on a umask-002 machine are the same file. What
  // git records, and what npm therefore packs, is only the executable bit.
  for (const target of Object.values(manifest.bin)) {
    const mode = statSync(join(pkg, target)).mode;
    expect({ target, executable: (mode & 0o111) === 0o111 }).toMatchObject({
      executable: true,
    });
  }
});

test("git records every bin target as executable", () => {
  // The on-disk check above is about this working tree; this one is about
  // what every other clone and every CI runner will get. A bin committed as
  // 100644 installs as a dangling command no matter whose umask is involved.
  const listed = spawnSync("git", ["ls-files", "-s", "--", "bin"], {
    cwd: pkg,
    encoding: "utf8",
  });
  expect(listed.status).toBe(0);
  for (const line of listed.stdout.trim().split("\n")) {
    const [mode, , , path] = line.split(/\s+/);
    expect({ path, mode }).toMatchObject({ mode: "100755" });
  }
});

test("the bin target is an sh launcher and the payload keeps the node shebang", () => {
  // Both halves of .agents/rules/runtime-parity.md, pinned. `bun install -g`
  // links a bin as a bare symlink rather than writing a launcher shim, so a
  // `#!/usr/bin/env node` shebang in the `bin` slot makes the kernel hunt for
  // `node` and abort before Bun is ever consulted — that is #29. The payload
  // keeps that shebang on purpose: it is only ever executed as an argument.
  const launcher = readFileSync(join(pkg, "bin/visimark-mcp"), "utf8");
  const payload = readFileSync(join(pkg, "bin/visimark-mcp.js"), "utf8");

  expect(launcher.startsWith("#!/bin/sh\n")).toBe(true);
  expect(launcher.startsWith("#!/usr/bin/env node")).toBe(false);
  expect(payload.startsWith("#!/usr/bin/env node\n")).toBe(true);
  expect(manifest.bin["visimark-mcp"]).toBe("bin/visimark-mcp");
});

test("visimark is pinned exactly, not by a range", () => {
  // Lockstep (spec §5.2): the server imports the engine as a library, so a
  // caret would let a published server pair with an engine it was never
  // tested against. CI's version-agreement check (task 8) asserts the value.
  expect(manifest.dependencies.visimark).toMatch(/^\d+\.\d+\.\d+$/);
  expect(manifest.dependencies["@modelcontextprotocol/sdk"]).toMatch(/^\d+\.\d+\.\d+$/);
});
