# Cross-host equivalence check over the worked-example corpus — feature spec

**Status:** approved (#189) · **Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/189#issuecomment-5793796093

## 1. Purpose

*A VisiMark document has the same semantics whichever host evaluates it* is
load-bearing for every client that isn't the CLI — the public playground
(already in production), the LSP, the MCP server, and an Obsidian plugin if one
is built. Nothing checks it today.

The corpus of twelve `docs/example-*.md` files is already exercised, but only
against fixed expectations, one host at a time:

- `packages/visimark/test/acceptance.test.ts` runs it through the engine
  in-process under Node/Bun and asserts findings and `fmt` output.
- `packages/visimark/test/playground.test.ts` loads the committed browser
  bundle via `node:vm` and asserts one inline document doesn't throw.
- `packages/visimark/test/playground/browser-graph.test.ts` asserts no
  disallowed `node:` builtin reaches the browser bundle — a structural guard,
  not a behavioural one.

None of these compares one host's *answer* to another's. That gap is not
hypothetical: `packages/visimark/src/fs/reader.ts` reads `constants.O_NOFOLLOW`
off a filesystem stub at module scope was merged in PR #93, shipped in the
committed bundle by PR #95, and took the public playground down for 74 minutes
before PR #99 fixed it by introducing the `ReaderPort` this file now documents
(`docs/reviews/2026-09-16.md` §2). Every existing single-host test would have
stayed green through that regression — the playground's own tests only assert
"does not throw," and it didn't throw until a caller reached the dead code
path in production.

This spec adds a CI check that evaluates every document in the corpus through
two hosts and fails on any divergence in what they report.

## 2. The surface

This is not a CLI change. Nothing about `visimark`'s own invocation changes.
What's added:

- **`scripts/cross-host-check.ts`** — a standalone script, following the
  existing convention of `scripts/check-changelog-entries.ts` and
  `scripts/gen-function-reference.ts` (root-level `scripts/`, importing
  `packages/visimark/src/**` directly; no build step required, since Bun runs
  the TypeScript sources natively).
- **A new `cross-host` job in `.github/workflows/ci.yml`**, modelled
  structurally on `function-reference` and `mcp-resources`: checkout, install,
  run the script, `exit 1` with an `::error::` annotation on any divergence.
  Not folded into the `build` job's `bun test` step and not written as a
  `*.test.ts` file — it is a comparison against the *committed* bundle
  artifact, the same relationship `playground-bundle` has to that artifact,
  and it stays legible as its own named check in the required-checks list.
  It is a **required, blocking check from day one**.

`scripts/cross-host-check.ts` needs no matrix and pins nothing: unlike
`playground-bundle`, it does not rebuild the bundle byte-for-byte (a minifier
concern), it only *loads and runs* the one already committed at
`docs/vendor/visimark-browser.js` — so it runs once, under whatever Bun `ci.yml`
already uses for the rest of the pipeline.

**Fully reversible without a release.** Both the script and the job are CI
machinery only — deleting them touches no version-carrying file, no published
package, and nothing a consumer depends on.

## 3. What is compared

For each of the twelve `docs/example-*.md` files, and for each of
`check --json`, `eval --json`, and `explain --json`:

1. **CLI side.** Spawn `bun run packages/visimark/src/cli/main.ts <command>
   docs/example-*.md --json` as a real subprocess — the actual CLI entry
   point, not an in-process function call, so the comparison exercises the
   real process boundary. (Never `bunx visimark`; that runs the published
   build, not this commit — `.agents/rules/runtime-parity.md`.) Capture
   stdout and the exit code.
2. **Browser side.** In one `node:vm` sandbox (built the same way
   `playground.test.ts`'s `loadBundle()` already does), load
   `docs/vendor/visimark-browser.js` and call `VM.locate` → `VM.build` →
   `VM.check` on the document's source text, with no `ReaderPort` for
   `example-invoice-csv-import.md` and `example-charts.md` (matching what the
   real playground does with no file the user has attached). Do **not** use
   `VM.pgEval`/`VM.pgExplain` — they return display-shaped values (`pgEval`'s
   values are pre-stringified for a UI, `pgExplain` returns human-readable
   text lines), not the `--json` envelope. Instead, feed the bundle's raw
   `DocModel`/`CheckResult` into the **same** `packages/visimark/src/report/json.ts`
   and `packages/visimark/src/report/explain.ts` functions the CLI itself uses
   to build `check`/`eval`/`explain --json`'s envelope (`publicFinding`,
   `findingSummary`, `evalValues`, `publicAssertions`, `publicCharts`,
   `explainJson`, etc.) — imported directly by `scripts/cross-host-check.ts`,
   which runs on the Node/Bun side and is not part of the browser bundle.
   This is closer to forced than chosen: `report/json.ts` and
   `report/explain.ts` both transitively import `node:module` (via
   `cli/version.ts`'s `readVersion()`), so they cannot enter
   `browser-entry.ts`'s module graph without tripping
   `browser-graph.test.ts`'s existing guard, and must not be given a second,
   independently-maintained implementation inside the bundle.
3. **Compare.** `JSON.parse` both sides' envelopes and deep-equal them,
   **excluding the `visimark` version field** (§5). This is a structural
   comparison, not a byte-string one — see §4.

`eval` is run with no `--scenario` and no `--get`: the whole-document dump,
which is what `pgEval`'s existing "mirrors `cmdEval FILE --json`" contract
already assumes.

**Literal acceptance session, one document, one command** (the pattern all 36
(document, command) pairs are checked against). CLI side, run today against
`master`:

```console
$ bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md --json
{
  "command": "check",
  "visimark": "0.1.7",
  "status": "ok",
  "files": [
    {
      "path": "docs/example-invoice.md",
      "findings": [],
      "summary": { "problems": 0, "stale": 0, "errors": 0 }
    }
  ],
  "summary": { "files": 1, "problems": 0, "stale": 0, "errors": 0 }
}
$ echo $?
0
```

Browser side: `scripts/cross-host-check.ts` builds the equivalent envelope —
`{ command: "check", visimark: <excluded>, status: "ok", files: [{ path:
"docs/example-invoice.md", findings: [], summary: { problems: 0, stale: 0,
errors: 0 } }], summary: { files: 1, problems: 0, stale: 0, errors: 0 } }` —
from `report/json.ts`'s functions applied to `VM.check(VM.build(VM.locate(source)))`.
The two, parsed and compared with the `visimark` key excluded from both, are
deep-equal. This is the pass case; the same shape driven by
`example-invoice-drift.md` (26 findings) and `example-invoice-csv-import.md`
(one `skipped` import entry, scoped per §4's table) are the two the
implementation's tests must also cover explicitly, since they exercise the
non-empty-findings and the file-dependent-exclusion paths respectively.

## 4. Semantics

| Case | CLI side | Browser side | Expected comparison result |
|---|---|---|---|
| A document with zero findings (`example-invoice.md`) | `check --json` exits 0, `status: "ok"` | Same envelope built from `VM.check()` | Deep-equal (version field excluded) |
| A document with findings (`example-invoice-drift.md`) | `check --json` exits 1, `findings` populated | Same | Deep-equal |
| A document with an assertion, evaluated (`example-invoice.md`'s `assert variance == 0`, which holds) | `eval --json` exits 0, `assertions` includes it with `holds: true` | Built from `VM.check()`'s `assertions` via `publicAssertions` | Deep-equal |
| An import-dependent document with no reader supplied (`example-invoice-csv-import.md`) | `check --json`: import resolves against the real file, no cascading findings (clean) | `VM.check()` with no `ReaderPort`: import `state: "skipped"`, and `eval/check.ts`'s "neverAttempted" suppression drops every UNDEF a missing table would otherwise cascade — **`check --json`'s `findings`/`summary` are already deep-equal, no scoping needed.** `explain --json` is not suppressed the same way: it surfaces `sheets[*].hasTable: false`, `import.stampStatus: "skipped"`, `inputs: []`, and drops each scalar's `precision`/`precisionFrom` (nothing to derive a width from) — those five field names are excluded from the `explain` comparison on this document only. |
| A chart-dependent document (`example-charts.md`, and `example-onboarding-dashboard.md` — both `chart`-bearing; the earlier framing of "two file-reading documents" undercounted by one) | `check --json`: clean, same suppression as above | `VM.check()` with no chart writer: `checkCharts`'s own "skipped" suppression keeps `check --json` deep-equal too. `explain --json` surfaces the difference as each chart's `state` (`"current"` vs `"skipped"`) — that one field name is excluded from the `explain` comparison on these two documents only. |
| Number formatting | `Value.d.toString()` on whatever numeric representation the engine holds | Same code path, same representation (the engine's arithmetic is host-independent by construction — decimal, not floating-point-sensitive; `.d` is not a raw JS float subject to platform rounding) | Deep-equal |
| JSON key order | Built by object-literal construction in `report/json.ts`, deterministic given the same input | Same functions, same call shape | Deep-equal once parsed (moot for a structural comparison, but true anyway) |

**The three file-dependent documents are not excluded from the run.**
Verified empirically by running both hosts' real output side by side, not
guessed: `check --json` needs **no scoping at all**, on any of the twelve
documents — the engine's own "neverAttempted"/`skipped` suppression
(`eval/check.ts`, `eval/check-charts.ts`) already makes both hosts agree
without help, which is rather the point of that suppression existing.
`eval --json` needs no scoping either, for the structural reason below.
Only **`explain --json`**, on exactly the three documents named in the table
above, needs specific field names excluded from the comparison — five for the
import document, one for each of the two chart documents — and every other
field (the document's other sheets, rules, order, assertions, non-excluded
chart fields) is still compared and must still agree. This is the "whole
envelope including `skipped`" comparison the issue proposed, made precise and
narrower than originally scoped: not "check and explain," and not two
documents but three.

**The scoping exception applies to `explain` only, not `check` or `eval`.**
`cmdExplain` calls `check(build(locate(source)), { doc: onDisk(path) })` — a
real reader — on the CLI side, which is what creates the CLI/browser
difference `explain --json` surfaces (`check --json`'s own suppression hides
the same underlying difference). `cmdEval` calls `check(model)` with **no**
reader argument at all, on the CLI side, same as the browser side; the two
hosts are expected to be plainly deep-equal (no scoping) on `eval --json` for
every one of the twelve documents, including the three file-dependent ones.

## 5. Type rules and errors

Not applicable in the [§10](../../docs/visimark-design.md#10-error-taxonomy)
sense — this adds no new finding code and no new CLI error. The one exclusion
from the comparison, stated precisely:

- **The embedded `"visimark"` version field** (present in every `--json`
  envelope) is excluded from the diff entirely. Both hosts report the
  installed engine's own version string; they agree only when the committed
  bundle and the CLI being spawned are built from the same commit. A stale
  committed bundle is already caught by the existing `playground-bundle` job
  (byte-exact rebuild comparison) — this job re-detecting the same staleness
  as a spurious "semantic divergence" would duplicate that signal under a
  confusing name. A genuine version mismatch between two real releases is easy
  to notice on its own (the issue's `#189` framing); it does not need this job
  to flag it.

If the comparison finds a real divergence — an actual difference in findings,
values, assertions, or charts beyond the file-dependent exclusion in §4 — the
script prints, per failing (file, command) pair, the JSON path that diverges
and both sides' values at that path, then exits 1. The CI job fails; this is
not a finding `visimark` itself reports, so it carries no
[§10](../../docs/visimark-design.md#10-error-taxonomy) code.

## 6. Machine contract

| Outcome | Exit code (script) | stdout | stderr |
|---|---|---|---|
| Every document, every command, both hosts agree | `0` | Nothing, or a one-line summary ("12 documents × 3 commands, 0 divergences") | Nothing |
| At least one divergence | `1` | Nothing | Per divergence: file, command, JSON path, CLI value, browser value |
| The CLI subprocess itself fails to run (e.g. a build is broken) | `1` | Nothing | The subprocess's own stderr, plus which (file, command) it was |

No change to any `visimark` command's own exit codes, streams, or `--json`
shape — this script *consumes* those outputs; it does not alter them.

## 7. Compatibility

No existing CI job, script, or the composite Action's behaviour changes. The
new `cross-host` job runs alongside the existing nine
(`build`, `playground-bundle`, `function-reference`, `mcp-resources`,
`node-support-policy`, `acceptance-node`, `pack`, `smoke-node`, `smoke-bun`)
and is additive to the required-checks list — see §8 for what documents it.

## 8. Interaction with the rest of the tooling

- **The `--json` shape.** This is the first thing in the repository that
  treats `report/json.ts`'s object construction as a contract precise enough
  to diff structurally rather than merely "renders sensibly." It does not
  change that shape; it is the first consumer that would notice if a future
  change to it silently altered key names or nesting on one host and not the
  other (which isn't possible today, since both hosts already share the same
  `report/json.ts` module — but would become possible if a future change gave
  the browser bundle its own envelope-building code, which is exactly what
  §3's "no second implementation" rule forecloses).
- **`report/json.ts` and `report/explain.ts`** gain a second caller
  (`scripts/cross-host-check.ts`), still Node/Bun-side only. Neither file's
  browser-graph exclusion changes.
- **The release workflow, the LSP, the MCP server, the VS Code extension** —
  unaffected. None of them is a third host this check covers (the issue's own
  "smallest version is two hosts, not three" scoping); a future in-memory
  `ReaderPort` facade standing in for a vault host is out of scope here and
  would be its own issue when a caller needs it.

Nothing else changes.

## 9. Documentation to update

- **`docs/ci.md`** — enumerates the checks a pull request must pass; add
  `cross-host` to that enumeration.
- **`CONTRIBUTING.md`** — the "worked examples double as the acceptance suite"
  paragraph (currently describing a single-host suite: `check` on the drift
  invoice, `fmt` on the clean invoice, `infer` on the plain quote) gains one
  sentence: the same corpus is also checked for cross-host agreement between
  the CLI and the committed browser bundle.
- **`packages/visimark/src/fs/reader.ts`**'s header comment, which names
  `test/playground/browser-graph.test.ts` as "the guard that keeps it that
  way" (the no-`node:fs`-in-the-browser-graph property) — add a sentence
  naming `scripts/cross-host-check.ts` as the guard on the companion property
  (that the two hosts *agree*, not merely that the browser host doesn't
  crash).
- **`CHANGELOG.md`**, `## Unreleased` → `### Added`.
- **`docs/vocabulary-catalogue.md`** — this row moves from section F's table
  into the Shipped register as `UNRELEASED` once the implementation merges.

Not touched: `docs/cli-reference.md` (no CLI surface changed),
`docs/issue-runbook.md` and this workflow's own commands (no change to the
review process), `.github/ISSUE_TEMPLATE/` (no new finding, precision variant,
or exit code that would make a form stale).

**Separately noted, not part of this change:** while reading
`packages/visimark/src/playground/browser-entry.ts` for this spec, its header
comment was found to carry the same misattribution the original issue did —
crediting PR #99 with *causing* the 74-minute outage, where
`docs/reviews/2026-09-16.md` and `fs/reader.ts`'s own header agree PR #93
caused it and PR #99 fixed it. Left alone here since it's pre-existing and
outside this issue's named documentation list; flagging it in case it's worth
its own small fix.

## 10. Non-goals

- A third host (an in-memory `ReaderPort` facade standing in for a vault) —
  deferred until a caller needs it, per the issue.
- Comparing `fmt --json` or `infer --json` — not part of "does a document mean
  the same thing on both hosts" in the same direct sense (`fmt` writes;
  `infer` proposes rather than evaluates); not requested and not added here.
- Any change to what any `visimark` command outputs, on either host.
- A soft/observational rollout — this is a blocking check from the first
  merge, per the discussion.

## 11. Open questions

None.
