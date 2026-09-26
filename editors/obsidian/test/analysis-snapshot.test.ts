import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyse, analyseWithSnapshot } from "../src/analysis.js";
import type { VaultRead } from "../src/snapshot.js";

/**
 * Review row 6, reproduced and closed. `benchmark.csv`'s `Time` column
 * averages to 12.4667 (rounds to 12.47); this note asserts an anchor of
 * `1.00`, so a check that actually reads the CSV must call it `disagrees`.
 * The reader-less `analyse` cannot: it never read the file, so it reports no
 * findings at all and marks the value `computed` — which is exactly the "1 to
 * look at, but the value on screen looks fine" bug the review found. This is
 * the regression test for the fix: every renderer now decorates from
 * `analyseWithSnapshot`, never from `analyse` alone, for a value the snapshot
 * can actually check.
 */

const fixtures = resolve(import.meta.dir, "../../../packages/visimark/test/fixtures/import");
const csv = readFileSync(join(fixtures, "benchmark.csv"), "utf8");

function vaultOf(entries: Record<string, string>): VaultRead {
  const files = new Map(Object.entries(entries));
  return (p) => Promise.resolve(files.get(p) ?? null);
}

const source =
  "```vmark #benchmark from benchmark.csv labelled Id, Time at sha256:c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee\n" +
  "Mean precision 2 = AVG(benchmark.Time)\n" +
  "```\n" +
  "\n" +
  "The mean is **1.00**<!--vmark=benchmark.Mean-->.\n";

test("the reader-less analysis wrongly calls a disagreeing imported value computed", () => {
  // this is the bug, pinned so a future refactor can't quietly reintroduce it
  // by routing a renderer back through `analyse` for an imported value
  const { result, decorations } = analyse(source);
  expect(result.findings.some((f) => f.code === "STALE")).toBe(false);
  const mark = decorations.find((d) => d.name === "benchmark.Mean");
  expect(mark?.mark).toBe("computed");
});

test("the snapshot-backed analysis calls the same value disagrees", async () => {
  const read = vaultOf({ "benchmark.csv": csv });
  const { result, decorations, report } = await analyseWithSnapshot(source, "note.md", read);
  expect(result.findings.some((f) => f.code === "STALE")).toBe(true);
  const mark = decorations.find((d) => d.name === "benchmark.Mean");
  expect(mark?.mark).toBe("disagrees");
  expect(report.problems.length).toBeGreaterThan(0);
});

test("concurrent calls for the same (path, source) share one fetch", async () => {
  // a source and path of its own — an earlier test's cache entry for
  // ("note.md", source) must not silently answer this one
  const own = `${source}\n<!-- test: concurrent -->\n`;
  const countingRead = (): { read: VaultRead; calls: () => number } => {
    let calls = 0;
    return {
      calls: () => calls,
      read: async (p) => {
        calls++;
        return p === "benchmark.csv" ? csv : null;
      },
    };
  };

  // what one call alone costs — `vaultSnapshot`'s own fixed-point discovery
  // may fetch more than once per analysis; that is snapshot.ts's business,
  // not this test's
  const solo = countingRead();
  await analyseWithSnapshot(own, "concurrent-note.md", solo.read);
  const soloCalls = solo.calls();

  const together = countingRead();
  const [a, b, c] = await Promise.all([
    analyseWithSnapshot(`${own}\nalt\n`, "concurrent-note-2.md", together.read),
    analyseWithSnapshot(`${own}\nalt\n`, "concurrent-note-2.md", together.read),
    analyseWithSnapshot(`${own}\nalt\n`, "concurrent-note-2.md", together.read),
  ]);
  expect(b).toBe(a);
  expect(c).toBe(a);
  // three concurrent callers cost exactly what one costs — the second and
  // third never start a fetch of their own
  expect(together.calls()).toBe(soloCalls);
});

test("a different path for the same source text is a different snapshot", async () => {
  const own = `${source}\n<!-- test: different-path -->\n`;
  const read = vaultOf({ "benchmark.csv": csv, "other/benchmark.csv": csv });
  const a = await analyseWithSnapshot(own, "path-a-note.md", read);
  const b = await analyseWithSnapshot(own, "path-b-note.md", read);
  expect(b).not.toBe(a);
});

test("a failed read does not poison later calls to the same (path, source)", async () => {
  // a source string of its own, so this test's cache key can't be answered
  // by a promise an earlier test already resolved for (path, source)
  const own = `${source}\n<!-- test: failed-read -->\n`;
  let fail = true;
  const read: VaultRead = async (p) => {
    if (fail) throw new Error("vault unavailable");
    return p === "benchmark.csv" ? csv : null;
  };
  await expect(analyseWithSnapshot(own, "failed-read-note.md", read)).rejects.toThrow();
  fail = false;
  const { result } = await analyseWithSnapshot(own, "failed-read-note.md", read);
  expect(result.findings.some((f) => f.code === "STALE")).toBe(true);
});

test("a settled successful call does not answer from a stale cache later", async () => {
  // CodeRabbit review of PR #265: a successful result must not outlive its
  // own fetch either, or a later change to the imported CSV (the note's own
  // source text unchanged) could never be seen — `benchmark.csv`'s Mean
  // stays 12.47 the first time and drops to 11.00 the second
  const own = `${source}\n<!-- test: success-eviction -->\n`;
  let value = "12.3,10.1,15.0";
  const read: VaultRead = async (p) =>
    p === "benchmark.csv"
      ? `Id,Time\n1,${value.split(",")[0]}\n2,${value.split(",")[1]}\n3,${value.split(",")[2]}\n`
      : null;

  const first = await analyseWithSnapshot(own, "eviction-note.md", read);
  const firstStale = first.decorations.find((d) => d.name === "benchmark.Mean");
  expect(firstStale?.mark).toBe("disagrees");

  value = "1.00,1.00,1.00"; // now the CSV would make Mean == the anchored 1.00
  const second = await analyseWithSnapshot(own, "eviction-note.md", read);
  expect(second).not.toBe(first); // the settled first call was evicted, not reused
  const secondMark = second.decorations.find((d) => d.name === "benchmark.Mean");
  expect(secondMark?.mark).toBe("computed");
});
