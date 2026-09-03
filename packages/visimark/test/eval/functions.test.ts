import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { formatCheck } from "../../src/report/format.js";
import { FUNCTIONS, isReduce } from "../../src/eval/functions.js";
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
    "IF",
    "MAX",
    "MIN",
    "MOD",
    "ROUND",
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
