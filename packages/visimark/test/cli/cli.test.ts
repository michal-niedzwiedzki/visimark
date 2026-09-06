import { expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { cleanPath, drift, driftPath } from "../examples.js";
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

test("check on the clean invoice exits 0", async () => {
  const c = capture();
  const code = await runCli(["check", cleanPath], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("check on the drift invoice exits 1 with the transcript", async () => {
  const c = capture();
  const code = await runCli(["check", driftPath], c.io);
  expect(code).toBe(1);
  const all = drift.split("\n");
  const start = all.findIndex((l) => l.trim() === "```console");
  const end = all.findIndex((l, i) => i > start && l.trim() === "```");
  const expected = all.slice(start + 2, end); // skip the `$ visimark` line
  // The transcript's first line is the display path — whatever path the CLI
  // was handed. The rest is the report, and must match byte for byte.
  const [pathLine, ...body] = c.out().split("\n");
  expect(pathLine).toBe(driftPath);
  expect(body.join("\n")).toBe(expected.slice(1).join("\n"));
});

test("eval --get prints one raw decimal value", async () => {
  const c = capture();
  const code = await runCli(["eval", cleanPath, "--get", "lines.gross_total"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe("28659");
});

test("eval --get accepts a bare name and --json", async () => {
  const c = capture();
  await runCli(["eval", cleanPath, "--get", "gross_total", "--json"], c.io);
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
  const code = await runCli(["explain", cleanPath, "#schedule"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("Amount = Share * lines.gross_total");
  expect(c.out()).toContain("covered = SUM(Amount)");
  expect(c.out()).toMatch(/order:\s+Amount → covered/);
});

const plainDoc = (name: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const p = join(dir, name);
  writeFileSync(p, "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
  return p;
};

test("check fails a document whose table has no rules, with no flag passed", async () => {
  const c = capture();
  expect(await runCli(["check", plainDoc("plain.md")], c.io)).toBe(1);
  expect(c.out()).toContain("COVERAGE");
});

test("infer --write clears the coverage failure it is pointed at", async () => {
  const p = plainDoc("mark-me.md");
  await runCli(["infer", p, "--write"], capture().io);
  expect(readFileSync(p, "utf8")).toContain("<!--vmark:no-formulas-->");

  const c = capture();
  expect(await runCli(["check", p], c.io)).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("check passes a document that has a formula", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath], c.io)).toBe(0);
});

test("an unrecognised flag is ignored rather than failing the run", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath, "--require-formulas"], c.io)).toBe(0);
});

const pkgVersion = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
  .version as string;

test("--version prints `visimark <version>` and exits 0", async () => {
  const c = capture();
  const code = await runCli(["--version"], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(`visimark ${pkgVersion}`);
});

test("-v and `version` behave the same as --version", async () => {
  for (const arg of ["-v", "version"]) {
    const c = capture();
    const code = await runCli([arg], c.io);
    expect(code).toBe(0);
    expect(c.out()).toBe(`visimark ${pkgVersion}`);
  }
});

test("no command is a usage error", async () => {
  const c = capture();
  const code = await runCli([], c.io);
  expect(code).toBe(2);
  expect(c.err()).toContain("usage:");
});

test("a document whose only finding is advice prints 0 problems and exits 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const p = join(dir, "warn.md");
  writeFileSync(
    p,
    "| Item | Price | Qty |   Net |\n|------|------:|----:|------:|\n| pen  |  5.00 |  10 | 50.00 |\n\n```vmark #order\nNet    = Price * Qty\nunused = SUM(Net)\n```\n",
  );
  const c = capture();
  expect(await runCli(["check", p], c.io)).toBe(0);
  expect(c.out()).toContain("WARN");
  expect(c.out()).toContain("0 problems");
});
