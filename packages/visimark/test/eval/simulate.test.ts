import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../../src/eval/check.js";
import { simulate } from "../../src/eval/simulate.js";
import type { DocModel } from "../../src/model/types.js";

// docs/design/add-a-simulate-command-spec.md §3 and §5

const FIXTURE = readFileSync(
  join(import.meta.dir, "..", "fixtures", "simulation", "simulate.md"),
  "utf8",
);

const num = (sim: ReturnType<typeof simulate>, i: number, id: string): string => {
  const v = sim.answers[i]!.scalars.get(id);
  return v && v.t === "num" ? v.d.toFixed(2) : "?";
};

describe("the grid", () => {
  test("nine questions in grid order, plus the base", () => {
    const sim = simulate(FIXTURE);
    expect(sim.gridSize).toBe(9);
    expect(sim.params.map((p) => [p.id, p.label, p.points])).toEqual([
      ["plan.hours", "hours", ["0", "10", "20"]],
      ["plan.disc", "disc", ["0", "0.05", "0.1"]],
    ]);
    expect(sim.answers.map((a) => a.question.index)).toEqual(["base", 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Object.fromEntries(sim.answers[7]!.question.values)).toEqual({
      "plan.hours": "20",
      "plan.disc": "0",
    });
    expect(sim.answers[0]!.question.values.size).toBe(0);
  });

  test("exactly one evaluation per question (spec §5 item 3)", () => {
    let calls = 0;
    const sim = simulate(FIXTURE, {
      evaluate: (m: DocModel) => {
        calls++;
        return check(m);
      },
    });
    expect(sim.answers.length).toBe(10);
    expect(calls).toBe(10);
  });

  test("answers carry values, assertions and feasibility", () => {
    const sim = simulate(FIXTURE);
    expect(num(sim, 0, "plan.margin")).toBe("500.00");
    expect(num(sim, 9, "plan.margin")).toBe("-650.00");
    expect(sim.answers[9]!.holds).toEqual([false, false]);
    expect(sim.answers[1]!.holds).toEqual([true, true]);
    expect(sim.answers.some((a) => a.faulted)).toBe(false);
    expect(sim.assertions.map((a) => a.key)).toEqual(["margin >= 0", "hours <= 15"]);
  });

  test("progress is reported once per question, base counted", () => {
    const seen: string[] = [];
    simulate(FIXTURE, { onQuestion: (i, n) => seen.push(`${i}/${n}`) });
    expect(seen).toEqual([
      "1/10",
      "2/10",
      "3/10",
      "4/10",
      "5/10",
      "6/10",
      "7/10",
      "8/10",
      "9/10",
      "10/10",
    ]);
  });
});

describe("faulted questions (case 9)", () => {
  const md = FIXTURE.replace(
    "assert margin >= 0",
    "per_hour precision 2 = margin / hours\nassert margin >= 0\nassert per_hour >= 0",
  );
  test("questions at hours=0 cannot verify per_hour", () => {
    const sim = simulate(md);
    expect(sim.answers.filter((a) => a.faulted).map((a) => a.question.index)).toEqual([1, 2, 3]);
    expect(sim.answers[0]!.faulted).toBe(false);
  });
});

describe("sheets that cannot start", () => {
  test("an UNDEF in a report's REF blocks its sheet (case 6)", () => {
    const sim = simulate(FIXTURE.replace("deltas on plan.margin", "deltas on plan.marginn"));
    expect(sim.blocked.map((b) => [b.sheetId, b.first.code, b.more])).toEqual([
      ["plan", "UNDEF", 0],
    ]);
    expect(sim.answers).toEqual([]);
  });
  test("an impossible lattice blocks every report sheet (case 8)", () => {
    const sim = simulate(FIXTURE.replace("lattice 10", "lattice 3"));
    expect(sim.blocked.map((b) => [b.sheetId, b.first.code, b.first.name])).toEqual([
      ["plan", "TYPE", "hours"],
    ]);
    expect(sim.params).toEqual([]);
  });
  test("a fault outside a sheet's REF closure does not block it", () => {
    const md = FIXTURE + "\n```vmark #other\nbad precision 2 = 1 / 0\n```\n";
    const sim = simulate(md);
    expect(sim.blocked).toEqual([]);
    expect(sim.answers.length).toBe(10);
  });
  test("a blocked sheet's REFs do not fault the questions a clean sheet reads", () => {
    const md =
      FIXTURE + "\n```vmark #broken\nbad precision 2 = 1 / 0\nreport deltas on broken.bad among all\n```\n";
    const sim = simulate(md);
    expect(sim.blocked.map((b) => b.sheetId)).toEqual(["broken"]);
    expect(sim.answers.length).toBe(10);
    expect(sim.answers.some((a) => a.faulted)).toBe(false);
  });
  test("a fault inside the closure blocks it", () => {
    const sim = simulate(
      FIXTURE.replace("rate precision 2 = 100.00", "rate precision 2 = 100.00 / 0"),
    );
    expect(sim.blocked.map((b) => b.first.code)).toEqual(["TYPE"]);
  });
});

describe("review focus", () => {
  test("a lattice param at document scope joins the grid under its bare name", () => {
    const md =
      "```vmark\nparam fx precision 1 in [1, 2] lattice 0.5 = default 1\n```\n\n" +
      FIXTURE.replace(
        "price precision 2 = 1500.00 * (1 - disc)",
        "price precision 2 = 1500.00 * (1 - disc) * fx",
      );
    const sim = simulate(md);
    expect(sim.params.map((p) => [p.id, p.label])).toEqual([
      ["fx", "fx"],
      ["plan.hours", "hours"],
      ["plan.disc", "disc"],
    ]);
    expect(sim.gridSize).toBe(27);
  });
  test("a default off the lattice is the base, never a numbered row", () => {
    const sim = simulate(FIXTURE.replace("lattice 10 = default 10", "lattice 10 = default 7"));
    expect(num(sim, 0, "plan.cost")).toBe("700.00");
    expect(sim.answers.slice(1).some((a) => a.question.values.get("plan.hours") === "7")).toBe(
      false,
    );
  });
  test("two lattice params with one bare name are labelled sheet.name", () => {
    const md =
      FIXTURE +
      "\n```vmark #alt\nparam hours precision 0 integer in [1, 2] lattice 1 = default 1\nx precision 0 = hours\n```\n";
    const sim = simulate(md);
    expect(sim.params.map((p) => p.label)).toEqual(["plan.hours", "disc", "alt.hours"]);
  });
  test("the base built after the grid is the same model as before it", () => {
    const sim = simulate(FIXTURE);
    const again = simulate(FIXTURE);
    expect(num(again, 0, "plan.margin")).toBe(num(sim, 0, "plan.margin"));
  });
});
