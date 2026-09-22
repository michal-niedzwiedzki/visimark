# `fmt --no-artifacts` — implementation plan

**Spec:** [`a-no-artifacts-flag-for-fmt-spec.md`](a-no-artifacts-flag-for-fmt-spec.md)
**Issue:** [#168](https://github.com/michal-niedzwiedzki/visimark/issues/168) ·
**Decision:** [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/168#issuecomment-5785369119)

## Goal

Add `--no-artifacts` to `visimark fmt`. It declines the write of generated
artifacts — the SVGs a `chart` statement declares — and changes nothing else.
Computed cells, anchored values and import stamps are still spliced,
`--fix-dates` still applies, exit codes do not move, and `check` is untouched: a
missing or stale artifact is still `STALE`, still counted, still exit `1`.

## Architecture

The gate lives in the **engine**, not the CLI. `FmtOptions` gains an optional
`noArtifacts`; when set, `fmt()` returns `artifacts: []` and reports the count it
declined as a new `artifactsSkipped` on `FmtResult`. `cmdFmt` passes the flag
through and reads the count — it holds no policy of its own. This is what lets
the MCP server ([#169](https://github.com/michal-niedzwiedzki/visimark/issues/169)),
which calls the engine rather than the CLI, get the same guarantee without
re-implementing it.

The refusal on every other command is table-driven and costs one entry in
`args.ts`, per
[`refuse-unrecognised-and-misplaced-cli-options-spec.md`](refuse-unrecognised-and-misplaced-cli-options-spec.md).

Exit codes need no work. `fmt()` already filters `FIXABLE_BY_FMT = {"STALE"}`
out of its `unfixable` remainder before the write loop runs, so a document with
five missing charts reports `unfixable: []` today. That behaviour currently holds
by accident, so Task 5 pins it with a regression test.

## Tech Stack

TypeScript, Bun (`bun test`, `bun run typecheck`, `bun run build`). No new
dependency. `FmtOptions` and `FmtResult` are public API
(`packages/visimark/src/index.ts`), so both changes are additive and optional.

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer for this session,
  resolved from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md).
  The git author stays the maintainer's configured identity.
- **No default behaviour changes.** Without the flag, every byte of stdout,
  every exit code and every `--json` value is what it is today, except the
  always-present `artifactsSkipped: 0`.
- **The flag declines a write, never a verdict.** No task may touch `check`, the
  `STALE` finding, or the `N problems` count.
- The public API widens only by optional, additive members.
- Run `bun test`, `bun run typecheck` and `bun run build` from the repo root
  after each task, plus
  `bun run packages/visimark/src/cli/main.ts check` on `docs/example-charts.md`
  and `docs/example-invoice.md`. `bunx visimark` runs the *published* build and
  must not be used.
- Tests copy example documents into a `mkdtempSync` directory and operate there.
  No test mutates anything under `docs/`.

---

## Task 1 — the engine gate

- [ ] `FmtOptions.noArtifacts` gates artifact production; `FmtResult.artifactsSkipped` reports the count.

**Files**
- `packages/visimark/src/write/fmt.ts`

**Interfaces**

```ts
export interface FmtOptions {
  fixDates?: boolean;
  /** decline the write of generated artifacts: `fmt` still splices the
   *  document, but returns no artifact for the caller to write. The finding
   *  is unaffected — `check` still reports a missing or stale artifact. */
  noArtifacts?: boolean;
  doc?: DocumentFile;
}

export interface FmtResult {
  // …existing members unchanged…
  /** artifacts that are stale or missing — the caller writes them. Empty
   *  under `noArtifacts`. */
  artifacts: ArtifactWrite[];
  /** how many artifacts `noArtifacts` declined; `0` otherwise */
  artifactsSkipped: number;
}
```

**Steps**
1. Add `noArtifacts?: boolean` to `FmtOptions` with the doc comment above.
2. Add `artifactsSkipped: number` to `FmtResult` with its doc comment.
3. In `fmt()`, keep the existing loop over `result.charts` that builds the
   `artifacts` array unchanged — it is the thing being counted. Then, when
   `opts.noArtifacts` is set, return `artifacts: []` and
   `artifactsSkipped: artifacts.length`; otherwise return the array and
   `artifactsSkipped: 0`.
4. Do **not** touch the `unfixable` computation. The `FIXABLE_BY_FMT` filter
   already excludes `STALE` and must keep doing so unconditionally.
5. Do not touch `output`, `changed`, `cellsUpdated`, `anchorsUpdated`,
   `datesFixed` or `stampsUpdated` — artifacts take no part in any of them.

---

## Task 2 — the CLI option

- [ ] `--no-artifacts` parses on `fmt` and is refused everywhere else.

**Files**
- `packages/visimark/src/cli/args.ts`

**Interfaces**

```ts
const OPTIONS: Record<string, OptionSpec> = {
  // …
  "--fix-dates": { commands: ["fmt"], value: false },
  "--no-artifacts": { commands: ["fmt"], value: false },
  // …
};

const USAGE: Record<CommandName, string> = {
  // …
  fmt: "usage: visimark fmt FILE... [--fix-dates] [--no-artifacts]",
  // …
};
```

**Steps**
1. Add the `--no-artifacts` entry to `OPTIONS`, next to `--fix-dates`.
2. Update `USAGE.fmt` to name the flag.
3. Add nothing else. The misplacement refusal
   (`visimark: --no-artifacts is only valid with fmt`), the no-value hint
   (``unknown option --no-artifacts=1 — `--no-artifacts` takes no value``) and
   the did-you-mean (``unknown option --no-artifact — did you mean
   `--no-artifacts`?``) all fall out of the existing `parseArgs` /
   `unknownOption` paths. Verify by running them, do not re-implement them.

---

## Task 3 — wiring and the human summary line

- [ ] `cmdFmt` passes the flag through, skips no writes of its own, and names the skipped count.

**Files**
- `packages/visimark/src/cli/commands.ts`

**Steps**
1. Read the flag: `const noArtifacts = flags.has("no-artifacts");`
2. Pass it: `fmt(source, { fixDates, noArtifacts, doc: onDisk(path) })`.
3. Leave the artifact write loop **exactly as it is**. Under the flag
   `r.artifacts` is already empty, so the loop does not run, `mkdirSync` is
   never called, and the `WRITE` refusal cannot occur. This is the point of
   putting the gate in the engine — the CLI does not branch.
4. The human summary line, per spec §4 cases 1, 2 and 5:
   - Add `r.artifactsSkipped ? \`${r.artifactsSkipped} artifact${r.artifactsSkipped === 1 ? "" : "s"} skipped\` : ""`
     as the last entry of the existing `bits` array.
   - Widen the `if` that chooses `updated …` over `unchanged` to include
     `r.artifactsSkipped > 0`, and when `r.changed` is false while
     `artifactsSkipped > 0`, print `` `${path}: unchanged, ${skippedBit}` ``.
   - Case 5 (a document that declares no chart) must print a bare `unchanged`
     with no clause, because `artifactsSkipped` is `0`.
5. Do not change the `r.unfixable` branch, the `formatCheck` call, or the
   `exit = 1` rule.

---

## Task 4 — the `--json` envelope

- [ ] `artifactsSkipped` appears per-file and in `summary`, always present.

**Files**
- `packages/visimark/src/cli/commands.ts`

**Steps**
1. In the per-file JSON entry, add `artifactsSkipped: r.artifactsSkipped`
   directly after `artifacts`. `artifacts` stays
   `r.artifacts.map((a) => ({ path: a.path }))` — under the flag it is `[]`
   because the engine emptied it, not because the CLI special-cased it.
2. Accumulate `artifactsSkippedCount += r.artifactsSkipped` alongside the
   existing `artifactCount`, and emit `artifactsSkipped` in `summary` directly
   after `artifacts`.
3. Both keys are emitted unconditionally, `0` without the flag, so a consumer
   sees one shape. Do not make either key conditional.
4. Change nothing about `status`, `problems`, `stale`, `errors`, or the `check`
   envelope.

---

## Task 5 — tests

- [ ] Every row of spec §4 is pinned, and so is the incidental exit-code behaviour.

**Files**
- `packages/visimark/test/cli/no-artifacts.test.ts` (new)
- `packages/visimark/test/cli/options.test.ts`
- `packages/visimark/test/cli/json.test.ts`
- `packages/visimark/test/write/fmt.test.ts`

**Interfaces**

Fixtures follow `options.test.ts`: `mkdtempSync` under `tmpdir()`, documents
copied from `docs/`, `afterAll` removing the directory. Two arrangements, named
as in the spec:

- **`A`** — `example-charts.md` alone, `charts/` absent: five artifacts missing,
  document otherwise clean.
- **`B`** — `example-charts.md` plus a copy of `docs/charts/`, with `Jan`'s
  `Revenue` rewritten `48200.00` → `50000.00`: one stale cell, two stale
  anchors, three stale artifacts.

**Steps**
1. `no-artifacts.test.ts` — spec §4 rows 1, 2, 4, 5, 6 and 14. Assert the exact
   stdout line, the exit code, **and** the filesystem: after row 1 the temp
   directory still contains only `example-charts.md`, and after row 2 each of
   the three stale SVGs is byte-identical to its pre-run content.
2. `options.test.ts` — append rows 10–13 to the existing `REFUSED` table:
   `check … --no-artifacts` and `infer … --no-artifacts` both
   `visimark: --no-artifacts is only valid with fmt`; `fmt --no-artifacts=1` the
   takes-no-value hint; `fmt --no-artifact` the did-you-mean. Each exits `2`.
   Add the `fmt --no-artifacts=1` case to whatever assertion that file already
   makes about the document being left byte-identical.
3. `json.test.ts` — rows 7 and 8. Row 7 (`A`, with the flag): `artifacts` is
   `[]`, `artifactsSkipped` is `5`, `summary.artifacts` is `0`,
   `summary.artifactsSkipped` is `5`, `status` is `ok`, exit `0`. Row 8 (`B`,
   without the flag): `artifacts` has three entries, `artifactsSkipped` is `0`.
   Assert `artifactsSkipped` is present in both, to pin "always present".
4. `fmt.test.ts` — two engine-level tests. First, `fmt(source, { noArtifacts:
   true, doc })` on `A` returns `artifacts: []` and `artifactsSkipped: 5` while
   `output`, `changed`, `cellsUpdated` and `anchorsUpdated` match a run without
   the flag. Second, the **regression test for the exit code**: on `A`, with and
   without `noArtifacts`, `unfixable` is `[]` — a chart's `STALE` finding is
   never part of the unfixable remainder. Comment it with why it is load-bearing:
   it is what makes `fmt --no-artifacts` exit `0`, and it currently holds only
   because `FIXABLE_BY_FMT` contains `STALE`.
5. Spec §4 row 9 (an unfixable finding still exits `1`): build a fixture from
   `A` by introducing a `PRECISION` finding, and assert `fmt --no-artifacts`
   prints the summary line with the skipped clause, then the `PRECISION` report,
   and exits `1`. Put it in `no-artifacts.test.ts`.
6. If `api.test.ts` pins the exported shape of `FmtResult`, extend it for
   `artifactsSkipped`.

---

## Task 6 — documentation

- [ ] Every file that states the current behaviour is updated. This is spec §7 verbatim.

**Files**
- `docs/cli-reference.md`
- `docs/ci.md`
- `docs/design/structured-output-json-spec.md`
- `docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md`
- `skills/visimark/SKILL.md`
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`

**Steps**
1. `docs/cli-reference.md` — three edits. A row in the Options table beside
   `--fix-dates`, carrying the spec §2 wording verbatim (it declines the write,
   never the verdict). The per-command options table row becomes
   `fmt` | `FILE...`, `--fix-dates`, `--no-artifacts`, `--json`. The `fmt`
   command row's **Writes** column notes that the artifact write is declinable.
2. `docs/ci.md` §19, under "Charts are committed artifacts, not build output" —
   add the counter-warning:

   > `fmt --no-artifacts` declines the write for a caller that must not touch
   > files it did not name — a read-only checkout, a sandboxed build, a CI job
   > diffing the result. It is not a way to stop committing charts: `check`
   > still reports every missing artifact as `STALE` and still exits `1`. A
   > repo that gitignores its SVGs still fails, and still should.

3. `docs/design/structured-output-json-spec.md` §3.3 — add `artifactsSkipped`
   to the per-file entry and the `summary` in the example envelope, state that
   it is always present and `0` without the flag, and qualify the existing
   sentence "writing only an artifact still lists that artifact and counts it in
   `summary.artifacts`" with what `--no-artifacts` does instead.
4. `docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md` — add
   `--no-artifacts` to the per-command option table under `fmt`, and a
   `check drift.md --no-artifacts` row to the refusal-examples table.
5. `skills/visimark/SKILL.md` — the "Running it" block becomes
   `visimark fmt FILE... [--fix-dates] [--no-artifacts]`, with one line of
   agent-facing guidance: reach for it when the caller must not write files it
   did not name, and know that it does not silence `check`.
6. `CHANGELOG.md` — under `## Unreleased` → `### Added`:
   `` `fmt --no-artifacts` declines the write of generated chart artifacts. `check` is unaffected (#168). ``
   No `editors/vscode/CHANGELOG.md` entry: the extension has no artifact-writing
   surface and no diagnostic changes.
7. `docs/vocabulary-catalogue.md` — move the `--no-artifacts` row out of the
   section F table into the [Shipped register](../vocabulary-catalogue.md#shipped)
   as `UNRELEASED`, condensed to that table's columns: `Name`
   (`--no-artifacts` for `fmt`), `Kind` (tooling), `Request` ([#168]),
   `Landed` (this PR), `Released` (`—`), `Decision` (the deciding comment).
   Drop the prose columns. The row stays `UNRELEASED` until a tagged release
   ships it; nothing here promotes it to `SHIPPED` or closes #168.
8. Not to be touched, checked against the spec: `README.md`, `CONTRIBUTING.md`,
   `docs/issue-runbook.md`, `docs/releasing.md`, `action.yml`,
   `.github/ISSUE_TEMPLATE/`, `editors/vscode/CHANGELOG.md`, the tutorial.
