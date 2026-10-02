import { describe, expect, test } from "bun:test";
import { parseStatement } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §2.2 and §4.2

function report(line: string) {
  const s = parseStatement(line);
  if (!("type" in s) || s.type !== "report") throw new Error(`not a report: ${line}`);
  return s;
}

function fails(line: string): LangError {
  try {
    parseStatement(line);
  } catch (e) {
    if (e instanceof LangError) return e;
    throw e;
  }
  throw new Error(`parsed: ${line}`);
}

describe("report statement", () => {
  test("the five shipped forms", () => {
    expect(report("report ledger assertions broken").text).toBe("report ledger assertions broken");
    expect(report("report ledger").text).toBe("report ledger");
    expect(report("report gates").refs).toEqual([]);
    expect(report("report forbidden").text).toBe("report forbidden");
    const d = report("report deltas on lines.signature,   lines.margin");
    expect(d.text).toBe("report deltas on lines.signature, lines.margin");
    expect(d.refs.map((r) => [r.qualifier, r.name])).toEqual([
      ["lines", "signature"],
      ["lines", "margin"],
    ]);
    expect(report("report deltas").refs).toEqual([]);
    const b = report("report best scalar lines.margin direction max among feasible");
    expect(b.text).toBe("report best scalar lines.margin direction max among feasible");
    expect(b.refs).toHaveLength(1);
    expect(report("report best scalar margin direction min").text).toBe(
      "report best scalar margin direction min",
    );
  });

  test("a ref carries its span within the line", () => {
    const d = report("report deltas on lines.signature");
    expect(d.refs[0]).toMatchObject({ start: 17, end: 32 });
  });

  test("report is contextual: a scalar called report still binds", () => {
    for (const line of ["report = 5", "report precision 2 = 5"]) {
      const s = parseStatement(line);
      expect("type" in s).toBe(false);
      expect((s as { name: string }).name).toBe("report");
    }
  });

  test("no name", () => {
    expect(fails("report").message).toBe("a report needs a name");
  });

  test("an unknown name lists the shipped ones", () => {
    expect(fails("report foo").message).toBe(
      "unknown report `foo`; the reports are ledger, deltas, gates, best, forbidden",
    );
  });

  test("options that do not match the grammar", () => {
    expect(fails("report ledger assertions").message).toBe(
      "`report ledger` takes: [assertions broken]",
    );
    expect(fails("report ledger extra").message).toBe("`report ledger` takes: [assertions broken]");
    expect(fails("report deltas lines.margin").message).toBe(
      "`report deltas` takes: [on REF {, REF}]",
    );
    expect(fails("report deltas on").message).toBe("`report deltas` takes: [on REF {, REF}]");
    expect(fails("report gates extra").message).toBe("`report gates` takes no options");
    expect(fails("report forbidden x").message).toBe("`report forbidden` takes no options");
    for (const bad of [
      "report best",
      "report best scalar",
      "report best scalar m",
      "report best scalar m direction up",
      "report best scalar m direction max among",
      "report best scalar m direction max among feasible extra",
    ]) {
      expect(fails(bad).message).toBe(
        "`report best` takes: scalar REF direction max|min [among feasible]",
      );
    }
  });

  test("a report failure names no binding", () => {
    expect(fails("report foo").bindingName).toBeUndefined();
  });
});
