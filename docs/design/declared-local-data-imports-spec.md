# Declared local data imports with integrity stamps — feature spec

**Status:** approved (#66) · **Date:** 2026-09-11 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/66#issuecomment-5626597963

## 1. Purpose

VisiMark documents currently carry their table data inline, as a GFM table
directly preceding a `vmark` block ([§3](../visimark-design.md#3-document-model)).
That works for human-authored tables, but a benchmark, measurement, or
exported-query sheet can run to tens of thousands of rows. Embedding a table
that large in Markdown makes the document unreadable and turns every data
refresh into a diff nobody can review line by line — exactly the failure mode
[§1](../visimark-design.md#1-purpose) exists to prevent.

This feature lets a sheet declare its table as a local file instead of an
inline GFM table:

```
```vmark #benchmark from benchmark.csv at sha256:9e107d9d372bb6826bd81d3542a419d6...
Mean = AVG(benchmark.Time)
P95  = MAX(benchmark.Time)
```
```

The large, machine-generated dataset stays a plain CSV file, independently
useful and independently diffable. The document keeps the computation and its
interpretation, and the dependency between the two is explicit in the
document's own text and mechanically verified by `check`.

**Repository shape:**

```
benchmark/
├── report.md
└── benchmark.csv
```

**What existing vocabulary already covers.** A cross-sheet reduce over a
foreign column is already legal
([§6](../visimark-design.md#6-name-resolution-and-scoping): "`SUM(schedule.Amount)`
is legal"), so this is not a gap in what the language can compute — it is a
gap in how large an input the format can carry, and in whether that input may
live outside the document. Nothing about reduces, scalars, or cross-sheet
resolution changes.

**Constraint 4 amendment.** [§2](../visimark-design.md#2-constraints-that-shaped-the-design)'s
fourth constraint currently reads "The meaning of a document depends only on
its own text and the version of `visimark` that reads it." This spec narrows
that gap deliberately rather than exempting itself from it. Constraint 4
becomes:

> 4. **The meaning of a document depends only on its own text, the version of
>    `visimark`, and the contents of explicitly declared local input files.**
>    An imported input is named by an explicit local path in the document —
>    never a URL, an environment variable, a configuration file, a plugin, the
>    clock, or the locale. A `from` clause may carry a `sha256:` content
>    digest; a locked import is valid only when the local file's bytes match
>    that digest exactly. An unlocked import is legal while authoring, but
>    causes `check` to fail. An imported file is input only: VisiMark never
>    writes it.

The distinction that keeps this a narrowing rather than a hole is **declared
local** versus **ambient**: `benchmark.csv` sitting beside `report.md` in the
same repository is an inspectable dependency two people checking out the same
commit both have; `https://example.com/latest.csv` is not, and stays refused.
No plugin point opens — an import brings in data, never code, so the
`visimark` version is still the only thing that decides what a document's
formulas *do*.

## 2. Syntax

The declaration lives entirely in the **fence info string** — the same string
that already carries the sheet id ([§3](../visimark-design.md#3-document-model),
confirmed empirically in [§16](../visimark-design.md#16-renderer-verification):
GitHub and remark both expose it as one string, `node.meta`). No new fence
type and no change to what renders: an import declaration is still an
ordinary ` ```vmark ` code block and prints as one everywhere GFM is rendered.

```
vmark #<id> from <path> [delimited <char>] [labelled <col>[, <col>]*] [at sha256:<digest>]
```

- `<id>` — unchanged: a valid identifier ([§3](../visimark-design.md#3-document-model)).
- `from <path>` — marks the sheet as an **imported sheet**. `<path>` is a bare,
  unquoted relative path (no `"` around it — a path is not a string literal in
  this grammar, matching the chart declaration's own bare-token conventions in
  [§18](../visimark-design.md#18-generated-artifacts)).
- `delimited <char>` — optional; `<char>` is exactly one printable ASCII
  character that is not a letter, a digit, `"`, `.`, `-`, or whitespace.
  Digits and letters are excluded because a delimiter drawn from a field's own
  alphabet silently corrupts every field containing it (`delimited 5` would
  split `125` into three fields) — the same refuse-rather-than-guess rule
  that produced the thousands-separator ban ([§7](../visimark-design.md#7-numeric-semantics)).
  A `delimited` clause whose character violates this is a `TYPE` error.
  Default delimiter is comma; the clause exists only to name a different one.
- `labelled <col>[, <col>]*` — optional; asserts the CSV header row, in order.
- `at sha256:<digest>` — optional while authoring; `<digest>` is exactly 64
  lowercase hex characters. No other prefix is recognised in v1.

**Clause order is fixed**: `from`, then `delimited`, then `labelled`, then
`at`. Any other order, a repeated clause, or an unrecognised trailing token is
a `TYPE` error against the fence info string — the same treatment
[§3](../visimark-design.md#3-document-model) already gives a malformed sheet
id, so a typo in the declaration is loud rather than silently discarded (the
pre-review's probe showed today's parser silently drops any unrecognised tail
of the info string; this closes that for the `from` keyword specifically).

**An imported sheet owns no GFM table.** The table-association rule in
[§3](../visimark-design.md#3-document-model) does not run for it: a `from`
block immediately preceded by a GFM table is a `SHEET` error ("an imported
sheet may not also own an inline table") — one source of column data per
sheet, never two.

**An imported sheet has no column rules.** Its columns come from the CSV
header row and are **read-only inputs**, exactly like an ordinary input
column, but with no table cell for a rule to ever write to. A binding in an
imported sheet's block whose name matches one of the CSV's header names is a
new `IMPORT` finding ("column rule on an imported sheet: `<name>` is a
read-only imported column"), not a column rule. Scalars, `assert`
([§17](../visimark-design.md#17-assertions)), and `chart`
([§18](../visimark-design.md#18-generated-artifacts)) are otherwise
unrestricted and read the imported columns exactly as they would read a
foreign sheet's columns via `SUM(benchmark.Time)` — a bare imported column
outside a reduce/chart operand position is still a `VECTOR` error, by the
existing shape rule ([§4](../visimark-design.md#4-syntax)).

**Path resolution and gate.** `<path>` resolves relative to the document's
own directory. It is gated exactly as [§18](../visimark-design.md#18-generated-artifacts)
gates a chart's output path: relative only, contained against its resolved
real path (no `..` traversal, no symlink escape out of the document's
directory tree), no control characters, no Windows device names. Unlike the
chart gate there is no extension-case rule keyed to VisiMark's own marker,
because VisiMark never writes this file — but the extension itself is
checked: only a lowercase `.csv` extension is recognised as CSV in v1. Any
gate violation, or an extension VisiMark does not recognise, is an `IMPORT`
error naming the problem.

## 3. Semantics

### 3.1 Stamp resolution

| Case | Behaviour |
|---|---|
| No `at` clause | Valid authoring syntax. `check` reports `IMPORT` — "unstamped import" — and fails. |
| `at sha256:<digest>`, file's SHA-256 matches | `check` passes this import. |
| `at sha256:<digest>`, file's SHA-256 differs | `check` reports `STALE` — "imported file does not match its recorded stamp" — with the recorded and actual digest, both printed in full (both are already public once committed, so truncating either buys no safety and only costs the reader a round trip to compute the actual one by hand). |
| `at <anything without a recognised prefix>` (e.g. `at 4ac91fe`, `at md5:...`) | `IMPORT` error — "unrecognised stamp prefix; only `sha256:` is supported" — never resolved as a Git reference in v1. |
| `at sha256:<not exactly 64 lowercase hex chars>` | `IMPORT` error — "malformed digest" — naming the defect (wrong length, uppercase hex, non-hex character). Constraint 3: no normalising uppercase to lowercase, no accepting an abbreviated digest. |
| Source file missing | `IMPORT` error — "imported file not found" — regardless of stamp state. |
| Source file present, path-gate violation | `IMPORT` error naming the gate rule broken. |

`fmt`'s behaviour on the stamp itself:

| Import as found | `fmt` writes |
|---|---|
| No `at` clause, file present and gate-clean | Adds `at sha256:<digest>` computed from the file's current raw bytes. |
| `at sha256:<digest>` present but stale (mismatch) | Rewrites the digest to match the current file — the same `STALE`-is-auto-fixed rule [§10](../visimark-design.md#10-error-taxonomy) already states for a computed cell or an artifact. |
| `at sha256:<digest>` present and current | No change (idempotent, per [§13](../visimark-design.md#13-testing)'s `fmt` idempotence property). |
| Any `IMPORT`-class problem (missing file, bad prefix, malformed digest, gate violation, unrecognised extension) | No change. `fmt` never repairs an `IMPORT` finding — only a human resolves those, the same way `fmt` repairs no `TYPE`, `UNDEF`, or other non-`STALE` code ([§10](../visimark-design.md#10-error-taxonomy)). |

The CSV file itself is never written, in any command, under any flag. There
is no equivalent of `--fix-dates` for imported data.

### 3.2 CSV parsing

Applies once the file has passed the path gate and (for `check`) the stamp
check.

| Aspect | Rule |
|---|---|
| Encoding | UTF-8. A leading UTF-8 BOM (`EF BB BF`) is stripped before parsing rows, but the digest in §3.1 is computed over the file's raw, un-stripped bytes — the stamp covers exactly what is on disk. |
| Newlines | Both `\n` and `\r\n` are accepted as a row terminator, and a file may not mix the two — a file containing both is a malformed-CSV `IMPORT` error ("mixed line endings"), the same refusal-over-guessing rule that produced the ISO-only date decision ([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 3). |
| Delimiter | Comma by default; the `delimited <char>` clause names a different one. The delimiter character may not appear unquoted inside a field. |
| Quoting | RFC 4180: a field may be enclosed in `"`; an embedded `"` is written `""`; a quoted field may contain the delimiter, a newline, or `"` literally. An unterminated quote is a malformed-CSV `IMPORT` error. |
| Header row | Row 1 is always the header. A CSV with zero data rows (header only) is a legal, empty imported sheet — every reduce over it behaves exactly as it does over an empty in-document column (`SUM` → `0`; `AVG`/`MIN`/`MAX` → `TYPE` error, per [§4](../visimark-design.md#4-syntax)). A file with no rows at all (not even a header) is an `IMPORT` error. |
| Duplicate header names | `IMPORT` error — "duplicate column `<name>` in imported header" — ambiguity is refused, never resolved by suffixing (constraint 3). |
| `labelled` mismatch | The parsed header, in order, is compared to the `labelled` list. Any difference — missing name, extra name, renamed, or reordered — is an `IMPORT` error printing the expected list and the actual header, in full, side by side. |
| Column name → identifier | A header cell must be a valid identifier ([§3](../visimark-design.md#3-document-model)'s sheet-id grammar, reused for column names) so it can be referenced as `<sheet>.<name>`; a header cell that is not is an `IMPORT` error naming the offending column, not silently dropped or renamed. |
| Cell value | Every field is parsed with exactly the literal grammar of [§4](../visimark-design.md#4-syntax)'s table: an ISO 8601 date, a decimal number (optionally unit-decorated per [§7](../visimark-design.md#7-numeric-semantics)), or — anything else, including an empty field — a string. No CSV-specific type inference is introduced; an imported cell is read exactly as an inline table cell already is. A non-ISO date-shaped field (`15/10/2026`) is therefore a plain string, not a `DATE` error — there is no column-level date-typing to trigger one, exactly as a stray date-shaped string in an ordinary input column is a string today. |
| Mixed types within one column | Allowed, exactly as it already is for an ordinary input column: nothing in the language enforces column-level typing except the derived `UNIT` consistency rule below. A reduce over a column holding both numbers and non-numbers (`AVG`, `SUM`, `MIN`, `MAX`) is a `TYPE` error at the point the reduce runs, naming the row. |
| Unit decoration | [§7](../visimark-design.md#7-numeric-semantics)'s column-consistency rule applies unchanged: every non-empty cell in an imported column must carry the identical decoration or none, else `UNIT`. |
| Precision | Unaffected. An imported column has no computed cells to write, so [§7](../visimark-design.md#7-numeric-semantics)'s column-precision inference never runs on it. A scalar derived from it (`Mean = AVG(benchmark.Time)`) still takes its write precision from its own anchor's current text, exactly as any scalar does today — nothing new is needed here. |

### 3.3 Worked example

Given `benchmark.csv`:

```csv
Id,Time
1,12.3
2,10.1
```

and:

````markdown
```vmark #benchmark from benchmark.csv labelled Id, Time at sha256:<digest of the file above>
Mean = AVG(benchmark.Time)
```
````

`check` passes. `AVG(benchmark.Time)` evaluates to `11.2`. Editing the CSV to
add a third row and running `check` again reports `STALE` on the import
(digest changed); running `fmt` rewrites the `at` clause to the new digest and
leaves `benchmark.csv` untouched.

## 4. Type rules and errors

| Code | New behaviour | Auto-fixable |
|---|---|---|
| `STALE` (existing, widened) | An `at sha256:` stamp present but not matching the file's current bytes. | Yes — `fmt` rewrites the digest. |
| `IMPORT` (new) | Unstamped import; unrecognised or malformed stamp prefix/digest; missing source file; path-gate violation; unrecognised file extension; malformed CSV (bad quoting, mixed line endings, zero rows); duplicate or non-identifier header name; `labelled` mismatch; a binding naming an imported column (attempted column rule on a read-only sheet). | No. |
| `SHEET` (existing, widened) | An imported (`from`) block immediately preceded by a GFM table (two table sources for one sheet). | No. |
| `TYPE` (existing, widened) | A malformed fence-info clause: wrong clause order, a repeated clause, or an unrecognised trailing token after the sheet id in a `from`-bearing info string. | No. |
| `VECTOR` (existing, unchanged) | A bare imported column outside a reduce/chart operand — same rule as any foreign column ([§6](../visimark-design.md#6-name-resolution-and-scoping)). | No. |
| `UNIT` (existing, unchanged) | Inconsistent decoration within one imported column. | No. |

**Resolution order per imported sheet** (stops at the first failure, so one
root cause yields one finding, per [§8](../visimark-design.md#8-evaluation)):
fence-info grammar → path gate → file exists → stamp clause well-formed →
stamp matches (if present) → CSV parses → header has no duplicates → header
is all valid identifiers → `labelled` matches (if present) → per-binding
column-rule check. A later step never runs once an earlier one has failed.

Static vs evaluation-time: the fence-info grammar (`from`/`delimited`/
`labelled`/`at` clause shape, `TYPE`) and the path gate (`IMPORT`) are checked
before any evaluation, exactly like arity ([§4](../visimark-design.md#4-syntax)).
Stamp verification and CSV parsing (`STALE`, the rest of `IMPORT`) happen once
per `check`/`fmt`/`eval` run, before the dependency graph is built, because
every binding in the sheet depends on the parse succeeding.

**Suppression.** A sheet whose import fails to resolve (any `IMPORT` or
`STALE` finding on the import itself) cannot evaluate any binding that reads
its columns. Every such binding is suppressed into one per-sheet `NOTE`
([§8](../visimark-design.md#8-evaluation)) — the same treatment an
unevaluable dependency already receives — rather than one `UNDEF`/`TYPE` per
binding that happened to reference the sheet.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)).** Unchanged. An
  imported column is a vector, consumed only by a reduce or a chart, exactly
  like a foreign column today. No new value type, no vector → vector.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Import resolution (path gate, stamp check, CSV parse) is a prerequisite step
  per sheet, run once, before that sheet's bindings enter the graph. A `check`
  or `eval` run reads and hashes every stamped import file on every
  invocation — there is no cache across runs in v1. This is the first case to
  test [§8](../visimark-design.md#8-evaluation)'s "single-digit milliseconds"
  reparse claim against a large input; no performance budget is committed to
  in this spec beyond "the acceptance fixture's `check` stays fast enough for
  interactive use" (see §6). A future incremental-hash cache is not
  precluded and is not designed here.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** §9 is amended.
  Its opening sentence currently reads "The tool owns exactly three things:
  computed cells, anchored values, and generated artifacts. Everything else …
  is human territory and is never touched." This is amended to add the
  read-side counterpart of that list, distinct from the three it *writes*:

  > A fourth category sits beside the three the tool writes: a **declared
  > input** — a file the document names in a `from` clause, that the tool
  > reads and never writes, and whose exact contents the document pins with a
  > stamp. The stamp itself (the `at sha256:<digest>` clause) is the one part
  > of a `from` declaration the tool owns and rewrites, exactly like a
  > computed cell; the file it names is never touched, under any flag.

  This keeps "everything else is human territory" true without exception: a
  declared input is not a silent fourth thing that falls through the
  sentence, it is named.
- **Anchors ([§3](../visimark-design.md#3-document-model)).** Unaffected. A
  scalar computed from an imported column anchors exactly as any scalar does.
- **Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)).**
  Unaffected. An imported sheet's columns resolve as `<sheet>.<column>` by the
  existing cross-sheet rule; a bare reference to one inside its own sheet's
  scalars resolves the same way a same-sheet column reference already does.
  Did-you-mean on an unresolvable name is unaffected.
- **`check`.** Verifies the fence-info grammar, the path gate, the stamp, and
  the CSV parse for every imported sheet, in addition to everything it already
  verifies.
- **`fmt`.** Adds or updates the `at sha256:` stamp per §3.1. Never rewrites
  the CSV, never rewrites `delimited`/`labelled`/`from`, and (per the
  existing splicer discipline, [§9](../visimark-design.md#9-write-back))
  touches only the byte span of the `at` clause in the fence info string —
  the rest of the document is untouched, so a stamp update is a one-line diff
  on the `.md` file plus whatever the CSV's own diff already was.
- **`infer`.** Never proposes a `from` clause, an import stamp, or a
  `delimited`/`labelled` clause — mirrors the existing rule that `infer`
  never proposes a `chart` ([§18](../visimark-design.md#18-generated-artifacts))
  or an `assert` ([§17](../visimark-design.md#17-assertions)): the presence of
  a CSV file next to a document is not evidence the author wants it imported.
- **`explain`.** Lists an imported sheet's source path, delimiter, label
  assertion (if any), and stamp state (matching / stale / unstamped / error),
  above its scalars and evaluation order — the same position `explain`
  already gives a chart's target and current state
  ([§18](../visimark-design.md#18-generated-artifacts)).
- **`eval --json`.** Each sheet's entry in the envelope gains an optional
  `import` object (`path`, `delimiter`, `labels`, `stamp`, `stampStatus`) when
  the sheet is a `from` sheet; absent otherwise. `values` for an imported
  sheet carries only its scalars, as today — imported columns are never
  echoed into the envelope (they can be arbitrarily large; the CSV file is
  the source of truth for them).
- **What does not change:** the shape system, name resolution, rounding,
  units, anchors, `assert`, `chart`, the splicer's one-line-diff discipline
  for the `.md` file, and every existing finding code's meaning for
  in-document sheets.

## 6. Acceptance

A new test fixture (not a normative `docs/` example — see the decided scope):
`packages/visimark/test/fixtures/import/benchmark.csv` and a companion
`benchmark.md` in the same directory.

`benchmark.csv`:

```csv
Id,Time
1,12.3
2,10.1
3,15.0
```

`benchmark.md`:

````markdown
```vmark #benchmark from benchmark.csv labelled Id, Time at sha256:<digest computed from the fixture file, filled in by the test setup>
Mean = AVG(benchmark.Time)
```
````

Required `visimark check` transcripts:

1. **Clean.** Against the fixture as committed (correct stamp): `0 problems
   (0 stale, 0 errors)`.
2. **Unstamped.** The same `.md` with the `at` clause removed: one `IMPORT`
   finding, "unstamped import", exit code `1`.
3. **Stale.** The same `.md` with the CSV's last row changed (stamp now
   stale): one `STALE` finding on the import, exit code `1`. Running `fmt`
   against this case rewrites only the `at` clause (byte-span diff, `.md`
   file otherwise unchanged) and leaves `benchmark.csv` byte-identical; a
   second `check` afterward is clean.
4. **Missing file.** `from` pointing at a nonexistent path: one `IMPORT`
   finding, "imported file not found", exit code `1`.
5. **`labelled` mismatch.** `labelled Id, Time, Extra` against the
   two-column fixture: one `IMPORT` finding printing both the expected and
   actual header lists, exit code `1`.
6. **Column rule attempted.** A binding `Time = 0` inside the `#benchmark`
   block: one `IMPORT` finding, "column rule on an imported sheet", exit code
   `1`.
7. **Path-gate violation.** `from ../../../etc/passwd`: one `IMPORT` finding
   naming the traversal, exit code `1`.
8. **`fmt` idempotence.** Running `fmt` twice in a row on the clean fixture
   produces no second change (property test, per
   [§13](../visimark-design.md#13-testing)).

## 7. Non-goals

- Network, environment-variable, configuration, or plugin-sourced imports —
  explicitly rejected by constraint 4 as amended; only an explicit local path
  is ever accepted.
- Git commit-reference stamps (`at <commitref>`) — not in v1. Discussed and
  set aside: a commit reference cannot name contents that are not yet
  committed (forcing two commits per data change, the first of which fails
  `check`), and resolving one needs a `.git` directory, a reachable object,
  and in practice a `git` binary — an ambient dependency the `sha256:` digest
  does not have. May be revisited if a satisfactory resolution scheme is
  found; not ruled out permanently.
- Any imported format other than CSV (TSV via `delimited` is CSV with a
  different delimiter, not a new format; JSON, Parquet, etc. are out of
  scope).
- Computed columns on an imported sheet, in any form, including a column held
  only in memory and never written anywhere. Discussed and set aside: the
  generator owns the CSV, so deriving a column from it is not VisiMark's job,
  and letting the same `name = expression` syntax write a cell in one context
  and nothing in another is one line readable two ways.
- Snapshotting or caching imported data anywhere (no sidecar file, no
  document-level metadata store). The stamp is an integrity lock, not a copy.
- Joining two sheets by key ([§14](../visimark-design.md#14-deferred),
  unrelated pre-existing deferral) — an imported sheet resolves and is
  referenced exactly like any other sheet; nothing about joins changes.
- A performance budget or caching strategy for very large imports beyond what
  §5 already states.

## 8. Open questions

(none)
