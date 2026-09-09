import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanPath, driftPath } from "../examples.js";
import { runCli } from "../../src/cli/main.js";

const version = (createRequire(import.meta.url)("../../package.json") as { version: string })
  .version;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

function parseOut(c: ReturnType<typeof capture>): Record<string, unknown> {
  return JSON.parse(c.out()) as Record<string, unknown>;
}

test("check --json on the clean invoice: envelope, empty findings, exit 0", async () => {
  const c = capture();
  const code = await runCli(["check", cleanPath, "--json"], c.io);
  expect(code).toBe(0);
  expect(c.err()).toBe("");
  const j = parseOut(c);
  expect(j.command).toBe("check");
  expect(j.visimark).toBe(version);
  expect(j.status).toBe("ok");
  expect(j.error).toBeUndefined();
  const files = j.files as { path: string; findings: unknown[]; summary: { problems: number } }[];
  expect(files).toHaveLength(1);
  expect(files[0]!.path).toBe(cleanPath);
  expect(files[0]!.findings).toEqual([]);
  expect(files[0]!.summary.problems).toBe(0);
  expect(j.summary).toEqual({ files: 1, problems: 0, stale: 0, errors: 0 });
  expect(c.out().startsWith("{\n  ")).toBe(true);
});

test("check --json on the drift invoice: STALE is a problem with string details", async () => {
  const c = capture();
  const code = await runCli(["check", driftPath, "--json"], c.io);
  expect(code).toBe(1);
  const j = parseOut(c);
  expect(j.status).toBe("problems");
  const files = j.files as {
    findings: { code: string; class: string; details: Record<string, unknown> }[];
  }[];
  const stale = files[0]!.findings.find((f) => f.code === "STALE");
  expect(stale?.class).toBe("problem");
  expect(typeof stale?.details.stored).toBe("string");
  expect(typeof stale?.details.computed).toBe("string");
});

test("check --json with only WARN: status ok, class advice, exit 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "warn.md");
  writeFileSync(
    p,
    "| Item | Price | Qty |   Net |\n|------|------:|----:|------:|\n| pen  |  5.00 |  10 | 50.00 |\n\n```vmark #order\nNet    = Price * Qty\nunused = SUM(Net)\n```\n",
  );
  const c = capture();
  expect(await runCli(["check", p, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.status).toBe("ok");
  const files = j.files as { findings: { code: string; class: string }[] }[];
  expect(files[0]!.findings.some((f) => f.code === "WARN" && f.class === "advice")).toBe(true);
});

test("check --json with no files: USAGE on stdout, usage on stderr, exit 2", async () => {
  const c = capture();
  expect(await runCli(["check", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("usage: visimark check");
  const j = parseOut(c);
  expect(j).toMatchObject({
    command: "check",
    visimark: version,
    status: "error",
    error: { code: "USAGE" },
  });
  expect(String((j.error as { message: string }).message)).toContain("usage:");
});

test("check --json multi-file with one unreadable: READ, exit 2, other file listed", async () => {
  const missing = join(mkdtempSync(join(tmpdir(), "visimark-json-")), "nope.md");
  const c = capture();
  expect(await runCli(["check", cleanPath, missing, "--json"], c.io)).toBe(2);
  const j = parseOut(c);
  expect(j.status).toBe("error");
  const files = j.files as { path: string; error?: { code: string }; findings?: unknown[] }[];
  expect(files).toHaveLength(2);
  expect(files[0]).toMatchObject({ path: cleanPath });
  expect(files[0]!.findings).toEqual([]);
  expect(files[1]).toMatchObject({ path: missing, error: { code: "READ" } });
  expect(files[1]!.findings).toBeUndefined();
});

test("check FILE --jsonn is ignored: human text, not JSON", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath, "--jsonn"], c.io)).toBe(0);
  expect(c.out()).toContain("0 problems");
  expect(() => JSON.parse(c.out())).toThrow();
});
