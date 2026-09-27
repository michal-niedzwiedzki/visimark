import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactsFor, build, check, locate, type ArtifactWrite } from "visimark";
import { onDisk } from "../../../packages/visimark/src/index.js";
import { charts } from "../../../packages/visimark/test/examples.js";
import { writeCharts } from "../src/chart.js";
import { toVaultPath, type VaultRead } from "../src/snapshot.js";
import type { VaultWrite } from "../src/vault.js";

/**
 * `example-charts.md`'s real artifacts, all five `missing` — the repo's own
 * copy has its SVGs already committed and current, the same reason
 * `write/fmt.ts`'s own `noArtifacts` test copies the document into a fresh
 * temp directory rather than pointing at the checked-in file. `onDisk` is
 * reached by path rather than through the plugin's browser-safe `visimark`
 * import, the same deliberate exception `snapshot.test.ts` documents, since
 * this file's job is proving `writeCharts` against real `ArtifactWrite`s
 * rather than proving the port stays browser-safe (`bundle.test.ts` already
 * does that).
 */
function realArtifacts(): { artifacts: ArtifactWrite[]; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "vm-obsidian-chart-"));
  const p = join(dir, "example-charts.md");
  writeFileSync(p, charts);
  const doc = onDisk(p);
  const result = check(build(locate(charts)), { doc });
  return {
    artifacts: artifactsFor(result),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** always answers `content` (`null` by default — nothing at the target yet) */
function alwaysReads(content: string | null = null): VaultRead {
  return () => Promise.resolve(content);
}

/** records every write in order; `failAt` makes the call at that index refuse */
function recordingWriter(failAt?: number): { calls: string[]; write: VaultWrite } {
  const calls: string[] = [];
  const write: VaultWrite = (path) => {
    calls.push(path);
    if (failAt !== undefined && calls.length - 1 === failAt) {
      return Promise.resolve({ err: "refused" });
    }
    return Promise.resolve({ ok: true });
  };
  return { calls, write };
}

/** a synthetic chart marker, the same shape artifact/stale.ts's own `marker()` writes */
function markerSvg(sheetId: string, chart: string): string {
  return `<svg><metadata><visimark sheet="${sheetId}" chart="${chart}"/></metadata></svg>`;
}

test("writeCharts writes every artifact's target, translated to vault space", async () => {
  const { artifacts, cleanup } = realArtifacts();
  expect(artifacts.length).toBeGreaterThan(0);
  const { calls, write } = recordingWriter();

  const result = await writeCharts(artifacts, alwaysReads(), write);

  expect(result).toEqual({ written: artifacts.length, failed: null });
  expect(calls).toEqual(artifacts.map((a) => toVaultPath(a.target)));
  // every call is vault space: no leading slash, matching toVaultPath's contract
  for (const c of calls) expect(c.startsWith("/")).toBe(false);
  cleanup();
});

test("writeCharts stops at the first write failure and reports which chart", async () => {
  const { artifacts, cleanup } = realArtifacts();
  expect(artifacts.length).toBeGreaterThan(1);
  const { calls, write } = recordingWriter(1);

  const result = await writeCharts(artifacts, alwaysReads(), write);

  expect(result.written).toBe(1);
  expect(result.failed).toEqual({ chart: artifacts[1]!.chart, err: "refused" });
  // the third artifact and beyond were never attempted
  expect(calls).toHaveLength(2);
  cleanup();
});

test("writeCharts on an empty list writes nothing and fails nothing", async () => {
  const { calls, write } = recordingWriter();
  const result = await writeCharts([], alwaysReads(), write);
  expect(result).toEqual({ written: 0, failed: null });
  expect(calls).toEqual([]);
});

// The revalidation CodeRabbit asked for on #253: `check()`'s classification
// describes the target as of that read, and both `noteFor`'s own await and
// writeCharts' one-write-per-chart loop are real gaps a vault change can land
// in. These tests exercise `revalidate` through `writeCharts`' public surface
// with synthetic artifacts, since `example-charts.md`'s real ones are all
// `missing` and never exercise the `stale` branch at all.

function missingArtifact(chart: string): ArtifactWrite {
  return {
    target: `/${chart}.svg`,
    svg: markerSvg("s", chart),
    path: null,
    state: "missing",
    sheetId: "s",
    chart,
  };
}

function staleArtifact(chart: string): ArtifactWrite {
  return {
    target: `/${chart}.svg`,
    svg: markerSvg("s", chart),
    path: null,
    state: "stale",
    sheetId: "s",
    chart,
  };
}

test("a missing target that has since been occupied is refused, not overwritten", async () => {
  const { write } = recordingWriter();
  const result = await writeCharts(
    [missingArtifact("a")],
    alwaysReads("someone else's file"),
    write,
  );
  expect(result.written).toBe(0);
  expect(result.failed?.chart).toBe("a");
  expect(result.failed?.err).toContain("now exists");
});

test("a stale target whose marker is gone (unowned) is refused, not overwritten", async () => {
  const { write } = recordingWriter();
  const result = await writeCharts(
    [staleArtifact("a")],
    alwaysReads("a hand-drawn SVG, no marker"),
    write,
  );
  expect(result.written).toBe(0);
  expect(result.failed?.chart).toBe("a");
  expect(result.failed?.err).toContain("no longer a VisiMark chart");
});

test("a stale target whose marker names a different chart (foreign) is refused", async () => {
  const { write } = recordingWriter();
  const foreignSvg = markerSvg("s", "other-chart");
  const result = await writeCharts([staleArtifact("a")], alwaysReads(foreignSvg), write);
  expect(result.written).toBe(0);
  expect(result.failed?.chart).toBe("a");
  expect(result.failed?.err).toContain("different chart");
});

test("a stale target whose marker matches is written", async () => {
  const { calls, write } = recordingWriter();
  const ownSvg = markerSvg("s", "a");
  const result = await writeCharts([staleArtifact("a")], alwaysReads(ownSvg), write);
  expect(result).toEqual({ written: 1, failed: null });
  expect(calls).toEqual(["a.svg"]);
});

test("a missing target that is still missing is written", async () => {
  const { calls, write } = recordingWriter();
  const result = await writeCharts([missingArtifact("a")], alwaysReads(null), write);
  expect(result).toEqual({ written: 1, failed: null });
  expect(calls).toEqual(["a.svg"]);
});
