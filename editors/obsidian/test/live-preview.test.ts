import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorView } from "@codemirror/view";
import type { Editor } from "obsidian";
import { CmState } from "./harness/cm-state.js";
// `setLivePreviewForTest` doesn't exist on real `obsidian` (it's a
// harness-only test hook), and `editorLivePreviewField` is imported straight
// from the harness rather than through the `"obsidian"` specifier so `tsc`
// checks it against the same declaration `mock.module` swaps in at runtime,
// not against real `obsidian.d.ts`.
import { editorLivePreviewField, setLivePreviewForTest } from "./harness/obsidian.js";
import { refresh } from "codemirror-visimark";
import { editorViewOf, livePreviewMarks } from "../src/live-preview.js";

const { EditorState } = CmState;

/**
 * Review row 17's regression tests. The old code rebuilt `locate` + `build`
 * + `check` synchronously on every `docChanged` (measured ~9ms per keystroke
 * on a note-sized document); these prove the fix's three parts against a
 * real `@codemirror/view` `EditorView`, not a stub: a mark is mapped, not
 * recomputed, on the same tick as the edit; the real recompute happens once
 * on a debounce; and the whole extension is gated on
 * `editorLivePreviewField`, recomputing immediately on a mode switch or a
 * forced settings refresh rather than waiting on the debounce or the next
 * keystroke.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const invoice = readFileSync(join(docs, "example-invoice.md"), "utf8");
const NAME = "lines.net_total";
const ANCHORED_TEXT = "23300.00 PLN";

const noopRead = async (): Promise<string> => {
  throw new Error("not modelled: no vault reads expected in this test");
};

function viewOver(doc: string): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [editorLivePreviewField, livePreviewMarks(() => true, noopRead)],
  });
  // `cm-state.ts`'s own doc comment explains why: this `EditorState` and
  // `EditorView`'s constructor both ultimately come from the exact same
  // installed `@codemirror/state`, but `tsc` sees them through two different
  // `import` resolutions of it and can't tell they agree. Test-only.
  return new EditorView({ state: state as unknown as EditorView["state"], parent: document.body });
}

function marksNamed(view: EditorView, name: string): Element[] {
  return [...view.dom.querySelectorAll(`[data-vmark="${name}"]`)];
}

test("an ordinary note (no vmark block) shows nothing, in Live Preview or not", () => {
  const view = viewOver("# Groceries\n\n- milk\n- eggs\n");
  expect(view.dom.querySelectorAll("[data-vmark]")).toHaveLength(0);
  view.destroy();
});

test("a computed value is marked immediately when Live Preview is active from the start", () => {
  const view = viewOver(invoice);
  const found = marksNamed(view, NAME);
  expect(found).toHaveLength(1);
  expect(found[0]?.textContent).toBe(ANCHORED_TEXT);
  view.destroy();
});

test("Source mode shows nothing, and switching to Live Preview recomputes immediately", () => {
  const view = viewOver(invoice);
  view.dispatch({ effects: setLivePreviewForTest.of(false) });
  expect(view.dom.querySelectorAll("[data-vmark]")).toHaveLength(0);

  view.dispatch({ effects: setLivePreviewForTest.of(true) });
  const found = marksNamed(view, NAME);
  expect(found).toHaveLength(1);
  expect(found[0]?.textContent).toBe(ANCHORED_TEXT);
  view.destroy();
});

test("switching back to Source mode clears marks immediately, not on the next edit", () => {
  const view = viewOver(invoice);
  expect(marksNamed(view, NAME)).toHaveLength(1);
  view.dispatch({ effects: setLivePreviewForTest.of(false) });
  expect(view.dom.querySelectorAll("[data-vmark]")).toHaveLength(0);
  view.destroy();
});

// The line the anchored value already lives on — inserting the duplicate
// right after it (rather than at the end of the document) keeps both
// occurrences inside CodeMirror's rendered viewport, which is what the DOM
// assertions below read from.
const ANCHOR_LINE = `Net of tax the engagement comes to **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;
const insertAt = invoice.indexOf(ANCHOR_LINE) + ANCHOR_LINE.length;
const duplicateAnchor = ` Again: **${ANCHORED_TEXT}**<!--vmark=${NAME}--> PLN.`;

test("the settings toggle's refresh recomputes immediately, without the debounce", () => {
  const view = viewOver(invoice);
  view.dispatch({ changes: { from: insertAt, insert: duplicateAnchor } });

  expect(marksNamed(view, NAME)).toHaveLength(1); // mapped only, so far

  view.dispatch({ effects: refresh.of(null) });

  expect(marksNamed(view, NAME)).toHaveLength(2); // recomputed synchronously
  view.destroy();
});

test("every Obsidian mark is focusable, for the tap listener", () => {
  const view = viewOver(invoice);
  const all = view.dom.querySelectorAll("[data-vmark]");
  expect(all.length).toBeGreaterThan(0);
  for (const el of all) expect(el.getAttribute("tabindex")).toBe("0");
  view.destroy();
});

test("editorViewOf reaches the `cm` property a real CM6-backed Editor carries", () => {
  const fakeView = {} as EditorView;
  const fakeEditor = { cm: fakeView } as unknown as Editor;
  expect(editorViewOf(fakeEditor)).toBe(fakeView);
});

test("editorViewOf is undefined for an editor with no `cm` — Source mode's legacy editor, or this harness's own stub", () => {
  const fakeEditor = {} as Editor;
  expect(editorViewOf(fakeEditor)).toBeUndefined();
});
