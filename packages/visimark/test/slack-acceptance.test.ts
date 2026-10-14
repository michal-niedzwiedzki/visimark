/**
 * The acceptance transcript for `report slack`
 * (docs/design/a-slack-report-for-the-nearest-miss-spec.md §6). Only the clean
 * fixture is committed; every variant is written to a temp directory from it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";

const CLEAN = readFileSync(join(import.meta.dir, "fixtures", "simulation", "slack.md"), "utf8");
const CONFERENCE = join(import.meta.dir, "..", "..", "..", "docs", "simulate", "conference.md");

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vm-slack-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, md: string): string {
  const p = join(dir, name);
  writeFileSync(p, md);
  return p;
}

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

const TIE_IN = "questions tie inside; the first in grid order is shown";
const TIE_OUT = "questions tie outside; the first in grid order is shown";

/** spec §6.2, the clean fixture's body */
const BODY = `  x < 3
    inside   room  1  x=2 y=0.25
    outside  miss  0  x=3 y=0.25
    4 ${TIE_IN}
    4 ${TIE_OUT}
    from 4 feasible and 4 failing only this, of 20 questions
  y >= 0.25
    inside   room  0.00  x=2 y=0.25
    outside  miss  0.25  x=2 y=0.00
    from 4 feasible and 1 failing only this, of 20 questions
  x / 4 > 0.25
    inside   room  0.25  x=2 y=0.25
    outside  miss     0  x=1 y=0.25
    4 ${TIE_IN}
    4 ${TIE_OUT}
    from 4 feasible and 8 failing only this, of 20 questions
  x * 0 == 0
    outside  no question fails only this assertion
    from 4 feasible and 0 failing only this, of 20 questions
  x >= 0 and x <= 3
    no single boundary
  x != 9
    no single boundary
  due <= 2027-01-05
    not a numeric comparison`;

const section = (p: string, body: string): string => `==> ${p} <==\n#r\n\nreport slack\n\n${body}`;

describe("report slack (spec §6)", () => {
  test("§6.2 the clean fixture", async () => {
    const p = file("slack.md", CLEAN);
    expect((await run(["check", p])).code).toBe(0);
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p, BODY));
  });

  test("§6.3 no feasible question", async () => {
    const p = file(
      "none.md",
      CLEAN.replace("assert due <= 2027-01-05\n", "assert due <= 2027-01-05\nassert x > 5\n"),
    );
    const empty = `    inside   no feasible question
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions`;
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      section(
        p,
        `  x < 3
${empty}
  y >= 0.25
${empty}
  x / 4 > 0.25
${empty}
  x * 0 == 0
    outside  no question fails only this assertion
    from 0 feasible and 0 failing only this, of 20 questions
  x >= 0 and x <= 3
    no single boundary
  x != 9
    no single boundary
  due <= 2027-01-05
    not a numeric comparison
  x > 5
    inside   no feasible question
    outside  miss  3  x=2 y=0.25
    4 ${TIE_OUT}
    from 0 feasible and 4 failing only this, of 20 questions`,
      ),
    );
  });

  test("§6.3 a fault from another report leaves both pools", async () => {
    const p = file(
      "fault.md",
      CLEAN.replace("due = ", "q precision 2 = 1 / (x - 1)\ndue = ").replace(
        "report slack",
        "report slack\nreport best scalar s.q direction max among all",
      ),
    );
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`  x / 4 > 0.25
    inside   room  0.25  x=2 y=0.25
    outside  miss  0.25  x=0 y=0.25
    4 ${TIE_IN}
    4 ${TIE_OUT}
    from 4 feasible and 4 failing only this, of 20 questions
  x * 0 == 0`);
    expect(r.out).toContain("chosen from 15 questions");
  });

  test("§6.3 no lattice", async () => {
    const p = file("nogrid.md", CLEAN.replace(/ lattice [0-9.]+/g, ""));
    const r = await run(["simulate", p]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(section(p, "  no grid: no param declares a lattice"));
  });

  test("§6.3 options are refused", async () => {
    const p = file("opts.md", CLEAN.replace("report slack", "report slack among all"));
    const r = await run(["check", p]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("TYPE    r.                `report slack` takes no options");
    const s = await run(["simulate", p]);
    expect(s.code).toBe(1);
    expect(s.out).toBe("");
    expect(s.err).toBe(`simulate: ${p}: no report statement`);
  });

  test("§6.3 a duplicate line is DUP", async () => {
    const p = file("dup.md", CLEAN.replace("report slack", "report slack\nreport slack"));
    const r = await run(["check", p]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("DUP");
  });

  test("§6.3 parentheses do not make a comparison compound", async () => {
    const p = file("paren.md", CLEAN.replace("assert x < 3", "assert (x < 3)"));
    const r = await run(["simulate", p]);
    expect(r.out).toBe(section(p, BODY.replace("  x < 3\n", "  (x < 3)\n")));
  });

  test("§6.1 the guide's document", async () => {
    const r = await run(["simulate", CONFERENCE]);
    expect(r.code).toBe(0);
    expect(
      r.out.split("\n#ledger")[0]!.endsWith(`

report slack

  attendees <= venue_capacity
    inside   room    0  attendees=300 ticket=60.00 sponsors=2
    outside  miss  100  attendees=400 ticket=60.00 sponsors=1
    13 ${TIE_IN}
    15 ${TIE_OUT}
    from 25 feasible and 15 failing only this, of 64 questions
  profit >= 0
    inside   room  900.00  attendees=200 ticket=60.00 sponsors=2
    outside  miss  100.00  attendees=200 ticket=80.00 sponsors=1
    from 25 feasible and 16 failing only this, of 64 questions
  sponsor_share <= 50%
    inside   room  0.000  attendees=100 ticket=100.00 sponsors=2
    outside  miss  0.056  attendees=100 ticket=80.00 sponsors=2
    3 ${TIE_OUT}
    from 25 feasible and 6 failing only this, of 64 questions`),
    ).toBe(true);
  });
});
