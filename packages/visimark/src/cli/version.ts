import { createRequire } from "node:module";

// The package's own version, from the single source of truth. Deliberately not a
// top-level `import ... with { type: "json" }`: that makes tsc treat the repo
// root as the source root and scatter the declaration output, and it inlines a
// stale literal into the VS Code extension bundle. Instead read it lazily.
//
// The candidate list is the set of depths this module gets bundled to:
// `../../` resolves from `src/cli/` in dev and from the bundled `dist/cli/`
// once installed, and `../` from the bundled `dist/index.js` — the library
// entry point, which reaches here through `report/envelope.ts` and because it
// exports `readVersion` itself. Before the second candidate, any library
// consumer that asked for an envelope got
// `Cannot find module '../../package.json'`.
//
// It used to be reached from `report/json.ts` and `report/explain.ts` too, and
// that was a problem rather than a detail: the `node:module` import above is
// at module scope, a bundler resolves before it shakes, and so two calls put
// every shape in those two files — `explainView` included, which wants no
// version at all — beyond any browser build. Issue #204 moved the two stamped
// builders into `report/envelope.ts`; `test/report/version-reach.test.ts`
// fails if a third module starts reaching here.
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
