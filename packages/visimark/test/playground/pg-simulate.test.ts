import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pgSimulate } from "../../src/playground/pg-simulate.js";
import { FILE_SOURCES, SIMULATION_EXAMPLES } from "../../src/playground/app/sources.js";

const sweep = readFileSync(
  join(import.meta.dir, "../../../../docs/tutorial/runway-sweep.md"),
  "utf8",
);

describe("pgSimulate — `visimark simulate FILE` over one in-memory document", () => {
  test("a document with a report prints its sheet, and says what it asked on stderr", () => {
    const r = pgSimulate(sweep, "runway-sweep.md", { now: () => 0 });
    expect(r.stdout[0]).toBe("==> runway-sweep.md <==");
    expect(r.stdout.some((l) => l.startsWith("#sweep"))).toBe(true);
    expect(r.stderr[0]!.text).toMatch(
      /^simulate: runway-sweep\.md: \d+ questions \(2 lattice params\)$/,
    );
    expect(r.stderr.at(-1)!.text).toBe("simulate: runway-sweep.md: 1 of 1 sheets ran in 0 ms");
    expect(r.stderr.some((l) => l.fault)).toBe(false);
  });

  test("a document with no report statement prints nothing and says so", () => {
    const r = pgSimulate("```vmark #s\nx = 1\n```\n", "a.md", { now: () => 0 });
    expect(r.stdout).toEqual([]);
    expect(r.stderr.at(-1)!.text).toBe("simulate: a.md: no report statement");
  });

  test("the elapsed time comes from the clock it is handed", () => {
    const ticks = [1000, 4400];
    const r = pgSimulate(sweep, "m.md", { now: () => ticks.shift()! });
    expect(r.stderr.at(-1)!.text).toBe("simulate: m.md: 1 of 1 sheets ran in 3.4 s");
  });
});

describe("the bundled simulation examples", () => {
  for (const [name, path] of Object.entries(SIMULATION_EXAMPLES)) {
    test(`${name} is in FILES, exists, and has readings to show`, () => {
      expect(FILE_SOURCES[name]).toBe(path);
      const text = readFileSync(join(import.meta.dir, "../../../../docs", path), "utf8");
      const r = pgSimulate(text, name, { now: () => 0 });
      expect(r.stdout.length).toBeGreaterThan(1);
      expect(r.stderr.some((l) => l.fault)).toBe(false);
    });
  }
});
