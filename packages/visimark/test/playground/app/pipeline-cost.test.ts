// Review §2.10, the half of it that ships.
//
// The measurement is in docs/design/playground-pipeline-cost-plan.md: a pass
// costs 12–20 ms for anything the playground holds, and 2.3 s for a 2,000-row
// paste. So the debounce stopped being a constant and became a floor — the
// next wait is at least as long as the last pass took, which turns a
// continuous lock into one lock per typing pause.

import { describe, expect, test } from "bun:test";
import { createPassCosts, nextDebounce } from "../../../src/playground/app/pipeline.js";

describe("how long to wait after a keystroke", () => {
  test("stays at the 500 ms floor for every document the page ships", () => {
    // Largest bundled document: 8 KB, 14 table rows — a 12–20 ms pass.
    expect(nextDebounce(0)).toBe(500);
    expect(nextDebounce(12)).toBe(500);
    expect(nextDebounce(155)).toBe(500);
    expect(nextDebounce(499)).toBe(500);
  });

  test("tracks the last pass once that exceeds the floor", () => {
    // 1,000 rows measured at 666 ms; 2,000 at 2,262 ms.
    expect(nextDebounce(666)).toBe(666);
    expect(nextDebounce(2262)).toBe(2262);
  });

  test("is capped, because past a few seconds the page looks broken", () => {
    expect(nextDebounce(9000)).toBe(3000);
  });
});

// Follow-up review §2.1: and which document that last pass was over.
//
// `lastPass` and `saidItIsSlow` were one number and one boolean for the whole
// session. Paste a 2,000-row table into demo.md, open 01-tables.md (8 KB), and
// the next keystroke there waited `nextDebounce(2262)` = 2,262 ms. The reverse
// missed too: switching *into* a heavy document got one 500 ms pass that
// locked the tab, which is the case the debounce was built for. And the
// one-shot message said "this document" about whichever document happened to
// be slow first, then stayed silent while every later one waited three
// seconds with no explanation at all.

describe("whose pass cost it is", () => {
  test("a document nobody has measured waits the floor", () => {
    const costs = createPassCosts();
    expect(nextDebounce(costs.costOf("01-tables.md"))).toBe(500);
  });

  test("a heavy document does not make a light one wait", () => {
    const costs = createPassCosts();
    costs.record("demo.md", 2262);
    expect(costs.costOf("demo.md")).toBe(2262);
    expect(nextDebounce(costs.costOf("01-tables.md"))).toBe(500);
  });

  test("and a light one does not make a heavy one under-wait", () => {
    // What a file switch now measures before the first keystroke lands.
    const costs = createPassCosts();
    costs.record("01-tables.md", 12);
    costs.record("demo.md", 2262);
    expect(nextDebounce(costs.costOf("demo.md"))).toBe(2262);
  });

  test("a re-measurement replaces the old one", () => {
    const costs = createPassCosts();
    costs.record("demo.md", 2262);
    costs.record("demo.md", 40);
    expect(nextDebounce(costs.costOf("demo.md"))).toBe(500);
  });
});

describe("saying out loud that a document is slow", () => {
  test("is not said for a document that is not", () => {
    const costs = createPassCosts();
    expect(costs.record("demo.md", 12)).toBe(false);
    expect(costs.record("demo.md", 250)).toBe(false);
  });

  test("is said once per document, not once per pass", () => {
    const costs = createPassCosts();
    expect(costs.record("demo.md", 2262)).toBe(true);
    expect(costs.record("demo.md", 2300)).toBe(false);
  });

  test("is said again for the *next* slow document", () => {
    // The session-wide one-shot is why a second heavy document got a 3 s wait
    // with nothing in TERMINAL to explain it.
    const costs = createPassCosts();
    expect(costs.record("demo.md", 2262)).toBe(true);
    expect(costs.record("scratch.md", 900)).toBe(true);
  });
});
