import { expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { cleanPath, drift, driftPath } from "../examples.js";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
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
  const j = JSON.parse(c.out()) as { values: { gross_total: string } };
  expect(j.values).toEqual({ gross_total: "28659" });
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

test("explain echoes Σ/∑ as written, not the resolved SUM", async () => {
  for (const glyph of ["Σ", "∑"]) {
    const dir = mkdtempSync(join(tmpdir(), "visimark-"));
    const p = join(dir, "sigma.md");
    writeFileSync(
      p,
      `| Item | Price | Qty |  Net |\n|------|------:|----:|-----:|\n| pen  |  5.00 |   2 | 10.00 |\n\n\`\`\`vmark #order\nNet = Price * Qty\ntotal = ${glyph}(Net)\n\`\`\`\n`,
    );
    const c = capture();
    const code = await runCli(["explain", p], c.io);
    expect(code).toBe(0);
    expect(c.out()).toContain(`total = ${glyph}(Net)`);
    expect(c.out()).not.toContain("total = SUM(Net)");
  }
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

test("an unrecognised flag is refused with exit 2", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath, "--require-formulas"], c.io)).toBe(2);
  expect(c.err()).toBe("visimark: unknown option --require-formulas");
  expect(c.out()).toBe("");
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

// ---- assert statements ----------------------------------------------

import { assertFailPath } from "../examples.js";

test("check on a false assertion: transcript-exact, exit 1", async () => {
  const c = capture();
  const code = await runCli(["check", assertFailPath], c.io);
  expect(code).toBe(1);
  const [pathLine, ...body] = c.out().split("\n");
  expect(pathLine).toBe(assertFailPath);
  expect(body.join("\n")).toBe(
    [
      "",
      "  ASSERT  #plan           total == 1",
      "          0.90 == 1   is false",
      "",
      "  1 problem (0 stale, 1 error)",
    ].join("\n"),
  );
});

test("eval exits 1 on a false assertion, value first then the failure on stderr", async () => {
  const c = capture();
  const code = await runCli(["eval", assertFailPath, "--get", "plan.total"], c.io);
  expect(code).toBe(1);
  expect(c.out()).toBe("0.9");
  expect(c.err()).toContain("ASSERT  #plan");
  expect(c.err()).toContain("0.90 == 1   is false");
});

test("eval --json carries an assertions array", async () => {
  const c = capture();
  await runCli(["eval", assertFailPath, "--json"], c.io);
  const j = JSON.parse(c.out());
  expect(j.assertions).toEqual([
    {
      sheet: "plan",
      source: "assert total == 1",
      holds: false,
      operands: { total: "0.90" },
      substituted: "0.90 == 1",
    },
  ]);
});

test("explain lists a sheet's assertions", async () => {
  const c = capture();
  await runCli(["explain", assertFailPath], c.io);
  expect(c.out()).toContain("  assertions:\n    total == 1");
});

const withAlias = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
peak = bpu
\`\`\`
`;

test("explain lists an aliased column's header", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const p = join(dir, "alias.md");
  writeFileSync(p, withAlias);
  const c = capture();
  const code = await runCli(["explain", p], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("aliases:");
  expect(c.out()).toContain('bpu → "Bandwidth per Unit (TB/s, full-duplex)"');
});

// --- prose notation for unary vocabulary (#64) ------------------------------

const proseFixture = fileURLToPath(new URL("../fixtures/prose-notation.md", import.meta.url));

test("eval on the prose-notation fixture prints the values of spec section 6", async () => {
  const c = capture();
  const code = await runCli(["eval", proseFixture], c.io);
  expect(code).toBe(0);
  expect(c.out()).toBe(
    [
      "a     7.5",
      "b     10",
      "abs1  2.5",
      "abs2  1.5",
      "abs3  32.5",
      "fl    7",
      "ce    8",
      "fln   -8",
      "mix   7",
      "rt    4",
      "ok    2.5",
    ].join("\n"),
  );
});

test("check passes the prose-notation fixture, and explain echoes the glyphs as written", async () => {
  const check = capture();
  expect(await runCli(["check", proseFixture], check.io)).toBe(0);
  expect(check.out()).toContain("0 problems");
  const explain = capture();
  expect(await runCli(["explain", proseFixture], explain.io)).toBe(0);
  expect(explain.out()).toContain("abs2 = ||a - b| - 1|");
  expect(explain.out()).toContain("mix = ⌊|a - b| * 3⌋");
  expect(explain.out()).toContain("rt = √(b + 6)");
});

const percentFixture = fileURLToPath(
  new URL("../fixtures/percent-display-sigil.md", import.meta.url),
);

test("check passes the percent-display fixture", async () => {
  const c = capture();
  expect(await runCli(["check", percentFixture], c.io)).toBe(0);
  expect(c.out()).toContain("0 problems");
});

test("eval --json on the percent-display fixture reports stored numbers", async () => {
  const c = capture();
  expect(await runCli(["eval", percentFixture, "--json"], c.io)).toBe(0);
  const j = JSON.parse(c.out()) as { values: Record<string, string> };
  expect(j.values["s.margin"]).toBe("0.4026");
  expect(j.values["s.loss"]).toBe("-0.05");
  expect(j.values["s.over"]).toBe("1.5");
});

test("fmt repairs a sabotaged percent span and is idempotent", async () => {
  const src = readFileSync(percentFixture, "utf8").replace("**40.26%**", "**41.55%**");
  const dir = mkdtempSync(join(tmpdir(), "vm-pct-"));
  const path = join(dir, "p.md");
  writeFileSync(path, src);
  const check1 = capture();
  expect(await runCli(["check", path], check1.io)).toBe(1);
  expect(check1.out()).toContain("41.55% ≠ 40.26%");
  const fmt1 = capture();
  expect(await runCli(["fmt", path], fmt1.io)).toBe(0);
  expect(readFileSync(path, "utf8")).toContain("**40.26%**<!--vmark=s.margin%-->");
  const fmt2 = capture();
  expect(await runCli(["fmt", path], fmt2.io)).toBe(0);
  expect(fmt2.out()).toContain("unchanged");
  const check2 = capture();
  expect(await runCli(["check", path], check2.io)).toBe(0);
});

test("explain on a percent-display document does not mention the sigil", async () => {
  const c = capture();
  expect(await runCli(["explain", percentFixture], c.io)).toBe(0);
  expect(c.out()).not.toContain("margin%");
});
