import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as api from "../src/index.js";

/**
 * The package's whole export list, by name. `import("visimark")` is a
 * supported contract (#170, #190), so anything exported here is something an
 * outside user can come to depend on. Adding or removing an export changes one
 * of these two lists, and that diff is the review. `docs/library.md` says which
 * of these are supported API; the rest serve this repository's own front ends.
 */

test("the runtime exports are exactly these", () => {
  expect(Object.keys(api).sort()).toEqual([
    "ERROR_CODES",
    "FUNCTIONS",
    "ScenarioError",
    "analyze",
    "applyEdits",
    "applyScenario",
    "applyUnit",
    "artifactsFor",
    "build",
    "check",
    "closest",
    "dependencies",
    "describeFinding",
    "describeFunction",
    "errorEnvelope",
    "evalUnits",
    "evalValues",
    "explainJson",
    "explainText",
    "explainView",
    "findingSummary",
    "fmt",
    "formatCheck",
    "formatInfer",
    "formatUnit",
    "functionNames",
    "infer",
    "inferSummary",
    "isProblem",
    "isReduce",
    "levenshtein",
    "lineOf",
    "listParams",
    "locate",
    "nodeReader",
    "nodeWriter",
    "onDisk",
    "parseDecorated",
    "parseScenarioJson",
    "planFmt",
    "planInfer",
    "precisionPhrase",
    "publicAssertions",
    "publicCharts",
    "publicFinding",
    "publicFnEntry",
    "publicProposal",
    "readMarker",
    "readVersion",
    "refText",
    "resolve",
    "resolveArtifactPath",
    "resolveScenario",
    "runCli",
    "signature",
    "simulateRun",
    "statusFromExit",
    "topoOrder",
    "unitJson",
    "unitSigText",
    "writeArtifact",
  ]);
});

/** Type-only exports leave no runtime trace, so they are read from the source. */
function typeExports(): string[] {
  const source = readFileSync(join(import.meta.dir, "../src/index.ts"), "utf8");
  const names: string[] = [];
  for (const m of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const raw of m[2]!.split(",")) {
      const spec = raw.replace(/\/\/.*$/gm, "").trim();
      if (spec === "") continue;
      if (m[1] !== undefined || spec.startsWith("type ")) names.push(spec.replace(/^type\s+/, ""));
    }
  }
  return names.sort();
}

test("the type exports are exactly these", () => {
  expect(typeExports()).toEqual([
    "AnchorTargetKind",
    "ArtifactWrite",
    "Binding",
    "CheckOptions",
    "CheckResult",
    "CommandName",
    "DocModel",
    "DocumentFile",
    "Edit",
    "ExplainView",
    "Expr",
    "Finding",
    "FindingCode",
    "FmtOptions",
    "FmtResult",
    "FnDoc",
    "FnEntry",
    "FnError",
    "FnExample",
    "FnKind",
    "FnParam",
    "FnPrecision",
    "FnSpec",
    "FunctionName",
    "JsonValue",
    "LocatedDoc",
    "OnDefaults",
    "ParamInfo",
    "PathResult",
    "PlannedEdit",
    "PlannedInsert",
    "Proposal",
    "ProposalKind",
    "ProseFigure",
    "RawAnchor",
    "RawBlock",
    "RawTable",
    "ReaderPort",
    "ScenarioEntry",
    "SealedRead",
    "Sheet",
    "SimulateRun",
    "SimulateRunOptions",
    "Span",
    "Unit",
    "UnitInfo",
    "UnitMap",
    "WriteErr",
    "WriteOk",
    "WriterPort",
  ]);
});

test("every export docs/library.md names as supported exists", () => {
  const doc = readFileSync(join(import.meta.dir, "../../../docs/library.md"), "utf8");
  const table = doc.slice(doc.indexOf("## The supported API"), doc.indexOf("## An example"));
  const named = [...table.matchAll(/`([A-Za-z]+)\(/g)].map((m) => m[1]!);
  expect(named.length).toBeGreaterThan(10);
  for (const name of named)
    expect({ name, exported: name in api }).toEqual({ name, exported: true });
  const types = typeExports();
  const typeLine = table.slice(table.indexOf("The types that go with them"));
  for (const [, name] of typeLine.matchAll(/`([A-Za-z]+)`/g)) {
    expect({ name, exported: types.includes(name!) }).toEqual({ name, exported: true });
  }
});
