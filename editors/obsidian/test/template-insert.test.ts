import { expect, test } from "bun:test";
import { build, check, locate } from "visimark";
import { safeTemplateInsertion, templateInsertion } from "../src/template-insert.js";

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

test("inserting on the single blank line between two paragraphs still pads both sides", () => {
  // CodeRabbit review of PR #267: a first version consumed this blank line
  // instead of padding around it, landing the heading right after "Some
  // notes." with no gap at all
  const source = "Some notes.\n\nMore notes.\n";
  const blankLineOffset = source.indexOf("\n\n") + 1; // the empty line itself
  const result = apply(source, blankLineOffset, TEMPLATE);
  expect(result).toBe("Some notes.\n\n" + TEMPLATE + "\nMore notes.\n");
  expect(findingsOf(result)).toEqual([]);
});

test("inserting where a blank line already fully separates both sides adds no redundant padding", () => {
  const source = "Some notes.\n\n\nMore notes.\n"; // two blank lines already
  const secondBlankLineOffset = source.lastIndexOf("\n\n") + 1;
  const result = apply(source, secondBlankLineOffset, TEMPLATE);
  expect(result).not.toContain("\n\n\n\n"); // no stacked blank lines added on top
  expect(findingsOf(result)).toEqual([]);
});

test("inserting at the very end of a note still produces a valid block", () => {
  const source = "# My notes\n\nJust some prose, no trailing newline.";
  const result = apply(source, source.length, TEMPLATE);
  expect(findingsOf(result)).toEqual([]);
});

/**
 * CodeRabbit review of PR #267, second finding. A caret on a blank line
 * *inside* an existing fenced code block (any fence, not only a vmark one)
 * would insert the template as literal text there — `locate` finds no block
 * inside another fence (`gate.test.ts` already pins that half), so the
 * command would report success over a note with no working block at all.
 * `safeTemplateInsertion` is what catches this: it asks the same gate the
 * rest of the plugin trusts, rather than re-deriving fence nesting itself.
 */
test("a caret inside another fenced block does not silently insert a dead template", () => {
  const source = [
    "Some notes about formatting.",
    "",
    "~~~markdown",
    "example code here",
    "",
    "more code",
    "~~~",
    "",
    "More notes.",
    "",
  ].join("\n");
  const blankLineInsideFence = source.indexOf("\nmore code"); // the blank line inside the ~~~ fence

  // the plain function, unaware of fence nesting, reproduces the bug
  const naive = apply(source, blankLineInsideFence, TEMPLATE);
  expect(locate(naive).blocks.length).toBe(0);

  // the safe wrapper notices and falls back to the end of the document instead
  const placed = safeTemplateInsertion(source, blankLineInsideFence, TEMPLATE);
  expect(placed).not.toBeNull();
  const result = source.slice(0, placed!.at) + placed!.text + source.slice(placed!.at);
  expect(locate(result).blocks.length).toBeGreaterThan(0);
  expect(findingsOf(result)).toEqual([]);
  // the original note is untouched apart from the template landing after it
  expect(result.startsWith(source.replace(/\n+$/, ""))).toBe(true);
});

test("safeTemplateInsertion matches the plain function whenever the plain placement already works", () => {
  const source = "Some meeting notes here.\n\nMore notes below.\n";
  const cursorOffset = source.indexOf("notes");
  const plain = templateInsertion(source, cursorOffset, TEMPLATE);
  const safe = safeTemplateInsertion(source, cursorOffset, TEMPLATE);
  expect(safe).toEqual(plain);
});
