import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { locate } from "visimark";
import { hasVmarkBlock } from "../src/gate.js";

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
