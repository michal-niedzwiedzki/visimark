import { describe, expect, test } from "bun:test";
import { parseColonComment } from "../../src/parse/colon-comment.js";
import { locate } from "../../src/parse/document.js";

// docs/design/declare-a-sheet-s-report-statements-spec.md §2, §3.2, §4.1

const problemOf = (value: string, topLevel = true): string | undefined => {
  const r = parseColonComment(value, 0, topLevel);
  return r?.kind === "problem" ? r.problem : r?.kind;
};

describe("parseColonComment", () => {
  test("an ordinary or anchor comment is not a colon comment", () => {
    expect(parseColonComment("<!-- note -->", 0, true)).toBeNull();
    expect(parseColonComment("<!--vmark=s.x-->", 0, true)).toBeNull();
    expect(parseColonComment("<!--VMARK:report #x report gates-->", 0, true)).toBeNull();
  });

  test("the marker, exact or malformed", () => {
    expect(problemOf("<!--vmark:no-formulas-->")).toBe("marker");
    expect(problemOf("<!-- vmark : no-formulas -->")).toBe("marker");
    expect(problemOf("<!--vmark:no-formulas extra-->")).toBe("malformed-marker");
    expect(problemOf("<!--vmark:no-formulas--> trailing")).toBe("malformed-marker");
  });

  test("an unknown word, including the empty word, comes first", () => {
    for (const [v, word] of [
      ["<!--vmark:reports #x report gates-->", "reports"],
      ["<!--vmark:reporting-->", "reporting"],
      ["<!--vmark:Report #x report gates-->", "Report"],
      ["<!--vmark:-->", ""],
      ["<!--vmark: #x-->", ""],
    ] as const) {
      const r = parseColonComment(v, 0, false);
      expect(r).toEqual({ kind: "problem", problem: "unknown-word", word });
    }
  });

  test("below the top level", () => {
    expect(problemOf("<!--vmark:report #x report gates-->", false)).toBe("nested");
    expect(problemOf("<!--vmark:no-formulas-->", false)).toBe("nested");
  });

  test("unclosed, then trailing, then no id", () => {
    expect(problemOf("<!--vmark:report #x report gates\nmore")).toBe("unclosed");
    expect(problemOf("<!--vmark:report #r report gates--> trailing")).toBe("trailing");
    expect(
      problemOf("<!--vmark:report #a report gates--><!--vmark:report #b report gates-->"),
    ).toBe("trailing");
    expect(problemOf("<!--vmark:report #r report gates # see --> here-->")).toBe("trailing");
    expect(problemOf("<!--vmark:report-->")).toBe("no-id");
    expect(problemOf("<!--vmark:report#x report gates-->")).toBe("no-id");
    expect(problemOf("<!--vmark:report # x report gates-->")).toBe("no-id");
    expect(problemOf("<!--vmark:report\n#x\nreport gates\n-->")).toBe("no-id");
    expect(problemOf("<!--vmark:report gates-->")).toBe("no-id");
  });

  test("the id and the body", () => {
    expect(parseColonComment("<!--vmark:report #x-->", 10, true)).toEqual({
      kind: "report",
      sheetId: "x",
      body: "",
      bodyStart: 10 + "<!--vmark:report #x".length,
    });
    const v = "<!-- vmark : report\t#readings report gates\nreport forbidden\n-->";
    const r = parseColonComment(v, 0, true);
    expect(r).toMatchObject({ kind: "report", sheetId: "readings" });
    if (r?.kind !== "report") throw new Error("unreachable");
    expect(v.slice(r.bodyStart, r.bodyStart + r.body.length)).toBe(r.body);
    expect(r.body).toBe(" report gates\nreport forbidden\n");
    expect(parseColonComment("<!--vmark:report #a/b report gates-->", 0, true)).toMatchObject({
      sheetId: "a/b",
    });
  });
});

describe("locate", () => {
  test("report comments are collected with spans that slice back to each line", () => {
    const md =
      "intro\n\n<!--vmark:report #readings\nreport gates\n\n# a note\nreport forbidden # why\n-->\n\n" +
      "<!--vmark:report #ledger report ledger assertions broken-->\n";
    const d = locate(md);
    expect(d.malformedColonComments).toEqual([]);
    expect(d.reportComments.map((c) => c.sheetId)).toEqual(["readings", "ledger"]);
    const lines = d.reportComments.flatMap((c) => c.bindings.map((b) => md.slice(b.start, b.end)));
    expect(lines).toEqual(["report gates", "report forbidden", "report ledger assertions broken"]);
    const c = d.reportComments[1]!;
    expect(md.slice(c.span.start, c.span.end)).toBe(
      "<!--vmark:report #ledger report ledger assertions broken-->",
    );
  });

  test("nested colon comments are problems, not report comments or markers", () => {
    const md =
      "> <!--vmark:report #x report gates-->\n\n- <!--vmark:report #y report gates-->\n\n" +
      "text <!--vmark:report #z report gates--> more\n\n> <!--vmark:no-formulas-->\n";
    const d = locate(md);
    expect(d.reportComments).toEqual([]);
    expect(d.noFormulas).toBeNull();
    expect(d.malformedColonComments.map((m) => [m.problem, m.word])).toEqual([
      ["nested", "report"],
      ["nested", "report"],
      ["nested", "report"],
      ["nested", "no-formulas"],
    ]);
    const m = d.malformedColonComments[2]!;
    expect(md.slice(m.span.start, m.span.end)).toBe("<!--vmark:report #z report gates-->");
  });

  test("a comment inside a fenced example is inert", () => {
    const d = locate("````markdown\n<!--vmark:report #x-->\n<!--vmark:bogus-->\n````\n");
    expect(d.reportComments).toEqual([]);
    expect(d.malformedColonComments).toEqual([]);
  });

  test("a fence's table lookup skips report comments, well-formed or not", () => {
    const T = "| A | B |\n|--:|--:|\n| 1 | 2.00 |\n";
    const F = "```vmark #t\nB = A * 2\n```\n";
    for (const between of [
      "\n<!--vmark:report #t report gates-->\n\n",
      "<!--vmark:report #t-->\n",
      "\n<!--vmark:report #t report gates-->\n\n<!--vmark:report-->\n\n",
      "\n<!--vmark:report #t report gates--> trailing\n\n",
    ]) {
      const d = locate(T + between + F);
      expect(d.tableBeforeBlock.get(d.blocks[0]!)).toBe(d.tables[0]!);
      expect(d.detachedTableBlocks.size).toBe(0);
    }
    for (const between of [
      "\n<!-- note -->\n\n",
      "\n<!--vmark:no-formulas-->\n\n",
      "\n<!--vmark:bogus-->\n\n",
    ]) {
      const d = locate(T + between + F);
      expect(d.tableBeforeBlock.get(d.blocks[0]!)).toBeNull();
      expect(d.detachedTableBlocks.size).toBe(1);
    }
  });

  test("the first top-level marker still wins", () => {
    const md = "| a |\n|---|\n| 1 |\n\n<!--vmark:no-formulas-->\n\n<!--vmark:no-formulas-->\n";
    const d = locate(md);
    expect(d.noFormulas).toEqual({ start: md.indexOf("<!--"), end: md.indexOf("-->") + 3 });
    expect(d.malformedColonComments).toEqual([]);
  });
});
