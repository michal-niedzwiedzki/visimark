import { expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EditorState, StateEffect, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { build, check, locate } from "visimark";
import { explainBinding } from "visimark-editor-shared/explain.js";
import MarkdownIt from "markdown-it";
import codemirror from "../src/codemirrorContentScript.js";
import markdownIt from "../src/markdownItContentScript.js";
import { installFakeJoplin } from "./fake-joplin.js";

// The fixture scripts/markdown-it-smoke.mjs renders (spec A8).
const fixture = [
  "Total **12.50**<!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax `2.50`<!--vmark=s.tax-->.",
  "",
  "| Item | Qty | Net |",
  "|------|----:|----:|",
  "| pen  |  2  | 10.00 |",
  "",
  "```vmark #s",
  "Net precision 2 = Qty * 5",
  "sub precision 2 = SUM(Net)",
  "tax precision 2 = sub * 0.25",
  "total precision 2 = sub + tax",
  "```",
  "",
].join("\n");

test("A8: the viewer script marks the fixture", () => {
  const md = new MarkdownIt({ html: true });
  markdownIt({}).plugin(md);
  const html = md.render(fixture);
  for (const want of [
    'class="visimark-computed"',
    'data-vmark="s.total"',
    'data-vmark="s.sub"',
    'data-vmark-info="#s"',
  ])
    expect(html).toContain(want);
});

test("the viewer script leaves an html:false instance's output alone", () => {
  const md = new MarkdownIt({ html: false });
  markdownIt({}).plugin(md);
  expect(md.render(fixture)).toBe(new MarkdownIt({ html: false }).render(fixture));
});

test("A9: no CodeMirror 6 editor, no extension", () => {
  const addExtension = mock(() => {});
  codemirror({}).plugin({ addExtension });
  expect(addExtension).not.toHaveBeenCalled();
});

test("A10: a CodeMirror 6 editor gets marks, lint and the marks-off compartment, once", () => {
  const addExtension = mock((_ext: unknown) => {});
  codemirror({}).plugin({ cm6: {}, addExtension });
  expect(addExtension).toHaveBeenCalledTimes(1);
  const [ext] = addExtension.mock.calls[0]!;
  expect(Array.isArray(ext) && ext.length).toBe(3);
});

const drift = readFileSync(join(import.meta.dir, "../../../docs/example-invoice-drift.md"), "utf8");

test("J9: with showMarks off the viewer leaves the note untouched", () => {
  const md = new MarkdownIt({ html: true });
  markdownIt({}).plugin(md, {
    settingValue: (key: string) => (key === "showMarks" ? false : undefined),
  });
  const html = md.render(drift);
  expect(html).not.toContain("visimark-computed");
  expect(html).not.toContain("title=");
  expect(html).toBe(new MarkdownIt({ html: true }).render(drift));
});

test("J10: with showMarks on, every marked value has a title starting with its binding line", () => {
  const md = new MarkdownIt({ html: true });
  markdownIt({}).plugin(md, {
    settingValue: (key: string) => (key === "showMarks" ? true : undefined),
  });
  const doc = new DOMParser().parseFromString(md.render(drift), "text/html");
  const marked = [...doc.querySelectorAll("[data-vmark]")];
  expect(marked.length).toBeGreaterThan(10);
  const model = build(locate(drift));
  const result = check(model);
  for (const el of marked) {
    const explanation = explainBinding(model, result, el.getAttribute("data-vmark")!);
    expect(explanation).not.toBeNull();
    expect(el.getAttribute("title")!.startsWith(explanation!.source.trim())).toBe(true);
  }
  // a cell's title names that cell's own value
  const cell = marked.find((el) => el.getAttribute("data-vmark-row") !== null)!;
  expect(cell.getAttribute("title")).toContain("comes to");
});

test("J10: an import-dependent value gets no title", () => {
  const source = [
    "Grand **2**<!--vmark=order.x--> and net **10.00**<!--vmark=lines.net-->.",
    "",
    "```vmark #order from order.csv labelled Item, Total",
    "x = 1",
    "```",
    "",
    "```vmark #lines",
    "net precision 2 = 10",
    "```",
    "",
  ].join("\n");
  const md = new MarkdownIt({ html: true });
  markdownIt({}).plugin(md, { settingValue: () => true });
  const doc = new DOMParser().parseFromString(md.render(source), "text/html");
  const net = doc.querySelector('[data-vmark="lines.net"]');
  expect(net?.getAttribute("title")).toStartWith("net precision 2 = 10");
  for (const el of doc.querySelectorAll('[data-vmark^="order."]')) {
    expect(el.getAttribute("title")).toBeNull();
  }
});

test("the editor asks for showMarks on load, and setMarks turns the marks off and on", async () => {
  const view = new EditorView({ state: EditorState.create({ doc: drift }), parent: document.body });
  const commands = new Map<string, (...a: unknown[]) => unknown>();
  const asked: unknown[] = [];
  codemirror({
    postMessage: async (m: unknown) => {
      asked.push(m);
      return { showMarks: false };
    },
  }).plugin({
    cm6: view,
    addExtension: (e: unknown) =>
      view.dispatch({ effects: StateEffect.appendConfig.of(e as Extension) }),
    registerCommand: (name: string, f: (...a: unknown[]) => unknown) => void commands.set(name, f),
  });
  await new Promise((r) => setTimeout(r, 0));
  expect(asked).toEqual([{ kind: "settings" }]);
  expect(view.dom.classList.contains("visimark-marks-off")).toBe(true);
  expect(commands.get("visimark.cm.setMarks")!({ show: true })).toEqual({ kind: "ok" });
  expect(view.dom.classList.contains("visimark-marks-off")).toBe(false);
  commands.get("visimark.cm.setMarks")!({ show: false });
  expect(view.dom.classList.contains("visimark-marks-off")).toBe(true);
  view.destroy();
});

test("A11: both scripts ship the one stylesheet", () => {
  expect(codemirror({}).assets()).toEqual([{ name: "visimark.css" }]);
  expect(markdownIt({}).assets()).toEqual([{ name: "visimark.css" }]);
});

test("onStart registers both content scripts with Joplin's type strings, then the commands", async () => {
  const fake = installFakeJoplin();
  await import("../src/index.js");
  await fake.onStart!();
  expect(fake.contentScripts).toEqual([
    ["codeMirrorPlugin", "visimark-codemirror", "./codemirrorContentScript.js"],
    ["markdownItPlugin", "visimark-markdown-it", "./markdownItContentScript.js"],
  ]);
  expect(fake.commands.length).toBeGreaterThan(0);
});

test("the stylesheet hides both marks under visimark-marks-off", () => {
  const css = readFileSync(join(import.meta.dir, "../src/visimark.css"), "utf8");
  // two classes, so it outranks .visimark-disagrees on its own
  expect(css).toMatch(
    /\.visimark-marks-off \.visimark-computed\s*\{\s*text-decoration: none;\s*\}/,
  );
});
