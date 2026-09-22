# A `markdownlint` custom rule wrapping `visimark check` — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a new package, `markdownlint-rule-visimark`, exposing seventeen `markdownlint` custom rules — one per `FindingCode` — so a project already running `markdownlint`/`markdownlint-cli2` sees VisiMark findings in that same run.

**Architecture:** A thin translation layer with no new engine surface. Each rule declares `parser: "none"`, reconstructs the source with `params.lines.join("\n")`, and asks a shared one-entry cache for that source's findings — so the seventeen rules pay one `analyze()` call per document, not seventeen. Each rule emits `onError({ lineNumber, detail })` for the findings carrying its own code, using the already-public `lineOf` and `describeFinding`. Severity is not modelled: `markdownlint` has no non-fatal tier, so the advisory split lives in a published config fragment consumed through `markdownlint`'s own `extends`.

**Tech Stack:** TypeScript, Bun (build/test), `markdownlint` and `markdownlint-cli2` (dev-only — the published package imports nothing from either at runtime), `visimark` (runtime dependency, exact version pin).

**Spec:** [`docs/design/markdownlint-rule-spec.md`](markdownlint-rule-spec.md)

## Global Constraints

- Commit trailer: resolve `Co-Authored-By:` from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) at commit time — never hardcode a vendor name in a step's example command. The commits already on this branch say `Claude Opus 5` because that is who wrote them; that is not a reason to stamp the same line on yours.
- Package: npm name `markdownlint-rule-visimark`, directory `packages/markdownlint-visimark`, dependency on `visimark` is an **exact** version pin (`"0.1.7"`, not a caret range) — never `workspace:*` (spec §2.1, §5).
- **No new engine export, and no change to any file under `packages/visimark/`.** `analyze`, `lineOf` and `describeFinding` are all already public (spec §2.1, §6). A task that edits the engine is a plan failure.
- The default export is an **array of seventeen rule objects**, one per `FindingCode` — no more, no fewer (spec §2.3).
- `names` is `` [`visimark-${code.toLowerCase()}`] ``, `tags` is `["visimark"]` plus `"visimark-advisory"` for `WARN` and `NOTE` only, `parser` is `"none"` (spec §2.3).
- `information` is a `URL` **instance**, never a string — a string throws inside `markdownlint` v0.41.1's rule validation and takes the whole run down (spec §2.3).
- `onError` carries `lineNumber` and `detail` only: no `range`, no `fixInfo`, no `context` — all three closed for this version, not deferred as maybes (spec §3, §8).
- A finding with `anchorGroup` set is **never** reported; a finding with no `span` is reported at line **1** (spec §3).
- **Front matter is never handled by this package.** `markdownlint` strips it from `params.lines` and adds `frontMatterLines.length` back to every reported `lineNumber` itself. `params.frontMatterLines` is never read; adding an offset double-counts it (spec §2.2).
- No rule reads `params.config`; the package exposes no options at all (spec §8).
- `bunx visimark` runs the *published* package, not this branch. Any local check uses `bun run packages/visimark/src/cli/main.ts`.

## Review Focus

- **`"default": false` with nothing re-enabling the custom rules.** `markdownlint`'s `default` switch governs custom rules too, so a test config using it silently lints with zero VisiMark rules active and passes green while doing nothing. This is how the first prototype run looked correct. Pin it: a config with `"default": false` and no `visimark` re-enable reports **zero** violations, and every other test asserts a non-zero count rather than trusting a green run. (Task 1)
- **A second document in the same run whose content differs.** The cache is one entry keyed by the source string. A clean document linted after a stale one must report nothing — a cache compared by identity, or never invalidated, would leak the first document's findings into the second. (Task 1)
- **Two different documents with byte-identical content in one run.** The other half of the same cache: the second must still report its findings from the cache hit, not be skipped as already-seen. (Task 1)
- **A document with no table and no `vmark` block at all** — ordinary prose, which is most of what `markdownlint` is pointed at. `analyze()` returns zero findings and the rules must call `onError` zero times, not emit a spurious `COVERAGE` at line 1. (Task 1)
- **Front matter.** The reported line must be shifted by exactly the front matter's length, once, by `markdownlint` — a package that adds its own offset double-counts, and the bug is invisible on every document without front matter. (Task 1)

---

### Task 1: The `markdownlint-rule-visimark` package

**Files:**
- Create: `packages/markdownlint-visimark/package.json`
- Create: `packages/markdownlint-visimark/tsconfig.json`
- Create: `packages/markdownlint-visimark/tsconfig.build.json`
- Create: `packages/markdownlint-visimark/LICENSE` (copy of the repository root `LICENSE`, verbatim)
- Create: `packages/markdownlint-visimark/README.md`
- Create: `packages/markdownlint-visimark/recommended.json`
- Create: `packages/markdownlint-visimark/src/descriptions.ts`
- Create: `packages/markdownlint-visimark/src/findings.ts`
- Create: `packages/markdownlint-visimark/src/index.ts`
- Test: `packages/markdownlint-visimark/test/rules.test.ts`
- Test: `packages/markdownlint-visimark/test/lint.test.ts`

**Interfaces:**
- Consumes: `analyze`, `lineOf`, `describeFinding`, and the types `Finding` and `FindingCode`, all from `visimark` — all five already public, none added here.
- Produces:
  - default export of `src/index.ts` — `Rule[]`, seventeen entries. Package name on npm: `markdownlint-rule-visimark`.
  - `export interface Rule` from `src/index.ts` — `{ names: string[]; description: string; tags: string[]; parser: "none"; information: URL; function: (params: RuleParams, onError: RuleOnError) => void }`.
  - `findingsFor(source: string): readonly Finding[]` from `src/findings.ts`, plus `parseCount(): number` and `resetFindingsCache(): void` — used by the tests, never re-exported from the package root and therefore not part of the published surface.
  - `DESCRIPTIONS: Record<FindingCode, string>` from `src/descriptions.ts`.
  - `recommended.json` — `{ "visimark-advisory": false }`, published at the `./recommended` subpath.

- [ ] **Step 1: Scaffold the package manifest**

Create `packages/markdownlint-visimark/package.json`:

```json
{
  "name": "markdownlint-rule-visimark",
  "version": "0.1.7",
  "description": "markdownlint custom rules that run visimark check over a document and report its findings alongside your other rules.",
  "keywords": [
    "lint",
    "markdown",
    "markdownlint",
    "markdownlint-cli2",
    "markdownlint-rule",
    "visimark"
  ],
  "homepage": "https://github.com/michal-niedzwiedzki/visimark#readme",
  "bugs": "https://github.com/michal-niedzwiedzki/visimark/issues",
  "license": "MIT",
  "author": "Michał Niedźwiedzki <michal@epsi.pl>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/michal-niedzwiedzki/visimark.git",
    "directory": "packages/markdownlint-visimark"
  },
  "files": [
    "dist",
    "recommended.json",
    "README.md",
    "LICENSE"
  ],
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./recommended": "./recommended.json"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "bun build src/index.ts --target node --outdir dist && tsc -p tsconfig.build.json",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  },
  "dependencies": {
    "visimark": "0.1.7"
  },
  "devDependencies": {
    "markdownlint": "^0.41.1",
    "markdownlint-cli2": "^0.23.3"
  }
}
```

Three things here are load-bearing and easy to drop:

- `"visimark": "0.1.7"` is an exact pin, not `"^0.1.7"` — Task 2's version-agreement check compares this string byte-for-byte with `packages/visimark/package.json`'s own `version`.
- `"recommended.json"` is in `files` and `"./recommended"` is in `exports`. Without both, `extends: "markdownlint-rule-visimark/recommended"` fails for every consumer while every test in this package still passes, because the tests import the JSON by relative path.
- The root workspace glob is already `["packages/*", "editors/*"]`, so this directory is picked up with no change to the root `package.json`.

- [ ] **Step 2: Scaffold the TypeScript config**

Create `packages/markdownlint-visimark/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "resolveJsonModule": true,
    "paths": {
      "visimark": ["../visimark/src/index.ts"]
    }
  },
  "include": ["src", "test"]
}
```

`resolveJsonModule` is here and not in the sibling packages because
`test/lint.test.ts` imports `recommended.json` — the tests assert on the same
bytes the package publishes rather than restating the fragment.

Create `packages/markdownlint-visimark/tsconfig.build.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Add LICENSE, the config fragment, and the README**

```bash
cp LICENSE packages/markdownlint-visimark/LICENSE
```

Create `packages/markdownlint-visimark/recommended.json`:

```json
{ "visimark-advisory": false }
```

Create `packages/markdownlint-visimark/README.md`:

````markdown
# markdownlint-rule-visimark

[`markdownlint`](https://github.com/DavidAnson/markdownlint) custom rules that
run [`visimark check`](https://github.com/michal-niedzwiedzki/visimark) over a
document and report its findings alongside every other rule your project
already runs — a wrong total fails the same lint run `MD013` does.

## Install

```sh
npm install --save-dev markdownlint-rule-visimark
```

## Use

`.markdownlint-cli2.jsonc`:

```jsonc
{
  "config": {
    "extends": "markdownlint-rule-visimark/recommended",
    "default": true
  },
  "customRules": ["markdownlint-rule-visimark"]
}
```

`extends` goes **inside** `config`. It is a `markdownlint` config property, not
a `markdownlint-cli2` one, and at the top level it is silently ignored.

```console
$ npx markdownlint-cli2 "docs/**/*.md"
docs/quote.md:12 error visimark-assert An assert statement evaluated false [assert spent <= budget: 5 <= 1 is false]

Summary: 1 error(s)
$ echo $?
1
```

## The rules

One rule per VisiMark finding kind, named after it: `visimark-stale`,
`visimark-date`, `visimark-unit`, `visimark-undef`, `visimark-dup`,
`visimark-vector`, `visimark-cycle`, `visimark-type`, `visimark-sheet`,
`visimark-anchor`, `visimark-assert`, `visimark-precision`,
`visimark-artifact`, `visimark-import`, `visimark-warn`, `visimark-note`,
`visimark-coverage`. They are the same identifiers
[`remark-lint-visimark`](https://www.npmjs.com/package/remark-lint-visimark)
reports as its `ruleId`.

Three levers, all `markdownlint`'s own:

| `config` entry | Effect |
|---|---|
| `"visimark-date": false` | one finding kind off |
| `"visimark-advisory": false` | the advisory kinds (`WARN`, `NOTE`) off |
| `"visimark": false` | every VisiMark rule off |

## `recommended`

`markdownlint` has no non-fatal tier: every violation fails the run. VisiMark's
advisory findings do not fail `visimark check`, so reporting them here would
fail a lint run on a document `check` passes. `recommended` is one line —
`{ "visimark-advisory": false }` — and extending it gives you a run whose exit
code agrees with `check`'s. Without it you get everything, which is also a
reasonable choice; nothing is hidden from you either way.

The reported count still differs from `check`'s footer: stale prose anchors are
folded into one summary finding that this package does not report separately,
and `recommended` switches the advisory kinds off. The **exit codes agree in
every case** — only the headline number differs.

## Contract

No options, no autofix (`markdownlint-cli2 --fix` leaves these rules alone),
and a line number but no column highlight. Only `check` ever runs: `fmt`,
`infer`, `explain`, `eval` and `--json` are not reachable through this package.
See [`docs/ci.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/ci.md)
in the main repository for the full write-up.
````

- [ ] **Step 4: Write the rule descriptions**

Create `packages/markdownlint-visimark/src/descriptions.ts`:

```ts
import type { FindingCode } from "visimark";

/**
 * `markdownlint` prints `description` before a violation's `detail`, so this is
 * the fixed "what this rule is" half and `detail` carries the specifics.
 *
 * These are `docs/visimark-design.md` §10's Meaning column, sentence-cased and
 * with its cross-reference links stripped. The taxonomy is the documentation;
 * this is a transcription of it, not a second authoring of it that could drift.
 *
 * The `Record<FindingCode, …>` annotation is what keeps the seventeen rules in
 * step with the engine: a new `FindingCode` fails this file's typecheck rather
 * than quietly shipping a code with no rule.
 */
export const DESCRIPTIONS: Record<FindingCode, string> = {
  STALE: "Stored value or artifact disagrees with its formula",
  DATE: "Not an ISO 8601 calendar date",
  UNIT:
    "A column mixes unit decorations, a value is decorated on both sides, or a `%` display sigil shares a span with a unit",
  UNDEF: "Unresolvable name",
  DUP: "A name is bound twice in one scope, or two header cells sharing text",
  VECTOR: "Foreign column outside an aggregate",
  CYCLE: "Circular dependency",
  TYPE:
    "Illegal operand types, a malformed call, or a `%` display sigil on a non-numeric scalar or a chart/image",
  SHEET: "Column rules with no table, or an `assert` in a document-scope block",
  ANCHOR: "Anchor with no rewritable target",
  PRECISION:
    "A numeric binding with no declared width and none derivable, a value too large to carry the width it has, or a `%` display sigil on a binding whose width is below 2",
  ASSERT: "An `assert` statement evaluated false",
  ARTIFACT: "A declared artifact cannot be built or written",
  IMPORT: "A declared local import cannot be resolved",
  WARN: "Scalar defined and never read, or an alias declared and never used",
  NOTE: "Finding suppressed by an upstream error",
  COVERAGE: "A table with no `vmark` rules, or a `no-formulas` marker on a document that has them",
};
```

- [ ] **Step 5: Write the failing cache tests**

Create `packages/markdownlint-visimark/test/rules.test.ts`:

```ts
import { beforeEach, expect, test } from "bun:test";
import rules from "../src/index.js";
import { DESCRIPTIONS } from "../src/descriptions.js";
import { findingsFor, parseCount, resetFindingsCache } from "../src/findings.js";

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

beforeEach(() => {
  resetFindingsCache();
});

test("one rule per FindingCode, seventeen of them", () => {
  expect(rules).toHaveLength(17);
  expect(rules.map((r) => r.names[0])).toEqual([
    "visimark-stale",
    "visimark-date",
    "visimark-unit",
    "visimark-undef",
    "visimark-dup",
    "visimark-vector",
    "visimark-cycle",
    "visimark-type",
    "visimark-sheet",
    "visimark-anchor",
    "visimark-assert",
    "visimark-precision",
    "visimark-artifact",
    "visimark-import",
    "visimark-warn",
    "visimark-note",
    "visimark-coverage",
  ]);
});

test("every rule carries the visimark tag; only WARN and NOTE are advisory", () => {
  for (const rule of rules) {
    expect(rule.tags).toContain("visimark");
  }
  const advisory = rules.filter((r) => r.tags.includes("visimark-advisory")).map((r) => r.names[0]);
  expect(advisory).toEqual(["visimark-warn", "visimark-note"]);
});

test("every rule opts out of markdownlint's parsers and describes itself", () => {
  for (const rule of rules) {
    expect(rule.parser).toBe("none");
    expect(rule.description.length).toBeGreaterThan(0);
  }
  expect(rules.map((r) => r.description)).toEqual(Object.values(DESCRIPTIONS));
});

test("information is a URL instance, not a string", () => {
  // markdownlint v0.41.1 throws inside rule validation on a string here and
  // takes the whole run down — not a cosmetic difference.
  for (const rule of rules) {
    expect(rule.information).toBeInstanceOf(URL);
    expect(rule.information.href).toBe(
      "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy",
    );
  }
});

test("the seventeen rules pay one analyze() call per document", () => {
  for (const rule of rules) {
    rule.function({ lines: stale.split("\n") }, () => {});
  }
  expect(parseCount()).toBe(1);
});

test("a second document with different content invalidates the cache", () => {
  expect(findingsFor(stale)).toHaveLength(1);
  expect(findingsFor(clean)).toHaveLength(0);
  expect(parseCount()).toBe(2);
});

test("a second document with byte-identical content still reports, from the cache", () => {
  const first = findingsFor(stale);
  const second = findingsFor(stale.slice(0)); // equal content, one analyze() call
  expect(second).toHaveLength(1);
  expect(second[0]!.code).toBe(first[0]!.code);
  expect(parseCount()).toBe(1);
});

test("prose with no table and no vmark block produces nothing", () => {
  const prose = "# Notes\n\nNothing to check here.\n";
  let calls = 0;
  for (const rule of rules) {
    rule.function({ lines: prose.split("\n") }, () => {
      calls++;
    });
  }
  expect(findingsFor(prose)).toHaveLength(0);
  expect(calls).toBe(0);
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd packages/markdownlint-visimark && bun test`
Expected: FAIL — `src/index.ts` and `src/findings.ts` do not exist yet.

- [ ] **Step 7: Implement the cache**

Create `packages/markdownlint-visimark/src/findings.ts`:

```ts
import { analyze, type Finding } from "visimark";

/**
 * One entry is enough. `markdownlint` runs a file's rules consecutively within
 * one synchronous pass, so the first of the seventeen rules to run for a file
 * fills this and the other sixteen hit it — one `analyze()` per document, not
 * seventeen. No two files can interleave through it even when
 * `markdownlint-cli2` lints files concurrently, because every rule here is
 * synchronous (none declares `asynchronous: true`).
 */
let memo: { source: string; findings: readonly Finding[] } | undefined;

/** Real `analyze()` calls, for the test that pins the one-parse property. */
let parses = 0;

export function findingsFor(source: string): readonly Finding[] {
  if (memo?.source !== source) {
    parses += 1;
    memo = { source, findings: analyze(source).result.findings };
  }
  return memo.findings;
}

/** Test-only. Not re-exported from the package root, so it is not published surface. */
export function parseCount(): number {
  return parses;
}

/** Test-only. */
export function resetFindingsCache(): void {
  memo = undefined;
  parses = 0;
}
```

- [ ] **Step 8: Implement the rules**

Create `packages/markdownlint-visimark/src/index.ts`:

```ts
import { describeFinding, lineOf, type FindingCode } from "visimark";
import { DESCRIPTIONS } from "./descriptions.js";
import { findingsFor } from "./findings.js";

/**
 * The half of `markdownlint`'s rule API these rules touch, declared structurally
 * rather than imported: the published package depends on `visimark` and nothing
 * else, and a type imported from a devDependency would not resolve for a
 * consumer reading the emitted `.d.ts`.
 */
export interface RuleParams {
  /**
   * The document's lines, front matter already removed. `markdownlint` adds
   * `frontMatterLines.length` back to every reported `lineNumber` itself, so
   * this package must not offset anything.
   */
  lines: readonly string[];
}

export interface RuleErrorInfo {
  lineNumber: number;
  detail: string;
}

export type RuleOnError = (info: RuleErrorInfo) => void;

export interface Rule {
  names: string[];
  description: string;
  tags: string[];
  parser: "none";
  information: URL;
  function: (params: RuleParams, onError: RuleOnError) => void;
}

const ADVISORY: ReadonlySet<FindingCode> = new Set<FindingCode>(["WARN", "NOTE"]);

const INFORMATION = new URL(
  "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy",
);

const CODES = Object.keys(DESCRIPTIONS) as FindingCode[];

const rules: Rule[] = CODES.map((code) => ({
  names: [`visimark-${code.toLowerCase()}`],
  description: DESCRIPTIONS[code],
  tags: ADVISORY.has(code) ? ["visimark", "visimark-advisory"] : ["visimark"],
  parser: "none",
  information: INFORMATION,
  function: (params, onError) => {
    const source = params.lines.join("\n");
    for (const finding of findingsFor(source)) {
      if (finding.code !== code) continue;
      // The collapsed anchor-group rollup summarises stale prose anchors whose
      // own cells report with spans of their own; reporting it too would
      // double-count. A span-less finding that is not the rollup — the
      // document-scope COVERAGE — reports at line 1, markdownlint's only way
      // to say "the file".
      if (finding.anchorGroup) continue;
      onError({
        lineNumber: finding.span ? lineOf(source, finding.span.start) : 1,
        detail: describeFinding(finding),
      });
    }
  },
}));

export default rules;
```

- [ ] **Step 9: Run the cache tests to verify they pass**

Run: `cd packages/markdownlint-visimark && bun test test/rules.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 10: Write the failing end-to-end lint tests**

Create `packages/markdownlint-visimark/test/lint.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { lint } from "markdownlint/promise";
import rules from "../src/index.js";
import recommended from "../recommended.json" with { type: "json" };

type LintConfig = Parameters<typeof lint>[0]["config"];

/** Every VisiMark rule on, nothing else — markdownlint's own built-ins stay out of the assertions. */
const only: LintConfig = { default: false, visimark: true };

type Reported = { line: number; rule: string; detail: string };

async function run(
  strings: Record<string, string>,
  config: LintConfig = { ...only, ...recommended },
): Promise<Record<string, Reported[]>> {
  const results = await lint({ strings, customRules: rules, config });
  const out: Record<string, Reported[]> = {};
  for (const [name, errors] of Object.entries(results)) {
    out[name] = errors.map((e) => ({
      line: e.lineNumber,
      rule: e.ruleNames[0]!,
      detail: e.errorDetail!,
    }));
  }
  return out;
}

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const failingAssert = `\`\`\`vmark #calls
spent  = 5
budget = 1

assert spent <= budget
\`\`\`
`;

const unusedScalar = `\`\`\`vmark #s
unused = 1
\`\`\`
`;

/** A table and no rules at all: a document-scope COVERAGE finding, which has no span. */
const noRules = `# Roadmap

| Item | Cost |
|------|-----:|
| pen  | 1.00 |
`;

/** A stale scalar with a prose anchor: the cell's own STALE plus a span-less anchorGroup rollup. */
const anchored = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--vmark=lines.Net-->.
`;

const withFrontMatter = `---
title: Quote
author: nobody
draft: true
tags: [a, b]
---

${stale}`;

test("a stale cell reports one violation, on its own line", async () => {
  const report = await run({ stale });
  expect(report.stale).toEqual([
    {
      line: 3,
      rule: "visimark-stale",
      detail: "lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)",
    },
  ]);
});

test("a clean document reports nothing", async () => {
  const report = await run({ clean });
  expect(report.clean).toEqual([]);
});

test("a failing assert reports under visimark-assert", async () => {
  const report = await run({ assert: failingAssert });
  expect(report.assert).toEqual([
    { line: 5, rule: "visimark-assert", detail: "assert spent <= budget: 5 <= 1 is false" },
  ]);
});

test("a span-less document-scope COVERAGE reports at line 1", async () => {
  const report = await run({ roadmap: noRules });
  expect(report.roadmap).toEqual([
    {
      line: 1,
      rule: "visimark-coverage",
      detail: "a table with no `vmark` rules — nothing in this document is checked",
    },
  ]);
});

test("the collapsed anchor-group rollup is not reported; the cell it summarises is", async () => {
  const report = await run({ anchored });
  expect(report.anchored).toEqual([
    { line: 5, rule: "visimark-stale", detail: "lines.Net: stored 9.99 ≠ computed 10.00" },
  ]);
});

test("front matter shifts the line by exactly its length, once", async () => {
  // Five lines of YAML plus its two `---` fences is six lines of front matter,
  // then a blank line. markdownlint strips the front matter from params.lines
  // and adds its length back itself — this package adds nothing.
  const report = await run({ front: withFrontMatter, stale });
  expect(report.front).toHaveLength(1);
  expect(report.front![0]!.rule).toBe("visimark-stale");
  expect(report.front![0]!.line).toBe(report.stale![0]!.line + 6);
});

test("recommended switches the advisory kinds off", async () => {
  const report = await run({ unusedScalar });
  expect(report.unusedScalar).toEqual([]);
});

test("without recommended, an advisory finding reports", async () => {
  const report = await run({ unusedScalar }, only);
  expect(report.unusedScalar).toEqual([
    { line: 2, rule: "visimark-warn", detail: "s.unused is defined and never read" },
  ]);
});

test("one finding kind can be switched off by name", async () => {
  const report = await run({ stale }, { ...only, ...recommended, "visimark-stale": false });
  expect(report.stale).toEqual([]);
});

test("the whole package can be switched off by tag", async () => {
  const report = await run({ stale }, { ...only, visimark: false });
  expect(report.stale).toEqual([]);
});

test('"default": false with no re-enable lints with zero VisiMark rules', async () => {
  // The silent-green trap: markdownlint's `default` switch governs custom rules
  // too, so a config like this passes while checking nothing. Pinned here so a
  // future test written this way cannot look green by accident.
  const report = await run({ stale }, { default: false });
  expect(report.stale).toEqual([]);
});

test("a clean document linted after a stale one in the same run reports nothing", async () => {
  const report = await run({ stale, clean });
  expect(report.stale).toHaveLength(1);
  expect(report.clean).toEqual([]);
});

test("two documents with byte-identical content both report", async () => {
  const report = await run({ a: stale, b: `${stale}` });
  expect(report.a).toHaveLength(1);
  expect(report.b).toHaveLength(1);
});

test("ordinary prose reports nothing", async () => {
  const report = await run({ prose: "# Notes\n\nNothing to check here.\n" });
  expect(report.prose).toEqual([]);
});

test("the drift invoice reports the twelve violations the spec's behaviour table names", async () => {
  // Spec §4's acceptance run, against the real document. `visimark check` on it
  // prints "26 problems (21 stale, 5 errors)": the difference is the eight prose
  // anchors folded into the skipped rollup and the advisory findings
  // `recommended` switches off. markdownlint sorts its results by rule name, so
  // assert the tally and spot-check details rather than an ordered array.
  const drift = readFileSync(new URL("../../../docs/example-invoice-drift.md", import.meta.url), "utf8");
  const report = await run({ drift });
  const violations = report.drift!;
  expect(violations).toHaveLength(12);

  const byRule: Record<string, number> = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  expect(byRule).toEqual({
    "visimark-stale": 7,
    "visimark-date": 2,
    "visimark-cycle": 1,
    "visimark-undef": 1,
    "visimark-vector": 1,
  });

  expect(violations).toContainEqual({
    line: 22,
    rule: "visimark-stale",
    detail: "lines.Net (On-call support): stored 3120.00 ≠ computed 5200.00 (Qty * Rate)",
  });
  expect(violations).toContainEqual({
    line: 44,
    rule: "visimark-date",
    detail:
      '"11/12/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-12-11 or 2026-11-12, 29 days apart',
  });
  expect(violations).toContainEqual({
    line: 74,
    rule: "visimark-cycle",
    detail: "late_fees.base → late_fees.fee → late_fees.total → late_fees.base",
  });
});
```

If `tsc` rejects `customRules: rules` because this package's structural `Rule`
is narrower than `markdownlint`'s own, widen it at that call site —
`customRules: rules as Parameters<typeof lint>[0]["customRules"]` — rather than
loosening anything in `src/`. The published contract is the rule objects, not
`markdownlint`'s type declarations, and this package deliberately does not
depend on them.

- [ ] **Step 11: Run the lint tests to verify they pass**

```bash
cd packages/markdownlint-visimark && bun install && bun test
```

Expected: PASS, all 23 tests across the two files (8 in `rules.test.ts`, 15 in `lint.test.ts`). If `lint` cannot be imported, `markdownlint` was not installed — it is a devDependency of this package, so `bun install` must run from the repo root or this directory before the tests.

The one number worth checking by hand rather than trusting: the front-matter test asserts `+6`, which is the two `---` fences plus four YAML lines in `withFrontMatter`. If you edit that fixture, edit the offset.

- [ ] **Step 12: Prove the documented consumer config works end to end**

The tests above drive `markdownlint`'s own `lint()` with the rules passed in
directly. That never exercises the config shape the README and `docs/ci.md`
tell a consumer to write — `extends` **nested inside `config`**, which is the
single easiest thing to get wrong. Check it once, by hand:

```bash
mkdir -p /tmp/vmark-cli2 && cd /tmp/vmark-cli2
cat > .markdownlint-cli2.jsonc <<'EOF'
{
  "config": {
    "extends": "<REPO>/packages/markdownlint-visimark/recommended.json",
    "default": false,
    "visimark": true
  },
  "customRules": ["<REPO>/packages/markdownlint-visimark/src/index.ts"]
}
EOF
printf '| Item | Qty | Rate |  Net |\n|------|----:|-----:|-----:|\n| pen  |   2 | 5.00 | 9.99 |\n\n```vmark #lines\nNet = Qty * Rate\n```\n' > stale.md
printf '```vmark #s\nunused = 1\n```\n' > warn.md
bunx markdownlint-cli2 "*.md"; echo "exit=$?"
```

Replace `<REPO>` with the absolute path to this checkout. Expected, exactly:

```console
Summary: 1 issue in 1 file
stale.md:3 error visimark-stale Stored value or artifact disagrees with its formula [lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)]
exit=1
```

One violation, not two: `warn.md`'s `visimark-warn` is suppressed by the
extended fragment. If `warn.md` also reports, `extends` did not take — check
that it is inside `config` and not beside it. Clean up with
`rm -rf /tmp/vmark-cli2` when it passes; nothing from this step is committed.

- [ ] **Step 13: Typecheck, lint, format and build**

```bash
cd packages/markdownlint-visimark && bun run typecheck
cd ../.. && bun run lint && bun run format:check
bun run --filter markdownlint-rule-visimark build
```

Expected: no errors, and `packages/markdownlint-visimark/dist/index.js` plus `dist/index.d.ts` exist. If `format:check` complains about the new files, run `bun run format` and re-check.

- [ ] **Step 14: Commit**

```bash
git add packages/markdownlint-visimark bun.lock
git commit -m "feat: add markdownlint-rule-visimark, seventeen markdownlint rules wrapping visimark check

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

---

### Task 2: CI version-agreement check and the release publish leg

**Files:**
- Modify: `.github/workflows/ci.yml:30-79` (the "every version-carrying file must agree" step and its preceding comment)
- Modify: `.github/workflows/release.yml:119-130` (a new leg after "Publish the remark plugin to npm"), `:265` and `:280` (the gate's leg-outcome loop), `:315-325` (the registry-presence checks)
- Modify: `docs/releasing.md:88-104` ("Bump the version" step)

**Interfaces:**
- Consumes: `packages/markdownlint-visimark/package.json`'s `"version"` and `"dependencies"."visimark"` fields (Task 1).

- [ ] **Step 1: Extend the version-agreement check**

In `.github/workflows/ci.yml`, inside the `every version-carrying file must agree` step, add the two extraction lines immediately after the `remark_dep=` line:

```yaml
          markdownlint_version=$(bun -e 'console.log(require("./packages/markdownlint-visimark/package.json").version)')
          markdownlint_dep=$(bun -e 'console.log(require("./packages/markdownlint-visimark/package.json").dependencies.visimark)')
```

Replace the `echo` line that follows with:

```yaml
          echo "engine=$engine lsp=$lsp vscode=$ext action.yml=$pinned precommit-hook=$precommit_versions remark-plugin=$remark_version remark-plugin-dep=$remark_dep markdownlint-rule=$markdownlint_version markdownlint-rule-dep=$markdownlint_dep"
```

and extend the `for pair in …` list with two more entries, keeping the existing five:

```yaml
          for pair in "packages/visimark-lsp/package.json:$lsp" "editors/vscode/package.json:$ext" "action.yml:$pinned" "scripts/precommit-visimark-check.sh:$precommit" "packages/remark-visimark/package.json (version):$remark_version" "packages/remark-visimark/package.json (visimark dep):$remark_dep" "packages/markdownlint-visimark/package.json (version):$markdownlint_version" "packages/markdownlint-visimark/package.json (visimark dep):$markdownlint_dep"; do
```

Then update the step's preceding comment block: wherever it counts the files or values (`packages/remark-visimark/package.json` is described there as contributing two), add `packages/markdownlint-visimark/package.json` beside it with the same two-values note, and correct any count wording so it matches the nine values the loop now compares.

- [ ] **Step 2: Add the release publish leg**

In `.github/workflows/release.yml`, immediately after the `Publish the remark plugin to npm` step (which ends at line 130, before `Package the extension`), add:

```yaml
      - name: Publish the markdownlint rule to npm
        id: markdownlint-rule
        continue-on-error: true
        working-directory: packages/markdownlint-visimark
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          if npm view "markdownlint-rule-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; then
            echo "markdownlint-rule-visimark@$ENGINE_VERSION is already on npm; skipping."
          else
            npm publish --provenance --access public
          fi
```

- [ ] **Step 3: Add the leg to the release gate**

Two edits in the `every leg must have landed` step.

In its `env:` block, after the `REMARK_PLUGIN_OUTCOME` line, add:

```yaml
          MARKDOWNLINT_RULE_OUTCOME: ${{ steps.markdownlint-rule.outcome }}
```

In the `for pair in \` loop, after the `"Publish the remark plugin to npm=$REMARK_PLUGIN_OUTCOME" \` line, add:

```yaml
            "Publish the markdownlint rule to npm=$MARKDOWNLINT_RULE_OUTCOME" \
```

- [ ] **Step 4: Add the registry-presence check**

Spec §5 asks for this leg to join the gate's registry-presence retry "beside the
`remark` plugin's entry". Read the file first: **there is no such entry.** The
gate asks npm only about `visimark` itself, so today two of the three published
npm packages could publish nothing and still pass. Close both, since the
one-line asymmetry is the whole bug:

Beside the existing `on_npm` definition, add:

```bash
          on_npm_remark() { npm view "remark-lint-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; }
          on_npm_markdownlint() { npm view "markdownlint-rule-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; }
```

and immediately after the existing `if retry on_npm; then … fi` block, add:

```bash
          if retry on_npm_remark; then
            echo "npm has remark-lint-visimark@$ENGINE_VERSION."
          else
            echo "::error::npm still does not have remark-lint-visimark@$ENGINE_VERSION after ~10 minutes of retries — this is absence, not lag. Fix the remark plugin leg and re-run this workflow; do not publish by hand (see docs/releasing.md)."
            fail=1
          fi

          if retry on_npm_markdownlint; then
            echo "npm has markdownlint-rule-visimark@$ENGINE_VERSION."
          else
            echo "::error::npm still does not have markdownlint-rule-visimark@$ENGINE_VERSION after ~10 minutes of retries — this is absence, not lag. Fix the markdownlint rule leg and re-run this workflow; do not publish by hand (see docs/releasing.md)."
            fail=1
          fi
```

If the maintainer would rather keep `remark-lint-visimark` out of this change,
drop the `on_npm_remark` definition and its block and keep the
`markdownlint-rule-visimark` one; the spec requires only the latter.

- [ ] **Step 5: Update the release checklist**

In `docs/releasing.md`, step 3 currently opens `**Bump the version** to the same `X.Y.Z` in all six version-carrying files:` over a list of six paths. Replace the list with:

```
   packages/visimark/package.json
   packages/visimark-lsp/package.json
   editors/vscode/package.json
   action.yml                                  # the `version` input's default
   scripts/precommit-visimark-check.sh         # both visimark@ pins inside it
   packages/remark-visimark/package.json       # its own version AND its visimark dependency pin
   packages/markdownlint-visimark/package.json # its own version AND its visimark dependency pin
```

and change `all six version-carrying files` to `all seven version-carrying files`, and the sentence ending `if you miss one of these seven values` to `if you miss one of these nine values` (the two package manifests contribute two each). Leave the rest of the paragraph — including the sentence about `ci.yml`'s check being the confirmation — as it stands.

- [ ] **Step 6: Run the local checks**

```bash
bun -e 'console.log(require("./packages/markdownlint-visimark/package.json").version)'
bun -e 'console.log(require("./packages/markdownlint-visimark/package.json").dependencies.visimark)'
bun run packages/visimark/src/cli/main.ts check docs/releasing.md
```

Expected: `0.1.7` twice, then `0 problems`. (The version-agreement step itself only runs in CI; these two lines are the part of it that can be wrong locally. `docs/releasing.md` is in the dogfood check's file list, so its edit has to stay clean.)

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml docs/releasing.md
git commit -m "chore: track the markdownlint rule package in the version-agreement check and release workflow

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

---

### Task 3: Documentation, changelog, and catalogue

**Files:**
- Modify: `docs/ci.md` (new chapter 25 at the end of Part 6; existing 25→26, 26→27, 27→28)
- Modify: `docs/visimark-design.md:607-628` (§10's table gains a `COVERAGE` row)
- Modify: `README.md:327-329` (one sentence in "In CI")
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Modify: `docs/vocabulary-catalogue.md:259` (the section F row moves to the Shipped register)
- Delete: `docs/design/markdownlint-rule-handoff.md`

**Interfaces:** none — this task touches no code.

- [ ] **Step 1: Renumber `docs/ci.md`'s trailing chapters**

The new chapter lands **inside Part 6**, immediately before the `# Part 7 — Rolling it out` divider, so the Part 7 boundary does not move. Confirmed against the working tree: the only cross-reference to a `ci.md` chapter number from another file is `README.md`'s link to chapter 24, which is unaffected. (`docs/tutorial.md`'s "chapter 24/26/27" mentions are that document's own, independent numbering — leave them alone.)

Edit only the three heading lines:

```
## 25. Turning it on in a repository that already has documents   →   ## 26. Turning it on in a repository that already has documents
## 26. Troubleshooting                                             →   ## 27. Troubleshooting
## 27. The checklist                                                →   ## 28. The checklist
```

Renumber from the bottom up (27 first, then 26, then 25) so no edit collides with a heading that already has the number it is about to take.

- [ ] **Step 2: Insert the new chapter**

Chapter 24 ends with the paragraph beginning "The plugin takes no options", followed by a `---` divider and then `# Part 7 — Rolling it out`. Insert, between that paragraph and that `---`:

````markdown

---

## 25. The `markdownlint` custom rule

A project already running
[`markdownlint`](https://github.com/DavidAnson/markdownlint) or
`markdownlint-cli2` gets the same findings in that run with
`markdownlint-rule-visimark` — two entries in the config it already has:

```jsonc
{
  "config": {
    "extends": "markdownlint-rule-visimark/recommended",
    "default": true
  },
  "customRules": ["markdownlint-rule-visimark"]
}
```

`extends` goes **inside** `config`. It is a `markdownlint` config property, not
a `markdownlint-cli2` one, and at the top level it is quietly ignored — the run
then reports advisory findings you asked it not to.

```console
$ npx markdownlint-cli2 "docs/**/*.md"
docs/quote.md:12 error visimark-assert An assert statement evaluated false [assert spent <= budget: 5 <= 1 is false]

Summary: 1 error(s)
$ echo $?
1
```

There is one rule per finding kind, named after it — `visimark-stale`,
`visimark-assert`, `visimark-coverage`, and so on for all seventeen — which are
the same identifiers the `remark` plugin in chapter 24 reports as its `ruleId`.
That gives three switches, all `markdownlint`'s own rather than anything this
package invented:

| `config` entry | Effect |
|---|---|
| `"visimark-date": false` | one finding kind off |
| `"visimark-advisory": false` | the advisory kinds (`WARN`, `NOTE`) off |
| `"visimark": false` | every VisiMark rule off |

`recommended` is the middle one of those, and nothing else:
`{ "visimark-advisory": false }`. It exists because `markdownlint` has no
non-fatal tier — every violation fails the run — while `check` does not fail on
advisory findings. Without the fragment, a document `visimark check` passes
with exit `0` fails `markdownlint-cli2` with exit `1`. Extending it gives you a
run whose exit code agrees with `check`'s; not extending it gives you every
finding, which is a reasonable choice too.

One number will not match, by design. `check` counts stale prose anchors
individually and prints advisory findings in its footer; this package folds the
anchors into a summary it does not report and, under `recommended`, leaves the
advice out. `visimark check docs/example-invoice-drift.md` prints
`26 problems (21 stale, 5 errors)` where the same document reports `12 issues`
here. **The exit codes agree in every case** — the headline number is the only
thing that differs, and the exit code is what a CI gate reads.

Like the other entries in this part, it only ever runs `check`: it takes no
options, does no autofix (`markdownlint-cli2 --fix` leaves these rules alone),
reports a line but no column, and `fmt`, `infer`, `explain`, `eval` and
`--json` are not reachable through it. See the package's own
[README](https://github.com/michal-niedzwiedzki/visimark/tree/master/packages/markdownlint-visimark)
for the full contract.
````

- [ ] **Step 3: Add the missing `COVERAGE` row to the taxonomy**

`docs/visimark-design.md` §10's table has never listed `COVERAGE`, though the engine has always emitted it. This is a pre-existing gap; this package is what surfaced it. Add one row at the end of the table, after the `NOTE` row:

```
| `COVERAGE` | a table with no `vmark` rules, or a `no-formulas` marker on a document that has them | no |
```

Nothing else in §10 changes — no behaviour is added, a row that should always have been there is.

- [ ] **Step 4: One sentence in the README**

In `README.md`'s "In CI" section, the paragraph about `remark-lint-visimark` ends with a link to `docs/ci.md` chapter 24. Immediately after it, add:

```markdown
A project on [`markdownlint`](https://github.com/DavidAnson/markdownlint) adds
them with
[`markdownlint-rule-visimark`](https://www.npmjs.com/package/markdownlint-rule-visimark)
— see [`docs/ci.md` chapter 25](docs/ci.md#25-the-markdownlint-custom-rule).
```

- [ ] **Step 5: Changelog**

In `CHANGELOG.md`, under `## Unreleased` → `### Added`, after the `remark`/`unified` plugin entry, add:

```markdown
- A `markdownlint` custom rule package, `markdownlint-rule-visimark`, reports
  `visimark check` findings inside an existing `markdownlint`/`markdownlint-cli2`
  run — one rule per finding kind, plus a `recommended` config fragment whose
  exit code agrees with `check`'s. See
  [`markdownlint-rule-spec.md`](docs/design/markdownlint-rule-spec.md)
  and [#153](https://github.com/michal-niedzwiedzki/visimark/issues/153).
```

- [ ] **Step 6: Move the catalogue row to the Shipped register**

`docs/vocabulary-catalogue.md` has an active section F table other issues also land rows in. Before editing, make sure this branch is on the current tip:

```bash
git fetch origin && git merge origin/master
```

Then delete the section F row whose **Request** cell links `#153` (its **Status** is `[APPROVED](…)`), and add this row to the **Shipped** table, after the `remark`/`unified` plugin row:

```
| A `markdownlint` custom rule wrapping `visimark check` (`markdownlint-rule-visimark`) | tooling | [#153](https://github.com/michal-niedzwiedzki/visimark/issues/153) | [#164](https://github.com/michal-niedzwiedzki/visimark/pull/164) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/153#issuecomment-5782250622) |
```

**Released** stays `—` and the status is not promoted to `SHIPPED`; #153 is not closed here either. The release workflow does both when a tagged release ships it.

- [ ] **Step 7: Delete the handoff note**

```bash
git rm docs/design/markdownlint-rule-handoff.md
```

It is a working note that exists so this implementation could be picked up cold, and it says to delete it in the commit that lands the implementation. [`markdownlint-rule-spec.md`](markdownlint-rule-spec.md) and this plan are the durable record. Before deleting, check nothing links to it: `grep -rn "markdownlint-rule-handoff" --exclude-dir=node_modules .` must return nothing but the file itself.

- [ ] **Step 8: Full local verification**

From the repo root:

```bash
bun install
bun run lint
bun run format:check
bun run typecheck
bun run build
bun test
bun run packages/visimark/src/cli/main.ts check docs/ci.md docs/visimark-design.md README.md CHANGELOG.md docs/vocabulary-catalogue.md docs/releasing.md
```

Expected: everything passes, and the final `check` exits `0` with `0 problems` per file. Those six documents are all in the dogfood workflow's file list, so a finding introduced by this task's prose fails CI.

- [ ] **Step 9: Commit**

```bash
git add docs/ci.md docs/visimark-design.md README.md CHANGELOG.md docs/vocabulary-catalogue.md docs/design/markdownlint-rule-handoff.md
git commit -m "docs: document the markdownlint rule, changelog, and catalogue entry for #153

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

- [ ] **Step 10: Push and wait for CI**

```bash
git push
gh pr checks 164 --watch
```

On green, promote the PR out of draft:

```bash
gh pr ready 164
```

Do not close #153 and do not touch the release workflow's promotion of the catalogue row — a tagged release does both.
