# Protect your Markdown numbers with CI

**From a document nobody checks to a build that refuses a wrong number.**

This guide is about one job: making a machine read your documents on every
commit, and stopping a merge when the arithmetic in them stops adding up.

It is written for people who know Git and have used a CI system once or twice.
You do not need to know VisiMark well. Chapter 4 gets you a working document in
a few minutes, and [`tutorial.md`](tutorial.md) is there when you want the
language itself.

The language is kept simple on purpose, so that it reads the same way for
everyone.

Every `visimark` output here is a real transcript, captured with
`visimark 0.1.5`. Nothing is invented.

## How to read this

There are 26 short chapters in seven parts. Parts 1 and 2 are the whole job:
read those two and you have a working check. The rest answers the questions that
turn up afterwards.

| Part | Chapters | What you get |
|---|---|---|
| 1. Why a build should read your documents | 1–3 | The case, and the contract |
| 2. The five-minute setup | 4–8 | A check that blocks a bad merge |
| 3. Choosing what to check | 9–12 | Globs, coverage, pinning |
| 4. Making a failure useful | 13–16 | Logs, annotations, summaries |
| 5. Patterns that come up | 17–20 | `fmt`, artifacts, reading values |
| 6. Other runners | 21–23 | Plain `npx`, GitLab, Git hooks |
| 7. Rolling it out | 24–26 | Adoption, troubleshooting, a checklist |

The Action is published on the GitHub Marketplace as
[VisiMark check](https://github.com/marketplace/actions/visimark-check). If all
you want is the copy-paste block, it is in chapter 5.

---

# Part 1 — Why a build should read your documents

## 1. The edit that nobody catches

Here is a pull request. One line changed.

```diff
-| Team       |    45 |   79.00 |  948.00 |
+| Team       |    45 |   89.00 |  948.00 |
```

Somebody raised a price by ten. The diff is two characters. It is obviously
correct, so it gets approved in eleven seconds.

It is wrong. `Annual` should now be `1068.00`, and the yearly total further down
the page should move with it. Neither did.

Look at what did **not** happen:

- The file still renders perfectly on GitHub.
- The Markdown preview shows a clean table.
- The test suite passed, because no test knows this file exists.
- The reviewer read a plausible number and approved it.
- The linter was happy. Nothing in a Markdown linter has an opinion about
  arithmetic.

Every guard rail your repository has was designed for code. A document full of
numbers passes through all of them untouched. The only thing standing between a
wrong price and a customer is whether a human happened to multiply in their
head.

That is what this guide replaces.

### Why now

Quotes, invoices, budgets, estimates and capacity plans are increasingly written
in Markdown and kept in Git, because text reviews well. At the same time, a
growing share of them is drafted by AI agents, which are reliable at writing
`Annual = Monthly * 12` and unreliable at working out that `89 * 12` is `1068`.

So the volume of arithmetic going through pull requests is rising, and the
amount of it that anybody verifies is not.

## 2. What `check` proves, and what it does not

`visimark check` recomputes every value a document says is derived, and compares
the result against what the file actually says. It writes nothing. It reads the
document and exits.

**It proves that the document agrees with itself.** Every number that follows
from another number was recomputed from the inputs, and matched.

**It does not prove the inputs are right.** If somebody types the wrong price,
`check` will happily verify every figure that follows from the wrong price. That
is a human question and it stays a human question — which is exactly why review
gets easier: reviewers can stop checking arithmetic and start checking inputs.

**It does not prove your document is wired up at all.** A document with no
formulas has nothing to disagree with. Chapter 4 is entirely about this, and it
is the one thing people get wrong when they adopt a checker.

Everything in the rest of this guide is plumbing around those three sentences.

## 3. The three exit codes

This is the whole contract with CI. Learn it now and most of the rest follows.

| Code | Meaning | What CI should do |
|---|---|---|
| `0` | Nothing to fix. | Pass. |
| `1` | The document has problems. | **Fail the build.** |
| `2` | The command could not run — a missing file, no file given, a name that does not exist. | Fail the build, but read it as "the workflow is wrong", not "the document is wrong". |

With several files, the worst code wins.

The distinction between `1` and `2` matters more than it looks. A `1` means a
person should read a document. A `2` means a person should read the **workflow
file** — you pointed the tool at something that is not there. A CI setup that
treats them the same will one day report a green-turned-red build as a document
problem when the real cause is a renamed directory.

```console
$ visimark check docs/pricing.md
docs/pricing.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

```console
$ visimark check docs/nope.md
visimark: cannot read docs/nope.md
$ echo $?
2
```

---

# Part 2 — The five-minute setup

## 4. Before CI: make one document honest

Do not start with the workflow file. Start with one document, on your own
machine, and prove it is really checked. A check you have not tested is a green
tick that means nothing, and that is worse than no check at all.

Here is a small document. Save it as `docs/pricing.md`.

````markdown
# Hosting plan pricing

| Plan       | Seats | Monthly |  Annual |
|------------|------:|--------:|--------:|
| Starter    |    10 |   29.00 |  348.00 |
| Team       |    45 |   79.00 |  948.00 |
| Enterprise |   120 |  199.00 | 2388.00 |

```vmark #plans
Annual = Monthly * 12

seats_total  = SUM(Seats)
annual_total = SUM(Annual)
```

Across **175**<!--vmark=plans.seats_total--> seats the list price comes to
**3684.00**<!--vmark=plans.annual_total--> per year.
````

Three things are going on, and chapters 2 and 9 of the tutorial explain them
properly:

- The fenced `vmark` block holds the formulas for the table just above it.
  `#plans` is the sheet name.
- `Annual = Monthly * 12` is **one rule for every row**, not three formulas.
- `<!--vmark=plans.annual_total-->` is an invisible HTML comment that binds the
  bold number in front of it to a computed value. It does not show up on GitHub,
  in a preview, or in a PDF.

It checks clean:

```console
$ visimark check docs/pricing.md
docs/pricing.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

### Now break it on purpose

**This is the step people skip, and it is the only one that proves anything.**

Change an input — the Team price, from `79.00` to `89.00` — and change nothing
else:

```console
$ visimark check docs/pricing.md
docs/pricing.md

  STALE   plans.Annual    · Team                     948.00 ≠ 1068.00    Monthly * 12
  STALE   plans.annual_total                        3684.00 ≠ 3804.00    SUM(Annual)
  STALE   1 prose anchors bound to the values above

  3 problems (3 stale, 0 errors)
$ echo $?
1
```

One input moved and three things objected: the cell, the total, and the sentence
in the prose. That is a wired-up document.

If `check` had still said `0 problems` after that edit, nothing in the file is
connected, and putting it into CI would buy you a green tick and no safety.

Put the input back, or run `visimark fmt docs/pricing.md` to accept the new
numbers, and move on.

**Do this once for every document you add to the check.** It takes ten seconds.

## 5. The workflow file

Create `.github/workflows/visimark.yml`:

```yaml
name: visimark

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@v0.1.5
        with:
          files: "docs/**/*.md"
```

That is the whole setup. Commit it, push it, and every pull request from now on
recomputes the arithmetic in `docs/`.

Four things worth knowing about that file:

**You do not need `actions/setup-node`.** The Action is a composite action, and
installing Node is its first step. Adding your own is harmless but pointless.

**`permissions: contents: read` is enough.** `check` is read-only. It does not
push, comment, or create anything. Give it nothing else, and a compromised
dependency in this job can do nothing to your repository.

**`push` is restricted to one branch on purpose.** With a bare
`on: [push, pull_request]`, every commit on a pull-request branch runs the
workflow twice — once for the push and once for the PR. Restricting `push` to
your default branch keeps the merge-commit run and drops the duplicate.

**The version is pinned twice over.** `@v0.1.5` pins the Action, and the Action
pins the engine it installs. Chapter 12 goes into why that matters.

### The inputs

| Input | Default | What it is |
|---|---|---|
| `files` | `**/*.md` | Space-separated glob(s) of Markdown files to check |
| `command` | `check` | `check` or `fmt` |
| `args` | *(empty)* | Extra flags for the command; each must be valid for `command`, for example `--fix-dates` for `fmt` |
| `version` | the release this Action ref ships | npm version or dist-tag of the engine to install |

There is no strictness dial, no config file and no rule set to choose. Pointing
it at a glob is the entire configuration surface, and that is deliberate: a
document's numbers depend on its own text and the version of VisiMark reading
it, and on nothing else.

## 6. Watch it fail on a real pull request

Now do the thing from chapter 4, but in a branch, and let CI find it.

```console
$ git switch -c raise-team-price
$ sed -i 's/|   79.00 |/|   89.00 |/' docs/pricing.md
$ git commit -am "pricing: raise the Team plan to 89"
$ git push -u origin raise-team-price
```

Open the pull request. The `check` job goes red, and the log holds exactly what
you saw on your own machine:

```console
Run michal-niedzwiedzki/visimark@v0.1.5
docs/pricing.md

  STALE   plans.Annual    · Team                     948.00 ≠ 1068.00    Monthly * 12
  STALE   plans.annual_total                        3684.00 ≠ 3804.00    SUM(Annual)
  STALE   1 prose anchors bound to the values above

  3 problems (3 stale, 0 errors)
Error: Process completed with exit code 1.
```

Read one of those lines, because the shape is fixed:

```
  STALE   plans.Annual    · Team                     948.00 ≠ 1068.00    Monthly * 12
  ─────   ────────────      ────                     ───────────────     ────────────
  code    what it is        which row                stored ≠ correct    the rule
```

- **code** — the kind of problem. Chapter 13 lists them all.
- **what it is** — `sheet.name`.
- **which row** — the first cell of that row, so you can find it.
- **stored ≠ correct** — what the file says, then what the formula says.
- **the rule** — the formula that owns the number.

A reviewer who opens this log does not have to work anything out. The file says
`948.00`, the formula says `1068.00`, and the formula is `Monthly * 12`.

## 7. Fix the failure

There are only ever two answers, and the finding tells you which one you are in.

**The input was right and the derived numbers are stale.** Run the formatter and
push:

```console
$ visimark fmt docs/pricing.md
docs/pricing.md: updated 1 cell, 1 anchor
$ visimark check docs/pricing.md
docs/pricing.md

  0 problems (0 stale, 0 errors)
```

`fmt` writes only the values it owns — computed cells and anchored numbers. Your
prose, your headings and every input column are untouched. It does not re-render
the Markdown, so the diff is small and reviewable:

```diff
-| Team       |    45 |   89.00 |  948.00 |
+| Team       |    45 |   89.00 |  1068.00 |

 Across **175**<!--vmark=plans.seats_total--> seats the list price comes to
-**3684.00**<!--vmark=plans.annual_total--> per year.
+**3804.00**<!--vmark=plans.annual_total--> per year.
```

**That diff is the propagation.** One input moved, and you can see everything
that depends on it move with it. A reviewer can now ask the only question worth
asking: did the right things move?

One cosmetic note: `1068.00` is wider than `948.00`, and `fmt` does not re-pad
the table, because the padding is yours. Re-align by hand when it bothers you,
or leave a little room in computed columns when you first write them.

**The input was wrong.** Then fix the input, run `fmt`, and the derived numbers
follow. Never hand-edit a computed number to make the build green. That is
precisely the failure this tool exists to catch, and `fmt` will overwrite you at
the next run anyway.

## 8. Make the check block the merge

A red tick that nobody is required to look at is decoration. On GitHub, go to
**Settings → Branches → Branch protection rules** (or **Rulesets**) for your
default branch, and add the job as a required status check.

The name to look for is the **job** name, not the workflow name. In the file
from chapter 5 the job is `check`, so the required check is `check`.

Two practical points:

**A required check only appears in that list once it has run at least once.**
Merge the workflow first, let one pull request run it, then go and require it.

**Do not also require the `push` run.** Requiring a check that only runs on the
default branch means no pull request can ever satisfy it.

From here on, "the numbers in this document contradict each other" is a merge
blocker, in the same way a failing test is. That is the whole point of the
exercise, and everything after this chapter is refinement.

---

# Part 3 — Choosing what to check

## 9. Globs and the `files` input

The `files` input takes one or more space-separated globs:

```yaml
        with:
          files: "docs/**/*.md"
```

```yaml
        with:
          files: "docs/**/*.md quotes/*.md README.md"
```

`**` matches across directories, because the Action turns on bash's `globstar`
before expanding it. A literal path works too, which is how you check an exact
list of files.

### The quoting rule, and why it is backwards from the shell

This trips up everybody once, so here it is stated plainly.

**In the Action's `files:` input, quote the glob.** The value is a string in
YAML. The Action expands it itself, inside a bash step that has `globstar` on.

**In a plain `run:` step, do not quote the glob.** There, the shell expands it
before `visimark` ever sees it, and a quoted glob arrives as a literal filename
that does not exist:

```console
$ visimark check "docs/**/*.md"
visimark: cannot read docs/**/*.md
$ echo $?
2
```

So: quoted in `with: files:`, unquoted in `run:`. Chapter 21 covers the `run:`
form properly.

### When nothing matches

An empty glob is an error, not a pass:

```
visimark-action: no files matched "docs/**/*.md"
```

and the step exits `2`. This is deliberate. A check that silently passes because
a directory was renamed is the most expensive kind of green tick there is — it
keeps working exactly as long as nobody notices.

### Directories are not arguments

`visimark` takes files, not directories:

```console
$ visimark check docs
visimark: cannot read docs
```

Give it a glob that ends in `*.md`.

### A file name with a space in it

The Action splits `files` on whitespace, so a path containing a space cannot be
expressed. This is rare in a repository, but if you have one, check it from a
plain `run:` step (chapter 21) where you control the quoting.

## 10. Documents that have no arithmetic

Point a glob at `docs/**/*.md` and it will pick up your README, your changelog
and your architecture notes. Most of them have no arithmetic at all, and they
pass without you doing anything.

But some of them have a **table**. And a table with no rules gets this:

```console
$ visimark check docs/roadmap.md
docs/roadmap.md

  COVERAGE a table with no `vmark` rules — nothing in this document is checked
           run `visimark infer` to derive them, or mark it `<!--vmark:no-formulas-->`

  1 problem (0 stale, 1 error)
$ echo $?
1
```

This is not the tool being fussy. `COVERAGE` exists to stop one specific lie:
computing the totals in your head, typing them as plain text, running `check`,
seeing `0 problems`, and reporting that the checker passes. That is a green
build on a document with no build in it.

Two things keep it from being annoying:

- It needs a **table** to fire. Prose is never asked for arithmetic it does not
  have.
- It is counted for the **whole document**. A reference table that really is all
  input passes, as long as some other table in the file carries a rule.

### The two honest answers

**The document does have arithmetic.** Run `visimark infer docs/roadmap.md`. It
reads the numbers already in the file and tells you which rules reproduce them —
including any rule that *nearly* fits, which is how it finds a wrong number in a
document that has adopted nothing. Chapter 17 of the tutorial covers this in
full.

**The document genuinely has no arithmetic.** Say so, in the document:

```markdown
<!--vmark:no-formulas-->
```

On its own line, not indented, not inside a fenced block.

The marker lives in the file rather than in a CI flag, and that is a deliberate
design decision worth understanding, because it shapes how you configure the
check. The claim "this document has nothing to derive" is about a document, not
about a build. Putting it in the file means it travels with the content, shows
up in review when somebody later adds a table full of numbers, and `grep` finds
every one of them. Putting it in a workflow file would mean an exclusion list
that nobody revisits.

It is checked like everything else: add rules to a marked document later, and
`check` reports the marker as wrong.

**Never add this marker to silence a failure you have not read.** That is the
one move `COVERAGE` exists to prevent.

## 11. Check everything, not just what changed

The obvious optimisation is to check only the Markdown files touched by the pull
request. Resist it for as long as you can, for three reasons.

**It is already fast.** `check` parses text and does decimal arithmetic. On a
repository with a few hundred Markdown files it is a fraction of a second — far
less than the time spent installing Node to run it.

**A document can go stale without being edited.** If a sheet takes its rows from
a CSV file (see chapter 19), changing the CSV makes the document stale while the
`.md` itself is untouched. A changed-files filter would skip precisely the file
that just broke.

**Coverage is a whole-repository property.** Somebody adds a new quote in a
directory your glob does not reach, and a changed-files run never tells you,
because the file they added is not the file that is failing.

If your repository really is large enough that this matters, filter with
`tj-actions/changed-files` or `git diff --name-only`, and add a second job on a
schedule that checks everything. Do not let the fast path be the only path.

## 12. Pin the version

The Action's `version` input defaults to the engine release that Action ref
ships. So `@v0.1.5` pins two things at once: the Action, and the verifier it
installs.

That matters in a way that is easy to miss. Re-run an unchanged commit next
month and you get the same answer. A build that was green stays green, and a new
release of VisiMark cannot turn yesterday's merged pull request red while
somebody is bisecting something unrelated.

The cost of the guarantee is that you have to bump a version to get fixes. That
is the right trade for a gate that blocks merges.

If you would rather track releases as they land:

```yaml
      - uses: michal-niedzwiedzki/visimark@v0.1.5
        with:
          files: "docs/**/*.md"
          version: latest
```

Now the Action is pinned but the engine floats. This is reasonable while you are
still adopting, when a new finding is information rather than an interruption.
It is a poor fit for a required check on a busy default branch.

A middle path: pin both, and let Dependabot raise the bump as a pull request you
can read.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

---

# Part 4 — Making a failure useful

## 13. Reading the log

A contributor whose build just went red needs to know which of three situations
they are in. Findings come in two classes: **problems** are counted in the
`N problems` line and fail the run, **advice** is printed and costs nothing.

### The problems

| Code | What it means |
|---|---|
| `STALE` | A stored number disagrees with its formula. Also a chart file that no longer matches its data. |
| `COVERAGE` | Nothing in this document is checked. See chapter 10. |
| `DATE` | A date is not ISO 8601 `YYYY-MM-DD`. |
| `UNIT` | One column mixes two currencies or units. |
| `UNDEF` | A formula names something that does not exist. The message suggests the nearest name. |
| `DUP` | The same name is bound twice in one scope. |
| `VECTOR` | A column was used where one value is required. Wrap it in `SUM(…)`. |
| `CYCLE` | Values depend on each other in a circle. The whole path is printed. |
| `TYPE` | Something cannot go where it was asked to go — for example a boolean into a cell. |
| `SHEET` | A block declares column rules but no table sits immediately above it. |
| `PRECISION` | A binding writes numbers but has no derivable decimal width. |
| `ASSERT` | An `assert` statement in the document is false. |
| `ANCHOR` | An anchor has nothing it can rewrite, or does not parse. |
| `IMPORT` | A declared CSV import cannot be resolved, or is unstamped. |
| `ARTIFACT` | A declared chart cannot be built or written. |

### The advice

`WARN` — something is defined and never read. Usually a typo on the left-hand
side of a rule, which is worth treating as a real signal even though it does not
fail the build.

`NOTE` — something could not be verified because something it depends on is
broken. It disappears when the real problem above it is fixed.

### The three answers, for a contributor

- **`STALE`** — run `visimark fmt FILE`, then read the diff and decide whether
  those new numbers are what you meant.
- **`COVERAGE`** — run `visimark infer FILE` and read the proposal.
- **Anything else** — a person has to answer it. The finding says which question
  it is.

**`fmt` repairs stale values and nothing else.** Do not paper over a `DATE`,
`UNIT`, `CYCLE`, `UNDEF` or `DUP` finding by editing the number it points at.
Changing the number a finding complains about is the one move that turns a
caught error into a hidden one.

The full list, with an example of each, is chapter 18 of the tutorial and
[`cli-reference.md`](cli-reference.md).

## 14. Annotations on the diff

The log is fine. An annotation on the pull request's **Files changed** tab is
better, because the reader never leaves the review.

Every command takes `--json`:

```json
{
  "command": "check",
  "visimark": "0.1.5",
  "status": "problems",
  "files": [
    {
      "path": "docs/pricing.md",
      "findings": [
        {
          "code": "STALE",
          "class": "problem",
          "location": { "file": "docs/pricing.md", "sheet": "plans", "name": "Annual", "row": "Team" },
          "details": { "stored": "948.00", "computed": "1068.00", "formula": "Monthly * 12" }
        }
      ],
      "summary": { "problems": 3, "stale": 3, "errors": 0 }
    }
  ],
  "summary": { "files": 1, "problems": 3, "stale": 3, "errors": 0 }
}
```

Turn that into GitHub workflow commands with `jq`. This replaces the Action step
from chapter 5, because the JSON has to land in a file the next step can read:

```yaml
      - name: check the documents
        id: visimark
        continue-on-error: true
        run: |
          shopt -s globstar nullglob
          npx --yes visimark@0.1.5 check docs/**/*.md --json > findings.json

      - name: annotate the findings
        if: always()
        run: |
          jq -r '
            .files[]
            | .path as $path
            | .findings[]
            | select(.class == "problem")
            | ([.location.sheet, .location.name] | map(select(.)) | join(".")) as $name
            | (if $name == "" then "this document"
               elif .location.row then "\($name) · \(.location.row)"
               else $name end) as $where
            | (.details
               | if .computed          then "\(.stored) should be \(.computed)"
                 elif .raw             then "`\(.raw)` is not an ISO 8601 date"
                 elif .suggestion      then "unknown name — did you mean `\(.suggestion)`?"
                 elif .cyclePath       then (.cyclePath | join(" -> "))
                 elif .suppressedCount then "\(.suppressedCount) more findings, in the log"
                 else "see the visimark check output" end) as $what
            | "::error file=\($path),title=VisiMark \(.code)::\($where): \($what)"
          ' findings.json

      - name: fail if the check failed
        if: steps.visimark.outcome == 'failure'
        run: exit 1
```

It produces lines like these, which GitHub turns into annotations:

```
::error file=docs/pricing.md,title=VisiMark STALE::plans.Annual · Team: 948.00 should be 1068.00
::error file=docs/pricing.md,title=VisiMark STALE::plans.annual_total: 3684.00 should be 3804.00
```

Three honest notes about this.

**There are no line numbers today.** A finding names `sheet.name` and the row's
first cell, not a byte offset, so an annotation lands on the file rather than on
the line. It is still a link straight to the right document with the right
numbers in the title.

**`continue-on-error` plus an explicit `exit 1` is the pattern.** The check must
keep the job alive long enough for the annotation step to run, and then the job
must still fail. Dropping the last step gives you a beautifully annotated green
build.

**`--json` prints no human report.** The annotations are the report. If you want
both, run `check` twice — once plain for the log, once with `--json` for the
file — or add the job summary from the next chapter.

**Do not depend on the human-readable output.** Its layout is for people. Parse
`--json`, do not grep the report. Also do not depend on key order, and do not
treat "no findings printed" as success — check the exit code.

### About `--jsonn`

A misspelled or misplaced option is refused, not ignored: `--jsonn` exits `2` with
``visimark: unknown option --jsonn — did you mean `--json`?``, and `--fix-dates`
with `check` exits `2` with `--fix-dates is only valid with fmt`. Nothing is read
or written first. A step that fails this way is wrong about how it calls
`visimark`; read the message, which names the option. A workflow that passes a
flag only a newer release knows must pin that release, because an older engine
now refuses it.

## 15. A job summary

Annotations live on the diff. A **job summary** is a panel on the run page,
which is the better home for a per-file count.

It reads the same `findings.json` the previous chapter produced, so this is a
step to add after the annotation step, not another run of the tool:

```yaml
      - name: summarise
        if: always()
        run: |
          {
            echo "## VisiMark"
            echo
            jq -r '
              "| File | Problems |", "|---|---:|",
              (.files[] | "| `\(.path)` | \(.summary.problems) |"),
              "",
              "**\(.summary.problems) problems.** Files checked: \(.summary.files)."
            ' findings.json
          } >> "$GITHUB_STEP_SUMMARY"
```

which renders as:

| File | Problems |
|---|---:|
| `docs/pricing.md` | 3 |

This is worth adding once you check more than a handful of documents, because
the log stops being scannable and the summary does not.

## 16. What to tell a contributor

Put this in `CONTRIBUTING.md`, or in the pull request template. It is short on
purpose.

```markdown
## The documents in `docs/` are checked

Numbers that follow from other numbers are computed, not typed. If the
`visimark` check fails on your pull request:

1. Install it: `npm i -g visimark` (or use `npx visimark`).
2. Run `visimark check docs/your-file.md` to see the same report CI saw.
3. If the finding is `STALE`, run `visimark fmt docs/your-file.md`, then
   **read the diff**. Those new numbers are the consequence of your edit —
   make sure they are the consequence you intended.
4. Anything else is a question for a person. The finding says which.

Never edit a computed number by hand to make the build pass. Change the input
or change the rule.
```

The fourth line is the one that matters. A contributor's first instinct on a red
build is to make the red go away, and for exactly one finding class — `STALE` —
there is a command that does that correctly. For every other class, "make the
number match" converts a caught error into a hidden one.

---

# Part 5 — Patterns that come up

## 17. `check` in CI, `fmt` on your machine

Run **`check`** in CI. It is read-only, so it is safe to point at anything, and
a failure is a real answer: the document contradicts itself, and a person should
look at it.

**Do not run `fmt` in CI and commit the result.** It is tempting — the fix is
mechanical, so why not apply it? Because the whole value of the tool is that a
human sees the drift and decides whether the input or the formula was wrong. A
bot that silently rewrites `948.00` to `1068.00` and pushes has removed the only
moment at which anybody would have noticed that the price change was never meant
to alter the annual total.

Worse, it is indistinguishable from the tool working. Every build is green, and
the documents are being corrected by a process nobody is reading.

`fmt` belongs in two places:

**On a developer's machine**, run by hand before committing.

**Behind format-on-save in an editor.** There is a language server and a VS Code
client; `fmt` runs as an ordinary formatter, so it behaves like every other
formatter you have. See chapter 25 of the tutorial.

A local Git hook is the third option, and chapter 23 has one.

## 18. The "you forgot to run `fmt`" gate

There is one reasonable way to involve `fmt` in CI: run it, and fail if it
changed anything. That still puts the decision on a person — it just tells them
sooner and more precisely.

```yaml
      - name: the documents must already be formatted
        run: |
          shopt -s globstar nullglob
          npx --yes visimark@0.1.5 fmt docs/**/*.md
          git diff --exit-code -- docs/
```

Continuing the story: the Team price is fixed and merged, and somebody now
raises the Enterprise plan from `199.00` to `219.00` without running `fmt`. The
log holds the exact repair they should have committed:

```console
$ visimark fmt pricing.md
pricing.md: updated 1 cell, 1 anchor
$ git diff --exit-code -- pricing.md
diff --git a/pricing.md b/pricing.md
index 8c5f525..c0db72d 100644
--- a/pricing.md
+++ b/pricing.md
@@ -4,7 +4,7 @@
 |------------|------:|--------:|--------:|
 | Starter    |    10 |   29.00 |  348.00 |
 | Team       |    45 |   89.00 |  1068.00 |
-| Enterprise |   120 |  199.00 | 2388.00 |
+| Enterprise |   120 |  219.00 | 2628.00 |

 Across **175**<!--vmark=plans.seats_total--> seats the list price comes to
-**3804.00**<!--vmark=plans.annual_total--> per year.
+**4044.00**<!--vmark=plans.annual_total--> per year.
$ echo $?
1
```

The contributor copies nothing and guesses nothing: they run the same command
locally and commit what it produces.

This gate and the plain `check` gate overlap almost entirely — a stale number
fails both. Pick one. `check` is the better default because it is read-only and
its report explains itself; the `fmt` gate is worth it when your contributors are
mostly running an editor with format-on-save and you want the rare miss caught in
the same shape they are used to.

If you run both, put `check` first, so the failure a contributor sees is the one
that explains itself.

## 19. Imports and charts: files CI must not ignore

Two features of the format produce or depend on files next to the document, and
both have a CI consequence worth knowing before it bites.

### A sheet whose rows come from a CSV

A sheet can take its rows from a local CSV instead of a Markdown table, and pin
the exact bytes of that file:

````markdown
```vmark #order from rows.csv labelled Item, Qty, Price, Net at sha256:618cac75…
total = SUM(Net)
```
````

The stamp is what keeps the document honest, and it is the reason chapter 11
told you not to filter by changed files. Change `rows.csv` and the document goes
stale even though the `.md` did not move:

```console
  STALE   order.            `rows.csv` does not match its recorded stamp — expected sha256:618cac…, got sha256:ad5069…
```

When the change is intended, `visimark fmt` re-stamps it, and that re-stamp is a
line in the diff that a reviewer can see and question. VisiMark never writes to
the CSV itself.

### Charts are committed artifacts, not build output

A `chart` statement declares an SVG drawn from columns of its own sheet.
`fmt` draws it; `check` verifies that the file on disk is exactly what the
current data renders to.

That makes the SVG part of the checked state of the repository, so **it has to
be committed**. A `.gitignore` rule that excludes generated images will make
every CI run fail:

```console
$ visimark check example-charts.md
example-charts.md

  STALE   sales.trend       artifact missing at `charts/example-charts-trend.svg`

  1 problem (1 stale, 0 errors)
```

Do not "fix" this by running `fmt` in CI to regenerate the file — see chapter 17.
Commit the SVG. It is data, not output: `check` proves its provenance, which is
the only claim that can be verified about a picture.

## 20. Reading values out of a document in CI

A checked document is not only a thing CI verifies. It is a thing CI can
**read**. `visimark eval` prints computed values, so a workflow can act on them.

```console
$ visimark eval docs/pricing.md --get plans.annual_total
3804
```

Nothing else on stdout — note that `eval` prints the value, not the width the
document writes it at, so a figure the page shows as `3804.00` comes back as
`3804`. This is the form to pipe:

```yaml
      - name: read the budget out of the document
        id: budget
        run: |
          value=$(npx --yes visimark@0.1.5 eval docs/pricing.md --get plans.annual_total)
          echo "annual=$value" >> "$GITHUB_OUTPUT"
```

`--get` takes `sheet.name`, or a bare `name` when it is unambiguous. An unknown
name exits `2` — "your request did not make sense" — which a script should treat
differently from `1`. `eval` exits `1` when an assertion in the document is
false, and still prints the values first.

### Why this is worth doing

Normally a number that both a person and a machine need lives twice: once in a
document for the person, once in a config file for the machine. The two drift,
and nobody notices until something breaks. `eval` removes the second copy.

Three shapes of this, each with a worked example:

- **A CI shard matrix.** Test-suite timings live in a table someone can read,
  with an assertion that no suite may cost more than double the average. A
  packaging step calls `eval --get` and builds the matrix. There is no YAML file
  to forget to update. See [`example-ci-sharding.md`](example-ci-sharding.md).
- **An agent spending gate.** A run ledger has a budget scalar and one row per
  tool call, with `assert spent <= budget`. The harness calls `eval --get` before
  dispatching each call. See [`example-agent-budget.md`](example-agent-budget.md).
- **A capacity decision.** The maximum affordable number of worker nodes is
  derived from the cost of everything else, so it stops being an independently
  maintained configuration value. See
  [`example-executable-documentation.md`](example-executable-documentation.md).

Two rules for anything that parses `eval --json`: quantities are decimal
**strings** (`"3804.00"`, not `3804`), because JSON numbers are IEEE floats and
money is not; and a column comes back as an array while a scalar comes back as a
single string.

---

# Part 6 — Other runners

## 21. Without the Action: plain `npx`

Nothing here needs GitHub. The portable core is one command:

```bash
npx --yes visimark@0.1.5 check docs/**/*.md
```

Two things to get right, and then it runs anywhere.

**The command does not expand globs — your shell does.** So quote nothing, and
turn on `globstar` if you want `**` to cross directories:

```bash
shopt -s globstar nullglob      # bash; zsh has ** already
npx --yes visimark@0.1.5 check docs/**/*.md
```

`nullglob` matters as much as `globstar`: without it, a glob that matches
nothing is passed through literally, and you get exit `2` and a confusing
`cannot read` message instead of a clean one.

If you would rather not think about shell options at all:

```bash
find docs -name '*.md' -print0 | xargs -0 npx --yes visimark@0.1.5 check
```

**Pin the version.** `visimark@0.1.5`, not `visimark`. The reasoning in chapter
12 is the same here, and without the Action there is nothing else holding the
engine still.

The same thing in a GitHub workflow, if you prefer not to use the Action:

```yaml
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 20
      - name: check the documents
        run: |
          shopt -s globstar nullglob
          npx --yes visimark@0.1.5 check docs/**/*.md
```

VisiMark needs Node 18 or newer, or Bun. On Windows the launcher needs `sh` on
the PATH — Git Bash or WSL provide it, plain PowerShell does not.

## 22. GitLab CI

```yaml
visimark:
  image: node:20
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - shopt -s globstar nullglob
    - npx --yes visimark@0.1.5 check docs/**/*.md
```

GitLab runs `script` lines through `sh` in some configurations, and `shopt` is a
bash builtin. If the job fails with `shopt: not found`, either use a `bash -lc`
wrapper or take the `find` route from chapter 21, which needs no shell options
at all:

```yaml
  script:
    - find docs -name '*.md' -print0 | xargs -0 npx --yes visimark@0.1.5 check
```

The exit-code contract is identical, so GitLab fails the job on `1` and `2`
without any extra configuration.

The same shape works on Jenkins, CircleCI, Buildkite, Azure Pipelines and
anything else that can run a shell command and read an exit code. There is
nothing GitHub-specific about the tool — only the annotation and job-summary
steps in chapter 14 and 15 use GitHub's own protocol.

## 23. Git hooks and pre-commit

CI is the gate. A hook is the shorter feedback loop, and the two are not
alternatives: the hook saves a round trip, the gate is what actually enforces.

A plain `.git/hooks/pre-commit`:

```bash
#!/usr/bin/env bash
set -euo pipefail

files=$(git diff --cached --name-only --diff-filter=ACM -- '*.md')
[ -z "$files" ] && exit 0

# shellcheck disable=SC2086
npx --yes visimark@0.1.5 check $files
```

`--diff-filter=ACM` skips deletions, which would otherwise be handed to the tool
as paths that no longer exist and come back as exit `2`.

With the [pre-commit](https://pre-commit.com) framework, in
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: visimark
        name: visimark check
        language: system
        entry: npx --yes visimark@0.1.5 check
        files: \.md$
```

The framework passes the staged file names as arguments, which is exactly the
shape `visimark check` wants.

A hook checks only staged files, so it cannot see the CSV-import case from
chapter 19 or the coverage-of-the-whole-repository case from chapter 11. Keep the
CI job.

---

# Part 7 — Rolling it out

## 24. Turning it on in a repository that already has documents

Adding a blocking check to a repository full of unchecked documents will produce
a wall of `COVERAGE` findings on the first run, and a strong urge to delete the
workflow file. Do it in four stages instead.

### Stage 1 — see the size of it, without blocking anything

```yaml
      - uses: michal-niedzwiedzki/visimark@v0.1.5
        continue-on-error: true
        with:
          files: "docs/**/*.md"
```

`continue-on-error: true` makes the step report without failing the job. Leave it
like that for a few days and read the runs.

### Stage 2 — wire up the documents that matter

For each document with real arithmetic, run `visimark infer FILE`. Do not type
the rules by hand: `infer` reads the numbers that are already there and tells you
which rules reproduce them, exactly, at that column's own precision. It proposes
nothing it cannot verify.

Read the near-misses first. A rule that fits three rows out of four is the tool
telling you the document **has a wrong number in it** — before you have adopted
anything.

Then `visimark infer FILE --write`, which only inserts. It never rewrites an
existing byte.

And then do chapter 4's test on each one: change an input, confirm the check
starts failing, put it back.

### Stage 3 — mark the documents that have no arithmetic

Add `<!--vmark:no-formulas-->` to the ones that genuinely have nothing to derive,
having actually read each one. Chapter 10 explains why this belongs in the file
rather than in an exclusion list in the workflow.

### Stage 4 — remove `continue-on-error`, then require the check

Chapter 8. From here the gate is real.

If stage 2 is going to take a while, narrow the glob instead of weakening the
check: point it at the directory you have finished — `files: "quotes/**/*.md"` —
and widen it as you go. A narrow blocking check is worth more than a wide
advisory one.

## 25. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `cannot read docs/**/*.md`, exit `2` | The glob was quoted in a `run:` step, so the shell never expanded it | Unquote it in `run:`; quote it in the Action's `files:` |
| `cannot read docs`, exit `2` | A directory was passed | Pass a glob ending in `*.md` |
| `visimark-action: no files matched`, exit `2` | The glob matches nothing — usually a renamed or moved directory | Fix the glob. Do not make it pass silently |
| `usage: visimark check FILE...`, exit `2` | No file arguments at all | Check that the glob or `find` produced something |
| `**` matched only one directory level | `globstar` is off | `shopt -s globstar` in bash; the Action does this for you |
| A glob that matches nothing is passed through literally | `nullglob` is off | `shopt -s nullglob` |
| `COVERAGE` on a README or changelog | The file has a table and no rules | Chapter 10 — `infer`, or the marker |
| The workflow runs twice on every PR commit | `on: [push, pull_request]` | Restrict `push` to your default branch |
| The annotation step runs but the job is green | The check step has `continue-on-error` and nothing re-fails the job | Add the explicit `exit 1` step from chapter 14 |
| A step fails with `unknown option` or `is only valid with` | A misspelled option, an option on the wrong command, or one this engine version does not know | Read the message: it names the option and, if misplaced, the command that owns it |
| `shopt: not found` | The job's shell is `sh`, not bash | Use `bash -lc`, or the `find` form from chapter 21 |
| `ARTIFACT` or a missing-artifact `STALE` on every run | Chart SVGs are in `.gitignore` | Commit them — chapter 19 |
| A required check can never be satisfied | The required check only runs on `push` to the default branch | Require the job that runs on `pull_request` |
| The engine version changed without you asking | `version: latest`, or an unpinned `npx visimark` | Pin both — chapter 12 |

If a failure is genuinely confusing, reproduce it locally with the same version
the workflow used:

```console
$ npx --yes visimark@0.1.5 check docs/pricing.md
```

The tool reads nothing but the files you name. There is no config file, no
environment variable, no network call and no clock, so a local run and a CI run
on the same bytes give the same answer. If they differ, the bytes differ — check
what your workflow actually checked out.

## 26. The checklist

The complete workflow, with everything this guide recommends:

```yaml
name: visimark

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

# A second push to the same branch makes the first run irrelevant.
concurrency:
  group: visimark-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@v0.1.5
        with:
          files: "docs/**/*.md"
```

And the things to have done around it:

- [ ] Every checked document has been broken on purpose once, and the check
      caught it. (Chapter 4.)
- [ ] The glob covers everything you want checked, and fails loudly when it
      matches nothing. (Chapter 9.)
- [ ] Documents with no arithmetic carry `<!--vmark:no-formulas-->` in the file,
      not an exclusion in the workflow. (Chapter 10.)
- [ ] The Action ref and the engine version are pinned. (Chapter 12.)
- [ ] The job is a required status check on the default branch. (Chapter 8.)
- [ ] `check` runs in CI. `fmt` does not. (Chapter 17.)
- [ ] Chart SVGs are committed, not ignored. (Chapter 19.)
- [ ] `CONTRIBUTING.md` says what to do about a red build. (Chapter 16.)

### The five things worth remembering

1. **A green check proves agreement, not derivation.** Change an input and watch
   it break — once per document, before you trust it.
2. **Exit `1` is a document problem. Exit `2` is a workflow problem.** They need
   different people.
3. **`check` in CI, `fmt` on your machine.** A bot that repairs drift has
   removed the only moment anybody would have noticed it.
4. **`fmt` fixes `STALE` and nothing else.** Every other finding is a question
   for a person.
5. **Pin the version.** A gate that blocks merges should give the same answer
   next month.

### Where to go next

| Document | What it answers |
|---|---|
| [`tutorial.md`](tutorial.md) | The language itself, from a plain table to a full quote |
| [`cli-reference.md`](cli-reference.md) | Every command, option, exit code and finding |
| [`playground.html`](playground.html) | The real engine in your browser, nothing to install |
| [`example-invoice-drift.md`](example-invoice-drift.md) | One input changed and nothing else — 26 findings, each walked through |

<!--vmark:no-formulas-->
