import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "sqrt-braces.md");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the SQRT brace-schedule fixture exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --get resolves the longest brace length", async () => {
  const c = capture();
  const code = await runCli(["eval", fixture, "--get", "braces.longest"], c.io);
  expect(code).toBe(0);
  // `eval` prints the raw decimal for scripts; the padded `6708.20` is the
  // write form, exercised by the clean `check` above (the anchor is non-stale).
  expect(c.out()).toBe("6708.2");
});
