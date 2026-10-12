import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import visimark from "../src/index.js";

const fixtures = join(import.meta.dir, "fixtures");
const source = readFileSync(join(fixtures, "three-anchors.md"), "utf8");
const expected = readFileSync(join(fixtures, "three-anchors.html"), "utf8");
const plain = (src: string, html = true): string => new MarkdownIt({ html }).render(src);
const marked = (
  opts?: Parameters<typeof visimark>[1],
  html = true,
): InstanceType<typeof MarkdownIt> => new MarkdownIt({ html }).use(visimark, opts);

test("the fixture renders exactly the spec's marked HTML", () => {
  expect(marked().render(source)).toBe(expected);
});

test("path adds data-vmark-path last on every mark, never on the fence", () => {
  const out = marked({ path: () => "/tmp/note.md" }).render(source);
  expect(out).toContain(
    '<strong class="visimark-computed" data-vmark="s.total" data-vmark-path="/tmp/note.md">',
  );
  expect(out).toContain(
    '<span class="visimark-computed" data-vmark="s.Net" data-vmark-row="0" data-vmark-path="/tmp/note.md">',
  );
  expect(out.match(/data-vmark-path=/g)?.length).toBe(4);
});

test("a stale cell is visimark-disagrees; the prose marks stay computed", () => {
  const out = marked().render(source.replace("| 10.00 |", "| 9.00 |"));
  expect(out).toContain(
    '<span class="visimark-computed visimark-disagrees" data-vmark="s.Net" data-vmark-row="0">9.00</span>',
  );
  expect(out.match(/visimark-disagrees/g)?.length).toBe(1);
});

test("html: false is byte-identical to markdown-it without the plugin", () => {
  expect(marked(undefined, false).render(source)).toBe(plain(source, false));
});

test("a document with no vmark fence is byte-identical", () => {
  const doc = "Total **12.50**<!--vmark=s.total-->.\n\n| a |\n|---|\n| 1 |\n";
  expect(marked().render(doc)).toBe(plain(doc));
});

test("VS Code's shape: parse with one env, render with another; path comes from the render env", () => {
  const md = marked({ path: (env) => (env as { file?: string } | undefined)?.file ?? null });
  const tokens = md.parse(source, {});
  const out = md.renderer.render(tokens, md.options, { file: "/tmp/note.md" });
  expect(out).toContain('data-vmark-path="/tmp/note.md"');
});

test("the host's tokens are never mutated, and a second render is identical", () => {
  const md = marked();
  const tokens = md.parse(source, {});
  const before = JSON.stringify(tokens);
  const first = md.renderer.render(tokens, md.options, {});
  const second = md.renderer.render(tokens, md.options, {});
  expect(second).toBe(first);
  expect(JSON.stringify(tokens)).toBe(before);
});

test("two documents alternating on one instance each get only their own marks", () => {
  const md = marked();
  const other = source.replaceAll("s.", "t.").replace("```vmark #s", "```vmark #t");
  expect(md.render(source)).toBe(expected);
  expect(md.render(other)).not.toContain('data-vmark="s.');
  expect(md.render(source)).toBe(expected);
});

test("the same instance follows the path of each render", () => {
  const md = marked({ path: (env) => (env as { p?: string }).p ?? null });
  expect(md.render(source, { p: "/a.md" })).toContain('data-vmark-path="/a.md"');
  expect(md.render(source, { p: "/b.md" })).toContain('data-vmark-path="/b.md"');
  expect(md.render(source, {})).not.toContain("data-vmark-path");
});

test("a value whose rendered text no longer matches its source is left unmarked", () => {
  // a rewrite in the spirit of linkify: the bare value's text token no longer ends in it
  const md = new MarkdownIt({ html: true });
  md.core.ruler.push("rewrite", (state) => {
    for (const t of state.tokens) {
      for (const c of t.children ?? []) if (c.content.endsWith("10.00")) c.content += "x";
    }
  });
  md.use(visimark);
  const out = md.render(source);
  expect(out).not.toContain('data-vmark="s.sub"');
  expect(out).toContain('data-vmark="s.total"');
  // a cell is addressed by position and its inline content is still the source's
  expect(out).toContain('data-vmark="s.Net"');
});

test("path() or readImport throwing renders the host's own HTML", () => {
  const boom = (): never => {
    throw new Error("boom");
  };
  // from Task 4 on the fence wrapper still adds data-vmark-info, so compare without it
  const bare = (html: string): string => html.replace(/ data-vmark-info="[^"]*"/g, "");
  expect(bare(marked({ path: boom }).render(source))).toBe(plain(source));
  const csvPath = join(import.meta.dir, "..", "..", "..", "docs", "example-invoice-csv-import.md");
  const csv = readFileSync(csvPath, "utf8");
  expect(bare(marked({ path: () => csvPath, readImport: boom }).render(csv))).toBe(plain(csv));
});

test("a refused anchor before a valid one with the same comment does not steal its mark", () => {
  // the first comment follows bare prose the engine refuses as a target; the
  // second follows a value it binds. Matching walks every located anchor, so
  // the first comment consumes the refused anchor, not the valid one.
  const doc = source.replace(
    "subtotal 10.00<!--vmark=s.sub-->",
    "subtotal about ten<!--vmark=s.sub--> or exactly **10.00**<!--vmark=s.sub-->",
  );
  expect(marked().render(doc)).toContain(
    '<strong class="visimark-computed" data-vmark="s.sub">10.00</strong>',
  );
});
