import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import type { Finding } from "../../src/model/types.js";
import { locate } from "../../src/parse/document.js";

// docs/design/scenario-params-spec.md §3.1 and §4.1

const fence = (id: string | null, body: string): string =>
  "```vmark" + (id ? ` #${id}` : "") + "\n" + body + "\n```\n";

function run(md: string) {
  const model = build(locate(md));
  return { model, result: check(model) };
}

const codes = (fs: Finding[]) => fs.map((f) => `${f.code} ${f.sheetId ?? ""}.${f.name ?? ""}`);

describe("a param on the defaults", () => {
  test("evaluates as the constant binding it declares", () => {
    const { result } = run(
      fence("s", "param tax precision 3 = default 12.5%\nnet precision 2 = 1000 * (1 + tax)\n") +
        "\nNet **1125.00**<!--vmark=s.net-->.\n",
    );
    expect(result.findings.filter((f) => f.code !== "WARN")).toEqual([]);
    expect(result.values.get("s.tax")?.t).toBe("num");
    expect(String((result.values.get("s.tax") as { d: unknown }).d)).toBe("0.125");
    expect(String((result.values.get("s.net") as { d: unknown }).d)).toBe("1125");
  });

  test("an anchor on a param is judged against the default", () => {
    const { result } = run(
      fence("s", "param tax precision 3 = default 19%") + "\nTax 0.19<!--vmark=s.tax-->.\n",
    );
    expect(result.findings.filter((f) => f.code === "STALE")).toEqual([]);
  });

  test("at document scope", () => {
    const { model, result } = run(
      fence(null, "param rate precision 2 = default 5.25\nx precision 2 = rate * 2"),
    );
    expect(model.docScope.get("rate")?.param?.text).toBe("5.25");
    expect(String((result.values.get("x") as { d: unknown }).d)).toBe("10.5");
  });

  test("a param nothing reads is the unreferenced-scalar WARN", () => {
    const { result } = run(fence("s", "param tax precision 3 = default 19%"));
    expect(codes(result.findings)).toEqual(["WARN s.tax"]);
  });
});

describe("findings", () => {
  test("no precision clause is PRECISION, and dependants are suppressed", () => {
    const { result } = run(
      fence("s", "param tax = default 19%\nnet precision 2 = 100 * tax\nassert net > 0"),
    );
    const f = result.findings.find((x) => x.code === "PRECISION")!;
    expect(f.name).toBe("tax");
    expect(f.message).toBe("param tax declares no width");
    expect(f.suggestion).toBe("param tax precision N = default …");
    expect(result.values.has("s.net")).toBe(false);
    expect(result.assertions[0]?.holds).toBeNull();
  });

  test("a default wider than its precision is PRECISION", () => {
    const { result } = run(fence("s", "param tax precision 2 = default 12.5%\nx = tax"));
    const f = result.findings.find((x) => x.code === "PRECISION")!;
    expect(f.message).toBe("default 12.5% has 3 decimals; param tax declares 2");
  });

  test("trailing zeros are not significant", () => {
    const { result } = run(fence("s", "param b precision 0 = default 2.00\nx = b"));
    expect(result.findings.filter((f) => f.code === "PRECISION")).toEqual([]);
  });

  test("a missing default keyword, a quoted name and a non-literal are TYPE", () => {
    const { result } = run(
      fence(
        "s",
        'param a precision 1 = 5\nparam "Q" precision 1 = default 2\nparam c precision 1 = default 2 * 3',
      ),
    );
    expect(codes(result.findings)).toEqual(["TYPE s.a", "TYPE s.Q", "TYPE s.c"]);
  });

  test("a param bound twice is DUP", () => {
    const { result } = run(
      fence("s", "param a precision 1 = default 1\nparam a precision 1 = default 2\nx = a"),
    );
    expect(codes(result.findings)).toEqual(["DUP s.a", "WARN s.x"]);
  });

  const table = "| Item | Price |\n|------|------:|\n| a    | 10    |\n";

  test("a param named like a header of its table is DUP, and the column is kept", () => {
    const { model, result } = run(table + "\n" + fence("s", "param Price precision 0 = default 1"));
    expect(codes(result.findings)).toContain("DUP s.Price");
    expect(model.sheets.get("s")!.inputColumns.has("Price")).toBe(true);
    expect(model.sheets.get("s")!.scalars.has("Price")).toBe(false);
  });

  test("the same DUP when the param is in a block before the table", () => {
    const md =
      fence("s", "param Price precision 0 = default 1") +
      "\n" +
      table +
      "\n" +
      fence("s", "Total = Price");
    const { model, result } = run(md);
    expect(codes(result.findings)).toContain("DUP s.Price");
    expect(model.sheets.get("s")!.scalars.has("Price")).toBe(false);
  });
});
