import { expect, mock, test } from "bun:test";
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

test("A10: a CodeMirror 6 editor gets marks and lint, once", () => {
  const addExtension = mock((_ext: unknown) => {});
  codemirror({}).plugin({ cm6: {}, addExtension });
  expect(addExtension).toHaveBeenCalledTimes(1);
  const [ext] = addExtension.mock.calls[0]!;
  expect(Array.isArray(ext) && ext.length).toBe(2);
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
