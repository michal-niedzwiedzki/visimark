import { beforeAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const here = join(import.meta.dir, "..");
const dist = join(here, "dist");

beforeAll(() => {
  const r = Bun.spawnSync(["bun", "run", "build"], { cwd: here, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
});

const js = (): string[] => readdirSync(dist).filter((f) => f.endsWith(".js"));
const text = (f: string): string => readFileSync(join(dist, f), "utf8");

test("B1: index.js, at least one chunk, and index.d.ts are built", () => {
  const files = readdirSync(dist);
  expect(files).toContain("index.js");
  expect(files).toContain("index.d.ts");
});

test("B2: no node: specifier survives into any built file", () => {
  // a quoted specifier, as editors/obsidian/test/bundle.test.ts matches it —
  // the engine's own `{ node: … }` object keys are not imports
  for (const f of js()) {
    const found = [...text(f).matchAll(/["'`](node:[a-z_/]+)["'`]/g)].map((m) => m[1]!);
    expect(found, `${f} contains ${found.join(", ")}`).toEqual([]);
  }
});

test("B3: CodeMirror is imported, never inlined", () => {
  for (const f of js()) {
    expect(text(f).includes("Unrecognized extension value"), `${f} inlines @codemirror/state`).toBe(
      false,
    );
  }
  expect(text("index.js")).toMatch(
    /from"@codemirror\/(state|view)"|from "@codemirror\/(state|view)"/,
  );
});

test("B4: no shipped declaration imports the engine", () => {
  for (const f of readdirSync(dist).filter((n) => n.endsWith(".d.ts"))) {
    expect(text(f).includes('"visimark"'), `${f} imports visimark`).toBe(false);
  }
});

test("B1: lint.js and lint.d.ts are built, and share a chunk with index.js", () => {
  const files = readdirSync(dist);
  expect(files).toContain("lint.js");
  expect(files).toContain("lint.d.ts");
  expect(files.some((f) => f.startsWith("chunk-"))).toBe(true);
  const chunkOf = (f: string): string[] =>
    [...text(f).matchAll(/"\.\/(chunk-[^"]+\.js)"/g)].map((m) => m[1]!);
  const shared = chunkOf("index.js").filter((c) => chunkOf("lint.js").includes(c));
  expect(shared.length).toBeGreaterThan(0);
});

test("only lint.js imports @codemirror/lint", () => {
  for (const f of js()) {
    if (f === "lint.js") continue;
    expect(text(f).includes("@codemirror/lint"), `${f} imports @codemirror/lint`).toBe(false);
  }
});
