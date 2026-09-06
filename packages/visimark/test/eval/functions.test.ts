import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { formatCheck } from "../../src/report/format.js";
import { callProblem, FUNCTIONS, isReduce } from "../../src/eval/functions.js";
import type { Finding } from "../../src/model/types.js";

const run = (src: string) => check(build(locate(src)));

/** a two-row table whose `Km` column is governed by `rule` */
const withColumnRule = (rule: string) => `
| Leg | Price | Qty |   Km |
|-----|------:|----:|-----:|
| a   |  5.00 |  10 | 0.00 |
| b   |  1.00 |   4 | 0.00 |

\`\`\`vmark #legs
Km = ${rule}
\`\`\`
`;

const withScalar = (rule: string) => `
| Leg | Price | Qty |
|-----|------:|----:|
| a   |  5.00 |  10 |

\`\`\`vmark #legs
total = ${rule}
\`\`\`
`;

const typeFindings = (fs: Finding[]) => fs.filter((f) => f.code === "TYPE");

// ---- the table itself -------------------------------------------------

test("every builtin declares a kind and an arity", () => {
  expect([...FUNCTIONS.keys()].sort()).toEqual([
    "ABS",
    "AVG",
    "COUNT",
    "EOMONTH",
    "IF",
    "MAX",
    "MIN",
    "MOD",
    "ROUND",
    "SQRT",
    "SUM",
  ]);
  for (const [name, spec] of FUNCTIONS) {
    expect(spec.kind === "map" || spec.kind === "reduce").toBe(true);
    expect(Number.isInteger(spec.arity)).toBe(true);
    expect(spec.arity).toBeGreaterThan(0);
    expect(name).toBe(name.toUpperCase());
  }
});

test("the five reduces are exactly the aggregates", () => {
  const reduces = [...FUNCTIONS]
    .filter(([, s]) => s.kind === "reduce")
    .map(([n]) => n)
    .sort();
  expect(reduces).toEqual(["AVG", "COUNT", "MAX", "MIN", "SUM"]);
  expect(isReduce("SUM")).toBe(true);
  expect(isReduce("ROUND")).toBe(false);
  expect(isReduce("NOPE")).toBe(false);
});

test("every reduce takes exactly one argument", () => {
  for (const [, spec] of FUNCTIONS) {
    if (spec.kind === "reduce") expect(spec.arity).toBe(1);
  }
});

// ---- arity is checked statically, and never crashes --------------------

test("too few arguments is a TYPE finding, not a crash", () => {
  const r = run(withColumnRule("ROUND(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("ROUND() takes 2 arguments, got 1");
  expect(r.exitCode).toBe(1);
});

test("a bad call in a column rule is reported once, not once per row", () => {
  const r = run(withColumnRule("IF(Qty > 5, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("IF() takes 3 arguments, got 2");
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("too many arguments is a TYPE finding", () => {
  const r = run(withColumnRule("ABS(Qty, 2)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("ABS() takes 1 argument, got 2");
});

test("a bad call blames the call's own span", () => {
  const src = withColumnRule("ROUND(Qty)");
  const r = run(src);
  const f = typeFindings(r.findings)[0]!;
  expect(src.slice(f.span!.start, f.span!.end)).toBe("ROUND(Qty)");
});

test("a stale value is not also reported for an uncomputable column", () => {
  const r = run(withColumnRule("ROUND(Qty)"));
  expect(r.findings.filter((f) => f.code === "STALE")).toEqual([]);
});

// ---- unknown functions -------------------------------------------------

test("an unknown function is a TYPE finding with a did-you-mean", () => {
  const r = run(withColumnRule("ROND(Qty, 2)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `ROND`");
  expect(ts[0]!.suggestion).toBe("ROUND");
});

test("an unknown function with no near neighbour carries no suggestion", () => {
  const r = run(withColumnRule("XYZZY(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.suggestion).toBeUndefined();
});

// ---- the shape rule ----------------------------------------------------

test("a reduce takes a column reference, never an expression", () => {
  const r = run(withScalar("SUM(Price * Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("SUM() takes a column reference, not an expression");
});

test("a reduce over a column is legal, and a map may consume its result", () => {
  const src = `
| Leg |    Net | Share |
|-----|-------:|------:|
| a   |  50.00 |  0.25 |
| b   | 150.00 |  0.75 |

\`\`\`vmark #legs
Share = Net / SUM(Net)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("nested calls are checked too", () => {
  const r = run(withColumnRule("ABS(ROUND(Qty))"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("ROUND() takes 2 arguments, got 1");
});

test("well-formed calls still evaluate", () => {
  const r = run(withColumnRule("ROUND(Price * Qty, 2)"));
  expect(typeFindings(r.findings)).toEqual([]);
  expect(r.findings.filter((f) => f.code === "STALE")).toHaveLength(2);
});

test("the report offers a did-you-mean for a misspelled function", () => {
  const src = withColumnRule("ROND(Qty, 2)");
  const out = formatCheck("x.md", run(src).findings);
  expect(out).toContain("unknown function `ROND`");
  expect(out).toContain("did you mean `ROUND`?");
});

// ---- EOMONTH ----------------------------------------------------------

test("EOMONTH is a map of arity 2", () => {
  expect(FUNCTIONS.get("EOMONTH")).toEqual({ kind: "map", arity: 2 });
  expect(isReduce("EOMONTH")).toBe(false);
  expect(callProblem("EOMONTH", [{ type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 1,
  });
  expect(callProblem("EOMONTH", [{ type: "ref" }, { type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
  expect(callProblem("EOMONTH", [{ type: "ref" }, { type: "num" }])).toBeNull();
});

test("EOMONTH(issued, 2) evaluates and anchors a due date", () => {
  const src = `
issued falls on 2026-01-15, so payment is due **2026-03-31**<!--vmark=terms.due-->.

\`\`\`vmark #terms
issued = 2026-01-15
due    = EOMONTH(issued, 2)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("EOMONTH misspelled gets a did-you-mean", () => {
  const r = run(withScalar("EOMONT(Price, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `EOMONT`");
  expect(ts[0]!.suggestion).toBe("EOMONTH");
});

// ---- SQRT -----------------------------------------------------------

test("SQRT is a map of arity 1", () => {
  expect(FUNCTIONS.get("SQRT")).toEqual({ kind: "map", arity: 1 });
  expect(isReduce("SQRT")).toBe(false);
  expect(callProblem("SQRT", [{ type: "num" }])).toBeNull();
  expect(callProblem("SQRT", [])).toEqual({ kind: "arity", expected: 1, got: 0 });
  expect(callProblem("SQRT", [{ type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 1,
    got: 2,
  });
});

test("SQRT computes the non-negative root (anchor-verified)", () => {
  const src = `
Roots: **3.00**<!--vmark=r.a-->, **0.00**<!--vmark=r.b-->, **0.50**<!--vmark=r.c-->,
**1.41**<!--vmark=r.d-->.

\`\`\`vmark #r
a = SQRT(9)
b = SQRT(0)
c = SQRT(0.25)
d = SQRT(2)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("SQRT of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('SQRT("x")')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("SQRT expects a number");
});

test("SQRT of a negative literal is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("SQRT(-1)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("SQRT of a negative number");
});

test("SQRT misspelled gets a did-you-mean", () => {
  const r = run(withScalar("SQR(Price)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `SQR`");
  expect(ts[0]!.suggestion).toBe("SQRT");
});
