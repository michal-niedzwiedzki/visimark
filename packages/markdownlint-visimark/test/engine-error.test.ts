import { afterEach, expect, mock, test } from "bun:test";
import * as real from "visimark";
import { findingsFor, parseCount, resetFindingsCache } from "../src/findings.js";

const realAnalyze = real.analyze;

afterEach(() => {
  // mock.restore() does not undo mock.module(); explicitly re-mock the real
  // implementation, captured above by value before any test mocked it.
  mock.module("visimark", () => ({ ...real, analyze: realAnalyze }));
  resetFindingsCache();
});

test("an analyze() failure is cached like a success — one call, not one per rule", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw new Error("boom");
    },
  }));
  resetFindingsCache();
  const first = findingsFor("anything");
  const second = findingsFor("anything");
  expect(first).toEqual({ ok: false, message: "boom" });
  expect(second).toEqual({ ok: false, message: "boom" });
  expect(parseCount()).toBe(1);
});

test("an analyze() failure of a non-Error value still produces a readable message", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw "boom";
    },
  }));
  resetFindingsCache();
  expect(findingsFor("anything")).toEqual({ ok: false, message: "boom" });
});

test("a document that fails does not poison a different document linted after it", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: (source: string) => {
      if (source === "broken") throw new Error("boom");
      return realAnalyze(source);
    },
  }));
  resetFindingsCache();
  expect(findingsFor("broken")).toEqual({ ok: false, message: "boom" });
  const cleanResult = findingsFor("# Notes\n\nNothing to check here.\n");
  expect(cleanResult.ok && cleanResult.findings).toHaveLength(0);
});
