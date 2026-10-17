import { describe, expect, test } from "bun:test";
import { findingLines, summaryLines } from "../src/format.js";
import { investigate } from "../src/investigate.js";
import { selectFiles } from "../src/policy.js";
import type { Finding } from "../src/types.js";
import { fixtureRepo } from "./repo-fixture.js";
import { engine } from "./support.js";

function report(host: string | null = null) {
  const files = fixtureRepo();
  const paths = [...files].map(([path, text]) => ({ path, size: text.length }));
  const { markdown, skipped } = selectFiles(paths);
  return investigate(
    {
      repo: { label: "fixture-repo", host, commit: "c0ffee", lastCommit: "2026-09-30" },
      engineVersion: "0.4.1",
      paths,
      texts: new Map(markdown.map((p) => [p, files.get(p)!])),
      skipped,
      workflowTexts: [],
      clonePath: null,
    },
    engine,
  );
}

const lead: Finding = {
  id: "docs/plan.md#UNDEF/Rate",
  path: "docs/plan.md",
  lines: [8, 8],
  permalink: null,
  confidence: "lead",
  rules: ["engine-check"],
  stored: "",
  computed: "",
  message: "unknown name `Rate`",
  evidence: [],
};

describe("summaryLines", () => {
  test("the §4.3 summary", () => {
    expect(summaryLines(report())).toEqual([
      "accuracy: 3 confirmed, 0 leads  (3 tables read, 3 checked, 0 unreadable)",
      "adoption: 2 tables with arithmetic and no rules, 0 inferable, 1 inferable after fix",
      "posture:  CONTRIBUTING no  PR template no  LICENSE yes  action no  last commit 2026-09-30",
    ]);
  });

  test("unavailable posture", () => {
    const r = report();
    r.posture = { ...r.posture, available: false };
    expect(summaryLines(r)[2]).toBe("posture:  unavailable");
  });
});

describe("findingLines", () => {
  test("cli: budget", () => {
    const f = report().findings[0]!;
    const lines = findingLines(f, "cli");
    expect(lines[0]).toBe("CONFIRMED  docs/budget.md:15  Cost / Total  · found by: sum check");
    expect(lines[1]).toBe("    3  | Item | Cost |");
    expect(lines.at(-2)).toBe("   15  | Total | 341.50 |");
    expect(lines.at(-1)).toBe(
      "  the table says 341.50; the rows add up to 340.50 (exact); off by 1.00",
    );
  });

  test("cli: a named cell and a lead", () => {
    expect(findingLines(report().findings[1]!, "cli")[0]).toBe(
      "CONFIRMED  docs/example-lunch-split-drift.md:17  lunch.Total  · found by: VisiMark",
    );
    expect(findingLines(lead, "cli")[0]).toBe(
      "lead       docs/plan.md:8  UNDEF Rate  · found by: VisiMark",
    );
  });

  test("cli: permalink on line 2", () => {
    const f = report("github.com").findings[0]!;
    expect(findingLines(f, "cli")[1]).toBe(`  ${f.permalink}`);
  });

  test("web", () => {
    expect(findingLines(report().findings[0]!, "web")).toEqual([
      "Wrong number · docs/budget.md:15 · Cost / Total",
      "the table says 341.50; the rows add up to 340.50 (exact); off by 1.00",
      "found by: sum check",
    ]);
    expect(findingLines(lead, "web")[0]).toBe("Worth a look · docs/plan.md:8 · UNDEF Rate");
  });

  test("labels join in registry order", () => {
    const f: Finding = { ...lead, rules: ["line-product", "engine-check"] };
    expect(findingLines(f, "web")[2]).toBe("found by: line check, VisiMark");
  });

  test("an escaped component prints plainly", () => {
    const f: Finding = { ...lead, id: "a.md#t1/Cost%2FUnit/B", confidence: "confirmed" };
    expect(findingLines(f, "web")[0]).toBe("Wrong number · docs/plan.md:8 · Cost/Unit / B");
  });
});
