/**
 * Fails when a published package's manifest and its built `dist/` disagree
 * about what it depends on.
 *
 * Three ways they can disagree, each one this repository has shipped:
 *
 * - **`dist/` loads a package the manifest does not declare.** It works in
 *   this workspace, where something else installed it, and fails for a user.
 * - **The manifest declares a dependency nothing in `dist/` loads or names.**
 *   `visimark` 0.2.0 installed 68 packages it had bundled and never loaded,
 *   and the lint plugins pinned an engine they never imported because they
 *   bundled their own copy (review 2026-10-15 §2.2, §2.13).
 * - **A published `.d.ts` names a package the manifest does not declare.**
 *   `remark-lint-visimark` 0.2.0 imported `unified` and `mdast` types it did
 *   not depend on (§2.11).
 *
 * "Loads" is every import, export-from, dynamic import and `require` in
 * `dist/**\/*.js`, parsed rather than grepped, so code inside a template
 * string does not count. Node builtins are not dependencies. "Names" is
 * every module specifier in a `.d.ts` reachable from the manifest's `types`
 * and `exports` type entries, following relative imports; a declaration file
 * no entry reaches is never read by a consumer. A dependency only the
 * declarations name (the engine's `decimal.js`) is legitimate: a consumer's
 * typecheck needs it installed. `dependencies`, `peerDependencies` and
 * `optionalDependencies` all count as declared; a peer nothing loads is fine,
 * because a peer is the host's to install.
 *
 * Run it after `bun run build`. The rule it enforces is
 * `.agents/rules/dependencies-and-pins.md`.
 *
 * Usage: `bun scripts/check-dist-imports.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NPM_MANIFESTS } from "./release-manifests.ts";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-dist-imports [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

const BUILTINS = new Set(builtinModules);
const transpiler = new Bun.Transpiler({ loader: "js" });

/** `@scope/name/sub` → `@scope/name`, `name/sub` → `name`; `null` for relative, `node:` and builtins. */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) {
    return null;
  }
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  return BUILTINS.has(name) ? null : name;
}

async function scan(dir: string, pattern: string, extract: (text: string) => string[]) {
  const found = new Map<string, string>(); // package → first file that uses it
  for await (const file of new Bun.Glob(pattern).scan(dir)) {
    const text = await Bun.file(join(dir, file)).text();
    for (const specifier of extract(text)) {
      const name = packageOf(specifier);
      if (name !== null && !found.has(name)) found.set(name, file);
    }
  }
  return found;
}

const jsImports = (text: string): string[] => [
  ...transpiler.scanImports(text).map((i) => i.path),
  // a CommonJS require the bundler left as a runtime call
  ...[...text.matchAll(/\b__require\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]!),
];

/** Module specifiers in a declaration file, comments removed first so prose cannot match. */
function dtsImports(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)"([^"]+)"/gm)].map(
    (m) => m[1]!,
  );
}

/** Every `types` target the manifest publishes: the `types` field and each `exports` `types` condition. */
function typeEntries(manifest: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (typeof manifest.types === "string") out.push(manifest.types);
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "types" && typeof value === "string") out.push(value);
      else walk(value);
    }
  };
  walk(manifest.exports);
  return [...new Set(out)];
}

/** The packages named by the declaration files reachable from `entries`. */
function namedTypes(pkgRoot: string, entries: string[]): Map<string, string> {
  const found = new Map<string, string>();
  const seen = new Set<string>();
  const queue = entries.map((e) => resolve(pkgRoot, e));
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path) || !existsSync(path)) continue;
    seen.add(path);
    const where = path.slice(pkgRoot.length + 1);
    for (const specifier of dtsImports(readFileSync(path, "utf8"))) {
      if (specifier.startsWith(".")) {
        const base = resolve(dirname(path), specifier).replace(/\.(js|d\.ts)$/, "");
        queue.push(`${base}.d.ts`, join(base, "index.d.ts"));
        continue;
      }
      const name = packageOf(specifier);
      if (name !== null && !found.has(name)) found.set(name, where);
    }
  }
  return found;
}

let fail = false;
for (const { file, npm } of NPM_MANIFESTS) {
  // This package's own verdict; `fail` is the run's, for the exit code.
  let failed = false;
  const pkgDir = dirname(file);
  const dist = join(root, pkgDir, "dist");
  let manifest: Record<string, any>;
  try {
    manifest = JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch {
    annotate(file, `cannot read ${file}.`);
    fail = true;
    continue;
  }
  if (!existsSync(dist)) {
    annotate(file, `${pkgDir}/dist does not exist. Run \`bun run build\` before this check.`);
    fail = true;
    continue;
  }

  const dependencies = Object.keys(manifest.dependencies ?? {});
  const declared = new Set([
    ...dependencies,
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const loaded = await scan(dist, "**/*.js", jsImports);
  const named = namedTypes(join(root, pkgDir), typeEntries(manifest));

  for (const [name, where] of loaded) {
    if (!declared.has(name)) {
      annotate(
        file,
        `${npm}: ${pkgDir}/dist/${where} loads "${name}", which ${file} does not declare. Declare it, or bundle it.`,
      );
      failed = true;
    }
  }
  for (const [name, where] of named) {
    if (!declared.has(name)) {
      annotate(
        file,
        `${npm}: ${pkgDir}/${where} imports types from "${name}", which ${file} does not declare. A consumer's typecheck cannot resolve it: declare it, or declare the types structurally.`,
      );
      failed = true;
    }
  }
  for (const name of dependencies) {
    if (!loaded.has(name) && !named.has(name)) {
      annotate(
        file,
        `${npm}: ${file} depends on "${name}", but nothing in ${pkgDir}/dist loads it or names it. If the build bundles it, move it to devDependencies.`,
      );
      failed = true;
    }
  }
  if (failed) fail = true;
  else {
    const runtime = [...loaded.keys()].sort().join(", ") || "nothing";
    console.log(
      `${npm}: loads ${runtime}; declares ${dependencies.sort().join(", ") || "nothing"}`,
    );
  }
}
process.exit(fail ? 1 : 0);
