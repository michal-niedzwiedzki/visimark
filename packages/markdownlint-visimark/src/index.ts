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
    const result = findingsFor(source);
    if (!result.ok) return; // visimark-engine-error reports it once (Task 3)
    for (const finding of result.findings) {
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

const ENGINE_ERROR_DESCRIPTION = "VisiMark could not analyse this document";

/**
 * Not built from `CODES`/`DESCRIPTIONS` — this does not correspond to a
 * `FindingCode`, and folding it into `DESCRIPTIONS`'s `Record<FindingCode,
 * …>` would break that type's deliberate exhaustiveness over the taxonomy.
 * The other seventeen rules silently return when `findingsFor` reports a
 * failure (see their `function` above); this is the one that reports it,
 * exactly once per document regardless of how many of the eighteen rules run.
 */
const engineErrorRule: Rule = {
  names: ["visimark-engine-error"],
  description: ENGINE_ERROR_DESCRIPTION,
  tags: ["visimark"], // never "visimark-advisory" — this is a hard failure, not a downgradable finding
  parser: "micromark",
  information: INFORMATION,
  function: (params, onError) => {
    const source = sourceFrom(params);
    const result = findingsFor(source);
    if (result.ok) return;
    onError({ lineNumber: 1, detail: result.message });
  },
};

export default [...rules, engineErrorRule];
