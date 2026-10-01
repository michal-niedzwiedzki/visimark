import { describe, expect, test } from "bun:test";
import {
  divUnits,
  expandUnit,
  formatUnit,
  halveUnit,
  isDimensionless,
  mulUnits,
  parseUnit,
  powUnit,
  sameUnit,
  showUnitMap,
  type UnitDefs,
  type UnitMap,
  unitJson,
} from "../../src/lang/unit-expr.js";

function map(text: string): UnitMap {
  const r = parseUnit(text);
  if (!r.ok) throw new Error(r.message);
  return r.map;
}

function message(text: string): string {
  const r = parseUnit(text);
  if (r.ok) throw new Error(`expected [${text}] to fail`);
  return r.message;
}

describe("parseUnit — accepted", () => {
  test.each([
    ["kg", { kg: 1 }],
    ["USD", { USD: 1 }],
    ["µg", { µg: 1 }],
    ["Ω", { Ω: 1 }],
    ["percent", { percent: 1 }],
    ["m/s", { m: 1, s: -1 }],
    ["USD/node/month", { USD: 1, month: -1, node: -1 }],
    ["kg⋅m^2/s^2", { kg: 1, m: 2, s: -2 }],
    ["kg*m²/s²", { kg: 1, m: 2, s: -2 }],
    ["N·m", { N: 1, m: 1 }],
    ["N×m", { N: 1, m: 1 }],
    ["kg ⋅ m / s", { kg: 1, m: 1, s: -1 }],
    ["1/s", { s: -1 }],
    ["m³", { m: 3 }],
    ["m^12", { m: 12 }],
    ["PLN/EUR", { EUR: -1, PLN: 1 }],
    ["  kg  ", { kg: 1 }],
  ])("[%s]", (text, expected) => {
    expect(unitJson(map(text))).toEqual(expected);
  });

  test("temperature atoms have one canonical spelling each", () => {
    for (const t of ["degC", "°C", "℃"]) expect(unitJson(map(t))).toEqual({ "℃": 1 });
    for (const t of ["degF", "°F", "℉"]) expect(unitJson(map(t))).toEqual({ "℉": 1 });
    expect(sameUnit(map("degC"), map("°C"), new Map())).toBe(true);
  });

  test("atoms are case-sensitive and opaque", () => {
    expect(sameUnit(map("kg"), map("Kg"), new Map())).toBe(false);
    expect(sameUnit(map("kg"), map("kilogram"), new Map())).toBe(false);
  });

  test("an atom led by ° is one atom", () => {
    expect(unitJson(map("°K"))).toEqual({ "°K": 1 });
  });
});

describe("parseUnit — refused, with the spec §4 message", () => {
  test.each([
    ["", "[] declares no unit"],
    ["1", "[1] declares no unit"],
    ["node/node", "[node/node] declares no unit"],
    ["100km", "[100km] is not a unit — an atom is letters only"],
    ["km2", "[km2] is not a unit — an atom is letters only"],
    ["$", "[$] is not a unit — an atom is letters only"],
    ["N m", "[N m] is not a unit — write a product as N⋅m"],
    ["kg m/s", "[kg m/s] is not a unit — write a product as kg⋅m/s"],
    ["a/b⋅c", "[a/b⋅c] is ambiguous — write a⋅c/b or a/b/c"],
    ["%", "[%] is not a unit — % is number syntax (23% is 0.23); drop the bracket"],
    ["m^0", "[m^0] is not a unit — an exponent is a positive integer"],
    ["m/", "[m/] is not a unit — an atom is letters only"],
    ["°", "[°] is not a unit — an atom is letters only"],
  ])("[%s]", (text, expected) => {
    expect(message(text)).toBe(expected);
  });
});

describe("map algebra", () => {
  test("products add exponents and cancel to nothing", () => {
    expect(formatUnit(mulUnits(map("m"), map("m")))).toBe("m²");
    expect(formatUnit(mulUnits(map("USD/node/month"), map("node")))).toBe("USD/month");
    expect(isDimensionless(divUnits(map("PLN"), map("PLN")))).toBe(true);
  });

  test("a rate divides out", () => {
    expect(formatUnit(divUnits(map("PLN"), map("PLN/EUR")))).toBe("EUR");
    expect(formatUnit(mulUnits(map("PLN"), map("PLN/EUR")))).toBe("PLN²/EUR");
  });

  test("powers and roots", () => {
    expect(formatUnit(powUnit(map("m"), 3))).toBe("m³");
    expect(isDimensionless(powUnit(map("m"), 0))).toBe(true);
    expect(formatUnit(halveUnit(map("m^2"))!)).toBe("m");
    expect(halveUnit(map("m"))).toBeNull();
  });

  test("kg⋅m/s/s equals kg⋅m/s²", () => {
    expect(sameUnit(map("kg⋅m/s/s"), map("kg⋅m/s^2"), new Map())).toBe(true);
  });

  test("definitions expand, recursively, before comparison", () => {
    const defs: UnitDefs = new Map([
      ["J", map("N⋅m")],
      ["W", map("J/s")],
    ]);
    expect(sameUnit(map("J"), map("N⋅m"), defs)).toBe(true);
    expect(sameUnit(map("W"), map("N⋅m/s"), defs)).toBe(true);
    expect(sameUnit(map("J"), map("N⋅m"), new Map())).toBe(false);
    expect(formatUnit(expandUnit(map("W^2"), defs))).toBe("N²⋅m²/s²");
  });
});

describe("formatUnit", () => {
  test.each([
    ["kg*m^2/s^2", "kg⋅m²/s²"],
    ["node⋅USD/month", "USD⋅node/month"],
    ["USD/node/month", "USD/month/node"],
    ["m⋅N", "N⋅m"],
    ["1/s", "1/s"],
    ["EUR", "EUR"],
    ["degC", "℃"],
    ["°F", "℉"],
  ])("[%s] prints %s", (text, expected) => {
    expect(formatUnit(map(text))).toBe(expected);
  });

  test("the empty map prints as dimensionless where a word is needed", () => {
    expect(formatUnit(new Map())).toBe("");
    expect(showUnitMap(new Map())).toBe("dimensionless");
  });

  test("JSON keys are in code-point order", () => {
    expect(Object.keys(unitJson(map("s⋅kg⋅USD")))).toEqual(["USD", "kg", "s"]);
  });
});
