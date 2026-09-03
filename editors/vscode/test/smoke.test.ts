import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

test("the build produces both bundles the manifest points at", () => {
  const dist = join(here, "..", "dist");
  expect(existsSync(join(dist, "extension.js"))).toBe(true);
  expect(existsSync(join(dist, "server.js"))).toBe(true);
});
