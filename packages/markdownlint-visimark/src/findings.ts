import { analyze, type Finding } from "visimark";

export type FindingsResult =
  | { readonly ok: true; readonly findings: readonly Finding[] }
  | { readonly ok: false; readonly message: string };

/**
 * One entry is enough. `markdownlint` runs a file's rules consecutively within
 * one synchronous pass, so the first of the eighteen rules to run for a file
 * fills this and the other seventeen hit it — one `analyze()` call per
 * document, whether it succeeds or throws, not eighteen. No two files can
 * interleave through it even when `markdownlint-cli2` lints files
 * concurrently, because every rule here is synchronous (none declares
 * `asynchronous: true`).
 */
let memo: { source: string; result: FindingsResult } | undefined;

/** Real `analyze()` calls, for the test that pins the one-parse property. */
let parses = 0;

export function findingsFor(source: string): FindingsResult {
  if (memo?.source !== source) {
    parses += 1;
    memo = { source, result: run(source) };
  }
  return memo.result;
}

function run(source: string): FindingsResult {
  try {
    return { ok: true, findings: analyze(source).result.findings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Test-only. Not re-exported from the package root, so it is not published surface. */
export function parseCount(): number {
  return parses;
}

/** Test-only. */
export function resetFindingsCache(): void {
  memo = undefined;
  parses = 0;
}
