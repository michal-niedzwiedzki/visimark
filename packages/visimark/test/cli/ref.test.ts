import { expect, test } from "bun:test";
import { runCli } from "../../src/cli/main.js";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

test("ref with no name lists every function", async () => {
  const c = capture();
  expect(await runCli(["ref"], c.io)).toBe(0);
  expect(c.out()).toContain("EOMONTH");
  expect(c.out()).toContain("SUM");
});

test("ref NAME prints the entry", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH"], c.io)).toBe(0);
  const text = c.out();
  expect(text).toContain("EOMONTH(d, months)");
  expect(text).toContain("map, 2 arguments");
  expect(text).toContain("a non-whole `months`");
  expect(text).toContain("EOMONTH(2026-01-31, 1)");
});

test("ref reads no file and needs none", async () => {
  const c = capture();
  expect(await runCli(["ref", "SUM"], c.io)).toBe(0);
  expect(c.err()).toBe("");
});

test("an unknown name exits 2 with a suggestion", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH2"], c.io)).toBe(2);
  expect(c.err()).toContain("EOMONTH");
});

test("a name unlike anything builtin gets no misleading guess", async () => {
  const c = capture();
  expect(await runCli(["ref", "ZZZZZZZZ"], c.io)).toBe(2);
  expect(c.err()).not.toContain("did you mean");
});

test("ref --json emits the structured envelope", async () => {
  const c = capture();
  expect(await runCli(["ref", "EOMONTH", "--json"], c.io)).toBe(0);
  const doc = JSON.parse(c.out());
  expect(doc.command).toBe("ref");
  expect(doc.status).toBe("ok");
  expect(typeof doc.visimark).toBe("string");
  expect(doc.function.name).toBe("EOMONTH");
  expect(doc.function.signature).toBe("EOMONTH(d, months)");
  expect(doc.function.errors).toContainEqual({ when: "a non-whole `months`", code: "TYPE" });
});

test("ref --json with no name lists every function", async () => {
  const c = capture();
  expect(await runCli(["ref", "--json"], c.io)).toBe(0);
  expect(JSON.parse(c.out()).functions).toHaveLength(13);
});

test("ref --json on an unknown name emits the error envelope", async () => {
  const c = capture();
  expect(await runCli(["ref", "NOPE", "--json"], c.io)).toBe(2);
  const doc = JSON.parse(c.out());
  expect(doc.status).toBe("error");
  expect(doc.error.code).toBe("USAGE");
});

test("an unrecognised flag is ignored, as elsewhere in the CLI", async () => {
  const c = capture();
  expect(await runCli(["ref", "SUM", "--jsonn"], c.io)).toBe(0);
  expect(c.out()).toContain("SUM(col)");
});

// A `PRECISION` finding sends the author to `visimark ref` to find out why a
// width has to be declared. Before precision was a documented property of a
// function, `ref AVG` answered every question except that one.
test("ref states where a function's result gets its width", async () => {
  const c = capture();
  expect(await runCli(["ref", "AVG"], c.io)).toBe(0);
  expect(c.out()).toContain("precision  must be declared");
});

test("ref tells apart a width taken from an argument's value and from its width", async () => {
  const round = capture();
  await runCli(["ref", "ROUND"], round.io);
  expect(round.out()).toContain("precision  the value of `places`");

  const floor = capture();
  await runCli(["ref", "FLOOR"], floor.io);
  expect(floor.out()).toContain("precision  the width of `s`");
});

test("rounding is reported separately from width, and only where it exists", async () => {
  const round = capture();
  await runCli(["ref", "ROUND"], round.io);
  expect(round.out()).toContain("rounding   Ties round away from zero");

  const sum = capture();
  await runCli(["ref", "SUM"], sum.io);
  expect(sum.out()).not.toContain("rounding");
});

test("ref --json carries the precision rule as data, not only as prose", async () => {
  const c = capture();
  expect(await runCli(["ref", "FLOOR", "--json"], c.io)).toBe(0);
  expect(JSON.parse(c.out()).function.precision).toEqual({
    from: "argument-scale",
    param: "s",
    text: "the width of `s`",
  });
});

test("every function in ref --json states a precision rule", async () => {
  const c = capture();
  expect(await runCli(["ref", "--json"], c.io)).toBe(0);
  for (const f of JSON.parse(c.out()).functions) {
    expect([f.name, typeof f.precision?.from]).toEqual([f.name, "string"]);
  }
});
