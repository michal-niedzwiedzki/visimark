import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { passCache, runPass } from "../src/pass.js";

const repo = join(import.meta.dir, "..", "..", "..");
const csvDoc = join(repo, "docs", "example-invoice-csv-import.md");
const csvSource = readFileSync(csvDoc, "utf8");
const disk = (p: string): string | null => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

test("no path or no reader: check runs without a doc and import-dependent names are withheld", () => {
  for (const [path, reader] of [
    [null, disk],
    [csvDoc, undefined],
  ] as const) {
    const pass = runPass(csvSource, path, reader);
    expect(pass.result.findings.filter((f) => f.code === "IMPORT")).toEqual([]);
    expect(pass.withheld.size).toBeGreaterThan(0);
  }
});

test("path and reader: imports resolve through the gate and nothing is withheld", () => {
  const asked: string[] = [];
  const pass = runPass(csvSource, csvDoc, (p) => {
    asked.push(p);
    return disk(p);
  });
  expect(pass.result.findings).toEqual([]);
  expect(pass.withheld.size).toBe(0);
  // the reader is called with the absolute, gated path, once per path
  for (const p of asked) expect(p.startsWith(dirname(resolve(csvDoc)))).toBe(true);
  expect(new Set(asked).size).toBe(asked.length);
});

test("a reader that returns null yields IMPORT and withholds every import-dependent name", () => {
  const pass = runPass(csvSource, csvDoc, () => null);
  expect(pass.result.findings.some((f) => f.code === "IMPORT")).toBe(true);
  expect(pass.withheld.size).toBeGreaterThan(0);
});

test("the cache holds one entry keyed on (source, path)", () => {
  let reads = 0;
  const get = passCache((p) => {
    reads++;
    return disk(p);
  });
  const a = get(csvSource, csvDoc);
  expect(get(csvSource, csvDoc)).toBe(a);
  const afterFirst = reads;
  expect(afterFirst).toBeGreaterThan(0);
  get(csvSource, csvDoc);
  expect(reads).toBe(afterFirst);
  expect(get(csvSource, null)).not.toBe(a);
  expect(get(csvSource + "\n", csvDoc)).not.toBe(a);
  expect(get(csvSource, csvDoc)).not.toBe(a); // the single entry was replaced
});
