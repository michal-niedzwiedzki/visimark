# Cross-host equivalence check over the worked-example corpus — implementation plan

**Spec:** [`cross-host-equivalence-check-spec.md`](cross-host-equivalence-check-spec.md)

**Implementation note (Task 2, discovered while building the orchestrator,
folded back into the spec):** two things below turned out narrower and more
precise than planned. `check --json` needs **no** scoped exclusions at all —
the engine's own `skipped`-state suppression already makes both hosts agree,
verified empirically — so only `explain --json` needs any. And the
file-dependent documents are **three**, not two: `example-onboarding-dashboard.md`
also has a `chart` statement (`grep -l '^chart ' docs/example-*.md`), which
the issue's original framing missed. The spec's §4 and Tasks 2/4 below reflect
this; treat the code (`scripts/cross-host-check.ts`'s
`EXPLAIN_ONLY_EXCLUDED_KEYS`) as authoritative over this plan's earlier
per-step prose where they'd otherwise disagree.

## Goal

Add a CI check that runs `check`, `eval`, and `explain --json` for each of the
twelve `docs/example-*.md` files through two hosts — the real CLI subprocess
and the committed browser bundle — and fails the build on any divergence in
what they report, per the finalized spec.

## Architecture

Two new files, no change to any engine or CLI module:

1. **`scripts/cross-host-compare.ts`** — pure comparison logic. Takes two
   already-parsed JSON envelopes (CLI's, browser's) and the command name,
   returns a list of divergences. No I/O, no subprocess, no bundle loading —
   this is what makes it unit-testable on its own, separate from the
   expensive real-corpus run.
2. **`scripts/cross-host-check.ts`** — the orchestrator wired into CI. For
   each (document, command) pair: spawns the real CLI subprocess, loads the
   committed browser bundle once via `node:vm`, builds the browser-side
   envelope using the engine's own `report/json.ts` / `report/explain.ts`
   functions, hands both envelopes to `cross-host-compare.ts`, and reports.

A new `cross-host` job in `.github/workflows/ci.yml` runs
`bun scripts/cross-host-check.ts`, standalone, not folded into `build`'s
`bun test` step — matching `playground-bundle`'s and `function-reference`'s
existing shape (checkout, install, run, `::error::` + `exit 1` on failure).

## Tech Stack

Bun (script execution, `node:vm`, `Bun.spawnSync` for the CLI subprocess),
existing engine modules (`report/json.ts`, `report/explain.ts`, `eval/check.ts`,
`model/build.ts`, `parse/document.ts`), `bun test` for the unit-testable half.

## Global Constraints

- Follow the spec exactly; any behaviour not in the spec (comparison scope,
  the version-field exclusion, the `eval`-has-no-scoping-exception correction)
  is out of scope for this plan.
- Every commit ends with the `Co-Authored-By:` trailer this session's
  attribution rule (`.agents/rules/ai-attribution.md`) resolves to — do not
  hardcode a vendor name.
- Never use `bunx visimark` anywhere in the new script or its tests — it runs
  the published build, not this branch (`.agents/rules/runtime-parity.md`).
  Always `bun run packages/visimark/src/cli/main.ts`.
- `bun test`, `bun run typecheck`, and `bun run build` must stay green after
  every task.
- Mutation-test the new guard before calling it done: deliberately break
  something the check should catch (e.g. edit the committed bundle, or feed
  the comparator two envelopes that differ) and confirm it goes red for the
  right reason, per this repo's established practice
  (`browser-graph.test.ts`'s own header: "a guard that has never been
  observed to fail is a guard nobody has tested").

---

## Task 1: The pure comparator — `scripts/cross-host-compare.ts`

- [x] Task 1

**Files:**
- `scripts/cross-host-compare.ts` (new)
- `scripts/cross-host-compare.test.ts` (new)

**Interfaces:**
```ts
export interface Divergence {
  path: string;       // JSON path within the envelope, e.g. "files[0].findings[2].code"
  cli: unknown;
  browser: unknown;
}

export interface CompareOptions {
  /** JSON paths whose difference is expected and not reported — the
   *  file-dependent entries on the two file-reading documents, for `check`
   *  and `explain` only (never `eval` — spec §4, "eval never reads a file on
   *  either host"). Empty for every other (document, command) pair. */
  scopedExclusions?: string[];
}

/**
 * Deep-compares two already-parsed `--json` envelopes and returns every
 * divergence. Always excludes the top-level `visimark` key (spec §5) from
 * both sides before comparing, regardless of `options`.
 */
export function compareEnvelopes(
  cli: unknown,
  browser: unknown,
  options?: CompareOptions,
): Divergence[];
```

**Steps:**
1. Implement `compareEnvelopes`: strip `visimark` from both top-level objects
   (spec §5), then strip any path listed in `scopedExclusions` from both sides
   (spec §4's scoping — the browser's `skipped` entry and the CLI's live-read
   entry are both removed from the comparison, not compared against each
   other), then recursively walk the remaining structure and collect every
   path where the two sides differ (type mismatch, value mismatch, array
   length mismatch, missing key on either side).
2. Write `scripts/cross-host-compare.test.ts` under `bun test` with synthetic
   fixtures (no CLI spawn, no bundle load — this task never touches either):
   - two identical envelopes → `[]`.
   - two envelopes differing only in `visimark` → `[]` (the exclusion is
     unconditional).
   - two envelopes differing in `files[0].findings[0].code` → one
     `Divergence` naming that exact path.
   - two envelopes differing at a `scopedExclusions` path → `[]`.
   - two envelopes differing at a `scopedExclusions` path **and** at an
     unrelated path → one `Divergence`, for the unrelated path only.
   - a key present on one side and absent on the other (not a
     `scopedExclusions` path) → a `Divergence`.
3. `bun test scripts/cross-host-compare.test.ts` green.

---

## Task 2: The orchestrator — `scripts/cross-host-check.ts`

- [x] Task 2

**Files:**
- `scripts/cross-host-check.ts` (new)

**Interfaces:** none exported — a script with a top-level run, following
`scripts/check-changelog-entries.ts`'s shape (reads real files, prints to
stdout/stderr, calls `process.exit`).

**Steps:**
1. List the twelve corpus files by globbing `docs/example-*.md` directly
   (`readdirSync(join(repoRoot, "docs")).filter(f => /^example-.*\.md$/.test(f))`)
   rather than hardcoding the list — `packages/visimark/test/examples.ts`
   (checked; the actual filename, not `examples.js`) only exports a handful of
   individual paths by name (`cleanPath`, `driftPath`, `chartsPath`, …), not a
   full enumeration of all twelve, and it lives under `test/`, which a
   root-level `scripts/` file shouldn't reach into. A glob means a thirteenth
   example document added later is picked up automatically, with no second
   place to update.
2. Load the browser bundle **once**: replicate
   `packages/visimark/test/playground.test.ts`'s `loadBundle()` (the same
   `node:vm` sandbox: `document`, `navigator`, `crypto`, `window`) — do not
   import it from the test file (test files aren't a shared-code location);
   write the same ~15 lines locally in this script, matching it exactly so a
   future change to one is easy to notice should apply to the other.
3. For each of the twelve files × each of `check`/`eval`/`explain`:
   - **CLI side:** `Bun.spawnSync(["bun", "run",
     "packages/visimark/src/cli/main.ts", command, file, "--json"])`. Capture
     stdout, `JSON.parse` it. A non-JSON stdout (a subprocess crash) is
     reported as its own failure (spec §6, "the CLI subprocess itself fails
     to run"), not a comparison divergence.
   - **Browser side:** read the file's source text (`readFileSync`), then:
     - `check`: `model = VM.build(VM.locate(source))`;
       `result = VM.check(model)` (no reader — spec §3/§4); build the envelope
       with the **same shape** `cmdCheck`'s JSON branch builds
       (`packages/visimark/src/cli/commands.ts`, the `command: "check"`
       object): `{ command: "check", visimark: readVersion(), status:
       statusFromExit(exit), files: [{ path: file, findings:
       result.findings.map(f => publicFinding(file, f)), summary:
       findingSummary(result.findings) }], summary: { files: 1, ...
       findingSummary(result.findings) } }`, importing `publicFinding`,
       `findingSummary`, `statusFromExit`, `readVersion` from
       `packages/visimark/src/report/json.ts` / `cli/version.ts` (Node-side
       import — never inside the bundle; see spec §3 for why this is forced).
     - `eval`: `result = VM.check(model)` (no reader — always, on **both**
       hosts, since `cmdEval` never passes one either — spec §4 correction);
       envelope `{ command: "eval", visimark: readVersion(), status:
       statusFromExit(assertExit), file, values: evalValues(result),
       assertions: publicAssertions(result.assertions), charts:
       publicCharts(result.charts) }`, matching `cmdEval`'s no-scenario,
       no-`--get` branch exactly (`packages/visimark/src/cli/commands.ts`,
       `emitEval`).
     - `explain`: `checkResult = VM.check(model)` (no reader);
       `view = explainView(model, checkResult, [])` (empty sheets array —
       `explainView` treats that as "all sheets", matching `cmdExplain`'s
       default with no `--sheet` flag); envelope `explainJson(view, file)`,
       importing `explainView`, `explainJson` from
       `packages/visimark/src/report/explain.ts`.
   - **Compare:** for `example-invoice-csv-import.md` and
     `example-charts.md` under `check` or `explain` only, pass the
     `scopedExclusions` paths naming the file-dependent import/chart entries
     (spec §4); every other (document, command) pair passes no exclusions.
     Call `compareEnvelopes` from Task 1.
   - Collect every `Divergence`, tagged with (file, command).
4. Report: if any divergences were collected, print each as
   `<file> <command>: <path>\n  cli:     <cli value>\n  browser: <browser value>`
   to stderr, then `process.exit(1)`. Otherwise print a one-line summary
   (`12 documents × 3 commands, 0 divergences`) to stdout and exit 0 (spec
   §6's machine contract table).
5. **Mutation test, by hand, once, to prove the guard works** (not committed
   as a permanent test — this is a one-time verification per Global
   Constraints): temporarily edit `docs/vendor/visimark-browser.js` (e.g.
   perturb a literal the way `playground-bundle`'s own review process does)
   or temporarily change one call site's arguments in this script, run
   `bun scripts/cross-host-check.ts`, confirm it exits 1 and prints a sane
   diff naming the right file/command/path, then revert the deliberate break.
6. Run `bun scripts/cross-host-check.ts` for real against `master` HEAD;
   it must exit 0. If it does not, the divergence it finds is a real bug —
   stop and report it rather than loosening the comparison (spec §5, "never
   to loosen the assertion").

---

## Task 3: Wire it into CI

- [x] Task 3

**Files:**
- `.github/workflows/ci.yml`

**Interfaces:** none — a new job block.

**Steps:**
1. Add a `cross-host` job after `mcp-resources` (before `node-support-policy`,
   grouping it with the other artifact/consistency jobs), modelled on
   `function-reference`'s shape:
   ```yaml
   cross-host:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7
       - uses: oven-sh/setup-bun@v2
         with:
           bun-version: latest
       - run: bun install --frozen-lockfile
       - name: the CLI and the committed browser bundle must agree
         run: bun scripts/cross-host-check.ts
   ```
   No `bun-version` pin (spec §2 — unlike `playground-bundle`, this doesn't
   rebuild the bundle, so no minifier-version sensitivity) and no matrix (spec
   scopes this to two hosts, not a Node-version sweep).
2. Push and confirm the new job appears and passes on the PR's own CI run.
3. It becomes a required status check the same way every other job here is —
   confirm with the maintainer whether marking it "required" in the branch
   protection settings needs a manual step outside this repo (GitHub UI/API),
   since that setting isn't itself version-controlled in this repository; if
   so, note it in the PR description as a follow-up the maintainer completes
   after merge.

---

## Task 4: Documentation

- [x] Task 4

**Files:**
- `docs/ci.md`
- `CONTRIBUTING.md`
- `packages/visimark/src/fs/reader.ts`
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`

**Steps:**
1. **`docs/ci.md`** — add `cross-host` to the enumeration of checks a pull
   request must pass (spec §9).
2. **`CONTRIBUTING.md`** — extend the "worked examples double as the
   acceptance suite" paragraph (currently: `check` on the drift invoice,
   `fmt` on the clean invoice, `infer` on the plain quote) with one sentence:
   the same corpus is also checked for cross-host agreement between the CLI
   and the committed browser bundle (spec §9).
3. **`packages/visimark/src/fs/reader.ts`** — its header names
   `test/playground/browser-graph.test.ts` as "the guard that keeps it that
   way" for the no-`node:fs`-in-the-browser property; add one sentence naming
   `scripts/cross-host-check.ts` as the guard on the companion property, that
   the two hosts *agree* rather than merely that the browser host doesn't
   throw (spec §9).
4. **`CHANGELOG.md`** — add an entry under `## Unreleased` → `### Added`:
   "A CI check (`cross-host`) that runs `check`, `eval`, and `explain --json`
   for the worked-example corpus through both the CLI and the committed
   browser bundle and fails on divergence."
5. **`docs/vocabulary-catalogue.md`** — move the `#189` row out of section
   F's table into the [Shipped register](../vocabulary-catalogue.md#shipped)
   as `UNRELEASED`, condensed to that table's columns:
   `| Cross-host equivalence check over the worked-example corpus | tooling |
   [#189](https://github.com/michal-niedzwiedzki/visimark/issues/189) |
   [#<this-PR>](<this-PR-url>) | — |
   [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/189#issuecomment-5793796093)
   |`. Drop the prose `What it changes`/`Pros`/`Cons` columns per the
   register's own rule (they're the section table's columns, not the Shipped
   register's).
6. Confirm `bun test`, `bun run typecheck`, `bun run build`, and
   `bun scripts/cross-host-check.ts` are all green after this task, then push
   and wait for full CI per the runbook's step 9.
