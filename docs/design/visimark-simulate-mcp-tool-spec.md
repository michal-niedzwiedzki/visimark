# A `visimark_simulate` tool in `visimark-mcp` — feature spec

**Status:** approved (#330) · **Date:** 2026-10-19 · **Decision:** [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/330#issuecomment-6263341560)

Issue [#330](https://github.com/michal-niedzwiedzki/visimark/issues/330), the
follow-up that [`add-a-simulate-command-spec.md`](add-a-simulate-command-spec.md)
§9 left open. That spec stays a record of #259; this one supersedes its
"there is no `simulate` tool" sentence.

## 1. Purpose

An agent can run the sweep a document declares without a shell. Today it
shells out to `visimark simulate`, or calls `visimark_eval` once per scenario
(577 round trips for `docs/example-battery-storage.md`).

## 2. The surface

`visimark_simulate`, the seventh read tool. `readOnlyHint: true`,
`destructiveHint: false`, in `READ_TOOLS`.

| Argument | Type | Meaning |
|---|---|---|
| `path` or `content` | string | The document, as for the other read tools. Both or neither is `USAGE`; an unreadable `path` is `READ`. |
| `failOnFault` | boolean, default `false` | The twin of `--fail-on-fault`. |

One document per call. There is no `--progress` equivalent: the engine loop is
synchronous, so a progress notification could not be sent while it runs, and
`run` stays synchronous.

The server gains one launch flag, `--max-questions N` (a positive integer),
parsed before the transport starts, like `--allow-write`. It is the operator's
policy: not an environment variable and not a tool argument, so an agent
cannot raise it. Unset means no cap. The CLI keeps no cap.

## 3. The machine contract

The result is the existing envelope, with the CLI's lines as arrays. The lines
are for reading, not parsing. A per-report JSON shape is a separate decision,
filed when a caller needs one (#259 spec §9); `visimark simulate --json` stays a
refusal.

```json
{
  "command": "simulate",
  "visimark": "0.2.0",
  "status": "ok",
  "file": "docs/example-battery-storage.md",
  "stdout": ["==> docs/example-battery-storage.md <==", "#returns", "…"],
  "stderr": ["simulate: …: 577 questions (5 lattice params)", "simulate: …: 3 of 3 sheets ran"],
  "skipped": {}
}
```

- **`stdout`** is what the CLI prints to stdout for that file, line for line.
  The header is the path, or `<content>` for a draft.
- **`stderr`** is what the CLI prints to stderr, line for line, **without the
  elapsed time**: the summary line reads `N of S sheets ran`, with no `in T`.
  The time is the one part of the output that differs between two runs of the
  same text, and a result is a function of the document and the version
  (design constraint 4). Nothing on stdout carries a time.
- **`skipped`** is `visimark_check`'s key, for the same reason: a `content`
  document has no directory, so imports and charts cannot resolve. A report
  sheet that reads an imported value then cannot start in `content` mode; it
  prints `(cannot start)` and a `UNDEF` line on `stderr`, as a blocked sheet
  does anywhere. This was checked against `docs/example-invoice-csv-import.md`:
  `content` blocks the sheet with `UNDEF`, `path` runs it. It is a result, not
  a fault.
- **`status`** follows the CLI's exit code: `ok` for `0`, `problems` for `1`.
  Exit `1` is a document with no `report` statement, or, under `failOnFault`, a
  report sheet that could not start. Neither is ever `isError`.
- **Faults** (`isError: true`, status `error`) are the `2` class only: `USAGE`
  (both or neither of `path` and `content`, a non-boolean `failOnFault`),
  `READ`, and the new `LIMIT`.

### 3.1 `LIMIT`

A new MCP-layer fault code. When `--max-questions N` is set and the grid has
more than `N` questions (the base counts, as on the stderr count line), the
call is refused before any question runs:

```text
visimark: <label> has 577 questions, over this server's limit of 100 (--max-questions)
```

The refusal comes from the plan callback, which `simulate` calls before it
evaluates any question and which may throw. A document whose grid cannot be
built (a lattice finding) has `0` questions and is never refused.

## 4. One output function

The CLI's `cmdSimulate`, the playground's `pgSimulate` and this tool all
assemble the same stdout and stderr lines. They now call one engine function,
`simulateRun(source, label, options)`, in `packages/visimark/src/report/simulate-run.ts`,
exported from the `visimark` index. It returns `{ stdout, stderr, noReport, sheets, blocked }`.
The elapsed time comes in as an optional callback, so the CLI and the
playground pass it and this tool does not. No output byte of the CLI or the
playground changes.

`simulateRun` is a first-party helper that `visimark-mcp` needs, so it joins the
export list in `api-surface.test.ts` and is not added to
[`docs/library.md`](../library.md)'s supported list. `visimark-mcp` pins
`visimark` exactly, so the two ship together.

## 5. Behaviour table and acceptance

| # | Call | Result |
|---|---|---|
| 1 | `{ path: docs/example-battery-storage.md }` | `stdout` equals the CLI's lines; `stderr` equals the CLI's lines minus ` in T`; `status: ok` |
| 2 | `{ content }` of the #259 fixture `simulate.md` | the fixture's case 1 `stdout` with header `<content>`; `skipped: {}` |
| 3 | `{ path }` of a document with no `report` | `stdout: []`, `stderr: ["simulate: …: no report statement"]`, `status: problems` |
| 4 | a report sheet that cannot start | `(cannot start)` on stdout, the `cannot start` line on stderr, `status: ok` |
| 5 | case 4 with `failOnFault: true` | as case 4, `status: problems` |
| 6 | both `path` and `content`; neither | `USAGE` |
| 7 | an unreadable `path` | `READ` |
| 8 | `failOnFault: "yes"` | `USAGE` |
| 9 | `--max-questions 5`, a 10-question document | `LIMIT`, and no question was evaluated |
| 10 | `--max-questions 10`, the same document | runs (the limit is inclusive) |
| 11 | `--max-questions` unset | no cap |
| 12 | `--max-questions 0`, `abc`, or no value | the server exits `2` before the transport starts |
| 13 | `content` with a report sheet reading an imported value | that sheet cannot start with `UNDEF`; `skipped.imports` names the sheet |
| 14 | two calls on one text | identical results |
| 15 | `tools/list` | nine tools; `visimark_simulate` is `readOnlyHint: true`, `destructiveHint: false` |

The #259 spec §5 table's cases 1–12 each have an MCP twin: the same variant of
`simulate.md` is passed as `content`, and `stdout` is compared with the CLI's
for the same text. Cases 13–15 there are CLI argument errors with no twin. The
cap tests (9–12) run with the flag set; every other case runs with it unset.

## 6. Compatibility

No existing tool changes. `tools/list` returns nine tools, not eight. A host
that auto-approves every `readOnlyHint: true` tool now approves one whose cost
scales with the grid (about 3.5 ms a question, synchronously, so the server
answers nothing else while it runs); `--max-questions` is the operator's answer
to that. `docs/mcp.md` says so.

## 7. Documentation to update

- `packages/visimark-mcp/README.md`, `docs/mcp.md` (tools table, the "no
  `simulate` tool" paragraph, `--max-questions`, the `LIMIT` code),
  `docs/mcp-server.md` (the "except `simulate`" sentence, "eight tools" → nine,
  "six read tools" → seven, the chapter table), `skills/visimark/SKILL.md`
  and the bundled `packages/visimark-mcp/skill.md`.
- `docs/cli-reference.md` if it lists the MCP flags; `CHANGELOG.md` under
  `## Unreleased`.
- `docs/design/add-a-simulate-command-spec.md` §6 and §9 stay as they are.

## 8. Non-goals

- A per-report JSON shape, and `simulate --json`.
- Progress notifications, cancellation, or an async `run`.
- More than one document per call.
- A generated registry for the counts in prose (#350).

<!--vmark:no-formulas-->
