import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §4.1

const fence = (body: string): string => "```vmark #s\n" + body + "\n```\n";

function findings(body: string) {
  return check(build(locate(fence(body)))).findings.filter((f) => f.code !== "WARN");
}

const msg = (body: string) => {
  const fs = findings(body);
  return fs.map((f) => `${f.code} ${f.name ?? ""} ${f.message ?? ""}`.trim());
};

describe("a lattice on a param header", () => {
  const rows: [string, string, string][] = [
    [
      "no domain",
      "param x precision 0 lattice 5 = default 0",
      "TYPE x param x declares a lattice but no domain",
    ],
    [
      "a set",
      "param x precision 0 in { 1, 2 } lattice 1 = default 1",
      "TYPE x param x declares a lattice, but a set already lists its points",
    ],
    [
      "no upper bound",
      "param x precision 0 natural lattice 5 = default 0",
      "TYPE x param x declares a lattice, but its domain has no upper bound",
    ],
    [
      "no lower bound",
      "param x precision 0 in (, 10] lattice 5 = default 0",
      "TYPE x param x declares a lattice, but its domain has no lower bound",
    ],
    [
      "zero step",
      "param x precision 0 in [0, 10] lattice 0 = default 0",
      "TYPE x lattice step must be positive",
    ],
    [
      "negative step",
      "param x precision 0 in [0, 10] lattice -5 = default 0",
      "TYPE x lattice step must be positive",
    ],
    [
      "bare step on a percent param",
      "param x precision 3 in [0%, 10%] lattice 5 = default 0%",
      "TYPE x x is a percent; lattice step 5 must be too",
    ],
    [
      "percent step on a bare param",
      "param x precision 0 in [0, 10] lattice 5% = default 0",
      "TYPE x x is not a percent; lattice step 5% must not be one",
    ],
    [
      "a step wider than the precision",
      "param x precision 1 in [0, 1] lattice 0.25 = default 0",
      "PRECISION x lattice step 0.25 has 2 decimals; param x declares 1",
    ],
    [
      "a fractional step on an integer domain",
      "param x precision 1 integer in [0, 80] lattice 2.5 = default 0",
      "TYPE x lattice step 2.5 must be a whole number: param x is an integer domain",
    ],
    [
      "a step that does not reach the end",
      "param x precision 0 in [0, 10] lattice 3 = default 0",
      "TYPE x lattice step 3 does not reach the end of [0, 10]: 10 is not a multiple of 3 above 0",
    ],
    [
      "no point remains",
      "param x precision 0 in (0, 5) lattice 5 = default 1",
      "TYPE x lattice step 5 leaves no point in (0, 5)",
    ],
  ];
  for (const [label, line, expected] of rows) {
    test(label, () => {
      expect(msg(line)).toEqual([expected]);
    });
  }

  test("a lattice parse failure is the existing TYPE, named for the param", () => {
    expect(msg("param x precision 0 in [0, 10] lattice = default 0")).toEqual([
      "TYPE x a lattice step must be a number literal",
    ]);
  });

  test("a default off its lattice is legal", () => {
    expect(msg("param x precision 0 in [0, 80] lattice 20 = default 7")).toEqual([]);
  });

  test("a valid lattice raises nothing", () => {
    expect(
      msg(
        "param extra_hours precision 0 integer in [0, 80] lattice 20 = default 40\n" +
          "param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%\n" +
          "param bump precision 1 in (0, 10) lattice 5 = default 5",
      ),
    ).toEqual([]);
  });

  test("the first fault wins: percent-ness before width before the domain", () => {
    // bare step on a percent param AND wider than precision AND unbounded
    expect(msg("param x precision 3 in [0%, ) lattice 0.5 = default 0%")).toEqual([
      "TYPE x x is a percent; lattice step 0.5 must be too",
    ]);
  });

  test("a faulty domain reports only the domain finding", () => {
    expect(msg("param x precision 1 integer in [0.2, 0.8] lattice 1 = default 0")).toEqual([
      "DOMAIN x param x declares an empty domain: integer in [0.2, 0.8] has no legal value",
    ]);
  });

  test("an impossible lattice does not suppress the param's readers", () => {
    const body = "param x precision 0 in [0, 10] lattice 3 = default 4\ny precision 0 = x + 1\n";
    const result = check(build(locate(fence(body))));
    expect(result.findings.filter((f) => f.code === "NOTE")).toEqual([]);
    expect(String((result.values.get("s.y") as { d: unknown }).d)).toBe("5");
  });
});
