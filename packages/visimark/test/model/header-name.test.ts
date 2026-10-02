import { describe, expect, test } from "bun:test";
import { splitHeader, splitHeaderCell } from "../../src/model/header-name.js";
import { locate } from "../../src/parse/document.js";

const split = (source: string) => splitHeader(source, source, 100);

describe("splitHeader", () => {
  test("a trailing bracket is the unit; the stem is the name", () => {
    expect(split("Weight [kg]")).toEqual({
      name: "Weight",
      unit: { text: "kg", start: 107, end: 111 },
    });
  });

  test("whitespace before the bracket is optional", () => {
    expect(split("Distance[m]").name).toBe("Distance");
    expect(split("Distance   [m]").name).toBe("Distance");
  });

  test("a stem that is not one identifier is still the name", () => {
    expect(split("Worker cost [USD/node/month]")).toMatchObject({
      name: "Worker cost",
      unit: { text: "USD/node/month" },
    });
  });

  test("an emphasised stem names its inner text", () => {
    expect(split("**Weight** [kg]").name).toBe("Weight");
    expect(split("`Weight` [kg]").name).toBe("Weight");
  });

  test.each([
    ["Revenue \\[1\\]", "escaped"],
    ["Note [^1]", "footnote"],
    ["Price [USD][ref]", "reference link"],
    ["[x](https://example.com)", "inline link"],
    ["Bandwidth per Unit (TB/s, full-duplex)", "parentheses"],
    ["Plain", "no bracket"],
  ])("%s has no unit clause (%s)", (source) => {
    expect(split(source)).toEqual({ name: source, unit: null });
  });

  test("a header that is only a bracket has no name", () => {
    expect(split("[kg]")).toMatchObject({
      name: null,
      error: { message: "a header needs a name before its unit" },
    });
  });

  test("two unit clauses are refused", () => {
    expect(split("Speed [m] [s]")).toMatchObject({
      name: "Speed [m]",
      unit: null,
      error: { message: "a header has one unit clause" },
    });
  });

  test("a malformed bracket is still split; parsing it is the caller's", () => {
    expect(split("Revenue [1]")).toMatchObject({ name: "Revenue", unit: { text: "1" } });
  });
});

describe("splitHeaderCell", () => {
  test("reads the whole cell, past its first inline node", () => {
    const src = "| **Weight** [kg] | Count |\n|---|---|\n| 1 | 2 |\n";
    const doc = locate(src);
    const [w, c] = doc.tables[0]!.headers;
    expect(splitHeaderCell(w!, src)).toMatchObject({ name: "Weight", unit: { text: "kg" } });
    expect(splitHeaderCell(c!, src)).toEqual({ name: "Count", unit: null });
  });
});
