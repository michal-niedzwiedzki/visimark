import type { ArtifactWrite } from "visimark";
import { toVaultPath } from "./snapshot.js";
import type { VaultWrite } from "./vault.js";

/**
 * v1.1 row 14 — regenerating a chart through the vault write port. Everything
 * that decides *which* charts need writing and *what bytes* to write is the
 * engine's: `artifactsFor(result)` (`write/fmt.ts`) reads it off a
 * `CheckResult` the caller already has. This file is only the last step —
 * landing already-rendered bytes at a vault path — the same split
 * `fs/writer.ts`'s module comment draws between the engine (pure, in memory)
 * and a host (the one thing left to do with the result).
 *
 * **`target` is engine space, not vault space.** `ArtifactWrite.target` comes
 * out of `resolveArtifactPath`/`gatePath` (`fs/gate.ts`), which works in
 * `/`-rooted paths the same way import resolution does — `snapshot.ts`'s
 * module note is the full explanation, and `toVaultPath` is the one function
 * that translates. Using anything but `toVaultPath` here would silently
 * regress the same gap #205 closed on the read side.
 *
 * **All-or-nothing, matching `cmdFmt`'s own contract.** The CLI refuses to
 * write the document body at all if any artifact write fails
 * (`cli/commands.ts`), so a partial chart write never gets a repaired total
 * beside it with no explanation. `writeCharts` stops at the first failure
 * rather than attempting the rest, for the same reason: a caller that wrote
 * three of five charts and silently skipped two has produced a note whose
 * charts disagree with each other about whether this tool works.
 */
export interface ChartWriteResult {
  /** how many charts were written before either finishing or a failure */
  written: number;
  /** the first failure, if any — `writeCharts` stops there */
  failed: { chart: string; err: string } | null;
}

export async function writeCharts(
  artifacts: readonly ArtifactWrite[],
  write: VaultWrite,
): Promise<ChartWriteResult> {
  let written = 0;
  for (const a of artifacts) {
    const result = await write(toVaultPath(a.target), a.svg);
    if ("err" in result) return { written, failed: { chart: a.chart, err: result.err } };
    written++;
  }
  return { written, failed: null };
}
