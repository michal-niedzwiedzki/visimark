import { afterEach, expect, mock, test } from "bun:test";
import * as real from "visimark";
import { lint } from "markdownlint/promise";
import { findingsFor, parseCount, resetFindingsCache } from "../src/findings.js";
import rules from "../src/index.js";

const realAnalyze = real.analyze;

afterEach(() => {
  // mock.restore() does not undo mock.module(); explicitly re-mock the real
  // implementation, captured above by value before any test mocked it.
  mock.module("visimark", () => ({ ...real, analyze: realAnalyze }));
  resetFindingsCache();
});

test("an analyze() failure is cached like a success — one call, not one per rule", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw new Error("boom");
    },
  }));
  resetFindingsCache();
  const first = findingsFor("anything");
  const second = findingsFor("anything");
  expect(first).toEqual({ ok: false, message: "boom" });
  expect(second).toEqual({ ok: false, message: "boom" });
  expect(parseCount()).toBe(1);
});

test("an analyze() failure of a non-Error value still produces a readable message", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw "boom";
    },
  }));
  resetFindingsCache();
  expect(findingsFor("anything")).toEqual({ ok: false, message: "boom" });
});

test("a document that fails does not poison a different document linted after it", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: (source: string) => {
      if (source === "broken") throw new Error("boom");
      return realAnalyze(source);
    },
  }));
  resetFindingsCache();
  expect(findingsFor("broken")).toEqual({ ok: false, message: "boom" });
  const cleanResult = findingsFor("# Notes\n\nNothing to check here.\n");
  expect(cleanResult.ok && cleanResult.findings).toHaveLength(0);
});

const only = { default: false, visimark: true };

type Reported = { line: number; rule: string; detail: string };

async function run(strings: Record<string, string>): Promise<Record<string, Reported[]>> {
  const results = await lint({ strings, customRules: rules, config: only });
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

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

test("analyze() throwing reports exactly one violation, under visimark-engine-error", async () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw new Error("boom");
    },
  }));
  resetFindingsCache();
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([{ line: 1, rule: "visimark-engine-error", detail: "boom" }]);
  // The headline invariant of this fix: eighteen rules ran against this
  // document, but analyze() was called once, not eighteen times.
  expect(parseCount()).toBe(1);
});

test("a non-Error thrown value still produces a readable detail", async () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw "boom";
    },
  }));
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([{ line: 1, rule: "visimark-engine-error", detail: "boom" }]);
});

test("a successful analyze() never reports visimark-engine-error", async () => {
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([]);
});
