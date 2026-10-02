/**
 * The acceptance transcript for `visimark simulate`
 * (docs/design/add-a-simulate-command-spec.md §5). Only the clean fixture is
 * committed; every variant is written to a temp directory from it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";

const CLEAN = readFileSync(join(import.meta.dir, "fixtures", "simulation", "simulate.md"), "utf8");
const INVOICE = join(import.meta.dir, "..", "..", "..", "docs", "example-invoice.md");

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vm-simulate-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** write a variant and return its path */
function file(name: string, md: string): string {
  const p = join(dir, name);
  writeFileSync(p, md);
  return p;
}

async function run(args: string[], tty?: { raw: string[] }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
    errTTY: tty !== undefined,
    errRaw: (s: string) => tty?.raw.push(s),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const section = (p: string): string => `==> ${p} <==\n${BODY}`;

describe("simulate (spec §5)", () => {
  test("case 1: the clean run", async () => {
    const p = file("simulate.md", CLEAN);
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p));
    expect(r.err).toBe(
      `simulate: ${p}: 10 questions (2 lattice params)\nsimulate: ${p}: 1 of 1 sheets ran`,
    );
  });

  test("case 2: --fail-on-fault with nothing blocked", async () => {
    const p = file("simulate.md", CLEAN);
    const r = await run(["simulate", "--fail-on-fault", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p));
  });

  test("case 3: no report statement", async () => {
    const r = await run(["simulate", INVOICE]);
    expect(r.code).toBe(1);
    expect(r.out).toBe("");
    expect(r.err).toBe(`simulate: ${INVOICE}: no report statement`);
  });

  test("case 4: one file with reports, one without", async () => {
    const p = file("simulate.md", CLEAN);
    const r = await run(["simulate", p, INVOICE]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p));
    expect(r.err.split("\n")).toEqual([
      `simulate: ${p}: 10 questions (2 lattice params)`,
      `simulate: ${p}: 1 of 1 sheets ran`,
      `simulate: ${INVOICE}: no report statement`,
      "simulate: 1 of 1 sheets ran across 2 files",
    ]);
  });

  test("case 5: two files are separated by a rule", async () => {
    const p = file("simulate.md", CLEAN);
    const r = await run(["simulate", p, p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`${section(p)}\n\n---\n\n${section(p)}`);
    expect(r.err.split("\n").at(-1)).toBe("simulate: 2 of 2 sheets ran across 2 files");
  });

  const undef = (): string =>
    file("undef.md", CLEAN.replace("deltas on plan.margin", "deltas on plan.marginn"));

  test("case 6: a sheet that cannot start", async () => {
    const p = undef();
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`==> ${p} <==\n#plan\n  (cannot start)`);
    expect(r.err.split("\n")).toEqual([
      `simulate: ${p}: 10 questions (2 lattice params)`,
      `simulate: ${p}: #plan cannot start: UNDEF: unknown name \`plan.marginn\`; did you mean \`margin\`?`,
      `simulate: ${p}: 0 of 1 sheets ran`,
    ]);
  });

  test("case 7: --fail-on-fault makes a blocked sheet exit 1", async () => {
    const r = await run(["simulate", "--fail-on-fault", undef()]);
    expect(r.code).toBe(1);
  });

  test("case 8: an impossible lattice blocks the grid", async () => {
    const p = file("lattice.md", CLEAN.replace("lattice 10", "lattice 3"));
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`==> ${p} <==\n#plan\n  (cannot start)`);
    expect(r.err.split("\n")).toEqual([
      `simulate: ${p}: 0 questions (2 lattice params)`,
      `simulate: ${p}: #plan cannot start: TYPE plan.hours: lattice step 3 does not reach the end of [0, 20]: 20 is not a multiple of 3 above 0`,
      `simulate: ${p}: 0 of 1 sheets ran`,
    ]);
  });

  test("case 9: faulted questions are readings", async () => {
    const p = file(
      "faulted.md",
      CLEAN.replace(
        "assert margin >= 0",
        "per_hour precision 2 = margin / hours\nassert margin >= 0\nassert per_hour >= 0",
      ),
    );
    const r = await run(["simulate", "--fail-on-fault", p]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("  1             0    0%  faulted");
    expect(r.out).toContain("  per_hour >= 0      3      3        3  holds  hours=20 disc=0%");
    expect(r.out).toContain(
      "  hours=10 disc=0%\n  plan.margin  500.00  (0.00 against base)\n  chosen from 3 feasible of 9 questions",
    );
  });

  test("case 10: no lattice asks only the base", async () => {
    const p = file("flat.md", CLEAN.replace(" lattice 10", "").replace(" lattice 5%", ""));
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.err.split("\n")[0]).toBe(`simulate: ${p}: 1 questions (0 lattice params)`);
    expect(r.out.match(/no grid: no param declares a lattice/g)?.length).toBe(3);
  });

  test("case 11: nothing feasible", async () => {
    const p = file("none.md", CLEAN.replace("assert margin >= 0", "assert margin >= 2000"));
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("  no feasible question");
    expect(r.out).toContain("  disc = 10%  every question with it breaks an assertion");
  });

  test("case 12: --progress off a terminal", async () => {
    const p = file("simulate.md", CLEAN);
    const r = await run(["simulate", "--progress", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p));
    expect(r.err.split("\n")).toEqual([
      `simulate: ${p}: 10 questions (2 lattice params)`,
      ...Array.from({ length: 10 }, (_, i) => `simulate: ${p}: question ${i + 1} of 10`),
      `simulate: ${p}: 1 of 1 sheets ran`,
    ]);
  });

  test("--progress on a terminal rewrites one line and clears it", async () => {
    const p = file("simulate.md", CLEAN);
    const raw: string[] = [];
    const r = await run(["simulate", "--progress", p], { raw });
    expect(r.err).not.toContain(" of 10\n");
    expect(r.err.split("\n")).toHaveLength(2);
    const last = `simulate: ${p}: question 10 of 10`;
    expect(raw.length).toBe(11);
    expect(raw[0]).toBe(`\rsimulate: ${p}: question 1 of 10`);
    expect(raw[9]).toBe(`\r${last}`);
    expect(raw[10]).toBe(`\r${" ".repeat(last.length)}\r`);
  });

  test("review focus 6: --progress with one question prints one line", async () => {
    const p = file("flat.md", CLEAN.replace(" lattice 10", "").replace(" lattice 5%", ""));
    const r = await run(["simulate", "--progress", p]);
    expect(r.err.split("\n").filter((l) => l.includes("question 1 of 1"))).toEqual([
      `simulate: ${p}: question 1 of 1`,
    ]);
  });

  test("case 13: an unreadable file", async () => {
    const r = await run(["simulate", join(dir, "nope.md")]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("");
    expect(r.err).toBe(`visimark: cannot read ${join(dir, "nope.md")}`);
  });

  test("case 14: an unreadable file does not stop the others", async () => {
    const p = file("simulate.md", CLEAN);
    const nope = join(dir, "nope.md");
    const r = await run(["simulate", nope, p]);
    expect(r.code).toBe(2);
    expect(r.out).toBe(section(p));
    expect(r.err.split("\n")).toEqual([
      `visimark: cannot read ${nope}`,
      `simulate: ${p}: 10 questions (2 lattice params)`,
      `simulate: ${p}: 1 of 1 sheets ran`,
      "simulate: 1 of 1 sheets ran across 2 files",
    ]);
  });
});

describe("case 15: refusals (spec §2)", () => {
  const cases: [string[], string][] = [
    [["simulate", "--json", "f.md"], "visimark: simulate has no --json mode"],
    [["simulate", "--get", "x", "f.md"], "visimark: --get is only valid with eval"],
    [["simulate", "--scenario", "s.json", "f.md"], "visimark: --scenario is only valid with eval"],
    [
      ["simulate", "--fail-on-faults", "f.md"],
      "visimark: unknown option --fail-on-faults — did you mean `--fail-on-fault`?",
    ],
    [["simulate", "#plan", "f.md"], "visimark: #plan is only valid with explain"],
    [["check", "--progress", "f.md"], "visimark: --progress is only valid with simulate"],
    [["eval", "--fail-on-fault", "f.md"], "visimark: --fail-on-fault is only valid with simulate"],
    [["simulate"], "usage: visimark simulate FILE... [--fail-on-fault] [--progress]"],
  ];
  for (const [args, message] of cases) {
    test(args.join(" "), async () => {
      const r = await run(args);
      expect(r.code).toBe(2);
      expect(r.err).toBe(message);
    });
  }
  test("--json emits one USAGE envelope", async () => {
    const r = await run(["simulate", "--json", "f.md"]);
    const env = JSON.parse(r.out);
    expect(env.command).toBe("simulate");
    expect(env.status).toBe("error");
    expect(env.error).toEqual({ code: "USAGE", message: "visimark: simulate has no --json mode" });
  });
});

const BODY =
  "#plan\n\nreport ledger assertions broken\n\n  question  hours  disc  feasible  broken\n  base         10    0%  yes\n  1             0    0%  yes\n  2             0    5%  yes\n  3             0   10%  yes\n  4            10    0%  yes\n  5            10    5%  yes\n  6            10   10%  yes\n  7            20    0%  no        margin >= 0; hours <= 15\n  8            20    5%  no        margin >= 0; hours <= 15\n  9            20   10%  no        margin >= 0; hours <= 15\n\nreport deltas on plan.margin\n\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high  1500.00  (+1000.00)  hours=0 disc=0%\n\nreport gates\n\n  9 questions\n  assert       holds  fails  faulted  base   first failure\n  margin >= 0      6      3        0  holds  hours=20 disc=0%\n  hours <= 15      6      3        0  holds  hours=20 disc=0%\n\nreport best scalar plan.margin direction max among feasible\n\n  hours=0 disc=0%\n  plan.margin  1500.00  (+1000.00 against base)\n  chosen from 6 feasible of 9 questions\n\nreport forbidden\n\n  hours = 20  every question with it breaks an assertion\n  3 of 9 questions are infeasible";
