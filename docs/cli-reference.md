# VisiMark CLI reference

Everything the `visimark` command does, in one place. The narrative version is
in the [README](../README.md); this is the lookup table.

Install it with `bun add -g visimark` or `npm i -g visimark`, or run it
without installing with `npx visimark`. The installed command runs under
whichever of Bun or Node is on your PATH. From a clone,
`bun packages/visimark/src/cli/main.ts` runs the same CLI straight from source.

On Windows, `npx visimark` and `npm i -g visimark` work as elsewhere; npm's
global shim for the launcher invokes `sh`, so `sh` must be on PATH (Git Bash
and WSL provide it, plain PowerShell does not).

## Commands

| Command | What it does | Reads | Writes | Fails the run when |
|---|---|---|---|---|
| `visimark check FILE...` | Recomputes every formula and reports each number that no longer agrees with it | the files you name | nothing, ever | the document has at least one problem |
| `visimark fmt FILE...` | Repairs stale numbers in place, by splicing the bytes of each value it owns, and writes any stale or missing generated artifact | the files you name | computed cells and anchored values, in place; generated artifacts, whole | a problem it cannot repair remains |
| `visimark infer FILE...` | Works out which rules reproduce the numbers a document already has, and proposes them | the files you name | nothing, unless `--write` | never — it is advisory |
| `visimark eval FILE` | Prints the computed values, so a script can read one out | one file | nothing | never |
| `visimark explain FILE` | Prints each sheet's inputs, rules, evaluation order, assertions and charts | one file | nothing | never |

`check` is the one CI runs. The others exist to get a document into a state
`check` can be strict about, or to explain what it did.

`visimark --version` (also `-v` or `version`) prints `visimark <version>` and
exits `0`. `visimark --help` (also `-h` or `help`) prints the usage summary.

## Options

| Option | Command | What it does |
|---|---|---|
| `--fix-dates` | `fmt` | Also rewrites non-ISO dates that have only one reading. `15.10.2026` becomes `2026-10-15`; `11/12/2026` is left alone and still reported, because it is two different dates depending on who wrote it. |
| `--write` | `infer` | Inserts what it proposed: a `vmark` block after each table, an anchor after each matched figure, or the `no-formulas` marker if there was nothing to derive. It only ever inserts — no existing byte is rewritten. |
| `--get NAME` | `eval` | Prints one value instead of all of them. Takes `sheet.name` or a bare `name` when it is unambiguous. |
| `--json` | `check`, `fmt`, `infer`, `eval`, `explain` | Prints one JSON document on stdout instead of the human report. Default text is unchanged. Document quantities are decimal strings. The envelope is specified in [`design/structured-output-json-spec.md`](design/structured-output-json-spec.md). Unrecognised flags stay ignored, so `--jsonn` is not `--json`. |
| `#sheet` | `explain` | Limits the output to one sheet. Repeatable. |

Unrecognised options are ignored rather than treated as an error, so a
workflow that passes an option this version does not know about still runs.

## Exit codes

| Code | Meaning | When you get it |
|---|---|---|
| `0` | Nothing to fix | No problems were found. Advisory findings (`WARN`, `NOTE`) can still be printed — they are reported, not counted, and never change the exit code. |
| `1` | The document has problems | At least one stale value or error, from any of the files named. `check` and `fmt` return this; so does `eval` when an `assert` statement is false (the value is still printed first); `infer` and `explain` never do. |
| `2` | The command could not run | A missing or unreadable file, no file given at all, or an argument that names nothing — an unknown value for `eval --get`, an unknown sheet for `explain`. This means "your request did not make sense", not "your document is wrong". |

With several files the codes do not add up, and the worst one wins: a file that
could not be read outranks a document that was read and found wanting, because
an unanswered question is worse than a bad answer.

## Findings

Everything `check` can report. **Problem** findings are counted in the
`N problems` line and make the run fail; **advice** is printed and costs
nothing.

| Code | Class | What it means | How it gets fixed |
|---|---|---|---|
| `STALE` | problem | A stored number disagrees with the formula that owns it, or a generated artifact disagrees with the data it was drawn from — including one that is missing. The report shows both values and the formula, or names the artifact. | `visimark fmt` |
| `DATE` | problem | A date is not ISO 8601. Reported with the ISO reading when there is only one, or with both readings and the days between them when there are two. | `fmt --fix-dates` if unambiguous, otherwise by hand |
| `UNIT` | problem | One column means two things — mixed decoration such as `$5.00` beside `€5.00`, or a cell decorated on both sides. | by hand |
| `UNDEF` | problem | A formula names something that does not exist, with a spelling suggestion when one is close. | by hand |
| `DUP` | problem | The same name is bound twice in one scope. The first binding wins, which is why this is an error and not a silent overwrite. | by hand |
| `VECTOR` | problem | A column was used where a single value is required. The report names the aggregate that would fix it. | by hand |
| `CYCLE` | problem | Values depend on each other in a circle. The report prints the whole path round it. | by hand |
| `TYPE` | problem | An expression produced something that cannot go where it was asked to go — storing a boolean in a cell, or calling a function wrongly. | by hand |
| `SHEET` | problem | A `vmark` block's relationship to its table is broken: no table above it, or a table that belongs to something else — or the sheet id itself is not a valid identifier. | by hand |
| `ANCHOR` | problem | An anchor comment has no number in front of it to rewrite, an image anchor and a chart declaration do not match up, or the comment announces itself as an anchor (`<!--vmark=…-->`) but does not parse. | by hand |
| `ASSERT` | problem | An `assert` statement evaluated false. The report shows the expression and, below it, the same expression with each named value filled in. | by hand |
| `ARTIFACT` | problem | A declared artifact cannot be built or written — a pie of negative values or summing to zero, a blank or non-numeric series, an unknown chart type, a path outside the document's directory, or a target file VisiMark did not generate. | by hand |
| `COVERAGE` | problem | Either a table has no `vmark` rules anywhere in its document, so nothing in it is checked — or the document carries a `no-formulas` marker that its rules now contradict. | `visimark infer`, the marker, or deleting a marker that is no longer true |
| `WARN` | advice | Something is defined and never read. Often a typo in the name that reads it. | your call |
| `NOTE` | advice | Rows, assertions or charts that could not be verified because something they depend on is broken. It disappears when the real problem is fixed. | fix the finding above it |

## The no-formulas marker

```markdown
<!--vmark:no-formulas-->
```

A document with a table and no rules fails `check`, because a checker with
nothing to check would otherwise call it clean — the most misleading answer it
could give. When a document genuinely has nothing to derive, this marker says
so, and `check` accepts it.

- It has to be its own line, not indented and not inside a fenced block, so a
  marker shown in an example is documentation rather than a claim.
- `visimark infer --write` writes it for you when it finds nothing whatsoever.
  It refuses to when it found a near-miss or two rules it cannot choose
  between, because those mean the document does have arithmetic and wants a
  person to look at it.
- It is checked like anything else. Add rules to a marked document later and
  `check` reports the marker as wrong rather than trusting it.
- The rule it answers needs a table to be present, so prose is never asked for
  arithmetic it does not have, and it is counted across the whole document, so
  a reference table that really is all input passes as long as another table
  carries a rule.

<!--vmark:no-formulas-->
