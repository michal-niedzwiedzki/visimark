import { expect, test } from "bun:test";
import {
  applyUnit,
  inferColumnUnit,
  parseDecorated,
  showUnit,
  unitKey,
} from "../../src/eval/units.js";

const num = (t: string) => {
  const d = parseDecorated(t);
  if (d.kind !== "number") throw new Error(`${t} did not parse as a number`);
  return d;
};

test("a bare number has no unit", () => {
  const d = num("5.50");
  expect(d.num).toBe("5.50");
  expect(d.unit).toBeNull();
});

test("a prefix decoration is recognised", () => {
  const d = num("$5.50");
  expect(d.num).toBe("5.50");
  expect(d.unit).toEqual({ text: "$", side: "prefix" });
});

test("a suffix decoration is recognised, with or without a space", () => {
  expect(num("12 N").unit).toEqual({ text: "N", side: "suffix" });
  expect(num("12N").unit).toEqual({ text: "N", side: "suffix" });
  expect(num("3.5 kg").num).toBe("3.5");
});

test("a leading minus binds to the number on either side of the decoration", () => {
  expect(num("-$5.00").num).toBe("-5.00");
  expect(num("-$5.00").unit).toEqual({ text: "$", side: "prefix" });
  expect(num("$-5.00").num).toBe("-5.00");
  expect(num("$-5.00").unit).toEqual({ text: "$", side: "prefix" });
});

test("a multi-character decoration works on either side", () => {
  expect(num("PLN 5.50").unit).toEqual({ text: "PLN", side: "prefix" });
  expect(num("5.50 PLN").unit).toEqual({ text: "PLN", side: "suffix" });
});

test("decoration on both sides is reported, not parsed", () => {
  expect(parseDecorated("$5.50 kg")).toEqual({
    kind: "both-sides",
    pre: "$",
    post: "kg",
  });
});

test("percent is never a unit", () => {
  expect(parseDecorated("23%").kind).toBe("not-a-number");
});

test("an ISO date is not a decorated number", () => {
  expect(parseDecorated("2026-09-03").kind).toBe("not-a-number");
});

test("text with no digits is not a decorated number", () => {
  expect(parseDecorated("hour").kind).toBe("not-a-number");
  expect(parseDecorated("true").kind).toBe("not-a-number");
  expect(parseDecorated("").kind).toBe("not-a-number");
});

test("a thousands separator is not rescued by unit parsing", () => {
  expect(parseDecorated("$1,800.00").kind).toBe("not-a-number");
});

test("applyUnit puts the decoration back where it came from", () => {
  expect(applyUnit("16.50", { text: "$", side: "prefix" })).toBe("$16.50");
  expect(applyUnit("16.50", { text: "PLN", side: "suffix" })).toBe("16.50 PLN");
  expect(applyUnit("16.50", null)).toBe("16.50");
});

test("applyUnit keeps a negative sign in front of a prefix", () => {
  expect(applyUnit("-16.50", { text: "$", side: "prefix" })).toBe("-$16.50");
});

test("unitKey and showUnit distinguish side as well as text", () => {
  expect(unitKey(null)).toBe("(none)");
  expect(unitKey({ text: "$", side: "prefix" })).not.toBe(
    unitKey({ text: "$", side: "suffix" }),
  );
  expect(showUnit(null)).toBe("(none)");
  expect(showUnit({ text: "$", side: "prefix" })).toBe("$");
});

test("a uniformly decorated column takes that unit", () => {
  const r = inferColumnUnit(["$5.50", "$4.00", "$1.25"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toEqual({ text: "$", side: "prefix" });
});

test("a uniformly bare column has no unit and no conflict", () => {
  const r = inferColumnUnit(["5.50", "4.00"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toBeNull();
});

test("mixed currencies conflict, and the tool names both forms", () => {
  const r = inferColumnUnit(["$5.50", "€4.00"]);
  expect(r.conflict).toBe(true);
  expect(r.unit).toBeNull();
  expect(r.forms.sort()).toEqual(["$", "€"]);
  expect(r.firstDeviantRow).toBe(1);
});

test("one bare cell among decorated ones conflicts", () => {
  const r = inferColumnUnit(["$5.50", "4.00", "$1.25"]);
  expect(r.conflict).toBe(true);
  expect(r.forms.sort()).toEqual(["$", "(none)"].sort());
  expect(r.firstDeviantRow).toBe(1);
});

test("the same text on different sides conflicts", () => {
  const r = inferColumnUnit(["PLN 5.50", "4.00 PLN"]);
  expect(r.conflict).toBe(true);
});

test("empty cells and non-numeric cells are ignored", () => {
  const r = inferColumnUnit(["$5.50", "", undefined, "n/a", "$4.00"]);
  expect(r.conflict).toBe(false);
  expect(r.unit).toEqual({ text: "$", side: "prefix" });
});
