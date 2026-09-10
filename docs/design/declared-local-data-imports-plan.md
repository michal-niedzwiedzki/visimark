# Declared local data imports with integrity stamps — implementation plan

**Spec:** [`docs/design/declared-local-data-imports-spec.md`](../docs/design/declared-local-data-imports-spec.md)

## Goal

Implement the `from <path> [delimited <char>] [labelled <col>,...] [at sha256:<digest>]`
fence-info extension end to end: parsing, the CSV loader and its path/stamp
gate, read-only imported sheets in the model, `check`/`fmt`/`explain`/`eval --json`
wiring, the new `IMPORT` finding, and the acceptance fixture from the spec's §6.

## Architecture

An imported sheet's data does not live in the Markdown, but everything
downstream of "here are this sheet's columns and cell texts" already works
generically over a `RawTable` (headers + rows of `{text, start, end}` cells) —
`check.ts`'s unit inference, `coerceInput`, `decimalPlaces`, and the `VECTOR`/
column-index machinery in `graph.ts` all read `sheet.table` and
`sheet.columnIndex` without caring where the table came from.

So the CSV is loaded into that same `RawTable` shape: headers become
`sheet.columnIndex`/`sheet.inputColumns` exactly as a GFM table's header row
does today, and each field becomes a cell with `text` set to the raw field
string. Cell `start`/`end` are **not** real document offsets (there is no
document location for a CSV field) — they are set to the import declaration's
own span in the fence info string, so any finding that needs *some* span to
point at (a `UNIT` conflict inside an imported column, a `DATE`-ish string) at
least lands on the `from` clause rather than crashing on a missing span. This
is new, and is why every finding whose `span` may now point at the fence info
string rather than a table cell needs `report/format.ts` to still print
something sane — checked in Task 5.

The one place this reuse must **not** happen is column-rule classification:
`model/build.ts` currently classifies a binding matching a header name as
`kind: "column"` when `sheet.table !== null`. For an imported sheet this is
wrong — there is nothing to write back to — so `build.ts` gains an explicit
branch for `sheet.imported !== null` that emits the new `IMPORT` finding
instead of creating a column binding.

CSV loading is impure (filesystem + hashing), so it cannot happen inside
`parse/document.ts` (`locate`, pure) or `model/build.ts` (pure, no `docPath`
today). It runs as a **separate step between `build()` and `check()`**,
mirroring how chart artifacts are resolved and read inside `check()` itself
rather than during parsing. A new `resolveImports(model, docPath)` function
(new module `import/resolve.ts`) walks `model.sheets`, and for each sheet
carrying an `imported` declaration: runs the path gate, reads the file, hashes
it, parses the CSV, and either mutates that `Sheet` in place (setting `table`,
`columnIndex`, `inputColumns` from the parsed header/rows, and an
`importStatus` result used later by `check`/`fmt`/`explain`) or records the
`IMPORT`/`STALE` finding and leaves the sheet table-less. `check()` calls this
once, near its top (alongside the existing per-sheet unit-inference pass), and
threads through `opts.docPath` it already accepts for charts.

`fmt`'s stamp rewrite is a normal splicer `Edit` (see `write/splice.ts` —
`applyEdits` already supports zero-length insertions), so no new writing
mechanism is needed: `planFmt` gains a branch that either replaces an existing
`at sha256:...` span or inserts a new ` at sha256:...` token at the end of the
fence info line when there was none.

## Tech Stack

TypeScript, existing `packages/visimark` workspace conventions
(`decimal.js` for numeric values already in use elsewhere is not needed here —
digests and CSV parsing are string/byte-level, no decimal arithmetic). SHA-256
via Node's built-in `node:crypto` (`createHash("sha256")`) — no new
dependency. The path gate reuses `node:fs`/`node:path`, matching
`artifact/path.ts`.

## Global Constraints

Every commit's trailer is resolved from `.claude/rules/ai-attribution.md` at
commit time for **this session** — never hardcode a vendor name into a commit
message, code comment, or this plan. Follow the design doc's existing idiom
(comments explain *why*, not *what*; no code churn beyond what each task
needs). `bun test`, `bun run typecheck`, and `bun run build` must pass after
every task, plus `bun run packages/visimark/src/cli/main.ts check` on
`example-invoice.md`, `example-charts.md`, and `example-invoice-drift.md`
(the transcript in the drift example's own appendix must still match
byte-for-byte — this feature must not change unrelated behaviour).

---

## Task 1: Fence-info grammar for `from`/`delimited`/`labelled`/`at`

- [ ] Parse the import clauses out of a `vmark` block's fence info string.

**Files:**
- `packages/visimark/src/model/types.ts` — add `ImportDecl` and extend `Sheet`.
- `packages/visimark/src/parse/document.ts` — extend `parseSheetId` (rename to
  `parseFenceInfo` or add a sibling) and `RawBlock`.
- `packages/visimark/src/parse/import-decl.test.ts` (new) — grammar unit tests.

**Interfaces:**
```ts
// model/types.ts
export interface ImportDecl {
  path: string;
  pathSpan: Span;
  delimiter: string; // "," by default
  labels: string[] | null;
  labelsSpan: Span | null;
  stampPrefix: "sha256" | null;
  stampDigest: string | null;
  /** span of the whole `at sha256:<digest>` clause, or null if absent —
   *  `fmt` replaces this span; when null it inserts at `declSpan.end`. */
  stampSpan: Span | null;
  /** span of the entire declaration tail after the sheet id, for IMPORT/TYPE
   *  findings that have nowhere more specific to point. */
  declSpan: Span;
}
// extend Sheet:
imported: ImportDecl | null;
```
```ts
// parse/document.ts
export interface RawBlock {
  sheetId: string | null;
  /** parsed `from ...` clause, or null for an ordinary sheet; parseable but
   *  malformed still fails through here (see grammarError). */
  importDecl: ImportDecl | null;
  /** a fence-info clause the `from` grammar rejected (bad order, repeated
   *  clause, unrecognised trailing token) — surfaces as a TYPE finding in
   *  model/build.ts, mirroring how a bad sheet id already surfaces as SHEET. */
  grammarError: { message: string; span: Span } | null;
  bindings: RawBinding[];
  span: Span;
}
```

**Steps:**
1. Write the tokeniser for the fence-info tail: after `#<id>`, optionally
   `from <path>`, then optional `delimited <char>`, optional
   `labelled <name>[, <name>]*`, optional `at <token>`. Reject wrong order, a
   repeated clause, or trailing garbage as `grammarError`; do not throw — the
   sheet id must still parse so the rest of `build.ts` behaves as it does
   today for a document with other errors.
2. `at <token>`: split on `:`. No `:` or an unrecognised prefix →
   `stampPrefix: null` (build.ts turns this into the "unrecognised stamp
   prefix" `IMPORT` finding — parsing does not reject it outright, since the
   prefix name itself is useful in the message). `sha256:<digest>` → validate
   digest is exactly 64 chars of `[0-9a-f]` in this step, or record it verbatim
   with a `malformed` flag for `build.ts` to report precisely (wrong length vs
   non-hex vs uppercase all get distinct messages per spec §3.1).
3. `delimited <char>`: single-character token; reject (as `grammarError`) a
   letter, digit, `"`, `.`, `-`, or whitespace character per spec §2.
4. Compute every span as an absolute document offset: the fence info string
   starts right after `` ```vmark `` on the block's opening line, so locate it
   via `source.indexOf("\n", block.span.start)` for the line end and slice
   between the two, exactly as `bodyStart` is computed today in
   `parse/document.ts` for the block body.
5. Unit tests: every clause alone and combined, every rejected form from spec
   §2–§3.1 (bad order, repeated clause, bad delimiter char, malformed digest,
   unrecognised prefix, wrong-length digest), and that an ordinary
   (non-`from`) sheet id is completely unaffected.

## Task 2: CSV parser

- [ ] RFC 4180 parser matching spec §3.2 exactly.

**Files:**
- `packages/visimark/src/import/csv.ts` (new)
- `packages/visimark/src/import/csv.test.ts` (new)

**Interfaces:**
```ts
export type CsvResult =
  | { ok: true; header: string[]; rows: string[][] }
  | { ok: false; message: string };

export function parseCsv(text: string, delimiter: string): CsvResult;
```

**Steps:**
1. Implement a hand-written scanner (no dependency — matches the project's
   "never `eval()`, hand-written parser" posture in `lang/`): quoted/unquoted
   fields, `""` escaping, delimiter and newline recognition, one row per line.
2. Reject mixed `\n`/`\r\n` in one file (§3.2 "Newlines"), an unterminated
   quote, and a completely empty file (`ok: false` for both — the caller in
   Task 3 turns these into `IMPORT` findings with the exact messages from the
   spec's acceptance table).
3. Zero-data-row files (header only) parse fine — `{ ok: true, header, rows: [] }`.
4. Do **not** validate duplicate headers, identifier-shaped headers, or
   `labelled` here — those need the caller's declaration context and belong in
   Task 3, keeping this module a pure CSV parser with no VisiMark-specific
   rules.
5. Tests: comma default, `delimited` chars, quoted fields containing the
   delimiter/newline/quote, `""` escaping, CRLF, mixed-newline rejection,
   unterminated quote, empty file, header-only file, a UTF-8 BOM (BOM handling
   itself is the caller's job per spec §3.2 — this module receives BOM-stripped
   text and need not know about encoding at all).

## Task 3: Path gate, stamp verification, and `resolveImports`

- [ ] Wire path resolution, SHA-256 stamping, and CSV parsing into one
      per-sheet resolution step that mutates the model.

**Files:**
- `packages/visimark/src/import/path.ts` (new) — adapted from
  `artifact/path.ts`: same relative/contained/no-symlink-escape/no-control-char/
  no-device-name gate, but checks for a lowercase `.csv` extension instead of
  `.svg`, and has no "refuse to overwrite unmarked file" rule (nothing is ever
  written here).
- `packages/visimark/src/import/resolve.ts` (new) — `resolveImports`.
- `packages/visimark/src/import/resolve.test.ts` (new).
- `packages/visimark/src/model/types.ts` — add `ImportStatus` result type.

**Interfaces:**
```ts
// import/resolve.ts
export interface ImportStatus {
  sheetId: string;
  target: string | null; // absolute path once gated, else null
  digest: string | null; // sha256 of the file's raw bytes, once read
  state: "ok" | "unstamped" | "stale" | "error";
}

/** Mutates each imported sheet's table/columnIndex/inputColumns in place on
 *  success; always returns one Finding per failing sheet (IMPORT or STALE)
 *  and one ImportStatus per imported sheet either way. No-op when the model
 *  has no `from` sheets or `docPath` is undefined (mirrors chart handling:
 *  without a docPath nothing on disk can be resolved). */
export function resolveImports(
  model: DocModel,
  docPath: string | undefined,
): { findings: Finding[]; statuses: Map<string, ImportStatus> };
```

**Steps:**
1. For each sheet with `imported`, run the spec §4 resolution order exactly:
   fence-info grammar error (already an `IMPORT`/`TYPE` finding from Task 1 —
   skip further checks for this sheet if present) → path gate → file exists →
   stamp clause well-formed → stamp matches → CSV parses → no duplicate
   headers → headers are identifiers → `labelled` matches. Stop at the first
   failure per sheet (spec §4's resolution-order table).
2. On full success: build a synthetic `RawTable` from the parsed CSV — headers
   as `RawCell[]` with `text` set and `start`/`end` both equal to
   `imported.declSpan.start` (a degenerate but valid span); same for every
   data cell. Set `sheet.table`, populate `sheet.columnIndex` and
   `sheet.inputColumns` exactly as `model/build.ts`'s `ensureSheet`/header-scan
   logic does for a real table (reuse that logic rather than duplicating it —
   consider exporting a small helper from `model/build.ts` for "index these
   headers into this sheet").
3. On failure: emit the one finding named in spec §3.1/§3.2/§4 (message text
   copied verbatim from the spec's tables), leave `sheet.table === null` so
   every binding reading an imported column falls through the ordinary
   `UNDEF`/`VECTOR` path a table-less sheet already takes — no new suppression
   logic needed beyond what §4's "Suppression" paragraph already describes,
   which the existing `unevaluable` propagation in `check.ts` provides for
   free once the column plainly does not exist.
4. Digest: `createHash("sha256").update(rawBytes).digest("hex")` over the
   file's bytes exactly as read (no BOM stripping — spec §3.2 is explicit that
   the digest covers the raw bytes; BOM stripping happens only on the copy
   handed to `parseCsv`).
5. Tests: one per resolution-order failure mode, plus the two success paths
   (unstamped-but-otherwise-valid passes through with an `IMPORT` "unstamped"
   finding per spec §3.1, and a fully matching stamp resolves clean).

## Task 4: `model/build.ts` — read-only imported sheets

- [ ] Reject column rules on an imported sheet; reject a table immediately
      before a `from` block.

**Files:**
- `packages/visimark/src/model/build.ts`

**Steps:**
1. `ensureSheet` takes the block's `importDecl` and stores it on the `Sheet`.
2. Where `build.ts` currently checks `doc.detachedTableBlocks`, add: a `from`
   block whose preceding-table lookup (`doc.tableBeforeBlock.get(block)`) is
   non-null is a `SHEET` finding, "an imported sheet may not also own an
   inline table" (spec §2).
3. Where `build.ts` decides `isColumn = table !== null && headerIndex.has(...)`
   — since at `build()` time an imported sheet's table is not yet known (CSV
   parsing happens later, in Task 3's `resolveImports`), this check cannot run
   here for imported sheets. Defer it: `build.ts` records every binding in an
   imported sheet as a **scalar candidate** regardless of name collision with
   a future header, and `resolveImports` (Task 3, after the CSV header is
   known) re-checks each such binding's name against the now-known header set,
   converting a collision into the `IMPORT` "column rule on an imported sheet"
   finding and removing that binding from `sheet.scalars` so it is never
   evaluated as a scalar shadowing a column name.
4. Propagate `block.grammarError` (Task 1) into a `TYPE` finding at
   `build()` time, same site as the existing malformed-sheet-id `SHEET`
   finding just above it.
5. Tests in `model/build.test.ts` (existing file): a `from` sheet with a
   preceding table (`SHEET`), a malformed fence-info tail (`TYPE`), and that
   an ordinary document's sheets are byte-identical in behaviour to before
   this task (regression guard).

## Task 5: `eval/check.ts` — wire `resolveImports` in, new `IMPORT` code

- [ ] `check()` calls `resolveImports` before its existing per-sheet passes;
      `CheckResult` exposes import state for `explain`/`--json`.

**Files:**
- `packages/visimark/src/model/types.ts` — add `"IMPORT"` to `FindingCode` and
  `ERROR_CODES`.
- `packages/visimark/src/eval/check.ts`
- `packages/visimark/src/report/format.ts` — print an `IMPORT` finding (path,
  message) the way an `ARTIFACT` finding already prints.
- `packages/visimark/src/report/json.ts` — see Task 7.

**Steps:**
1. `check(model, opts)` calls `resolveImports(model, opts.docPath)` first
   thing, folds its findings into the same `emit` pipeline the chart pass
   already uses, and stashes the returned `Map<string, ImportStatus>` on
   `CheckResult` as `imports: Map<string, ImportStatus>`.
2. Add `IMPORT` to the `CODE_RANK` table in `orderFindings` alongside `SHEET`/
   `TYPE` (rank 0 — a structural problem, reported before data-level findings).
3. Confirm the resolution-order Task-3 change means `check.ts`'s existing
   unit-inference loop (`for (const sheet of model.sheets.values()) { const
   table = sheet.table; if (!table) continue; ... }`) already runs unchanged
   over an imported sheet's synthetic table — no edit needed there, but add a
   test proving a `UNIT`-mixing imported column is caught (spec §3.2's "Unit
   decoration" row).
4. `report/format.ts`: an `IMPORT` finding prints its `message` verbatim under
   the sheet id, matching the existing `ARTIFACT`/`SHEET` formatting.
5. Tests: extend `eval/check.test.ts` with the full spec §6 transcript list
   (clean / unstamped / stale / missing file / labelled mismatch / column-rule
   attempted / path-gate violation) against a small in-repo fixture (Task 8
   builds the actual fixture; this task can use an inline temp file per test).

## Task 6: `write/fmt.ts` — stamp add/update, never touching the CSV

- [ ] `fmt` adds a stamp to an unstamped import and rewrites a stale one;
      never touches anything else about the declaration or the CSV file.

**Files:**
- `packages/visimark/src/write/fmt.ts`

**Steps:**
1. `planFmt` gains a pass over `model.sheets` with `sheet.imported`: look up
   that sheet's `ImportStatus` from `CheckResult.imports`.
   - `state === "ok"` → no edit (idempotent).
   - `state === "unstamped"` → insert `` ` at sha256:${digest}` `` at
     `imported.declSpan.end` (zero-length `Edit`).
   - `state === "stale"` → replace `imported.stampSpan!` with
     `` `at sha256:${digest}` ``.
   - `state === "error"` → no edit, per spec §3.1's `fmt` table.
2. Add a `stampsUpdated` counter to `FmtResult` alongside the existing
   `cellsUpdated`/`anchorsUpdated`/`datesFixed`, and surface it in the CLI's
   plain-text and `--json` summaries the same way the others already are
   (check `cli/commands.ts` for that summary line).
3. Confirm `fmt` never opens the CSV file for writing anywhere — there should
   be no new `fs.write*` call touching `imported.path`'s resolved target in
   this diff at all.
4. Tests: unstamped → stamped (fresh insert), stale → corrected (replace),
   already-correct → byte-identical second `fmt` (idempotence property test,
   spec §6 item 8), and an `error`-state import left untouched.

## Task 7: `explain` and `eval --json`

- [ ] Surface import state where the CLI already surfaces chart state.

**Files:**
- `packages/visimark/src/cli/commands.ts` (or wherever `explain`'s per-sheet
  rendering lives — grep for where chart target/state is printed today) and
  `packages/visimark/src/report/json.ts`.

**Steps:**
1. `explain #sheet`: print the import's path, delimiter, `labelled` list (if
   any), and stamp state (`matching`/`stale`/`unstamped`/`error`) above the
   sheet's scalars and evaluation order — same position `explain` already
   gives a chart's target/state.
2. `eval --json`: each sheet entry gains an optional `import` object
   (`path`, `delimiter`, `labels`, `stamp`, `stampStatus`) exactly as spec §5
   defines; add it to `structured-output-json-spec.md`'s schema description
   alongside the existing `charts` array documentation.
3. `infer`: add an explicit test proving `infer` proposes nothing for a `from`
   sheet even when its CSV columns look chartable/summable — one line next to
   the existing "`infer` never proposes a chart" test, per spec §5.
4. Tests: `explain` output snapshot for one imported sheet in each stamp
   state; `eval --json` schema test for the new `import` field, present only
   on `from` sheets.

## Task 8: Acceptance fixture

- [ ] Build the spec §6 fixture and its full transcript test.

**Files:**
- `packages/visimark/test/fixtures/import/benchmark.csv` (new)
- `packages/visimark/test/fixtures/import/benchmark.md` (new)
- `packages/visimark/test/fixtures/import/*.md` variants for each of spec §6's
  seven negative cases (unstamped, stale, missing-file, labelled-mismatch,
  column-rule-attempted, path-gate-violation), or one parameterised test
  generating each variant's source in-memory from the clean fixture — prefer
  in-memory variants over seven near-duplicate committed files, since only the
  clean pair needs to exist as real fixture files for `fmt`'s idempotence test
  to write to.
- `packages/visimark/test/import-acceptance.test.ts` (new)

**Steps:**
1. Commit `benchmark.csv` exactly as specified in spec §6, then compute its
   real SHA-256 (a small script or `node -e`) and paste it into
   `benchmark.md`'s `at sha256:` clause so the clean-fixture test starts from
   a genuinely matching stamp.
2. One test per spec §6 acceptance item (1–8), each asserting the exact finding
   code and exit code the spec's table states; the `fmt`-idempotence test
   (item 8) runs `fmt` twice against a temp copy of the fixture directory
   (never against the committed files) and asserts byte-identical output both
   times and an untouched `benchmark.csv`.
3. Run this test file specifically, then the full suite, to confirm nothing
   in Tasks 1–7 regressed the three existing normative examples.

## Task 9: Documentation

- [ ] Land the design-doc, changelog, and catalogue updates the spec commits
      the project to.

**Files:**
- `docs/visimark-design.md`
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`
- `docs/cli-reference.md` (if it enumerates fence-info syntax or the `explain`/
  `eval --json` surface — check before editing; skip with a note in the PR if
  it does not need a change)

**Steps:**
1. `visimark-design.md`:
   - §2, constraint 4: replace with the amended text from spec's "Constraint 4
     amendment" section, verbatim.
   - §3 (Document model): document the `from`/`delimited`/`labelled`/`at`
     fence-info grammar as a new subsection, parallel to how §18 documents
     `chart`.
   - §9 (Write-back): add the "declared input" paragraph from spec §5,
     verbatim.
   - §10 (Error taxonomy): add the `IMPORT` row; note `STALE` and `SHEET` and
     `TYPE` are widened, matching how the artifacts feature widened `STALE`.
   - New `## 19. Declared local data imports` section (or fold into §3/§18's
     neighbourhood — match whatever numbering is live on `master` by the time
     this task runs, since other issues may have landed sections in between)
     covering CSV parsing rules, the path gate, and the resolution order, at
     the level of detail §18 gives charts.
   - §11 (CLI): note `explain`/`eval --json` surface the import state.
   - §13 (Testing): add the new fixture to the list of things a build proves,
     alongside the three normative examples (it is explicitly *not* promoted
     to normative status per the decided scope — say so, so a future reader
     does not assume it needs byte-stability across all of `fmt`).
2. `CHANGELOG.md`, under `## Unreleased` → `### Added`: one line naming the
   feature and linking #66.
3. `docs/vocabulary-catalogue.md`: move the "Declared local data imports with
   integrity stamps" row out of section E's table into the
   [Shipped register](docs/vocabulary-catalogue.md#shipped) as `UNRELEASED`
   — `Name`, `Kind` = "language feature", `Request` = `#66`, `Landed` = this
   PR (fill in once its number is known), `Released` = `—`, `Decision` = the
   deciding comment link. Drop the Pros/Cons prose per the Shipped table's
   columns.
4. `editors/vscode/CHANGELOG.md`: skip — no LSP/diagnostic-surface change
   beyond a new finding code already covered by the shared engine; confirm
   the extension has no per-code allowlist that would need the `IMPORT` code
   added before it renders (grep for how `ARTIFACT` was added there when #36
   shipped, and mirror it if one exists).
5. Run the full local check loop (`bun test`, `bun run typecheck`,
   `bun run build`, `check` on the three normative examples) one final time.
