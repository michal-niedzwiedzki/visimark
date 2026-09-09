import { createRequire } from "node:module";

// The package's own version, from the single source of truth. Deliberately not a
// top-level `import ... with { type: "json" }`: that makes tsc treat the repo
// root as the source root and scatter the declaration output, and it inlines a
// stale literal into the VS Code extension bundle. Instead read it lazily.
// `../../package.json` resolves from `src/cli/` in dev and from the bundled
// `dist/cli/` once installed.
export function readVersion(): string {
  const pkg = createRequire(import.meta.url)("../../package.json") as { version: string };
  return pkg.version;
}
