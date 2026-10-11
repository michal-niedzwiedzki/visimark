import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

import { expect, test } from "bun:test";
import { createEditor, minimalChange } from "../../../src/playground/app/editor.js";

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
