import { createRequire } from "node:module";

// The package's own version, from the single source of truth. Deliberately not a
// top-level `import ... with { type: "json" }`: that makes tsc treat the repo
// root as the source root and scatter the declaration output, and it inlines a
// stale literal into the VS Code extension bundle. Instead read it lazily.
//
// The candidate list is the set of depths this module gets bundled to:
// `../../` resolves from `src/cli/` in dev and from the bundled `dist/cli/`
// once installed, and `../` from the bundled `dist/index.js` — the library
// entry point, which reaches here through `report/json.ts` and
// `report/explain.ts`. Before the second candidate, any library consumer that
// asked for an envelope got `Cannot find module '../../package.json'`.
const CANDIDATES = ["../../package.json", "../package.json"];

export function readVersion(): string {
  const require = createRequire(import.meta.url);
  for (const candidate of CANDIDATES) {
    try {
      return (require(candidate) as { version: string }).version;
    } catch {
      continue;
    }
  }
  throw new Error("visimark: cannot locate its own package.json");
}
