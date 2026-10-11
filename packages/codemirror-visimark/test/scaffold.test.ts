import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
const engine = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "..", "visimark", "package.json"), "utf8"),
);

test("the package version is the engine's", () => {
  expect(manifest.version).toBe(engine.version);
});

test("the manifest names no engine and no runtime dependency", () => {
  expect(manifest.dependencies).toBeUndefined();
  expect(manifest.bin).toBeUndefined();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    expect(Object.keys(manifest[field] ?? {})).not.toContain("visimark");
  }
});

test("the peer floors are the spec's", () => {
  expect(manifest.peerDependencies).toEqual({
    "@codemirror/lint": "^6.4.0",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.2",
  });
  expect(manifest.peerDependenciesMeta).toEqual({ "@codemirror/lint": { optional: true } });
});

test("the exports are exactly the root and ./lint", () => {
  expect(Object.keys(manifest.exports)).toEqual([".", "./lint"]);
});

test("a DOM is registered for the editor tests", () => {
  expect(typeof document.createElement).toBe("function");
});
