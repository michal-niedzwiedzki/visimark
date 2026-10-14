import { describe, expect, test } from "bun:test";
import {
  COLON_NESTED,
  MALFORMED_MARKER,
  REPORT_COMMENT_EMPTY,
  REPORT_COMMENT_NESTED,
  REPORT_COMMENT_NO_ID,
  REPORT_COMMENT_NOT_REPORT,
  REPORT_COMMENT_TRAILING,
  REPORT_COMMENT_UNCLOSED,
  build,
  unknownColonWord,
} from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/declare-a-sheet-s-report-statements-spec.md §3 and §4

const T = "| A | B |\n|--:|--:|\n| 1 | 2.00 |\n";
const F = "```vmark #t\nB = A * 2\n```\n";
const fence = (id: string, body: string): string => "```vmark #" + id + "\n" + body + "\n```\n";

function findings(md: string) {
  return build(locate(md)).findings.map((f) => ({
    code: f.code,
    message: f.message,
    sheetId: f.sheetId,
    at: f.span ? md.slice(f.span.start, f.span.end) : undefined,
  }));
}

describe("a report comment in the model", () => {
  test("opens a table-less sheet and collects its lines", () => {
    const md = "<!--vmark:report #ledger\nreport gates\nreport forbidden\n-->\n";
    const model = build(locate(md));
    expect(model.findings).toEqual([]);
    const s = model.sheets.get("ledger")!;
    expect(s.table).toBeNull();
    expect(s.reports.map((r) => r.text)).toEqual(["report gates", "report forbidden"]);
    expect(md.slice(s.reports[1]!.span.start, s.reports[1]!.span.end)).toBe("report forbidden");
    expect(model.blockOfSheet.has("ledger")).toBe(false);
  });

  test("merges with a fence in source order, whichever comes first", () => {
    const md =
      "<!--vmark:report #a report forbidden-->\n\n" +
      fence("b", "x = 1") +
      "\n" +
      fence("a", "y = 2\nreport gates") +
      "\n<!--vmark:report #a report deltas among all-->\n";
    const model = build(locate(md));
    expect(model.findings).toEqual([]);
    expect([...model.sheets.keys()]).toEqual(["a", "b"]);
    expect(model.sheets.get("a")!.reports.map((r) => r.text)).toEqual([
      "report forbidden",
      "report gates",
      "report deltas among all",
    ]);
  });

  test("a fence after the comment still owns its table", () => {
    const md = T + "\n<!--vmark:report #t report gates-->\n\n" + F;
    const model = build(locate(md));
    expect(model.findings).toEqual([]);
    expect(model.sheets.get("t")!.table).not.toBeNull();
    expect(model.sheets.get("t")!.reports).toHaveLength(1);
  });

  test("DUP across a fence and a comment", () => {
    const md = fence("r", "report gates") + "\n<!--vmark:report #r report gates-->\n";
    const model = build(locate(md));
    expect(model.findings).toHaveLength(1);
    const f = model.findings[0]!;
    expect(f.code).toBe("DUP");
    expect(f.message).toBe("report gates is declared twice in sheet r");
    expect(md.slice(f.span!.start, f.span!.end)).toBe("report gates");
    expect(f.span!.start).toBeGreaterThan(md.indexOf("<!--"));
    expect(f.relatedSpan!.start).toBeLessThan(md.indexOf("<!--"));
  });

  test("a bad report line is TYPE on that line, and the rest still build", () => {
    const md = "<!--vmark:report #r report heatmap\nreport gates-->\n";
    const model = build(locate(md));
    expect(model.findings.map((f) => [f.code, f.sheetId])).toEqual([["TYPE", "r"]]);
    const f = model.findings[0]!;
    expect(f.message).toStartWith("unknown report `heatmap`");
    expect(md.slice(f.span!.start, f.span!.end)).toBe("heatmap");
    const s = model.sheets.get("r")!;
    expect(s.reports.map((r) => r.text)).toEqual(["report gates"]);
    expect(s.droppedLines).toBe(true);
  });

  test("an invalid id is reported and the sheet still builds", () => {
    const md = "<!--vmark:report #a/b report gates-->\n";
    expect(findings(md)).toEqual([
      {
        code: "SHEET",
        message: "sheet id `a/b` is not a valid identifier — invalid character `/`",
        sheetId: "a/b",
        at: md.trimEnd(),
      },
    ]);
    expect(build(locate(md)).sheets.has("a/b")).toBe(true);
  });
});

describe("one structural finding per comment, and it contributes nothing", () => {
  const one = (
    md: string,
    code: string,
    message: string,
    sheetId: string | undefined,
    at: string,
  ) => expect(findings(md) as unknown[]).toEqual([{ code, message, sheetId, at }]);

  test("the pre-review's cascade is gone", () => {
    expect(findings(T + "\n<!--vmark:report #t report gates-->\n\n" + F)).toEqual([]);
  });

  test("an empty body", () => {
    const md = T + "<!--vmark:report #t-->\n" + F;
    one(md, "SHEET", REPORT_COMMENT_EMPTY, "t", "<!--vmark:report #t-->");
    expect(build(locate("<!--vmark:report #x # only a note-->\n")).sheets.has("x")).toBe(false);
  });

  test("a non-report line, at the first such line", () => {
    one(
      T + "<!--vmark:report #t report x = 1-->\n" + F,
      "SHEET",
      REPORT_COMMENT_NOT_REPORT,
      "t",
      "report x = 1",
    );
    const md =
      fence("r", "param p in [1, 2] lattice 1 = default 1") +
      "\n<!--vmark:report #r\nreport gates\nreport = 5\nassert p < 3\n-->\n";
    one(md, "SHEET", REPORT_COMMENT_NOT_REPORT, "r", "report = 5");
    expect(build(locate(md)).sheets.get("r")!.reports).toEqual([]);
  });

  test("no sheet id", () => {
    for (const c of [
      "<!--vmark:report-->",
      "<!--vmark:report#x report gates-->",
      "<!--vmark:report # x report gates-->",
      "<!--vmark:report\n#x\nreport gates\n-->",
    ]) {
      one(c + "\n", "SHEET", REPORT_COMMENT_NO_ID, undefined, c);
      expect(build(locate(c + "\n")).sheets.size).toBe(0);
    }
  });

  test("unclosed", () => {
    const md = "<!--vmark:report #x report gates\n";
    one(md, "SHEET", REPORT_COMMENT_UNCLOSED, undefined, md.trimEnd());
  });

  test("trailing text", () => {
    for (const c of [
      "<!--vmark:report #r report gates--> trailing",
      "<!--vmark:report #a report gates--><!--vmark:report #b report gates-->",
      "<!--vmark:report #r report gates # see --> here-->",
    ]) {
      one(c + "\n", "SHEET", REPORT_COMMENT_TRAILING, undefined, c);
      expect(build(locate(c + "\n")).sheets.size).toBe(0);
    }
  });

  test("below the top level", () => {
    for (const [md, at] of [
      ["> <!--vmark:report #x report gates-->\n", "<!--vmark:report #x report gates-->"],
      ["- <!--vmark:report #x report gates-->\n", "<!--vmark:report #x report gates-->"],
      ["text <!--vmark:report #x report gates--> more\n", "<!--vmark:report #x report gates-->"],
    ] as const) {
      one(md, "SHEET", REPORT_COMMENT_NESTED, undefined, at);
      expect(build(locate(md)).sheets.size).toBe(0);
    }
    one(
      "> <!--vmark:no-formulas-->\n",
      "ANCHOR",
      COLON_NESTED,
      undefined,
      "<!--vmark:no-formulas-->",
    );
  });

  test("an unknown word, and a malformed marker", () => {
    one(
      "<!--vmark:reports #x report gates-->\n",
      "ANCHOR",
      unknownColonWord("reports"),
      undefined,
      "<!--vmark:reports #x report gates-->",
    );
    one(
      "<!--vmark:Report #x-->\n",
      "ANCHOR",
      unknownColonWord("Report"),
      undefined,
      "<!--vmark:Report #x-->",
    );
    one("<!--vmark:-->\n", "ANCHOR", unknownColonWord(""), undefined, "<!--vmark:-->");
    one(
      "<!--vmark:no-formulas extra-->\n",
      "ANCHOR",
      MALFORMED_MARKER,
      undefined,
      "<!--vmark:no-formulas extra-->",
    );
  });

  test("the messages are the spec's", () => {
    expect(unknownColonWord("reports")).toBe(
      "unknown `vmark:` comment `reports` — expected `<!--vmark:no-formulas-->` or `<!--vmark:report #id …-->`",
    );
    expect(unknownColonWord("")).toBe(
      "a `vmark:` comment names no word — expected `<!--vmark:no-formulas-->` or `<!--vmark:report #id …-->`",
    );
    expect(MALFORMED_MARKER).toBe(
      "malformed `no-formulas` marker — expected `<!--vmark:no-formulas-->`",
    );
    expect(REPORT_COMMENT_UNCLOSED).toBe("a report comment is not closed with `-->`");
  });
});
