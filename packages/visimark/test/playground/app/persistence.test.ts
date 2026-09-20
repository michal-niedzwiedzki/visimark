// Follow-up review §2.4: every path that writes the editor also persists.
//
// Four things write the buffer — typing, a file switch, "+ New", and "Infer
// and write" — and exactly one of them did not save. `runInfer(true)` called
// `store.setText` but never `store.persist`, then called
// `cancelPendingRefresh()`, killing the typing-settle that would otherwise
// have caught it; and `cm.setValue` fires `change` with origin "setValue",
// which the handler skips, so no new timer was scheduled either. §2.7's "done
// when" is *a reload preserves edits*, and this was the one edit path where it
// did not.
//
// So all four are exercised here rather than the one that was broken.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FakeDocument } from "../../support/fake-dom.js";
import { installFakeDom } from "../../support/fake-dom.js";
import type { VisiMarkApi } from "../../../src/playground/browser-entry.js";
import type { BufferStore } from "../../../src/playground/app/buffers.js";
import type { Pipeline } from "../../../src/playground/app/pipeline.js";
import type { Quest } from "../../../src/playground/app/quest.js";
import type { Terminal } from "../../../src/playground/app/terminal.js";
import { createBufferStore } from "../../../src/playground/app/buffers.js";
import { createInferPanel } from "../../../src/playground/app/infer.js";
import { createPipeline } from "../../../src/playground/app/pipeline.js";
import { createStore } from "../../../src/playground/app/store.js";

const digest = (text: string): string => [...text].reverse().join("");

/** Enough CodeMirror for the pipeline and the infer panel: a buffer, a
 *  cursor, and the two events they subscribe to. */
function fakeEditor(initial = ""): CodeMirrorEditor & {
  value: string;
  type(text: string): void;
} {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const cm = {
    value: initial,
    getValue: () => cm.value,
    setValue: (v: string) => {
      cm.value = v;
      for (const h of handlers.change ?? []) h(cm, { origin: "setValue" });
    },
    getCursor: () => ({ line: 0, ch: 0 }),
    setCursor: () => {},
    getScrollInfo: () => ({ top: 0, height: 0, clientHeight: 0 }),
    scrollTo: () => {},
    getInputField: () => ({ setAttribute: () => {} }),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      (handlers[event] ??= []).push(handler);
    },
    /** What a keystroke looks like from the pipeline's side. */
    type(text: string) {
      cm.value = text;
      for (const h of handlers.change ?? []) h(cm, { origin: "+input" });
    },
  };
  return cm as unknown as CodeMirrorEditor & { value: string; type(text: string): void };
}

const VM = {
  memoryReader: () => ({}),
  sha256Hex: digest,
  fmt: (source: string) => ({
    changed: false,
    output: source,
    unfixable: [],
    artifacts: [],
    cellsUpdated: 0,
    anchorsUpdated: 0,
    datesFixed: 0,
  }),
  pgEval: () => ({ assertions: [], charts: [] }),
  pgExplain: () => [],
  check: () => ({ findings: [], assertions: [], exitCode: 0 }),
  build: () => ({}),
  locate: () => ({}),
  formatCheck: () => "",
  infer: () => ({ proposals: [] }),
  formatInfer: () => "proposals",
  planInfer: () => [{ kind: "block" }],
  applyEdits: () => "# Quote\n\n```vmark #q\nNet = Qty * Rate\n```\n",
} as unknown as VisiMarkApi;

const NOTHING = (): void => {};
const quest = (): Quest => ({ render: NOTHING, signal: NOTHING, checkEval: NOTHING });
const terminal: Terminal = { line: NOTHING, cmd: NOTHING, clear: NOTHING };

let dom: ReturnType<typeof installFakeDom>;
let doc: FakeDocument;
let buffers: BufferStore;

/** What a reload would find: the text this browser has saved for `name`. */
const saved = (name: string, original: string | null): string | undefined =>
  createBufferStore(digest).restore(name, original);

beforeEach(() => {
  dom = installFakeDom();
  doc = dom.document;
  const backing = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    },
    matchMedia: () => ({ matches: false }),
  };
  buffers = createBufferStore(digest);
});
afterEach(() => dom.restore());

describe("the four writers to the editor buffer", () => {
  test("a file switch saves the outgoing document", () => {
    const cm = fakeEditor("# Demo");
    const store = createStore(VM, cm, buffers, { "demo.md": "# Demo", "a.md": "A" }, "demo.md");
    cm.value = "# Demo edited";
    store.switchTo("a.md");
    expect(saved("demo.md", "# Demo")).toBe("# Demo edited");
  });

  test("+ New saves the file it creates", () => {
    const store = createStore(
      VM,
      fakeEditor("# Demo"),
      buffers,
      { "demo.md": "# Demo" },
      "demo.md",
    );
    store.add("scratch.md", "# Untitled\n");
    expect(saved("scratch.md", null)).toBe("# Untitled\n");
  });

  test("the typing-settle saves what was typed", async () => {
    const cm = fakeEditor("# Demo");
    const store = createStore(VM, cm, buffers, { "demo.md": "# Demo" }, "demo.md");
    for (const id of [
      "knowledge-body",
      "reasoning-body",
      "preview-body",
      "build-flag",
      "build-label",
      "build-meta",
    ]) {
      doc.add("div", id);
    }
    (globalThis as { marked?: unknown }).marked = { parse: (s: string) => s };
    createPipeline(VM, cm, store, terminal, quest);
    cm.type("# Demo typed");
    // The 500 ms debounce floor, plus room for the pass itself.
    await new Promise((r) => setTimeout(r, 700));
    expect(saved("demo.md", "# Demo")).toBe("# Demo typed");
  });

  test("Infer and write saves the block it wrote", () => {
    const cm = fakeEditor("# Quote\n");
    const store = createStore(VM, cm, buffers, { "demo.md": "# Quote\n" }, "demo.md");
    doc.add("div", "infer-body");
    doc.add("button", "infer-btn");
    const writeBtn = doc.add("button", "infer-write-btn");
    const pipeline: Pipeline = {
      runFmt: () => null,
      refreshDerived: NOTHING,
      runNow: NOTHING,
      setStatus: NOTHING,
      hasStaleFindings: () => false,
      // The call that used to kill the only settle that would have saved this.
      cancelPendingRefresh: NOTHING,
      onSettled: NOTHING,
      knowledgeText: () => "",
    };
    createInferPanel(VM, cm, store, terminal, pipeline, quest);

    writeBtn.click();

    const written = "# Quote\n\n```vmark #q\nNet = Qty * Rate\n```\n";
    expect(cm.value).toBe(written);
    expect(store.stored("demo.md")).toBe(written);
    // The one that was missing: what a reload would find.
    expect(saved("demo.md", "# Quote\n")).toBe(written);
  });
});
