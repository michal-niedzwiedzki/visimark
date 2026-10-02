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

describe("report options (add-a-simulate-command-spec.md §4)", () => {
  const names = (o: { on?: { qualifier?: string; name: string }[] }) =>
    (o.on ?? []).map((r) => (r.qualifier ? `${r.qualifier}.${r.name}` : r.name));
  test("ledger", () => {
    expect(report("report ledger").options).toEqual({ kind: "ledger", assertionsBroken: false });
    expect(report("report ledger assertions broken").options).toEqual({
      kind: "ledger",
      assertionsBroken: true,
    });
  });
  test("deltas", () => {
    const bare = report("report deltas").options;
    expect(bare.kind === "deltas" && bare.on).toEqual([]);
    const on = report("report deltas on a, s.b").options;
    expect(on.kind).toBe("deltas");
    if (on.kind === "deltas") expect(names(on)).toEqual(["a", "s.b"]);
  });
  test("deltas shares its Ref objects with refs", () => {
    const r = report("report deltas on a, b");
    expect(r.options.kind === "deltas" && r.options.on[1]).toBe(r.refs[1]!);
  });
  test("gates and forbidden", () => {
    expect(report("report gates").options).toEqual({ kind: "gates" });
    expect(report("report forbidden").options).toEqual({ kind: "forbidden" });
  });
  test("best", () => {
    const max = report("report best scalar s.m direction max").options;
    expect(max.kind === "best" && [max.scalar.name, max.direction, max.amongFeasible]).toEqual([
      "m",
      "max",
      false,
    ]);
    const min = report("report best scalar m direction min among feasible").options;
    expect(min.kind === "best" && [min.scalar.name, min.direction, min.amongFeasible]).toEqual([
      "m",
      "min",
      true,
    ]);
  });
  test("malformed options keep #258's messages", () => {
    expect(fails("report best scalar m").message).toBe(
      "`report best` takes: scalar REF direction max|min [among feasible]",
    );
    expect(fails("report gates now").message).toBe("`report gates` takes no options");
  });
});
