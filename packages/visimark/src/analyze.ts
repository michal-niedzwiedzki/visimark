import { check as runCheck, type CheckResult } from "./eval/check.js";
import { build as buildModel } from "./model/build.js";
import { locate as locateDoc } from "./parse/document.js";
import type { DocModel } from "./model/types.js";

/**
 * Parse, model and check a document in one pass — what an editor wants.
 *
 * It lives in its own module rather than inline in `index.ts` because
 * `browser.ts` needs it too, and `browser.ts` cannot import from `index.ts`:
 * that graph reaches `node:fs`, `node:crypto`, `node:module` and `node:url`
 * (issue #201). Defining it twice would be two copies of the editor entry
 * point that can silently disagree, which is the exact drift
 * `test/browser/entry-graph.test.ts` exists to prevent. One module, two
 * re-exports.
 */
export function analyze(source: string): {
  model: DocModel;
  result: CheckResult;
} {
  const model = buildModel(locateDoc(source));
  return { model, result: runCheck(model) };
}
