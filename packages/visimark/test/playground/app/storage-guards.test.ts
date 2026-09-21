// Follow-up review §2.6: no localStorage value of any shape may stop the
// editor coming up.
//
// `badges.ts` trusted the store where `buffers.ts` validated it. `loadEarned`
// was `JSON.parse(getItem(…) ?? "{}")` with no shape check, so a stored
// `"null"` — or `"[]"`, or a number — made `earnedBadges[name]` throw a
// `TypeError` inside `createBadgeBoard`, which review §2.1 had placed *inside*
// the boot chain: the whole page died on the fatal overlay, for a record of
// which badges had already been shown.
//
// `buffers.ts`'s own guard stopped one level short of its own standard, so
// both are tested here against the same table of hostile payloads.

import { describe, expect, test } from "bun:test";
import { parseEarned } from "../../../src/playground/app/badges.js";
import { parsePayload } from "../../../src/playground/app/buffers.js";

/** What a hand-edited, half-written or hostile store can hold. Every one of
 *  these has to come back as "nothing saved" rather than as a throw. */
const NOT_A_RECORD = [
  ["absent", null],
  ["empty", ""],
  ["null", "null"],
  ["an array", "[]"],
  ["a populated array", '["a","b"]'],
  ["a number", "7"],
  ["a string", '"hello"'],
  ["a boolean", "true"],
  ["truncated JSON", '{"version":1,"files":{'],
  ["not JSON at all", "<html>"],
] as const;

describe("the earned-badge record", () => {
  for (const [what, raw] of NOT_A_RECORD) {
    test(`${what} reads as no badges earned`, () => {
      expect(parseEarned(raw)).toEqual({});
    });
  }

  test("a well-shaped record survives", () => {
    expect(parseEarned('{"01-tables.md":true}')).toEqual({ "01-tables.md": true });
  });

  test("a well-shaped-but-wrongly-typed entry is dropped, not coerced", () => {
    // `earned(name)` answers a yes/no question; "1" is not an answer to it.
    expect(parseEarned('{"a":1,"b":"yes","c":{},"d":true}')).toEqual({ d: true });
  });

  test("`false` is absence, which is what the writer means by it", () => {
    expect(parseEarned('{"a":false}')).toEqual({});
  });
});

describe("the saved-buffer payload", () => {
  for (const [what, raw] of NOT_A_RECORD) {
    test(`${what} reads as nothing saved`, () => {
      expect(parsePayload(raw)).toEqual({});
    });
  }

  test("a well-shaped payload survives", () => {
    const raw = '{"version":1,"files":{"demo.md":{"base":"abc","text":"# Demo"}}}';
    expect(parsePayload(raw)).toEqual({ "demo.md": { base: "abc", text: "# Demo" } });
  });

  test("a file the visitor created carries a null base", () => {
    const raw = '{"version":1,"files":{"scratch.md":{"base":null,"text":"x"}}}';
    expect(parsePayload(raw)).toEqual({ "scratch.md": { base: null, text: "x" } });
  });

  test("an older version is discarded rather than migrated", () => {
    // The worst case is losing scratch edits, which is why this is the house
    // policy rather than a migration.
    expect(parsePayload('{"version":0,"files":{"demo.md":{"base":null,"text":"x"}}}')).toEqual({});
  });

  test("`files: null` reads as empty", () => {
    // Admitted by the old `typeof payload.files === "object"` and rescued only
    // by the `?? {}` on the line after it.
    expect(parsePayload('{"version":1,"files":null}')).toEqual({});
  });

  test("an entry whose text is not a string is dropped", () => {
    // `{"a": 7}` used to put a number where `cm.setValue` expects text.
    const raw =
      '{"version":1,"files":{"a":7,"b":{"base":null,"text":3},"c":null,' +
      '"d":{"base":5,"text":"x"},"e":{"base":null,"text":"keep"}}}';
    expect(parsePayload(raw)).toEqual({ e: { base: null, text: "keep" } });
  });

  test("one bad entry does not cost the good ones beside it", () => {
    const raw = '{"version":1,"files":{"bad":7,"good":{"base":null,"text":"x"}}}';
    expect(Object.keys(parsePayload(raw))).toEqual(["good"]);
  });
});
