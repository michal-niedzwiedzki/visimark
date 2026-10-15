import { analyze, describeFinding, isProblem, lineOf } from "visimark";
import type { FindingCode } from "visimark";

/**
 * The half of unified's plugin API this plugin touches, declared structurally
 * rather than imported from `unified`, `mdast` and `unist`: the published
 * package depends on `visimark` and nothing else, and a type imported from a
 * devDependency would not resolve for a consumer reading the emitted `.d.ts`
 * (review 2026-10-15 §2.11; `markdownlint-rule-visimark` does the same).
 * unified's `VFile` satisfies `VisimarkFile`, so `.use(remarkLintVisimark)`
 * typechecks against the real types.
 */

/** A `unist` point. The plugin reports a line only; see `lineOnly`. */
export interface LinePoint {
  line: number;
  column: number;
}

/** The part of a `VFile` the plugin reads and reports through. */
export interface VisimarkFile {
  value: unknown;
  message(reason: string, place: LinePoint, origin: string): { fatal?: boolean | null | undefined };
}

/** The transformer unified runs on each document. The tree is not read. */
export type VisimarkTransformer = (tree: unknown, file: VisimarkFile) => void;

function ruleId(code: FindingCode): string {
  return `visimark-${code.toLowerCase()}`;
}

// vfile-message only recognizes a `place` as a Point when `column` is a key
// on the object (even set to undefined) — a bare `{ line }` falls through
// unrecognized and `message.place` stays unset. `column` is typed required
// on `Point`, so the cast carries the runtime-undefined value past that.
function lineOnly(line: number): LinePoint {
  return { line, column: undefined as unknown as number };
}

function remarkLintVisimark(): VisimarkTransformer {
  return (_tree, file) => {
    const source = String(file.value);
    const { result } = analyze(source);
    for (const finding of result.findings) {
      if (!finding.span) continue; // no single site to attach a Position to
      const line = lineOf(source, finding.span.start);
      const message = file.message(
        describeFinding(finding),
        lineOnly(line),
        `visimark:${ruleId(finding.code)}`,
      );
      message.fatal = isProblem(finding) ? true : undefined;
    }
  };
}

export default remarkLintVisimark;
