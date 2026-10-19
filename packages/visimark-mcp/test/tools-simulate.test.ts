import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "visimark";
import { readTools } from "../src/tools/read.js";
import type { Outcome, ToolDef } from "../src/tools/types.js";

const repo = join(import.meta.dir, "../../..");
const fixture = readFileSync(
  join(repo, "packages/visimark/test/fixtures/simulation/simulate.md"),
  "utf8",
);
const battery = join(repo, "docs/example-battery-storage.md");

function tool(maxQuestions?: number): ToolDef {
  const t = readTools({ maxQuestions }).find((x) => x.name === "visimark_simulate");
  if (!t) throw new Error("no visimark_simulate");
  return t;
}

function ok(outcome: Outcome): Record<string, any> {
  if ("fault" in outcome) throw new Error(`expected success, got ${outcome.fault.message}`);
  return JSON.parse(JSON.stringify(outcome.ok));
}

function faultOf(outcome: Outcome): { code: string; message: string } {
  if (!("fault" in outcome)) throw new Error("expected a fault");
  return outcome.fault;
}

/** What the CLI prints for `path`, with the elapsed time cut from the summary line. */
async function cliLines(
  path: string,
): Promise<{ stdout: string[]; stderr: string[]; exit: number }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exit = await runCli(["simulate", path], {
    out: (l) => stdout.push(l),
    err: (l) => stderr.push(l),
  });
  return {
    stdout,
    stderr: stderr.map((l) => l.replace(/ in [0-9.]+ (ms|s|min( [0-9]+ s)?)$/, "")),
    exit,
  };
}

const dir = mkdtempSync(join(tmpdir(), "visimark-simulate-"));

/** the tool on `text` as `content` against the CLI on the same text as a file */
async function twin(text: string, name: string): Promise<void> {
  const file = join(dir, name);
  writeFileSync(file, text);
  const expected = await cliLines(file);
  const body = ok(tool().run({ content: text }));
  const relabel = (l: string) => l.replaceAll(file, "<content>");
  expect(body["stdout"]).toEqual(expected.stdout.map(relabel));
  expect(body["stderr"]).toEqual(expected.stderr.map(relabel));
  expect(body["status"]).toBe(expected.exit === 0 ? "ok" : "problems");
}

test("the battery example by path gives the CLI's lines, minus the elapsed time", async () => {
  const expected = await cliLines(battery);
  const body = ok(tool().run({ path: battery }));
  expect(body).toMatchObject({ command: "simulate", status: "ok", file: battery, skipped: {} });
  expect(body["stdout"]).toEqual(expected.stdout);
  expect(body["stderr"]).toEqual(expected.stderr);
  expect(body["stderr"][0]).toContain("577 questions (5 lattice params)");
  expect(body["stderr"].at(-1)).toMatch(/3 of 3 sheets ran$/);
}, 30_000);

test("the clean fixture as content: header <content>, nothing skipped", () => {
  const body = ok(tool().run({ content: fixture }));
  expect(body["stdout"][0]).toBe("==> <content> <==");
  expect(body["stderr"]).toEqual([
    "simulate: <content>: 10 questions (2 lattice params)",
    "simulate: <content>: 1 of 1 sheets ran",
  ]);
  expect(body["skipped"]).toEqual({});
});

test("the other cases of the simulate spec have an MCP twin", async () => {
  await twin(fixture, "clean.md");
  await twin(fixture.replace("plan.margin among all", "plan.marginn among all"), "typo.md");
  await twin(
    fixture.replace(
      "hours precision 0 integer in [0, 20] lattice 10",
      "hours precision 0 integer in [0, 20] lattice 3",
    ),
    "step.md",
  );
  await twin(
    fixture.replace(
      "assert margin >= 0\n",
      "per_hour precision 2 = margin / hours\nassert margin >= 0\nassert per_hour >= 0\n",
    ),
    "faulted.md",
  );
  await twin(fixture.replace(/ lattice \S+/g, ""), "nolattice.md");
  await twin(fixture.replace("assert margin >= 0", "assert margin >= 2000"), "infeasible.md");
  await twin(readFileSync(join(repo, "docs/example-invoice.md"), "utf8"), "noreport.md");
}, 30_000);

test("a document with no report statement is problems, not a fault", () => {
  const body = ok(tool().run({ content: "# Nothing\n" }));
  expect(body).toMatchObject({ status: "problems", stdout: [] });
  expect(body["stderr"]).toEqual(["simulate: <content>: no report statement"]);
});

test("a sheet that cannot start is ok, and problems under failOnFault", () => {
  const broken = fixture.replace("plan.margin among all", "plan.marginn among all");
  expect(ok(tool().run({ content: broken }))["status"]).toBe("ok");
  const strict = ok(tool().run({ content: broken, failOnFault: true }));
  expect(strict["status"]).toBe("problems");
  expect(strict["stdout"].slice(-2)).toEqual(["#plan", "  (cannot start)"]);
  expect(ok(tool().run({ content: fixture, failOnFault: true }))["status"]).toBe("ok");
});

test("path and content together, or neither, are USAGE; an unreadable path is READ", () => {
  expect(faultOf(tool().run({ path: battery, content: fixture })).code).toBe("USAGE");
  expect(faultOf(tool().run({})).code).toBe("USAGE");
  expect(faultOf(tool().run({ path: join(dir, "nope.md") })).code).toBe("READ");
  expect(faultOf(tool().run({ content: fixture, failOnFault: "yes" })).code).toBe("USAGE");
});

test("a report sheet that reads an imported value cannot start under content", () => {
  const file = join(repo, "docs/example-invoice-csv-import.md");
  const extra =
    "\n```vmark #sim\nparam k precision 0 integer in [0, 2] lattice 1 = default 1\n" +
    "x precision 2 = SUM(lines.Gross) * k\nreport deltas on sim.x among all\n```\n";
  const text = readFileSync(file, "utf8") + extra;
  const asContent = ok(tool().run({ content: text }));
  expect(asContent["stdout"].slice(-2)).toEqual(["#sim", "  (cannot start)"]);
  expect(asContent["stderr"].some((l: string) => l.includes("cannot start: UNDEF"))).toBe(true);
  expect(asContent["skipped"]).toEqual({ imports: ["lines"] });
  const copy = join(repo, "docs/.simulate-import-test.md");
  writeFileSync(copy, text);
  try {
    const onDisk = ok(tool().run({ path: copy }));
    expect(onDisk["stdout"].at(-1)).not.toBe("  (cannot start)");
    expect(onDisk["skipped"]).toEqual({});
  } finally {
    Bun.spawnSync(["rm", "-f", copy]);
  }
});

test("two calls on one text return one result", () => {
  expect(ok(tool().run({ content: fixture }))).toEqual(ok(tool().run({ content: fixture })));
});

test("--max-questions refuses a bigger grid before any question runs, and is inclusive", () => {
  const refused = faultOf(tool(5).run({ content: fixture }));
  expect(refused.code).toBe("LIMIT");
  expect(refused.message).toBe(
    "visimark: <content> has 10 questions, over this server's limit of 5 (--max-questions)",
  );
  expect(ok(tool(10).run({ content: fixture }))["status"]).toBe("ok");
  expect(ok(tool(undefined).run({ content: fixture }))["status"]).toBe("ok");
});

test("a grid that cannot be built has no questions and is never refused", () => {
  const step = fixture.replace("lattice 10", "lattice 3");
  expect(ok(tool(1).run({ content: step }))["stdout"].at(-1)).toBe("  (cannot start)");
});

test("the cap is enforced before the grid is allocated", () => {
  // a billion questions: building the grid would exhaust memory long before it returned
  const huge =
    "```vmark #s\n" +
    "param a precision 0 integer in [0, 1000] lattice 1 = default 0\n" +
    "param b precision 0 integer in [0, 1000] lattice 1 = default 0\n" +
    "param c precision 0 integer in [0, 1000] lattice 1 = default 0\n" +
    "x precision 0 = a + b + c\n" +
    "report ledger assertions broken\n```\n";
  const refused = faultOf(tool(100).run({ content: huge }));
  expect(refused.code).toBe("LIMIT");
  expect(refused.message).toContain("1003003002 questions");
});

test("a single huge lattice is refused before its points are allocated", () => {
  const huge =
    "```vmark #s\nparam a precision 0 integer in [0, 1000000000000] lattice 1 = default 0\n" +
    "x precision 0 = a\nreport ledger assertions broken\n```\n";
  const refused = faultOf(tool(100).run({ content: huge }));
  expect(refused.code).toBe("LIMIT");
  expect(refused.message).toContain("1000000000002 questions");
});
