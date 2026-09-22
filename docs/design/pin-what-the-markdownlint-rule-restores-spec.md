# Pin the markdownlint restoration contract, and report `analyze()` failures once — feature spec

**Status:** approved (#173) · **Date:** 2026-09-23 · **Decision:** [#173 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/173#issuecomment-5786173572)

## 1. Purpose

Two follow-ups from the whole-branch review of #164
(`markdownlint-rule-visimark`), sharing one file and one owner, neither
shipped in that PR because neither produces a wrong finding today:

**A.** `packages/markdownlint-visimark/src/source.ts`'s doc comment claims its
HTML-comment restoration "restores the source byte for byte". It does not, in
three cases, all harmless today and none tested:

- a comment inside a fenced code block, an indented code block, or an inline
  code span is never restored (`collectHtml` only walks `htmlFlow`/`htmlText`
  micromark tokens);
- a CRLF document's *multi-line* HTML comment is left blanked, because
  `token.text` keeps its `\r`s while the offset arithmetic (built from
  `params.lines.join("\n")`) does not, so the length-preservation guard at
  `source.ts:93` declines the write;
- nothing in the test suite exercises either case.

The motivating scenario is `markdownlint-rule-spec.md` §2.2's correction
note, which makes the identical unqualified "restores … byte for byte" claim
— so two files independently overstate the same guarantee, and a reader of
either would reasonably conclude a case this spec shows is silently dropped
is actually handled.

**B.** Each of the seventeen `markdownlint` rules calls `findingsFor(source)`
with no `try`/`catch`. If the VisiMark engine's `analyze()` throws — a bug in
`locate`/`build`/`check`, not a document defect the finding taxonomy already
covers — `findings.ts`'s memo is never populated (it is written only *after*
`analyze()` returns), so all seventeen rules re-run `analyze()` and each one
throws independently. `markdownlint-cli2` catches each of those seventeen
separately (`handleRuleFailures`) and reports seventeen copies of the same
stack trace as seventeen violations on line 1 of one document.

Neither half is a change to what a document means (catalogue section E); both
are about what the linter reports for a broken input, which is section F.

## 2. The surface

No CLI change. `visimark`'s own commands, exit codes and `--json` shape are
untouched — this package exposes no binary, and only ever calls `analyze()`
internally.

**A.** Changes two doc comments (`source.ts`'s header comment;
`markdownlint-rule-spec.md` §2.2's correction note) and adds tests. No runtime
code changes.

**B.** Changes `packages/markdownlint-visimark/src/findings.ts` and
`packages/markdownlint-visimark/src/index.ts`:

- `findingsFor(source)` changes its return type from `readonly Finding[]` to
  a discriminated result, and catches `analyze()` internally:

  ```ts
  export type FindingsResult =
    | { readonly ok: true; readonly findings: readonly Finding[] }
    | { readonly ok: false; readonly message: string };
  ```

  The memo caches the `FindingsResult` (success *or* failure) keyed on
  `source`, preserving the existing one-`analyze()`-call-per-document
  invariant in both cases — a broken document costs exactly one `analyze()`
  call, the same as a working one, not seventeen.

- Each of the seventeen existing rules' `function` checks `result.ok` and
  returns without calling `onError` when it is `false` — they fall silent on
  a broken document rather than each surfacing the failure.

- An eighteenth rule, **`visimark-engine-error`**, is added to the exported
  `rules` array (not derived from `CODES`/`DESCRIPTIONS`, since it does not
  correspond to a `FindingCode` — `DESCRIPTIONS`'s `Record<FindingCode, …>`
  annotation must stay exhaustive over the taxonomy and would break if this
  were folded into it). It is the one rule that reports when `result.ok` is
  `false`:

  ```ts
  {
    names: ["visimark-engine-error"],
    description: "VisiMark could not analyse this document",
    tags: ["visimark"],           // never "visimark-advisory" — this is a hard failure
    parser: "micromark",
    information: INFORMATION,     // reused; no taxonomy section covers this case
    function: (params, onError) => {
      const result = findingsFor(sourceFrom(params));
      if (result.ok) return;
      onError({ lineNumber: 1, detail: result.message });
    },
  }
  ```

  `sourceFrom(params)`/`rebuild()` is not wrapped in a new `try`/`catch`. Its
  only operations on a well-typed `RuleParams` are array indexing (which
  returns `undefined`, never throws, and is already checked at `source.ts:86`)
  and string slicing (which never throws for any indices in JS) — it cannot
  throw for any input matching its declared types, so there is nothing here
  for B to guard against. This is stated as a non-goal in §8.

## 3. The machine contract

| Outcome | Exit code | stdout | stderr | `--json` |
|---|---|---|---|---|
| `analyze()` succeeds (today's behaviour, all seventeen rules) | unchanged: `0` clean / `1` violations, `markdownlint-cli2`'s own | unchanged | unchanged | unchanged |
| `analyze()` throws — **before** | `1` (via `handleRuleFailures`) | seventeen lines, one per rule, each `This rule threw an exception: <message>` | unchanged | seventeen entries |
| `analyze()` throws — **after** | `1` (unchanged — still a violation, not a crash) | one line: `visimark-engine-error VisiMark could not analyse this document [<message>]` | unchanged | one entry, `ruleNames: ["visimark-engine-error"]` |

No new exit code. `0`/`1`/`2` keep their existing meanings project-wide; this
package has never produced `2` and does not start now. `--json`'s shape is
`markdownlint-cli2`'s own per-violation object (`lineNumber`, `ruleNames`,
`ruleDescription`, `errorDetail`, …) — B changes which rule name and detail
appear for this one outcome, not the shape itself.

## 4. Behaviour table

| Case | File | Session |
|---|---|---|
| CRLF document, single-line comment | `test/lint.test.ts` (new test, real parser) | `bun test` → `a CRLF document reports the same lines as its LF twin` passes: linting the CRLF twin of the `anchored` fixture reports the identical `{ line, rule, detail }` as the LF original. |
| Comment inside a fenced code example | `test/lint.test.ts` (new test, real parser) | `bun test` → `an anchor inside a fenced code block is not restored, and is not a binding` passes: a `<!--vmark=…-->`-shaped string sitting inside a fenced block (illustrating VisiMark syntax rather than using it) produces no anchor-related finding — matching `visimark check` on the same document, which also ignores it (`parse/document.ts`'s "shown inside a fenced example" rule). |
| CRLF document, multi-line comment | `test/lint.test.ts` (new test, real parser) | `bun test` → `the length-preservation guard declines rather than writing a bad offset` passes: the comment stays blanked (as today), every *other* finding in the document still reports at its correct line, and no exception is thrown. |
| `analyze()` throws | new file `test/engine-error.test.ts` | `npx markdownlint-cli2 doc.md` → `doc.md:1 error visimark-engine-error VisiMark could not analyse this document [<message>]` / `Summary: 1 issue in 1 file` / `echo $?` → `1`. |
| `analyze()` throws a non-`Error` value | `test/engine-error.test.ts` | Same shape; `<message>` is `String(thrownValue)`. |
| `analyze()` throws, seventeen ordinary rules | `test/engine-error.test.ts` | `bun test` asserts each of the seventeen `FindingCode` rules produces zero violations for that document, and `parseCount()` is `1` (not 18) despite all eighteen rules calling `findingsFor` on the same source. |

Three tests live in `test/lint.test.ts` because they need the real micromark
parser (`test/rules.test.ts`'s `paramsFor` stub always passes `tokens: []`
and cannot exercise `collectHtml`). The throwing-`analyze()` tests get their
**own new file**, `test/engine-error.test.ts`, rather than joining
`test/rules.test.ts` or `test/lint.test.ts`: `analyze()` never throws for any
input the finding taxonomy already covers by design (a malformed document
becomes a finding, not an exception), so there is no natural fixture that
forces a throw without depending on an actual engine bug. The test forces one
deterministically with `mock.module("visimark", () => ({ ...actual, analyze:
() => { throw new Error("boom"); } }))` (or equivalent) — the fixture is the
mock, not the Markdown — and `bun:test`'s module mocks are process-global for
the file that sets them, so isolating them in a dedicated file keeps them
from leaking into every other test file's real `import { analyze } from
"visimark"`.

## 5. Compatibility

- `markdownlint-rule-visimark` is `UNRELEASED` (catalogue row for
  [#153](https://github.com/michal-niedzwiedzki/visimark/issues/153)/[#164](https://github.com/michal-niedzwiedzki/visimark/pull/164),
  `Released` cell empty) — no published consumer exists yet, so nothing
  downstream can observe either half as a behaviour change.
- No `.github/workflows/*.yml` in this repo runs `markdownlint` or
  `markdownlint-cli2`; `docs/ci.md` chapter 25 documents the integration for
  downstream consumers only. No CI job here behaves differently.
- **Existing tests that break and must be updated as part of this change**
  (not optional cleanup — the plan's tasks, not a follow-up):
  - `test/rules.test.ts`'s `"one rule per FindingCode, seventeen of them"`
    asserts `rules.toHaveLength(17)` and a sorted 17-name list — becomes 18,
    with `"visimark-engine-error"` added to the expected names, and the
    `toHaveLength` assertions split so the FindingCode-only check stays
    exactly 17 while the full export is 18.
  - `test/rules.test.ts`'s direct `findingsFor(...)` calls (`"a second
    document with different content invalidates the cache"` and its
    neighbours) currently treat the return value as `readonly Finding[]`
    directly (`.toHaveLength(1)`); they change to unwrap `.findings` after
    asserting `.ok`.
  - Nothing in `test/lint.test.ts`'s existing assertions names a rule count,
    so its current tests are unaffected other than the new ones this spec
    adds.
- Reversible without a release: pre-tag change to an unreleased package.

## 6. Interaction with the rest of the tooling

- **`recommended.json`** (`{ "visimark-advisory": false }`) is unchanged.
  `visimark-engine-error` is not advisory and is not switched off by it,
  matching every other hard-failure rule.
- **The `"visimark": false` / `"visimark-engine-error": false` switches**
  (`markdownlint`'s own, per rule name and per tag) work on the new rule the
  same as on the existing seventeen — nothing package-specific needed.
- **`remark-lint-visimark`** (the sibling `remark`/`unified` package, #152) is
  untouched by this issue; it has its own `analyze()` call site and is out of
  scope here. Not addressed by this spec — flagged as a candidate follow-up
  in §8.
- **`--json`, `fmt`, `infer`, `explain`, `eval`** — not reachable through this
  package before or after, as already documented in its README's Contract
  section; unchanged.

## 7. Documentation to update

- `packages/markdownlint-visimark/src/source.ts` — the header doc comment
  (currently lines 16–30): replace the unqualified "restores … byte for
  byte" claim with the three-case qualification from §1.
- `docs/design/markdownlint-rule-spec.md` §2.2's correction note — same
  unqualified phrase (lines ~126–128), same qualification.
- `packages/markdownlint-visimark/README.md`'s "The rules" section — currently
  says "One rule per VisiMark finding kind … seventeen" and lists exactly
  seventeen names; add `visimark-engine-error` as the eighteenth, described
  as reporting once if the engine itself fails to analyse the document (a
  bug, not a finding) rather than as a finding kind.
- `docs/ci.md` chapter 25 — same "all seventeen" claim
  (`There is one rule per finding kind, named after it — … and so on for all
  seventeen`); needs the same eighteenth-rule addition. The issue's own "What
  documentation it invalidates" said this chapter needed no change; that was
  true before this spec's design added a new named rule, and is no longer
  true now — this is new documentation debt the issue did not anticipate.
- `CHANGELOG.md` under `## Unreleased` → `### Added`/`### Fixed` as
  appropriate (the package has never been released, so this is pre-release
  changelog hygiene, not a user-facing entry).

## 8. Non-goals

- Making the restoration genuinely byte-exact by reading `codeFenced`/
  `codeText` tokens too — rejected in the issue: it would restore text
  VisiMark deliberately ignores.
- Normalising CRLF before computing offsets, to make a multi-line comment
  restorable — rejected in the issue: unreachable today since no VisiMark
  construct spans lines; revisit only if one becomes multi-line.
- Wrapping `sourceFrom`/`rebuild()` in its own `try`/`catch` — per §2, it
  cannot throw for any input matching its declared types.
- Changing `remark-lint-visimark`'s equivalent `analyze()` call site — a
  separate package with its own review, not touched here.
- Any change to `visimark`'s own CLI, exit codes, or `--json` shape.

## 9. Open questions

None.
