import { Glob } from "bun";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "../../visimark/src/index.js";
import { isVmarkFence, tokenizeLine, type Kind } from "../src/tokenize.js";

const spans = (line: string): [string, Kind][] =>
  tokenizeLine(line).map((s) => [line.slice(s.from, s.to), s.kind]);

// Spec §4.1, T1–T20. Every span is written out; whitespace is never a span.
const CASES: [string, string, [string, Kind][]][] = [
  [
    "T1",
    "total = SUM(Net)",
    [
      ["total", "definition"],
      ["=", "assign"],
      ["SUM", "function"],
      ["(", "paren"],
      ["Net", "name"],
      [")", "paren"],
    ],
  ],
  [
    "T2",
    "total = SUM(",
    [
      ["total", "definition"],
      ["=", "assign"],
      ["SUM", "function"],
      ["(", "paren"],
    ],
  ],
  [
    "T3",
    "Net = Qty * Price  # per row",
    [
      ["Net", "definition"],
      ["=", "assign"],
      ["Qty", "name"],
      ["*", "operator"],
      ["Price", "name"],
      ["# per row", "comment"],
    ],
  ],
  [
    "T4",
    'label = "a#b"',
    [
      ["label", "definition"],
      ["=", "assign"],
      ['"a#b"', "string"],
    ],
  ],
  [
    "T5",
    'name = "unclosed',
    [
      ["name", "definition"],
      ["=", "assign"],
      ['"unclosed', "string"],
    ],
  ],
  [
    "T6",
    "param volume_disc precision 3 in [0%, 10%] lattice 1% = default 0%",
    [
      ["param", "keyword"],
      ["volume_disc", "definition"],
      ["precision", "keyword"],
      ["3", "number"],
      ["in", "wordOperator"],
      ["[", "domainBracket"],
      ["0%", "number"],
      [",", "separator"],
      ["10%", "number"],
      ["]", "domainBracket"],
      ["lattice", "keyword"],
      ["1%", "number"],
      ["=", "assign"],
      ["default", "keyword"],
      ["0%", "number"],
    ],
  ],
  [
    "T7",
    "param seats precision 0 ℤ⁺ = default 3",
    [
      ["param", "keyword"],
      ["seats", "definition"],
      ["precision", "keyword"],
      ["0", "number"],
      ["ℤ⁺", "domainPreset"],
      ["=", "assign"],
      ["default", "keyword"],
      ["3", "number"],
    ],
  ],
  [
    "T8",
    "param share precision 2 ∈ [0, 1] = default 0.5",
    [
      ["param", "keyword"],
      ["share", "definition"],
      ["precision", "keyword"],
      ["2", "number"],
      ["∈", "wordOperator"],
      ["[", "domainBracket"],
      ["0", "number"],
      [",", "separator"],
      ["1", "number"],
      ["]", "domainBracket"],
      ["=", "assign"],
      ["default", "keyword"],
      ["0.5", "number"],
    ],
  ],
  [
    "T9",
    "weight [kg] = 12",
    [
      ["weight", "definition"],
      ["[kg]", "unit"],
      ["=", "assign"],
      ["12", "number"],
    ],
  ],
  [
    "T10",
    "in = 3",
    [
      ["in", "definition"],
      ["=", "assign"],
      ["3", "number"],
    ],
  ],
  [
    "T11",
    "report best scalar event.profit direction max among feasible",
    [
      ["report", "keyword"],
      ["best", "atom"],
      ["scalar", "keyword"],
      ["event", "name"],
      [".", "deref"],
      ["profit", "name"],
      ["direction", "keyword"],
      ["max", "atom"],
      ["among", "keyword"],
      ["feasible", "atom"],
    ],
  ],
  [
    "T12",
    "chart cost as stacked-bar of Net, Tax labelled Item aspect 16:9",
    [
      ["chart", "keyword"],
      ["cost", "definition"],
      ["as", "keyword"],
      ["stacked-bar", "atom"],
      ["of", "keyword"],
      ["Net", "name"],
      [",", "separator"],
      ["Tax", "name"],
      ["labelled", "keyword"],
      ["Item", "name"],
      ["aspect", "keyword"],
      ["16", "number"],
      [":", "punctuation"],
      ["9", "number"],
    ],
  ],
  [
    "T13",
    '"Unit price" is price',
    [
      ['"Unit price"', "string"],
      ["is", "keyword"],
      ["price", "definition"],
    ],
  ],
  [
    "T14",
    "assert total == SUM(Net) and total > 0",
    [
      ["assert", "keyword"],
      ["total", "name"],
      ["==", "operator"],
      ["SUM", "function"],
      ["(", "paren"],
      ["Net", "name"],
      [")", "paren"],
      ["and", "wordOperator"],
      ["total", "name"],
      [">", "operator"],
      ["0", "number"],
    ],
  ],
  [
    "T15",
    "root = √(area) + Σ(Net) + |delta| + ⌊x⌋",
    [
      ["root", "definition"],
      ["=", "assign"],
      ["√", "function"],
      ["(", "paren"],
      ["area", "name"],
      [")", "paren"],
      ["+", "operator"],
      ["Σ", "function"],
      ["(", "paren"],
      ["Net", "name"],
      [")", "paren"],
      ["+", "operator"],
      ["|", "bracket"],
      ["delta", "name"],
      ["|", "bracket"],
      ["+", "operator"],
      ["⌊", "bracket"],
      ["x", "name"],
      ["⌋", "bracket"],
    ],
  ],
  [
    "T16a",
    "due = 2026-10-12",
    [
      ["due", "definition"],
      ["=", "assign"],
      ["2026-10-12", "date"],
    ],
  ],
  [
    "T16b",
    "n = 2026101",
    [
      ["n", "definition"],
      ["=", "assign"],
      ["2026101", "number"],
    ],
  ],
  [
    "T17",
    "x = a € b",
    [
      ["x", "definition"],
      ["=", "assign"],
      ["a", "name"],
      ["b", "name"],
    ],
  ],
  [
    "T18",
    "report = 5",
    [
      ["report", "definition"],
      ["=", "assign"],
      ["5", "number"],
    ],
  ],
  [
    "T19a",
    "param = 5",
    [
      ["param", "definition"],
      ["=", "assign"],
      ["5", "number"],
    ],
  ],
  [
    "T19b",
    "param precision 2 = 5",
    [
      ["param", "definition"],
      ["precision", "keyword"],
      ["2", "number"],
      ["=", "assign"],
      ["5", "number"],
    ],
  ],
  [
    "T20",
    "lattice = in + 1",
    [
      ["lattice", "definition"],
      ["=", "assign"],
      ["in", "name"],
      ["+", "operator"],
      ["1", "number"],
    ],
  ],
];

describe("tokenizeLine (spec §4.1)", () => {
  test.each(CASES)("%s: %s", (_id, line, expected) => {
    expect(spans(line)).toEqual(expected);
  });
});

describe("isVmarkFence (H4)", () => {
  test.each([
    ["vmark", true],
    ["vmark #order from rows.csv labelled Item, Qty", true],
    ["  vmark ", true],
    ["vmark#s", false],
    ["VMARK", false],
    ["vmarkx", false],
    ["", false],
    ["js", false],
  ] as const)("%p → %p", (info, want) => {
    expect(isVmarkFence(info)).toBe(want);
  });
});

// H2 and H3 run over every `vmark` fence body in the worked examples and the
// playground's own documents. The engine's `locate` finds the fences, so a
// fence nested inside a wider outer fence is not mistaken for one.
const root = join(import.meta.dir, "..", "..", "..");
const CORPUS: { where: string; line: string }[] = [];
for (const pattern of ["docs/example-*.md", "docs/playground/**/*.md"]) {
  for (const rel of new Glob(pattern).scanSync({ cwd: root })) {
    const source = readFileSync(join(root, rel), "utf8");
    for (const block of locate(source).blocks) {
      const lines = source.slice(block.span.start, block.span.end).split("\n");
      const offset = source.slice(0, block.span.start).split("\n").length;
      lines.slice(1, -1).forEach((line, k) => {
        CORPUS.push({ where: `${rel}:${offset + 1 + k}`, line });
      });
    }
  }
}

describe("the corpus", () => {
  test("is not empty", () => {
    expect(CORPUS.length).toBeGreaterThan(100);
  });

  test("H2: every non-whitespace character lies inside a span", () => {
    const bare: string[] = [];
    for (const { where, line } of CORPUS) {
      const covered = Array.from({ length: line.length }, () => false);
      for (const s of tokenizeLine(line)) covered.fill(true, s.from, s.to);
      for (let i = 0; i < line.length; i++) {
        if (!covered[i] && !/\s/.test(line[i]!)) bare.push(`${where} col ${i + 1}: ${line}`);
      }
    }
    expect(bare).toEqual([]);
  });

  test("H3: tokenizeLine never throws on any prefix of any line", () => {
    for (const { line } of CORPUS) {
      for (let k = 0; k <= line.length; k++) tokenizeLine(line.slice(0, k));
    }
  });
});
