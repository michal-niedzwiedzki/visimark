// Follow-up review §2.9: the cap is an invariant, not a caller obligation.
//
// It used to be both wrong and optional. It counted child *nodes* while its
// doc said "lines", so a 40-line `VM.formatCheck` block cost one — the real
// ceiling was somewhere between 400 and unbounded depending on what had been
// logged. And it was enforced by a `trim()` on the interface that all 23 call
// sites had to remember; main.ts's boot-failure loop did not.

import { afterEach, beforeEach, expect, test } from "bun:test";
import type { FakeDocument, FakeElement } from "../../support/fake-dom.js";
import { installFakeDom } from "../../support/fake-dom.js";
import { createTerminal } from "../../../src/playground/app/terminal.js";

/** The cap in src/playground/app/terminal.ts. */
const CAP = 400;

let dom: ReturnType<typeof installFakeDom>;
let doc: FakeDocument;
let body: FakeElement;

function build(): ReturnType<typeof createTerminal> {
  const panel = doc.add("div", "terminal-panel");
  body = doc.add("pre", "terminal-body", "", panel);
  return createTerminal();
}

/** What the panel is actually showing, in lines. */
const lineCount = (): number =>
  body.children.reduce((n, node) => n + node.textContent.split("\n").length - 1, 0);

beforeEach(() => {
  dom = installFakeDom();
  doc = dom.document;
});
afterEach(() => dom.restore());

test("single lines are capped without anyone asking", () => {
  const terminal = build();
  for (let i = 0; i < CAP + 150; i++) terminal.line(`line ${i}`);
  expect(lineCount()).toBeLessThanOrEqual(CAP);
  // ...and it is the oldest that go
  expect(body.textContent).not.toContain("line 0\n");
  expect(body.textContent).toContain(`line ${CAP + 149}`);
});

test("a multi-line entry costs what it occupies, not one", () => {
  const terminal = build();
  // The shape `VM.formatCheck` produces: one node, many lines.
  for (let i = 0; i < 30; i++)
    terminal.line(Array.from({ length: 40 }, () => `finding ${i}`).join("\n"), "err");
  expect(lineCount()).toBeLessThanOrEqual(CAP);
  // Under the old node-counting cap this was 30 nodes — nowhere near 400 —
  // and therefore 1,200 lines of DOM.
  expect(body.children.length).toBeLessThan(30);
});

test("`cmd` is capped on the same terms", () => {
  const terminal = build();
  for (let i = 0; i < CAP + 50; i++) terminal.cmd(`visimark fmt ${i}.md`);
  expect(lineCount()).toBeLessThanOrEqual(CAP);
});

test("one entry longer than the whole cap is still shown", () => {
  // Trimming to the last line of a single block would leave the visitor
  // reading a fragment of the only thing on screen.
  const terminal = build();
  terminal.line(Array.from({ length: CAP * 2 }, () => "x").join("\n"));
  expect(body.children).toHaveLength(1);
});

test("clear() resets the count as well as the panel", () => {
  const terminal = build();
  for (let i = 0; i < CAP; i++) terminal.line(`line ${i}`);
  terminal.clear();
  terminal.line("fresh");
  expect(body.children).toHaveLength(1);
  expect(lineCount()).toBe(1);
});

test("the interface no longer carries a trim for callers to forget", () => {
  const terminal = build();
  expect(Object.keys(terminal)).not.toContain("trim");
});
