import { dirname, joinRelative } from "./paths.js";
import type { Engine } from "./types.js";

/**
 * Every file a document's `from <path>` declarations read, so a shell can
 * fetch or read it before `investigate` runs and an import resolves the same
 * way in the CLI and in the browser (spec §3.2). Repo-relative, sorted, and
 * without a path that would leave the repository.
 */
export function importTargets(markdown: Map<string, string>, engine: Engine): string[] {
  const found = new Set<string>();
  for (const [path, text] of markdown) {
    let model;
    try {
      model = engine.build(engine.locate(text));
    } catch {
      continue; // a document the engine cannot build has nothing to import
    }
    for (const sheet of model.sheets.values()) {
      if (!sheet.imported) continue;
      const target = joinRelative(dirname(path), sheet.imported.path);
      if (target) found.add(target);
    }
  }
  return [...found].sort();
}
