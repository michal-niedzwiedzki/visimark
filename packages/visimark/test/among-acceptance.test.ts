/**
 * Acceptance for a required `among` population
 * (docs/design/among-is-required-on-best-and-deltas-spec.md §6).
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";

const FIXTURE = join(import.meta.dir, "fixtures", "simulation", "among.md");
const CLEAN = readFileSync(FIXTURE, "utf8");

const BEST = "`report best` takes: scalar REF direction max|min among feasible|infeasible|all";
const DELTAS = "`report deltas` takes: [on REF {, REF}] among feasible|infeasible|all";
const NOTHING =
  "`report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …`";

const BODY = `#plan

report best scalar margin direction max among all

  hours=0 disc=0%
  margin  1500.00  (+1000.00 against base)
  chosen from 9 questions

report best scalar margin direction max among feasible

  hours=0 disc=0%
  margin  1500.00  (+1000.00 against base)
  chosen from 6 feasible of 9 questions

report best scalar margin direction max among infeasible

  hours=20 disc=0%
  margin  -500.00  (-1000.00 against base)
  chosen from 3 infeasible of 9 questions

report best scalar margin direction min among feasible

  hours=10 disc=10%
  margin  350.00  (-150.00 against base)
  chosen from 6 feasible of 9 questions

report deltas on margin among all

  margin  base 500.00
    low   -650.00  (-1150.00)  hours=20 disc=10%
    high  1500.00  (+1000.00)  hours=0 disc=0%
  over 9 questions

report deltas on margin among feasible

  margin  base 500.00
    low    350.00   (-150.00)  hours=10 disc=10%
    high  1500.00  (+1000.00)  hours=0 disc=0%
  over 6 feasible of 9 questions

report deltas on margin among infeasible

  margin  base 500.00
    low   -650.00  (-1150.00)  hours=20 disc=10%
    high  -500.00  (-1000.00)  hours=20 disc=0%
  over 3 infeasible of 9 questions`;

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
    now: () => 0,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

async function onVariant(md: string, args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "among-"));
  try {
    const path = join(dir, "among.md");
    writeFileSync(path, md);
    const r = await run([...args, path]);
    return { ...r, path };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** replace the report lines, leaving the plan's scalars and asserts */
function withReports(reports: string): string {
  return CLEAN.replace(/report best[\s\S]*```/, `${reports}\n\`\`\``);
}

function sheet(body: string): string {
  return CLEAN.replace(/```vmark #plan\n[\s\S]*```/, `\`\`\`vmark #plan\n${body}\n\`\`\``);
}

test("the fixture: check is clean and simulate prints the transcript", async () => {
  const check = await run(["check", FIXTURE]);
  expect(check.code).toBe(0);
  expect(check.out).toContain("0 problems");

  const r = await run(["simulate", FIXTURE]);
  expect(r.code).toBe(0);
  expect(r.out).toBe(`==> ${FIXTURE} <==\n${BODY}`);
  expect(r.err).toBe(
    `simulate: ${FIXTURE}: 10 questions (2 lattice params)\nsimulate: ${FIXTURE}: 1 of 1 sheets ran in 0 ms`,
  );
});

test("a missing among clause is seven synopsis TYPEs", async () => {
  const md = CLEAN.replace(/ among (?:feasible|infeasible|all)/g, "");
  const r = await onVariant(md, ["check"]);
  expect(r.code).toBe(1);
  const type = (message: string) => `  TYPE    plan.             ${message}`;
  expect(r.out).toBe(
    [
      r.path,
      "",
      type(BEST),
      "",
      type(BEST),
      "",
      type(BEST),
      "",
      type(BEST),
      "",
      type(DELTAS),
      "",
      type(DELTAS),
      "",
      type(DELTAS),
      "",
      "  7 problems (0 stale, 7 errors)",
    ].join("\n"),
  );
  const j = JSON.parse((await onVariant(md, ["check", "--json"])).out);
  expect(j.status).toBe("problems");
  expect(j.files[0].summary.errors).toBe(7);
  expect(j.files[0].findings.map((f: { details: { message: string } }) => f.details.message)).toEqual([
    BEST,
    BEST,
    BEST,
    BEST,
    DELTAS,
    DELTAS,
    DELTAS,
  ]);
});

test("no lattice prints the no-grid line for every population", async () => {
  const md = CLEAN.replaceAll(" lattice 10", "").replaceAll(" lattice 5%", "");
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).not.toContain("no feasible question");
  const bodies = r.out.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#") && !l.startsWith("==>") && !l.startsWith("report "));
  expect(bodies.length).toBe(7);
  expect(bodies.every((l) => l === "  no grid: no param declares a lattice")).toBe(true);
});

test("a plan with no feasible question", async () => {
  const md = sheet(`param hours precision 0 integer in [0, 20] lattice 10 = default 10
param disc precision 2 in [0%, 10%] lattice 5% = default 0%
rate precision 2 = 100.00
margin precision 2 = 1500.00 * (1 - disc) - rate * hours
assert margin >= 2000
report best scalar margin direction max among feasible
report deltas on margin among feasible`);
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("report best scalar margin direction max among feasible\n\n  no feasible question");
  expect(r.out).toContain("report deltas on margin among feasible\n\n  no feasible question");
});

test("a plan with no infeasible question", async () => {
  // hours <= 15 would leave the hours=20 questions infeasible. The spec's
  // empty reading needs every remaining assert to hold.
  const md = withReports(
    `report best scalar margin direction max among infeasible
report deltas on margin among infeasible`,
  )
    .replace("assert margin >= 0\n", "assert margin >= -100000\n")
    .replace("assert hours <= 15\n", "");
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain(
    "report best scalar margin direction max among infeasible\n\n  no infeasible question",
  );
  expect(r.out).toContain("report deltas on margin among infeasible\n\n  no infeasible question");
});

test("per_hour faults the hours=0 questions; among all still ranks the rest", async () => {
  const md = withReports("report best scalar margin direction max among all").replace(
    "assert margin >= 0",
    "per_hour precision 2 = margin / hours\nassert per_hour >= 0\nassert margin >= 0",
  );
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("hours=10 disc=0%");
  expect(r.out).toContain("500.00");
  expect(r.out).toContain("(0.00 against base)");
  expect(r.out).toContain("chosen from 6 questions");
});

test("per_hour leaves the hours=20 questions infeasible", async () => {
  // hours=20 verifies per_hour (a negative number). A false assert is
  // infeasible. Only hours=0, where the division does not verify, is faulted.
  const md = withReports("report best scalar margin direction max among infeasible").replace(
    "assert margin >= 0",
    "per_hour precision 2 = margin / hours\nassert per_hour >= 0\nassert margin >= 0",
  );
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("hours=20 disc=0%");
  expect(r.out).toContain("-500.00");
  expect(r.out).toContain("(-1000.00 against base)");
  expect(r.out).toContain("chosen from 3 infeasible of 9 questions");
});

test("a string ref keeps its base line and the count follows margin", async () => {
  const md = withReports("report deltas on label, margin among all").replace(
    "assert margin >= 0",
    `label = "east"\nassert margin >= 0`,
  );
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("  label  base ?\n  margin  base 500.00");
  expect(r.out).toContain("    low   -650.00  (-1150.00)  hours=20 disc=10%");
  expect(r.out).toContain("    high  1500.00  (+1000.00)  hours=0 disc=0%");
  expect(r.out).toContain("  over 9 questions");
});

test("best on a string is no question evaluated", async () => {
  const md = withReports("report best scalar label direction max among all").replace(
    "assert margin >= 0",
    `label = "east"\nassert margin >= 0`,
  );
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("report best scalar label direction max among all\n\n  no question evaluated");
});

test("deltas among all in a param-only sheet is nothing to read", async () => {
  const md = sheet("param p precision 0 in [1, 3] lattice 1 = default 1\nreport deltas among all");
  const r = await onVariant(md, ["check"]);
  expect(r.code).toBe(1);
  expect(r.out).toContain(NOTHING);
});

test("a bare deltas in that sheet is the synopsis only", async () => {
  const md = sheet("param p precision 0 in [1, 3] lattice 1 = default 1\nreport deltas");
  const r = await onVariant(md, ["check"]);
  expect(r.code).toBe(1);
  expect(r.out).toContain(DELTAS);
  expect(r.out).not.toContain("nothing to read");
});

test("two copies of the same deltas line are DUP", async () => {
  const md = withReports("report deltas on margin among all\nreport deltas on margin among all");
  const r = await onVariant(md, ["check"]);
  expect(r.code).toBe(1);
  expect(r.out).toContain(
    "DUP",
  );
  expect(r.out).toContain("report deltas on margin among all is declared twice in sheet plan");
});

test("the same refs in two populations are clean", async () => {
  const md = withReports(
    "report deltas on margin among all\nreport deltas on margin among feasible",
  );
  const r = await onVariant(md, ["check"]);
  expect(r.code).toBe(0);
});

test("gates does not take among", async () => {
  const r = await onVariant(withReports("report gates among all"), ["check"]);
  expect(r.code).toBe(1);
  expect(r.out).toContain("`report gates` takes no options");
});

test("fmt writes nothing", async () => {
  const r = await run(["fmt", FIXTURE]);
  expect(r.out).toContain("unchanged");
});

test("a flat scalar ties across the feasible questions", async () => {
  const md = withReports("report best scalar flat direction min among feasible").replace(
    "assert margin >= 0",
    "flat precision 2 = 100.00\nassert margin >= 0",
  );
  const r = await onVariant(md, ["simulate"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("100.00");
  expect(r.out).toContain("(0.00 against base)");
  expect(r.out).toContain("chosen from 6 feasible of 9 questions");
  expect(r.out).toContain("6 questions tie; the first in grid order is shown");
});
