import { readMarker, type ArtifactWrite } from "visimark";
import { toVaultPath, type VaultRead } from "./snapshot.js";
import type { VaultWrite } from "./vault.js";

/**
 * v1.1 row 14 — regenerating a chart through the vault write port. Everything
 * that decides *which* charts need writing and *what bytes* to write is the
 * engine's: `artifactsFor(result)` (`write/fmt.ts`) reads it off a
 * `CheckResult` the caller already has. This file is the last step —
 * landing already-rendered bytes at a vault path — the same split
 * `fs/writer.ts`'s module comment draws between the engine (pure, in memory)
 * and a host (the one thing left to do with the result), plus the one piece
 * of policy a host still owns: re-proving the target is safe to write to,
 * right before writing it.
 *
 * **`target` is engine space, not vault space.** `ArtifactWrite.target` comes
 * out of `resolveArtifactPath`/`gatePath` (`fs/gate.ts`), which works in
 * `/`-rooted paths the same way import resolution does — `snapshot.ts`'s
 * module note is the full explanation, and `toVaultPath` is the one function
 * that translates. Using anything but `toVaultPath` here would silently
 * regress the same gap #205 closed on the read side.
 *
 * **Revalidated immediately before each write, not trusted from `check()`'s
 * classification.** `a.state` ("missing" or "stale") describes the target as
 * of the `check()` this note's `CheckResult` came from — which can be a real
 * async gap earlier than the write: `noteFor` awaits a vault read, then
 * (row 14) `writeCharts` itself awaits one vault write per chart, so a
 * `missing` target can become occupied, or a `stale` one can be replaced by
 * an unowned or foreign file, before its own turn comes. `artifact/write.ts`'s
 * `confirmOwnership` re-proves exactly this against a file descriptor on the
 * Node side (`fs/reader.ts`'s TOCTOU argument, applied to writes); a vault has
 * no descriptor to re-open, so this re-reads the target and checks
 * `readMarker` against it instead — the same ownership marker `classify`
 * checks, read straight rather than through a `ReaderPort`.
 *
 * **All-or-nothing, matching `cmdFmt`'s own contract.** The CLI refuses to
 * write the document body at all if any artifact write fails
 * (`cli/commands.ts`), so a partial chart write never gets a repaired total
 * beside it with no explanation. `writeCharts` stops at the first failure —
 * a refused revalidation counts as one — rather than attempting the rest,
 * for the same reason: a caller that wrote three of five charts and silently
 * skipped two has produced a note whose charts disagree with each other
 * about whether this tool works.
 */
export interface ChartWriteResult {
  /** how many charts were written before either finishing or a failure */
  written: number;
  /** the first failure, if any — `writeCharts` stops there */
  failed: { chart: string; err: string } | null;
}

/**
 * `null` clears the refusal (the target is safe to write); a string is the
 * refusal message.
 */
function revalidate(a: ArtifactWrite, current: string | null): string | null {
  if (a.state === "missing") {
    return current === null
      ? null
      : "a file now exists at this chart's target — refusing to overwrite it";
  }
  // "stale": the target must still carry *this* chart's own marker. Anything
  // else — gone, unowned, or belonging to a different sheet/chart — is not
  // the file `check()` classified as stale, whatever is there now.
  const mark = current === null ? null : readMarker(current);
  if (mark === null) {
    return "this chart's target is no longer a VisiMark chart — refusing to overwrite it";
  }
  if (mark.sheet !== a.sheetId || mark.chart !== a.chart) {
    return "this chart's target now belongs to a different chart — refusing to overwrite it";
  }
  return null;
}

export async function writeCharts(
  artifacts: readonly ArtifactWrite[],
  read: VaultRead,
  write: VaultWrite,
): Promise<ChartWriteResult> {
  let written = 0;
  for (const a of artifacts) {
    const path = toVaultPath(a.target);
    const refusal = revalidate(a, await read(path));
    if (refusal !== null) return { written, failed: { chart: a.chart, err: refusal } };
    const result = await write(path, a.svg);
    if ("err" in result) return { written, failed: { chart: a.chart, err: result.err } };
    written++;
  }
  return { written, failed: null };
}
