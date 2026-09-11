# `unlabelled` clause for headerless CSV imports — feature spec

**Status:** approved (#70) · **Date:** 2026-09-11 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/70#issuecomment-5637476576

## 1. Purpose

[§19](../visimark-design.md#19-declared-local-data-imports)'s declared local
data imports (shipped from
[#66](https://github.com/michal-niedzwiedzki/visimark/issues/66)) always
consume the CSV's first row as a header — `labelled <col>,...` *asserts* that
header, but does not make it optional. A CSV produced by an export pipeline,
a benchmark harness, or any machine-generated source frequently carries no
header row at all, and today that file cannot be imported: `check` reads row
1 as column names, so a genuinely headerless file either fails as duplicate
or non-identifier "headers", or — worse — silently drops its first data row
into the header and loses it from every reduce.

This spec adds `unlabelled <col>,...`, the positional counterpart to
`labelled`: it supplies the column names the document declares them to be,
in order, for a CSV that has no header row to assert. `labelled` and
`unlabelled` are the same idea — the sheet's schema is stated in the document,
not read blind off the file — applied to the two cases a CSV shows up in:
header present (assert it) or header absent (supply it).

**What a document cannot express without it.** There is no way today to
import a CSV that has no header row: every row is consumed as data starting
from row 2, and row 1 is always read as column names, asserted or not.

**What existing vocabulary already covers.** Nothing changes about how an
imported column is read once resolved — it is a vector, exactly like a
`labelled` column, consumed by a reduce, a chart, or a cross-sheet scalar
([§6](../visimark-design.md#6-name-resolution-and-scoping)). This spec is
entirely about how the header row is decided, not about anything downstream
of it.

## 2. Syntax

[§19](../visimark-design.md#19-declared-local-data-imports)'s grammar is
amended:

```
vmark #<id> from <path> [delimited <char>] [labelled <col>[, <col>]* | unlabelled <col>[, <col>]*] [at sha256:<digest>]
```

- `labelled <col>[, <col>]*` — unchanged: asserts the CSV's header row, in
  order.
- `unlabelled <col>[, <col>]*` — new. Declares the sheet's column names,
  positionally, for a CSV with **no header row**: row 1 is read as data, not
  consumed as column names. Same list grammar as `labelled` (comma-separated
  identifiers); the same [§3](../visimark-design.md#3-document-model)
  identifier rule applies to each name.
- **`labelled` and `unlabelled` are mutually exclusive.** A declaration
  naming both, or repeating either, is a `TYPE` error against the fence info
  string — the same treatment the existing clause-order/repeat rule already
  gives a doubled `delimited` or `at` clause.
- **Neither clause present** — unchanged from today: the CSV is assumed to
  carry a header, read from row 1, unasserted. `unlabelled` is the only way
  to skip header consumption; it does not change the meaning of omitting
  both clauses, which stays exactly as documented before this feature.
- Clause order is fixed: `from`, then `delimited`, then `labelled` **or**
  `unlabelled`, then `at`. Any other order, or an unrecognised trailing
  token, remains a `TYPE` error, unchanged from today.

## 3. Semantics

| Case | Behaviour |
|---|---|
| `unlabelled Id, Memory, vCPU` against a 3-column, headerless CSV | Rows are read starting at row 1 (no row consumed as a header). Columns are named `Id`, `Memory`, `vCPU`, positionally, exactly as if they had been the CSV's own header. |
| Declared-name count < every row's field count | `IMPORT` error — "too few names: declared 2, row 1 has 3 fields" — naming the first offending row. |
| Declared-name count > every row's field count | `IMPORT` error — "too many names: declared 4, row 1 has 3 fields" — naming the first offending row. |
| A later row's field count differs from the declared-name count (row 1 matches, row 5 does not) | `IMPORT` error naming the first offending row and its actual field count — a headerless import validates every row's width against the declared arity, not only the first. |
| Duplicate name in the `unlabelled` list (`unlabelled Id, Time, Id`) | `IMPORT` error — "duplicate column `Id` in `unlabelled` declaration" — same wording pattern as the existing duplicate-header error, naming the declaration instead of the parsed header. |
| A declared name that is not a valid identifier (`unlabelled Id, "vCPU count"`) | `IMPORT` error — "declared column `<name>` is not a valid identifier" — reusing [§3](../visimark-design.md#3-document-model)'s identifier grammar, the same rule `labelled` and an ordinary header already apply. |
| `unlabelled` with an empty list (`unlabelled` with nothing after it) | `TYPE` error — "`unlabelled` needs at least one column name" — same shape as the existing `labelled`-needs-a-name error. |
| Both `labelled` and `unlabelled` present | `TYPE` error against the fence info string, per §2. |
| A headerless CSV's first row happens to look like a header (e.g. its first field reads `Id`) | No special-casing. It is read as an ordinary data row and its fields are ordinary cell values, subject to the same literal grammar as any other row ([§19](../visimark-design.md#19-declared-local-data-imports)'s cell-value rule) — VisiMark never guesses whether a row "looks like" a header (constraint 3, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)); that judgement is exactly what `labelled` vs. `unlabelled` exists to state explicitly. |
| `unlabelled` combined with `delimited <char>` | Unaffected — `delimited` only changes how a row is split into fields, orthogonal to whether row 1 is a header. |

## 4. Type rules and errors

| Code | New behaviour | Auto-fixable |
|---|---|---|
| `IMPORT` (existing, widened) | Declared-name/row-width arity mismatch on an `unlabelled` import (any row, not only the first); duplicate name in the `unlabelled` list; a declared name that is not a valid identifier. | No. |
| `TYPE` (existing, widened) | Both `labelled` and `unlabelled` present; either clause repeated; `unlabelled` with an empty name list. | No. |

Every other code from [§19](../visimark-design.md#19-declared-local-data-imports)'s
table (`STALE`, `SHEET`, `VECTOR`, `UNIT`) is unaffected — this feature only
changes how the header row is decided, not the stamp, the table-association
rule, the shape system, or unit consistency.

**Resolution order per imported sheet, `unlabelled` variant** (stops at the
first failure, per [§8](../visimark-design.md#8-evaluation)): fence-info
grammar (including the mutual-exclusivity check) → path gate → file exists →
stamp clause well-formed → stamp matches (if present) → CSV parses → declared
names have no duplicates → declared names are all valid identifiers → every
row's field count equals the declared-name count → per-binding column-rule
check. This mirrors the `labelled` order exactly, with "no duplicate headers
→ headers are valid identifiers → `labelled` matches" replaced by "declared
names have no duplicates → declared names are valid identifiers → row widths
match the declared count" — the checks move from the parsed header to the
declaration, since there is no header to check.

**Row-width validation is new only for `unlabelled`.** Today, a `labelled` or
unasserted import never validates that every data row has the same field
count as the header — a ragged row is silently accepted, each cell read
positionally as far as it goes. That existing behaviour is unchanged by this
spec; per-row arity checking is introduced for `unlabelled` alone, because it
is the only case with no header row to make row width self-evident, and the
issue's own acceptance criteria ask for it explicitly. Extending row-width
validation to `labelled`/unasserted imports is a separate, not-yet-proposed
change.

**Suppression.** Unchanged from [§19](../visimark-design.md#19-declared-local-data-imports):
a sheet whose import fails to resolve suppresses every binding that reads its
columns into one per-sheet `NOTE`.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)).** Unaffected. An
  `unlabelled` column is a vector exactly like a `labelled` one.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Unaffected beyond the new resolution-order steps in §4 above, which run in
  the same import-resolution phase that already runs before the dependency
  graph is built.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** Unaffected. The
  CSV file is still never written, under any flag; the `at sha256:` stamp is
  still the only part of the declaration `fmt` ever rewrites. `unlabelled`'s
  declared-name list is human-authored input syntax, exactly like `labelled`'s
  — `fmt` never touches either.
- **Anchors, name resolution ([§3](../visimark-design.md#3-document-model),
  [§6](../visimark-design.md#6-name-resolution-and-scoping)).** Unaffected.
  An `unlabelled` column resolves as `<sheet>.<name>` exactly as a `labelled`
  one does.
- **`check`.** Verifies the mutual-exclusivity rule, the declared-name
  duplicate/identifier checks, and the per-row arity check, in addition to
  everything it already verifies for an imported sheet.
- **`fmt`.** No new behaviour — still only ever touches the `at` clause.
- **`infer`.** Still never proposes a `from`, `delimited`, `labelled`, or
  (new) `unlabelled` clause — the presence of a headerless CSV next to a
  document is not evidence it should be imported, matching the existing rule
  for every other import clause.
- **`explain`.** The import summary gains a `mode` alongside the existing
  path/delimiter/stamp fields: `labelled`, `unlabelled`, or `unspecified`
  (neither clause present) — printed above the sheet's scalars and evaluation
  order, in the same position [§19](../visimark-design.md#19-declared-local-data-imports)
  already gives `labelled`; `explain --json`'s per-sheet `import` object gains
  the same `mode` field.
- **`eval --json`.** The per-sheet `import` object's existing `labels` field
  is populated from the `unlabelled` list exactly as it already is from
  `labelled` — both are "the declared names", the envelope does not
  distinguish their source beyond the new `mode` field above.
- **What does not change:** the shape system, name resolution, rounding and
  units, anchors, `assert`, `chart`, the splicer's one-line-diff discipline,
  and every existing finding code's meaning for in-document sheets or for a
  `labelled`/unasserted import.

## 6. Acceptance

A new committed fixture pair, mirroring the `labelled` fixture from #66 but
headerless — this is the concrete motivating document the pre-review found
missing from the issue:

`packages/visimark/test/fixtures/import/benchmark-headerless.csv`:

```csv
1,12.3
2,10.1
3,15.0
```

`packages/visimark/test/fixtures/import/benchmark-headerless.md`:

````markdown
```vmark #benchmark from benchmark-headerless.csv unlabelled Id, Time at sha256:<digest computed from the fixture file, filled in by the test setup>
Mean = AVG(benchmark.Time)
```
````

Required `visimark check` transcripts (clean case committed; every negative
variant generated in memory from it, matching the pattern in
`test/import-acceptance.test.ts`):

1. **Clean.** Against the fixture as committed: `0 problems (0 stale, 0
   errors)`. `Mean` evaluates to `11.2`, exactly as the `labelled` fixture's
   equivalent binding does.
2. **Too few names.** `unlabelled Id` against the three-field rows: one
   `IMPORT` finding naming row 1 and the count mismatch (declared 1, got 3),
   exit code `1`.
3. **Too many names.** `unlabelled Id, Time, Extra` against the two-field
   rows: one `IMPORT` finding naming row 1 and the count mismatch (declared
   3, got 2), exit code `1`.
4. **Ragged data.** `unlabelled Id, Time` (arity 2) against a fixture whose
   row 3 has three fields instead of two: one `IMPORT` finding naming row 3
   specifically (not row 1), exit code `1`.
5. **Duplicate declared name.** `unlabelled Id, Id`: one `IMPORT` finding,
   "duplicate column `Id` in `unlabelled` declaration", exit code `1`.
6. **Invalid declared identifier.** `unlabelled Id, "bad name"` (or any
   non-identifier token): one `IMPORT` finding naming the offending token,
   exit code `1`.
7. **Both clauses present.** `labelled Id, Time unlabelled Id, Time`: one
   `TYPE` finding against the fence info string, exit code `1`.
8. **`labelled` unaffected.** The existing `benchmark.{md,csv}` fixture's full
   transcript from `declared-local-data-imports-spec.md` §6 is unchanged —
   proving `unlabelled` adds no regression to the `labelled` path.

## 7. Non-goals

- **An ignored-column placeholder** (`unlabelled Id, Memory, _, Time`) —
  explicitly out of scope per the issue; every source column must be named.
  May be proposed separately if a real document needs it.
- **Auto-detecting whether a CSV has a header row.** Constraint 3
  ([§2](../visimark-design.md#2-constraints-that-shaped-the-design)): VisiMark
  never guesses; the author states `labelled` or `unlabelled` explicitly.
- **Extending per-row arity validation to `labelled`/unasserted imports.**
  Discussed in §4 and set aside: today's `labelled` behaviour is explicitly
  unchanged by this spec (the issue's own acceptance criteria ask for this);
  making ragged rows an error for every import is a separate, broader change
  a future issue would need to propose and motivate on its own.
- Everything [§19](../visimark-design.md#19-declared-local-data-imports)
  already lists as deferred (Git commit-reference stamps, non-CSV formats,
  computed columns on an imported sheet, an import performance budget) is
  unaffected and stays deferred.

## 8. Open questions

(none)
