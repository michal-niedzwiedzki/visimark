import { expect, test } from "bun:test";
import { fmt } from "../../src/write/fmt.js";

const stale = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  | $5.50 |   3 | $9.99 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const suffix = `| Beam | Force | Times |  Peak |
|------|------:|------:|------:|
| A    |  12 N |     2 |  99 N |

\`\`\`vmark #beam
Peak = Force * Times
\`\`\`
`;

const conflicted = `| Item  | Price | Qty |    Net |
|-------|------:|----:|-------:|
| pen   | $5.50 |   3 |  $0.01 |
| paper | €4.00 |   2 |  $0.02 |

\`\`\`vmark #order
Net = Price * Qty
\`\`\`
`;

const anchored = `| Item | Price | Qty |    Net |
|------|------:|----:|-------:|
| pen  | $5.50 |   3 | $16.50 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **$0.00**<!--vmark=order.total-->
`;

test("a stale cell in a decorated column is rewritten with its decoration", () => {
  const out = fmt(stale, {}).output;
  expect(out).toContain("| $16.50 |");
  expect(out).not.toContain("$9.99");
});

test("a suffix unit is put back on the far side of the number", () => {
  const out = fmt(suffix, {}).output;
  expect(out).toContain("24 N");
});

test("a column in UNIT conflict is not rewritten at all", () => {
  const r = fmt(conflicted, {});
  expect(r.output).toBe(conflicted);
  expect(r.changed).toBe(false);
  expect(r.unfixable.some((f) => f.code === "UNIT")).toBe(true);
});

test("an anchored scalar keeps its decoration", () => {
  const out = fmt(anchored, {}).output;
  expect(out).toContain("**$16.50**<!--vmark=order.total-->");
});

test("fmt over a decorated document is idempotent", () => {
  const once = fmt(stale, {}).output;
  expect(fmt(once, {}).output).toBe(once);
  expect(fmt(once, {}).changed).toBe(false);
});

test("a decorated document that is already correct is left byte-for-byte alone", () => {
  const correct = fmt(stale, {}).output;
  expect(fmt(correct, {}).output).toBe(correct);
});
