# Using VisiMark as a library

The `visimark` npm package is the CLI and the engine in one. Importing it gives
you the same checks `visimark check` runs, without spawning a process:

```console
npm i visimark
bun add visimark
```

It is ESM only, runs under Node (the current LTS and later) and Bun, and has
one runtime dependency, `decimal.js`, which the type declarations name. Every
other module the engine uses is bundled into `dist/index.js`, so a dependency
update cannot change how a released version reads a document.

## The supported API

These are the exports a third party should build on. VisiMark is pre-1.0, so
even these can change in a minor release, but each change is in
[`CHANGELOG.md`](../CHANGELOG.md).

| Export | What it does |
|---|---|
| `analyze(source)` | Parses, models and checks a document in one call. Returns `{ model, result }`. What an editor wants: no file system. |
| `locate(source)`, `build(located)` | The two halves of parsing: find the `vmark` blocks, tables and anchors, then build the document model. |
| `check(model, opts?)` | Recomputes every formula. Returns a `CheckResult`; its `findings` are what `visimark check` prints. |
| `fmt(source, opts?)` | Repairs stale values. Returns `FmtResult`: the new text in `output`, counts, the findings it could not fix in `unfixable`, and in `artifacts` any generated files for **you** to write. It writes nothing itself. |
| `planFmt(model, result, opts)`, `applyEdits(source, edits)` | `fmt` as a plan of byte-range edits, and the function that applies them. |
| `infer(source)`, `planInfer(source, only?)` | Proposes rules that reproduce a document's numbers, and plans their insertion. |
| `onDisk(path)` | Tells `check` and `fmt` where a document lives (`opts.doc`), so imported CSV files and chart artifacts resolve. Leave `doc` out for a buffer with no file: those phases stand down. |
| `describeFinding(finding)`, `formatCheck(path, findings)` | A finding as one line, and a whole report, in the CLI's words. |
| `isProblem(finding)` | True when a finding is something to fix (`STALE` or an error) rather than advice. Any problem makes `check` exit 1. |
| `publicFinding(file, finding)`, `findingSummary(findings)` | A finding and a summary in the shape of `check --json`, specified in [`docs/design/structured-output-json-spec.md`](design/structured-output-json-spec.md). |
| `readVersion()` | The engine's version: the `visimark` field of every `--json` envelope. |

The types that go with them: `CheckResult`, `CheckOptions`, `Finding`,
`FindingCode`, `DocModel`, `DocumentFile`, `FmtOptions`, `FmtResult`,
`PlannedEdit`, `Edit`, `Proposal`, `PlannedInsert`.

## An example

```ts
import { readFileSync } from "node:fs";
import { build, check, describeFinding, isProblem, locate, onDisk } from "visimark";

const path = "invoice.md";
const source = readFileSync(path, "utf8");
const result = check(build(locate(source)), { doc: onDisk(path) });

for (const finding of result.findings) console.log(describeFinding(finding));
process.exitCode = result.findings.some(isProblem) ? 1 : 0;
```

## Everything else

`index.ts` exports more than this: sixty runtime exports and nearly fifty types in
all. The rest are there because this repository's own front ends need them:
the MCP server, the language server and the editor plugins. They include
`runCli`, the artifact write gate, the `simulate` scenario machinery and small
helpers such as `levenshtein`. They are not supported API. Any of them can
change or disappear in any release, without a changelog entry aimed at you.

`packages/visimark/test/api-surface.test.ts` lists every export by name, so
adding or removing one is a reviewable change to that list. That list is a
record, not a promise.

<!--vmark:no-formulas-->
