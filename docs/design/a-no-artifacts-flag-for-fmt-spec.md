# `fmt --no-artifacts` — feature spec

**Status:** approved (#168) · **Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/168#issuecomment-5785369119

## 1. Purpose

`fmt` writes two different kinds of thing. It splices bytes into the document it
was handed — computed cells, anchored values, import stamps — and it writes
whole SVG files at paths derived from that document, creating directories on the
way. The first is what a caller asks for when it names a file. The second is a
write the caller never named and, today, cannot decline.

The motivating case, quoted from the issue:

> `fmt` writing whole files at paths derived from the document is surprising to
> *any* caller that assumed it edits the file it was handed — a sandboxed build,
> a read-only checkout, a container with a mounted single file, a CI job that
> deliberately runs `fmt` to diff the result rather than to keep it.

It surfaced while designing the MCP server ([#169](https://github.com/michal-niedzwiedzki/visimark/issues/169)),
which makes the surprise sharper because the caller is an agent rather than a
person who read the reference table. The gap is in the CLI and the fix belongs
next to `--fix-dates`.

Nothing in the current surface reaches it. `--json` is explicitly not a dry-run
([`structured-output-json-spec.md` §3.3](structured-output-json-spec.md)); it
reports post-write facts. There is no `--dry-run`, and a `--dry-run` would be the
opposite of what is wanted here — see §8.

**What this flag does not do.** It declines the write. It does not touch the
verdict. A missing or stale artifact remains a `STALE` finding from `check`,
still counted, still exit `1`. A flag that did both would be a way to get
`0 problems` on a document whose committed chart contradicts its data — a green
check on an unverified artifact, which is the class of failure the finding
exists to prevent.

## 2. The surface

One boolean flag on one command:

```
visimark fmt FILE... [--fix-dates] [--no-artifacts] [--json]
```

| Property | Value |
|---|---|
| Spelling | `--no-artifacts`, exactly. No short form, matching `--fix-dates` and `--write`. |
| Kind | Flag; takes no value. `--no-artifacts=1` is refused by the existing `unknownOption` value-hint path. |
| Legal on | `fmt` only. |
| Refused on | `check`, `infer`, `eval`, `explain`, `ref` — `visimark: --no-artifacts is only valid with fmt`, exit `2`. |
| Composes with | `--fix-dates` and `--json`, in any order and in any position among the file arguments. |
| Usage line | `usage: visimark fmt FILE... [--fix-dates] [--no-artifacts]` |

This needs no new refusal machinery. `packages/visimark/src/cli/args.ts` already
drives refusals from one table; the entry

```ts
"--no-artifacts": { commands: ["fmt"], value: false },
```

produces the misplacement refusal, the no-value-allowed hint, and a
did-you-mean suggestion for a near miss (`closest(token, mine, 3)`) with no
further code. This is the mechanism
[`refuse-unrecognised-and-misplaced-cli-options-spec.md`](refuse-unrecognised-and-misplaced-cli-options-spec.md)
specifies, used as specified.

**Help and reference wording.** The flag must not read as "artifacts are
optional". Every place it is named carries the distinction between the write and
the verdict. The reference row reads:

> Declines the write of generated artifacts — the SVGs a `chart` statement
> declares. Every other repair is unaffected: computed cells, anchored values
> and import stamps are still spliced. It does not change what `check` reports:
> a missing or stale artifact is still `STALE`, still counted, still exit `1`.
> For a caller that must not touch files it did not name.

## 3. The machine contract

Exit codes are unchanged, and this is not a new decision — it is what the code
already does. `fmt()` computes its `unfixable` remainder by filtering
`FIXABLE_BY_FMT = new Set(["STALE"])` out of the findings
(`packages/visimark/src/write/fmt.ts`), and that filter runs before and
independently of the write loop in `cmdFmt`. A chart's `STALE` finding is
therefore already excluded from `unfixable` whether or not its SVG was written.

Verified on `docs/example-charts.md` copied to an empty directory, with all five
artifacts missing:

```
changed: false cells: 0 anchors: 0 artifacts: 5 unfixable: []
```

So `fmt --no-artifacts` returns `0`, and no exit-code logic changes. The
implementation adds a regression test pinning this, because it is load-bearing
and currently incidental.

| Condition | Exit | stdout | stderr |
|---|---|---|---|
| Every repair applied; artifacts declined | `0` | summary line, with `N artifacts skipped` | — |
| Nothing to repair; artifacts declined | `0` | `PATH: unchanged, N artifacts skipped` | — |
| An unfixable finding remains (e.g. `PRECISION`) | `1` | summary line, then the finding report | — |
| A named file cannot be read | `2` | — | `visimark: cannot read PATH` |
| `--no-artifacts` on any command but `fmt` | `2` | — | `visimark: --no-artifacts is only valid with fmt` |
| `--no-artifacts=1` on `fmt` | `2` | — | ``visimark: unknown option --no-artifacts=1 — `--no-artifacts` takes no value`` |

The `WRITE` refusal (exit `2`, per
[`structured-output-json-spec.md`](structured-output-json-spec.md) §"`fmt`
refuses to write a chart artifact") **cannot occur** under `--no-artifacts`: no
artifact target is opened, so no gate can refuse one. The document is spliced
normally rather than being left unspliced.

### `--json`

`artifacts[]` is empty and `summary.artifacts` is `0`, because nothing was
written and that array reports writes. To keep "no artifacts declared"
distinguishable from "artifacts declared and declined", a new count is added,
per-file and in the summary:

```json
{
  "command": "fmt",
  "visimark": "<version>",
  "status": "ok",
  "files": [
    {
      "path": "example-charts.md",
      "changed": false,
      "cellsUpdated": 0,
      "anchorsUpdated": 0,
      "datesFixed": 0,
      "artifacts": [],
      "artifactsSkipped": 5,
      "findings": []
    }
  ],
  "summary": {
    "files": 1,
    "filesChanged": 0,
    "cellsUpdated": 0,
    "anchorsUpdated": 0,
    "datesFixed": 0,
    "artifacts": 0,
    "artifactsSkipped": 5,
    "problems": 0,
    "stale": 0,
    "errors": 0
  }
}
```

`artifactsSkipped` is **always present** on a `fmt` envelope, `0` without the
flag, so a consumer sees one shape rather than two. This is additive: every key
an existing consumer reads keeps its meaning and its type.

The spec sentence that reads "writing only an artifact still lists that artifact
and counts it in `summary.artifacts`" gains the qualification that
`--no-artifacts` writes none, lists none, and reports them under
`artifactsSkipped` instead.

`check`'s `--json` shape, findings, counts and exit codes are untouched.

## 4. Behaviour table

Sessions are literal and were reproduced against the working tree. The fixtures
are real: `demo/` holds a copy of [`docs/example-charts.md`](../example-charts.md)
— the repository's only chart-bearing document, five `chart` statements across
two sheets — with its committed `charts/` directory present or absent as each
case states. `A` is that copy with `charts/` absent. `B` is that copy with
`charts/` present and `Jan`'s `Revenue` bumped `48200.00` → `50000.00`, which is
the issue's motivating case and makes three of the five charts stale.

| # | Case | Session |
|---|---|---|
| 1 | Artifacts only, declined (`A`) | `$ visimark fmt --no-artifacts example-charts.md`<br>`example-charts.md: unchanged, 5 artifacts skipped`<br>`$ echo $?` → `0`<br>`$ ls` → `example-charts.md` — no `charts/` created |
| 2 | Value repair plus declined artifacts (`B`) | `$ visimark fmt --no-artifacts example-charts.md`<br>`example-charts.md: updated 1 cell, 2 anchors, 3 artifacts skipped`<br>`$ echo $?` → `0`<br>The three stale SVGs are byte-identical to before. |
| 3 | `check` is unaffected (`A`) | `$ visimark check example-charts.md`<br>five `STALE … artifact missing at …` rows, then `5 problems (5 stale, 0 errors)`<br>`$ echo $?` → `1` |
| 4 | Default path unchanged (`B`) | `$ visimark fmt example-charts.md`<br>`example-charts.md: updated 1 cell, 2 anchors, 3 artifacts`<br>`$ echo $?` → `0` — today's output, byte-for-byte |
| 5 | Document with no charts | `$ visimark fmt --no-artifacts example-invoice.md`<br>`example-invoice.md: unchanged`<br>`$ echo $?` → `0` — no `artifacts skipped` clause, because none were declared |
| 6 | With `--fix-dates` | `$ visimark fmt --fix-dates --no-artifacts example-charts.md` (`B`)<br>`example-charts.md: updated 1 cell, 2 anchors, 3 artifacts skipped`<br>`$ echo $?` → `0` — the two flags are orthogonal |
| 7 | With `--json` (`A`) | `$ visimark fmt --no-artifacts --json example-charts.md`<br>the envelope in §3: `"artifacts": []`, `"artifactsSkipped": 5`, `"status": "ok"`<br>`$ echo $?` → `0` |
| 8 | `--json` without the flag (`B`) | `"artifacts": [{ "path": "charts/example-charts-sales.svg" }, …]` (3 entries), `"artifactsSkipped": 0`, `"summary.artifacts": 3` |
| 9 | An unfixable finding still exits 1 | A fixture carrying a `PRECISION` finding alongside a declared chart: the summary line with `N artifacts skipped`, then the `PRECISION` report.<br>`$ echo $?` → `1` — the flag never lowers an exit code |
| 10 | Misplaced on `check` | `$ visimark check --no-artifacts example-charts.md`<br>stderr: `visimark: --no-artifacts is only valid with fmt`<br>`$ echo $?` → `2` |
| 11 | Misplaced on `infer` | `$ visimark infer --no-artifacts example-charts.md`<br>stderr: `visimark: --no-artifacts is only valid with fmt`<br>`$ echo $?` → `2` |
| 12 | Given a value | `$ visimark fmt --no-artifacts=1 example-charts.md`<br>stderr: ``visimark: unknown option --no-artifacts=1 — `--no-artifacts` takes no value``<br>`$ echo $?` → `2`; the document is byte-identical and no artifact is written |
| 13 | Near miss suggests it | `$ visimark fmt --no-artifact example-charts.md`<br>stderr: ``visimark: unknown option --no-artifact — did you mean `--no-artifacts`?``<br>`$ echo $?` → `2` |
| 14 | Repeated flag | `$ visimark fmt --no-artifacts --no-artifacts example-charts.md` — accepted, same as one occurrence; `flags` is a `Set`, matching `--fix-dates` |

Rows 10, 12 and 13 were confirmed against the existing `--fix-dates` analogue,
which shares the code path exactly: `check docs/example-charts.md --fix-dates`
prints `visimark: --fix-dates is only valid with fmt`, `--fix-dates=1` prints
``unknown option --fix-dates=1 — `--fix-dates` takes no value``, and
`--fix-date` prints ``did you mean `--fix-dates`?`` — each exiting `2`.

This table doubles as acceptance.

## 5. Compatibility

No existing invocation changes behaviour. The flag is opt-in and the default
path is byte-for-byte what it is today.

| Surface | Before | After |
|---|---|---|
| `docs/ci.md` recipes (`visimark check`) | exit `0`/`1` on findings | Unchanged — `check` takes no part in this. |
| `.github/workflows/dogfood.yml` | runs `check` over the repo's documents | Unchanged. |
| The composite Action (`action.yml`) | `command: check|fmt`, `args:` passed through verbatim | Unchanged. `--no-artifacts` reaches `fmt` through `args` with no Action change; a pinned Action ref is unaffected. |
| `fmt --json` consumers | read `artifacts[]`, `summary.artifacts` | Unchanged in type and meaning. A new always-present `artifactsSkipped` key appears; a consumer that ignores unknown keys is unaffected. |
| The VS Code extension / LSP | no artifact-writing surface (no `planFmt` or `writeArtifact` caller under `editors/`) | Unchanged. No `editors/vscode/CHANGELOG.md` entry. |
| The playground | `VM.fmt(source, store.optsFor(current))` with `BrowserCheckOptions`; no filesystem, so no artifact is ever written | Unchanged. The new option is optional and the playground does not set it. |
| Documents under `docs/` | pass `check` | Unchanged — no document is touched and no default alters. |

No migration note is needed: nothing breaks.

## 6. Interaction with the rest of the tooling

**What changes:** `fmt`'s option set, its usage line, its human summary line
(only when artifacts are declined), and its `--json` envelope (one additive
key).

**What does not change:**

- `check`, `infer`, `eval`, `explain`, `ref` — no option, no output, no exit code.
- The `STALE` finding, its wording, and the `N problems` count in every command.
- The stdout/stderr split: summaries on stdout, refusals on stderr.
- Write-back ([§9](../visimark-design.md#9-write-back)): `fmt` still owns exactly
  computed cells, anchored values, import stamps, and generated artifacts. The
  flag removes the last from *this invocation*; it does not change ownership.
- The artifact path gate (`artifact/path.ts`) and the ownership re-proof in
  `artifact/write.ts` — both still govern every write that does happen.
- Import stamps. `--no-artifacts` names artifacts, and a stamp is not one; a
  `from rows.csv` re-stamp is a splice into the document and still happens.
- The release workflow, `docs/releasing.md`, the issue-review workflow.
- The language: no grammar, no evaluation, no finding, no design-doc §4–§10
  change. This is section F only.

## 7. Documentation to update

| File | What |
|---|---|
| `docs/cli-reference.md` | The Options table — a row beside `--fix-dates`, with the §2 wording. The per-command options table row: `fmt` \| `FILE...`, `--fix-dates`, `--no-artifacts`, `--json`. The `fmt` command row's **Writes** column, noting the write is declinable. |
| `docs/ci.md` §19 | "Charts are committed artifacts, not build output" gains the explicit counter-warning: the flag exists for a caller that must not touch files it did not name, and is **not** a way to stop committing charts — `check` still fails, and still should. |
| `docs/design/structured-output-json-spec.md` | §3.3 `fmt`: the `artifactsSkipped` key, per-file and in `summary`; the qualification to the "writing only an artifact still lists that artifact" sentence; `--no-artifacts` in the options discussion. |
| `docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md` | The per-command option table gains `--no-artifacts` on `fmt`; the refusal-examples table gains `check drift.md --no-artifacts`. |
| `skills/visimark/SKILL.md` | The "Running it" block (`visimark fmt FILE... [--fix-dates]`) grows the flag, with agent-facing guidance on when declining artifact writes is appropriate — and the reminder that it does not silence `check`. |
| `packages/visimark/src/cli/args.ts` | `USAGE.fmt` — the usage string is user-visible documentation. |
| `CHANGELOG.md` | `## Unreleased` → `### Added`. |
| `docs/vocabulary-catalogue.md` | The section F row moves into the Shipped register as `UNRELEASED`. |

Not affected, checked: `README.md`, `CONTRIBUTING.md`, `docs/issue-runbook.md`,
`docs/releasing.md`, `action.yml`, `.github/ISSUE_TEMPLATE/`,
`editors/vscode/CHANGELOG.md`, the tutorial.

## 8. Non-goals

- **Silencing the finding.** Rejected in the issue and reaffirmed here. The write
  and the verdict are separate concerns and this flag touches only the write.
- **A `--dry-run` on `fmt`.** A different feature, not a superset: `--dry-run`
  declines *all* writes including the value repairs, which is the opposite of the
  motivating case. Worth having eventually; it does not subsume this.
- **Deriving the behaviour from the environment** (skipping artifacts when the
  directory is unwritable). Refused by [§2](../visimark-design.md#2-constraints-that-shaped-the-design)
  constraint 4 — no ambient dependency.
- **A document-level opt-out** (a `<!--vmark:no-artifacts-->` marker). Whether a
  chart exists is a property of the document; whether *this invocation* writes
  files is a property of the caller.
- **The MCP server** ([#169](https://github.com/michal-niedzwiedzki/visimark/issues/169)).
  Separate issue; this flag is useful to callers that will never run one.
- **Declining a subset of artifacts** (by name or glob). All or nothing.
- **`--no-artifacts` on `check`.** `check` writes nothing; there is nothing to decline.

## 9. Open questions

None.
