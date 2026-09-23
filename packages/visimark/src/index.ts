export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export { fmt, planFmt, type FmtOptions, type FmtResult, type PlannedEdit } from "./write/fmt.js";
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
export { describeFinding, formatCheck } from "./report/format.js";
// The `--json` envelope's own pieces. A second front end over this engine —
// `visimark-mcp` — consumes the envelope specified in
// `docs/design/structured-output-json-spec.md` as its wire format, so it needs
// the functions that produce it. Exported rather than reimplemented for the
// reason review made on #152: the public finding shape is a contract, and a
// consumer that re-derives it is a second serialisation that can drift from
// this one. Additive; no existing consumer changes.
export {
  errorEnvelope,
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
// The rest of what a second front end needs to answer the same six commands
// over the same envelope: `explain`'s view and its JSON shape, `ref`'s
// did-you-mean, and `eval`'s scenario machinery. Same reasoning as the block
// above — each of these is a contract a consumer would otherwise re-derive.
export { explainJson, explainText, explainView, type ExplainView } from "./report/explain.js";
export { closest, levenshtein } from "./report/levenshtein.js";
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
  LocatedDoc,
  RawAnchor,
  RawBlock,
  ProseFigure,
  RawTable,
  Span,
} from "./parse/document.js";
export { runCli } from "./cli/main.js";
// The engine's own version — the `visimark` field of every envelope. Exported
// so a second front end reports the version of the engine that actually ran,
// rather than a string it carries separately and hopes agrees.
export { readVersion } from "./cli/version.js";
// The reader port and its `node:fs` implementation. A library caller that has
// a document on disk passes `onDisk(path)` as `CheckOptions.doc` /
// `FmtOptions.doc`; a caller that does not (a browser, an editor working on an
// unsaved buffer) passes nothing, and the filesystem phases stand down.
// `node-reader.js` is imported *here* and not from the engine, so that the
// browser bundle's graph never reaches it — see `fs/reader.ts`.
export type { DocumentFile, ReaderPort, SealedRead } from "./fs/reader.js";
export { nodeReader, onDisk } from "./fs/node-reader.js";
export type { CheckOptions } from "./eval/check.js";

import { check as runCheck, type CheckResult } from "./eval/check.js";
import { build as buildModel } from "./model/build.js";
import { locate as locateDoc } from "./parse/document.js";
import type { DocModel } from "./model/types.js";

/** Parse, model and check a document in one pass — what an editor wants. */
export function analyze(source: string): {
  model: DocModel;
  result: CheckResult;
} {
  const model = buildModel(locateDoc(source));
  return { model, result: runCheck(model) };
}
