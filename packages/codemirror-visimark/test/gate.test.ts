import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { locate } from "visimark";
import { hasVmarkBlock, mightHaveBlock } from "../src/gate.js";

/**
 * v1 constraint 4 — *activation is opt-in per note* — is one predicate, and
 * `docs/design/obsidian-manual-test.md` §2.1 is its acceptance. These tests
 * are the half of §2.1 a machine can run; the other half is a person opening
 * two notes and looking at the status bar.
 *
 * The case that earns the parse is `a ```vmark fence inside a fenced code
 * block`: a regular expression says yes, `locate` says no, and the CLI agrees
 * with `locate`. A gate written the cheap way would activate on every note
 * that *documents* VisiMark.
 */

const docs = resolve(import.meta.dir, "../../../docs");

test("an ordinary note does not open the gate", () => {
  expect(hasVmarkBlock("# Groceries\n\n- milk\n- bread\n")).toBe(false);
});

test("a plain Markdown table does not open the gate", () => {
  // a vault has hundreds of ordinary tables and they are none of our business
  expect(hasVmarkBlock("# Note\n\n| a | b |\n|---|---|\n| 1 | 2 |\n")).toBe(false);
});

test("an empty note does not open the gate", () => {
  expect(hasVmarkBlock("")).toBe(false);
});

test("a vmark fence opens the gate", () => {
  expect(hasVmarkBlock("| n |\n|---|\n| 1 |\n\n```vmark\ntotal = sum(n)\n```\n")).toBe(true);
});

test("a vmark fence inside a fenced code block does not open the gate", () => {
  const documenting = [
    "Here is how you write one:",
    "",
    "````markdown",
    "```vmark",
    "total = sum(n)",
    "```",
    "````",
    "",
  ].join("\n");
  expect(hasVmarkBlock(documenting)).toBe(false);
});

test("the gate agrees with locate() over the whole worked-example corpus", () => {
  // the gate is not allowed to have an opinion of its own: whatever the engine
  // calls a VisiMark document is what the plugin activates on, document for
  // document, or the plugin and the CLI mean different things by the same file
  const files = readdirSync(docs).filter((f) => f.startsWith("example-") && f.endsWith(".md"));
  expect(files.length).toBeGreaterThan(0);
  const disagreements: string[] = [];
  for (const file of files) {
    const source = readFileSync(join(docs, file), "utf8");
    if (hasVmarkBlock(source) !== locate(source).blocks.length > 0) disagreements.push(file);
  }
  expect(disagreements, `${disagreements.join(", ")} — the gate and locate() disagree`).toEqual([]);
});

test("example-invoice.md activates and example-quote-plain.md does not", () => {
  // the two documents manual test §2.1 and §2.7 name by hand
  expect(hasVmarkBlock(readFileSync(join(docs, "example-invoice.md"), "utf8"))).toBe(true);
  expect(hasVmarkBlock(readFileSync(join(docs, "example-quote-plain.md"), "utf8"))).toBe(false);
});

/**
 * `mightHaveBlock` is the half of the gate that runs before any parse — the
 * substring scan `sweep.ts` relies on to skip ordinary notes. It must never
 * produce a false negative: a note `locate` finds a block in must never be
 * one the substring scan rejects, or the sweep would silently skip it.
 */
test("the prefilter has no false negative on the worked-example corpus", () => {
  const files = readdirSync(docs).filter((f) => f.startsWith("example-") && f.endsWith(".md"));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const source = readFileSync(join(docs, file), "utf8");
    if (locate(source).blocks.length > 0) {
      expect(mightHaveBlock(source), `${file} has a block the prefilter would skip`).toBe(true);
    }
  }
});

test("a fence info string hidden behind a numeric character reference still opens the gate", () => {
  // `~~~v&#109;ark` decodes to `~~~vmark`, and `locate` finds the block —
  // a plain `source.includes("vmark")` would miss it (CodeRabbit review of PR #264)
  const decimal = "| n |\n|---|\n| 1 |\n\n~~~v&#109;ark\ntotal = sum(n)\n~~~\n";
  const hex = "| n |\n|---|\n| 1 |\n\n~~~v&#x6D;ark\ntotal = sum(n)\n~~~\n";
  expect(locate(decimal).blocks.length).toBeGreaterThan(0);
  expect(locate(hex).blocks.length).toBeGreaterThan(0);
  expect(hasVmarkBlock(decimal)).toBe(true);
  expect(hasVmarkBlock(hex)).toBe(true);
});

test("an unrelated numeric character reference does not itself open the gate", () => {
  // the escape hatch forces the real parse; it must not make the gate say
  // yes to a note that merely contains a copyright sign and no block
  expect(hasVmarkBlock("Copyright &#169; 2026. No block here.\n")).toBe(false);
});

test("a named character reference does not need the same escape hatch", () => {
  // no HTML5 named reference decodes to a bare ASCII letter, so `&amp;` and
  // friends can't spell `vmark` past a substring scan the way `&#109;` can
  const source = "| n |\n|---|\n| 1 |\n\n~~~v&amp;mark\ntotal = sum(n)\n~~~\n";
  expect(locate(source).blocks.length).toBe(0);
  expect(hasVmarkBlock(source)).toBe(false);
});

test("the prefilter has no false negative on any fence the engine accepts", () => {
  // the engine takes ``` and ~~~, any length of either, indented or not
  const table = "| n |\n|---|\n| 1 |\n\n";
  const bodies = ["#s\ntotal = SUM(n)"];
  const fences = ["```", "````", "~~~", "~~~~"];
  for (const fence of fences) {
    for (const indent of ["", "  "]) {
      for (const body of bodies) {
        const [id, rule] = body.split("\n") as [string, string];
        const source = `${table}${indent}${fence}vmark ${id}\n${indent}${rule}\n${indent}${fence}\n`;
        if (locate(source).blocks.length === 0) continue; // not a block; nothing to promise
        expect(mightHaveBlock(source), `${JSON.stringify(source)} would be skipped`).toBe(true);
      }
    }
  }
});
