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

// docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §4.1
describe("param domain findings", () => {
  test("default outside a range is DOMAIN, and dependants are suppressed", () => {
    const { result } = run(
      fence(
        "s",
        "param extra_hours precision 0 integer in [0, 80] = default 100\nnet = extra_hours * 2\nassert net > 0",
      ),
    );
    const f = result.findings.find((x) => x.code === "DOMAIN")!;
    expect(f.message).toBe(
      "default 100 is not in the domain of extra_hours: integer in [0, 80]",
    );
    expect(result.values.has("s.net")).toBe(false);
    expect(result.assertions[0]?.holds).toBeNull();
  });

  test("default outside a finite set is DOMAIN", () => {
    const { result } = run(
      fence("s", "param prepay_share precision 2 in { 30%, 40% } = default 35%"),
    );
    const f = result.findings.find((x) => x.code === "DOMAIN")!;
    expect(f.message).toBe(
      "default 35% is not in the domain of prepay_share: in { 30%, 40% }",
    );
  });

  test("a reversed range is an empty-domain DOMAIN", () => {
    const { result } = run(fence("s", "param x precision 0 in [10, 0] = default 5"));
    expect(codes(result.findings)).toEqual(["DOMAIN s.x"]);
    expect(result.findings[0]!.message).toBe(
      "param x declares an empty domain: in [10, 0] has no legal value",
    );
  });

  test("an empty set literal is an empty-domain DOMAIN", () => {
    const { result } = run(fence("s", "param x precision 0 in { } = default 0"));
    expect(result.findings[0]!.message).toBe(
      "param x declares an empty domain: in { } has no legal value",
    );
  });

  test("integer preset intersected with a fractional range is an empty-domain DOMAIN", () => {
    const { result } = run(
      fence("s", "param x precision 1 integer in [0.2, 0.8] = default 0.5"),
    );
    expect(result.findings[0]!.code).toBe("DOMAIN");
  });

  test("a domain literal wider than the declared precision is PRECISION", () => {
    const { result } = run(
      fence("s", "param x precision 2 in { 30%, 33.33% } = default 30%"),
    );
    expect(codes(result.findings)).toEqual(["PRECISION s.x"]);
    expect(result.findings[0]!.message).toBe(
      "domain value 33.33% has 4 decimals; param x declares 2",
    );
  });

  test("a domain literal percent-mismatched with the param is TYPE", () => {
    const { result } = run(fence("s", "param x precision 2 in { 30%, 40 } = default 30%"));
    expect(codes(result.findings)).toEqual(["TYPE s.x"]);
    expect(result.findings[0]!.message).toBe("x is a percent; domain value 40 must be too");
  });

  test("an in-domain default with no other findings passes", () => {
    const { result } = run(
      fence("s", "param extra_hours precision 0 integer in [0, 80] = default 40"),
    );
    expect(codes(result.findings)).toEqual(["WARN s.extra_hours"]);
  });
});
