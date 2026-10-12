import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { isVmarkFence, visimarkLanguage } from "../src/highlight.js";

// Spec §3.1: every tag name the adapter emits, one per kind.
const TAGS = new Set([
  "keyword",
  "operatorKeyword",
  "typeName",
  "atom",
  "variableName.function",
  "variableName.definition",
  "variableName",
  "definitionOperator",
  "operator",
  "paren",
  "bracket",
  "squareBracket",
  "brace",
  "separator",
  "derefOperator",
  "punctuation",
  "number",
  "literal",
  "string",
  "unit",
  "lineComment",
]);

// Lines that between them produce every kind at least once.
const DOC = [
  "total = SUM(Net)  # a comment",
  "param share precision 2 ∈ [0, 1] lattice 0.1 = default 0.5",
  "param seats precision 0 integer = default 3",
  "report best scalar s.profit direction max among feasible",
  "chart cost as bar of Net labelled Item aspect 16:9",
  '"Unit price" is price',
  "weight [kg] = 12",
  "due = 2026-10-12",
  "assert total > 0 and |total| == ⌊total⌋",
  "set = {1, 2}",
].join("\n");

const names = (state: EditorState, from = 0, to = state.doc.length): Set<string> => {
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error("no syntax tree");
  const out = new Set<string>();
  tree.iterate({ from, to, enter: (n) => void out.add(n.type.name) });
  return out;
};

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
  warn = spyOn(console, "warn");
});
afterEach(() => {
  warn.mockRestore();
});

test("H6: every tag name resolves without a warning, and every one is used", () => {
  const state = EditorState.create({ doc: DOC, extensions: [visimarkLanguage] });
  const found = names(state);
  found.delete("Document");
  expect(warn).not.toHaveBeenCalled();
  expect([...found].sort()).toEqual([...TAGS].sort());
});

test("H6: a half-typed line parses without throwing", () => {
  const state = EditorState.create({
    doc: 'x = SUM(\ny = "open\nz = [kg',
    extensions: [visimarkLanguage],
  });
  expect(names(state).has("variableName.function")).toBe(true);
});

test("H7: a vmark fence inside Markdown is tokenized", () => {
  const doc = "# t\n\n```vmark #s from rows.csv\ntotal = SUM(Net)\n```\n";
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null),
      }),
    ],
  });
  // the fence's tree is mounted as an overlay, which `iterate` does not
  // enter; `resolveInner` does, so read the node at each position
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error("no syntax tree");
  const from = doc.indexOf("total");
  const found = new Set<string>();
  for (let pos = from; pos < from + "total = SUM(Net)".length; pos++) {
    found.add(tree.resolveInner(pos, 1).name);
  }
  for (const n of [
    "variableName.definition",
    "definitionOperator",
    "variableName.function",
    "paren",
    "variableName",
  ]) {
    expect([n, found.has(n)]).toEqual([n, true]);
  }
});
