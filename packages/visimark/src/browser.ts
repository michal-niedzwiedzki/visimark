/**
 * The engine's **browser-safe entry point**: everything `index.ts` exports
 * that can be bundled for a host with no Node, plus the two pieces such a host
 * cannot build for itself.
 *
 * **Why this file exists.** `index.ts` is the public entry point and both
 * shipped clients reach the engine through it. It cannot be bundled for a
 * browser. Resolving `visimark` to `src/index.ts` and building at
 * `platform: "browser"` fails on nine specifiers from five builtins —
 * `node:fs`, `node:crypto`, `node:module`, `node:url` and `node:path` — which
 * arrive through exports made on purpose: `nodeReader`/`onDisk`
 * (`fs/node-reader.ts`), `runCli` (`cli/main.ts`), `readVersion`
 * (`cli/version.ts`), `writeArtifact` (`artifact/write.ts`). Tree shaking does
 * not help, because a bundler resolves before it shakes.
 *
 * That was never noticed because no browser consumer went through `index.ts`:
 * the playground enters at `playground/browser-entry.ts` and imports
 * `../eval/check.js`, `../write/fmt.js` and the rest **by path**. So the
 * repository had a browser-safe engine and a public engine, and no named
 * boundary between them. A client that is both — a plugin that wants the
 * public API and runs where `node:fs` does not exist — had nowhere to import
 * from. Issue #201; the first such client is `editors/obsidian` (#200, v1 row
 * 1 of #176).
 *
 * **What is deliberately not here.**
 *
 * - `nodeReader`, `onDisk`, `runCli`, `readVersion`, `writeArtifact` — the
 *   five exports that reach a Node builtin directly. A browser host supplies
 *   its own `ReaderPort`; `memoryReader` below is the one the engine already
 *   ships.
 * - `errorEnvelope` and `explainJson` from `report/envelope.ts` — the two
 *   functions that stamp a complete `--json` envelope with the engine's own
 *   version, which they read through `node:module`. **A browser host does not
 *   know which engine built it**, so this is the honest boundary rather than a
 *   limitation: everything else in `report/json.ts` is here, so a caller can
 *   build every *piece* of the envelope and supply the stamp itself if it has
 *   one.
 *
 *   Both modules used to be absent entirely, for those two calls — one string
 *   kept `explainView`, which needs no version at all, out of every browser
 *   build, and `docs/design/cross-host-equivalence-check-spec.md` §2 hit the
 *   same wall from the other side and called its workaround "closer to forced
 *   than chosen". Issue #204 moved the two stamped builders into their own
 *   module; nothing else changed, and no signature did.
 *
 * **What is here that `index.ts` does not export.** `memoryReader` and
 * `sha256Hex`, from `playground/`. `ReaderPort` is synchronous and
 * `readSealed` must return a SHA-256, while every browser filesystem API and
 * `crypto.subtle.digest` are asynchronous — so a browser host cannot write a
 * direct adapter, and needs a map it can fill asynchronously and then read
 * synchronously. That is exactly `memoryReader`, and `sha256Hex` is the
 * synchronous digest it runs on, pinned against FIPS 180-4 and against
 * `node:crypto` over randomised inputs by `test/playground/sha256.test.ts`.
 * Both headers say they live under `playground/` because "scope is the point";
 * a second browser client is the event that reopens where they belong, and
 * moving them is not this file's business.
 *
 * **This is a subset, and that is enforced.**
 * `test/browser/entry-graph.test.ts` asserts that every value this module
 * exports is also exported by `index.ts`, so the browser surface can lag the
 * public one but can never become a second API that drifts from it. The same
 * test walks this file's imports and fails on any `node:` builtin but
 * `node:path`.
 *
 * **`node:path` is reachable, and is the consumer's problem.** `fs/gate.ts`
 * uses `dirname`, `isAbsolute`, `resolve` and `sep` to decide containment; it
 * touches no filesystem. The playground gets Bun's browser build of it and
 * `test/playground/browser-graph.test.ts` documents the rule for admitting a
 * builtin; `editors/obsidian` maps it to a shim it ships, because Obsidian
 * mobile is not Electron and a builtin that merely happens to be unreached is
 * the class of bug that took the playground down for 74 minutes.
 */
export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export { analyze } from "./analyze.js";
export {
  artifactsFor,
  fmt,
  planFmt,
  type FmtOptions,
  type FmtResult,
  type PlannedEdit,
} from "./write/fmt.js";
export type { ArtifactWrite } from "./write/fmt.js";
export { applyEdits, type Edit } from "./write/splice.js";
export { topoOrder, dependencies, resolve, refText } from "./eval/graph.js";
export { FUNCTIONS, isReduce, type FnKind, type FnSpec } from "./eval/functions.js";
export type { FunctionName } from "./eval/functions.js";
export type { Expr } from "./lang/ast.js";
export {
  describeFunction,
  functionNames,
  precisionPhrase,
  type FnDoc,
  type FnEntry,
  type FnError,
  type FnExample,
  type FnParam,
  type FnPrecision,
} from "./lang/reference.js";
export { infer, type Proposal, type ProposalKind } from "./infer/propose.js";
export { planInfer, type PlannedInsert } from "./infer/write.js";
export { resolveArtifactPath, type PathResult } from "./artifact/path.js";
// Pure string parsing, exported so a host with its own write primitive (the
// Obsidian plugin's `vaultWriter`) can re-prove a target's ownership
// immediately before writing — see `index.ts`'s copy of this export for why
// `classify` itself stays unexported.
export { readMarker } from "./artifact/stale.js";
export { describeFinding, formatCheck } from "./report/format.js";
export { closest, levenshtein } from "./report/levenshtein.js";
export {
  evalValues,
  findingSummary,
  inferSummary,
  publicAssertions,
  publicCharts,
  publicFinding,
  publicFnEntry,
  publicProposal,
  signature,
  statusFromExit,
  type CommandName,
  type JsonValue,
  type OnDefaults,
} from "./report/json.js";
export { explainText, explainView, type ExplainView } from "./report/explain.js";
export {
  ScenarioError,
  applyScenario,
  listParams,
  parseScenarioJson,
  resolveScenario,
  type ParamInfo,
  type ScenarioEntry,
} from "./eval/scenario.js";
export { formatInfer } from "./report/infer.js";
export { lineOf } from "./report/lines.js";
export { applyUnit, parseDecorated, type Unit } from "./eval/units.js";
export type { Binding, DocModel, Finding, FindingCode, Sheet } from "./model/types.js";
export { ERROR_CODES, isProblem } from "./model/types.js";
export type {
  AnchorTargetKind,
  LocatedDoc,
  RawAnchor,
  RawBlock,
  ProseFigure,
  RawTable,
  Span,
} from "./parse/document.js";
export type { DocumentFile, ReaderPort, SealedRead } from "./fs/reader.js";
export type { WriteErr, WriteOk, WriterPort } from "./fs/writer.js";
export type { CheckOptions } from "./eval/check.js";
// The browser's `ReaderPort` and the synchronous digest it runs on. Not in
// `index.ts`; see the header.
export { memoryReader } from "./playground/memory-reader.js";
export { sha256Hex } from "./playground/sha256.js";
