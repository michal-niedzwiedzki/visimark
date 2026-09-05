import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

const run = (s: string) => check(build(locate(s)));

const twiceInASheet = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
Net = 99
total = SUM(Net)
\`\`\`
`;

const twiceInDocScope = `
\`\`\`vmark
rate = 0.23
rate = 0.19
\`\`\`

\`\`\`vmark #s
x = rate
\`\`\`
`;

const acrossTwoBlocksSameSheet = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`

\`\`\`vmark #order
Net = 1
\`\`\`
`;

const splitAcrossBlocksNoCollision = `
| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`

\`\`\`vmark #order
total = SUM(Net)
\`\`\`

Total: **10.00**<!--vmark=order.total-->
`;

test("a name bound twice in one sheet is DUP", () => {
  const dups = run(twiceInASheet).findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("Net");
  expect(dups[0]!.sheetId).toBe("order");
});

test("DUP keeps the first binding, so the column still computes", () => {
  const r = run(twiceInASheet);
  // Net = Price * Qty wins; 5.00 * 2 = 10.00 matches the stored cell,
  // so there is no STALE finding on top of the DUP.
  expect(r.findings.filter((f) => f.code === "STALE")).toEqual([]);
});

test("DUP points at the second binding and back at the first", () => {
  const d = run(twiceInASheet).findings.find((f) => f.code === "DUP")!;
  expect(twiceInASheet.slice(d.span!.start, d.span!.end)).toBe("Net = 99");
  expect(twiceInASheet.slice(d.relatedSpan!.start, d.relatedSpan!.end)).toBe("Net = Price * Qty");
});

test("a name bound twice in document scope is DUP", () => {
  const dups = run(twiceInDocScope).findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("rate");
  expect(dups[0]!.sheetId).toBeUndefined();
});

test("two blocks sharing a sheet id collide on a repeated name", () => {
  const dups = run(acrossTwoBlocksSameSheet).findings.filter((f) => f.code === "DUP");
  expect(dups.length).toBe(1);
  expect(dups[0]!.name).toBe("Net");
});

test("splitting one sheet across blocks is legal when names do not collide", () => {
  expect(run(splitAcrossBlocksNoCollision).findings).toEqual([]);
});
