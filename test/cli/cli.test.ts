import { expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const drift = readFileSync("doc/example-invoice-drift.md", "utf8");

test("check on the clean invoice exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", "doc/example-invoice.md"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("check on the drift invoice exits 1 with the transcript", async () => {
  const c = capture();
  const code = await runCli(["check", "doc/example-invoice-drift.md"], c.io);
  expect(code).toBe(1);
  const all = drift.split("\n");
  const start = all.findIndex((l) => l.trim() === "```console");
  const end = all.findIndex((l, i) => i > start && l.trim() === "```");
  const expected = all.slice(start + 2, end).join("\n"); // skip the `$ visimark` line
  expect(c.out()).toBe(expected);
});

test("eval --get prints one raw decimal value", async () => {
  const c = capture();
  const code = await runCli(
    ["eval", "doc/example-invoice.md", "--get", "lines.gross_total"],
    c.io,
  );
  expect(code).toBe(0);
  expect(c.out()).toBe("28659");
});

test("eval --get accepts a bare name and --json", async () => {
  const c = capture();
  await runCli(
    ["eval", "doc/example-invoice.md", "--get", "gross_total", "--json"],
    c.io,
  );
  expect(JSON.parse(c.out())).toEqual({ gross_total: "28659" });
});

test("fmt rewrites the file in place and is stable on a second run", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const p = join(dir, "drift.md");
  writeFileSync(p, drift);

  const c1 = capture();
  const code1 = await runCli(["fmt", p], c1.io);
  expect(code1).toBe(1); // unfixable errors remain
  expect(c1.out()).toContain("updated");
  expect(readFileSync(p, "utf8")).not.toBe(drift);

  const c2 = capture();
  await runCli(["fmt", p], c2.io);
  expect(c2.out()).toContain("unchanged");
});

test("explain prints a sheet's rules and evaluation order", async () => {
  const c = capture();
  const code = await runCli(
    ["explain", "doc/example-invoice.md", "#schedule"],
    c.io,
  );
  expect(code).toBe(0);
  expect(c.out()).toContain("Amount = Share * lines.gross_total");
  expect(c.out()).toContain("covered = SUM(Amount)");
  expect(c.out()).toMatch(/order:\s+Amount → covered/);
});

test("no command is a usage error", async () => {
  const c = capture();
  const code = await runCli([], c.io);
  expect(code).toBe(2);
  expect(c.err()).toContain("usage:");
});
