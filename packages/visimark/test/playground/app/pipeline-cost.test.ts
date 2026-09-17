// Review §2.10, the half of it that ships.
//
// The measurement is in docs/design/playground-pipeline-cost-plan.md: a pass
// costs 12–20 ms for anything the playground holds, and 2.3 s for a 2,000-row
// paste. So the debounce stopped being a constant and became a floor — the
// next wait is at least as long as the last pass took, which turns a
// continuous lock into one lock per typing pause.

import { describe, expect, test } from "bun:test";
import { nextDebounce } from "../../../src/playground/app/pipeline.js";

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
