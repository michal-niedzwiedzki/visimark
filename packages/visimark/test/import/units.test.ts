import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../../src/eval/check.js";
import { onDisk } from "../../src/fs/node-reader.js";
import { formatUnit } from "../../src/lang/unit-expr.js";
import { build } from "../../src/model/build.js";
import type { DocModel } from "../../src/model/types.js";
import { locate } from "../../src/parse/document.js";

/** a stamped import of `csv`, declared with `clause` after the path */
function importing(
  csv: string,
  clause: string,
): { model: DocModel; codes: string[]; messages: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "vmark-units-"));
  writeFileSync(join(dir, "prices.csv"), csv);
  const digest = createHash("sha256").update(csv).digest("hex");
  const md = `\`\`\`vmark #p from prices.csv ${clause} at sha256:${digest}
\`\`\`
`;
  const mdPath = join(dir, "doc.md");
  writeFileSync(mdPath, md);
  const model = build(locate(md));
  const result = check(model, { doc: onDisk(mdPath) });
  const real = result.findings.filter((f) => f.code !== "WARN");
  return { model, codes: real.map((f) => f.code), messages: real.map((f) => f.message ?? "") };
}

const unitOf = (m: DocModel, col: string): string | undefined => {
  const u = m.sheets.get("p")!.headerUnits.get(col);
  return u ? formatUnit(u.map) : undefined;
};

test("labelled declares a unit against a bare CSV header", () => {
  const r = importing("Item,Qty,Price\npen,2,1.50\n", "labelled Item, Qty, Price [USD]");
  expect(r.codes).toEqual([]);
  expect(unitOf(r.model, "Price")).toBe("USD");
  expect(unitOf(r.model, "Qty")).toBeUndefined();
});

test("a CSV header carries its own unit", () => {
  const r = importing("Item,Qty,Price [USD]\npen,2,1.50\n", "");
  expect(r.codes).toEqual([]);
  expect(unitOf(r.model, "Price")).toBe("USD");
  expect([...r.model.sheets.get("p")!.columnIndex.keys()]).toEqual(["Item", "Qty", "Price"]);
});

test("labelled and the CSV header agreeing is fine", () => {
  const r = importing("Item,Price [USD]\npen,1.50\n", "labelled Item, Price [USD]");
  expect(r.codes).toEqual([]);
  expect(unitOf(r.model, "Price")).toBe("USD");
});

test("labelled and the CSV header disagreeing is UNIT", () => {
  const r = importing("Item,Price [EUR]\npen,1.50\n", "labelled Item, Price [USD]");
  expect(r.codes).toEqual(["UNIT"]);
  expect(r.messages).toEqual(["Price is declared USD in labelled but EUR in the CSV header"]);
});

test("unlabelled takes brackets the same way", () => {
  const r = importing("pen,2,1.50\n", "unlabelled Item, Qty, Price [USD]");
  expect(r.codes).toEqual([]);
  expect(unitOf(r.model, "Price")).toBe("USD");
});

test("a malformed bracket in the list is UNIT and the import still resolves", () => {
  const r = importing("Item,Price\npen,1.50\n", "labelled Item, Price [100km]");
  expect(r.codes).toEqual(["UNIT"]);
  expect(r.messages).toEqual(["[100km] is not a unit — an atom is letters only"]);
  expect([...r.model.sheets.get("p")!.columnIndex.keys()]).toEqual(["Item", "Price"]);
});
