# Structured CLI output (`--json`) — feature spec

**Status:** approved (#60) · **Date:** 2026-09-10 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/60#issuecomment-5609768148

## 1. Purpose

VisiMark's CLI serves two audiences: a person reading a terminal, and a program
in CI or a script. The human report is aligned columns and prose
([`docs/cli-reference.md`](../cli-reference.md)). That is not an API. A CI job
that greps `STALE` or splits on spaces will break when the report is made more
readable.

`eval FILE --json` already exists ([§11](../visimark-design.md#11-cli)). This
spec makes that convention general: every document-oriented command accepts
`--json` and emits one deterministic JSON document describing that command's
result. Evaluation, writes, artifacts, and exit codes do not change.

Motivating case — CI and scripts, not a `vmark` document. Today:

```text
visimark check invoice.md --json
```

is ignored (unrecognised flags are ignored) and still prints the human
`0 problems` line. A consumer has to parse `formatCheck` output. `eval --json`
is a one-off flat map that collides with a binding named `assertions` or
`charts`. The worked example in
[`docs/example-executable-documentation.md`](../example-executable-documentation.md)
already does not match the implementation (nested sheet objects, JSON numbers).

Existing features do not reach it: the LSP already consumes engine findings, so
editors are not the consumer. CI shells out to the CLI and has only the text
report.

This is a tooling / process change, catalogued in
[`docs/vocabulary-catalogue.md`](../vocabulary-catalogue.md) **section F**. It
changes no document syntax, evaluation, finding set, or write-back.

## 2. CLI surface

`--json` is a boolean flag on the five document commands. It selects
serialization. It does not select files, sheets, or `--get` names.

```
visimark check   FILE... [--json]
visimark fmt     FILE... [--fix-dates] [--json]
visimark infer   FILE... [--write] [--json]
visimark eval    FILE [--get NAME] [--json]
visimark explain FILE [#sheet] [--json]
```

`--get` and `#sheet` still constrain the underlying command. They do not select
the format.

There is **no** public `--format` flag in this issue. Internally, a command
builds a result and a formatter renders it (`text` default, `json` when
`--json`). A later issue may add `--format yaml` and define `--json` as
shorthand; that is out of scope here. Unknown flags stay ignored, as
[`cli-reference.md`](../cli-reference.md) already states — so `--format yaml`
today remains “flag `format` ignored, word `yaml` treated as a file name.”

`--json` does not appear in any document. Constraint 1
([§2](../visimark-design.md#2-constraints-that-shaped-the-design)) is
untouched: GitHub, VS Code preview, Obsidian, and pandoc still render the
Markdown as they do now.

Default (no `--json`) text output is byte-stable against today's transcripts.

## 3. Semantics

**One JSON document on stdout.** Pretty-printed with `JSON.stringify(value, null, 2)`,
then one trailing newline (the CLI `out()` convention). No TTY detection. Not
JSONL. Stdout contains no other text.

**Deterministic and document-local.** The payload is command results plus the
engine version. No clock, locale, network, random ids, absolute filesystem
prefixes, or environment. Artifact paths are the path the document wrote, not
the absolute target `fmt` used internally.

**Shared envelope**, field order as written here:

| Field | Type | Present |
|---|---|---|
| `command` | `"check"` \| `"fmt"` \| `"infer"` \| `"eval"` \| `"explain"` | always |
| `visimark` | string, the package version (`0.1.1`), **not** the `visimark 0.1.1` `--version` line | always |
| `status` | `"ok"` \| `"problems"` \| `"error"` | always — exit 0 / 1 / 2. Not a boolean `ok`. |
| `error` | `{ "code": "USAGE" \| "READ", "message": string }` | only when `status` is `"error"` |
| command body | see below | always on success and on `problems`; on `error` only what was already produced (a multi-file run that read some files still lists them) |

`status` tracks the process exit code. Advisory findings (`WARN`, `NOTE`) never
turn `ok` into `problems` — same as today's exit contract.

**Values are decimal strings**, never JSON numbers
([§7](../visimark-design.md#7-numeric-semantics)). Dates are ISO strings
([§5](../visimark-design.md#5-dates)). `holds` on an assertion may be JSON
`true` / `false` / `null`. Column vectors are arrays of strings; an unevaluable
cell is `null`, not `"?"`.

**Empty arrays and objects that the schema names are present** (`[]`, `{}`),
not omitted, so a consumer can rely on the key.

**`--json` is a breaking change for `eval --json`.** The flat map of binding
names mixed with reserved `assertions` / `charts` keys is replaced by the
envelope below. `--get --json` uses the same envelope with one key under
`values`. Tests and
[`docs/example-executable-documentation.md`](../example-executable-documentation.md)
are updated in the implementation PR.

### 3.1 Findings

A public finding is **not** the internal `Finding` type. No source spans, no
parser nodes, no TypeScript field names.

```json
{
  "code": "STALE",
  "class": "problem",
  "location": {
    "file": "budget.md",
    "sheet": "costs",
    "name": "Total",
    "row": "pen"
  },
  "details": {
    "stored": "42.00",
    "computed": "43.00",
    "formula": "Price * Qty"
  }
}
```

| Field | Rule |
|---|---|
| `code` | [§10](../visimark-design.md#10-error-taxonomy) code, plus `COVERAGE` as in the CLI reference |
| `class` | `"problem"` if `STALE` or an [§10](../visimark-design.md#10-error-taxonomy) error code; `"advice"` for `WARN` and `NOTE` |
| `location.file` | the file this finding belongs to |
| `location.sheet` | `sheetId` when present; omitted otherwise |
| `location.name` | binding name when present; omitted otherwise |
| `location.row` | first-column row label when present; omitted otherwise |
| `details` | only the keys that apply (see below); values that are numbers in the document are **strings** |

`details` by code:

| Code | `details` keys |
|---|---|
| `STALE` (cell / anchor) | `stored`, `computed`, `formula` (formula omitted when there is none) |
| `STALE` (artifact) | `artifact` (document path), `message` |
| `STALE` (collapsed anchors) | `suppressedCount` (JSON number — a count, not a document value) |
| `DATE` | `raw`; `isoFix` when unambiguous; `altA`, `altB`, `daysApart` when ambiguous |
| `CYCLE` | `cyclePath` (array of binding ids) |
| `ASSERT` | `source` (the `assert …` line), `substituted` |
| `ARTIFACT` | `artifact`, `message` |
| `NOTE` | `message`; `suppressedCount` when it is a count |
| others (`UNIT`, `UNDEF`, `DUP`, `VECTOR`, `TYPE`, `SHEET`, `ANCHOR`, `COVERAGE`, `WARN`) | `message`; `suggestion` when `UNDEF` has a did-you-mean |

### 3.2 `check`

```json
{
  "command": "check",
  "visimark": "<version>",
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
```

Per-file `summary` uses the same counting as `formatCheck`'s footer: `STALE`
counts (collapsed-anchor groups use `suppressedCount`); other [§10](../visimark-design.md#10-error-taxonomy)
error codes count as `errors`; `problems = stale + errors`. Advice is in
`findings` with `class: "advice"` and does not increment `problems`.

Aggregate `summary` sums the per-file counts. `files` is the number of files
named on the command line that were examined (including ones that produced
`READ` errors, which appear as `{ "path": "…", "error": { "code": "READ", "message": "…" } }`
with no `findings`).

### 3.3 `fmt`

Reports **post-write facts**. `--json` is not a dry-run; `fmt` still splices
computed cells and anchors and writes artifacts
([§9](../visimark-design.md#9-write-back)).

```json
{
  "command": "fmt",
  "visimark": "<version>",
  "status": "problems",
  "files": [
    {
      "path": "drift.md",
      "changed": true,
      "cellsUpdated": 3,
      "anchorsUpdated": 1,
      "datesFixed": 0,
      "artifacts": [{ "path": "charts/cost.svg" }],
      "findings": []
    }
  ],
  "summary": {
    "files": 1,
    "filesChanged": 1,
    "cellsUpdated": 3,
    "anchorsUpdated": 1,
    "datesFixed": 0,
    "artifacts": 1,
    "problems": 0,
    "stale": 0,
    "errors": 0
  }
}
```

`findings` is the unfixable remainder (today printed after the `updated` /
`unchanged` line). `artifacts[].path` is the path the document named.
`changed` is true when the Markdown file was rewritten; writing only an
artifact still lists that artifact and counts it in `summary.artifacts`.

`--fix-dates` still rewrites unambiguous dates; `datesFixed` reports how many.

### 3.4 `infer`

```json
{
  "command": "infer",
  "visimark": "<version>",
  "status": "ok",
  "files": [
    {
      "path": "plain.md",
      "proposals": [
        {
          "kind": "column",
          "sheet": "order",
          "name": "Net",
          "rule": "Net = Price * Qty",
          "fits": 1,
          "rows": 1,
          "weak": false
        }
      ]
    }
  ],
  "summary": { "files": 1, "rules": 1, "scalars": 0, "anchors": 0 }
}
```

Public proposal fields: `kind`, `sheet`, `name`, `rule`, `fits`, `rows`,
`weak`. Optional: `reason`, `alternatives` (array of rule strings),
`disagreement` (`rowLabel`, `stored`, `computed` as strings). **No spans, no
stage numbers, no internal `tableSpan`.**

Without `--write`, there is no `written` key. With `--write`, each file that
was processed gains:

```json
"written": { "blocks": 1, "anchors": 0, "marker": false }
```

`marker: true` when the no-formulas marker was inserted. Counts are what was
actually written, which can be zero (`nothing to write` today). `infer` never
exits 1; `status` is `"ok"` unless a `USAGE`/`READ` error applies.

### 3.5 `eval`

**Breaks** the current flat map.

```json
{
  "command": "eval",
  "visimark": "<version>",
  "status": "ok",
  "file": "docs/example-invoice.md",
  "values": {
    "vat": "0.23",
    "lines.gross_total": "28659",
    "lines.Net": ["3600", "14080", "2500", "3120"]
  },
  "assertions": [
    {
      "sheet": "recon",
      "source": "assert variance == 0",
      "holds": true,
      "operands": { "variance": "0.00" },
      "substituted": "0.00 == 0"
    }
  ],
  "charts": []
}
```

| Key | Rule |
|---|---|
| `values` | scalars as decimal/ISO/string; columns as arrays of those or `null`. Keys are binding ids as today: document-scope unqualified (`vat`), otherwise `sheet.name`. |
| `assertions` | public objects: `sheet` (not `sheetId`), `source`, `holds` (`true` / `false` / `null`), `operands` (name → decimal string), `substituted` |
| `charts` | public objects: `sheet`, `name`, `engine`, `series`, `labels`, `path` (document path or `null`), `state`. **No `svg`, no absolute `target`.** |

`--get NAME --json` is the same envelope with `values` containing **one** key
(the name the user asked for, as they typed it, same as today's one-key object
key). `assertions` and `charts` still describe the whole document — a false
assertion anywhere still sets `status` to `"problems"` and exit 1, as today.

On a false assertion, **do not** also print the `ASSERT` block to stderr in
`--json` mode. The `assertions` array is the report. Text mode is unchanged
(value on stdout, `ASSERT` on stderr).

### 3.6 `explain`

```json
{
  "command": "explain",
  "visimark": "<version>",
  "status": "ok",
  "file": "docs/example-invoice.md",
  "documentScope": [{ "name": "vat", "rule": "0.23" }],
  "sheets": [
    {
      "id": "lines",
      "hasTable": true,
      "inputs": ["Item", "Price", "Qty"],
      "rules": [{ "name": "Net", "rule": "Price * Qty" }],
      "scalars": [{ "name": "net_total", "rule": "SUM(Net)" }],
      "order": ["Net", "net_total", "vat_total", "gross_total"],
      "assertions": [],
      "charts": []
    }
  ]
}
```

`rule` is the expression source text as `explain` already prints (including
`Σ` / `∑` as written, not rewritten to `SUM`). `assertions` entries are the
source with the `assert ` prefix stripped, matching the text report.
`#sheet` arguments still filter `sheets`. `documentScope` is `[]` when empty.

### 3.7 Behaviour table

| Case | Result |
|---|---|
| `check invoice.md --json`, clean | `status: "ok"`, empty `findings`, exit 0 |
| `check drift.md --json`, stale + errors | `status: "problems"`, findings listed, exit 1 |
| `check clean.md --json`, only `WARN` | `status: "ok"`, advice in `findings`, exit 0 |
| `check a.md b.md --json` | one document, `files` length 2, aggregate `summary`, worst exit code |
| `check a.md missing.md --json` | `missing.md` is `{ "path", "error": { "code": "READ", "message" } }`; `a.md` still listed; `status: "error"`; exit 2 |
| `check --json` (no files) | envelope with `status: "error"`, `error.code: "USAGE"`; usage line on stderr; exit 2 |
| `fmt file.md --json`, unchanged | `changed: false`, exit 0 if nothing unfixable |
| `fmt file.md --json`, writes cells | `changed: true`, counts set, file on disk updated as today |
| `infer file.md --json` | proposals only, no `written` |
| `infer file.md --write --json` | proposals plus `written` |
| `eval file.md --json` | envelope in §3.5; **not** the old flat map |
| `eval file.md --get lines.gross_total --json` | `values` has that one key; exit 1 if any assertion failed |
| `eval file.md --get nope --json` | `status: "error"`, `error.code: "USAGE"`; `visimark: no value named nope` on stderr; exit 2 |
| `eval assert-fail.md --json` | `status: "problems"`, `holds: false` in `assertions`; **no** ASSERT text on stderr; exit 1 |
| `explain file.md --json` | envelope in §3.6; exit 0 |
| `explain file.md #nope --json` | `status: "error"`, `error.code: "USAGE"`; exit 2 |
| `check file.md --jsonn` | unknown flag ignored; human text (no `--json`) |
| `eval` / `explain` extra files after the first | ignored as today; JSON describes the first file |

## 4. Errors

No new [§10](../visimark-design.md#10-error-taxonomy) finding. Document problems
stay `STALE` / `DATE` / … and appear in `findings`. Command-level failures use
the envelope `error` object:

| Situation | `error.code` | Exit | Notes |
|---|---|---|---|
| No file given; unknown `eval --get` name; unknown `explain` `#sheet` | `USAGE` | 2 | Same cases as today's usage errors. `message` is the current `visimark: …` / `usage: …` line. That line is **also** written to stderr so a person who typed it still sees it. |
| Named file cannot be read | `READ` | 2 | Per-file in multi-file commands; whole-command for `eval` / `explain`. |
| Unknown command / no command | n/a | 2 | Happens before a document command runs. `--json` is not a command. Human usage text, as today. |

`--json` mode still emits the JSON envelope to stdout **before** exiting 2,
whenever a document command was selected and `--json` was asked for.

Suppression ([§8](../visimark-design.md#8-evaluation)): JSON lists the same
findings the text report does. A suppressed assertion is a `NOTE`, not an
`ASSERT` with `holds: null` plus a finding — `holds: null` appears on the
`eval` `assertions` array; `check` reports the `NOTE`.

## 5. Interaction with the rest of the language

| Area | Effect |
|---|---|
| Shape system ([§4](../visimark-design.md#4-syntax)) | Unchanged. |
| Evaluation / graph ([§8](../visimark-design.md#8-evaluation)) | Unchanged. `--json` runs after the command has its result. |
| Write-back ([§9](../visimark-design.md#9-write-back)) | Unchanged. `fmt --json` still writes only computed cells, anchors, and generated artifacts. JSON is not a writer. |
| Anchors ([§3](../visimark-design.md#3-document-model)) | Unchanged. |
| Name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)) | Unchanged. `eval --get` resolution is the same; only the serialization changes. |
| Dates ([§5](../visimark-design.md#5-dates)), units, precision ([§7](../visimark-design.md#7-numeric-semantics)) | Unchanged in the engine. JSON must not reintroduce binary float: document numbers are strings. |
| `check` / `fmt` / `infer` / `explain` / `eval` | Same work as today; an extra formatter at the end. |
| `infer` | Does not propose anything new. `--json` only describes proposals (and writes, with `--write`). |
| LSP / VS Code | Unchanged. Editors use the engine and LSP, not CLI JSON. No `editors/vscode/CHANGELOG.md` line. |
| Plugin architecture | A formatter inside the CLI is not a document plugin. Documents cannot select it. |

**Does not change:** document syntax, the finding taxonomy, splicer behaviour,
ignore-unknown-flags, exit-code meanings, default text transcripts.

**Does change:** [§11](../visimark-design.md#11-cli) lists `--json` only on
`eval`. It must list `--json` on all five document commands and point at this
spec (or a short paragraph) for the envelope. [`docs/cli-reference.md`](../cli-reference.md)
options table: `--json` applies to all five, not only `eval`.

## 6. Acceptance

[§13](../visimark-design.md#13-testing)-style. Parse the stdout as JSON; do not
snapshot pretty-print whitespace beyond “valid JSON, indent 2, trailing
newline.” Compare on the parsed object. `visimark` equals
`packages/visimark/package.json` `"version"`.

**Clean `check`.** `visimark check docs/example-invoice.md --json` exits 0;
parsed object has `command === "check"`, `status === "ok"`, one file, empty
`findings`, `summary.problems === 0`. Stdout parses as a single JSON value;
stderr is empty.

**Problems `check`.** `visimark check docs/example-invoice-drift.md --json`
exits 1; `status === "problems"`; some finding has `code === "STALE"` and
`class === "problem"`; `details.stored` and `details.computed` are strings.

**Advice only.** A document whose only finding is `WARN` exits 0 with
`status === "ok"` and that finding `class === "advice"`.

**`eval` envelope (breaking).** `visimark eval docs/example-invoice.md --json`
exits 0. Top-level keys include `command`, `visimark`, `status`, `file`,
`values`, `assertions`, `charts` — **not** a top-level `"vat"` next to
`"assertions"`. `values.vat === "0.23"`. `values["lines.Net"]` is an array of
four strings. `assertions[0].holds === true`. `values["lines.gross_total"] === "28659"`
(string). No JSON number appears as a document quantity.

**`eval --get`.** `visimark eval docs/example-invoice.md --get lines.gross_total --json`
→ `values` has exactly one key, `"lines.gross_total"`, value `"28659"`.

**False assertion.** `visimark eval <assert-fail fixture> --json` exits 1;
`status === "problems"`; an assertion has `holds === false`; stderr does **not**
contain `ASSERT`.

**Unknown `--get`.** exits 2; stdout is JSON with `status === "error"`,
`error.code === "USAGE"`; stderr contains `no value named`.

**`fmt` post-write.** Copy the drift example to a temp file; `fmt --json` on it
exits 1 (unfixable remain); `files[0].changed === true`; `cellsUpdated > 0`;
the file on disk has changed as today; a second `fmt --json` reports
`changed === false`.

**`infer --write`.** On a table with no rules, `--json --write` has
`written.marker === true` (or `written.blocks > 0` when rules were inserted)
and the file on disk matches today's `--write` behaviour.

**`explain`.** `visimark explain docs/example-invoice.md --json` exits 0;
`sheets` contains `id: "schedule"` with a `rules` entry whose `rule` text
matches the text report; `Σ` fixtures still echo the glyph, not `SUM`.

**Default text unchanged.** Existing CLI transcript tests without `--json`
stay green, including `eval --get` raw decimal, `check` on the drift invoice,
and `eval` ASSERT-on-stderr in text mode.

**Unit coverage:** each command's `--json` on success, on document problems,
and on `USAGE`/`READ`; multi-file `check` with one unreadable file; `--get --json`;
false-assertion `eval --json` with quiet stderr; decimal strings (never JSON
numbers) on a value like `0.23`; column array with a `null` cell; `fmt` unchanged
vs changed; `infer` with and without `--write`; pretty-print indent 2; no
non-JSON on stdout; ignore of `--jsonn`.

## 7. Non-goals

- **`--format` / YAML / a second public format.** Internal formatter split
  only. A later issue adds the flag.
- **JSON Schema file / `$schema` URL / `"schema": 1`.** The engine version is
  the compatibility signal until a later break needs a schema version.
- **Source spans in CLI JSON.** Editors use the LSP.
- **Dumping internal `Finding`, `Proposal`, AST, or edit objects.**
- **JSON numbers for document quantities.** Rejected ([§7](../visimark-design.md#7-numeric-semantics)).
- **Keeping today's flat `eval --json` as a frozen exception.** Rejected
  (constraint 3 collision; two schemas).
- **TTY-based compact vs pretty.** Rejected (constraint 4).
- **`--json` on `--version` / `--help` / unknown commands.**
- **Changing ignore-unknown-flags.**
- **LSP / VS Code diagnostics via this JSON.** Out of scope; already a
  different path.
- **Dry-run `fmt`.** `--json` does not mean “don't write.”

## 8. Open questions

None. Resolved in the #60 review discussion:

- Break `eval --json` once; values under `values`; `--get` uses the same envelope.
- Public CLI is `--json` only; no `--format` in this issue.
- Shared `command` / `visimark` / `status`; `status` is `"ok"` / `"problems"` /
  `"error"`, not a boolean.
- Exit 2 still emits JSON on stdout when `--json` was asked for; human usage
  on stderr.
- One JSON document, per-file array plus aggregate; indent 2 always.
- Decimal strings; dates ISO; `holds` may be boolean; columns are arrays;
  unevaluable cells `null`.
- `fmt` / `infer --write` report post-write facts, not edit objects.
