import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fault, type Fault } from "./errors.js";

/**
 * The only security boundary in this package.
 *
 * Writes are off unless **both** conditions hold: the server was started with
 * `--allow-write`, and the host declared at least one MCP root. **No roots
 * means no writes**, even with the flag — an operator who passes the flag into
 * a host that declares nothing has not chosen a blast radius, and the server
 * does not choose one for them.
 *
 * Neither condition is reachable from a tool call. An agent cannot argue its
 * way past a flag it cannot set or a root it cannot declare, and nothing in
 * this module takes an argument that came from one.
 *
 * This sits **on top of** the engine's artifact path gate — containment in the
 * document's directory, and the refusal to overwrite any file lacking
 * VisiMark's marker. It does not replace either.
 */
export interface Gate {
  readonly allowWrite: boolean;
  /** absolute directories the host declared; empty is the closed state */
  readonly roots: readonly string[];
}

/** The message spec §2.4 fixes, so the human running the server knows what to do. */
export const WRITES_DISABLED = "writes are disabled. Start the server with --allow-write.";

export function closedGate(): Gate {
  return { allowWrite: false, roots: [] };
}

/**
 * `undefined` when the write may proceed; a `WRITE` fault otherwise. The
 * flag-off and no-roots cases deliberately share one message: both mean "no
 * operator has opened this", and telling an agent which half is missing tells
 * it nothing it can act on.
 */
export function permits(gate: Gate, path: string): Fault | undefined {
  if (!gate.allowWrite || gate.roots.length === 0) return fault("WRITE", WRITES_DISABLED);

  const target = realish(resolve(path));
  const inside = gate.roots.some((root) => contains(realish(resolve(root)), target));
  if (!inside) {
    return fault("WRITE", `visimark: ${path} is outside every declared root`);
  }
  return undefined;
}

/**
 * A path's real location where it has one, and the path itself where it does
 * not — an artifact this run is about to create has no realpath yet, and its
 * directory is what containment is really about. Resolving what exists is what
 * stops a symlink out of a root from reading as a path inside it.
 */
function realish(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    const parent = resolve(path, "..");
    if (parent === path) return path;
    return resolve(realish(parent), path.slice(parent.length + 1));
  }
}

function contains(root: string, target: string): boolean {
  if (root === target) return true;
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith(".." + sep) && rel !== ".." && !isAbsolute(rel);
}
