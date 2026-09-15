import { type GateSpec, gatePath, type PathResult } from "../fs/gate.js";

/**
 * The artifact path gate - the write-side face of `fs/gate.ts`.
 *
 * The gate stops a hostile or careless path. It is not the only safeguard: the
 * caller additionally refuses to overwrite any file that does not carry
 * VisiMark's own metadata marker, which is what protects a hand-drawn SVG.
 * That rule lives in the caller because it is about a file's provenance, not
 * its path.
 */

export type { PathResult };

const ARTIFACT: GateSpec = { noun: "artifact path", ext: ".svg" };

export function resolveArtifactPath(docPath: string, url: string): PathResult {
  return gatePath(docPath, url, ARTIFACT);
}
