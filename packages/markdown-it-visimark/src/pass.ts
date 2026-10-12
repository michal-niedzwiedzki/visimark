// Relative, not `visimark`: `memoryReader` is exported only by the engine's
// browser entry, and every resolver that compiles this file — this package's
// tsconfig, Bun.build, and the VS Code extension's esbuild and tsc — agrees on
// a relative path without a mapping of its own.
import {
  build,
  check,
  locate,
  memoryReader,
  type CheckResult,
  type DocModel,
} from "../../visimark/src/browser.js";
import { importDependentNames } from "../../codemirror-visimark/src/import-deps.js";
import type { ReadImportSync } from "./types.js";

/**
 * One engine pass over a rendered document (spec §2.3, §2.6).
 *
 * `check` gets a document file only when there is both a path and a reader;
 * otherwise imports are skipped and produce no `IMPORT`. Import-dependent
 * names are withheld when there was no document file or when any `IMPORT`
 * was reported — one failed import withholds them all, as
 * `codemirror-visimark`'s snapshot pass does.
 */
export interface Pass {
  model: DocModel;
  result: CheckResult;
  withheld: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

export function runPass(
  source: string,
  path: string | null,
  readImport: ReadImportSync | undefined,
): Pass {
  const model = build(locate(source));
  // membership comes from the fences' own `from` clauses, so it is asked
  // before `check` populates imported sheets (import-deps.ts explains why)
  const dependent = importDependentNames(model);
  if (path === null || readImport === undefined) {
    return { model, result: check(model), withheld: dependent };
  }
  // The gate and the import phase each ask about a path; read it once.
  const memo = new Map<string, string | null>();
  const lookup = (p: string): string | null => {
    if (!memo.has(p)) memo.set(p, readImport(p));
    return memo.get(p) ?? null;
  };
  const result = check(model, { doc: { path, reader: memoryReader(lookup) } });
  const failed = result.findings.some((f) => f.code === "IMPORT");
  return { model, result, withheld: failed ? dependent : NONE };
}

/**
 * One cached pass per plugin instance, keyed on (source, path). VS Code
 * renders the same unchanged text repeatedly and shares one `md` across every
 * preview, which is why this lives in the plugin's closure and never on `md`.
 */
export function passCache(
  readImport: ReadImportSync | undefined,
): (source: string, path: string | null) => Pass {
  let last: { source: string; path: string | null; pass: Pass } | null = null;
  return (source, path) => {
    if (last === null || last.source !== source || last.path !== path) {
      last = { source, path, pass: runPass(source, path, readImport) };
    }
    return last.pass;
  };
}
