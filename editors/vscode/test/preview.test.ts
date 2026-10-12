import { beforeAll, expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activateExtension, createHost, fakeUri, type Host } from "./host.js";

const root = join(import.meta.dir, "..");
const repo = join(root, "..", "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const csvPath = join(repo, "docs", "example-invoice-csv-import.md");

let host: Host;
let api: { extendMarkdownIt<T>(md: T): T };
let activation: { activationError: unknown; exports?: unknown };

beforeAll(async () => {
  host = createHost();
  // The language client's start fails under this host, as it does in VS Code
  // when the server cannot start; the preview must not depend on it.
  activation = await activateExtension();
  api = activation.exports as typeof api;
});

test("the manifest contributes the preview plugin, its stylesheet and the setting", () => {
  expect(pkg.contributes["markdown.markdownItPlugins"]).toBe(true);
  expect(pkg.contributes["markdown.previewStyles"]).toEqual(["./media/preview.css"]);
  expect(pkg.contributes.configuration.properties["visimark.preview.enable"].default).toBe(true);
});

test("activate returns extendMarkdownIt even when the language server fails to start", () => {
  expect(activation.activationError).toBeUndefined();
  expect(typeof api?.extendMarkdownIt).toBe("function");
});

test("extendMarkdownIt marks a preview rendered VS Code's way", () => {
  const md = api.extendMarkdownIt(new MarkdownIt({ html: true }));
  const source = readFileSync(csvPath, "utf8");
  const tokens = md.parse(source, { currentDocument: undefined });
  const out = md.renderer.render(tokens, md.options, {
    currentDocument: fakeUri("file://" + csvPath),
  });
  expect(out).toContain("visimark-computed");
  expect(out).toContain(`data-vmark-path="${csvPath}"`);
});

test("an untitled document has no path, so no data-vmark-path", () => {
  const md = api.extendMarkdownIt(new MarkdownIt({ html: true }));
  const out = md.render(readFileSync(join(repo, "docs", "example-invoice.md"), "utf8"), {
    currentDocument: fakeUri("untitled:Untitled-1"),
  });
  expect(out).toContain("visimark-computed");
  expect(out).not.toContain("data-vmark-path");
});

test("visimark.preview.enable false: the instance is returned unextended", () => {
  host.config.set("visimark.preview.enable", false);
  const md = new MarkdownIt({ html: true });
  const src = readFileSync(join(repo, "docs", "example-invoice.md"), "utf8");
  expect(api.extendMarkdownIt(md).render(src)).toBe(new MarkdownIt({ html: true }).render(src));
  host.config.delete("visimark.preview.enable");
});

test("toggling the setting reloads the preview's plugins; other settings do not", () => {
  host.executed.length = 0;
  host.changeConfig("visimark.check.debounce", 500);
  expect(host.executed).not.toContain("markdown.api.reloadPlugins");
  host.changeConfig("visimark.preview.enable", false);
  expect(host.executed).toContain("markdown.api.reloadPlugins");
  host.config.delete("visimark.preview.enable");
});
