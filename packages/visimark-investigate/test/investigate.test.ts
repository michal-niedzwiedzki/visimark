import { describe, expect, test } from "bun:test";
import { investigate, type InvestigateInput } from "../src/investigate.js";
import { selectFiles } from "../src/policy.js";
import { RULES } from "../src/rules/registry.js";
import type { Rule } from "../src/types.js";
import { fixtureRepo } from "./repo-fixture.js";
import { engine } from "./support.js";

function inputOf(
  files: Map<string, string>,
  over: Partial<InvestigateInput> = {},
): InvestigateInput {
  const paths = [...files].map(([path, text]) => ({ path, size: text.length }));
  const { markdown, skipped } = selectFiles(paths);
  return {
    repo: { label: "fixture-repo", host: null, commit: "c0ffee", lastCommit: "2026-09-30" },
    engineVersion: "0.4.1",
    paths,
    texts: new Map(markdown.map((p) => [p, files.get(p)!])),
    skipped,
    workflowTexts: [],
    clonePath: null,
    ...over,
  };
}

const QUOTE_RULED = [
  "| Item | Qty | Price | Cost |",
  "|------|----:|------:|-----:|",
  "| A    | 2   | 5.00  | 10.00 |",
  "| B    | 3   | 4.00  | 13.00 |",
  "| C    | 1   | 7.00  | 7.00 |",
  "| D    | 4   | 2.00  | 8.00 |",
  "",
  "```vmark #q",
  "Cost = Qty * Price",
  "```",
  "",
].join("\n");

describe("investigate", () => {
  test("fixture repo from §4.3 gives the exact accuracy, adoption and ids", () => {
    const r = investigate(inputOf(fixtureRepo()), engine);
    expect(r.version).toBe(1);
    expect(r.engine).toBe("0.4.1");
    expect(r.accuracy).toEqual({
      verdict: "confirmed",
      confirmed: 3,
      leads: 0,
      tablesRead: 3,
      tablesChecked: 3,
      unreadable: 0,
    });
    expect(r.adoption).toEqual({
      withoutRules: 2,
      withArithmetic: 2,
      inferable: 0,
      inferableAfterFix: 1,
    });
    expect(r.findings.map((f) => f.id)).toEqual([
      "docs/budget.md#t1/Cost/Total",
      "docs/example-lunch-split-drift.md#lunch/Total",
      "docs/quote.md#t1/Cost/B",
    ]);
    expect(r.files).toEqual({
      markdown: 5,
      read: 4,
      skipped: [{ path: "test/fixture.md", reason: "excluded-directory" }],
    });
    expect(r.ruleErrors).toEqual([]);
  });

  test("merge: line-product and engine-check on one cell", () => {
    const r = investigate(inputOf(new Map([["q.md", QUOTE_RULED]])), engine);
    expect(r.findings.length).toBe(1);
    expect(r.findings[0]!.id).toBe("q.md#t1/Cost/B");
    expect(r.findings[0]!.rules).toEqual(["line-product", "engine-check"]);
    expect(r.findings[0]!.confidence).toBe("confirmed");
  });

  test("Q12: the #409 table counts inferableAfterFix 1, inferable 0", () => {
    const quote = fixtureRepo().get("docs/quote.md")!;
    const r = investigate(inputOf(new Map([["q.md", quote]])), engine);
    expect(r.adoption.inferable).toBe(0);
    expect(r.adoption.inferableAfterFix).toBe(1);
    expect(r.findings.map((f) => f.rules)).toEqual([["line-product"]]);
  });

  test("verdict ladder", () => {
    const lead = QUOTE_RULED.replace("Cost = Qty * Price", "Cost = Qty * Prise").replace(
      "13.00",
      "12.00",
    );
    expect(investigate(inputOf(new Map([["a.md", lead]])), engine).accuracy.verdict).toBe("leads");
    const clean = "| k | v |\n|---|---|\n| a | 1 |\n| b | 2 |\n| Total | 3 |\n";
    expect(investigate(inputOf(new Map([["a.md", clean]])), engine).accuracy.verdict).toBe("clean");
    const none = new Map([["README.md", "# Hi\n\n<!--vmark:no-formulas-->\n"]]);
    expect(investigate(inputOf(none), engine).accuracy.verdict).toBe("nothing-checkable");
  });

  test("ruleErrors records a throwing rule and the others still run", () => {
    const boom: Rule = {
      id: "boom",
      label: "boom",
      scope: "file",
      run() {
        throw new Error("kaput");
      },
    };
    const quote = fixtureRepo().get("docs/quote.md")!;
    const r = investigate(inputOf(new Map([["q.md", quote]])), engine, [boom, ...RULES]);
    expect(r.ruleErrors).toEqual([{ path: "q.md", rule: "boom", message: "kaput" }]);
    expect(r.findings.length).toBe(1);
  });

  test("an infer failure in the after-fix pass is recorded, not thrown", () => {
    const quote = fixtureRepo().get("docs/quote.md")!;
    // The fixed text is the only one holding "12.00", so only the after-fix pass throws.
    const flaky = {
      ...engine,
      infer: (text: string) => {
        if (text.includes("12.00")) throw new Error("infer broke");
        return engine.infer(text);
      },
    };
    const r = investigate(inputOf(new Map([["q.md", quote]])), flaky);
    expect(r.ruleErrors).toEqual([{ path: "q.md", rule: "engine-infer", message: "infer broke" }]);
    expect(r.adoption.inferableAfterFix).toBe(0);
    expect(r.findings.length).toBe(1);
  });

  test("posture unavailable when workflowTexts is null", () => {
    const r = investigate(inputOf(fixtureRepo(), { workflowTexts: null }), engine);
    expect(r.posture.available).toBe(false);
    expect(investigate(inputOf(fixtureRepo()), engine).posture).toEqual({
      available: true,
      contributing: false,
      prTemplate: false,
      license: true,
      actionUsed: false,
      lastCommit: "2026-09-30",
    });
  });

  test("permalink only for github.com", () => {
    const local = investigate(inputOf(fixtureRepo()), engine);
    expect(local.findings.every((f) => f.permalink === null)).toBe(true);
    const gh = investigate(
      inputOf(fixtureRepo(), {
        repo: { label: "o/r", host: "github.com", commit: "c0ffee", lastCommit: null },
      }),
      engine,
    );
    expect(gh.findings[0]!.permalink).toBe(
      "https://github.com/o/r/blob/c0ffee/docs/budget.md?plain=1#L3-L15",
    );
  });
});
