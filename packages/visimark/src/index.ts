export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export { fmt, planFmt, type FmtOptions, type FmtResult, type PlannedEdit } from "./write/fmt.js";
export { applyEdits, type Edit } from "./write/splice.js";
export { topoOrder, dependencies, resolve, refText } from "./eval/graph.js";
export { FUNCTIONS, isReduce, type FnKind, type FnSpec } from "./eval/functions.js";
export type { FunctionName } from "./eval/functions.js";
export {
  describeFunction,
  functionNames,
  type FnDoc,
  type FnEntry,
  type FnError,
  type FnExample,
  type FnParam,
} from "./lang/reference.js";
export { infer, type Proposal, type ProposalKind } from "./infer/propose.js";
export { planInfer, type PlannedInsert } from "./infer/write.js";
export { formatCheck } from "./report/format.js";
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
