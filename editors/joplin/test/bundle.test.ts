import { expect, test } from "bun:test";
import { build, type Metafile } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENTRIES, options } from "../build.js";

/**
 * Builds exactly what ships — `options` from build.ts, in memory — and reads
 * esbuild's metafile, not the minified bytes: `{node:e}` object keys in the
 * engine make a grep for `node:` lie (#378 pre-review, question 8).
 */
const out = mkdtempSync(join(tmpdir(), "joplin-bundle-"));
const metas: Record<string, Metafile> = {};
for (const entry of ENTRIES) {
  const r = await build({ ...options(entry, out), write: false, logLevel: "silent" });
  metas[entry.name] = r.metafile!;
}
const imports = (m: Metafile) => Object.values(m.outputs).flatMap((o) => o.imports);

test("A1: no CodeMirror or Lezer source is bundled", () => {
  for (const m of Object.values(metas))
    for (const input of Object.keys(m.inputs))
      expect(input).not.toMatch(/node_modules\/@(codemirror|lezer)\//);
});

test("A2: no node: import survives", () => {
  for (const m of Object.values(metas))
    for (const i of imports(m)) expect(i.path.startsWith("node:")).toBe(false);
});

test("A3: the editor script imports only what Joplin provides", () => {
  const ext = imports(metas.codemirrorContentScript!).filter((i) => i.external);
  expect(ext.length).toBeGreaterThan(0);
  for (const i of ext) expect(i.path).toMatch(/^@(codemirror|lezer)\//);
});

test("A4: the entry point and the viewer script import nothing", () => {
  expect(imports(metas.index!).filter((i) => i.external)).toEqual([]);
  expect(imports(metas.markdownItContentScript!).filter((i) => i.external)).toEqual([]);
});

test("the entry point is a plain script: no module, exports or require", async () => {
  const entry = ENTRIES.find((e) => e.name === "index")!;
  const r = await build({ ...options(entry, out), write: false, logLevel: "silent" });
  const js = r.outputFiles![0]!.text;
  expect(js).toContain("joplin.plugins.register");
  expect(js).not.toMatch(/\bmodule\b|\bexports\b|\brequire\(/);
});
