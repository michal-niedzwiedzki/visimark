import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decorationsFor } from "../../codemirror-visimark/src/decorations.js";
import { importDependentNames } from "../../codemirror-visimark/src/import-deps.js";
import visimark from "../src/index.js";
import { runPass } from "../src/pass.js";

if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

const repo = join(import.meta.dir, "..", "..", "..");
const read = (p: string): string => readFileSync(p, "utf8");
const doc = (name: string): string => join(repo, "docs", name);
const fixture = read(join(import.meta.dir, "fixtures", "three-anchors.md"));
const disk = (p: string): string | null => {
  try {
    return read(p);
  } catch {
    return null;
  }
};
const parse = (html: string): HTMLElement => {
  const el = document.createElement("div");
  el.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes);
  return el;
};

test("drift invoice: one visimark-disagrees per decoration on an exact STALE span", () => {
  const source = read(doc("example-invoice-drift.md"));
  const pass = runPass(source, null, undefined);
  const want = decorationsFor(pass.model, pass.result).filter(
    (d) => d.mark === "disagrees" && !pass.withheld.has(d.name),
  ).length;
  expect(want).toBeGreaterThan(0);
  const el = parse(new MarkdownIt({ html: true }).use(visimark).render(source));
  expect(el.querySelectorAll(".visimark-disagrees").length).toBe(want);
});

test("a clean example has computed marks and no disagrees", () => {
  const el = parse(
    new MarkdownIt({ html: true }).use(visimark).render(read(doc("example-invoice.md"))),
  );
  expect(el.querySelectorAll(".visimark-computed").length).toBeGreaterThan(0);
  expect(el.querySelectorAll(".visimark-disagrees").length).toBe(0);
});

test("CSV import: withheld without a reader or a path, present with both", () => {
  const path = doc("example-invoice-csv-import.md");
  const source = read(path);
  const pass = runPass(source, path, disk);
  const dependent = importDependentNames(pass.model);
  const names = (html: string): string[] =>
    [...parse(html).querySelectorAll("[data-vmark]")].map((e) => e.getAttribute("data-vmark")!);

  const without = names(
    new MarkdownIt({ html: true }).use(visimark, { readImport: disk }).render(source),
  );
  const noPath = names(
    new MarkdownIt({ html: true })
      .use(visimark, { path: () => null, readImport: disk })
      .render(source),
  );
  const nullReader = names(
    new MarkdownIt({ html: true })
      .use(visimark, { path: () => path, readImport: () => null })
      .render(source),
  );
  const withBoth = names(
    new MarkdownIt({ html: true })
      .use(visimark, { path: () => path, readImport: disk })
      .render(source),
  );
  for (const list of [without, noPath, nullReader]) {
    expect(list.filter((n) => dependent.has(n))).toEqual([]);
  }
  expect(withBoth.some((n) => dependent.has(n))).toBe(true);
  // every non-dependent mark is present in all four
  for (const n of withBoth.filter((n) => !dependent.has(n))) expect(without).toContain(n);
});

for (const [label, make] of [
  ["typographer", () => new MarkdownIt({ html: true, typographer: true }).use(visimark)],
  ["linkify", () => new MarkdownIt({ html: true, linkify: true }).use(visimark)],
  ["footnote before", () => new MarkdownIt({ html: true }).use(footnote).use(visimark)],
  ["footnote after", () => new MarkdownIt({ html: true }).use(visimark).use(footnote)],
] as const) {
  test(`${label}: the fixture's four marks and data-vmark-info still land`, () => {
    const el = parse(make().render(fixture + "\nA note.[^1]\n\n[^1]: Footnote text.\n"));
    const names = [...el.querySelectorAll("[data-vmark]")].map((e) => e.getAttribute("data-vmark"));
    expect(names.sort()).toEqual(["s.Net", "s.sub", "s.tax", "s.total"]);
    expect(el.querySelector('pre[data-vmark-info="#s"]')).not.toBeNull();
  });
}

test("an unrelated table before the sheet's table: only the sheet's table is marked", () => {
  const source = "| Net |\n|----:|\n| 10.00 |\n\n" + fixture;
  const el = parse(new MarkdownIt({ html: true }).use(visimark).render(source));
  const tables = el.querySelectorAll("table");
  expect(tables[0]!.querySelector("[data-vmark]")).toBeNull();
  expect(tables[1]!.querySelector('td [data-vmark="s.Net"]')).not.toBeNull();
});
