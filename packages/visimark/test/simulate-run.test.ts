import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { simulateRun } from "../src/report/simulate-run.js";

const fixture = readFileSync(join(import.meta.dir, "fixtures/simulation/simulate.md"), "utf8");

test("the clean fixture gives the spec's header, count line and summary", () => {
  const run = simulateRun(fixture, "simulate.md");
  expect(run.stdout[0]).toBe("==> simulate.md <==");
  expect(run.stdout[1]).toBe("#plan");
  expect(run.stderr.map((l) => l.text)).toEqual([
    "simulate: simulate.md: 10 questions (2 lattice params)",
    "simulate: simulate.md: 1 of 1 sheets ran",
  ]);
  expect(run).toMatchObject({ noReport: false, sheets: 1, blocked: 0 });
});

test("an elapsed callback ends the summary line, and its absence leaves no time", () => {
  const run = simulateRun(fixture, "simulate.md", { elapsed: () => "2.0 s" });
  expect(run.stderr.at(-1)!.text).toBe("simulate: simulate.md: 1 of 1 sheets ran in 2.0 s");
});

test("a document with no report statement is noReport and prints nothing", () => {
  const run = simulateRun("# Nothing\n", "x.md");
  expect(run.stdout).toEqual([]);
  expect(run.stderr).toEqual([{ text: "simulate: x.md: no report statement" }]);
  expect(run.noReport).toBe(true);
});

test("a sheet that cannot start is counted and its line is a fault", () => {
  const run = simulateRun(
    fixture.replace("plan.margin among all", "plan.marginn among all"),
    "s.md",
  );
  expect(run.blocked).toBe(1);
  expect(run.stdout.slice(-2)).toEqual(["#plan", "  (cannot start)"].slice(-2));
  expect(run.stderr.some((l) => l.fault === true && l.text.includes("cannot start: UNDEF"))).toBe(
    true,
  );
});

test("onPlan sees the question count and may throw to stop the run", () => {
  const seen: { questions: number; latticeParams: number }[] = [];
  let asked = 0;
  expect(() =>
    simulateRun(fixture, "s.md", {
      onPlan: (p) => {
        seen.push(p);
        throw new Error("stop");
      },
      onQuestion: () => asked++,
    }),
  ).toThrow("stop");
  expect(seen).toEqual([{ questions: 10, latticeParams: 2 }]);
  expect(asked).toBe(0);
});
