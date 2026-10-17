import { describe, expect, test } from "bun:test";
import { engineInfer } from "../../src/rules/engine-infer.js";
import { fixture, runRule } from "../support.js";

const Q409 = [
  "| Item | Qty | Price | Cost |",
  "|------|----:|------:|-----:|",
  "| A    | 2   | 5.00  | 10.00 |",
  "| B    | 3   | 4.00  | 13.00 |",
  "| C    | 1   | 7.00  | 7.00 |",
  "| D    | 4   | 2.00  | 8.00 |",
  "",
].join("\n");

describe("engine-infer", () => {
  test("near-miss is a lead", () => {
    const [f] = runRule(engineInfer, "h.md", fixture("engine-infer", "bad.md")).shaped;
    expect(f!.confidence).toBe("lead");
    expect(f!.id).toBe("h.md#t1/Net/D");
  });

  test("a column proposal adds a table to proposals", () => {
    const r = runRule(engineInfer, "h.md", fixture("engine-infer", "good.md"));
    expect(r.findings).toEqual([]);
    expect(r.proposals).toEqual([{ table: 1 }]);
  });

  test("the #409 table yields a proposal and no lead", () => {
    const r = runRule(engineInfer, "q.md", Q409);
    expect(r.findings).toEqual([]);
    expect(r.proposals).toEqual([{ table: 1 }]);
  });
});
