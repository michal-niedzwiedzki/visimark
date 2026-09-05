import { expect, test, describe } from "bun:test";
import { check } from "../../src/eval/check.js";
import { infer } from "../../src/infer/propose.js";
import { planInfer } from "../../src/infer/write.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";
import { formatInfer } from "../../src/report/infer.js";
import { applyEdits } from "../../src/write/splice.js";
import { quote, transcript } from "../examples.js";

const DISPLAY_PATH = "docs/example-quote-plain.md";
const report = (src: string) => formatInfer(DISPLAY_PATH, src, infer(src));

describe("example-quote-plain.md — the plain document worked example", () => {
  test("it really is plain — and check reports that rather than passing it", () => {
    const doc = locate(quote);
    expect(doc.blocks).toEqual([]);
    expect(doc.anchors).toEqual([]);
    expect(check(build(doc)).findings.map((f) => f.code)).toEqual(["COVERAGE"]);
  });

  test("infer reproduces the appendix's own transcript", () => {
    expect(report(quote)).toBe(transcript(quote));
  });

  test("--write produces a document check calls clean", () => {
    const written = applyEdits(quote, planInfer(quote));
    const model = build(locate(written));
    expect([...model.sheets.keys()]).toEqual(["unnamed1", "unnamed2"]);
    expect(check(model).findings).toEqual([]);
  });

  test("one changed input breaks both tables, as the appendix claims", () => {
    const written = applyEdits(quote, planInfer(quote));
    const edited = written.replace("|    24 | 450.00 |", "|    26 | 450.00 |");
    expect(edited).not.toBe(written);
    const sheets = check(build(locate(edited))).findings.map((f) => f.sheetId);
    expect(sheets).toContain("unnamed1");
    expect(sheets).toContain("unnamed2");
  });

  test("the appendix's near-miss excerpt is what a transposed digit produces", () => {
    const broken = quote.replace("5832.00 |", "5823.00 |");
    expect(broken).not.toBe(quote);
    expect(report(broken)).toContain(transcript(quote, 1));
  });
});
