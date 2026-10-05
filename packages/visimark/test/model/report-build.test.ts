import { describe, expect, test } from "bun:test";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §4.2

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

describe("reports in the model", () => {
  test("a report is collected into its sheet, in order, with absolute spans", () => {
    const md = fence("runs", "x = 1\nreport gates\nreport deltas on runs.x among all");
    const model = build(locate(md));
    const reports = model.sheets.get("runs")!.reports;
    expect(reports.map((r) => r.text)).toEqual(["report gates", "report deltas on runs.x among all"]);
    expect(md.slice(reports[1]!.span.start, reports[1]!.span.end)).toBe("report deltas on runs.x among all");
    const ref = reports[1]!.refs[0]!;
    expect(md.slice(ref.start, ref.end)).toBe("runs.x");
    expect(reports[0]!.id).toMatch(/^runs::report@\d+$/);
  });

  test("a report needs no table", () => {
    const model = build(locate(fence("s", "report gates")));
    expect(model.findings).toEqual([]);
    expect(model.sheets.get("s")!.reports).toHaveLength(1);
  });

  test("a report in a document-scope block is SHEET", () => {
    const model = build(locate(fence(null, "report gates")));
    expect(model.findings.map((f) => [f.code, f.message])).toEqual([
      ["SHEET", "`report` must be in a `#id` sheet block"],
    ]);
  });

  test("an identical statement twice is DUP, naming the sheet", () => {
    const model = build(locate(fence("s", "report gates\nreport   gates")));
    expect(model.findings.map((f) => [f.code, f.sheetId, f.name, f.message])).toEqual([
      ["DUP", "s", undefined, "report gates is declared twice in sheet s"],
    ]);
    expect(model.sheets.get("s")!.reports).toHaveLength(1);
  });

  test("the same report with different options is not a duplicate", () => {
    const model = build(
      locate(fence("s", "a = 1\nb = 2\nreport deltas on s.a among all\nreport deltas on s.b among all")),
    );
    expect(model.findings).toEqual([]);
    expect(model.sheets.get("s")!.reports).toHaveLength(2);
  });

  test("a malformed report is a TYPE finding with no name", () => {
    const model = build(locate(fence("s", "report foo")));
    expect(model.findings.map((f) => [f.code, f.sheetId, f.name])).toEqual([
      ["TYPE", "s", undefined],
    ]);
  });

  test("a binding called report still builds", () => {
    const model = build(locate(fence("s", "report = 5")));
    expect(model.sheets.get("s")!.scalars.has("report")).toBe(true);
    expect(model.sheets.get("s")!.reports).toEqual([]);
  });
});
