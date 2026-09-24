import { readVersion } from "../cli/version.js";
import { explainBody, type ExplainView } from "./explain.js";
import type { CommandName } from "./json.js";

/**
 * The two functions that build a **complete** `--json` envelope — and the only
 * two in `src/report/` that need to know the engine's own version.
 *
 * **Why they live apart from the shapes they stamp.** `readVersion()` imports
 * `node:module`, at module scope, and a module-scope import taints its whole
 * module: a bundler resolves before it shakes, so an unused import is still a
 * build failure. These two calls therefore kept `report/json.ts` — every
 * public piece of the envelope — and `report/explain.ts` — including
 * `explainView`, which needs no version at all — out of any browser build.
 * One string, two modules, and three things blocked downstream: the Obsidian
 * plugin's hover popover, its Explain command and its public API
 * (`docs/design/obsidian-plugin-spec.md` §2.4), plus the browser half of the
 * cross-host equivalence check, whose spec called its workaround "closer to
 * forced than chosen".
 *
 * Issue #204. Moving the two stamped builders here is the whole fix: it
 * changes no signature, no published name and no byte of any envelope, and it
 * leaves `src/report/` with exactly one module that reaches Node.
 * `test/report/version-reach.test.ts` is what keeps that true.
 *
 * **Why not make the version a parameter.** It was the other candidate on
 * #204 and it is a breaking change to two exported library functions, in
 * exchange for letting a browser host stamp an envelope with a version it
 * would have to be handed anyway. Nothing wants that yet. If something does,
 * the change is still available and will then have a consumer to justify it —
 * see the issue for the cost/benefit as it was weighed.
 *
 * Both names are re-exported from `src/index.ts`, so no consumer can tell the
 * difference. Neither is re-exported from `src/browser.ts`, and that is the
 * honest boundary: a browser host genuinely does not know which engine built
 * it, so it gets every *piece* of the envelope and not the stamp.
 */

/** The `2` class: a usage, read or scenario failure, as the CLI reports it. */
export function errorEnvelope(
  command: CommandName,
  code: "USAGE" | "READ" | "SCENARIO",
  message: string,
): object {
  return { command, visimark: readVersion(), status: "error", error: { code, message } };
}

/**
 * `explain --json`.
 *
 * Key order is the wire format — `JSON.stringify` emits insertion order — so
 * the three stamped keys are written here and the rest comes from
 * `explainBody` in the order that function builds it.
 */
export function explainJson(view: ExplainView, file: string): object {
  return { command: "explain", visimark: readVersion(), ...explainBody(view, file) };
}
