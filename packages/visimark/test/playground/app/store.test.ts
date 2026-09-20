// Review §2.5 and §2.7 where they meet: the store.
//
// §2.5 made "in the catalogue" and "in memory" two different sets, which is
// the source of most of what is checked here — the FILES panel must still
// list twenty documents while one has arrived, a chapter must arrive with the
// data file its synchronous ReaderPort will ask for, and BUILD must be able
// to pull the rest in before it claims to have checked them.
//
// It also pins the bug this work found in the shipped §2.11 refactor: after
// `switchTo(name)`, `text(name)` reads the *editor*, because `name` is now
// the current file — so loading the editor from it is a no-op that looks like
// a file switch. That is exactly what the page did.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { VisiMarkApi } from "../../../src/playground/browser-entry.js";
import { createBufferStore } from "../../../src/playground/app/buffers.js";
import { FILE_SOURCES } from "../../../src/playground/app/sources.js";
import { createStore } from "../../../src/playground/app/store.js";

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;

/** Records what was asked for, so "which documents did boot actually fetch"
 *  is a question the test can answer. */
let requested: string[] = [];

function stubFetch(missing: string[] = []): void {
  requested = [];
  globalThis.fetch = ((path: string) => {
    requested.push(path);
    return Promise.resolve(
      missing.includes(path)
        ? new Response("no", { status: 404 })
        : new Response(`body of ${path}`),
    );
  }) as unknown as typeof fetch;
}

/** Just enough CodeMirror for the store: it only ever reads and writes the
 *  buffer. */
function fakeEditor(initial = ""): CodeMirrorEditor & { value: string } {
  const cm = {
    value: initial,
    getValue: () => cm.value,
    setValue: (v: string) => {
      cm.value = v;
    },
  };
  return cm as unknown as CodeMirrorEditor & { value: string };
}

const VM = {
  memoryReader: () => ({}),
  sha256Hex: (text: string) => [...text].reverse().join(""),
} as unknown as VisiMarkApi;

const digest = (text: string): string => [...text].reverse().join("");

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    },
  };
  stubFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
});

const build = (loaded: Record<string, string>, initial: string) =>
  createStore(VM, fakeEditor(loaded[initial] ?? ""), createBufferStore(digest), loaded, initial);

describe("the catalogue and what has arrived", () => {
  test("every bundled document is listed, whether or not it has been fetched", () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    expect(store.names()).toEqual(Object.keys(FILE_SOURCES));
    expect(store.loaded("demo.md")).toBe(true);
    expect(store.loaded("05-mappers.md")).toBe(false);
  });

  test("opening a document fetches exactly it", async () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    await store.ensure("05-mappers.md");
    expect(requested).toEqual(["playground/tutorial/05-mappers.md"]);
    expect(store.stored("05-mappers.md")).toBe("body of playground/tutorial/05-mappers.md");
  });

  test("a chapter arrives with the data file its reader will be asked for", async () => {
    // The ReaderPort is synchronous — there is no await to reach for once the
    // engine is mid-check — so the CSV has to be in the store before
    // 13-imports.md is evaluated, not when it is read.
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    await store.ensure("13-imports.md");
    expect(requested).toEqual([
      "playground/tutorial/13-imports.md",
      "playground/tutorial/13-imports.csv",
    ]);
  });

  test("a second opening costs no request", async () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    await store.ensure("05-mappers.md");
    requested = [];
    await store.ensure("05-mappers.md");
    expect(requested).toEqual([]);
  });

  test("ensureAll pulls in the rest, which is what BUILD does first", async () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    await store.ensureAll();
    expect(requested).toHaveLength(Object.keys(FILE_SOURCES).length - 1);
    expect(store.names().every((n) => store.loaded(n))).toBe(true);
  });

  test("a document that does not arrive is reported, not thrown", async () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    const failed = await store.ensure("05-mappers.md");
    expect(failed).toHaveLength(0);
    stubFetch(["playground/tutorial/06-aggregates.md"]);
    const second = await store.ensure("06-aggregates.md");
    expect(second.map((f) => f.name)).toEqual(["06-aggregates.md"]);
    expect(store.loaded("06-aggregates.md")).toBe(false);
  });
});

describe("switching files", () => {
  test("switchTo puts the incoming document in the editor", () => {
    // The regression: `text(name)` after the switch reads the editor, because
    // `name` is the current file by then — so a caller doing
    // `cm.setValue(store.text(name))` wrote the outgoing document straight
    // back and the file never changed. The store writes it instead.
    const cm = fakeEditor("# Demo");
    const store = createStore(
      VM,
      cm,
      createBufferStore(digest),
      { "demo.md": "# Demo", "01-tables.md": "| Item |" },
      "demo.md",
    );
    store.switchTo("01-tables.md");
    expect(cm.value).toBe("| Item |");
    // ...and the trap itself is still there, which is why the store does it:
    expect(store.text("01-tables.md")).toBe("| Item |");
    expect(store.stored("demo.md")).toBe("# Demo");
  });

  test("the outgoing buffer is kept", () => {
    const cm = fakeEditor("# Demo");
    const store = createStore(
      VM,
      cm,
      createBufferStore(digest),
      { "demo.md": "# Demo", "01-tables.md": "| Item |" },
      "demo.md",
    );
    cm.value = "# Demo edited";
    store.switchTo("01-tables.md");
    expect(store.stored("demo.md")).toBe("# Demo edited");
  });
});

describe("what counts as edited", () => {
  test("a bundled document differing from its shipped text", () => {
    const cm = fakeEditor("# Demo");
    const store = createStore(
      VM,
      cm,
      createBufferStore(digest),
      { "demo.md": "# Demo" },
      "demo.md",
    );
    expect(store.isDirty("demo.md")).toBe(false);
    cm.value = "# Demo edited";
    expect(store.isDirty("demo.md")).toBe(true);
  });

  test("a document edited last session but not yet opened this one", () => {
    // Otherwise a chapter the visitor changed looks untouched in FILES until
    // the moment they click it — the new gap §2.5 opened up.
    const buffers = createBufferStore(digest);
    buffers.save("09-units.md", "edited", "bundled");
    const store = createStore(VM, fakeEditor(), buffers, { "demo.md": "# Demo" }, "demo.md");
    expect(store.loaded("09-units.md")).toBe(false);
    expect(store.isDirty("09-units.md")).toBe(true);
  });

  test("never a file the visitor created — there is nothing to revert to", () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    store.add("scratch.md", "# mine");
    expect(store.isDirty("scratch.md")).toBe(false);
    expect(store.revert("scratch.md")).toBeUndefined();
  });
});

describe("reverting", () => {
  test("one file goes back to the text the page shipped with", () => {
    const cm = fakeEditor("# Demo");
    const store = createStore(
      VM,
      cm,
      createBufferStore(digest),
      { "demo.md": "# Demo" },
      "demo.md",
    );
    cm.value = "# wrecked";
    store.flush();
    expect(store.revert("demo.md")).toBe("# Demo");
    expect(store.stored("demo.md")).toBe("# Demo");
    expect(cm.value).toBe("# Demo");
    expect(store.isDirty("demo.md")).toBe(false);
  });

  test("reset all reaches documents this session never loaded", async () => {
    // A saved copy of a chapter the visitor has not opened is still shadowing
    // the bundled one; "reset all" that left it in place would leave the
    // surprise it was pressed to explain.
    const buffers = createBufferStore(digest);
    buffers.save("09-units.md", "edited", "bundled");
    const cm = fakeEditor("# Demo");
    const store = createStore(VM, cm, buffers, { "demo.md": "# Demo" }, "demo.md");
    cm.value = "# wrecked";
    store.flush();
    expect(store.revertAll()).toBe(2);
    expect(buffers.has("09-units.md")).toBe(false);
    expect(store.isDirty("demo.md")).toBe(false);
  });

  test("files the visitor created survive it", () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    store.add("scratch.md", "# mine");
    store.revertAll();
    expect(store.names()).toContain("scratch.md");
    expect(store.stored("scratch.md")).toBe("# mine");
  });
});

describe("restoring across a reload", () => {
  test("a saved copy replaces the bundled text as it arrives", async () => {
    const buffers = createBufferStore(digest);
    buffers.save("05-mappers.md", "my version", "body of playground/tutorial/05-mappers.md");
    const store = createStore(VM, fakeEditor(), buffers, { "demo.md": "# Demo" }, "demo.md");
    await store.ensure("05-mappers.md");
    expect(store.stored("05-mappers.md")).toBe("my version");
    expect(store.isDirty("05-mappers.md")).toBe(true);
  });

  test("a copy of a document that has since changed is dropped", async () => {
    const buffers = createBufferStore(digest);
    buffers.save("05-mappers.md", "my version", "what the chapter used to say");
    const store = createStore(VM, fakeEditor(), buffers, { "demo.md": "# Demo" }, "demo.md");
    await store.ensure("05-mappers.md");
    expect(store.stored("05-mappers.md")).toBe("body of playground/tutorial/05-mappers.md");
    expect(buffers.discarded()).toEqual(["05-mappers.md"]);
  });

  test("a file the visitor created is back in the catalogue", () => {
    const buffers = createBufferStore(digest);
    buffers.save("scratch.md", "# mine", null);
    const store = createStore(VM, fakeEditor(), buffers, { "demo.md": "# Demo" }, "demo.md");
    expect(store.names()).toContain("scratch.md");
    expect(store.stored("scratch.md")).toBe("# mine");
  });
});

describe("adding a file", () => {
  test("refuses a name a bundled document already owns, loaded or not", () => {
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    expect(store.loaded("09-units.md")).toBe(false);
    expect(store.add("09-units.md", "x")).toBe(false);
    expect(store.add("scratch.md", "x")).toBe(true);
    expect(store.add("scratch.md", "y")).toBe(false);
  });
});

describe("two callers wanting the same document at once", () => {
  // Follow-up review §2.8. `fetchMissing` filters against `contents`, which is
  // only written when a response lands — so a click during the idle-time
  // prefetch re-requested a document already on its way: 19 prefetch requests,
  // and the click makes 20. It never corrupted anything, but only because
  // `text()` prefers the editor buffer and `buffers.restore` replays the edit
  // — two unstated invariants absorbing a race neither was designed for.

  /** A fetch whose responses are released by hand, so "in flight" is a state
   *  the test can hold the store in. */
  function heldFetch(): { release: () => void } {
    requested = [];
    const waiting: (() => void)[] = [];
    globalThis.fetch = ((path: string) => {
      requested.push(path);
      return new Promise((resolve) => {
        waiting.push(() => resolve(new Response(`body of ${path}`)));
      });
    }) as unknown as typeof fetch;
    return {
      release: () => {
        for (const w of waiting.splice(0, waiting.length)) w();
      },
    };
  }

  test("share one request", async () => {
    const held = heldFetch();
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    const first = store.ensure("05-mappers.md");
    const second = store.ensure("05-mappers.md");
    held.release();
    await Promise.all([first, second]);
    expect(requested).toEqual(["playground/tutorial/05-mappers.md"]);
  });

  test("and both resolve with the document in the store", async () => {
    const held = heldFetch();
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    const first = store.ensure("05-mappers.md");
    const second = store.ensure("05-mappers.md");
    held.release();
    expect(await first).toEqual([]);
    expect(await second).toEqual([]);
    expect(store.stored("05-mappers.md")).toBe("body of playground/tutorial/05-mappers.md");
  });

  test("a click during the prefetch adds no request", async () => {
    // The scenario as reported: ensureAll() is in the air, the visitor clicks
    // a chapter, and switchTo calls ensure() for a file already on its way.
    const held = heldFetch();
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    const all = store.ensureAll();
    const duringPrefetch = requested.length;
    const click = store.ensure("05-mappers.md");
    expect(requested).toHaveLength(duringPrefetch);
    held.release();
    await Promise.all([all, click]);
    expect(requested).toHaveLength(Object.keys(FILE_SOURCES).length - 1);
  });

  test("the prefetch does not re-fetch what a click is already pulling in", async () => {
    // The same race the other way round.
    const held = heldFetch();
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    const click = store.ensure("05-mappers.md");
    const all = store.ensureAll();
    held.release();
    await Promise.all([click, all]);
    const mappers = requested.filter((p) => p.endsWith("05-mappers.md"));
    expect(mappers).toHaveLength(1);
  });

  test("a late response cannot overwrite an edit made while it was in flight", async () => {
    // What `receive()`'s at-most-once guard is protecting: the file became
    // current and was edited between the request going out and landing.
    const held = heldFetch();
    const cm = fakeEditor("# Demo");
    const store = createStore(
      VM,
      cm,
      createBufferStore(digest),
      { "demo.md": "# Demo", "05-mappers.md": "bundled mappers" },
      "demo.md",
    );
    store.switchTo("05-mappers.md");
    cm.value = "my edit";
    store.flush();
    const pending = store.ensureAll();
    held.release();
    await pending;
    expect(store.stored("05-mappers.md")).toBe("my edit");
  });

  test("a fetch that settles leaves nothing behind to block the next one", async () => {
    // The in-flight entry is deleted on settle, including on failure — so a
    // document that did not arrive can still be asked for again.
    stubFetch(["playground/tutorial/06-aggregates.md"]);
    const store = build({ "demo.md": "# Demo" }, "demo.md");
    expect(await store.ensure("06-aggregates.md")).toHaveLength(1);
    stubFetch();
    expect(await store.ensure("06-aggregates.md")).toEqual([]);
    expect(store.loaded("06-aggregates.md")).toBe(true);
  });
});

describe("a file the visitor created, named in the URL", () => {
  // Follow-up review §2.5: boot resolves `?file=` against FILE_SOURCES *and*
  // the created names, so the store has to be able to start on one — with
  // nothing fetched, because there is nothing to fetch it from.
  test("boots as the current file with its saved text in the editor", () => {
    const buffers = createBufferStore(digest);
    buffers.save("scratch.md", "# mine", null);
    const cm = fakeEditor();
    const store = createStore(VM, cm, buffers, {}, "scratch.md");
    expect(store.current()).toBe("scratch.md");
    expect(cm.value).toBe("# mine");
    expect(store.names()).toContain("scratch.md");
  });
});
