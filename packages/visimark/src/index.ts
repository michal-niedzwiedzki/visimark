export { locate } from "./parse/document.js";
export { build } from "./model/build.js";
export { check, type CheckResult } from "./eval/check.js";
export {
  fmt,
  planFmt,
  type FmtOptions,
  type FmtResult,
  type PlannedEdit,
} from "./write/fmt.js";
export { applyEdits, type Edit } from "./write/splice.js";
export { topoOrder, dependencies, resolve, refText } from "./eval/graph.js";
export {
  FUNCTIONS,
  isReduce,
  type FnKind,
  type FnSpec,
} from "./eval/functions.js";
export { formatCheck } from "./report/format.js";
export { applyUnit, parseDecorated, type Unit } from "./eval/units.js";
export type {
  Binding,
  DocModel,
  Finding,
  FindingCode,
  Sheet,
} from "./model/types.js";
export type {
  LocatedDoc,
  RawAnchor,
  RawBlock,
  RawTable,
  Span,
} from "./parse/document.js";
export { runCli } from "./cli/main.js";

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
