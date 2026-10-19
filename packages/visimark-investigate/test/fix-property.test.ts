import { describe, expect, test } from "bun:test";
import { applyEdits } from "../src/apply.js";
import { investigate, type InvestigateInput } from "../src/investigate.js";
import { engine, fixture, fixtureDirs } from "./support.js";

const single = (text: string): InvestigateInput => ({
  repo: { label: "x", host: null, commit: "c", lastCommit: null },
  engineVersion: "0",
  paths: [{ path: "bad.md", size: text.length }],
  texts: new Map([["bad.md", text]]),
  skipped: [],
  workflowTexts: [],
  clonePath: null,
});

describe("applying a finding's fix removes it", () => {
  for (const id of fixtureDirs()) {
    test(id, () => {
      const text = fixture(id, "bad.md");
      const before = investigate(single(text), engine).findings;
      const fixed = before.filter((f) => f.fix);
      const after = investigate(
        single(
          applyEdits(
            text,
            fixed.flatMap((f) => f.fix!),
          ),
        ),
        engine,
      ).findings;
      const fixedIds = new Set(fixed.map((f) => f.id));
      expect(after.filter((f) => fixedIds.has(f.id))).toEqual([]);
      for (const f of before) if (!f.fix) expect("fix" in f).toBe(false);
    });
  }
});

describe("applyEdits", () => {
  test("refuses an edit whose old text does not match", () => {
    expect(() => applyEdits("abc", [{ from: 0, to: 1, old: "x", new: "y" }])).toThrow();
  });

  test("applies several edits regardless of order", () => {
    expect(
      applyEdits("a1b2", [
        { from: 1, to: 2, old: "1", new: "10" },
        { from: 3, to: 4, old: "2", new: "20" },
      ]),
    ).toBe("a10b20");
  });
});
