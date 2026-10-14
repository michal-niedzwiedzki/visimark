import { build, type BuildOptions, type Metafile } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ustar } from "./pack.js";

/**
 * The Joplin plugin build (#378, spec §2.6). A plain-script entry point and two
 * CommonJS content scripts — Joplin loads one as `require(file).default` — then
 * a manifest stamped with the engine's version, the stylesheet, and the `.jpl`.
 *
 * Every workspace package resolves to its **source**, for the reason
 * `editors/obsidian/esbuild.config.mjs` gives: the plugin must not ship a stale
 * `dist/`. `node:path` is the engine's one builtin, and it is used for string
 * work only, so it is swapped for the browser-safe copy the extension ships.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packages = join(here, "..", "..", "packages");

export const ENTRIES: readonly {
  name: "index" | "codemirrorContentScript" | "markdownItContentScript";
  format: "iife" | "cjs";
  external: string[];
}[] = [
  // The entry point runs as a plain script with the `joplin` global; nothing
  // promises it a `module`, so it must not touch one.
  { name: "index", format: "iife", external: [] },
  // What Joplin's `codeMirrorRequire` hands a CodeMirror content script. A
  // second copy of CodeMirror would be a second editor state.
  { name: "codemirrorContentScript", format: "cjs", external: ["@codemirror/*", "@lezer/*"] },
  { name: "markdownItContentScript", format: "cjs", external: [] },
];

export const JPL_ORDER = [
  "manifest.json",
  "index.js",
  "codemirrorContentScript.js",
  "markdownItContentScript.js",
  "visimark.css",
] as const;

export function options(entry: (typeof ENTRIES)[number], outDir: string): BuildOptions {
  return {
    entryPoints: [join(here, "src", `${entry.name}.ts`)],
    outfile: join(outDir, `${entry.name}.js`),
    bundle: true,
    format: entry.format,
    platform: "browser",
    target: "es2020",
    minify: true,
    metafile: true,
    logLevel: "info",
    alias: {
      visimark: join(packages, "visimark", "src", "browser.ts"),
      "codemirror-visimark": join(packages, "codemirror-visimark", "src"),
      "markdown-it-visimark": join(packages, "markdown-it-visimark", "src"),
      "node:path": join(packages, "codemirror-visimark", "src", "browser-path.ts"),
    },
    external: [...entry.external],
  };
}

export function engineVersion(pkgPath = join(packages, "visimark", "package.json")): string {
  const version: unknown = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  if (typeof version !== "string" || version === "")
    throw new Error("editors/joplin: packages/visimark/package.json has no version");
  return version;
}

/** The committed manifest with `version` inserted right after `id` (spec §2.3). */
export function manifestWithVersion(src: Record<string, unknown>, version: string): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = v;
    if (k === "id") out.version = version;
  }
  return JSON.stringify(out, null, 2) + "\n";
}

export async function buildPlugin(
  outDir = join(here, "dist"),
  publishDir = join(here, "publish"),
): Promise<{ metafiles: Record<string, Metafile>; jpl: string }> {
  const version = engineVersion();
  mkdirSync(outDir, { recursive: true });
  mkdirSync(publishDir, { recursive: true });
  const metafiles: Record<string, Metafile> = {};
  for (const entry of ENTRIES)
    metafiles[entry.name] = (await build(options(entry, outDir))).metafile!;
  const manifest = JSON.parse(readFileSync(join(here, "src", "manifest.json"), "utf8"));
  writeFileSync(join(outDir, "manifest.json"), manifestWithVersion(manifest, version));
  copyFileSync(join(here, "src", "visimark.css"), join(outDir, "visimark.css"));
  const jpl = join(publishDir, "com.visimark.joplin.jpl");
  const entries = JPL_ORDER.map((name) => ({
    name,
    bytes: new Uint8Array(readFileSync(join(outDir, name))),
  }));
  writeFileSync(jpl, ustar(entries));
  return { metafiles, jpl };
}

if (import.meta.main) {
  try {
    await buildPlugin();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
