import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const run = (s: string) => check(build(locate(s)));

const dollars = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper | $4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **24.50**<!--vmark=order.total-->
`;

const mixedCurrency = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper | €4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const bareAmongDecorated = `
| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 | $16.50 |
| paper |  4.00 |   2 |  $8.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const bothSides = `
| Item | Price    | Qty |   Net |
|------|---------:|----:|------:|
| pen  | $5.50 kg |   3 | 16.50 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const newtons = `
| Beam | Force |  Span |
|------|------:|------:|
| A    |  12 N | 3.0 m |

\`\`\`vmark #beam
peak = SUM(Force)
\`\`\`

Peak: **12**<!--vmark=beam.peak-->
`;

const staleDecorated = `
| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  | $5.50 |   3 | $9.99 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

test("a uniformly decorated column computes on the stripped number", () => {
  const r = run(dollars);
  expect(r.findings).toEqual([]);
  expect(r.values.get("order.total")!).toMatchObject({ t: "num" });
  expect(r.columnUnits.get("order.Price")).toEqual({ text: "$", side: "prefix" });
  expect(r.columnUnits.get("order.Net")).toEqual({ text: "$", side: "prefix" });
});

test("a mixed-currency column is a UNIT error naming both forms", () => {
  const f = run(mixedCurrency).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.name).toBe("Price");
  expect(f[0]!.message).toContain("$");
  expect(f[0]!.message).toContain("€");
});

test("a bare cell among decorated ones is a UNIT error", () => {
  const f = run(bareAmongDecorated).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.name).toBe("Price");
  expect(f[0]!.message).toContain("(none)");
});

test("a UNIT conflict suppresses staleness in the columns that depend on it", () => {
  const r = run(mixedCurrency);
  expect(r.findings.filter((x) => x.code === "STALE")).toEqual([]);
  expect(r.unitConflicts.has("order.Price")).toBe(true);
});

test("decoration on both sides is a UNIT error", () => {
  const f = run(bothSides).findings.filter((x) => x.code === "UNIT");
  expect(f.length).toBe(1);
  expect(f[0]!.message).toContain("both sides");
});

test("a UNIT span selects the offending cell", () => {
  const f = run(mixedCurrency).findings.find((x) => x.code === "UNIT")!;
  expect(mixedCurrency.slice(f.span!.start, f.span!.end)).toBe("€4.00");
});

test("suffix units work the same way", () => {
  const r = run(newtons);
  expect(r.findings).toEqual([]);
  expect(r.columnUnits.get("beam.Force")).toEqual({ text: "N", side: "suffix" });
  expect(r.columnUnits.get("beam.Span")).toEqual({ text: "m", side: "suffix" });
});

test("staleness compares the stripped number, and reports the decorated text", () => {
  const f = run(staleDecorated).findings.filter((x) => x.code === "STALE");
  expect(f.length).toBe(1);
  expect(f[0]!.stored).toBe("$9.99");
  expect(f[0]!.computed).toBe("$16.50");
});

test("precision is inferred from the number, not the decorated text", () => {
  // columnPrecision is populated for rule columns only, so measure one.
  // "$16.50" must read as two decimal places despite the leading $.
  const r = run(dollars);
  expect(r.columnPrecision.get("order.Net")).toBe(2);

  // A suffix unit must not defeat the trailing-decimals probe either.
  const metres = `
| Beam | Span  | Times |  Total |
|------|------:|------:|-------:|
| A    | 3.5 m |     2 |  7.0 m |

\`\`\`vmark #b
Total = Span * Times
\`\`\`
`;
  expect(run(metres).columnPrecision.get("b.Total")).toBe(1);
});

test("percent still means one hundredth and is not treated as a unit", () => {
  const pct = `
| Row | Share | Amount |
|-----|------:|-------:|
| a   |   30% |  30.00 |

\`\`\`vmark #s
Amount = Share * 100
\`\`\`
`;
  const r = run(pct);
  expect(r.findings.filter((x) => x.code === "UNIT")).toEqual([]);
  expect(r.findings.filter((x) => x.code === "STALE")).toEqual([]);
});
