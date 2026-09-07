import { expect, test } from "bun:test";
import { Decimal } from "decimal.js";
import { buildArtifact, type EngineInput, engineNames } from "../../src/artifact/index.js";
import { greys, niceTicks, viewHeight, advance } from "../../src/artifact/svg.js";

const S = (name: string, nums: number[], precision = 2) => ({
  name,
  values: nums.map((n) => new Decimal(n)),
  unit: null,
  precision,
});
const input = (over: Partial<EngineInput> = {}): EngineInput => ({
  series: [S("Net", [20, 15])],
  labels: ["pen", "paper"],
  aspect: { w: 16, h: 10 },
  ...over,
});
const id = { sheetId: "s", chart: "c" };

test("greys: single series is mid grey", () => {
  expect(greys(1)).toEqual(["#808080"]);
});

test("greys: three steps span the restricted band", () => {
  expect(greys(3)).toEqual(["#333333", "#808080", "#cccccc"]);
});

test("greys: endpoints never reach white or black", () => {
  for (const n of [2, 4, 5, 8]) {
    const g = greys(n);
    expect(g[0]).toBe("#333333");
    expect(g[g.length - 1]).toBe("#cccccc");
    expect(g).toHaveLength(n);
  }
});

test("viewHeight follows the aspect ratio", () => {
  expect(viewHeight({ w: 16, h: 10 })).toBe(400);
  expect(viewHeight({ w: 16, h: 9 })).toBe(360);
  expect(viewHeight({ w: 1, h: 1 })).toBe(640);
});

test("advance is exact monospace arithmetic", () => {
  expect(advance("abcd", 10)).toBeCloseTo(24, 10);
});

test("niceTicks always spans zero and uses 1/2/5 steps", () => {
  expect(niceTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
  const neg = niceTicks(-40, 80);
  expect(neg).toContain(0);
  expect(neg[0]).toBeLessThanOrEqual(-40);
});

test("both engines are registered and nothing else is", () => {
  expect(engineNames()).toContain("pie");
  expect(engineNames()).toContain("bar");
});

test("pie: renders, is byte-stable, and carries the marker", () => {
  const a = buildArtifact("pie", input(), id);
  const b = buildArtifact("pie", input(), id);
  expect(a).toEqual(b);
  if ("err" in a) throw new Error(a.err);
  expect(a.svg).toContain('<visimark sheet="s" chart="c"/>');
  expect(a.svg).toContain("viewBox=\"0 0 640 400\"");
  expect(a.svg).toContain("57.1%");
  expect(a.svg).toContain("42.9%");
});

test("pie: a single row is one full circle, not a degenerate arc", () => {
  const r = buildArtifact("pie", input({ series: [S("Net", [7])], labels: ["only"] }), id);
  if ("err" in r) throw new Error(r.err);
  expect(r.svg).toContain("<circle");
  expect(r.svg).toContain("100.0%");
});

test("pie: a negative value is refused, naming the row", () => {
  const r = buildArtifact("pie", input({ series: [S("Net", [5, -3])] }), id);
  expect(r).toEqual({ err: "pie of `Net` contains a negative value (-3.00, row 2)" });
});

test("pie: a zero sum is refused", () => {
  const r = buildArtifact("pie", input({ series: [S("Net", [0, 0])] }), id);
  expect(r).toEqual({ err: "pie of `Net` sums to zero" });
});

test("pie: more than one series is refused", () => {
  const r = buildArtifact("pie", input({ series: [S("A", [1]), S("B", [2])] }), id);
  expect(r).toEqual({ err: "a pie takes one series" });
});

test("bar: single series renders with no legend", () => {
  const r = buildArtifact("bar", input(), id);
  if ("err" in r) throw new Error(r.err);
  expect(r.svg).toContain("<rect");
  expect(r.svg).toContain("pen");
  // the only rects are the bars themselves
  expect(r.svg.match(/<rect/g)).toHaveLength(2);
});

test("bar: multiple series draw a legend swatch each", () => {
  const r = buildArtifact(
    "bar",
    input({ series: [S("Rev", [10, 20]), S("Cost", [4, 9])], labels: ["Jan", "Feb"] }),
    id,
  );
  if ("err" in r) throw new Error(r.err);
  expect(r.svg).toContain("Rev");
  expect(r.svg).toContain("Cost");
  // 4 bars + 2 legend swatches
  expect(r.svg.match(/<rect/g)).toHaveLength(6);
});

test("bar: negative values are legal and cross the baseline", () => {
  const r = buildArtifact("bar", input({ series: [S("Net", [10, -5])] }), id);
  expect("err" in r).toBe(false);
});

test("bar: an explicit aspect changes the viewBox height", () => {
  const r = buildArtifact("bar", input({ aspect: { w: 16, h: 9 } }), id);
  if ("err" in r) throw new Error(r.err);
  expect(r.svg).toContain('viewBox="0 0 640 360"');
});

test("units are carried into value labels", () => {
  const r = buildArtifact(
    "pie",
    input({ series: [{ ...S("Net", [20, 15]), unit: { text: "$", side: "prefix" as const } }] }),
    id,
  );
  if ("err" in r) throw new Error(r.err);
  expect(r.svg).toContain("$20.00");
});
