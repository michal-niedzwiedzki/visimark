import { expect, test } from "bun:test";
import { runCli } from "../../src/cli/main.js";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("ref with no name lists every function", async () => {
  const c = capture();
  expect(await runCli(["ref"], c.io)).toBe(0);
  expect(c.out()).toContain("EOMONTH");
  expect(c.out()).toContain("SUM");
});

test("ref NAME prints the entry", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH"], c.io)).toBe(0);
  const text = c.out();
  expect(text).toContain("EOMONTH(d, months)");
  expect(text).toContain("map, 2 arguments");
  expect(text).toContain("a non-whole `months`");
  expect(text).toContain("EOMONTH(2026-01-31, 1)");
});

test("ref reads no file and needs none", async () => {
  const c = capture();
  expect(await runCli(["ref", "SUM"], c.io)).toBe(0);
  expect(c.err()).toBe("");
});

test("an unknown name exits 2 with a suggestion", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH2"], c.io)).toBe(2);
  expect(c.err()).toContain("EOMONTH");
});

test("a name unlike anything builtin gets no misleading guess", async () => {
  const c = capture();
  expect(await runCli(["ref", "ZZZZZZZZ"], c.io)).toBe(2);
  expect(c.err()).not.toContain("did you mean");
});
