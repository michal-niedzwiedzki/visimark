import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { check, build, locate } from "visimark";
import { refresh, visimark, type VisimarkOptions } from "../src/index.js";
import { findingsField } from "../src/findings-field.js";
import { marksIn } from "../src/plugin.js";

const docs = resolve(import.meta.dir, "../../../docs");
const read = (p: string): string => readFileSync(join(docs, p), "utf8");
const invoice = read("example-invoice.md");
const drift = read("example-invoice-drift.md");
// The imports chapter declares `grand_total = SUM(Total)` over an imported CSV
// but anchors it nowhere; one anchored sentence gives the extension a mark
// that depends on the import. Without a reader it is withheld; with one, the
// snapshot shows it disagreeing (its stored text is 0). Checked against the
// engine while planning.
const imports = read("playground/tutorial/13-imports.md");
const importsAnchored = imports + "\nGrand total: **0**<!--vmark=order.grand_total-->\n";
const IMPORT_PATH = "playground/tutorial/13-imports.md";
const GRAND = "order.grand_total";
const NAME = "lines.net_total";
const ANCHORED_TEXT = "23300.00 PLN";
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(r));

/** A test-only stand-in for a host's mode: Obsidian's Live Preview field, say. */
const setOn = StateEffect.define<boolean>();
const onField = StateField.define<boolean>({
  create: () => true,
  update: (v, tr) => tr.effects.reduce((acc, e) => (e.is(setOn) ? e.value : acc), v),
});

function viewOver(doc: string, options: VisimarkOptions = {}): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [onField, visimark({ active: (s) => s.field(onField), ...options })],
  });
  return new EditorView({ state, parent: document.body });
}
const marks = (view: EditorView): Element[] => [...view.dom.querySelectorAll("[data-vmark]")];
const named = (view: EditorView, name: string): Element[] => [
  ...view.dom.querySelectorAll(`[data-vmark="${name}"]`),
];

test("E1: an ordinary note shows nothing and publishes an empty finding set", async () => {
  const view = viewOver("# notes\n\nplain text\n");
  await tick();
  expect(marks(view)).toHaveLength(0);
  expect(view.state.field(findingsField)).toEqual([]);
  view.destroy();
});

test("E2: computed and disagrees marks match the engine's STALE set", async () => {
  // counted from the plugin's decoration set, not the DOM: CodeMirror renders
  // only the viewport, and the drift invoice is longer than happy-dom's
  const view = viewOver(drift);
  const result = check(build(locate(drift)));
  const staleStarts = result.findings
    .filter((f) => f.code === "STALE" && f.span)
    .map((f) => f.span!.start)
    .sort((a, b) => a - b);
  const all = marksIn(view);
  const disagreeStarts = all.filter((m) => m.disagrees).map((m) => m.from);
  expect(disagreeStarts).toEqual(staleStarts); // 14 on the drift invoice today
  expect(all.length).toBeGreaterThan(disagreeStarts.length);
  view.destroy();
});

test("E3: active false shows nothing; flipping it recomputes in the same update", () => {
  const view = viewOver(invoice);
  view.dispatch({ effects: setOn.of(false) });
  expect(marks(view)).toHaveLength(0);
  view.dispatch({ effects: setOn.of(true) });
  expect(named(view, NAME)).toHaveLength(1);
  view.destroy();
});

const ANCHOR_LINE = `Net of tax the engagement comes to **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;
const insertAt = invoice.indexOf(ANCHOR_LINE) + ANCHOR_LINE.length;
const duplicate = ` Again: **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;

test("E4: debounced — an edit maps marks at once, the recompute waits 400 ms", async () => {
  const view = viewOver(invoice);
  view.dispatch({
    changes: [
      { from: 0, insert: "x".repeat(50) },
      { from: insertAt, insert: duplicate },
    ],
  });
  expect(named(view, NAME)).toHaveLength(1);
  expect(named(view, NAME)[0]?.textContent).toBe(ANCHORED_TEXT);
  await wait(600);
  expect(named(view, NAME)).toHaveLength(2);
  view.destroy();
});

test("E5: on-refresh — an edit only maps; refresh recomputes synchronously", async () => {
  const view = viewOver(invoice, { recompute: "on-refresh" });
  view.dispatch({ changes: { from: insertAt, insert: duplicate } });
  await wait(600);
  expect(named(view, NAME)).toHaveLength(1);
  view.dispatch({ effects: refresh.of(null) });
  expect(named(view, NAME)).toHaveLength(2);
  view.destroy();
});

test("E6: an import-dependent mark is withheld without a reader", async () => {
  const view = viewOver(importsAnchored);
  await tick();
  expect(view.state.field(findingsField)).toBeNull(); // imported sheet, no snapshot
  expect(named(view, GRAND)).toHaveLength(0);
  view.destroy();
});

const repoRead = async (p: string): Promise<string | null> => {
  try {
    return readFileSync(join(docs, p), "utf8");
  } catch {
    return null;
  }
};

test("E7: with a path and a reader, the snapshot fills the withheld marks and findings", async () => {
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: repoRead,
    recompute: "on-refresh",
  });
  await wait(50);
  const grand = named(view, GRAND);
  expect(grand).toHaveLength(1);
  expect(grand[0]!.classList.contains("visimark-disagrees")).toBe(true);
  expect(grand[0]!.getAttribute("data-vmark-path")).toBe(IMPORT_PATH);
  expect(view.state.field(findingsField)?.some((f) => f.code === "STALE")).toBe(true);
  view.destroy();
});

test("E8: a snapshot that lands after an edit is dropped", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: async (p) => {
      await gate;
      return repoRead(p);
    },
    recompute: "on-refresh",
  });
  view.dispatch({ changes: { from: 0, insert: "# edited\n\n" } });
  release();
  await wait(50);
  expect(named(view, GRAND)).toHaveLength(0);
  view.destroy();
});

test("E9: focusableMarks puts tabindex on every mark; the default puts it on none", () => {
  const plain = viewOver(invoice);
  expect(plain.dom.querySelectorAll("[data-vmark][tabindex]")).toHaveLength(0);
  plain.destroy();
  const focusable = viewOver(invoice, { focusableMarks: true });
  for (const el of marks(focusable)) expect(el.getAttribute("tabindex")).toBe("0");
  focusable.destroy();
});

test("Review 3: destroying the view while a read is in flight dispatches nothing", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const view = viewOver(importsAnchored, {
    path: () => IMPORT_PATH,
    readImport: async (p) => {
      await gate;
      return repoRead(p);
    },
    recompute: "on-refresh",
  });
  view.destroy();
  release();
  await wait(50); // a dispatch on a destroyed view would throw here
});

test("Review 4: a reader that rejects or returns null leaves withheld marks withheld", async () => {
  for (const readImport of [async () => null, async () => Promise.reject(new Error("gone"))]) {
    const view = viewOver(importsAnchored, {
      path: () => IMPORT_PATH,
      readImport,
      recompute: "on-refresh",
    });
    await wait(50);
    expect(named(view, GRAND)).toHaveLength(0);
    view.destroy();
  }
});

test("Review 5: deleting the last vmark block clears every mark on the next recompute", () => {
  const view = viewOver(invoice, { recompute: "on-refresh" });
  expect(marks(view).length).toBeGreaterThan(0);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# gone\n" } });
  view.dispatch({ effects: refresh.of(null) });
  expect(marks(view)).toHaveLength(0);
  view.destroy();
});

test("debounced: a pause in typing does not wait a second debounce for the snapshot", async () => {
  // CodeRabbit on #363: the recompute is already debounced, so the snapshot it
  // needs must start at once, not 400 ms later with the marks withheld meanwhile
  const view = viewOver(importsAnchored, { path: () => IMPORT_PATH, readImport: repoRead });
  await wait(600);
  expect(named(view, GRAND)).toHaveLength(1);
  // typed at the end: the chapter opens with its fence, so text typed at the
  // start would turn the block into prose
  view.dispatch({ changes: { from: view.state.doc.length, insert: "x" } });
  await wait(550); // past the 400 ms recompute, well short of a second 400 ms
  expect(named(view, GRAND)).toHaveLength(1);
  view.destroy();
});
