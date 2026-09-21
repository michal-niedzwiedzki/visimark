import { expect, test, describe } from "bun:test";
import { generateAliasName, proposeAliases } from "../../src/infer/aliases.js";
import type { InferSheet } from "../../src/infer/context.js";

const sheetWithHeaders = (names: string[], over: Partial<InferSheet> = {}): InferSheet => ({
  id: "s",
  minted: false,
  table: {
    headers: names.map((text) => ({ text, start: 0, end: 0 })),
    rows: [],
    span: { start: 0, end: 0 },
  },
  block: null,
  index: new Map(names.map((n, i) => [n, i])),
  numeric: [],
  managed: new Set(),
  aliasedHeaders: new Set(),
  filled: new Map(),
  constant: new Set(),
  ...over,
});

describe("the generated name", () => {
  test("generates an acronym from non-stopword tokens, lowercased", () => {
    expect(generateAliasName("Bandwidth per Unit (TB/s, full-duplex)")).toBe("butsfd");
  });

  test("drops a fixed, closed stopword list", () => {
    expect(generateAliasName("Rate of the Discount")).toBe("rd");
  });

  test("prefixes an underscore when the result would start with a digit", () => {
    expect(generateAliasName("3D Printer Cost")).toMatch(/^_/);
  });

  test("prefixes an underscore when nothing survives the stopword list", () => {
    expect(generateAliasName("of the")).toBe("_");
  });
});

describe("which headers get a proposal", () => {
  test("a header already reachable as an identifier gets no alias proposal", () => {
    expect(proposeAliases(sheetWithHeaders(["Net", "Qty"]), new Set())).toEqual([]);
  });

  test("a non-identifier header gets one", () => {
    const [p] = proposeAliases(sheetWithHeaders(["Unit Price"]), new Set());
    expect(p!.kind).toBe("alias");
    expect(p!.name).toBe("up");
    expect(p!.header).toBe("Unit Price");
    expect(p!.rule).toBe(`"Unit Price" is up`);
  });

  test("a header that already carries a rule is skipped", () => {
    const sheet = sheetWithHeaders(["Unit Price"], { managed: new Set(["Unit Price"]) });
    expect(proposeAliases(sheet, new Set())).toEqual([]);
  });

  test("a header that already carries an alias is skipped", () => {
    const sheet = sheetWithHeaders(["Unit Price"], { aliasedHeaders: new Set(["Unit Price"]) });
    expect(proposeAliases(sheet, new Set())).toEqual([]);
  });

  test("a collision with an existing name falls back to no proposal", () => {
    expect(proposeAliases(sheetWithHeaders(["Net Total"]), new Set(["nt"]))).toEqual([]);
  });

  test("two headers that generate the same name yield one proposal, not two", () => {
    const ps = proposeAliases(sheetWithHeaders(["Net Total", "New Term"]), new Set());
    expect(ps.map((p) => p.header)).toEqual(["Net Total"]);
  });

  test("a header containing a literal quote gets no alias proposal", () => {
    // A `"` inside the header can never be legally quoted — the lexer's
    // string-literal grammar has no escape sequence — so proposing an alias
    // rule for it would be unparseable (spec §7).
    expect(proposeAliases(sheetWithHeaders(['Length ("inch")']), new Set())).toEqual([]);
  });
});
