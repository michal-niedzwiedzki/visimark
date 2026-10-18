import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { engineCheck } from "../../src/rules/engine-check.js";
import { ctx, doc, runRule } from "../support.js";

const ROOT = join(import.meta.dir, "../../../..");
const QUOTE = [
  "# Quote",
  "",
  "| Item | Qty | Price | Cost |",
  "|------|----:|------:|-----:|",
  "| A    | 2   | 5.00  | 10.00 |",
  "| B    | 3   | 4.00  | 13.00 |",
  "| C    | 1   | 7.00  | 7.00 |",
  "| D    | 4   | 2.00  | 8.00 |",
  "",
  "```vmark #q",
  "Cost = Qty * Price",
  "```",
  "",
].join("\n");

describe("engine-check", () => {
  test("STALE is confirmed", () => {
    const [f] = runRule(engineCheck, "q.md", QUOTE).shaped;
    expect(f!.confidence).toBe("confirmed");
    expect(f!.stored).toBe("13.00");
    expect(f!.computed).toBe("12.00");
  });

  test("a STALE cell inside a table gets a table CellRef", () => {
    const r = runRule(engineCheck, "q.md", QUOTE);
    expect(r.findings[0]!.cell).toEqual({ kind: "table", table: 1, column: "Cost", row: "B" });
    expect(r.shaped[0]!.id).toBe("q.md#t1/Cost/B");
    expect(r.shaped[0]!.lines).toEqual([3, 6]);
  });

  test("non-ASCII text before the table keeps the cell", () => {
    const text = QUOTE.replace("# Quote", "# Quote 🍔 — café");
    expect(runRule(engineCheck, "q.md", text).shaped.map((f) => f.id)).toEqual(["q.md#t1/Cost/B"]);
  });

  test("UNDEF is a lead with describeFinding's text, no fix", () => {
    const text = QUOTE.replace("Cost = Qty * Price", "Cost = Qty * Prise");
    const leads = runRule(engineCheck, "q.md", text).shaped;
    expect(leads.length).toBeGreaterThan(0);
    for (const f of leads) {
      expect(f.confidence).toBe("lead");
      expect("fix" in f).toBe(false);
      expect(f.message).toContain("Prise");
    }
  });

  test("COVERAGE adds to coverage, not findings", () => {
    const r = runRule(engineCheck, "t.md", "| a | b |\n|---|---|\n| x | 1 |\n");
    expect(r.findings).toEqual([]);
    expect(r.coverage).toBe(1);
  });

  test("anchor-group STALE is dropped", () => {
    const lunch = readFileSync(join(ROOT, "docs/example-lunch-split-drift.md"), "utf8");
    expect(runRule(engineCheck, "l.md", lunch).findings.length).toBe(1);
  });

  test("a finding about a generated artifact is dropped", () => {
    const charts = readFileSync(join(ROOT, "docs/example-charts.md"), "utf8");
    expect(runRule(engineCheck, "docs/example-charts.md", charts).findings).toEqual([]);
  });

  test("WARN and NOTE are dropped", () => {
    const text = QUOTE.replace("Cost = Qty * Price", "Cost = Qty * Price\nUnused = 1");
    const codes = runRule(engineCheck, "q.md", text).shaped.map((f) => f.confidence);
    expect(codes).toEqual(["confirmed"]);
  });

  test("a ruled table is checked and ruled", () => {
    const r = runRule(engineCheck, "q.md", QUOTE);
    expect(r.checked).toEqual(["q.md#t1"]);
    expect(r.ruled).toEqual(["q.md#t1"]);
  });

  test("an import resolves through ctx.reader", () => {
    const path = "docs/example-invoice-csv-import.md";
    const csv = "docs/example-invoice-csv-import.csv";
    const texts = new Map([
      [path, readFileSync(join(ROOT, path), "utf8")],
      [csv, readFileSync(join(ROOT, csv), "utf8")],
    ]);
    const r = engineCheck.run(doc(path, texts.get(path)!), ctx(texts));
    expect(r.findings.map((f) => f.message)).toEqual([]);
  });
});
