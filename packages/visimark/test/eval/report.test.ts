import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §3.3 and §4.2

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

function run(md: string) {
  return check(build(locate(md)));
}

const brief = (md: string) =>
  run(md)
    .findings.filter((f) => f.code !== "WARN" && f.code !== "COVERAGE")
    .map((f) => ({
      code: f.code,
      sheetId: f.sheetId,
      name: f.name,
      raw: f.raw,
      message: f.message,
    }));

describe("report refs", () => {
  test("a ref that resolves to nothing is UNDEF, with no name", () => {
    expect(brief(fence("s", "x = 1\nreport deltas on s.nope among all"))).toEqual([
      { code: "UNDEF", sheetId: "s", name: undefined, raw: "s.nope", message: undefined },
    ]);
  });

  test("a bare ref resolves in the sheet", () => {
    expect(brief(fence("s", "x = 1\nreport deltas on x among all"))).toEqual([]);
  });

  test("a bare ref resolves to a document-scope scalar", () => {
    const md =
      fence(null, "rate = 5") +
      fence("s", "x = 1\nreport best scalar rate direction max among feasible");
    expect(brief(md)).toEqual([]);
  });

  test("a ref to a column is TYPE", () => {
    const md = "| a |\n|---|\n| 1 |\n\n" + fence("s", "report deltas on s.a among all") + "\n";
    expect(brief(md)).toEqual([
      {
        code: "TYPE",
        sheetId: "s",
        name: undefined,
        raw: undefined,
        message: "a report reads a scalar; s.a is a column",
      },
    ]);
  });

  test("a ref to a param resolves", () => {
    expect(
      brief(
        fence(
          "s",
          "param x precision 0 integer in [0, 10] lattice 5 = default 5\nreport deltas on s.x among all",
        ),
      ),
    ).toEqual([]);
  });

  test("a scalar that only a report reads is not WARN", () => {
    const fs = run(fence("s", "x = 1\nreport deltas on s.x among all")).findings;
    expect(fs.filter((f) => f.code === "WARN")).toEqual([]);
  });

  test("a scalar nothing reads still is", () => {
    const fs = run(fence("s", "x = 1\ny = 2\nreport deltas on s.x among all")).findings;
    expect(fs.filter((f) => f.code === "WARN").map((f) => f.name)).toEqual(["y"]);
  });

  test("a report changes no evaluation and no exit code on its own", () => {
    const withReport = run(fence("s", "x precision 0 = 2 * 3\nreport gates"));
    expect(String((withReport.values.get("s.x") as { d: unknown }).d)).toBe("6");
    expect(withReport.exitCode).toBe(0);
  });

  test("a report adds no dependency edge: no CYCLE from naming a binding", () => {
    const fs = run(
      fence(
        "s",
        "x = 1\nreport deltas on s.x among all\nreport best scalar s.x direction max among feasible",
      ),
    ).findings;
    expect(fs.filter((f) => f.code === "CYCLE")).toEqual([]);
  });
});
