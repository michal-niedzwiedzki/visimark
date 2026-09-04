import { expect, test, describe } from "bun:test";
import { check } from "../../src/eval/check.js";
import { infer } from "../../src/infer/propose.js";
import { planInfer } from "../../src/infer/write.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { applyEdits } from "../../src/write/splice.js";

const table = `| Item | Share | Amount |
|------|------:|-------:|
| a    |   25% |  10.00 |
| b    |   50% |  20.00 |
| c    |   25% |  10.00 |
`;

const anchored = (doc: string): string[] =>
  infer(doc)
    .filter((p) => p.kind === "scalar")
    .map((p) => p.rule);

describe("a figure states a value only when it is already written as one", () => {
  test("a bare integer does not claim a value that merely rounds to it", () => {
    // SUM(Share) is 1 and MIN(Share) is 0.25; `00` in a postal code is neither
    expect(anchored(`${table}\nDelivered to 110 00 Praha.\n`)).toEqual([]);
  });

  test("a token that happens to end in digits is not a decorated number", () => {
    // `#unnamed1` parses as a decorated 1, and SUM(Share) is 1
    expect(anchored(`${table}\nThe sheet is called \`#unnamed1\` here.\n`)).toEqual(
      [],
    );
  });

  test("a percent figure is not the form the tool would write back", () => {
    // MIN(Share) is 0.25; fmt would write `0.25`, not `25%`
    expect(anchored(`${table}\nThe smallest share is \`25%\`.\n`)).toEqual([]);
  });

  test("a figure written as fmt would write it does claim the value", () => {
    expect(anchored(`${table}\nThe instalments total **40.00**.\n`)).toEqual([
      "amount_total = SUM(Amount)",
    ]);
  });

  test("rounding at the anchor stays legal", () => {
    const doc = `| Item | Cost |
|------|-----:|
| a    | 1.00 |
| b    | 1.00 |
| c    | 1.00 |
| d    | 0.01 |

The mean cost is **0.75** across the four items.
`;
    // AVG is 0.7525 exactly; the figure states it to two places, as fmt would
    expect(anchored(doc)).toEqual(["cost_avg = AVG(Cost)"]);
  });
});

describe("a decorated figure carries its column's decoration", () => {
  const doc = `| Item | Fee     |
|------|--------:|
| a    | $100.00 |
| b    | $250.00 |
| c    | $400.00 |

The engagement comes to **$750.00** in fees.
`;

  test("a currency prefix in prose is anchorable when the column carries it", () => {
    expect(anchored(doc)).toEqual(["fee_total = SUM(Fee)"]);
  });

  test("and check reads the written anchor back", () => {
    const out = applyEdits(doc, planInfer(doc));
    expect(out).toContain("**$750.00**<!--vmark=unnamed1.fee_total-->");
    expect(check(build(locate(out))).findings).toEqual([]);
  });

  test("the same figure over a bare column is not that value", () => {
    const bare = doc.replace(/\$(?=\d)/g, "").replace("**750.00**", "**$750.00**");
    expect(anchored(bare)).toEqual([]);
  });
});
