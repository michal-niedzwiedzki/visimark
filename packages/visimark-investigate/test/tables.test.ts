import { describe, expect, test } from "bun:test";
import { maskMarkdown } from "../src/mask.js";
import { readTables, rowKeys } from "../src/tables.js";

export const BUDGET = [
  "# Budget",
  "",
  "| Item | Cost |",
  "|------|-----:|",
  "| Venue | 120.00 |",
  "| Catering | 85.50 |",
  "| Printing | 22.00 |",
  "| Badges | 14.00 |",
  "| Signage | 30.00 |",
  "| Coffee | 18.00 |",
  "| Speakers | 25.00 |",
  "| Recording | 15.00 |",
  "| Swag | 6.00 |",
  "| Misc | 5.00 |",
  "| Total | 341.50 |",
  "",
  "An example of a wrong table, which is not part of the budget:",
  "",
  "```markdown",
  "| Item | Cost |",
  "|------|-----:|",
  "| A    | 1    |",
  "| B    | 2    |",
  "| Total | 99  |",
  "```",
  "",
].join("\n");

const tables = (text: string) => readTables(maskMarkdown(text));

describe("readTables", () => {
  test("reads the budget table: index 1, headerLine 3, 11 rows, Total row line 15", () => {
    const [t] = tables(BUDGET);
    expect(t!.index).toBe(1);
    expect(t!.headerLine).toBe(3);
    expect(t!.rows.length).toBe(11);
    expect(t!.rows.at(-1)!.line).toBe(15);
    expect(t!.rows.at(-1)!.label).toBe("Total");
    expect(t!.header.map((c) => c.text)).toEqual(["Item", "Cost"]);
  });

  test("a fenced table is not read", () => {
    expect(tables(BUDGET).length).toBe(1);
  });

  test("escaped pipe stays in the cell", () => {
    const [t] = tables("| h | v |\n|---|---|\n| a \\| b | 1 |\n");
    expect(t!.rows[0]!.cells.map((c) => c.text)).toEqual(["a \\| b", "1"]);
  });

  test("CRLF table matches LF twin", () => {
    const lf = tables(BUDGET);
    const crlf = tables(BUDGET.replace(/\n/g, "\r\n"));
    const shape = (ts: typeof lf) =>
      ts.map((t) => ({
        headerLine: t.headerLine,
        header: t.header.map((c) => c.text),
        rows: t.rows.map((r) => ({
          line: r.line,
          label: r.label,
          cells: r.cells.map((c) => c.text),
        })),
      }));
    expect(shape(crlf)).toEqual(shape(lf));
  });

  test("emphasis is stripped from the edges, an inner underscore stays", () => {
    const [t] = tables("| **premium_hours** | `rate` |\n|---|---|\n| _a_b_ | 1 |\n");
    expect(t!.header.map((c) => c.text)).toEqual(["premium_hours", "rate"]);
    expect(t!.rows[0]!.label).toBe("a_b");
  });

  test("duplicate labels get ~2", () => {
    const [t] = tables("| k | v |\n|---|---|\n| A | 1 |\n| A | 2 |\n| Total | 3 |\n");
    expect(rowKeys(t!)).toEqual(["A", "A~2", "Total"]);
  });

  test("cell offsets point at the raw cell text", () => {
    const text = "| Item | Cost |\n|---|---|\n| **Venue** | $1,234.50 |\n";
    const [t] = tables(text);
    const cell = t!.rows[0]!.cells[1]!;
    expect(text.slice(cell.from, cell.to)).toBe("$1,234.50");
    const label = t!.rows[0]!.cells[0]!;
    expect(text.slice(label.from, label.to)).toBe("**Venue**");
    expect(label.text).toBe("Venue");
  });
});

describe("hostile input", () => {
  test("a delimiter-looking line full of spaces reads in linear time", () => {
    const text = `| a | b |\n|${" ".repeat(50_000)}x\n`;
    const start = performance.now();
    expect(readTables(maskMarkdown(text))).toEqual([]);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
