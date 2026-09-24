import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactsFor, build, check, locate, type ArtifactWrite } from "visimark";
import { onDisk } from "../../../packages/visimark/src/index.js";
import { charts } from "../../../packages/visimark/test/examples.js";
import { writeCharts } from "../src/chart.js";
import { toVaultPath } from "../src/snapshot.js";
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

test("writeCharts writes every artifact's target, translated to vault space", async () => {
  const { artifacts, cleanup } = realArtifacts();
  expect(artifacts.length).toBeGreaterThan(0);
  const { calls, write } = recordingWriter();

  const result = await writeCharts(artifacts, write);

  expect(result).toEqual({ written: artifacts.length, failed: null });
  expect(calls).toEqual(artifacts.map((a) => toVaultPath(a.target)));
  // every call is vault space: no leading slash, matching toVaultPath's contract
  for (const c of calls) expect(c.startsWith("/")).toBe(false);
  cleanup();
});

test("writeCharts stops at the first failure and reports which chart", async () => {
  const { artifacts, cleanup } = realArtifacts();
  expect(artifacts.length).toBeGreaterThan(1);
  const { calls, write } = recordingWriter(1);

  const result = await writeCharts(artifacts, write);

  expect(result.written).toBe(1);
  expect(result.failed).toEqual({ chart: artifacts[1]!.chart, err: "refused" });
  // the third artifact and beyond were never attempted
  expect(calls).toHaveLength(2);
  cleanup();
});

test("writeCharts on an empty list writes nothing and fails nothing", async () => {
  const { calls, write } = recordingWriter();
  const result = await writeCharts([], write);
  expect(result).toEqual({ written: 0, failed: null });
  expect(calls).toEqual([]);
});
