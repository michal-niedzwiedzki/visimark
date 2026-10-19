import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const extensionSrc = resolve(import.meta.dir, "../../../packages/codemirror-visimark/src");
const globalSrc = readFileSync(
  resolve(import.meta.dir, "../../src/playground/engine-global.ts"),
  "utf8",
);

/** every value (not `type`) name the extension imports from "visimark" */
function runtimeImports(): Set<string> {
  const names = new Set<string>();
  for (const f of readdirSync(extensionSrc).filter((n) => n.endsWith(".ts"))) {
    const text = readFileSync(join(extensionSrc, f), "utf8");
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"visimark";/g)) {
      for (const part of m[1]!.split(",")) {
        const name = part.trim();
        if (name !== "" && !name.startsWith("type ")) names.add(name);
      }
    }
  }
  return names;
}

test("engine-global exports every runtime name the extension imports from visimark", () => {
  const exported = new Set([...globalSrc.matchAll(/export const (\w+)/g)].map((m) => m[1]!));
  const missing = [...runtimeImports()].filter((n) => !exported.has(n));
  expect(missing, `engine-global.ts lacks ${missing.join(", ")}`).toEqual([]);
});

test("Review 1: importing engine-global without window.VisiMark does not throw", async () => {
  const saved = (globalThis as { VisiMark?: unknown }).VisiMark;
  delete (globalThis as { VisiMark?: unknown }).VisiMark;
  await import("../../src/playground/engine-global.js");
  (globalThis as { VisiMark?: unknown }).VisiMark = saved;
});
