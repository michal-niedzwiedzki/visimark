import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** The bundles the manifest and the client point at, relative to the package. */
const bundles = [pkg.main, "./dist/server.js"];

/**
 * How Node — and so the VS Code extension host — reads a file in this package:
 * an explicit `.cjs`/`.mjs` extension wins, otherwise the nearest package.json
 * `"type"` decides, defaulting to CommonJS when the field is absent.
 */
function moduleFormat(file: string): "commonjs" | "module" {
  if (file.endsWith(".cjs")) return "commonjs";
  if (file.endsWith(".mjs")) return "module";
  return pkg.type === "module" ? "module" : "commonjs";
}

test("the build produces both bundles the manifest points at", () => {
  for (const bundle of bundles) {
    expect(existsSync(join(root, bundle))).toBe(true);
  }
});

// esbuild emits CommonJS. If the host reads the bundles as ES modules instead,
// activation dies on the first `require` and *every* command goes missing.
test("the host reads the bundles as the CommonJS that esbuild emits", () => {
  for (const bundle of bundles) {
    expect(moduleFormat(bundle)).toBe("commonjs");
    expect(readFileSync(join(root, bundle), "utf8")).toContain("module.exports");
  }
});

// The marketplace identifies an extension as `<publisher>.<name>`. The publisher
// must be the publisher's *identifier*, not their display name — vsce rejects
// anything else, so a friendly name here fails the build at packaging time.
test("the publisher is an identifier vsce will accept", () => {
  expect(pkg.publisher).toMatch(/^[a-z0-9][a-z0-9-]*$/);
});

// `uninstall-local` has to name that same id, and nothing derives it for us.
test("uninstall-local targets the id this manifest produces", () => {
  expect(pkg.scripts["uninstall-local"]).toContain(
    `--uninstall-extension ${pkg.publisher}.${pkg.name}`,
  );
});
