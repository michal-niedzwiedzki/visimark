# VisiMark CLI reference

Everything the `visimark` command does, in one place. The narrative version is
in the [README](../README.md); this is the lookup table.

Install it with `npm install -g visimark`, or run it without installing with
`npx visimark`. From a clone, `bun packages/visimark/src/cli/main.ts` runs the
same CLI straight from source.

## Commands

| Command | What it does | Reads | Writes | Fails the run when |
|---|---|---|---|---|
| `visimark check FILE...` | Recomputes every formula and reports each number that no longer agrees with it | the files you name | nothing, ever | the document has at least one problem |
| `visimark fmt FILE...` | Repairs stale numbers in place, by splicing the bytes of each value it owns | the files you name | computed cells and anchored values, in place | a problem it cannot repair remains |
| `visimark infer FILE...` | Works out which rules reproduce the numbers a document already has, and proposes them | the files you name | nothing, unless `--write` | never — it is advisory |
| `visimark eval FILE` | Prints the computed values, so a script can read one out | one file | nothing | never |
| `visimark explain FILE` | Prints each sheet's inputs, rules and evaluation order | one file | nothing | never |

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
| `--json` | `eval` | Prints JSON instead of aligned text. |
| `#sheet` | `explain` | Limits the output to one sheet. Repeatable. |

Unrecognised options are ignored rather than treated as an error, so a
workflow that passes an option this version does not know about still runs.

## Exit codes

| Code | Meaning | When you get it |
|---|---|---|
| `0` | Nothing to fix | No problems were found. Advisory findings (`WARN`, `NOTE`) can still be printed — they are reported, not counted, and never change the exit code. |
| `1` | The document has problems | At least one stale value or error, from any of the files named. `check` and `fmt` return this; `infer`, `eval` and `explain` never do. |
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
| `STALE` | problem | A stored number disagrees with the formula that owns it. The report shows both, and the formula. | `visimark fmt` |
| `DATE` | problem | A date is not ISO 8601. Reported with the ISO reading when there is only one, or with both readings and the days between them when there are two. | `fmt --fix-dates` if unambiguous, otherwise by hand |
| `UNIT` | problem | One column means two things — mixed decoration such as `$5.00` beside `€5.00`, or a cell decorated on both sides. | by hand |
| `UNDEF` | problem | A formula names something that does not exist, with a spelling suggestion when one is close. | by hand |
| `DUP` | problem | The same name is bound twice in one scope. The first binding wins, which is why this is an error and not a silent overwrite. | by hand |
| `VECTOR` | problem | A column was used where a single value is required. The report names the aggregate that would fix it. | by hand |
| `CYCLE` | problem | Values depend on each other in a circle. The report prints the whole path round it. | by hand |
| `TYPE` | problem | An expression produced something that cannot go where it was asked to go — storing a boolean in a cell, or calling a function wrongly. | by hand |
| `SHEET` | problem | A `vmark` block's relationship to its table is broken: no table above it, or a table that belongs to something else. | by hand |
| `ANCHOR` | problem | An anchor comment has no number in front of it to rewrite. | by hand |
| `COVERAGE` | problem | Either a table has no `vmark` rules anywhere in its document, so nothing in it is checked — or the document carries a `no-formulas` marker that its rules now contradict. | `visimark infer`, the marker, or deleting a marker that is no longer true |
| `WARN` | advice | Something is defined and never read. Often a typo in the name that reads it. | your call |
| `NOTE` | advice | Rows that could not be verified because something they depend on is broken. It disappears when the real problem is fixed. | fix the finding above it |

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
