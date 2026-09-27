import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createApi } from "../src/api.js";
import { rowFrom, summaryFor } from "../src/hover.js";
import type { VaultRead } from "../src/snapshot.js";

/**
 * Manual test §2.3 names three things a popover must contain — **the formula,
 * its inputs and the result** — and one it must be: byte-identical to what
 * `visimark explain` prints for the same binding. The numbers come from the
 * API (row 9), which is already compared against the engine; what is left
 * here is that the line says all three and adds nothing of its own.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const files: Record<string, string> = {
  "invoice.md": readFileSync(join(docs, "example-invoice.md"), "utf8"),
};
const read: VaultRead = (p) => Promise.resolve(files[p] ?? null);
const api = createApi(read, (f) => (typeof f === "string" ? f : null));

test("a scalar's line has the formula, the result and what it reads", async () => {
  const e = (await api.explain("invoice.md", "lines.net_total"))!;
  expect(summaryFor(e)).toBe("net_total   = SUM(Net) · comes to 23300 · reads lines.Net");
});

test("a cross-sheet input is named, which §2.3 asks for by name", async () => {
  const e = (await api.explain("invoice.md", "terms.eur_total"))!;
  const line = summaryFor(e);
  expect(line).toContain("lines.gross_total");
  expect(line).toContain("fx_eur");
});

test("a cell says what that cell comes to, not what the column does", async () => {
  const e = (await api.explain("invoice.md", "lines.Net"))!;
  expect(summaryFor(e, 0)).toContain("comes to 3600");
  expect(summaryFor(e, 3)).toContain("comes to 3120");
  // and never the whole column, which would answer a question nobody asked
  expect(summaryFor(e, 0)).not.toContain("14080");
});

test("a column with no row asked about says the formula and stops", async () => {
  const e = (await api.explain("invoice.md", "lines.Net"))!;
  const line = summaryFor(e);
  expect(line).toContain("Net               = Qty * Rate");
  expect(line).not.toContain("comes to");
});

test("a value written down rather than worked out reads nothing", async () => {
  const e = (await api.explain("invoice.md", "vat"))!;
  const line = summaryFor(e);
  expect(line).toContain("comes to 0.23");
  expect(line).not.toContain("reads");
});

test("the line carries no finding code and none of the report's vocabulary", async () => {
  // v1 constraint 6, at the surface a reader touches most often
  for (const name of ["lines.net_total", "lines.Net", "terms.eur_total", "vat"]) {
    const e = (await api.explain("invoice.md", name))!;
    const line = summaryFor(e, 0);
    for (const banned of ["STALE", "COVERAGE", "problem", "error", "exit"]) {
      expect(line.toLowerCase(), name).not.toContain(banned.toLowerCase());
    }
  }
});

test("the row attribute survives a round trip, and refuses nonsense", () => {
  expect(rowFrom("0")).toBe(0);
  expect(rowFrom("3")).toBe(3);
  expect(rowFrom(null)).toBeUndefined();
  expect(rowFrom("")).toBeUndefined();
  expect(rowFrom("-1")).toBeUndefined();
  expect(rowFrom("banana")).toBeUndefined();
});
