import { beforeAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = join(import.meta.dir, "..");
const dist = join(here, "dist");

beforeAll(() => {
  const r = Bun.spawnSync(["bun", "run", "build"], { cwd: here, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
});

const text = (f: string): string => readFileSync(join(dist, f), "utf8");

test("index.js and index.d.ts are built, nothing else is published from dist", () => {
  expect(readdirSync(dist).sort()).toEqual(["index.d.ts", "index.js"]);
});

test("no node: specifier survives into the bundle", () => {
  const found = [...text("index.js").matchAll(/["'`](node:[a-z_/]+)["'`]/g)].map((m) => m[1]);
  expect(found).toEqual([]);
});

test("the declarations import nothing and export only the public surface", () => {
  const d = text("index.d.ts");
  expect(/from\s+"/.test(d)).toBe(false);
  for (const name of ["MarkdownItVisimarkOptions", "ReadImportSync"]) expect(d).toContain(name);
});

test("the built bundle renders the fixture", async () => {
  const { default: plugin } = await import(join(dist, "index.js"));
  const { default: MarkdownIt } = await import("markdown-it");
  const fixture = readFileSync(join(here, "test", "fixtures", "three-anchors.md"), "utf8");
  const expected = readFileSync(join(here, "test", "fixtures", "three-anchors.html"), "utf8");
  expect(new MarkdownIt({ html: true }).use(plugin).render(fixture)).toBe(expected);
});

// The package's own bunfig preloads happy-dom, so the test above has a DOM.
// A markdown-it host is as often Node or an Electron main process, so the
// bundle must also load where `document` does not exist.
test("the built bundle loads and renders with no DOM", () => {
  const markdownIt = Bun.resolveSync("markdown-it", here);
  const fixture = readFileSync(join(here, "test", "fixtures", "three-anchors.md"), "utf8");
  const expected = readFileSync(join(here, "test", "fixtures", "three-anchors.html"), "utf8");
  const script = [
    `if (typeof document !== "undefined") throw new Error("a DOM is present");`,
    `const { default: MarkdownIt } = await import(${JSON.stringify(markdownIt)});`,
    `const { default: plugin } = await import(${JSON.stringify(join(dist, "index.js"))});`,
    `process.stdout.write(new MarkdownIt({ html: true }).use(plugin).render(${JSON.stringify(fixture)}));`,
  ].join("\n");
  const r = Bun.spawnSync(["bun", "-e", script], { cwd: tmpdir(), stdout: "pipe", stderr: "pipe" });
  expect(new TextDecoder().decode(r.stderr)).toBe("");
  expect(new TextDecoder().decode(r.stdout)).toBe(expected);
});
