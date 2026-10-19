import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// The playground's `pgSimulate` is engine code (packages/visimark/test/browser/
// pg-simulate.test.ts tests it), not a `visimark` export. This test reaches it
// by path because what it checks is the site's list of examples.
import { pgSimulate } from "../../../packages/visimark/src/browser/pg-simulate.js";
import { FILE_SOURCES, SIMULATION_EXAMPLES } from "../../src/playground/sources.js";

describe("the bundled simulation examples", () => {
  for (const [name, path] of Object.entries(SIMULATION_EXAMPLES)) {
    test(`${name} is in FILES, exists, and has readings to show`, () => {
      expect(FILE_SOURCES[name]).toBe(path);
      const text = readFileSync(join(import.meta.dir, "../../../docs", path), "utf8");
      const r = pgSimulate(text, name, { now: () => 0 });
      expect(r.stdout.length).toBeGreaterThan(1);
      expect(r.stderr.some((l) => l.fault)).toBe(false);
    });
  }
});
