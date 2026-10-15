import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

import { expect, test } from "bun:test";
import { createEditor, minimalChange } from "../../src/playground/editor.js";

function mount(text = ""): HTMLTextAreaElement {
  const host = document.createElement("div");
  const ta = document.createElement("textarea");
  ta.value = text;
  host.appendChild(ta);
  document.body.appendChild(host);
  return ta;
}

test("minimalChange replaces only the differing middle", () => {
  expect(minimalChange("a 1 b", "a 22 b")).toEqual({ from: 2, to: 3, insert: "22" });
  expect(minimalChange("same", "same")).toBeNull();
  expect(minimalChange("", "x")).toEqual({ from: 0, to: 0, insert: "x" });
  expect(minimalChange("abc", "")).toEqual({ from: 0, to: 3, insert: "" });
});

test("the textarea is replaced by the editor, which starts with its text", () => {
  const ta = mount("hello");
  const parent = ta.parentElement!;
  const ed = createEditor(ta);
  expect(parent.contains(ta)).toBe(false);
  expect(parent.contains(ed.view.dom)).toBe(true);
  expect(ed.getValue()).toBe("hello");
  ed.view.destroy();
});

test("setValue reports origin setValue; typing reports +input", () => {
  const ed = createEditor(mount("one"));
  const origins: (string | undefined)[] = [];
  ed.on("change", (_i, c) => origins.push(c.origin));
  ed.setValue("two");
  ed.view.dispatch({ changes: { from: 0, insert: "x" } });
  expect(origins).toEqual(["setValue", "+input"]);
  ed.view.destroy();
});

test("setValue with identical text dispatches no change", () => {
  const ed = createEditor(mount("same"));
  let n = 0;
  ed.on("change", () => n++);
  ed.setValue("same");
  expect(n).toBe(0);
  ed.view.destroy();
});

test("the cursor survives a setValue that rewrites text before it on the same line", () => {
  const ed = createEditor(mount("total = 10\nnext line"));
  ed.setCursor({ line: 1, ch: 4 });
  ed.setValue("total = 1000\nnext line");
  expect(ed.getCursor()).toEqual({ line: 1, ch: 4 });
  ed.view.destroy();
});

test("the cursor stays right after a value shortened on its own line", () => {
  // `**612**` restored to `**6**` with the cursor after 612: it belongs after
  // the 6, inside the bold, not past the closing ** (#360, spec P2)
  const ed = createEditor(mount("x = **612**<!--vmark=s.b-->"));
  ed.setCursor({ line: 0, ch: 9 });
  ed.setValue("x = **6**<!--vmark=s.b-->");
  expect(ed.getCursor()).toEqual({ line: 0, ch: 7 });
  ed.view.destroy();
});

test("setCursor clamps to the document", () => {
  const ed = createEditor(mount("ab\ncd"));
  ed.setCursor({ line: 9, ch: 9 });
  expect(ed.getCursor()).toEqual({ line: 1, ch: 2 });
  ed.view.destroy();
});

test("setLabel names the editable surface for assistive tech", () => {
  const ed = createEditor(mount(""));
  ed.setLabel("Editor: notes.md");
  expect(ed.view.contentDOM.getAttribute("aria-label")).toBe("Editor: notes.md");
  ed.view.destroy();
});

test("refreshMarks calls the host's refresh with the view", () => {
  let seen: unknown = null;
  const ed = createEditor(mount(""), { refresh: (v) => (seen = v) });
  ed.refreshMarks();
  expect(seen).toBe(ed.view);
  ed.view.destroy();
});

test("load starts a fresh history, so undo cannot pull in the previous file", async () => {
  // CodeRabbit on #364: a file switch must not be an undoable edit of the
  // file it replaced
  const { undo } = await import("@codemirror/commands");
  const ed = createEditor(mount("first file"));
  ed.view.dispatch({ changes: { from: 0, insert: "typed " } });
  ed.load("second file");
  undo(ed.view);
  expect(ed.getValue()).toBe("second file");
  ed.view.destroy();
});

test("load keeps the editor's extensions and reports no change", () => {
  let changes = 0;
  const ed = createEditor(mount("a"));
  ed.on("change", () => changes++);
  ed.load("b\nc");
  expect(ed.getValue()).toBe("b\nc");
  expect(changes).toBe(0);
  expect(ed.view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();
  ed.view.destroy();
});

test("a vmark fence is tokenized as the vmark language (#367)", async () => {
  const { ensureSyntaxTree } = await import("@codemirror/language");
  const doc = "# t\n\n```vmark #s\ntotal = SUM(Net)\n```\n";
  const ed = createEditor(mount(doc));
  const tree = ensureSyntaxTree(ed.view.state, doc.length, 5000)!;
  expect(tree.resolveInner(doc.indexOf("SUM") + 1, 1).name).toBe("variableName.function");
  ed.view.destroy();
});
