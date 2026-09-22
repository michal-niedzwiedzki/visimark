import { describeFinding, lineOf, type FindingCode } from "visimark";
import { DESCRIPTIONS } from "./descriptions.js";
import { findingsFor } from "./findings.js";
import { sourceFrom } from "./source.js";
import type { Rule } from "./types.js";

export type { MicromarkToken, Rule, RuleErrorInfo, RuleOnError, RuleParams } from "./types.js";

const ADVISORY: ReadonlySet<FindingCode> = new Set<FindingCode>(["WARN", "NOTE"]);

const INFORMATION = new URL(
  "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy",
);

const CODES = Object.keys(DESCRIPTIONS) as FindingCode[];

const rules: Rule[] = CODES.map((code) => ({
  names: [`visimark-${code.toLowerCase()}`],
  description: DESCRIPTIONS[code],
  tags: ADVISORY.has(code) ? ["visimark", "visimark-advisory"] : ["visimark"],
  // Not "none": the micromark tokens are the only place a rule can read the
  // original text of an HTML comment, and VisiMark's anchors are HTML comments.
  // See `src/source.ts`.
  parser: "micromark",
  information: INFORMATION,
  function: (params, onError) => {
    const source = sourceFrom(params);
    for (const finding of findingsFor(source)) {
      if (finding.code !== code) continue;
      // The collapsed anchor-group rollup summarises stale prose anchors whose
      // own cells report with spans of their own; reporting it too would
      // double-count. A span-less finding that is not the rollup — the
      // document-scope COVERAGE — reports at line 1, markdownlint's only way
      // to say "the file".
      if (finding.anchorGroup) continue;
      onError({
        lineNumber: finding.span ? lineOf(source, finding.span.start) : 1,
        detail: describeFinding(finding),
      });
    }
  },
}));

export default rules;
