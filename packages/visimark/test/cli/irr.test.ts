import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

const fixture = fileURLToPath(new URL("../fixtures/irr-press.md", import.meta.url));

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("check on the brake-press rate note exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", fixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(`${fixture}\n\n  0 problems (0 stale, 0 errors)`);
  expect(c.err()).toBe("");
});

test("eval --get prints the rate and the hurdle", async () => {
  const rate = capture();
  expect(await runCli(["eval", fixture, "--get", "project.rate"], rate.io)).toBe(0);
  expect(rate.out()).toBe("0.1204");

  const hurdle = capture();
  expect(await runCli(["eval", fixture, "--get", "project.hurdle"], hurdle.io)).toBe(0);
  expect(hurdle.out()).toBe("0.08");
});
