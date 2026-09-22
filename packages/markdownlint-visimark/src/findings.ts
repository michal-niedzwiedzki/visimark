import { analyze, type Finding } from "visimark";

/**
 * One entry is enough. `markdownlint` runs a file's rules consecutively within
 * one synchronous pass, so the first of the seventeen rules to run for a file
 * fills this and the other sixteen hit it — one `analyze()` per document, not
 * seventeen. No two files can interleave through it even when
 * `markdownlint-cli2` lints files concurrently, because every rule here is
 * synchronous (none declares `asynchronous: true`).
 */
let memo: { source: string; findings: readonly Finding[] } | undefined;

/** Real `analyze()` calls, for the test that pins the one-parse property. */
let parses = 0;

export function findingsFor(source: string): readonly Finding[] {
  if (memo?.source !== source) {
    parses += 1;
    memo = { source, findings: analyze(source).result.findings };
  }
  return memo.findings;
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
