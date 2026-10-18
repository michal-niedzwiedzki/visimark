import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RULES } from "../src/rules/registry.js";
import { FIXTURES, fixture, runRule } from "./support.js";

// Every rule ships with a good and a bad example, and the bad one's findings
// are pinned. A rule added to the registry without its folder fails here.
describe("rule fixtures", () => {
  for (const rule of RULES) {
    describe(rule.id, () => {
      test("has good.md, bad.md and bad.expected.json", () => {
        for (const f of ["good.md", "bad.md", "bad.expected.json"]) {
          expect(existsSync(join(FIXTURES, rule.id, f))).toBe(true);
        }
      });

      test("good.md gives no finding", () => {
        expect(runRule(rule, "good.md", fixture(rule.id, "good.md")).shaped).toEqual([]);
      });

      test("bad.md gives bad.expected.json", () => {
        const expected = JSON.parse(fixture(rule.id, "bad.expected.json"));
        expect(runRule(rule, "bad.md", fixture(rule.id, "bad.md")).shaped).toEqual(expected);
      });
    });
  }
});
