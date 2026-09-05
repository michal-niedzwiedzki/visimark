import { expect, test, describe } from "bun:test";
import { check } from "../../src/eval/check.js";
import { infer } from "../../src/infer/propose.js";
import { planInfer } from "../../src/infer/write.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { applyEdits } from "../../src/write/splice.js";
import { strippedClean } from "../examples.js";

const written = (src: string, only?: ReturnType<typeof infer>) =>
  applyEdits(src, planInfer(src, only));

describe("--write only ever inserts", () => {
  test("every planned edit is an insertion", () => {
    for (const e of planInfer(strippedClean)) expect(e.start).toBe(e.end);
  });

  test("the input document survives byte for byte", () => {
    const out = written(strippedClean);
    let i = 0;
    for (const ch of strippedClean) {
      i = out.indexOf(ch, i);
      expect(i).toBeGreaterThanOrEqual(0);
      i++;
    }
  });

  test("a block sits immediately after its table, so the sheet owns it", () => {
    const doc = locate(written(strippedClean));
    const model = build(doc);
    expect([...model.sheets.keys()]).toEqual(["unnamed1", "unnamed2"]);
    expect(model.sheets.get("unnamed1")!.table).not.toBeNull();
    expect(model.findings.filter((f) => f.code === "SHEET")).toEqual([]);
  });

  test("bindings are emitted in dependency order", () => {
    const block = /```vmark #unnamed1\n([\s\S]*?)```/.exec(written(strippedClean))![1]!;
    expect(block).toBe(
      [
        "Net   = Qty * Rate",
        "VAT   = Net * 0.23",
        "Gross = Net + VAT",
        "",
        "net_total   = SUM(Net)",
        "vat_total   = SUM(VAT)",
        "gross_total = SUM(Gross)",
        "",
      ].join("\n"),
    );
  });

  test("one proposal can be applied without the rest", () => {
    const one = infer(strippedClean).filter((p) => p.kind === "column" && p.name === "Net");
    const out = written(strippedClean, one);
    expect(out).toContain("```vmark #unnamed1\nNet = Qty * Rate\n```");
    expect(out).not.toContain("<!--vmark=unnamed1");
  });
});

describe("anchors reach all four inline kinds", () => {
  const doc = `| Item | A  | B |
|------|---:|--:|
| a    | 11 | 1 |
| b    | 22 | 2 |
| c    | 30 | 9 |

The total of A is **63** and of B is *12*.

The mean of A is \`21\`.

The mean of B is 4
`;
  const out = written(doc);

  test("strong", () => {
    expect(out).toContain("**63**<!--vmark=unnamed1.a_total-->");
  });
  test("emphasis", () => {
    expect(out).toContain("*12*<!--vmark=unnamed1.b_total-->");
  });
  test("inline code", () => {
    expect(out).toContain("`21`<!--vmark=unnamed1.a_avg-->");
  });
  test("a text node whose trailing token is a number", () => {
    expect(out).toContain("is 4<!--vmark=unnamed1.b_avg-->");
  });
  test("check reads every one of them back", () => {
    const r = check(build(locate(out)));
    expect(r.findings).toEqual([]);
  });
});

describe("minting a sheet id", () => {
  const doc = `| Item | A | B  |
|------|--:|---:|
| a    | 2 |  4 |
| b    | 3 |  6 |
| c    | 5 | 10 |

\`\`\`vmark #unnamed1
B = A * 2
\`\`\`

| Item | C | D  |
|------|--:|---:|
| a    | 2 |  6 |
| b    | 3 |  9 |
| c    | 5 | 15 |
`;

  test("a minted id takes the next integer not already in use", () => {
    const model = build(locate(written(doc)));
    expect([...model.sheets.keys()]).toEqual(["unnamed1", "unnamed2"]);
    expect(model.sheets.get("unnamed2")!.columns.has("D")).toBe(true);
  });

  test("a column that already has a rule is left alone", () => {
    const proposals = infer(doc);
    expect(proposals.filter((p) => p.name === "B")).toEqual([]);
  });
});

describe("--write marks a document infer can make nothing of", () => {
  const PLAIN = "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n";
  // `Fee = Hours * Rate` everywhere but row c. Nothing here is writable, so a
  // marker written on "nothing to write" alone would silence the one document
  // that most needs a reader.
  const NEAR_MISS = [
    "| Item | Hours | Rate  |    Fee |",
    "|------|------:|------:|-------:|",
    "| a    |     3 | 12.50 |  37.50 |",
    "| b    |     7 | 20.00 | 140.00 |",
    "| c    |     5 | 11.00 |  90.00 |",
    "| d    |     9 |  8.00 |  72.00 |",
    "",
  ].join("\n");

  test("a table infer finds no rule in gets the marker", () => {
    expect(infer(PLAIN)).toEqual([]);
    expect(planInfer(PLAIN).map((e) => e.kind)).toEqual(["marker"]);
    expect(written(PLAIN)).toContain("<!--vmark:no-formulas-->");
  });

  test("the marked document then passes check", () => {
    expect(check(build(locate(written(PLAIN)))).findings).toEqual([]);
  });

  test("a near-miss is never marked away — that document has a wrong number", () => {
    expect(infer(NEAR_MISS).some((p) => p.kind === "near-miss")).toBe(true);
    expect(planInfer(NEAR_MISS).some((e) => e.kind === "marker")).toBe(false);
  });

  test("a document with rules to write gets blocks, not a marker", () => {
    expect(planInfer(strippedClean).some((e) => e.kind === "marker")).toBe(false);
  });

  test("a document with no table is left alone", () => {
    expect(planInfer("# Notes\n\nJust words.\n")).toEqual([]);
  });

  test("a second --write does not stack markers", () => {
    expect(planInfer(written(PLAIN))).toEqual([]);
  });
});
