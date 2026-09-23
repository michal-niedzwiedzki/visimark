import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, locate } from "visimark";
import { nameAt } from "../src/at-cursor.js";
import { valueRows } from "../src/values.js";

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

test("a caret in an anchored number names what the number is bound to", () => {
  expect(nameAt(model, at("23300.00"))).toBe("lines.net_total");
});

test("a caret inside the anchor comment names the same thing", () => {
  // in reading mode the comment is invisible; in Live Preview it is not, so a
  // caret "on the number" lands in either half
  expect(nameAt(model, at("<!--vmark=lines.net_total-->", 5))).toBe("lines.net_total");
});

test("a caret in the line that declares a name names it", () => {
  expect(nameAt(model, at("net_total   = SUM(Net)", 3))).toBe("lines.net_total");
  expect(nameAt(model, at("Net               = Qty * Rate", 1))).toBe("lines.Net");
});

test("a document-scope constant is named without a sheet", () => {
  expect(nameAt(model, at("fx_eur         = 4.2650", 2))).toBe("fx_eur");
});

test("a caret in ordinary prose names nothing, rather than guessing", () => {
  expect(nameAt(model, at("Services rendered"))).toBeNull();
  expect(nameAt(model, at("Payment terms"))).toBeNull();
});

test("a caret in a note with no block names nothing", () => {
  const plain = build(locate("# Groceries\n\n- milk\n"));
  expect(nameAt(plain, 5)).toBeNull();
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
