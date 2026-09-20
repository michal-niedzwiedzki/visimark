// Follow-up review §2.10: BUILD can be left permanently disabled, and it
// checks the current file twice.
//
// `btn.disabled = false` was not in a `finally`, so anything thrown above it
// — a DOM failure, a `byId` miss after a markup edit — left the button dead
// with "running…" beside it and no way back except a reload. And `checkOne`
// ran a second time at the end purely to decide whether to emit one quest
// signal, recomputing an outcome the loop above had already produced: a full
// locate+build+check over what may be the largest document in the store, which
// on the 2,000-row document §2.10 measured is 2.2 seconds spent twice.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FakeDocument, FakeElement } from "../../support/fake-dom.js";
import { installFakeDom } from "../../support/fake-dom.js";
import type { VisiMarkApi } from "../../../src/playground/browser-entry.js";
import type { FileStore } from "../../../src/playground/app/store.js";
import type { Pipeline } from "../../../src/playground/app/pipeline.js";
import type { Quest } from "../../../src/playground/app/quest.js";
import type { Terminal } from "../../../src/playground/app/terminal.js";
import { createBuildPanel } from "../../../src/playground/app/builder.js";

const NOTHING = (): void => {};

let dom: ReturnType<typeof installFakeDom>;
let doc: FakeDocument;
let btn: FakeElement;
let statusEl: FakeElement;
/** Every name `VM.check` was run over, in order. */
let checked: string[];
let signals: string[];

const DOCUMENTS = ["demo.md", "01-tables.md", "02-inference.md"];

function makeVM(): VisiMarkApi {
  return {
    locate: (source: string) => source,
    build: (located: string) => located,
    check: (built: string) => {
      checked.push(built);
      return { findings: [], assertions: [], exitCode: 0 };
    },
    formatCheck: () => "",
  } as unknown as VisiMarkApi;
}

function makeStore(): FileStore {
  return {
    flush: NOTHING,
    ensureAll: () => Promise.resolve([]),
    // A CSV sits in the catalogue for the engine to read, not for `check`.
    names: () => [...DOCUMENTS, "13-imports.csv"],
    loaded: () => true,
    text: (name: string) => name,
    current: () => "01-tables.md",
    optsFor: () => ({}),
  } as unknown as FileStore;
}

function build(terminal: Partial<Terminal> = {}): void {
  btn = doc.add("button", "build-btn");
  statusEl = doc.add("span", "build-status");
  doc.add("div", "build-body");
  const quest = (): Quest => ({
    render: NOTHING,
    signal: (a: string) => signals.push(a),
    checkEval: NOTHING,
  });
  const pipeline = { setStatus: NOTHING } as unknown as Pipeline;
  createBuildPanel(
    makeVM(),
    makeStore(),
    { line: NOTHING, cmd: NOTHING, clear: NOTHING, ...terminal },
    pipeline,
    quest,
  );
}

/** Presses BUILD and waits for its `await store.ensureAll()` to settle. */
async function press(): Promise<void> {
  btn.click();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  dom = installFakeDom();
  doc = dom.document;
  checked = [];
  signals = [];
});
afterEach(() => dom.restore());

describe("a normal press", () => {
  test("checks each document exactly once, including the current one", async () => {
    build();
    await press();
    expect(checked).toEqual(DOCUMENTS);
  });

  test("still emits the current file's quest signal", async () => {
    // The signal is what the second check was there for; it now reads the
    // outcome the panel is displaying instead of asking for a second opinion.
    build();
    await press();
    expect(signals).toEqual(["action:build-run", "action:build-pass:01-tables.md"]);
  });

  test("re-enables the button and reports the summary", async () => {
    build();
    await press();
    expect(btn.hidden).toBe(false);
    expect((btn as unknown as { disabled: boolean }).disabled).toBe(false);
    expect(statusEl.textContent).toBe("3/3 files passing");
  });
});

describe("a press that throws", () => {
  test('says so, rather than leaving the panel stuck on "running…"', async () => {
    const said: string[] = [];
    build({
      cmd: () => {
        throw new Error("the markup and the bundle disagree");
      },
      line: (text) => said.push(text),
    });
    await press();
    expect(statusEl.textContent).toBe("stopped");
    expect(said.join("\n")).toContain("the markup and the bundle disagree");
  });

  test("leaves the button usable", async () => {
    // Anything at all between `disabled = true` and the re-enable: here the
    // terminal echo, which is the first thing the run does after the fetch.
    build({
      cmd: () => {
        throw new Error("the markup and the bundle disagree");
      },
    });
    await press();
    expect((btn as unknown as { disabled: boolean }).disabled).toBe(false);
  });

  test("and a second press works", async () => {
    let fail = true;
    build({
      cmd: () => {
        if (fail) throw new Error("once");
      },
    });
    await press();
    fail = false;
    await press();
    expect(checked).toEqual(DOCUMENTS);
    expect(statusEl.textContent).toBe("3/3 files passing");
  });
});
