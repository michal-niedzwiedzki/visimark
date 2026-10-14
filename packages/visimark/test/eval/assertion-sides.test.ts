/**
 * `check` keeps both sides of a comparison assertion, for `report slack`
 * (docs/design/a-slack-report-for-the-nearest-miss-spec.md §3.1, §3.2, §5).
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { publicAssertions } from "../../src/report/json.js";
import type { Value } from "../../src/eval/value.js";

const CONFERENCE = readFileSync(
  join(import.meta.dir, "..", "..", "..", "..", "docs", "simulate", "conference.md"),
  "utf8",
);

const run = (md: string) => check(build(locate(md)));
const text = (v: Value): string =>
  v.t === "num" ? v.d.toString() : v.t === "date" ? v.iso : v.t === "str" ? v.s : String(v.b);

test("conference.md: three comparisons, their sides and widths", () => {
  const got = run(CONFERENCE).assertions.map((a) => ({
    comparison: a.comparison,
    left: a.sides && text(a.sides.left),
    right: a.sides && text(a.sides.right),
    width: a.sides?.width,
  }));
  expect(got).toEqual([
    { comparison: "<=", left: "250", right: "300", width: 0 },
    { comparison: ">=", left: "6975", right: "0", width: 2 },
    { comparison: "<=", left: "0.333", right: "0.5", width: 3 },
  ]);
});

test("not one comparison: no comparison, no sides", () => {
  const r = run(
    "```vmark #s\nx = 2\nassert x != 9\nassert x >= 0 and x <= 3\nassert (x < 3)\n```\n",
  );
  expect(r.assertions.map((a) => [a.comparison, a.sides === undefined])).toEqual([
    [undefined, true],
    [undefined, true],
    ["<", false],
  ]);
});

test("a side with no derived width gives width null", () => {
  const [a] = run("```vmark #s\nx = 2\nassert x / 4 > 0.25\n```\n").assertions;
  expect(a!.comparison).toBe(">");
  expect(a!.sides!.width).toBeNull();
  expect(text(a!.sides!.left)).toBe("0.5");
});

test("a date comparison keeps date-valued sides", () => {
  const [a] = run("```vmark #s\ndue = 2027-01-01 + 2\nassert due <= 2027-01-05\n```\n").assertions;
  expect(a!.sides!.left.t).toBe("date");
  expect(a!.sides!.right.t).toBe("date");
});

test("an unverifiable assertion keeps no sides", () => {
  const [a] = run("```vmark #s\nassert nope >= 1\n```\n").assertions;
  expect(a!.holds).toBeNull();
  expect(a!.comparison).toBe(">=");
  expect(a!.sides).toBeUndefined();
});

test("eval --json's assertions do not carry the new fields", () => {
  for (const a of publicAssertions(run(CONFERENCE).assertions)) {
    expect(Object.keys(a)).toEqual(["sheet", "source", "holds", "operands", "substituted"]);
  }
});
