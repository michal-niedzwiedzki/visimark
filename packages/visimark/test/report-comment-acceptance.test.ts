/**
 * The acceptance transcript for report comments
 * (docs/design/declare-a-sheet-s-report-statements-spec.md §6), through the CLI.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";

const CONFERENCE = join(import.meta.dir, "..", "..", "..", "docs", "simulate", "conference.md");

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vm-report-comment-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, md: string): string {
  const p = join(dir, name);
  mkdirSync(join(p, ".."), { recursive: true });
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

const T = "| A | B |\n|--:|--:|\n| 1 | 2.00 |\n";
const F = "```vmark #t\nB = A * 2\n```\n";
const LEVERS =
  "```vmark #ev\nparam p integer in [1, 3] lattice 1 = default 2\nq = p * 2\nassert q < 6\n```\n";

describe("check", () => {
  test("the pre-review's cascade passes", async () => {
    const r = await run([
      "check",
      file("cascade.md", T + "\n<!--vmark:report #t report gates-->\n\n" + F),
    ]);
    expect(r.out).toContain("0 problems");
    expect(r.code).toBe(0);
  });

  test("a malformed comment between a table and its fence is one finding", async () => {
    const r = await run(["check", file("empty.md", T + "\n<!--vmark:report #t-->\n\n" + F)]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("SHEET");
    expect(r.out).toContain("a report comment declares no report");
    expect(r.out).not.toContain("UNDEF");
    expect(r.out).toContain("1 problem (0 stale, 1 error)");
  });

  test("an unknown word and a nested comment", async () => {
    const r = await run([
      "check",
      file(
        "colon.md",
        "<!--vmark:reports #x report gates-->\n\n> <!--vmark:report #y report gates-->\n",
      ),
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("ANCHOR");
    expect(r.out).toContain("unknown `vmark:` comment `reports`");
    expect(r.out).toContain("a report comment must be at top level");
    expect(r.out).toContain("2 problems (0 stale, 2 errors)");
  });

  test("a comment in a fenced example is inert", async () => {
    const md = "````markdown\n<!--vmark:report #x-->\n````\n\n<!--vmark:no-formulas-->\n";
    const r = await run(["check", file("inert.md", md)]);
    expect(r.code).toBe(0);
  });
});

describe("simulate", () => {
  test("a file whose only reports are comments runs them", async () => {
    const md =
      LEVERS +
      "\n<!--vmark:report #ev\nreport gates\n-->\n\n<!--vmark:report #more report forbidden-->\n";
    const r = await run(["simulate", file("only.md", md)]);
    expect(r.code).toBe(0);
    expect(r.err).not.toContain("no report statement");
    expect(r.out).toContain("#ev\n\nreport gates");
    expect(r.out).toContain("#more\n\nreport forbidden");
    expect(r.err).toContain("2 of 2 sheets ran");
  });

  test("a comment before its fence opens the sheet and reports first", async () => {
    const md =
      "<!--vmark:report #ev report forbidden-->\n\n" +
      LEVERS.replace("assert", "report gates\nassert");
    const r = await run(["simulate", file("before.md", md)]);
    expect(r.code).toBe(0);
    expect(r.out.indexOf("report forbidden")).toBeLessThan(r.out.indexOf("report gates"));
    expect(r.out.match(/^#ev$/gm)).toHaveLength(1);
  });
});

test("infer --write puts the new fence between the table and the comment", async () => {
  const table = "| A | B |\n|--:|--:|\n| 1 | 2.00 |\n| 2 | 4.00 |\n| 3 | 6.00 |\n";
  const comment = "<!--vmark:report #t report gates-->";
  const p = file("infer.md", table + "\n" + comment + "\n");
  const r = await run(["infer", "--write", p]);
  expect(r.code).toBe(0);
  const written = readFileSync(p, "utf8");
  const fence = written.indexOf("```vmark #unnamed1");
  expect(fence).toBeGreaterThan(written.indexOf("| 3 | 6.00 |"));
  expect(fence).toBeLessThan(written.indexOf(comment));
});

describe("the guide's document", () => {
  const md = readFileSync(CONFERENCE, "utf8");

  test("check passes and explain lists the comment sheets in order", async () => {
    expect((await run(["check", CONFERENCE])).code).toBe(0);
    const r = await run(["explain", CONFERENCE]);
    expect(r.out).toMatch(/#readings {2}\(no table\)[\s\S]*#ledger {2}\(no table\)/);
  });

  test("simulate prints the same readings as the fenced form", async () => {
    // the fenced twin: every report comment written back as a fence
    const fenced = md.replace(
      /<!--vmark:report #(\w+)[ \t\n]*([\s\S]*?)\s*-->/g,
      (_m, id: string, body: string) => "```vmark #" + id + "\n" + body + "\n```",
    );
    expect(fenced).not.toBe(md);
    const a = await run(["simulate", file("comments/conference.md", md)]);
    const b = await run(["simulate", file("fences/conference.md", fenced)]);
    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    const strip = (s: string) => s.replace(/^==> .* <==$/m, "");
    expect(strip(a.out)).toBe(strip(b.out));
  });
});
