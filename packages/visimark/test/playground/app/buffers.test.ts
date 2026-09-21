// Review §2.7: the visitor's edits across a reload.
//
// The interesting behaviour here is not "it saves" — it is what happens when
// a saved copy and the document it was edited from disagree. A playground
// whose whole subject is values that silently stop matching their source
// must not silently serve a stale copy of a chapter, so an entry carries the
// digest of the text it was derived from and is thrown away when that stops
// matching. These tests are that rule, from both sides.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createBufferStore } from "../../../src/playground/app/buffers.js";

const KEY = "visimark-playground-buffers";

/** A localStorage that can be made to fail, which is the state that matters:
 *  private browsing and a full quota are the two cases §2.7 asked to degrade
 *  rather than break. */
function fakeStorage(): { store: Map<string, string>; fail: boolean; api: Storage } {
  const state = { store: new Map<string, string>(), fail: false, api: null as unknown as Storage };
  state.api = {
    getItem: (k: string) => {
      if (state.fail) throw new Error("SecurityError");
      return state.store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (state.fail) throw new Error("QuotaExceededError");
      state.store.set(k, v);
    },
    removeItem: (k: string) => void state.store.delete(k),
    clear: () => state.store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  return state;
}

let storage: ReturnType<typeof fakeStorage>;
const realWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  storage = fakeStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage.api };
});
afterEach(() => {
  (globalThis as { window?: unknown }).window = realWindow;
});

/** A digest that is just the text reversed — enough to be a function of the
 *  content, which is all this module asks of it. */
const digest = (text: string): string => [...text].reverse().join("");

describe("what gets stored", () => {
  test("a buffer equal to the bundled text is not stored at all", () => {
    const buffers = createBufferStore(digest);
    buffers.save("a.md", "original", "original");
    expect(buffers.has("a.md")).toBe(false);
    // and nothing was written at all — an unmodified document costs no I/O,
    // which matters because this runs on every typing-settle
    expect(storage.store.get(KEY)).toBeUndefined();
  });

  test("editing stores it, and editing back clears it again", () => {
    const buffers = createBufferStore(digest);
    buffers.save("a.md", "changed", "original");
    expect(buffers.has("a.md")).toBe(true);
    buffers.save("a.md", "original", "original");
    expect(buffers.has("a.md")).toBe(false);
  });
});

describe("a saved copy against the document it came from", () => {
  test("comes back when the bundled document has not moved", () => {
    createBufferStore(digest).save("a.md", "mine", "original");
    const next = createBufferStore(digest);
    expect(next.restore("a.md", "original")).toBe("mine");
    expect(next.discarded()).toEqual([]);
  });

  test("is discarded — and reported — when the bundled document has changed", () => {
    createBufferStore(digest).save("a.md", "mine", "original");
    const next = createBufferStore(digest);
    expect(next.restore("a.md", "rewritten upstream")).toBeUndefined();
    expect(next.discarded()).toEqual(["a.md"]);
    // and it is gone for good, not re-offered on the next reload
    expect(next.has("a.md")).toBe(false);
    expect(createBufferStore(digest).has("a.md")).toBe(false);
  });

  test("the report drains, because discards arrive over time", () => {
    // Most documents are fetched after first paint (review §2.5), so the
    // caller asks more than once and must not be told the same thing twice.
    createBufferStore(digest).save("a.md", "mine", "original");
    const next = createBufferStore(digest);
    next.restore("a.md", "moved on");
    expect(next.discarded()).toEqual(["a.md"]);
    expect(next.discarded()).toEqual([]);
  });
});

describe("files the visitor created", () => {
  test("have no original to drift from, so they always come back", () => {
    createBufferStore(digest).save("scratch.md", "# mine", null);
    const next = createBufferStore(digest);
    expect(next.createdNames()).toEqual(["scratch.md"]);
    expect(next.restore("scratch.md", null)).toBe("# mine");
  });

  test("are not confused with edited bundled documents", () => {
    const buffers = createBufferStore(digest);
    buffers.save("scratch.md", "# mine", null);
    buffers.save("01-tables.md", "edited", "bundled");
    expect(createBufferStore(digest).createdNames()).toEqual(["scratch.md"]);
  });
});

describe("resetting", () => {
  test("forget drops one, forgetAll drops the rest", () => {
    const buffers = createBufferStore(digest);
    buffers.save("a.md", "x", "a");
    buffers.save("b.md", "y", "b");
    buffers.forget("a.md");
    expect(buffers.has("a.md")).toBe(false);
    expect(buffers.has("b.md")).toBe(true);
    buffers.forgetAll();
    expect(buffers.has("b.md")).toBe(false);
    expect(createBufferStore(digest).has("b.md")).toBe(false);
  });
});

describe("when localStorage will not cooperate", () => {
  test("an unreadable store boots empty rather than throwing", () => {
    storage.fail = true;
    const buffers = createBufferStore(digest);
    expect(buffers.createdNames()).toEqual([]);
    expect(buffers.restore("a.md", "original")).toBeUndefined();
  });

  test("a failing write leaves the session working", () => {
    // Private browsing or a full quota: the edit is still in memory and the
    // page behaves exactly as it did before §2.7 — only the reload is lost,
    // which is where this started.
    const buffers = createBufferStore(digest);
    storage.fail = true;
    expect(() => buffers.save("a.md", "changed", "original")).not.toThrow();
    expect(buffers.has("a.md")).toBe(true);
  });

  test("a payload from another version is ignored, not migrated", () => {
    storage.store.set(
      KEY,
      JSON.stringify({ version: 99, files: { "a.md": { base: null, text: "x" } } }),
    );
    expect(createBufferStore(digest).has("a.md")).toBe(false);
  });

  test("a corrupt payload is ignored", () => {
    storage.store.set(KEY, "{not json");
    expect(createBufferStore(digest).createdNames()).toEqual([]);
  });
});
