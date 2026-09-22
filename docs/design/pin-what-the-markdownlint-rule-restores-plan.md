# Pin the markdownlint restoration contract, and report analyze() failures once — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct `markdownlint-rule-visimark`'s overstated HTML-comment restoration claim (with tests pinning the three cases it does not cover), and make a thrown `analyze()` report as one violation instead of seventeen duplicate stack traces.

**Architecture:** Two independent changes sharing one package. (A) is documentation plus three new end-to-end tests against the real micromark parser — no runtime code changes. (B) makes `findings.ts`'s `findingsFor` catch and memoize an `analyze()` failure as a typed result instead of letting it throw, and adds an eighteenth `markdownlint` rule, `visimark-engine-error`, that is the only one of the eighteen that reports when that result is a failure — the other seventeen fall silent for that document.

**Tech Stack:** TypeScript, Bun test runner, `markdownlint`/`markdownlint-cli2`, micromark (via `markdownlint`'s `parsers.micromark`).

**Spec:** [`docs/design/pin-what-the-markdownlint-rule-restores-spec.md`](pin-what-the-markdownlint-rule-restores-spec.md)

## Global Constraints

- Runtime parity ([`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md)): this package has no `bin` entry, so nothing here needs an `sh` launcher or a second CI job.
- Every commit ends with the trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session executing this plan — do not hardcode a vendor name in commit messages; resolve it from that file at commit time.
- No CLI, exit-code, or `--json` change to `visimark` itself (spec §2, §3) — every task stays inside `packages/markdownlint-visimark`.
- `findingsFor`'s existing one-`analyze()`-call-per-document invariant (`findings.ts`'s `memo`, pinned by `test/lint.test.ts`'s `"seventeen rules cost one analyze() and one source reconstruction per document"`) must hold in both the success and the failure case after this plan (spec §2, §4).
- `visimark-engine-error` is never tagged `"visimark-advisory"` (spec §2) — it is a hard failure, not a downgradable finding kind.

## Review Focus

- A document that is merely `check`-invalid today (a real STALE/TYPE/etc. finding) must not start reporting through `visimark-engine-error` — only a thrown exception routes there; a normal finding array, even a long one, is the `{ ok: true }` branch. Task 3's tests exercise both a clean document and a findings-bearing document through the changed `findingsFor` to pin this.
- A CRLF document with an *ordinary*, single-line HTML comment must keep working exactly as it does on LF today — the fix in this plan is documentation and tests, not a behavior change, and it would be easy to accidentally "fix" the CRLF multi-line case in a way that regresses the common single-line case. Task 1's first test pins the single-line CRLF case unchanged.
- Two documents linted in the same `markdownlint-cli2` run, where the first throws and the second is clean, must not leak the first's cached failure onto the second — `findingsFor`'s memo is keyed on `source`, but the failure branch is new and untested against a second, different `source` in the same process. Task 3 adds this.
- A non-`Error` thrown value (a string, a plain object — unusual but not impossible from a dependency several layers down in `locate`/`build`/`check`) must still produce a readable one-line report, not `[object Object]` or a second uncaught throw from inside the `catch` block itself. Task 3's tests exercise this explicitly.
- `visimark-engine-error`'s own registration must not silently violate `descriptions.ts`'s `Record<FindingCode, …>` exhaustiveness contract — it is deliberately *not* added to `DESCRIPTIONS`/`CODES`, and a future reader could "fix" that as an apparent omission. Task 3 comments this at the point of definition, and `test/rules.test.ts`'s FindingCode-exhaustiveness test (Task 3) pins the seventeen/eighteen split.

---

### Task 1: Pin the restoration contract — tests first, then the doc comments

**Files:**
- Modify: `packages/markdownlint-visimark/test/lint.test.ts` (add three tests, and three fixtures, after the existing `withFrontMatter` fixture block around line 99)
- Modify: `packages/markdownlint-visimark/src/source.ts:16-30` (header doc comment)
- Modify: `docs/design/markdownlint-rule-spec.md:109-130` (§2.2 correction note)

**Interfaces:**
- Consumes: `rules` (default export of `../src/index.js`), `run()` and `only` from the existing `lint.test.ts` test helpers — no changes to either.
- Produces: nothing new consumed by a later task. This task is self-contained; Tasks 2–4 do not depend on it.

No runtime behavior changes in this task — the three tests below pass against the code exactly as it stands today. They exist to pin that behavior before the doc comment is corrected to describe it accurately, and to catch a future change that silently starts (or silently stops) restoring one of these three cases.

- [ ] **Step 1: Add the three fixtures and tests to `test/lint.test.ts`**

Insert immediately after the `withFrontMatter` fixture (after line 99, before the first `test(...)` call):

```ts
const anchoredCRLF = anchored.replace(/\n/g, "\r\n");

/**
 * The anchor comment sits inside a fenced example, not a real vmark block —
 * mdast never parses code-fence content into an `html` node, so neither
 * `visimark`'s own anchor scanner nor markdownlint's micromark token walk
 * ever sees it. `lines.Net` is therefore genuinely unbound: with advisory
 * findings on, it reports as unused, not as a restored anchor.
 */
const anchorInFence = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Illustration of a value anchor:

\`\`\`text
Net comes to **9.99**<!--vmark=lines.Net-->.
\`\`\`
`;

/**
 * The anchor comment spans three lines. `token.text` (sliced from the real,
 * un-blanked source) keeps its `\r`s; the offset arithmetic in
 * `rebuild()` is built from `params.lines.join("\n")`, which does not. The
 * lengths disagree, `source.ts`'s length-preservation guard declines the
 * write, and the comment stays blanked — `lines.Net` degrades to the same
 * "unused" report as `anchorInFence`, on its own line, rather than either
 * restoring garbage or throwing.
 */
const anchoredMultilineCRLF = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--
vmark=lines.Net
-->.
`.replace(/\n/g, "\r\n");

test("a CRLF document reports the same lines as its LF twin", async () => {
  const report = await run({ anchoredCRLF });
  expect(report.anchoredCRLF).toEqual([
    { line: 5, rule: "visimark-stale", detail: "lines.Net: stored 9.99 ≠ computed 10.00" },
  ]);
});

test("an anchor inside a fenced code block is not restored, and is not a binding", async () => {
  const report = await run({ anchorInFence }, only);
  expect(report.anchorInFence).toEqual([
    { line: 2, rule: "visimark-warn", detail: "lines.Net is defined and never read" },
  ]);
});

test("the length-preservation guard declines rather than writing a bad offset", async () => {
  const report = await run({ anchoredMultilineCRLF }, only);
  expect(report.anchoredMultilineCRLF).toEqual([
    { line: 2, rule: "visimark-warn", detail: "lines.Net is defined and never read" },
  ]);
});
```

- [ ] **Step 2: Run the new tests to verify they pass against today's code**

Run: `cd packages/markdownlint-visimark && bun test test/lint.test.ts -t "CRLF|fenced code block|length-preservation"`
Expected: `3 pass` — these pin existing behavior, they do not fail-then-pass.

- [ ] **Step 3: Correct `source.ts`'s header doc comment**

Replace lines 16–30 (the `/** ... */` block starting `The document as VisiMark must see it.`):

```ts
/**
 * The document as VisiMark must see it.
 *
 * `markdownlint` hands a rule `params.lines` with the *content of every HTML
 * comment replaced by dots*, so that its own rules do not flag prose nobody
 * renders. VisiMark's prose anchors (`<!--vmark=sheet.name-->`) and its
 * `<!--vmark:no-formulas-->` marker are HTML comments, so those lines are not a
 * document `analyze()` can check: anchors vanish, and an opted-out document
 * looks like one that forgot its rules.
 *
 * The micromark token stream is parsed from the document *before* that blanking
 * and carries each comment's original text with exact 1-based positions. The
 * blanking is length-preserving — every non-whitespace character becomes one
 * dot — so writing each `htmlFlow`/`htmlText` token's text back over its own
 * span restores that comment, with two exceptions, both harmless because
 * VisiMark's own parser is blind to them too:
 *
 * - A comment inside a fenced code block, an indented code block, or an inline
 *   code span never reaches here: micromark emits `codeFenced`/`codeText`
 *   there, not `htmlFlow`/`htmlText`, and `collectHtml` only walks the latter
 *   two. VisiMark's own anchor scanner never sees inside a code region either
 *   — mdast parses fenced and inline code as opaque text, never as a nested
 *   `html` node — so a comment there was never a binding to begin with.
 * - A CRLF document's *multi-line* comment is left blanked. `token.text` is
 *   sliced from the real source and keeps its `\r`s; the offsets below come
 *   from `params.lines.join("\n")`, which drops them. The lengths then
 *   disagree, the length-preservation guard (below) declines the write, and
 *   the comment stays blanked rather than landing at a corrupted offset. No
 *   VisiMark construct spans lines today, so this is unreached in practice.
 */
```

- [ ] **Step 4: Correct `markdownlint-rule-spec.md` §2.2's correction note**

In `docs/design/markdownlint-rule-spec.md`, the blockquote paragraph ending (around line 126–130):

```
> and `htmlText` token's text back over its own span restores the source byte
> for byte. Each rule therefore declares `parser: "micromark"` rather than
> `"none"`, and `markdownlint` parses each document once, shared across all
> seventeen rules. See `packages/markdownlint-visimark/src/source.ts`.
```

Replace with:

```
> and `htmlText` token's text back over its own span restores that comment —
> except inside a fenced/indented code block or inline code span (VisiMark's
> own parser is blind there too, so nothing is lost) and except a CRLF
> document's multi-line comment (the length-preservation guard declines
> rather than corrupting the offset; unreached today since no VisiMark
> construct spans lines). Each rule therefore declares `parser: "micromark"`
> rather than `"none"`, and `markdownlint` parses each document once, shared
> across all seventeen rules. See `packages/markdownlint-visimark/src/source.ts`.
```

- [ ] **Step 5: Run the full package test suite**

Run: `cd packages/markdownlint-visimark && bun test`
Expected: all tests pass, same count plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/markdownlint-visimark/test/lint.test.ts \
        packages/markdownlint-visimark/src/source.ts \
        docs/design/markdownlint-rule-spec.md
git commit -m "$(printf 'test: pin the markdownlint restoration contract'"'"'s real limits\n\nThree cases source.ts'"'"'s doc comment claimed were covered and were not:\ncode-fenced/indented/inline-code comments, and a CRLF document'"'"'s\nmulti-line comment. Both degrade safely today; now tested and documented\nas such rather than silently relying on coincidence.\n\n%s' "$(ATTRIBUTION_TRAILER)")"
```
(Substitute the real `Co-Authored-By:` trailer from `.agents/rules/ai-attribution.md` for this session in place of `$(ATTRIBUTION_TRAILER)` — it is not a real shell command.)

---

### Task 2: `findingsFor` catches and memoizes an `analyze()` failure

**Files:**
- Modify: `packages/markdownlint-visimark/src/findings.ts`
- Modify: `packages/markdownlint-visimark/src/index.ts:26-41` (the seventeen existing rules' `function`, to consume the new return shape)
- Modify: `packages/markdownlint-visimark/test/rules.test.ts` (existing `findingsFor(...)` call sites, which currently treat the return value as `readonly Finding[]` directly)
- Create: `packages/markdownlint-visimark/test/engine-error.test.ts` (the `analyze()`-throws tests; Task 3 adds more tests to this same file — see that task for why it is not `rules.test.ts`)

**Interfaces:**
- Consumes: `analyze` from `"visimark"` (unchanged import).
- Produces: `FindingsResult` (exported from `findings.ts`):
  ```ts
  export type FindingsResult =
    | { readonly ok: true; readonly findings: readonly Finding[] }
    | { readonly ok: false; readonly message: string };
  ```
  `findingsFor(source: string): FindingsResult` — Task 3's new `visimark-engine-error` rule consumes this same function and type.

- [ ] **Step 1: Write the failing tests**

`bun:test`'s `mock.module` patches live bindings, including one already
resolved by a static `import` earlier in the same file — so `rules.test.ts`'s
existing static `import { findingsFor, ... } from "../src/findings.js"` would
in principle work with a mid-file `mock.module("visimark", ...)` call too.
The problem is restoration: `mock.restore()` does **not** undo a
`mock.module()` replacement, and re-mocking with `() => ({ ...real, ... })`
doesn't help either, because `real` (an `import * as real from "visimark"`
namespace object) is a *live* binding — once "visimark" is mocked, `real`
itself reads through to the mock, so spreading it just re-installs the mock.
The only reliable restoration is to capture the real function **by value**
before any mocking happens (`const realAnalyze = real.analyze;`) and restore
by re-mocking with that captured reference. Putting these three tests in
their own file, with that capture at file scope and an `afterEach` that
always restores, keeps this contained rather than risking contamination of
`rules.test.ts`'s dozen unrelated tests depending on execution order.

Create `test/engine-error.test.ts`:

```ts
import { afterEach, expect, mock, test } from "bun:test";
import * as real from "visimark";
import { findingsFor, parseCount, resetFindingsCache } from "../src/findings.js";

const realAnalyze = real.analyze;

afterEach(() => {
  // mock.restore() does not undo mock.module(); explicitly re-mock the real
  // implementation, captured above by value before any test mocked it.
  mock.module("visimark", () => ({ ...real, analyze: realAnalyze }));
  resetFindingsCache();
});

test("an analyze() failure is cached like a success — one call, not one per rule", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw new Error("boom");
    },
  }));
  resetFindingsCache();
  const first = findingsFor("anything");
  const second = findingsFor("anything");
  expect(first).toEqual({ ok: false, message: "boom" });
  expect(second).toEqual({ ok: false, message: "boom" });
  expect(parseCount()).toBe(1);
});

test("an analyze() failure of a non-Error value still produces a readable message", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: () => {
      throw "boom";
    },
  }));
  resetFindingsCache();
  expect(findingsFor("anything")).toEqual({ ok: false, message: "boom" });
});

test("a document that fails does not poison a different document linted after it", () => {
  mock.module("visimark", () => ({
    ...real,
    analyze: (source: string) => {
      if (source === "broken") throw new Error("boom");
      return realAnalyze(source);
    },
  }));
  resetFindingsCache();
  expect(findingsFor("broken")).toEqual({ ok: false, message: "boom" });
  const cleanResult = findingsFor("# Notes\n\nNothing to check here.\n");
  expect(cleanResult.ok && cleanResult.findings).toHaveLength(0);
});
```

Separately, in `test/rules.test.ts`, the three existing tests that call
`findingsFor` directly currently read:

```ts
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
```

and

```ts
test("prose with no table and no vmark block produces nothing", () => {
  const prose = "# Notes\n\nNothing to check here.\n";
  let calls = 0;
  for (const rule of rules) {
    rule.function(paramsFor(prose), () => {
      calls++;
    });
  }
  expect(findingsFor(prose)).toHaveLength(0);
  expect(calls).toBe(0);
});
```

Replace all four `findingsFor(...)` result assertions with the new shape, and add the new failure-path tests. Replace the whole block from `test("a second document with different content invalidates the cache"...)` through `test("prose with no table and no vmark block produces nothing"...)` with:

```ts
test("a second document with different content invalidates the cache", () => {
  const first = findingsFor(stale);
  const second = findingsFor(clean);
  expect(first.ok && first.findings).toHaveLength(1);
  expect(second.ok && second.findings).toHaveLength(0);
  expect(parseCount()).toBe(2);
});

test("a second document with byte-identical content still reports, from the cache", () => {
  const first = findingsFor(stale);
  const second = findingsFor(stale.slice(0)); // equal content, one analyze() call
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (first.ok && second.ok) {
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]!.code).toBe(first.findings[0]!.code);
  }
  expect(parseCount()).toBe(1);
});

test("prose with no table and no vmark block produces nothing", () => {
  const prose = "# Notes\n\nNothing to check here.\n";
  let calls = 0;
  for (const rule of rules) {
    rule.function(paramsFor(prose), () => {
      calls++;
    });
  }
  const result = findingsFor(prose);
  expect(result.ok && result.findings).toHaveLength(0);
  expect(calls).toBe(0);
});
```

`test/rules.test.ts`'s imports do not change — no new import is needed for this file; the mocking machinery lives entirely in `test/engine-error.test.ts`.

- [ ] **Step 2: Run the new/changed tests to verify they fail**

Run: `cd packages/markdownlint-visimark && bun test test/rules.test.ts test/engine-error.test.ts`
Expected: FAIL. In `rules.test.ts`, `findingsFor(...)` still returns `readonly Finding[]` directly, so `.ok`/`.findings` are `undefined` and the `toHaveLength`/`.code` assertions fail. In `engine-error.test.ts`, `findingsFor` still lets `analyze()`'s throw propagate uncaught, so all three tests fail with an uncaught "boom"/"Error: boom" rather than reaching their `expect` calls.

- [ ] **Step 3: Change `findings.ts`**

Replace the whole file body from the `memo` declaration onward:

```ts
import { analyze, type Finding } from "visimark";

export type FindingsResult =
  | { readonly ok: true; readonly findings: readonly Finding[] }
  | { readonly ok: false; readonly message: string };

/**
 * One entry is enough. `markdownlint` runs a file's rules consecutively within
 * one synchronous pass, so the first of the eighteen rules to run for a file
 * fills this and the other seventeen hit it — one `analyze()` call per
 * document, whether it succeeds or throws, not eighteen. No two files can
 * interleave through it even when `markdownlint-cli2` lints files
 * concurrently, because every rule here is synchronous (none declares
 * `asynchronous: true`).
 */
let memo: { source: string; result: FindingsResult } | undefined;

/** Real `analyze()` calls, for the test that pins the one-parse property. */
let parses = 0;

export function findingsFor(source: string): FindingsResult {
  if (memo?.source !== source) {
    parses += 1;
    memo = { source, result: run(source) };
  }
  return memo.result;
}

function run(source: string): FindingsResult {
  try {
    return { ok: true, findings: analyze(source).result.findings };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
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

- [ ] **Step 4: Update `index.ts`'s seventeen existing rules to consume the new shape**

In `src/index.ts`, replace the `function` body inside the `CODES.map(...)` block:

```ts
  function: (params, onError) => {
    const source = sourceFrom(params);
    const result = findingsFor(source);
    if (!result.ok) return; // visimark-engine-error reports it once (Task 3)
    for (const finding of result.findings) {
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
```

(This is the only change in this step — the `if (!result.ok) return;` line, `const result = findingsFor(source);` in place of the old `for (const finding of findingsFor(source))`, and unwrapping `.findings`. Nothing else in `index.ts` changes in this task; Task 3 adds the eighteenth rule.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/markdownlint-visimark && bun test`
Expected: all pass, including `test/engine-error.test.ts` and the changed tests in `test/rules.test.ts`. `test/lint.test.ts` and `test/package.test.ts` are unaffected by this task.

- [ ] **Step 6: Commit**

```bash
git add packages/markdownlint-visimark/src/findings.ts \
        packages/markdownlint-visimark/src/index.ts \
        packages/markdownlint-visimark/test/rules.test.ts \
        packages/markdownlint-visimark/test/engine-error.test.ts
git commit -m "$(printf 'fix: catch and memoize an analyze() failure in findingsFor\n\nA thrown analyze() previously left the memo unpopulated, so all\nseventeen rules re-ran it and each threw independently. findingsFor now\nreturns a typed FindingsResult and caches the failure the same way it\ncaches a success -- one analyze() call per document either way. The\nseventeen existing rules fall silent on a failure; nothing reports it\nyet (Task 3 adds the rule that does).\n\n%s' "$(ATTRIBUTION_TRAILER)")"
```
(Substitute the real `Co-Authored-By:` trailer from `.agents/rules/ai-attribution.md` for this session in place of `$(ATTRIBUTION_TRAILER)` — it is not a real shell command.)

---

### Task 3: The `visimark-engine-error` rule reports the caught failure once

**Files:**
- Modify: `packages/markdownlint-visimark/src/index.ts` (add the eighteenth rule; export it alongside the seventeen)
- Modify: `packages/markdownlint-visimark/test/rules.test.ts` (the FindingCode-count test becomes an 18-rule / 17-FindingCode split)
- Modify: `packages/markdownlint-visimark/test/engine-error.test.ts` (created in Task 2; add the rule-level reporting tests below its existing findings.ts-level tests, reusing the same `real`/`realAnalyze`/`afterEach` already declared at the top of that file)

**Interfaces:**
- Consumes: `FindingsResult`, `findingsFor` (Task 2), `sourceFrom` (unchanged, `../source.js`).
- Produces: the default export of `index.ts` is now 18 `Rule` entries; `"visimark-engine-error"` is a new, permanent rule name in that array. Nothing later in this plan consumes it directly — Task 4 (documentation) references it by name only, unchanged.

- [ ] **Step 1: Write the failing test, appended to `test/engine-error.test.ts`**

Add this import to the top of the file (alongside the existing three):

```ts
import { lint } from "markdownlint/promise";
import rules from "../src/index.js";
```

Then append, below the three tests from Task 2:

```ts
const only = { default: false, visimark: true };

type Reported = { line: number; rule: string; detail: string };

async function run(strings: Record<string, string>): Promise<Record<string, Reported[]>> {
  const results = await lint({ strings, customRules: rules, config: only });
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

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

test("analyze() throwing reports exactly one violation, under visimark-engine-error", async () => {
  mock.module("visimark", () => ({ ...real, analyze: () => { throw new Error("boom") } }));
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([
    { line: 1, rule: "visimark-engine-error", detail: "boom" },
  ]);
});

test("a non-Error thrown value still produces a readable detail", async () => {
  mock.module("visimark", () => ({ ...real, analyze: () => { throw "boom" } }));
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([
    { line: 1, rule: "visimark-engine-error", detail: "boom" },
  ]);
});

test("a successful analyze() never reports visimark-engine-error", async () => {
  const report = await run({ doc: clean });
  expect(report.doc).toEqual([]);
});
```

(No manual `mock.restore()` calls — the `afterEach` already declared at the
top of this file from Task 2 re-mocks the captured real `analyze` after
every test in the file, including these three.)

- [ ] **Step 2: Run the new test to verify it fails**

Run: `cd packages/markdownlint-visimark && bun test test/engine-error.test.ts`
Expected: FAIL — `report.doc` is `[]` for the throwing cases (the seventeen rules fall silent per Task 2, and nothing reports yet).

- [ ] **Step 3: Add the eighteenth rule in `index.ts`**

At the bottom of `src/index.ts`, replace `export default rules;` with:

```ts
const ENGINE_ERROR_DESCRIPTION = "VisiMark could not analyse this document";

/**
 * Not built from `CODES`/`DESCRIPTIONS` — this does not correspond to a
 * `FindingCode`, and folding it into `DESCRIPTIONS`'s `Record<FindingCode,
 * …>` would break that type's deliberate exhaustiveness over the taxonomy.
 * The other seventeen rules silently return when `findingsFor` reports a
 * failure (see their `function` above); this is the one that reports it,
 * exactly once per document regardless of how many of the eighteen rules run.
 */
const engineErrorRule: Rule = {
  names: ["visimark-engine-error"],
  description: ENGINE_ERROR_DESCRIPTION,
  tags: ["visimark"], // never "visimark-advisory" — this is a hard failure, not a downgradable finding
  parser: "micromark",
  information: INFORMATION,
  function: (params, onError) => {
    const source = sourceFrom(params);
    const result = findingsFor(source);
    if (result.ok) return;
    onError({ lineNumber: 1, detail: result.message });
  },
};

export default [...rules, engineErrorRule];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/markdownlint-visimark && bun test test/engine-error.test.ts`
Expected: `3 pass`.

- [ ] **Step 5: Update the rule-count test in `test/rules.test.ts`**

Replace `"one rule per FindingCode, seventeen of them"`:

```ts
test("one rule per FindingCode, seventeen of them, plus the engine-error rule", () => {
  // Registration order is DESCRIPTIONS' order, which transcribes the §10
  // taxonomy table rather than the FindingCode union, plus the engine-error
  // rule appended last. Nothing observable depends on order — markdownlint
  // sorts its output by rule name — so this asserts the set.
  expect(rules).toHaveLength(18);
  const names = rules.map((r) => r.names[0]).sort();
  expect(names).toEqual(
    [
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
      "visimark-engine-error",
    ].sort(),
  );
  for (const rule of rules) {
    expect(rule.names).toHaveLength(1);
  }
});
```

The neighboring test `"every rule reads the micromark parser and describes itself"` asserts `rules.map((r) => r.description)` equals `Object.values(DESCRIPTIONS)` — with 18 rules against 17 descriptions this now fails length comparison. Update it to compare only the first seventeen against `DESCRIPTIONS`, and assert the eighteenth separately:

```ts
test("every rule reads the micromark parser and describes itself", () => {
  for (const rule of rules) {
    // Not "none": the micromark tokens are the only place a rule can read the
    // original text of an HTML comment, and VisiMark's anchors are HTML comments.
    expect(rule.parser).toBe("micromark");
    expect(rule.description.length).toBeGreaterThan(0);
  }
  expect(rules.slice(0, 17).map((r) => r.description)).toEqual(Object.values(DESCRIPTIONS));
  expect(rules[17]!.names[0]).toBe("visimark-engine-error");
  expect(rules[17]!.description).toBe("VisiMark could not analyse this document");
});
```

And `"every rule carries the visimark tag; only WARN and NOTE are advisory"` and `"information is a URL instance, not a string"` need no change — `visimark-engine-error` carries `"visimark"` and not `"visimark-advisory"` (matching the existing assertion shape, `advisory` stays `["visimark-warn", "visimark-note"]`), and it reuses the same `INFORMATION` constant, so the URL assertion holds for all 18 rules unmodified.

Two more test titles say "seventeen" and are now stale even though their assertions still pass unchanged (they iterate `rules` generically, and memoization doesn't depend on how many rules there are) — rename both for accuracy:
- `test/rules.test.ts`'s `"the seventeen rules pay one analyze() call per document"` → `"all eighteen rules pay one analyze() call per document"`.
- `test/lint.test.ts`'s `"seventeen rules cost one analyze() and one source reconstruction per document"` → `"eighteen rules cost one analyze() and one source reconstruction per document"`.

- [ ] **Step 6: Run the full package test suite**

Run: `cd packages/markdownlint-visimark && bun test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/markdownlint-visimark/src/index.ts \
        packages/markdownlint-visimark/test/rules.test.ts \
        packages/markdownlint-visimark/test/engine-error.test.ts
git commit -m "$(printf 'feat: report a caught analyze() failure as one violation\n\nAn eighteenth rule, visimark-engine-error, is the only one of the\neighteen that reports when findingsFor'"'"'s result is a failure -- the\nother seventeen (Task 2) fall silent for that document. markdownlint\nprints a rule'"'"'s fixed description before its detail, which is why this\nis a new rule rather than a reuse of visimark-coverage or any other\nexisting FindingCode rule: reusing one would glue on an unrelated,\nmisleading description.\n\n%s' "$(ATTRIBUTION_TRAILER)")"
```
(Substitute the real `Co-Authored-By:` trailer from `.agents/rules/ai-attribution.md` for this session in place of `$(ATTRIBUTION_TRAILER)` — it is not a real shell command.)

---

### Task 4: Documentation

**Files:**
- Modify: `packages/markdownlint-visimark/README.md` ("The rules" section)
- Modify: `docs/ci.md` (chapter 25, the "all seventeen" sentence)
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Modify: `docs/vocabulary-catalogue.md` (move the section-F row to the Shipped register)

**Interfaces:**
- Consumes: nothing new — this task only changes prose.
- Produces: nothing consumed by another task; this is the plan's last task.

- [ ] **Step 1: Update `packages/markdownlint-visimark/README.md`**

In "The rules" section, replace:

```
One rule per VisiMark finding kind, named after it: `visimark-stale`,
`visimark-date`, `visimark-unit`, `visimark-undef`, `visimark-dup`,
`visimark-vector`, `visimark-cycle`, `visimark-type`, `visimark-sheet`,
`visimark-anchor`, `visimark-assert`, `visimark-precision`,
`visimark-artifact`, `visimark-import`, `visimark-warn`, `visimark-note`,
`visimark-coverage`. They are the same identifiers
[`remark-lint-visimark`](https://www.npmjs.com/package/remark-lint-visimark)
reports as its `ruleId`.
```

with:

```
One rule per VisiMark finding kind, named after it: `visimark-stale`,
`visimark-date`, `visimark-unit`, `visimark-undef`, `visimark-dup`,
`visimark-vector`, `visimark-cycle`, `visimark-type`, `visimark-sheet`,
`visimark-anchor`, `visimark-assert`, `visimark-precision`,
`visimark-artifact`, `visimark-import`, `visimark-warn`, `visimark-note`,
`visimark-coverage`. They are the same identifiers
[`remark-lint-visimark`](https://www.npmjs.com/package/remark-lint-visimark)
reports as its `ruleId`.

An eighteenth rule, `visimark-engine-error`, is not a finding kind: it
reports once, on line 1, if `visimark` itself fails to analyse the document —
a bug, not something wrong with your Markdown. It is never switched off by
`recommended`.
```

- [ ] **Step 2: Update `docs/ci.md` chapter 25**

Replace:

```
There is one rule per finding kind, named after it — `visimark-stale`,
`visimark-assert`, `visimark-coverage`, and so on for all seventeen — which are
the same identifiers the `remark` plugin in chapter 24 reports as its `ruleId`.
That gives three switches, all `markdownlint`'s own rather than anything this
package invented:
```

with:

```
There is one rule per finding kind, named after it — `visimark-stale`,
`visimark-assert`, `visimark-coverage`, and so on for all seventeen, plus an
eighteenth, `visimark-engine-error`, that reports once if `visimark` itself
fails to analyse the document rather than finding something wrong with it.
The seventeen finding-kind rules are the same identifiers the `remark` plugin
in chapter 24 reports as its `ruleId`. That gives three switches, all
`markdownlint`'s own rather than anything this package invented:
```

- [ ] **Step 3: Add the `CHANGELOG.md` entry**

Under `## Unreleased` → `### Added`, above the existing `**\`fmt --no-artifacts\`**` entry:

```markdown
- **`markdownlint-rule-visimark`: report an `analyze()` failure once, not
  seventeen times** (issue #173). A bug in the engine, not a document defect,
  used to surface as seventeen copies of the same stack trace — one per rule
  — because a thrown `analyze()` left the shared cache unfilled. A new
  eighteenth rule, `visimark-engine-error`, is now the one place it is
  reported, on line 1, and the cache holds the failure the same way it holds
  a success. Also corrects the package's doc comment, which claimed its
  HTML-comment restoration is byte-for-byte: it is not, for a comment inside
  a fenced/indented code block or an inline code span, or for a CRLF
  document's multi-line comment — both harmless today, now tested.
  See [`pin-what-the-markdownlint-rule-restores-spec.md`](docs/design/pin-what-the-markdownlint-rule-restores-spec.md).
```

- [ ] **Step 4: Move the catalogue row to the Shipped register**

In `docs/vocabulary-catalogue.md`, remove the row from section F's table (the one whose `Request` cell links `#173`) and add a row to the Shipped register table at the bottom of the file, in the same position other recent rows occupy (most-recent-first, immediately after the `#168`/`fmt --no-artifacts` row):

```
| Pin the markdownlint restoration contract, and report analyze() failures once | tooling | [#173](https://github.com/michal-niedzwiedzki/visimark/issues/173) | [#182](https://github.com/michal-niedzwiedzki/visimark/pull/182) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/173#issuecomment-5786173572) |
```

(`Landed` links this plan's implementation PR, #182, once it is promoted out of draft — if the PR number differs by the time this step runs, use the actual PR URL. `Released` stays `—` until a release tag ships it, per `docs/releasing.md`; this command does not set it.)

- [ ] **Step 5: Run the full local check suite**

Run, from the repo root:
```bash
bun test
bun run typecheck
bun run build
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/markdownlint-visimark/README.md docs/ci.md CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: document the engine-error rule and the restoration contract\n\nUpdates the package README and docs/ci.md ch. 25 for the new\nvisimark-engine-error rule (seventeen finding-kind rules becomes\neighteen total), adds the CHANGELOG entry, and moves the catalogue row\nfor #173 to the Shipped register as UNRELEASED.\n\n%s' "$(ATTRIBUTION_TRAILER)")"
```
(Substitute the real `Co-Authored-By:` trailer from `.agents/rules/ai-attribution.md` for this session in place of `$(ATTRIBUTION_TRAILER)` — it is not a real shell command.)

- [ ] **Step 7: Push and wait for CI**

```bash
git push
```
Then watch CI on the pushed commit (`gh pr checks <PR-number> --watch`). Fix, commit, and push again if anything is red; the PR stays a draft until CI is green. On green, promote it out of draft (`gh pr ready <PR-number>`) — this is `/issue-decide`'s job at the end of step 9, not a step to repeat here if you're running under that command.
