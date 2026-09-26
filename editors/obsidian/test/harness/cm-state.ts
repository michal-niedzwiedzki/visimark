import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type * as CmStateNs from "@codemirror/state";

/**
 * The exact `@codemirror/state` copy `@codemirror/view` resolves for
 * *itself* — which is not necessarily the copy a bare `import
 * "@codemirror/state"` from somewhere else in this workspace would get, and
 * `live-preview.test.ts` needs the two to agree to build a working
 * `EditorView`.
 *
 * Two separate hazards stack here. First, the one `live-preview.ts` already
 * documents for `editorInfoField`/`editorLivePreviewField`: `@codemirror/view`
 * depends on `@codemirror/state@^6.5.0`, this workspace's own
 * `devDependencies` ask for `^6.5.2`, and the lockfile did not dedupe them —
 * `@codemirror/view` carries its own nested `6.5.0`, one level down from the
 * `6.7.x` a bare import from `editors/obsidian` resolves to. Second, and not
 * one this codebase had hit before: `@codemirror/state` ships separate ESM
 * (`dist/index.js`) and CJS (`dist/index.cjs`) builds behind its `package.json`
 * `exports` map, and CodeMirror's own extension system tells them apart by
 * `instanceof` — so even *reaching the right version* isn't enough if it's
 * reached through the wrong one of the two; a plain `import` and a
 * `createRequire`-based `require` of the identical installed copy load as
 * two different modules with two different `StateField` classes. Loading the
 * exact ESM file `@codemirror/view` itself would load — found by walking to
 * its own package directory and back down into its nested
 * `node_modules/@codemirror/state`, then a dynamic `import()` of that path's
 * `dist/index.js` — is what makes `instanceof` agree.
 *
 * Test-only: nothing outside `bun test` needs this, and the real bundle
 * externalizes both packages to Obsidian's own matching pair (review's
 * "Shared context", `test/bundle.test.ts`), where this hazard cannot occur.
 */
const viewEntryPath = fileURLToPath(import.meta.resolve("@codemirror/view"));
const viewPackageDir = dirname(dirname(viewEntryPath)); // .../node_modules/@codemirror/view
const nestedStateEntry = join(viewPackageDir, "..", "state", "dist", "index.js");

export const CmState = (await import(pathToFileURL(nestedStateEntry).href)) as typeof CmStateNs;
