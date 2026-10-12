import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_NAMES } from "../../visimark/src/lang/ast.js";
import { RESERVED_WORDS, SYMBOL_OPS, WORD_OPS } from "../../visimark/src/lang/lexer.js";
import {
  DELIM_PAIRS,
  GLYPH_IDENTS,
  POSITIVE_INTEGER_GLYPH,
} from "../../visimark/src/lang/notation.js";
import { PARAM_DOMAIN_PRESETS } from "../../visimark/src/lang/parser.js";
import { WORDS } from "../src/tokenize.js";

/**
 * H5 (#367 spec §4.3). The tokenizer keeps its own copy of the engine's word
 * tables; these tests fail when the two drift apart in either direction. The
 * engine's lists are module exports, read here by relative path — none of
 * them is part of the `visimark` package API.
 */

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();

test("reserved words match the lexer", () => {
  expect(sorted(WORDS.reserved)).toEqual(sorted(RESERVED_WORDS));
});

test("word operators match the lexer", () => {
  expect(sorted(WORDS.wordOps)).toEqual(sorted(WORD_OPS));
});

test("symbol operators match the lexer", () => {
  expect(sorted(WORDS.symbolOps)).toEqual(sorted(SYMBOL_OPS));
});

test("every glyph is classified as the word it stands for", () => {
  expect(sorted(Object.keys(WORDS.glyphs))).toEqual(sorted(Object.keys(GLYPH_IDENTS)));
  for (const [glyph, word] of Object.entries(GLYPH_IDENTS)) {
    const want =
      word === "in" ? "in" : PARAM_DOMAIN_PRESETS.has(word as never) ? "preset" : "function";
    expect([glyph, WORDS.glyphs[glyph]]).toEqual([glyph, want]);
  }
  expect(WORDS.positiveInteger).toBe(POSITIVE_INTEGER_GLYPH);
});

test("delimiters match the paired notation", () => {
  const glyphs = Object.entries(DELIM_PAIRS).flatMap(([open, pair]) => [open, pair.close]);
  expect(sorted(WORDS.delims)).toEqual(sorted(new Set(glyphs)));
});

test("every report name is an atom", () => {
  for (const name of REPORT_NAMES)
    expect([name, WORDS.reportAtoms.has(name)]).toEqual([name, true]);
});

test("param presets match the parser", () => {
  expect(sorted(WORDS.paramPresets)).toEqual(sorted(PARAM_DOMAIN_PRESETS));
});

// A word goes here only with a comment saying why it is not a surface keyword.
const IGNORED = new Set<string>();

const parserWords = (): Set<string> => {
  const src = readFileSync(join(import.meta.dir, "../../visimark/src/lang/parser.ts"), "utf8");
  const found = new Set<string>();
  const patterns = [
    /\bword\("([a-z]+)"\)/g,
    /\bisWord\("([a-z]+)"\)/g,
    /\.value [!=]== "([a-z]+)"/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) found.add(m[1]!);
  return found;
};

const contextual = (): Set<string> =>
  new Set([
    ...WORDS.paramWords,
    ...WORDS.paramPresets,
    ...WORDS.chartWords,
    ...WORDS.reportWords,
    ...WORDS.reportAtoms,
  ]);

test("every contextual word the parser matches is one the tokenizer knows", () => {
  const known = new Set([...contextual(), ...WORDS.reserved, ...WORDS.wordOps, ...IGNORED]);
  const unknown = sorted([...parserWords()].filter((w) => !known.has(w)));
  expect(unknown).toEqual([]);
});

test("every contextual word the tokenizer knows is one the parser matches", () => {
  const engine = new Set([
    ...parserWords(),
    ...REPORT_NAMES,
    ...PARAM_DOMAIN_PRESETS,
    ...RESERVED_WORDS,
  ]);
  const stale = sorted([...contextual()].filter((w) => !engine.has(w)));
  expect(stale).toEqual([]);
});
