import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { lint } from "markdownlint/promise";
import rules from "../src/index.js";
import recommended from "../recommended.json" with { type: "json" };
import { parseCount, resetFindingsCache } from "../src/findings.js";
import { reconstructCount, resetSourceCache } from "../src/source.js";

type LintConfig = NonNullable<Parameters<typeof lint>[0]>["config"];

/** Every VisiMark rule on, nothing else — markdownlint's own built-ins stay out of the assertions. */
const only: LintConfig = { default: false, visimark: true };

type Reported = { line: number; rule: string; detail: string };

async function run(
  strings: Record<string, string>,
  config: LintConfig = { ...only, ...recommended },
): Promise<Record<string, Reported[]>> {
  const results = await lint({ strings, customRules: rules, config });
  const out: Record<string, Reported[]> = {};
  for (const [name, errors] of Object.entries(results)) {
    out[name] = errors.map((e) => ({
      line: e.lineNumber,
      rule: e.ruleNames[0]!,
      detail: e.errorDetail!,
    }));
  }
  return out;
}

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const failingAssert = `\`\`\`vmark #calls
spent  = 5
budget = 1

assert spent <= budget
\`\`\`
`;

const unusedScalar = `\`\`\`vmark #s
unused = 1
\`\`\`
`;

/** A table and no rules at all: a document-scope COVERAGE finding, which has no span. */
const noRules = `# Roadmap

| Item | Cost |
|------|-----:|
| pen  | 1.00 |
`;

/**
 * A table that deliberately opts out of coverage checking. The marker is an HTML
 * comment, and `markdownlint` blanks HTML comment content out of `params.lines`
 * — so a package reading only `params.lines` reports a COVERAGE violation on a
 * document `visimark check` passes, failing a consumer's CI on correct input.
 */
const optedOut = `<!--vmark:no-formulas-->

| Item | Cost |
|------|-----:|
| pen  | 1.00 |
`;

/** A stale scalar with a prose anchor: the cell's own STALE plus a span-less anchorGroup rollup. */
const anchored = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--vmark=lines.Net-->.
`;

const withFrontMatter = `---
title: Quote
author: nobody
draft: true
tags: [a, b]
---

${stale}`;

const anchoredCRLF = anchored.replace(/\n/g, "\r\n");

/**
 * The anchor comment sits inside a fenced example, not a real vmark block —
 * mdast never parses code-fence content into an `html` node, so neither
 * `visimark`'s own anchor scanner nor markdownlint's micromark token walk
 * ever sees it. `lines.Net` is therefore genuinely unbound: with advisory
 * findings on, it reports as unused, not as a restored anchor.
 */
const anchorInFence = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Illustration of a value anchor:

\`\`\`text
Net comes to **9.99**<!--vmark=lines.Net-->.
\`\`\`
`;

/**
 * The anchor comment spans three lines. `token.text` (sliced from the real,
 * un-blanked source) keeps its `\r`s; the offset arithmetic in
 * `rebuild()` is built from `params.lines.join("\n")`, which does not. The
 * lengths disagree, `source.ts`'s length-preservation guard declines the
 * write, and the comment stays blanked — `lines.Net` degrades to the same
 * "unused" report as `anchorInFence`, on its own line, rather than either
 * restoring garbage or throwing.
 */
const anchoredMultilineCRLF = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--
vmark=lines.Net
-->.
`.replace(/\n/g, "\r\n");

test("a CRLF document reports the same lines as its LF twin", async () => {
  const report = await run({ anchoredCRLF });
  expect(report.anchoredCRLF).toEqual([
    { line: 5, rule: "visimark-stale", detail: "lines.Net: stored 9.99 ≠ computed 10.00" },
  ]);
});

test("an anchor inside a fenced code block is not restored, and is not a binding", async () => {
  const report = await run({ anchorInFence }, only);
  expect(report.anchorInFence).toEqual([
    { line: 2, rule: "visimark-warn", detail: "lines.Net is defined and never read" },
  ]);
});

test("the length-preservation guard declines rather than writing a bad offset", async () => {
  const report = await run({ anchoredMultilineCRLF }, only);
  expect(report.anchoredMultilineCRLF).toEqual([
    { line: 2, rule: "visimark-warn", detail: "lines.Net is defined and never read" },
  ]);
});

test("a stale cell reports one violation, on its own line", async () => {
  const report = await run({ stale });
  expect(report.stale).toEqual([
    {
      line: 3,
      rule: "visimark-stale",
      detail: "lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)",
    },
  ]);
});

test("a clean document reports nothing", async () => {
  const report = await run({ clean });
  expect(report.clean).toEqual([]);
});

test("a failing assert reports under visimark-assert", async () => {
  const report = await run({ assert: failingAssert });
  expect(report.assert).toEqual([
    { line: 5, rule: "visimark-assert", detail: "assert spent <= budget: 5 <= 1 is false" },
  ]);
});

test("a span-less document-scope COVERAGE reports at line 1", async () => {
  const report = await run({ roadmap: noRules });
  expect(report.roadmap).toEqual([
    {
      line: 1,
      rule: "visimark-coverage",
      detail: "a table with no `vmark` rules — nothing in this document is checked",
    },
  ]);
});

test("a no-formulas marker is honoured, not blanked into a spurious COVERAGE", async () => {
  const report = await run({ optedOut });
  expect(report.optedOut).toEqual([]);
});

test("the collapsed anchor-group rollup is not reported; the cell it summarises is", async () => {
  const report = await run({ anchored });
  expect(report.anchored).toEqual([
    { line: 5, rule: "visimark-stale", detail: "lines.Net: stored 9.99 ≠ computed 10.00" },
  ]);
});

test("front matter shifts the line by exactly its length, once", async () => {
  // Six lines of front matter (two `---` fences around four of YAML) plus the
  // blank line that terminates it: markdownlint's own front-matter match
  // consumes all seven, strips them from params.lines and adds the length back
  // to every reported lineNumber itself. This package adds nothing.
  const report = await run({ front: withFrontMatter, stale });
  expect(report.front).toHaveLength(1);
  expect(report.front![0]!.rule).toBe("visimark-stale");
  expect(report.front![0]!.line).toBe(report.stale![0]!.line + 7);
});

test("recommended switches the advisory kinds off", async () => {
  const report = await run({ unusedScalar });
  expect(report.unusedScalar).toEqual([]);
});

test("without recommended, an advisory finding reports", async () => {
  const report = await run({ unusedScalar }, only);
  expect(report.unusedScalar).toEqual([
    { line: 2, rule: "visimark-warn", detail: "s.unused is defined and never read" },
  ]);
});

test("one finding kind can be switched off by name", async () => {
  const report = await run({ stale }, { ...only, ...recommended, "visimark-stale": false });
  expect(report.stale).toEqual([]);
});

test("the whole package can be switched off by tag", async () => {
  const report = await run({ stale }, { ...only, visimark: false });
  expect(report.stale).toEqual([]);
});

test('"default": false with no re-enable lints with zero VisiMark rules', async () => {
  // The silent-green trap: markdownlint's `default` switch governs custom rules
  // too, so a config like this passes while checking nothing. Pinned here so a
  // future test written this way cannot look green by accident.
  const report = await run({ stale }, { default: false });
  expect(report.stale).toEqual([]);
});

test("a clean document linted after a stale one in the same run reports nothing", async () => {
  const report = await run({ stale, clean });
  expect(report.stale).toHaveLength(1);
  expect(report.clean).toEqual([]);
});

test("two documents with byte-identical content both report", async () => {
  const report = await run({ a: stale, b: `${stale}` });
  expect(report.a).toHaveLength(1);
  expect(report.b).toHaveLength(1);
});

test("ordinary prose reports nothing", async () => {
  const report = await run({ prose: "# Notes\n\nNothing to check here.\n" });
  expect(report.prose).toEqual([]);
});

test("the drift invoice reports nineteen violations: check's 27 less the folded anchors", async () => {
  // `visimark check` on this document prints "27 problems (22 stale, 5 errors)".
  // Here it is 19: exactly the eight prose anchors folded into the anchor-group
  // rollup this package skips. Six of these — the scalar totals on lines 34, 35,
  // 36, 53, 64 and 65 — are bound through prose anchors, so they are precisely
  // the findings a package reading the blanked `params.lines` would lose.
  // markdownlint sorts its results by rule name, so assert the tally and
  // spot-check details rather than an ordered array.
  const drift = readFileSync(
    new URL("../../../docs/example-invoice-drift.md", import.meta.url),
    "utf8",
  );
  const report = await run({ drift });
  const violations = report.drift!;
  expect(violations).toHaveLength(19);

  const byRule: Record<string, number> = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  expect(byRule).toEqual({
    "visimark-stale": 14,
    "visimark-date": 2,
    "visimark-cycle": 1,
    "visimark-undef": 1,
    "visimark-vector": 1,
  });

  expect(violations).toContainEqual({
    line: 22,
    rule: "visimark-stale",
    detail: "lines.Net (On-call support): stored 3120.00 ≠ computed 5200.00 (Qty * Rate)",
  });
  expect(violations).toContainEqual({
    line: 44,
    rule: "visimark-date",
    detail:
      '"11/12/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-12-11 or 2026-11-12, 29 days apart',
  });
  expect(violations).toContainEqual({
    line: 74,
    rule: "visimark-cycle",
    detail: "late_fees.base → late_fees.fee → late_fees.total → late_fees.base",
  });
  // An anchor-bound scalar: invisible unless the HTML comment is restored.
  expect(violations).toContainEqual({
    line: 34,
    rule: "visimark-stale",
    detail: "lines.net_total: stored 23300.00 ≠ computed 25380.00 (SUM(Net))",
  });
});

test("eighteen rules cost one analyze() and one source reconstruction per document", async () => {
  // Through the real parser, not a hand-built params. The plan's one-parse
  // property has to hold for the reconstruction too: `analyze()` was already
  // memoised, but rebuilding the source from the token stream seventeen times
  // is the same redundant work moved one layer down, and it is super-linear in
  // the number of HTML comments.
  resetFindingsCache();
  resetSourceCache();
  await run({ anchored });
  expect(parseCount()).toBe(1);
  expect(reconstructCount()).toBe(1);
});
