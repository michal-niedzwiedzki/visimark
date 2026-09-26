import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, evalValues, locate } from "visimark";
import { nameAt } from "../src/at-cursor.js";
import { valueRows, valuesJson } from "../src/values.js";

/**
 * **Explain shows one name, so it has to be the right one.** Showing the
 * wrong name confidently is worse than asking the person to move the caret,
 * which is why `nameAt` answers `null` rather than "the nearest thing" — and
 * why the cases below include every place a caret plausibly is when someone
 * asks.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const source = readFileSync(join(docs, "example-invoice.md"), "utf8");
const model = build(locate(source));
const at = (needle: string, offset = 2): number => source.indexOf(needle) + offset;

const result = check(model);

test("a caret in an anchored number names what the number is bound to", () => {
  expect(nameAt(model, result, at("23300.00"))).toEqual({ name: "lines.net_total" });
});

test("a caret inside the anchor comment names the same thing", () => {
  // in reading mode the comment is invisible; in Live Preview it is not, so a
  // caret "on the number" lands in either half
  expect(nameAt(model, result, at("<!--vmark=lines.net_total-->", 5))).toEqual({
    name: "lines.net_total",
  });
});

test("a caret in the line that declares a name names it", () => {
  expect(nameAt(model, result, at("net_total   = SUM(Net)", 3))).toEqual({
    name: "lines.net_total",
  });
  expect(nameAt(model, result, at("Net               = Qty * Rate", 1))).toEqual({
    name: "lines.Net",
  });
});

test("a document-scope constant is named without a sheet", () => {
  expect(nameAt(model, result, at("fx_eur         = 4.2650", 2))).toEqual({ name: "fx_eur" });
});

test("a caret in a computed table cell names the column and that row", () => {
  // "Net" is a column rule (Qty * Rate); its cells carry no binding span of
  // their own, so this can only be answered from decorationsFor's cell spans
  expect(nameAt(model, result, at("14080.00"))).toEqual({ name: "lines.Net", row: 1 });
});

test("a caret in an input column's cell names nothing", () => {
  // "Rate" has no column rule -- it is the human-owned input the "Net" rule
  // reads, and there is no row to answer with until a rule says what a row is
  expect(nameAt(model, result, at("220.00"))).toBeNull();
});

test("a caret in ordinary prose names nothing, rather than guessing", () => {
  expect(nameAt(model, result, at("Services rendered"))).toBeNull();
  expect(nameAt(model, result, at("Payment terms"))).toBeNull();
});

test("a caret in a note with no block names nothing", () => {
  const plain = build(locate("# Groceries\n\n- milk\n"));
  expect(nameAt(plain, check(plain), 5)).toBeNull();
});

test("values are listed by name, with a column on one line", () => {
  const rows = valueRows({
    "lines.net_total": "23300",
    "lines.Net": ["3600", "14080", null],
    vat: "0.23",
  });
  expect(rows.map((r) => r.name)).toEqual(["lines.Net", "lines.net_total", "vat"]);
  expect(rows[0]!.kind).toBe("column");
  // the CLI's own separator and its own placeholder for a cell with no value
  expect(rows[0]!.value).toBe("3600, 14080, ?");
  expect(rows[1]!.kind).toBe("scalar");
});

test("an empty document lists nothing rather than throwing", () => {
  expect(valueRows({})).toEqual([]);
});

test("the copied JSON is the `values` object out of `eval --json`, exactly", () => {
  // not a reshaping of it: a person pasting this into a script or a prompt is
  // pasting the contract structured-output-json-spec.md already specifies, and
  // a second shape would be a second contract that can drift
  const values = evalValues(check(build(locate(source))));
  expect(JSON.parse(valuesJson(values))).toEqual(values);
  // two-space indent and a trailing newline, as the CLI writes it, so a diff
  // between something pasted from here and something piped from there is empty
  expect(valuesJson(values)).toBe(JSON.stringify(values, null, 2) + "\n");
  expect(valuesJson(values).endsWith("\n")).toBe(true);
});

test("a column stays an array in the JSON, even though the list joins it", () => {
  const values = { "lines.Net": ["3600", null], total: "23300" };
  const parsed = JSON.parse(valuesJson(values)) as Record<string, unknown>;
  expect(parsed["lines.Net"]).toEqual(["3600", null]);
  // the display join lives in valueRows and does not leak into the clipboard
  expect(valueRows(values)[0]!.value).toBe("3600, ?");
});
