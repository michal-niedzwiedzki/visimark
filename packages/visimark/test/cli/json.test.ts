import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertFailPath, cleanPath, drift, driftPath } from "../examples.js";
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

test("eval --json uses the envelope, not a flat map", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("eval");
  expect(j.visimark).toBe(version);
  expect(j.status).toBe("ok");
  expect(j.file).toBe(cleanPath);
  expect(j.vat).toBeUndefined();
  const values = j.values as Record<string, unknown>;
  expect(values.vat).toBe("0.23");
  expect(values["lines.gross_total"]).toBe("28659");
  expect(values["lines.Net"]).toEqual(["3600", "14080", "2500", "3120"]);
  const assertions = j.assertions as { sheet: string; holds: boolean }[];
  expect(assertions[0]).toMatchObject({ sheet: "recon", holds: true });
  expect(Array.isArray(j.charts)).toBe(true);
});

test("eval --get --json is the same envelope with one values key", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--get", "gross_total", "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(Object.keys(j.values as object)).toEqual(["gross_total"]);
  expect((j.values as { gross_total: string }).gross_total).toBe("28659");
  expect(Array.isArray(j.assertions)).toBe(true);
});

test("eval --json on a false assertion: problems, quiet stderr", async () => {
  const c = capture();
  expect(await runCli(["eval", assertFailPath, "--json"], c.io)).toBe(1);
  expect(c.err()).not.toContain("ASSERT");
  const j = parseOut(c);
  expect(j.status).toBe("problems");
  const assertions = j.assertions as { holds: boolean }[];
  expect(assertions.some((a) => a.holds === false)).toBe(true);
});

test("eval --get nope --json: USAGE envelope, message on stderr", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--get", "nope", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("no value named nope");
  const j = parseOut(c);
  expect(j).toMatchObject({
    command: "eval",
    status: "error",
    error: { code: "USAGE" },
  });
});

test("eval --json column with a null cell", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "hole.md");
  writeFileSync(
    p,
    "| Item | Price | Qty | Net |\n|------|------:|----:|----:|\n| a    |  1.00 |   2 | 2.00 |\n| b    |       |   2 |      |\n\n```vmark #t\nNet = Price * Qty\n```\n",
  );
  const c = capture();
  await runCli(["eval", p, "--json"], c.io);
  const values = parseOut(c).values as { "t.Net": (string | null)[] };
  expect(values["t.Net"][0]).toBe("2");
  expect(values["t.Net"][1]).toBeNull();
});

test("fmt --json reports post-write facts and still rewrites the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "drift.md");
  writeFileSync(p, drift);
  const c1 = capture();
  const code1 = await runCli(["fmt", p, "--json"], c1.io);
  expect(code1).toBe(1);
  const j1 = parseOut(c1);
  expect(j1.command).toBe("fmt");
  expect(j1.status).toBe("problems");
  const f1 = (j1.files as { changed: boolean; cellsUpdated: number; path: string }[])[0]!;
  expect(f1.path).toBe(p);
  expect(f1.changed).toBe(true);
  expect(f1.cellsUpdated).toBeGreaterThan(0);
  expect(readFileSync(p, "utf8")).not.toBe(drift);

  const c2 = capture();
  await runCli(["fmt", p, "--json"], c2.io);
  const f2 = (parseOut(c2).files as { changed: boolean }[])[0]!;
  expect(f2.changed).toBe(false);
});

test("fmt --json with no files: USAGE, exit 2", async () => {
  const c = capture();
  expect(await runCli(["fmt", "--json"], c.io)).toBe(2);
  expect(parseOut(c)).toMatchObject({ command: "fmt", status: "error", error: { code: "USAGE" } });
});

test("infer --json lists proposals and has no written key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "plain.md");
  writeFileSync(p, "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
  const c = capture();
  expect(await runCli(["infer", p, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("infer");
  expect(j.status).toBe("ok");
  const file = (j.files as { proposals: unknown[]; written?: unknown }[])[0]!;
  expect(file.written).toBeUndefined();
  expect(Array.isArray(file.proposals)).toBe(true);
});

test("infer --write --json reports written.marker and still writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "plain.md");
  writeFileSync(p, "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
  const c = capture();
  expect(await runCli(["infer", p, "--write", "--json"], c.io)).toBe(0);
  const file = (
    parseOut(c).files as { written: { marker: boolean; blocks: number; anchors: number } }[]
  )[0]!;
  expect(file.written.marker).toBe(true);
  expect(readFileSync(p, "utf8")).toContain("<!--vmark:no-formulas-->");
});

test("explain --json lists schedule.Amount rule from source text", async () => {
  const c = capture();
  expect(await runCli(["explain", cleanPath, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("explain");
  expect(j.file).toBe(cleanPath);
  const sheets = j.sheets as { id: string; rules: { name: string; rule: string }[] }[];
  const schedule = sheets.find((s) => s.id === "schedule");
  expect(schedule?.rules.some((r) => r.rule.includes("Share * lines.gross_total"))).toBe(true);
});

test("explain --json echoes Σ as written, not SUM", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "sigma.md");
  writeFileSync(
    p,
    `| Item | Price | Qty |  Net |\n|------|------:|----:|-----:|\n| pen  |  5.00 |   2 | 10.00 |\n\n\`\`\`vmark #order\nNet = Price * Qty\ntotal = Σ(Net)\n\`\`\`\n`,
  );
  const c = capture();
  expect(await runCli(["explain", p, "--json"], c.io)).toBe(0);
  const sheets = parseOut(c).sheets as { scalars: { rule: string }[] }[];
  const rules = sheets.flatMap((s) => s.scalars.map((x) => x.rule)).join("\n");
  expect(rules).toContain("Σ(Net)");
  expect(rules).not.toContain("SUM(Net)");
});

test("explain --json unknown sheet: USAGE, exit 2", async () => {
  const c = capture();
  expect(await runCli(["explain", cleanPath, "#nope", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("no sheet #nope");
  expect(parseOut(c)).toMatchObject({
    command: "explain",
    status: "error",
    error: { code: "USAGE" },
  });
});
