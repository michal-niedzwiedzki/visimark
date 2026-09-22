import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { formatCheck } from "../../src/report/format.js";
import { callProblem, FUNCTION_TABLE, FUNCTIONS, isReduce } from "../../src/eval/functions.js";
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
    "CEILING",
    "COUNT",
    "EOMONTH",
    "FLOOR",
    "IF",
    "MAX",
    "MIN",
    "MOD",
    "NPV",
    "PMT",
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

test("the reduces are exactly the aggregates", () => {
  const reduces = [...FUNCTIONS]
    .filter(([, s]) => s.kind === "reduce")
    .map(([n]) => n)
    .sort();
  expect(reduces).toEqual(["AVG", "COUNT", "MAX", "MIN", "NPV", "SUM"]);
  expect(isReduce("SUM")).toBe(true);
  expect(isReduce("ROUND")).toBe(false);
  expect(isReduce("NOPE")).toBe(false);
});

test("every reduce has one column parameter", () => {
  for (const [name, spec] of FUNCTIONS) {
    if (spec.kind !== "reduce") continue;
    expect(spec.arity).toBe(name === "NPV" ? 2 : 1);
    expect(spec.column).toBe(name === "NPV" ? 1 : 0);
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
Share precision 2 = Net / SUM(Net)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

// ---- Σ / ∑ alias for SUM (#43) ------------------------------------------

test("Σ(Net) and ∑(Net) evaluate identically to SUM(Net)", () => {
  const src = `
| Leg |    Net |
|-----|-------:|
| a   |  50.00 |
| b   | 150.00 |

\`\`\`vmark #legs
total = SUM(Net)
\`\`\`
`;
  const withAlias = (glyph: string) => src.replace("SUM(Net)", `${glyph}(Net)`);
  // Spans differ by construction — Σ/∑ is one character, `SUM` is three — so
  // compare everything except span/sourceOffset, which the semantics table
  // (spec §3) says point at exactly what the author wrote, not at `SUM`.
  const withoutSpan = (fs: Finding[]) =>
    fs.map(({ span: _span, sourceOffset: _sourceOffset, ...rest }) => rest);
  expect(withoutSpan(run(withAlias("Σ")).findings)).toEqual(withoutSpan(run(src).findings));
  expect(withoutSpan(run(withAlias("∑")).findings)).toEqual(withoutSpan(run(src).findings));
});

test("Σ(Price * Qty) is refused exactly like SUM(Price * Qty)", () => {
  const r = run(withScalar("Σ(Price * Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("SUM() takes a column reference, not an expression");
});

test("Σ() and Σ(a, b) fail arity exactly like SUM", () => {
  const noArgs = typeFindings(run(withScalar("Σ()")).findings);
  expect(noArgs[0]!.message).toBe("SUM() takes 1 argument, got 0");
  const twoArgs = typeFindings(run(withScalar("Σ(Price, Qty)")).findings);
  expect(twoArgs[0]!.message).toBe("SUM() takes 1 argument, got 2");
});

test("share = Net / Σ(Net) composes exactly like SUM", () => {
  const src = `
| Leg |    Net | Share |
|-----|-------:|------:|
| a   |  50.00 |  0.25 |
| b   | 150.00 |  0.75 |

\`\`\`vmark #legs
Share precision 2 = Net / Σ(Net)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("Σ(schedule.Amount) is legal, exactly like SUM(schedule.Amount)", () => {
  const src = `
| Leg |    Net |
|-----|-------:|
| a   |  50.00 |

\`\`\`vmark #lines
total = Σ(schedule.Amount)
\`\`\`

| Item |  Amount |
|------|--------:|
| x    |   50.00 |

\`\`\`vmark #schedule
\`\`\`
`;
  const ts = typeFindings(run(src).findings);
  expect(ts).toEqual([]);
});

test("an unresolvable name near SUM never suggests Σ or ∑", () => {
  const r = run(withColumnRule("SUMM(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.suggestion).toBe("SUM");
  expect([...FUNCTIONS.keys()]).not.toContain("Σ");
  expect([...FUNCTIONS.keys()]).not.toContain("∑");
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
a precision 2 = SQRT(9)
b precision 2 = SQRT(0)
c precision 2 = SQRT(0.25)
d precision 2 = SQRT(2)
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

// ---- finite numeric values ------------------------------------------

test("0 ^ -1 is a TYPE error, not Infinity", () => {
  const fs = typeFindings(run(withScalar("0 ^ -1")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("result is not a finite decimal");
});

test("(-2) ^ 0.5 is a TYPE error, not NaN", () => {
  const fs = typeFindings(run(withScalar("(-2) ^ 0.5")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("result is not a finite decimal");
});

test("x / 0 is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("100 / 0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("0 / 0 is TYPE division by zero, not NaN", () => {
  const fs = typeFindings(run(withScalar("0 / 0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("1 / -0 is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("1 / -0")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("a tiny non-zero divisor still divides", () => {
  const src = `
n is **10000.00**<!--vmark=s.n-->.

\`\`\`vmark #s
n precision 2 = 1 / 0.0001
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("MOD(x, 0) is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("MOD(5, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("MOD(x, -0) is TYPE division by zero", () => {
  const fs = typeFindings(run(withScalar("MOD(5, -0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("division by zero");
});

test("ordinary MOD is unchanged", () => {
  const src = `
n is **1**<!--vmark=s.n-->.

\`\`\`vmark #s
n = MOD(7, 3)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

// ---- FLOOR ----------------------------------------------------------

test("FLOOR is a map of arity 2", () => {
  expect(FUNCTIONS.get("FLOOR")).toEqual({ kind: "map", arity: 2 });
  expect(isReduce("FLOOR")).toBe(false);
  expect(callProblem("FLOOR", [{ type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("FLOOR", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("FLOOR", [{ type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 1,
  });
  expect(callProblem("FLOOR", [{ type: "num" }, { type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
});

test("FLOOR computes toward negative infinity (anchor-verified)", () => {
  const src = `
Floors: **15**<!--vmark=r.a-->, **-15**<!--vmark=r.b-->, **15**<!--vmark=r.c-->,
**0**<!--vmark=r.d-->, **2**<!--vmark=r.e-->, **-3**<!--vmark=r.f-->,
**1.2**<!--vmark=r.g-->, **0.3**<!--vmark=r.h-->, **48**<!--vmark=r.i-->,
**5**<!--vmark=r.j-->, **-1**<!--vmark=r.k-->.

\`\`\`vmark #r
a = FLOOR(17, 5)
b = FLOOR(-12, 5)
c = FLOOR(15, 5)
d = FLOOR(0, 5)
e = FLOOR(2.5, 1)
f = FLOOR(-2.5, 1)
g = FLOOR(1.23, 0.1)
h = FLOOR(0.3, 0.1)
i = FLOOR(12000 / 250, 1)
j = FLOOR(5.0001, 5)
k = FLOOR(-0.0001, 1)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("FLOOR of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('FLOOR("x", 1)')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR of a date is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(2026-01-01, 1)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR with a non-number significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('FLOOR(17, "x")')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR expects a number");
});

test("FLOOR with zero significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(17, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR significance must be a positive number");
});

test("FLOOR with negative significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("FLOOR(17, -5)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("FLOOR significance must be a positive number");
});

test("FLOOR with one argument is a TYPE arity error", () => {
  const r = run(withColumnRule("FLOOR(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("FLOOR() takes 2 arguments, got 1");
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("FLOOR misspelled gets a did-you-mean", () => {
  const r = run(withScalar("FLOR(Price, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `FLOR`");
  expect(ts[0]!.suggestion).toBe("FLOOR");
});

// ---- CEILING --------------------------------------------------------

test("CEILING is a map of arity 2", () => {
  expect(FUNCTIONS.get("CEILING")).toEqual({ kind: "map", arity: 2 });
  expect(isReduce("CEILING")).toBe(false);
  expect(callProblem("CEILING", [{ type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("CEILING", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("CEILING", [{ type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 1,
  });
  expect(callProblem("CEILING", [{ type: "num" }, { type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
});

test("CEILING computes toward positive infinity (anchor-verified)", () => {
  const src = `
Ceilings: **20**<!--vmark=r.a-->, **-10**<!--vmark=r.b-->, **15**<!--vmark=r.c-->,
**0**<!--vmark=r.d-->, **3**<!--vmark=r.e-->, **-2**<!--vmark=r.f-->,
**1.3**<!--vmark=r.g-->, **0.3**<!--vmark=r.h-->, **48**<!--vmark=r.i-->,
**39**<!--vmark=r.j-->, **10**<!--vmark=r.k-->, **0**<!--vmark=r.l-->,
**20**<!--vmark=r.m-->, **-10**<!--vmark=r.n-->.

\`\`\`vmark #r
a = CEILING(17, 5)
b = CEILING(-12, 5)
c = CEILING(15, 5)
d = CEILING(0, 5)
e = CEILING(2.5, 1)
f = CEILING(-2.5, 1)
g = CEILING(1.23, 0.1)
h = CEILING(0.3, 0.1)
i = CEILING(12000 / 250, 1)
j = CEILING(307 / 8, 1)
k = CEILING(5.0001, 5)
l = CEILING(-0.0001, 1)
m = -FLOOR(-17, 5)
n = -FLOOR(12, 5)
\`\`\`
`;
  expect(run(src).findings).toEqual([]);
});

test("CEILING of a non-number is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('CEILING("x", 1)')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING of a date is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(2026-01-01, 1)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING with a non-number significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar('CEILING(17, "x")')).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING expects a number");
});

test("CEILING with zero significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(17, 0)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING significance must be a positive number");
});

test("CEILING with negative significance is a TYPE error", () => {
  const fs = typeFindings(run(withScalar("CEILING(17, -5)")).findings);
  expect(fs).toHaveLength(1);
  expect(fs[0]!.message).toBe("CEILING significance must be a positive number");
});

test("CEILING with one argument is a TYPE arity error", () => {
  const r = run(withColumnRule("CEILING(Qty)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("CEILING() takes 2 arguments, got 1");
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("CEILING misspelled gets a did-you-mean", () => {
  const r = run(withScalar("CELING(Price, 1)"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("unknown function `CELING`");
  expect(ts[0]!.suggestion).toBe("CEILING");
});

test("the function table and the exported map agree", () => {
  const fromTable = Object.keys(FUNCTION_TABLE).sort();
  const fromMap = [...FUNCTIONS.keys()].sort();
  expect(fromMap).toEqual(fromTable);
  expect(fromTable).toHaveLength(15);
});

// ---- prose notation for unary vocabulary (#64) ------------------------------

// A finding's `formula` and `raw` echo the spelling the author wrote, like its
// span, so none of them takes part in the comparison with the named form.
const withoutSpelling = (fs: Finding[]) =>
  fs.map(
    ({ span: _span, sourceOffset: _sourceOffset, formula: _formula, raw: _raw, ...rest }) => rest,
  );

const PROSE: readonly (readonly [string, string])[] = [
  ["|Price - Qty|", "ABS(Price - Qty)"],
  ["||Price - Qty| - 1|", "ABS(ABS(Price - Qty) - 1)"],
  ["⌊Price⌋", "FLOOR(Price, 1)"],
  ["⌈Price⌉", "CEILING(Price, 1)"],
  ["⌊|Price - Qty| * 3⌋", "FLOOR(ABS(Price - Qty) * 3, 1)"],
  ["√(Qty)", "SQRT(Qty)"],
];

test("each prose spelling checks exactly like the call it stands for", () => {
  for (const [prose, named] of PROSE) {
    const found = run(withColumnRule(prose)).findings;
    expect(withoutSpelling(found)).toEqual(withoutSpelling(run(withColumnRule(named)).findings));
    // ...and the finding shows the author's own spelling, untouched
    const echoed = found.flatMap((f) => [f.formula, f.raw]).filter((x) => x !== undefined);
    expect(echoed.length).toBeGreaterThan(0);
    expect(echoed.every((x) => x === prose)).toBe(true);
  }
});

test("a column rule in prose notation is a row-wise map", () => {
  const r = run(withColumnRule("⌊Price⌋"));
  expect(typeFindings(r.findings)).toEqual([]);
  expect(r.findings.filter((f) => f.code === "STALE")).toHaveLength(2);
});

test("function-level failures keep the canonical name and span the whole call", () => {
  const abs = typeFindings(run(withScalar('|"s"|')).findings);
  expect(abs[0]!.message).toBe("ABS expects a number");
  expect(typeFindings(run(withScalar('⌊"s"⌋')).findings)[0]!.message).toBe(
    "FLOOR expects a number",
  );
  expect(typeFindings(run(withScalar("√(0 - 1)")).findings)[0]!.message).toBe(
    "SQRT of a negative number",
  );
});

test("SUM(|Net|) is refused exactly like SUM(ABS(Net))", () => {
  const prose = typeFindings(run(withScalar("SUM(|Qty|)")).findings);
  const named = typeFindings(run(withScalar("SUM(ABS(Qty))")).findings);
  expect(prose).toHaveLength(1);
  expect(withoutSpelling(prose)).toEqual(withoutSpelling(named));
});

test("a reduce inside a pair is a scalar", () => {
  expect(typeFindings(run(withScalar("|SUM(Qty)|")).findings)).toEqual([]);
});

test("√(x) must declare its width, as SQRT(x) must", () => {
  for (const rule of ["√(Qty)", "SQRT(Qty)"]) {
    expect(run(withColumnRule(rule)).findings.map((f) => f.code)).toContain("PRECISION");
  }
});

test("a prose spelling works inside an assert", () => {
  const withAssert = (a: string) => `
| Leg | Qty |
|-----|----:|
| a   |  10 |

\`\`\`vmark #legs
total = SUM(Qty)
assert ${a}
\`\`\`
`;
  const codes = (a: string) => run(withAssert(a)).findings.map((f) => f.code);
  expect(codes("|total - 12| <= 2")).not.toContain("ASSERT");
  expect(codes("|total - 12| <= 1")).toContain("ASSERT");
});

test("did-you-mean never suggests a prose spelling", () => {
  const ts = typeFindings(run(withColumnRule("ABSS(Qty)")).findings);
  expect(ts[0]!.suggestion).toBe("ABS");
  expect([...FUNCTIONS.keys()].filter((k) => /[|⌊⌋⌈⌉√]/.test(k))).toEqual([]);
});

// ---- PMT ------------------------------------------------------------

test("PMT is a map of arity 3", () => {
  expect(FUNCTIONS.get("PMT")).toEqual({ kind: "map", arity: 3 });
  expect(isReduce("PMT")).toBe(false);
  expect(callProblem("PMT", [{ type: "num" }, { type: "num" }, { type: "num" }])).toBeNull();
  expect(callProblem("PMT", [])).toEqual({ kind: "arity", expected: 3, got: 0 });
  expect(callProblem("PMT", [{ type: "num" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 3,
    got: 2,
  });
  expect(
    callProblem("PMT", [{ type: "num" }, { type: "num" }, { type: "num" }, { type: "num" }]),
  ).toEqual({ kind: "arity", expected: 3, got: 4 });
});

test("PMT exact cases and the two full working values", () => {
  const src = `
\`\`\`vmark #s
zero = PMT(0, 12, 1200)
one = PMT(0.10, 1, 1000)
none = PMT(0, 4, 0)
loan = PMT(0.01, 12, 10000)
press = PMT(0.005, 36, 48000)
neg = PMT(0.01, 12, -10000)
shown precision 2 = ROUND(loan, 2)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const str = (name: string) => {
    const v = r.values.get(`s.${name}`);
    if (!v || v.t !== "num") throw new Error(name);
    return v.d.toString();
  };
  expect(str("zero")).toBe("100");
  expect(str("one")).toBe("1100");
  expect(str("none")).toBe("0");
  expect(str("loan")).toBe("888.4878867834170733998783122788652898045");
  expect(str("press")).toBe("1460.252997674645676629785549680054151698");
  expect(str("neg")).toBe("-888.4878867834170733998783122788652898045");
  expect(str("shown")).toBe("888.49");
});

test("PMT rejects a non-number, a bad term, then a bad rate, in that order", () => {
  const msg = (rule: string) => typeFindings(run(withScalar(rule)).findings)[0]?.message;
  expect(msg('PMT("x", 12, 1)')).toBe("PMT expects a number");
  expect(msg('PMT(0.01, "x", 1)')).toBe("PMT expects a number");
  expect(msg("PMT(0.01, 12, 2026-01-01)")).toBe("PMT expects a number");
  expect(msg("PMT(0.01, 0, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(0.01, -12, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(0.01, 12.5, 1)")).toBe("PMT expects a positive whole number of periods");
  expect(msg("PMT(-1, 12, 1)")).toBe("PMT rate must be greater than -1");
  expect(msg("PMT(-1.5, 12, 1)")).toBe("PMT rate must be greater than -1");
  expect(msg("PMT(-1, 1.5, 1)")).toBe("PMT expects a positive whole number of periods");
});

// ---- NPV ------------------------------------------------------------

const cashDoc = (rule: string, rows: string) => `
| Cash |
|-----:|
${rows}
\`\`\`vmark #t
present = ${rule}
\`\`\`
`;

test("NPV is a reduce of arity 2 whose column is argument 1", () => {
  expect(FUNCTIONS.get("SUM")).toEqual({ kind: "reduce", arity: 1, column: 0 });
  expect(FUNCTIONS.get("NPV")).toEqual({ kind: "reduce", arity: 2, column: 1 });
  expect(isReduce("NPV")).toBe(true);
  expect(callProblem("NPV", [{ type: "num" }, { type: "ref" }])).toBeNull();
  expect(callProblem("NPV", [])).toEqual({ kind: "arity", expected: 2, got: 0 });
  expect(callProblem("NPV", [{ type: "num" }])).toEqual({ kind: "arity", expected: 2, got: 1 });
  expect(callProblem("NPV", [{ type: "num" }, { type: "ref" }, { type: "num" }])).toEqual({
    kind: "arity",
    expected: 2,
    got: 3,
  });
  expect(callProblem("NPV", [{ type: "num" }, { type: "binary" }])).toEqual({ kind: "shape" });
  expect(callProblem("NPV", [{ type: "ref" }, { type: "num" }])).toEqual({ kind: "shape" });
});

test("NPV exact cases and the motivating full working value", () => {
  const src = `
| Cash |
|-----:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #t
zero = NPV(0, Cash)
main = NPV(0.08, Cash)
pct = NPV(8%, Cash)
\`\`\`

| Small |
|------:|
| -1000 |
|   400 |
|   400 |
|   400 |

\`\`\`vmark #small
ten = NPV(0.10, Small)
\`\`\`

| Again |
|------:|
| -48000 |
|  20000 |
|  20000 |
|  20000 |

\`\`\`vmark #again
neg = NPV(-0.05, Again)
\`\`\`

| Only |
|-----:|
| -48000 |

\`\`\`vmark #one
single = NPV(0.08, Only)
\`\`\`

| Pair |
|-----:|
| 100 |
| 100 |

\`\`\`vmark #pair
neg = NPV(-0.5, Pair)
bare = NPV(0, Pair)
\`\`\`

| Tagged |
|-------:|
| 10 PLN |
| -10 PLN |

\`\`\`vmark #tag
units = NPV(0, Tagged)
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  const str = (id: string) => {
    const v = r.values.get(id);
    if (!v || v.t !== "num") throw new Error(id);
    return v.d.toString();
  };
  expect(str("t.zero")).toBe("12000");
  expect(str("t.main")).toBe("3541.9397449575776050398821317888533252");
  expect(str("t.pct")).toBe(str("t.main"));
  expect(str("small.ten")).toBe("-5.2592036063110443275732531930879038317");
  expect(str("again.neg")).toBe("18540.31199883364922000291587694999271031");
  expect(str("one.single")).toBe("-48000");
  expect(str("pair.neg")).toBe("300");
  expect(str("pair.bare")).toBe("200");
  expect(str("tag.units")).toBe("0");
});

test("NPV rejects a bad rate before an empty column, a blank, or a non-number", () => {
  const msg = (src: string) => typeFindings(run(src).findings)[0]?.message;
  const series = "| -48000 |\n|  20000 |\n|  20000 |\n|  20000 |";
  expect(msg(cashDoc('NPV("x", Cash)', series))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(-1, Cash)", series))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1.5, Cash)", series))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1, Cash)", "| -48000 |"))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(-1, Cash)", ""))).toBe("NPV rate must be greater than -1");
  expect(msg(cashDoc("NPV(0.08, Cash)", ""))).toBe("NPV() of an empty column");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n|    |\n|  5 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n| no |\n|  5 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(0.08, Cash)", "| 10 |\n| 2026-01-01 |"))).toBe("NPV expects a number");
  expect(msg(cashDoc("NPV(-1, Cash)", "| 10 |\n|    |"))).toBe("NPV rate must be greater than -1");
});

test("NPV shape, scalar flows, and a column in the rate slot", () => {
  const shape = typeFindings(run(cashDoc("NPV(0.08, Cash * 1)", "| 10 |")).findings);
  expect(shape).toHaveLength(1);
  expect(shape[0]!.message).toBe("NPV() takes a column reference, not an expression");

  const arity = typeFindings(run(cashDoc("NPV(0.08)", "| 10 |")).findings);
  expect(arity).toHaveLength(1);
  expect(arity[0]!.message).toBe("NPV() takes 2 arguments, got 1");

  const swapped = `
| Cash |
|-----:|
|   10 |
\`\`\`vmark #t
present = NPV(Cash, 0.08)
\`\`\`
`;
  const swappedFindings = run(swapped).findings;
  expect(typeFindings(swappedFindings).map((f) => f.message)).toEqual([
    "NPV() takes a column reference, not an expression",
  ]);
  expect(swappedFindings.some((f) => f.code === "VECTOR")).toBe(false);

  const scalar = `
| Cash |
|-----:|
|   10 |
\`\`\`vmark #t
present = 1
value = NPV(0.08, present)
\`\`\`
`;
  expect(typeFindings(run(scalar).findings).map((f) => f.message)).toContain(
    "NPV() expects a column",
  );

  const twoCols = `
| Cash | Flows |
|-----:|------:|
|   10 |    20 |
\`\`\`vmark #t
present = NPV(Cash, Flows)
\`\`\`
`;
  const vec = run(twoCols).findings.filter((f) => f.code === "VECTOR");
  expect(vec).toHaveLength(1);
  expect(vec[0]!.raw).toBe("Cash");
  expect(typeFindings(run(twoCols).findings)).toEqual([]);
});

test("a column rule reports one TYPE on the row whose rate is -1", () => {
  const src = `
| Rate | Cash | Level |
|-----:|-----:|------:|
| 0.08 |  -10 |     0 |
|   -1 |   10 |     0 |

\`\`\`vmark #t
Level precision 2 = NPV(Rate, Cash)
\`\`\`
`;
  const ts = typeFindings(run(src).findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe("NPV rate must be greater than -1");
  expect(ts[0]!.rowLabel).toBeDefined();
});

test("a computed flows column with an upstream error adds no NPV finding", () => {
  const src = `
| Den | Cash |
|----:|-----:|
|   1 | 1.00 |
|   0 | 0.00 |
|   1 | 1.00 |

\`\`\`vmark #t
Cash = 1 / Den
present precision 2 = NPV(0, Cash)
assert present == 3
\`\`\`
`;
  const r = run(src);
  expect(r.findings.filter((f) => f.code === "TYPE").map((f) => f.message)).toEqual([
    "division by zero",
  ]);
  expect(r.findings.filter((f) => f.message === "division by zero")).toHaveLength(1);
  expect(r.findings.filter((f) => f.code === "NOTE").map((f) => f.message)).toEqual([
    "1 assertion not verified (upstream errors)",
  ]);
});
