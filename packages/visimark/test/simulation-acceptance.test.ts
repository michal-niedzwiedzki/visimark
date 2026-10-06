/**
 * The acceptance transcript for `lattice` and `report`
 * (docs/design/lattice-on-param-and-report-statements-spec.md §6).
 *
 * Only the clean fixture (`fixtures/simulation/levers.md`) is committed; every
 * broken variant below is generated in memory, the pattern
 * `domain-acceptance.test.ts` uses.
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";
import { check } from "../src/eval/check.js";
import { build } from "../src/model/build.js";
import { locate } from "../src/parse/document.js";

const MD_PATH = join(import.meta.dir, "fixtures", "simulation", "levers.md");
const DOMAIN_PATH = join(import.meta.dir, "fixtures", "domain", "levers.md");
const CLEAN = readFileSync(MD_PATH, "utf8");

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

function problems(md: string) {
  return check(build(locate(md))).findings.filter(
    (f) => f.code !== "WARN" && f.code !== "COVERAGE",
  );
}
const shape = (md: string) =>
  problems(md).map(
    (f) => `${f.code}|${f.sheetId ?? ""}|${f.name ?? ""}|${f.message ?? f.raw ?? ""}`,
  );

test("1. clean: check exits 0 with no error findings", async () => {
  const r = await run(["check", MD_PATH]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("0 problems");
  expect(r.out).not.toMatch(/\b(TYPE|DOMAIN|PRECISION|SHEET|UNDEF|DUP)\b/);
  // bump and staff are read by nothing; volume_disc only by a report
  expect(r.out).toMatch(/WARN\s+levers\.bump/);
  expect(r.out).toMatch(/WARN\s+levers\.staff/);
  expect(r.out).not.toMatch(/WARN\s+levers\.volume_disc/);
});

test("2. eval reports every lattice", async () => {
  const j = JSON.parse((await run(["eval", "--json", MD_PATH])).out);
  expect(j.params["levers.extra_hours"].lattice).toEqual({ step: "20" });
  expect(j.params["levers.volume_disc"].lattice).toEqual({ step: "0.01" });
  expect(j.params["levers.bump"].lattice).toEqual({ step: "5" });
  expect(j.params["levers.staff"].lattice).toEqual({ step: "3" });
  expect("lattice" in j.params["levers.prepay_share"]).toBe(false);
  expect(j.params["levers.extra_hours"].domain.clauses).toEqual(["integer", "[0, 80]"]);
  const text = (await run(["eval", MD_PATH])).out;
  expect(text).toMatch(/levers\.extra_hours\s+integer in \[0, 80\] lattice 20\n/);
  expect(text).toMatch(/levers\.volume_disc\s+\[0%, 10%\] lattice 1%\n/);
});

test("3. the #241 fixture prints no lattice anywhere", async () => {
  for (const args of [["eval"], ["eval", "--json"], ["explain"], ["explain", "--json"]]) {
    expect((await run([...args, DOMAIN_PATH])).out).not.toContain("lattice");
  }
});

test("4a. every lattice finding in spec 4.1", () => {
  const rows: [string, string][] = [
    [
      "param x precision 0 in [0, 10] lattice = default 0",
      "TYPE|s|x|a lattice step must be a number literal",
    ],
    [
      "param x precision 0 in [0, 10] lattice 5 lattice 5 = default 0",
      "TYPE|s|x|malformed param domain clause",
    ],
    [
      "param x precision 0 lattice 5 in [0, 10] = default 0",
      "TYPE|s|x|malformed param domain clause",
    ],
    [
      "param x precision 0 lattice 5 = default 0",
      "TYPE|s|x|param x declares a lattice but no domain",
    ],
    [
      "param x precision 0 in { 1, 2 } lattice 1 = default 1",
      "TYPE|s|x|param x declares a lattice, but a set already lists its points",
    ],
    [
      "param x precision 0 natural lattice 5 = default 0",
      "TYPE|s|x|param x declares a lattice, but its domain has no upper bound",
    ],
    [
      "param x precision 0 in (, 10] lattice 5 = default 0",
      "TYPE|s|x|param x declares a lattice, but its domain has no lower bound",
    ],
    [
      "param x precision 0 in [0, 10] lattice 0 = default 0",
      "TYPE|s|x|lattice step must be positive",
    ],
    [
      "param x precision 3 in [0%, 10%] lattice 5 = default 0%",
      "TYPE|s|x|x is a percent; lattice step 5 must be too",
    ],
    [
      "param x precision 0 in [0, 10] lattice 5% = default 0",
      "TYPE|s|x|x is not a percent; lattice step 5% must not be one",
    ],
    [
      "param x precision 1 in [0, 1] lattice 0.25 = default 0",
      "PRECISION|s|x|lattice step 0.25 has 2 decimals; param x declares 1",
    ],
    [
      "param x precision 1 integer in [0, 80] lattice 2.5 = default 0",
      "TYPE|s|x|lattice step 2.5 must be a whole number: param x is an integer domain",
    ],
    [
      "param x precision 0 in [0, 10] lattice 3 = default 0",
      "TYPE|s|x|lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0",
    ],
    [
      "param x precision 0 in (0, 5) lattice 5 = default 1",
      "TYPE|s|x|lattice step 5 leaves no point in (0, 5)",
    ],
  ];
  for (const [line, expected] of rows) {
    expect(shape(fence("s", line))).toEqual([expected]);
  }
});

test("4b. every report finding in spec 4.2, and the silent cases", () => {
  const withScalars = (stmts: string) => fence("s", `a = 1\nb = 2\n${stmts}`);
  expect(shape(withScalars("report"))).toEqual(["TYPE|s||a report needs a name"]);
  expect(shape(withScalars("report foo"))).toEqual([
    "TYPE|s||unknown report `foo`; the reports are ledger, deltas, gates, best, forbidden",
  ]);
  expect(shape(withScalars("report ledger assertions"))).toEqual([
    "TYPE|s||`report ledger` takes: [assertions broken]",
  ]);
  expect(shape(withScalars("report gates extra"))).toEqual([
    "TYPE|s||`report gates` takes no options",
  ]);
  expect(shape(withScalars("report best scalar s.a direction up"))).toEqual([
    "TYPE|s||`report best` takes: scalar REF direction max|min among feasible|infeasible|all",
  ]);
  expect(shape(withScalars("report deltas on s.nope among all"))).toEqual(["UNDEF|s||s.nope"]);
  expect(shape("| c |\n|---|\n| 1 |\n\n" + fence("s", "report deltas on s.c among all"))).toEqual([
    "TYPE|s||a report reads a scalar; s.c is a column",
  ]);
  expect(shape(fence(null, "report gates"))).toEqual([
    "SHEET|||`report` must be in a `#id` sheet block",
  ]);
  expect(shape(withScalars("report gates\nreport  gates"))).toEqual([
    "DUP|s||report gates is declared twice in sheet s",
  ]);
  // silent: same report, different options; a default off its lattice; no table
  expect(
    shape(withScalars("report deltas on s.a among all\nreport deltas on s.b among all")),
  ).toEqual([]);
  expect(shape(fence("s", "param x precision 0 in [0, 80] lattice 20 = default 7"))).toEqual([]);
  expect(shape(fence("s", "report gates"))).toEqual([]);
});

test("4c. each variant exits per check: findings 1, silent 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const bad = join(dir, "bad.md");
    writeFileSync(bad, fence("s", "param x precision 0 in [0, 10] lattice 3 = default 0"));
    expect((await run(["check", bad])).code).toBe(1);
    const ok = join(dir, "ok.md");
    writeFileSync(ok, fence("s", "param x precision 0 in [0, 80] lattice 20 = default 7\ny = x"));
    expect((await run(["check", ok])).code).toBe(0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("5. membership is untouched by a lattice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const off = join(dir, "off.json");
    writeFileSync(off, JSON.stringify({ extra_hours: "7" }));
    const r = await run(["eval", "--scenario", off, MD_PATH]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/levers\.extra_hours\s+7\b/);
    const outside = join(dir, "outside.json");
    writeFileSync(outside, JSON.stringify({ extra_hours: "81" }));
    const bad = await run(["eval", "--scenario", outside, MD_PATH]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("scenario value for extra_hours");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("6. fmt writes nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const copy = join(dir, "levers.md");
    writeFileSync(copy, CLEAN);
    await run(["fmt", copy]);
    expect(readFileSync(copy, "utf8")).toBe(CLEAN);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("7. a scalar named report still binds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-sim-"));
  try {
    const f = join(dir, "r.md");
    writeFileSync(f, fence("s", "report = 5\nlattice = 7"));
    const r = await run(["eval", f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/s\.report\s+5\b/);
    expect(r.out).toMatch(/s\.lattice\s+7\b/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
