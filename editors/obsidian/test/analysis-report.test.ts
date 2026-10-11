import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyseWithSnapshot } from "../src/analysis.js";
import type { VaultRead } from "../src/snapshot.js";

/**
 * The findings view's report rides on the package's snapshot analysis
 * (#360): `codemirror-visimark` computes the check, the plugin adds the
 * audience-B report on top, once per fetch.
 */

const fixtures = resolve(import.meta.dir, "../../../packages/visimark/test/fixtures/import");
const csv = readFileSync(join(fixtures, "benchmark.csv"), "utf8");
const read: VaultRead = (p) => Promise.resolve(p === "benchmark.csv" ? csv : null);

const source =
  "```vmark #benchmark from benchmark.csv labelled Id, Time at sha256:c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee\n" +
  "Mean precision 2 = AVG(benchmark.Time)\n" +
  "```\n" +
  "\n" +
  "The mean is **1.00**<!--vmark=benchmark.Mean-->.\n";

test("the snapshot analysis carries the findings view's report", async () => {
  const { result, report } = await analyseWithSnapshot(source, "note.md", read);
  expect(result.findings.some((f) => f.code === "STALE")).toBe(true);
  expect(report.problems.length).toBeGreaterThan(0);
});

test("concurrent callers for one note share one report", async () => {
  const own = `${source}\n<!-- test: shared report -->\n`;
  const [a, b] = await Promise.all([
    analyseWithSnapshot(own, "note.md", read),
    analyseWithSnapshot(own, "note.md", read),
  ]);
  expect(a.report).toBe(b.report);
});
