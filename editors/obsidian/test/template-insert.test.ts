import { expect, test } from "bun:test";
import { build, check, locate } from "visimark";
import { templateInsertion } from "../src/template-insert.js";

/**
 * Review row 21: a template inserted mid-line broke its own heading and
 * fence out of block position. These tests build the resulting document and
 * run it through the engine, the same way the spec's own claim ("a template
 * passes `check` with zero findings") is meant to be read — for wherever the
 * caret actually was, not only an empty note.
 */

const TEMPLATE = "# Invoice 001\n\n```vmark\nvat = 23%\n```\n\nDone.\n";

function apply(source: string, cursorOffset: number, body: string): string {
  const { at, text } = templateInsertion(source, cursorOffset, body);
  return source.slice(0, at) + text + source.slice(at);
}

function findingsOf(source: string): string[] {
  const model = build(locate(source));
  return check(model).findings.map((f) => f.code);
}

test("an empty note gets the template with no extra padding", () => {
  const result = apply("", 0, TEMPLATE);
  expect(result).toBe(TEMPLATE);
  expect(findingsOf(result)).toEqual([]);
});

test("inserting mid-sentence never glues the template's fence to existing text", () => {
  const source = "Some meeting notes here.\n\nMore notes below.\n";
  const cursorOffset = source.indexOf("notes"); // squarely inside the first line
  const result = apply(source, cursorOffset, TEMPLATE);
  // the fence is a block: neither the line before it nor the line the fence
  // itself is on shares any of the original prose
  const fenceLine = result.split("\n").find((l) => l.startsWith("```vmark"));
  expect(fenceLine).toBe("```vmark");
  expect(result).toContain("Some meeting notes here.");
  expect(result).toContain("More notes below.");
  expect(findingsOf(result)).toEqual([]);
});

test("inserting on an already-blank line adds no redundant padding", () => {
  const source = "Some notes.\n\nMore notes.\n";
  const blankLineOffset = source.indexOf("\n\n") + 1; // the empty line itself
  const result = apply(source, blankLineOffset, TEMPLATE);
  expect(result).not.toContain("\n\n\n\n"); // no stacked blank lines
  expect(findingsOf(result)).toEqual([]);
});

test("inserting at the very end of a note still produces a valid block", () => {
  const source = "# My notes\n\nJust some prose, no trailing newline.";
  const result = apply(source, source.length, TEMPLATE);
  expect(findingsOf(result)).toEqual([]);
});
