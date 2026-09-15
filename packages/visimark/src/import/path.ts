import { type GateSpec, gatePath, type PathResult } from "../fs/gate.js";

/**
 * The declared-input path gate - the read-side face of `fs/gate.ts`, and the
 * counterpart of `artifact/path.ts`'s chart-output gate.
 *
 * Unlike the artifact gate there is no "refuse to overwrite an unmarked file"
 * rule, because nothing is ever written here - and the extension check looks
 * for `.csv`, the only format v1 recognises. See
 * `docs/design/declared-local-data-imports-spec.md` §2.
 */

export type { PathResult };

const IMPORT: GateSpec = { noun: "imported file path", ext: ".csv" };

export function resolveImportPath(docPath: string, url: string): PathResult {
  return gatePath(docPath, url, IMPORT);
}
