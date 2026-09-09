import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "floor-nodes.md");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the FLOOR kubernetes-capacity fixture exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --get resolves MaxNodes", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "kubernetes.MaxNodes"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("48");
});

test("eval --get resolves UsableCPU", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "kubernetes.UsableCPU"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("307");
});
