import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPlugin, engineVersion, JPL_ORDER } from "../build.js";
import { ustar } from "../pack.js";
import { untar } from "./untar.js";

const enc = new TextEncoder();
const two = [
  { name: "manifest.json", bytes: enc.encode('{"id":"x"}\n') },
  { name: "index.js", bytes: enc.encode("console.log(1);\n") },
];

test("A5: entries round-trip with their names, sizes and bytes", () => {
  const got = untar(ustar(two));
  expect(got.map((e) => e.name)).toEqual(["manifest.json", "index.js"]);
  expect(got.map((e) => [...e.bytes])).toEqual(two.map((e) => [...e.bytes]));
});

test("A5: length is a multiple of 512 and ends with two zero blocks", () => {
  const tar = ustar(two);
  expect(tar.length % 512).toBe(0);
  expect(tar.length).toBe(4 * 512 + 2 * 512);
  expect(tar.subarray(tar.length - 1024).every((b) => b === 0)).toBe(true);
});

test("A5: equal inputs give byte-identical archives", () => {
  expect(ustar(two)).toEqual(ustar(two));
});

test("a 512-byte entry takes exactly one data block", () => {
  const tar = ustar([{ name: "a", bytes: new Uint8Array(512).fill(97) }]);
  expect(tar.length).toBe(512 + 512 + 1024);
  expect(untar(tar)[0]!.bytes.length).toBe(512);
});

test("a name longer than 100 bytes is refused, not truncated", () => {
  expect(() => ustar([{ name: "n".repeat(101), bytes: new Uint8Array() }])).toThrow(
    "ustar: name longer than 100 bytes",
  );
});

test("the system tar lists what ustar wrote", () => {
  const dir = mkdtempSync(join(tmpdir(), "jpl-"));
  const file = join(dir, "t.tar");
  writeFileSync(file, ustar(two));
  const run = Bun.spawnSync(["tar", "-tf", file]);
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual(["manifest.json", "index.js"]);
});

const repo = join(import.meta.dir, "..", "..", "..");
const engine = JSON.parse(readFileSync(join(repo, "packages/visimark/package.json"), "utf8"));

test("A6 and A7: a real build packs the five files in order, at the engine's version", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "joplin-build-"));
  const { jpl } = await buildPlugin(join(tmp, "dist"), join(tmp, "publish"));
  expect(jpl).toBe(join(tmp, "publish", "com.visimark.joplin.jpl"));
  const entries = untar(new Uint8Array(readFileSync(jpl)));
  expect(entries.map((e) => e.name)).toEqual([...JPL_ORDER]);
  expect([...JPL_ORDER]).toEqual([
    "manifest.json",
    "index.js",
    "codemirrorContentScript.js",
    "markdownItContentScript.js",
    "visimark.css",
  ]);
  const manifest = JSON.parse(new TextDecoder().decode(entries[0]!.bytes));
  expect(manifest.version).toBe(engine.version);
  expect(Object.keys(manifest).slice(0, 3)).toEqual(["manifest_version", "id", "version"]);
  expect(manifest).toMatchObject({
    manifest_version: 1,
    id: "com.visimark.joplin",
    app_min_version: "3.7.1",
    platforms: ["desktop"],
  });
});

test("a missing engine version stops the build with the spec's message", () => {
  const tmp = mkdtempSync(join(tmpdir(), "joplin-nover-"));
  const pkg = join(tmp, "package.json");
  writeFileSync(pkg, '{"name":"visimark"}');
  expect(() => engineVersion(pkg)).toThrow(
    "editors/joplin: packages/visimark/package.json has no version",
  );
});
