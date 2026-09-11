# `unlabelled` clause for headerless CSV imports — implementation plan

**Spec:** [`docs/design/explicit-schema-for-headerless-csv-imports-spec.md`](../docs/design/explicit-schema-for-headerless-csv-imports-spec.md)

## Goal

Add the `unlabelled <col>,...` fence-info clause end to end: grammar (mutually
exclusive with `labelled`), import resolution (no header row consumed, names
assigned positionally, arity validated against every row), `explain`/`eval
--json` surfacing, and the acceptance fixture from the spec's §6.

## Architecture

This is a narrow extension of the machinery #66 already shipped, not a new
subsystem — every file this plan touches is one #66 already created.

**Grammar ([`parse/fence-info.ts`](../packages/visimark/src/parse/fence-info.ts)).**
`labelled` and `unlabelled` occupy the same clause "stage" (today: stage 2,
between `delimited` and `at`) and are mutually exclusive, so the cleanest
shape is to keep the existing `labels`/`labelsSpan` fields (both clauses fill
them identically — a name list, positionally significant) and add one
discriminator, `labelsMode: "labelled" | "unlabelled" | null`, set by whichever
clause matched (`null` when neither is present, preserving today's behaviour
exactly). The stage-2 slot is claimed by either keyword, so `labelled … at …
unlabelled …` and `unlabelled … labelled …` both fail the existing
"out of order or repeated" check for free — no new mutual-exclusivity branch
needed beyond reusing `stage`.

**Resolution ([`import/resolve.ts`](../packages/visimark/src/import/resolve.ts)).**
`parseCsv` ([`import/csv.ts`](../packages/visimark/src/import/csv.ts)) always
splits row 1 off as `header`. For `labelsMode === "unlabelled"` that split is
wrong — row 1 is data — so `resolveImports` reassembles the full row set as
`[parsed.header, ...parsed.rows]` and uses `decl.labels` as the column names
instead of `parsed.header`. This is the only place `csv.ts` behaves
differently by mode, and it needs no change to `csv.ts` itself: the parser
stays exactly what its own doc comment says it is — a row splitter with no
VisiMark-specific rules — and "which row is the header" stays the caller's
job, same division of responsibility the module already documents.

The duplicate-name and identifier-shaped-name checks already run over
`parsed.header`; for `unlabelled` they run over `decl.labels` instead — same
checks, same error shapes, different source list. What's genuinely new is
**row-width validation**: today no code path checks a row's field count
against anything, for any import mode (a ragged row is silently accepted).
`unlabelled` adds this check, scoped to itself only, per the spec's §4 "new
only for `unlabelled`" note — every row (including the reassembled first one)
must have exactly `decl.labels.length` fields, or the first offending row
is one `IMPORT` finding.

**Everything downstream of "sheet has a header list and rows" is unchanged.**
The synthetic-`RawTable` construction, the scalar-shadowing sweep, `check`'s
unit-inference pass, `fmt`'s stamp-only rewrite, and the shape/evaluation
system do not know or care whether the header came from the CSV file or the
declaration — this was already true for `labelled` vs. unasserted, and
`unlabelled` is a third source feeding the same seam.

## Tech Stack

No new dependency. Same TypeScript workspace conventions as #66
(`node:crypto` for the stamp, hand-written parsing, no `eval()`).

## Global Constraints

Every commit's trailer is resolved from `.claude/rules/ai-attribution.md` at
commit time for **this session** — never hardcode a vendor name into a commit
message, code comment, or this plan. `bun test`, `bun run typecheck`, and
`bun run build` must pass after every task, plus
`bun run packages/visimark/src/cli/main.ts check` on `example-invoice.md`,
`example-charts.md`, `example-invoice-drift.md` (the drift transcript must
stay byte-for-byte) and the existing `test/fixtures/import/benchmark.md` (the
`labelled` path must show zero regression).

---

## Task 1: Fence-info grammar for `unlabelled`

- [x] Parse `unlabelled <col>,...` as a mutually-exclusive alternative to
      `labelled` in the fence-info tail.

**Files:**
- `packages/visimark/src/parse/fence-info.ts`
- `packages/visimark/src/model/types.ts` — extend `ImportDecl`.
- `packages/visimark/src/parse/document.ts` — extend the rebase helper for
  the new field (no new span type needed; `labelsMode` is not a span).
- `packages/visimark/src/parse/fence-info.test.ts` (existing, per Task 1 of
  the #66 plan) — extend with `unlabelled` cases.

**Interfaces:**
```ts
// parse/fence-info.ts / model/types.ts — ImportDeclRel / ImportDecl gain:
labelsMode: "labelled" | "unlabelled" | null;
```

**Steps:**
1. In the stage-2 branch of `parseFenceInfo`'s loop, accept `unlabelled` as
   well as `labelled`, sharing the same `stage >= 2` guard so either keyword
   appearing twice, or both appearing, is "out of order or repeated" — reuse
   the exact error message text already used for `labelled`, since from the
   parser's point of view they are the same clause slot.
2. Both keywords share the same name-list parsing (comma-separated, stop at a
   following bare `at`, reject an empty list with the existing "needs at
   least one column name" message shape, substituting the keyword actually
   used). Set `labels`/`labelsSpan` from the parsed list either way, and set
   the new `labelsMode` to whichever keyword matched.
3. `document.ts`'s rebase pass copies `labelsMode` through unchanged (not a
   span, no offset shift needed) alongside the existing `labels`/`labelsSpan`
   rebasing.
4. Tests: `unlabelled` alone, `unlabelled` combined with `delimited`/`at`,
   `unlabelled` with an empty list, `labelled` immediately followed by
   `unlabelled` (and the reverse) both failing as "out of order or
   repeated", and confirm every existing `labelled`-only test still passes
   unchanged with `labelsMode: "labelled"` on its result.

## Task 2: `import/resolve.ts` — no-header parsing and row-width validation

- [x] `resolveImports` treats row 1 as data and validates every row's width
      against the declared name count when `labelsMode === "unlabelled"`.

**Files:**
- `packages/visimark/src/import/resolve.ts`
- `packages/visimark/src/import/resolve.test.ts` (existing)

**Steps:**
1. After `parseCsv` succeeds, branch on `decl.labelsMode`:
   - `"unlabelled"`: let `allRows = [parsed.header, ...parsed.rows]` and
     `names = decl.labels!` (guaranteed non-null by the grammar). Skip the
     existing duplicate-header/identifier checks that read `parsed.header` —
     run the equivalent checks over `names` instead (same two checks,
     `decl.labelsSpan` as the finding's span instead of `decl.declSpan`,
     matching how a `labelled` mismatch already points at `labelsSpan ??
     declSpan`).
   - anything else (`"labelled"` or `null`): unchanged — `allRows =
     parsed.rows`, `names = parsed.header`, existing checks run as today.
2. New step, `unlabelled` only, after the duplicate/identifier checks and
   before building the synthetic table: walk `allRows`, and on the first row
   whose `length !== names.length`, fail with one `IMPORT` finding —
   `` too few names: declared ${names.length}, row ${rowNumber} has
   ${row.length} fields `` (or "too many", by which side of the count the
   mismatch falls) — `rowNumber` is 1-based over `allRows` (so the
   reassembled former-header row is row 1, matching the spec's worked
   examples). Span: `decl.labelsSpan ?? decl.declSpan`, the same "nowhere
   more specific to point" convention the rest of this resolver already uses
   for declaration-level problems.
3. Build the synthetic table from `names`/`allRows` exactly as today's code
   builds it from `parsed.header`/`parsed.rows` — same cell-span convention
   (`decl.declSpan`), same `sheet.columnIndex`/`sheet.inputColumns`
   population, same scalar-shadowing sweep (it already iterates "the header
   list" generically and needs no change).
4. Tests, mirroring `resolve.test.ts`'s existing `labelled` coverage: clean
   `unlabelled` import; too-few names; too-many names; a later row (not row
   1) ragged against an otherwise-matching arity, asserting the finding names
   that row's number, not row 1's; duplicate name in the `unlabelled` list;
   non-identifier declared name; and one test proving a `labelled` import's
   resolution path is byte-for-byte unchanged (same findings, same synthetic
   table) now that the branch exists.

## Task 3: `explain` and `eval --json` — surface `labelsMode`

- [x] Both surfaces already print/serialize `labels`; add the mode alongside
      it so a reader (or a script) can tell `labelled` from `unlabelled` from
      "neither given".

**Files:**
- `packages/visimark/src/cli/commands.ts`

**Steps:**
1. `explain`'s per-sheet import line (`out(\`  import:  ...\`)`, around the
   existing `labels` interpolation): print `unlabelled <names>` instead of
   `labelled <names>` when `sheet.imported.labelsMode === "unlabelled"`;
   unchanged for `"labelled"` or `null`.
2. `eval --json`'s per-sheet `import` object gains `mode:
   sheet.imported.labelsMode` alongside the existing `path`/`delimiter`/
   `labels`/`stamp`/`stampStatus` fields. Update
   `docs/design/structured-output-json-spec.md`'s schema description for the
   `import` object to list the new field (check whether that spec file
   enumerates fields explicitly before editing — mirror however `labels` is
   already documented there).
3. Confirm (existing behaviour, no code needed) `infer` still proposes
   nothing for any `from` sheet regardless of mode — add one explicit test
   for the `unlabelled` case next to the existing `labelled`/plain-`from`
   ones, per spec §5.
4. Tests: `explain` output snapshot for an `unlabelled` sheet; `eval --json`
   schema test asserting `mode: "unlabelled"` appears only when declared, and
   `mode: "labelled"` / `mode: null` are unchanged for the other two cases.

## Task 4: Acceptance fixture

- [x] Commit the headerless fixture pair from spec §6 and its transcript
      tests.

**Files:**
- `packages/visimark/test/fixtures/import/benchmark-headerless.csv` (new)
- `packages/visimark/test/fixtures/import/benchmark-headerless.md` (new)
- `packages/visimark/test/import-acceptance.test.ts` (existing — extend, same
  file #66's fixture already uses, following its pattern of committing only
  the clean pair and generating every negative variant in memory)

**Steps:**
1. Commit `benchmark-headerless.csv` exactly as spec §6 gives it (three rows,
   no header, two fields each); compute its real SHA-256 and paste it into
   `benchmark-headerless.md`'s `at sha256:` clause so the clean-fixture test
   starts from a genuinely matching stamp — same approach #66's plan used for
   `benchmark.md`.
2. One test per spec §6 acceptance item (1–8): clean; too-few names;
   too-many names; ragged data (row 3, not row 1); duplicate declared name;
   invalid declared identifier; both clauses present; and a re-run of
   `benchmark.{md,csv}`'s existing full transcript proving no regression on
   the `labelled` path.
3. Run this test file specifically, then the full suite, then the CLI `check`
   pass over the three normative examples plus the existing `labelled`
   fixture, confirming nothing in Tasks 1–3 regressed prior behaviour.

## Task 5: Documentation

- [x] Land the design-doc, changelog, catalogue, and CLI-reference updates
      the spec commits the project to.

**Files:**
- `docs/visimark-design.md`
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`
- `docs/cli-reference.md`

**Steps:**
1. `visimark-design.md` §19 (Declared local data imports): extend the syntax
   line to `[labelled <col>,... | unlabelled <col>,...]`; add a short
   paragraph on `unlabelled`'s no-header-row semantics and the mutual-
   exclusivity rule, at the level of detail the existing `labelled` sentence
   gives; note in the resolution-order paragraph that `unlabelled` validates
   every row's width against the declared count (new), while `labelled`'s
   behaviour is explicitly unchanged.
2. `CHANGELOG.md`, under `## Unreleased` → `### Added`: one line naming the
   feature and linking #70.
3. `docs/vocabulary-catalogue.md`: move the "`unlabelled` clause for
   headerless CSV imports" row out of section E's table into the
   [Shipped register](../vocabulary-catalogue.md#shipped) as `UNRELEASED` —
   `Name`, `Kind` = "language feature", `Request` = `#70`, `Landed` = this
   PR (fill in once its number is known), `Released` = `—`, `Decision` = the
   deciding comment link. Drop the Pros/Cons prose per the Shipped table's
   columns.
4. `docs/cli-reference.md`: extend the `IMPORT` row's cause list (currently
   "no stamp yet, a missing file, a malformed stamp, a path outside the
   document's directory, malformed CSV, or a binding that shadows an imported
   (read-only) column") to also name an `unlabelled` arity mismatch and a
   duplicate/invalid declared name.
5. `editors/vscode/CHANGELOG.md`: skip, same reasoning #66's plan gave —
   no new finding code, no per-code allowlist to update; confirm before
   skipping by checking how the extension surfaces `IMPORT` today (it
   already does, from #66) and that nothing there is keyed to which clause
   produced it.
6. Run the full local check loop (`bun test`, `bun run typecheck`,
   `bun run build`, `check` on the three normative examples and both import
   fixtures) one final time.
