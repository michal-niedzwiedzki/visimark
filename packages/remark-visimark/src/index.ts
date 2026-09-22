import { analyze, describeFinding, isProblem, lineOf } from "visimark";
import type { FindingCode } from "visimark";
import type { Plugin } from "unified";
import type { Root } from "mdast";
import type { Point } from "unist";

function ruleId(code: FindingCode): string {
  return `visimark-${code.toLowerCase()}`;
}

// vfile-message only recognizes a `place` as a Point when `column` is a key
// on the object (even set to undefined) — a bare `{ line }` falls through
// unrecognized and `message.place` stays unset. `column` is typed required
// on `Point`, so the cast carries the runtime-undefined value past that.
function lineOnly(line: number): Point {
  return { line, column: undefined as unknown as number };
}

const remarkLintVisimark: Plugin<[], Root> = function remarkLintVisimark() {
  return (_tree, file) => {
    const source = String(file.value);
    const { result } = analyze(source);
    for (const finding of result.findings) {
      if (!finding.span) continue; // no single site to attach a Position to
      const line = lineOf(source, finding.span.start);
      const message = file.message(describeFinding(finding), lineOnly(line), `visimark:${ruleId(finding.code)}`);
      message.fatal = isProblem(finding) ? true : undefined;
    }
  };
};

export default remarkLintVisimark;
