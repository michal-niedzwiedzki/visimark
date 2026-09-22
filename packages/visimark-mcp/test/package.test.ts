import { expect, test } from "bun:test";
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
  for (const target of Object.values(manifest.bin)) {
    const mode = statSync(join(pkg, target)).mode & 0o777;
    expect({ target, mode: mode.toString(8) }).toMatchObject({ mode: "755" });
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
