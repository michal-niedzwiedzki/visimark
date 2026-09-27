import { expect, test } from "bun:test";
import { onDisk } from "../../src/fs/node-reader.js";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { bandwidth, charts, chartsPath, clean, cleanPath, quote, repoRoot } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { explainText, explainView } from "../../src/report/explain.js";
import { explainJson } from "../../src/report/envelope.js";

/** the pair the CLI hands the renderers, without going through runCli */
function view(source: string, docPath?: string, sheets: string[] = []) {
  const model = build(locate(source));
  return explainView(model, check(model, docPath ? { doc: onDisk(docPath) } : {}), sheets);
}

const importPath = join(repoRoot, "docs", "example-invoice-csv-import.md");
const imported = readFileSync(importPath, "utf8");

test("explainText renders rules, scalars and evaluation order", () => {
  const out = explainText(view(clean, cleanPath));
  expect(out).toContain("#lines");
  expect(out).toContain("  rules:");
  expect(out).toContain("  order:   ");
  // the rule is echoed from source, not from a re-print of the parsed AST
  expect(out).toContain("Net = Qty * Rate");
});

test("explainText renders nothing for a document with no vmark blocks", () => {
  // cmdExplain relies on this being empty rather than a blank line — the
  // per-line loop it replaced emitted no write at all here.
  expect(explainText(view(quote))).toBe("");
});

test("explainText marks a sheet that has no table", () => {
  // #terms in the worked example is scalars-only
  expect(explainText(view(clean, cleanPath))).toContain("#terms  (no table)");
});

test("explainText renders aliases with their source header", () => {
  const out = explainText(view(bandwidth));
  expect(out).toContain("  aliases:");
  expect(out).toMatch(/→ "/);
});

test("explainText renders charts with their engine, path and state", () => {
  const out = explainText(view(charts, chartsPath));
  expect(out).toContain("  charts:");
  expect(out).toMatch(/ = \w[\w-]* of .* labelled .* → .*\[\w+\]/);
});

test("explainText renders an import line with its resolution state", () => {
  const out = explainText(view(imported, importPath));
  expect(out).toMatch(/ {2}import: {2}.*\[\w+\]/);
});

test("a #sheet selector narrows the view to that sheet", () => {
  const all = explainView(build(locate(clean)), check(build(locate(clean))), []);
  const one = view(clean, cleanPath, ["lines"]);
  expect(one.sheets).toEqual(["lines"]);
  expect(all.sheets.length).toBeGreaterThanOrEqual(one.sheets.length);
});

test("explainJson keeps the envelope key order the wire format depends on", () => {
  const doc = explainJson(view(clean, cleanPath), "docs/example-invoice.md");
  expect(Object.keys(doc)).toEqual([
    "command",
    "visimark",
    "status",
    "file",
    "documentScope",
    "sheets",
  ]);
});

test("explainJson places the import block between hasTable and inputs", () => {
  const doc = explainJson(view(imported, importPath), importPath) as {
    sheets: Record<string, unknown>[];
  };
  const sheet = doc.sheets.find((s) => "import" in s);
  expect(sheet).toBeDefined();
  expect(Object.keys(sheet!)).toEqual([
    "id",
    "hasTable",
    "import",
    "inputs",
    "aliases",
    "rules",
    "scalars",
    "order",
    "assertions",
    "charts",
  ]);
});

test("explainJson omits the import block entirely for a non-imported sheet", () => {
  const doc = explainJson(view(clean, cleanPath), cleanPath) as {
    sheets: Record<string, unknown>[];
  };
  for (const s of doc.sheets) expect("import" in s).toBe(false);
});

test("both renderings agree on the order of a sheet's bindings", () => {
  const v = view(clean, cleanPath);
  const doc = explainJson(v, cleanPath) as { sheets: { id: string; order: string[] }[] };
  const text = explainText(v);
  for (const s of doc.sheets) {
    if (s.order.length === 0) continue;
    expect(text).toContain(`  order:   ${s.order.join(" → ")}`);
  }
});
