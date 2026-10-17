import type { Engine, ReaderPort } from "./types.js";

/**
 * The engine resolves an import against `resolve(dirname(doc.path))`, which
 * for a relative path means the process's working directory. Documents are
 * handed to the engine as `/<repo-relative path>` instead, and this reader
 * maps that rooted path back to the repo-relative key of `texts` — so an
 * import resolves the same way in the CLI, whatever its cwd, and in the
 * browser.
 */
export const enginePath = (path: string): string => `/${path}`;

export function repoReader(engine: Engine, texts: Map<string, string>): ReaderPort {
  return engine.memoryReader((p) => texts.get(p.replace(/^\/+/, "")));
}
