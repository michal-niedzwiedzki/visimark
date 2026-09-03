import { expect, test } from "bun:test";
import { analyze, planFmt } from "../../src/index.js";

const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   3 | 9.99 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **0.00**<!--vmark=order.total-->
`;

test("every planned edit carries the finding it resolves", () => {
  const { model, result } = analyze(doc);
  const edits = planFmt(model, result, {});
  expect(edits.length).toBeGreaterThan(0);
  for (const e of edits) {
    expect(e.finding).toBeDefined();
    expect(e.finding.code).toBe("STALE");
  }
});

test("an edit's span matches its finding's span", () => {
  const { model, result } = analyze(doc);
  for (const e of planFmt(model, result, {})) {
    expect(e.finding.span).toEqual({ start: e.start, end: e.end });
  }
});

test("the cell edit replaces the stale text with the computed value", () => {
  const { model, result } = analyze(doc);
  const cell = planFmt(model, result, {}).find(
    (e) => e.finding.rowLabel === "pen",
  )!;
  expect(doc.slice(cell.start, cell.end)).toBe("9.99");
  expect(cell.text).toBe("15.00");
});
