import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { history, undo } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { hasVmarkBlock } from "codemirror-visimark/gate.js";
import { TEMPLATES } from "visimark-editor-shared/templates.js";
import { editorCommands } from "../src/editor-commands.js";
import type { InferPreviewReply } from "../src/protocol.js";

const docs = resolve(import.meta.dir, "../../../docs");
const invoice = readFileSync(join(docs, "example-invoice.md"), "utf8");

const views: EditorView[] = [];
afterEach(() => {
  for (const v of views.splice(0)) v.destroy();
});
function editor(doc: string): { view: EditorView; run: ReturnType<typeof editorCommands> } {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [history()] }),
    parent: document.body,
  });
  views.push(view);
  return { view, run: editorCommands(view) };
}

// A pasted table with a computed column and no block yet.
const pasted = [
  "# Groceries",
  "",
  "| Item | Price | Qty | Total |",
  "|---|---|---|---|",
  "| Pen  | 5     | 2   | 10    |",
  "| Cup  | 3     | 4   | 12    |",
  "| Mug  | 6     | 3   | 18    |",
  "| Bag  | 2     | 5   | 10    |",
  "",
].join("\n");

test("Infer previews, and Apply writes it as one transaction one undo removes", () => {
  const { view, run } = editor(pasted);
  const preview = run.inferPreview() as InferPreviewReply;
  expect(preview.kind).toBe("preview");
  if (preview.kind !== "preview") return;
  expect(preview.empty).toBe(false);
  expect(preview.description).toContain("VisiMark can work out");
  expect(run.apply({ version: preview.version, edits: preview.edits })).toEqual({
    kind: "applied",
  });
  expect(hasVmarkBlock(view.state.doc.toString())).toBe(true);
  undo(view);
  expect(view.state.doc.toString()).toBe(pasted);
});

test("Infer scopes to a non-empty selection", () => {
  const second = `${pasted}\n${pasted.replace("# Groceries", "# More")}`;
  const { view, run } = editor(second);
  const all = run.inferPreview() as InferPreviewReply;
  const at = second.indexOf("# More");
  view.dispatch({ selection: { anchor: at, head: second.length } });
  const scoped = run.inferPreview() as InferPreviewReply;
  if (all.kind !== "preview" || scoped.kind !== "preview") throw new Error("no preview");
  expect(scoped.edits.length).toBeGreaterThan(0);
  expect(scoped.edits.length).toBeLessThan(all.edits.length);
});

test("Infer on prose with no arithmetic says so", () => {
  const { run } = editor("# Notes\n\nJust words.\n");
  const preview = run.inferPreview() as InferPreviewReply;
  expect(preview.kind).toBe("preview");
});

test("J6: apply after a document change answers changed, and the document is untouched", () => {
  const { view, run } = editor(pasted);
  const preview = run.inferPreview() as InferPreviewReply;
  if (preview.kind !== "preview") throw new Error(preview.kind);
  view.dispatch({ changes: { from: 0, insert: "x" } });
  const before = view.state.doc.toString();
  expect(run.apply({ version: preview.version, edits: preview.edits })).toEqual({
    kind: "changed",
  });
  expect(view.state.doc.toString()).toBe(before);
});

test("J6: a stale version from an earlier preview is refused too", () => {
  const { run } = editor(pasted);
  const first = run.inferPreview() as InferPreviewReply;
  run.inferPreview();
  if (first.kind !== "preview") throw new Error(first.kind);
  expect(run.apply({ version: first.version, edits: first.edits })).toEqual({ kind: "changed" });
});

test("J5: a template is refused on a note with a block, and inserted into an empty one", () => {
  const withBlock = editor(invoice);
  expect(withBlock.run.insertTemplate({ id: "invoice" })).toEqual({ kind: "has-block" });
  expect(withBlock.view.state.doc.toString()).toBe(invoice);

  for (const template of TEMPLATES) {
    const empty = editor("");
    expect(empty.run.insertTemplate({ id: template.id })).toEqual({ kind: "inserted" });
    const body = empty.view.state.doc.toString();
    expect(body).toContain(template.body);
    expect(hasVmarkBlock(body)).toBe(true);
    undo(empty.view);
    expect(empty.view.state.doc.toString()).toBe("");
  }
});

test("a template lands below the line the cursor is on, never inside it", () => {
  const { view, run } = editor("Intro line.\n");
  view.dispatch({ selection: { anchor: 3 } });
  expect(run.insertTemplate({ id: "budget" })).toEqual({ kind: "inserted" });
  expect(view.state.doc.toString().startsWith("Intro line.\n\n")).toBe(true);
});

test("a template has no place inside an unclosed fence", () => {
  // a ~~~ fence that never closes swallows everything after it, ``` included
  const { run } = editor("~~~\nopen fence\n");
  expect(run.insertTemplate({ id: "invoice" })).toEqual({ kind: "no-place" });
});

test("the content script registers the authoring commands", async () => {
  const { default: codemirror } = await import("../src/codemirrorContentScript.js");
  const names: string[] = [];
  const { view } = editor("");
  codemirror({}).plugin({
    cm6: view,
    addExtension: () => {},
    registerCommand: (name: string) => void names.push(name),
  });
  expect(names).toContain("visimark.cm.inferPreview");
  expect(names).toContain("visimark.cm.apply");
  expect(names).toContain("visimark.cm.insertTemplate");
});
