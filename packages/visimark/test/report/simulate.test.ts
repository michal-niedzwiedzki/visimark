import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { simulate } from "../../src/eval/simulate.js";
import { renderBlocked, renderSheet } from "../../src/report/simulate.js";

// docs/design/add-a-simulate-command-spec.md §4 and §5. Each expected text was
// worked out by hand from the fixture before it was pinned here.

const FIXTURE = readFileSync(
  join(import.meta.dir, "..", "fixtures", "simulation", "simulate.md"),
  "utf8",
);

const render = (md: string): string => {
  const sim = simulate(md);
  return sim.reportSheets.map((s) => renderSheet(sim, s).join("\n")).join("\n");
};

const ONLY_LEDGER = FIXTURE.replace(/report (deltas|gates|best|forbidden).*\n/g, "");

describe("the five reports", () => {
  test("case 1: the clean fixture", () => {
    expect(render(FIXTURE)).toBe(CLEAN);
  });
  test("case 9: faulted questions", () => {
    const md = FIXTURE.replace(
      "assert margin >= 0",
      "per_hour precision 2 = margin / hours\nassert margin >= 0\nassert per_hour >= 0",
    );
    expect(render(md)).toBe(V9);
  });
  test("case 10: no lattice param", () => {
    expect(render(FIXTURE.replace(" lattice 10", "").replace(" lattice 5%", ""))).toBe(V10);
  });
  test("case 11: nothing is feasible", () => {
    expect(render(FIXTURE.replace("assert margin >= 0", "assert margin >= 2000"))).toBe(V11);
  });
  test("ties, a REF that never moves, and deltas with no on", () => {
    const md = FIXTURE.replace(
      "report forbidden",
      "report forbidden\nreport best scalar plan.cost direction min\nreport deltas",
    );
    expect(render(md)).toBe(VT);
  });
  test("a blocked sheet", () => {
    expect(renderBlocked("plan")).toEqual(["#plan", "  (cannot start)"]);
  });
});

describe("review focus", () => {
  test("two lattice params with one bare name print as sheet.name", () => {
    const md =
      ONLY_LEDGER +
      "\n```vmark #alt\nparam hours precision 0 integer in [1, 2] lattice 1 = default 1\nx precision 0 = hours\n```\n";
    expect(render(md).split("\n")[4]).toBe(
      "  question  plan.hours  disc  alt.hours  feasible  broken",
    );
  });
  test("a percent REF prints as a decimal at its width; only lattice params print as percents", () => {
    const md = FIXTURE.replace("report deltas on plan.margin", "report deltas on plan.disc");
    const lines = renderSheet(simulate(md), "plan");
    const at = lines.indexOf("report deltas on plan.disc");
    expect(lines.slice(at + 2, at + 5)).toEqual([
      "  plan.disc  base 0.00",
      "    low   0.00   (0.00)  hours=0 disc=0%",
      "    high  0.10  (+0.10)  hours=0 disc=10%",
    ]);
  });
});

const CLEAN =
  "#plan\n\nreport ledger assertions broken\n\n  question  hours  disc  feasible  broken\n  base         10    0%  yes\n  1             0    0%  yes\n  2             0    5%  yes\n  3             0   10%  yes\n  4            10    0%  yes\n  5            10    5%  yes\n  6            10   10%  yes\n  7            20    0%  no        margin >= 0; hours <= 15\n  8            20    5%  no        margin >= 0; hours <= 15\n  9            20   10%  no        margin >= 0; hours <= 15\n\nreport deltas on plan.margin\n\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high  1500.00  (+1000.00)  hours=0 disc=0%\n\nreport gates\n\n  9 questions\n  assert       holds  fails  faulted  base   first failure\n  margin >= 0      6      3        0  holds  hours=20 disc=0%\n  hours <= 15      6      3        0  holds  hours=20 disc=0%\n\nreport best scalar plan.margin direction max among feasible\n\n  hours=0 disc=0%\n  plan.margin  1500.00  (+1000.00 against base)\n  chosen from 6 feasible of 9 questions\n\nreport forbidden\n\n  hours = 20  every question with it breaks an assertion\n  3 of 9 questions are infeasible";

const V9 =
  "#plan\n\nreport ledger assertions broken\n\n  question  hours  disc  feasible  broken\n  base         10    0%  yes\n  1             0    0%  faulted\n  2             0    5%  faulted\n  3             0   10%  faulted\n  4            10    0%  yes\n  5            10    5%  yes\n  6            10   10%  yes\n  7            20    0%  no        margin >= 0; per_hour >= 0; hours <= 15\n  8            20    5%  no        margin >= 0; per_hour >= 0; hours <= 15\n  9            20   10%  no        margin >= 0; per_hour >= 0; hours <= 15\n\nreport deltas on plan.margin\n\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high   500.00      (0.00)  hours=10 disc=0%\n\nreport gates\n\n  9 questions\n  assert         holds  fails  faulted  base   first failure\n  margin >= 0        6      3        0  holds  hours=20 disc=0%\n  per_hour >= 0      3      3        3  holds  hours=20 disc=0%\n  hours <= 15        6      3        0  holds  hours=20 disc=0%\n\nreport best scalar plan.margin direction max among feasible\n\n  hours=10 disc=0%\n  plan.margin  500.00  (0.00 against base)\n  chosen from 3 feasible of 9 questions\n\nreport forbidden\n\n  hours = 0   every question with it breaks an assertion\n  hours = 20  every question with it breaks an assertion\n  3 of 9 questions are infeasible";

const V10 =
  "#plan\n\nreport ledger assertions broken\n\n  question  feasible  broken\n  base      yes\n\nreport deltas on plan.margin\n\n  no grid: no param declares a lattice\n\nreport gates\n\n  0 questions\n  assert       holds  fails  faulted  base   first failure\n  margin >= 0      0      0        0  holds\n  hours <= 15      0      0        0  holds\n\nreport best scalar plan.margin direction max among feasible\n\n  no grid: no param declares a lattice\n\nreport forbidden\n\n  no grid: no param declares a lattice";

const V11 =
  "#plan\n\nreport ledger assertions broken\n\n  question  hours  disc  feasible  broken\n  base         10    0%  no        margin >= 2000\n  1             0    0%  no        margin >= 2000\n  2             0    5%  no        margin >= 2000\n  3             0   10%  no        margin >= 2000\n  4            10    0%  no        margin >= 2000\n  5            10    5%  no        margin >= 2000\n  6            10   10%  no        margin >= 2000\n  7            20    0%  no        margin >= 2000; hours <= 15\n  8            20    5%  no        margin >= 2000; hours <= 15\n  9            20   10%  no        margin >= 2000; hours <= 15\n\nreport deltas on plan.margin\n\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high  1500.00  (+1000.00)  hours=0 disc=0%\n\nreport gates\n\n  9 questions\n  assert          holds  fails  faulted  base   first failure\n  margin >= 2000      0      9        0  fails  hours=0 disc=0%\n  hours <= 15         6      3        0  holds  hours=20 disc=0%\n\nreport best scalar plan.margin direction max among feasible\n\n  no feasible question\n\nreport forbidden\n\n  hours = 0   every question with it breaks an assertion\n  hours = 10  every question with it breaks an assertion\n  hours = 20  every question with it breaks an assertion\n  disc = 0%   every question with it breaks an assertion\n  disc = 5%   every question with it breaks an assertion\n  disc = 10%  every question with it breaks an assertion\n  9 of 9 questions are infeasible";

const VT =
  "#plan\n\nreport ledger assertions broken\n\n  question  hours  disc  feasible  broken\n  base         10    0%  yes\n  1             0    0%  yes\n  2             0    5%  yes\n  3             0   10%  yes\n  4            10    0%  yes\n  5            10    5%  yes\n  6            10   10%  yes\n  7            20    0%  no        margin >= 0; hours <= 15\n  8            20    5%  no        margin >= 0; hours <= 15\n  9            20   10%  no        margin >= 0; hours <= 15\n\nreport deltas on plan.margin\n\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high  1500.00  (+1000.00)  hours=0 disc=0%\n\nreport gates\n\n  9 questions\n  assert       holds  fails  faulted  base   first failure\n  margin >= 0      6      3        0  holds  hours=20 disc=0%\n  hours <= 15      6      3        0  holds  hours=20 disc=0%\n\nreport best scalar plan.margin direction max among feasible\n\n  hours=0 disc=0%\n  plan.margin  1500.00  (+1000.00 against base)\n  chosen from 6 feasible of 9 questions\n\nreport forbidden\n\n  hours = 20  every question with it breaks an assertion\n  3 of 9 questions are infeasible\n\nreport best scalar plan.cost direction min\n\n  hours=0 disc=0%\n  plan.cost  0.00  (-1000.00 against base)\n  chosen from 9 questions\n  3 questions tie; the first in grid order is shown\n\nreport deltas\n\n  plan.rate  base 100.00\n    low   100.00  (0.00)  hours=0 disc=0%\n    high  100.00  (0.00)  hours=0 disc=0%\n  plan.cost  base 1000.00\n    low      0.00  (-1000.00)  hours=0 disc=0%\n    high  2000.00  (+1000.00)  hours=20 disc=0%\n  plan.price  base 1500.00\n    low   1350.00  (-150.00)  hours=0 disc=10%\n    high  1500.00     (0.00)  hours=0 disc=0%\n  plan.margin  base 500.00\n    low   -650.00  (-1150.00)  hours=20 disc=10%\n    high  1500.00  (+1000.00)  hours=0 disc=0%";
