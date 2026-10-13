import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
