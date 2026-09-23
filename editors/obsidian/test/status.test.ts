import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, locate } from "visimark";
import { reportFor } from "../src/report.js";
import { HIDDEN, UNKNOWN, statusFor } from "../src/status.js";

/**
 * v1 constraint 6 is the thing this file exists to keep: **no red, no
 * `STALE`, no "1 problem (1 stale, 0 errors)"**. The status bar is the single
 * most likely place for the report's vocabulary to leak back in, because it is
 * the smallest surface and a count is the obvious thing to put in it.
 *
 * A count is not what is forbidden. The shape is.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const report = (name: string) => {
  const model = build(locate(readFileSync(join(docs, name), "utf8")));
  return reportFor(model, check(model));
};

test("a clean note says so, and says nothing else", () => {
  const s = statusFor(report("example-invoice.md"));
  expect(s.text).toBe("VisiMark ✓");
  expect(s.detail).toBe("Everything in this note agrees with its formulas.");
});

test("a drifted note says how many, in words a reader has", () => {
  const s = statusFor(report("example-invoice-drift.md"));
  expect(s.text).toMatch(/^VisiMark · \d+ to look at$/);
  expect(s.detail).toMatch(/^\d+ things need attention in this note\./);
});

test("nothing anywhere carries the report's vocabulary", () => {
  const states = [
    statusFor(report("example-invoice.md")),
    statusFor(report("example-invoice-drift.md")),
    HIDDEN,
    UNKNOWN,
  ];
  for (const s of states) {
    for (const banned of ["STALE", "COVERAGE", "WARN", "UNDEF", "exit", "error"]) {
      expect(`${s.text} ${s.detail}`, `"${s.text}" / "${s.detail}"`).not.toContain(banned);
    }
    expect(`${s.text} ${s.detail}`.toLowerCase()).not.toContain("problem");
  }
});

test("advice alone never turns a note into one that needs attention", () => {
  // the engine's own isProblem splits them, and a note whose only finding is
  // "defined but never used" agrees with itself. Saying otherwise would train
  // a reader to ignore the status bar, which is the one thing it cannot
  // recover from.
  const adviceOnly = {
    problems: [],
    advice: [{}, {}] as never[],
    allRepairs: [],
  };
  const s = statusFor(adviceOnly);
  expect(s.text).toBe("VisiMark ✓");
  expect(s.detail).toContain("2 notes are worth knowing about");
});

test("a note that could not be checked is not reported as clean", () => {
  // §3.1: the plugin never shows a clean state for a note it failed to check
  expect(UNKNOWN.text).not.toContain("✓");
  expect(UNKNOWN.detail).toContain("could not be checked");
});

test("a note with no block shows nothing at all", () => {
  // v1 constraint 4: a vault of ordinary notes is indistinguishable from one
  // without the plugin installed
  expect(HIDDEN.text).toBe("");
  expect(HIDDEN.detail).toBe("");
});

test("one of each reads as English, not as a template", () => {
  const one = statusFor({ problems: [{}] as never[], advice: [{}] as never[], allRepairs: [] });
  expect(one.text).toBe("VisiMark · 1 to look at");
  expect(one.detail).toBe("1 thing needs attention in this note. 1 more is worth knowing.");
});
