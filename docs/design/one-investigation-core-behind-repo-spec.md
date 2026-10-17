# One investigation core behind `repo:investigate` and the "Scan your repo" widget — feature spec

**Status:** approved (#407) · **Date:** 2026-10-17 · **Decision:** [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/407#issuecomment-6234585458)

## 1. Purpose

Three code paths judge a repository's Markdown, and on the same repository they disagree:

- `repo:scan` (`scripts/repo-scan.ts`) clones the repo and runs engine `infer` and `check`.
- `ensureClone` (`scripts/repo-pr-clone.ts`) is used by `repo:scan --keep` and by `repo:pr`. It runs its own copy of that scan to decide whether to keep a clone.
- The homepage widget (`site/src/pages/repo-scan.ts`) runs engine `check` in the browser with COVERAGE dropped.

A fourth path, the experimental `repo:investigate` on the unmerged branch `feat/repo-prospect`, re-adds Total rows and line totals in exact integers.

On a repository with no `vmark` blocks, which is the repository a visitor pastes, `check` finds almost nothing. So the widget and `repo:scan` report "no problems" for a repository whose totals are wrong, while the heuristic path finds the wrong total. The heuristic path has its own defect: it reads tables inside code fences. Here is the branch's `findTotalMismatches` on a correct table followed by a deliberately wrong example inside a fence:

```console
$ bun probe.ts fence.md
line 16 column Cost: stored 99, computed 3
$ echo $?
0
```

The surface before this change:

```console
$ bun run repo:scan
Usage: bun run repo:scan <owner/repo|git-url> [--branch NAME] [--force] [--explain] [--json] [--keep]
$ echo $?
2
```

This spec replaces all of these with **one pure investigation core** and **two thin shells**: the `repo:investigate` CLI and the widget. Both run the same code over the same inputs, so for the same repository at the same commit they report the same findings. The core's `--json` Report is a versioned contract: two later tools will read it, one that files an issue from the findings and one that drafts a pull request.

`feat/repo-prospect` is **not merged**. It is source material only. The pieces listed in §6.1 are copied from it onto `master`. Its other scripts (`repo:prospect`, `repo:fix`, `repo:send`, `repo:pr-report`, `repo:pr-list`) and `docs/repo-prospecting-flow.md` stay on the branch.

## 2. The surface

### 2.1 The CLI

```
bun run repo:investigate <owner/repo | https-git-url | ssh-git-url | local-path> [--branch NAME] [--force] [--json]
```

| Argument / option | Meaning |
|---|---|
| `owner/repo` | GitHub shorthand. Cloned from `https://github.com/owner/repo.git`. Same grammar as today's `parseRepoArg`. |
| `https://…` or `git@…:…` | A clone URL. Same grammar as today's `parseRepoArg`. |
| `local-path` | An argument starting with `/`, `./` or `../` is a local directory. It must be inside a git work tree. Nothing is cloned and no cache or manifest is touched. Exists so acceptance runs offline. A bare `docs/x` is never a path: it is shorthand, and an invalid one if it has no `/`. |
| `--branch NAME` | Clone `NAME` instead of the remote's `HEAD`. Refused with a local path. |
| `--force` | Clone again even if a cached clone for this commit exists. It never deletes local work (a `WORK_BRANCH` branch or uncommitted changes, `hasLocalWork`). In that case the cached clone is reused and stderr says so. That Report names the work tree's own `HEAD` as its commit and has `host: null`, so no permalink points at a remote snapshot the findings did not come from. Refused with a local path. |
| `--json` | Print the Report (§3.3) and nothing else to stdout. |

There are no short forms. Any other `--option`, a second positional argument, or `--branch` without a value is a usage error. `--explain` and `--keep` from `repo:scan` do not exist: text mode always prints every finding, and the clone is always cached (§2.3).

`bun run repo:scan` no longer exists. Bun reports `Script not found "repo:scan"` and exits non-zero. There is no alias.

### 2.2 What gets investigated

Every investigation runs the full rule set. A repository that already runs the VisiMark Action is **not** skipped: posture records `action yes`, and the widget hides its "Add visimark.yml" button.

### 2.3 Clone, cache and manifest (CLI only)

For a remote argument, the CLI resolves the commit with `git ls-remote`. It clones with `--depth 1` into `<cacheRoot>/clones/<cacheDirName(host, label, sha)>`, where `cacheRoot` is `defaultCacheRoot()` and `VISIMARK_REPO_PR_HOME` still overrides it. A clone already at that path is reused. After the run, the clone is kept and recorded in the manifest only when the Report is **actionable**:

```
actionable = accuracy.confirmed > 0 || accuracy.leads > 0 || adoption.inferable > 0 || adoption.inferableAfterFix > 0
```

Otherwise the clone is deleted and the manifest entry is written with `hasFindings: false`. This is today's `ensureClone` bookkeeping, with `hasUsefulFindings` replaced by `actionable`. `ensureClone` keeps its signature and its `already-scanned` short-circuit for `repo:pr`. Its internal `cmdInfer`/`cmdCheck` pass is replaced by a run of the core, and its `report` field becomes the Report (§3.3).

### 2.4 The widget

The widget is the same form at `docs/index.html#repo-scan`. On submit it:

1. Fetches `GET /repos/{o}/{r}`, which gives `default_branch`.
2. Fetches `GET /repos/{o}/{r}/commits/{default_branch}`, which gives the commit SHA and `commit.committer.date`.
3. Fetches `GET /repos/{o}/{r}/git/trees/{sha}?recursive=1`, which gives every path, with `size` for each blob.
4. Fetches file contents from `raw.githubusercontent.com/{o}/{r}/{sha}/{path}`: the workflow files, the Markdown files the policy keeps (§3.4), and the import targets (§3.2).
5. Loads the engine bundle and runs the core.

That is three API calls per scan instead of two today, which allows about 20 scans an hour per IP on the unauthenticated limit. If a call fails, the scan fails with today's `ScanError` messages. The one exception is the posture sources: if they fail, the Report says "posture unavailable" (§3.3).

## 3. The machine contract

### 3.1 Outcomes

| Condition | Exit | stdout | stderr | `--json` |
|---|---|---|---|---|
| Investigation ran, no confirmed finding (leads, adoption, or nothing at all) | `0` | text report (§4.1) | clone progress, `note:` lines | the Report |
| Investigation ran, at least one confirmed finding | `1` | text report | as above | the Report |
| No argument, unknown option, extra positional argument, `--branch` without a value, `--branch`/`--force` with a local path | `2` | nothing | the usage line, or `repo-investigate: <reason>` then the usage line | nothing on stdout |
| Unparseable repo argument | `2` | nothing | `repo-investigate: not a recognized repo (want \`owner/repo\`, a git URL, or a path starting with / ./ ../): <arg>` | nothing on stdout |
| `git ls-remote` fails, clone fails, or the local path is not in a git work tree | `2` | nothing | `repo-investigate: <what failed>: <git's stderr>` | nothing on stdout |

The exit codes follow `visimark`'s convention: `0` clean, `1` findings, `2` usage or failure. Leads alone exit `0`. Nothing reads the inverted convention the branch used.

The usage line is exactly:

```
Usage: bun run repo:investigate <owner/repo|git-url|./path> [--branch NAME] [--force] [--json]
```

### 3.2 The core

The core is a new private workspace package, `packages/visimark-investigate` (npm name `visimark-investigate`). It is `"private": true` with **no `version` field**, as `visimark-editor-shared` and `site` are, and it is **not** listed in `scripts/release-manifests.ts`. It imports the engine **only as types** (`import type` from `visimark`). The engine arrives at runtime as an argument, so the site bundle never contains a second copy of the engine. It touches no filesystem, network, clock or environment.

```ts
interface Engine {            // satisfied by both `visimark`'s index and window.VisiMark
  locate; build; check; infer; isProblem; memoryReader; describeFinding;
}

interface InvestigateInput {
  repo: { label: string; host: string | null; commit: string; lastCommit: string | null };
  engineVersion: string;
  paths: { path: string; size: number }[];   // every tracked blob, all types
  texts: Map<string, string>;                // Markdown kept by the policy + workflows + import targets
  fileCap?: number;                          // the widget passes 500; the CLI passes nothing
  clonePath: string | null;
}

function selectFiles(paths, fileCap?): { markdown: string[]; skipped: Skipped[] }   // §3.4, before any fetch
function importTargets(markdown: Map<string, string>, engine): string[]           // repo-relative, sorted
function investigate(input, engine): Report                                       // the rules, merge, rating
function summaryLines(report): string[]                                           // accuracy / adoption / posture
function findingLines(finding, style: "cli" | "web"): string[]
```

Both shells call `selectFiles` first, then read or fetch the Markdown it keeps, then call `importTargets`, then read or fetch those files too. Only then do they call `investigate`. `importTargets` builds each document and collects the path in every sheet's `imported` declaration, resolved against the document's directory. Engine checks use `engine.memoryReader` over `texts` in both shells, so an import resolves the same way in the CLI and in the browser.

`summaryLines` and `findingLines` are the only formatters. The CLI prints them, and the widget escapes them and renders them, so the two cannot word a result differently.

### 3.3 The Report (`version: 1`)

```ts
interface Report {
  version: 1;
  engine: string;                          // visimark version whose check/infer ran
  repo: { label: string; host: string | null; commit: string };
  clonePath: string | null;                // CLI: kept clone or the local path; widget: null
  files: { markdown: number; read: number; skipped: Skipped[] };
  accuracy: {
    verdict: "confirmed" | "leads" | "clean" | "nothing-checkable";
    confirmed: number; leads: number;
    tablesRead: number; tablesChecked: number; unreadable: number;
  };
  adoption: {
    withoutRules: number;                  // engine COVERAGE findings
    withArithmetic: number;                // tables with no vmark rules that a rule checked or infer proposed for
    inferable: number;                     // of those, tables infer proposes at least one rule for (no confirmed finding)
    inferableAfterFix: number;             // tables with a confirmed finding that infer proposes for once its fixes are applied
  };
  posture: {
    available: boolean;
    contributing: boolean | null; prTemplate: boolean | null; license: boolean | null;
    actionUsed: boolean | null; lastCommit: string | null;   // YYYY-MM-DD of the scanned commit
  };
  findings: Finding[];
  ruleErrors: { path: string; rule: string; message: string }[];
}

interface Skipped { path: string; reason: "dot-path" | "excluded-directory" | "size" | "generated" | "file-cap" | "fetch-failed" }

interface Finding {
  id: string;                              // §3.5
  path: string;
  lines: [number, number];                 // 1-based, the table's header line to the finding's line
  permalink: string | null;                // github.com only: /blob/<commit>/<path>?plain=1#L<a>-L<b>
  confidence: "confirmed" | "lead";
  rules: string[];                         // registry order
  stored: string; computed: string;
  message: string;
  evidence: string[];                      // numbered source lines (`excerpt`), at most 14
  fix?: Edit[];                            // omitted when the rule proposes none; never []
}

interface Edit { from: number; to: number; old: string; new: string }   // offsets into the text at `commit`
```

`accuracy.verdict` is `confirmed` if `confirmed > 0`. Otherwise it is `leads` if `leads > 0`, otherwise `clean` if `tablesChecked > 0`, otherwise `nothing-checkable`.

`posture.available` is `false` only when a shell cannot supply the inputs it needs. In that case the five fields are `null`.

The Report is versioned by its `version` field. Within version 1, changes are additive only.

### 3.4 File policy (in the core)

`selectFiles` keeps a path that ends in `.md` or `.markdown` (case-insensitive) and passes these filters, applied in this order. The first filter that drops a path names its `reason`:

1. **`dot-path`**: any path segment starts with `.`.
2. **`excluded-directory`**: any path segment, compared case-insensitively, is one of `test`, `tests`, `__tests__`, `fixtures`, `vendor`, `third_party` or `node_modules`.
3. **`size`**: the blob is larger than 500,000 bytes.
4. **`file-cap`**: only when `fileCap` is given. Paths are sorted by byte order and the first `fileCap` are kept.

After the text is read, `generated` applies: one of the first 15 lines matches `/do not edit|auto-?generated|generated (by|with|from)|@generated/i` (`looksGenerated`, unchanged). `fetch-failed` is recorded by the widget for a file that failed twice. The CLI reads files from disk and never records it.

### 3.5 Finding identity and merge

A finding's `id` names the **cell by content**. It does not contain a line number or a rule.

| Finding | `id` |
|---|---|
| A table cell | `<path>#t<N>/<column>/<rowLabel>` |
| An engine finding with a `sheetId` and `name` but no table row (a scalar, an anchor) | `<path>#<sheetId>/<name>` |
| Any other engine finding | `<path>#<code>/<name or "-">` |

`N` is the table's 1-based position among the tables in that file, counted on the masked text (§3.6). `<column>` is the header text, trimmed, with any run of `*`, `_` or `` ` `` that wraps it removed. An inner `_` stays, as in `premium_hours`. A `/` or `%` inside a component is escaped as `%2F` or `%25`. `<rowLabel>` is the first cell, treated the same way. If a table has two rows with the same label, the second is `<rowLabel>~2`, the third `~3`, and so on. An engine finding is placed in a table by its `span`.

Findings with the same `id` merge into one:

- `rules` is the union, in registry order.
- `confidence` is `confirmed` if any merged finding is confirmed.
- `stored`, `computed`, `message`, `evidence` and `fix` come from the first confirmed finding in registry order, or from the first finding if none is confirmed.

An exactly verified finding wins over an `infer` proposal. In a table holding a confirmed finding, `engine-infer`'s proposals are not counted in `adoption.inferable`. Instead, the core applies every confirmed finding's `fix` in that file to a copy of the text, runs `engine.infer` on the copy, and counts the table in `inferableAfterFix` if `infer` proposes at least one rule for it there.

### 3.6 Masking (heuristic rules only)

The heuristic rules (`total-row`, `line-product`) read a **masked** copy of each file. The masked copy has the same length and the same newlines as the original. In these regions, every character except `\n` becomes a space:

- fenced code (both fence styles);
- indented code blocks;
- HTML comments;
- YAML front matter at the top of the file;
- blockquote lines.

`<details>` content and tables inside list items stay readable. The engine rules (`engine-check`, `engine-infer`) read the **raw** text, because `vmark` blocks are fenced code. Offsets and line numbers are the same in both views, so a finding from either view points at the same characters.

## 4. Behaviour

### 4.1 Rules and their findings

A rule is `{ id, label, scope: "file" | "repo", run }`. A file-scoped `run` takes one document and its context and returns `{ findings, checked }`, where `checked` is the set of table keys `<path>#t<N>` the rule verified a relation in. The repo scope exists for later rules; none of the four below uses it. The registry is one array, in this order:

| `id` | `label` (the "found by" tag) | Reads | Finds | `fix` |
|---|---|---|---|---|
| `total-row` | `sum check` | masked | A row whose first cell matches `/^(grand\s+)?(sub)?\s*total(\s+cost)?:?$/i`, against the sum of the numeric cells above it since the previous total row. At least two terms are needed. The sum is computed in exact scaled integers (`verifyTotal`'s arithmetic) and compared at the total's own decimal places, rounding half away from zero. Equal: no finding, and the column counts as checked. Unequal: **confirmed**. A non-empty cell that is not a number (`200+`, `n/a`) makes the column unreadable: no finding, and `unreadable` goes up by 1. A column whose total equals quantity × price for some other column is not a finding. | Rewrite the total cell to the exact sum at the total's decimal places. |
| `line-product` | `line check` | masked | In a table whose product column header matches `/total\|amount\|cost\|price\|sum\|line\|value/i` and sits to the right of both factor columns, the one row where factor × factor ≠ product, computed in exact scaled integers at the product's decimal places, while at least two other rows hold exactly. Total rows are excluded. Result: **confirmed**. | Rewrite the product cell to the exact product at its decimal places. |
| `engine-check` | `VisiMark` | raw | `engine.check` per document, with `memoryReader` over `texts`. `STALE` is **confirmed**. Every other code in `ERROR_CODES` is a **lead**, with the message from `describeFinding`. `COVERAGE` is not a finding: each one adds 1 to `adoption.withoutRules`. `WARN` and `NOTE` are dropped. So is the collapsed anchor-group `STALE` (`anchorGroup: true`), which only summarises the others. So is any finding about a generated artifact (`artifact` set, or code `ARTIFACT`), because the investigation never reads generated files. A sheet with a table and at least one binding adds its table to `checked`. | `STALE` with `span`, `stored` and `computed`: replace `stored` with `computed` at `span`. Otherwise none. |
| `engine-infer` | `VisiMark infer` | raw | `engine.infer` per document. A `near-miss` proposal is a **lead** at its `disagreement` row, with stored and computed taken from the disagreement. A `column` or `scalar` proposal adds its table to `withArithmetic` and to `inferable` (subject to §3.5). | None. |

Messages: `total-row` gives `the table says <stored>; the rows add up to <sum> (exact); off by <stored − sum>`. `line-product` gives `the table says <stored>; <factor> × <factor> is <product>; the other <n> rows agree`. `engine-check` `STALE` gives `the document says <stored>; <formula> computes <computed>`, and its other codes give `describeFinding`'s text. `engine-infer` gives `the table says <stored>; <rule>, which fits the other rows, gives <computed>`. A finding outside a table names its cell as `<sheetId>.<name>`.

If a rule throws on a file, that is recorded in `ruleErrors`, and the other rules still run on that file. `tablesRead` counts the GFM tables in the masked text of every file read. `tablesChecked` counts the distinct table keys in the union of every rule's `checked`.

### 4.2 Posture

Posture is computed by the core from `paths`, the workflow texts and `repo.lastCommit`. No extra API call is needed.

- `contributing`: `CONTRIBUTING` with any extension or none, at the root, under `docs/`, or under `.github/`.
- `prTemplate`: `pull_request_template.md` at the root, under `docs/`, or under `.github/`, or any file under `.github/PULL_REQUEST_TEMPLATE/`. Names are compared case-insensitively.
- `license`: a root file matching `/^(licen[cs]e|copying)(\..*)?$/i`.
- `actionUsed`: `VISIMARK_ACTION_USE` matches any `.github/workflows/*.y(a)ml` text.
- `lastCommit`: the committer date of the scanned commit in UTC, as `YYYY-MM-DD`. The CLI gets it from `git log -1 --format=%cI` converted to UTC, and the widget from the commits call, which is already UTC. Using `%cs` would give the committer's own offset, so a commit near midnight would get a different date in each report.

### 4.3 Sessions (acceptance)

The fixture is a git repository that the acceptance test builds in a temporary directory, with one commit whose committer date is `2026-09-30`. Its files:

- `README.md`: `# Fixture` followed by `<!--vmark:no-formulas-->`.
- `LICENSE`: any text.
- `test/fixture.md`: a copy of `docs/budget.md`.
- `docs/example-lunch-split-drift.md`: a byte-for-byte copy of the repository's own file.
- `docs/budget.md`:

  ````markdown
  # Budget

  | Item | Cost |
  |------|-----:|
  | Venue | 120.00 |
  | Catering | 85.50 |
  | Printing | 22.00 |
  | Badges | 14.00 |
  | Signage | 30.00 |
  | Coffee | 18.00 |
  | Speakers | 25.00 |
  | Recording | 15.00 |
  | Swag | 6.00 |
  | Misc | 5.00 |
  | Total | 341.50 |

  An example of a wrong table, which is not part of the budget:

  ```markdown
  | Item | Cost |
  |------|-----:|
  | A    | 1    |
  | B    | 2    |
  | Total | 99  |
  ```
  ````

- `docs/quote.md`: the #409 table.

  ```markdown
  # Budget

  | Item | Qty | Price | Cost |
  |------|----:|------:|-----:|
  | A    | 2   | 5.00  | 10.00 |
  | B    | 3   | 4.00  | 13.00 |
  | C    | 1   | 7.00  | 7.00 |
  | D    | 4   | 2.00  | 8.00 |
  ```

What the engine does on these files today, verified on `master`:

- `check` gives `COVERAGE` on `budget.md` and on `quote.md`.
- `check` gives `STALE lunch.Total 30.00 ≠ 29.50` on the lunch file.
- `infer` proposes nothing for `budget.md`, because of the Total-row blind spot.
- `infer` proposes `Qty = Cost / Price` for `quote.md`, which is #409.

`<sha>` is the fixture's commit and `<sha12>` its first 12 characters.

```console
$ bun run repo:investigate ./fixture-repo
repo-investigate: fixture-repo at <sha12>, 4 Markdown files
accuracy: 3 confirmed, 0 leads  (3 tables read, 3 checked, 0 unreadable)
adoption: 2 tables with arithmetic and no rules, 0 inferable, 1 inferable after fix
posture:  CONTRIBUTING no  PR template no  LICENSE yes  action no  last commit 2026-09-30
skipped: test/fixture.md (excluded-directory)

CONFIRMED  docs/budget.md:15  Cost / Total  · found by: sum check
      3  | Item | Cost |
      ⋮  (the table's lines 3–15, as `excerpt` prints them)
     15  | Total | 341.50 |
  the table says 341.50; the rows add up to 340.50 (exact); off by 1.00

CONFIRMED  docs/example-lunch-split-drift.md:17  lunch.Total  · found by: VisiMark
     17  The four of us owe **30.00**<!--vmark=lunch.Total--> total, split evenly.
  the document says 30.00; SUM(Price) computes 29.50

CONFIRMED  docs/quote.md:6  Cost / B  · found by: line check
      5  | A    | 2   | 5.00  | 10.00 |
      6  | B    | 3   | 4.00  | 13.00 |
      7  | C    | 1   | 7.00  | 7.00 |
  the table says 13.00; Qty × Price is 12.00; the other 3 rows agree
$ echo $?
1
```

Findings are sorted by `path`, then by line. A local path has no host, so it prints no permalink line. A github.com run prints the permalink on the line after the headline. The three finding ids are `docs/budget.md#t1/Cost/Total`, `docs/example-lunch-split-drift.md#lunch/Total` and `docs/quote.md#t1/Cost/B`.

| Case | Invocation | Output | Exit |
|---|---|---|---|
| The fixture above | `repo:investigate ./fixture-repo` | as above | `1` |
| The fixture, JSON | `repo:investigate ./fixture-repo --json` | one Report: `version` 1, `accuracy` `{verdict: "confirmed", confirmed: 3, leads: 0, tablesRead: 3, tablesChecked: 3, unreadable: 0}`, `adoption` `{withoutRules: 2, withArithmetic: 2, inferable: 0, inferableAfterFix: 1}`, the three ids above, `files.skipped` `[{path: "test/fixture.md", reason: "excluded-directory"}]`; nothing else on stdout | `1` |
| The fenced wrong table | same | no finding on lines 19–25 of `docs/budget.md`, and the fenced table is not counted in `tablesRead` | — |
| `README.md` and `LICENSE` only | `repo:investigate ./clean-repo` | `accuracy: 0 confirmed, 0 leads  (0 tables read, 0 checked, 0 unreadable)`, no finding lines; `--json` `accuracy.verdict` is `"nothing-checkable"` | `0` |
| A lead only (a `vmark` doc with `UNDEF`) | `repo:investigate ./lead-repo` | `lead       docs/plan.md:<n>  UNDEF …  · found by: VisiMark` | `0` |
| No argument | `repo:investigate` | stderr: the usage line | `2` |
| Unknown option | `repo:investigate acme/x --explain` | stderr: `repo-investigate: unknown option --explain`, then the usage line | `2` |
| `--branch` with a path | `repo:investigate ./fixture-repo --branch main` | stderr: `repo-investigate: --branch and --force do not apply to a local path`, then the usage line | `2` |
| Not a work tree | `repo:investigate /tmp/empty-dir` | stderr: `repo-investigate: not a git work tree: /tmp/empty-dir` | `2` |
| Bad shorthand | `repo:investigate nope` | stderr: the unrecognized-repo message (§3.1) | `2` |
| The old name | `bun run repo:scan` | bun: `Script not found "repo:scan"` | non-zero (bun's) |

### 4.4 Fixtures and properties (core tests)

Each rule has the folder `packages/visimark-investigate/test/fixtures/rules/<id>/` with `good.md`, `bad.md` and `bad.expected.json`. `bad.expected.json` is the array of Findings `investigate` returns for `bad.md` alone, with `permalink: null`.

- **Registry test.** For every rule in the registry, the folder exists, `good.md` gives no finding with that rule in `rules`, and `bad.md` gives exactly `bad.expected.json`. A rule without the folder fails the test.
- **Fix property.** For every `bad.md`: apply every `fix` of every finding, run `investigate` again, and check that no finding has an `id` that was fixed. A finding with no `fix` has no `fix` key at all.
- **Masking property.** The masked text has the same length and the same `\n` offsets as the input, on every fixture.
- **Merge.** The #409 table followed by a `vmark #q` block holding `Cost = Qty * Price` makes `line-product` and `engine-check` (`STALE` Cost/B) hit the same cell. It gives one finding with `rules: ["line-product", "engine-check"]` and `confidence: "confirmed"`. A `total-row` + `engine-infer` merge cannot be built today, because `infer` proposes nothing for a table with a Total row.
- **Q12 case.** The #409 table (row B 13.00): `line-product` confirms B; `engine-infer`'s `Qty = Cost / Price` is not counted in `inferable`; `inferableAfterFix` is 1.
- **Parity.** A test in `site/` runs the widget's adapter, with `fetch` stubbed from a fixture directory, against the same fixture repository. Its Report equals the CLI's for the same input, except `clonePath`.

### 4.5 The widget's rendering

The widget renders `summaryLines` and then, for each finding, `findingLines(f, "web")`:

- A confirmed finding's headline is `Wrong number · <path>:<line> · <column> / <row>`.
- A lead's headline is `Worth a look · <path>:<line> · …`.
- Then the message, then `found by: <labels joined by ", ">`.
- The path links to `permalink`.

A `file-cap` skip shows today's caveat: `stopped after 500 files; N more weren't scanned`. The "Add visimark.yml" button appears only when `posture.actionUsed` is `false`. Every interpolated string goes through `escapeHtml`, and the report is written with `setTrustedHtml`, as today.

## 5. Compatibility

| Consumer | Before | After |
|---|---|---|
| `.github/workflows/*`, the composite Action (`action.yml`), `docs/ci.md` | do not run `repo:*` | unchanged |
| `dogfood.yml`'s lunch-split job | runs the Action on `docs/example-lunch-split-drift.md` | unchanged |
| `dogfood.yml`'s doc-set step, `.pre-commit-config.yaml`, `scripts/doc-set.test.ts` | exclude `packages/visimark/test/fixtures/` | also exclude `packages/visimark-investigate/test/fixtures/`, whose `bad.md` files fail `check` on purpose. The three files change together, which `doc-set.test.ts` enforces. |
| `scripts/check-links.ts` | skips `/test/fixtures/` | unchanged; it already covers the new path |
| `bun run repo:scan` | scans | `Script not found`. **Migration note:** "`repo:scan` was removed in favour of `repo:investigate`, which does what it did plus exact total and line checks. `--keep` is now the default, and `--explain` is the default output." |
| `bun run repo:pr` | `ensureClone` → its own `infer`/`check` | `ensureClone` → the core; `clone.report.repo` becomes `clone.report.repo.label`; usage and exit codes unchanged |
| The manifest and cache layout | `~/.cache/visimark/repo-pr/{manifest.json,clones/…}` | unchanged; existing entries stay valid |
| Root `bun run test` / `typecheck` | every workspace | gains `visimark-investigate`, picked up by the `packages/*` glob |
| The release (`release-manifests.ts`, `check-versions.ts`, `release.yml`) | | unchanged; the package has no version and is not published |

The change is reversible by revert. Nothing is published, so no release is needed to undo it.

## 6. Interaction with the rest of the tooling

### 6.1 What moves and from where

| Into the core | From |
|---|---|
| `parseRepoArg`, `hostOf`, `excludeDotPaths` (generalised into `selectFiles`), `hasVisimarkAction`, `VISIMARK_ACTION_USE` | `scripts/repo-scan-lib.ts` (`master`) |
| `isDotPath`, the widget's copy of `VISIMARK_ACTION_USE`, `encodePath` | `site/src/pages/repo-scan.ts`; the copies are deleted |
| `cellNumber`, `findTotalMismatches` | `feat/repo-prospect:scripts/repo-prospect-lib.ts` |
| `digits`, `scaled`, `decimal`, `verifyTotal`'s arithmetic, `findRowProductMismatches`, `looksGenerated`, `excerpt`, `blobUrl`, posture | `feat/repo-prospect:scripts/repo-investigate-lib.ts` |

Both detectors are rewritten on top of the masked parse and the exact verifier. Neither keeps a floating-point comparison, so the branch's `rounding` verdict cannot occur.

`scripts/repo-scan.ts`, `scripts/repo-scan-lib.ts` and `scripts/repo-scan-lib.test.ts` are deleted. Tests for moved functions move with them into the core package. The `repo-scan-lib` formatting tests for `ScanReport` are deleted along with `ScanReport`.

`scripts/repo-investigate.ts` is the CLI shell. `scripts/repo-pr-clone.ts` keeps `ensureClone`, `hasLocalWork`, `defaultCacheRoot`, `loadManifest` and `saveManifest`. `saveManifest` is exported. `scripts/repo-pr-manifest.ts` is unchanged.

### 6.2 What does not change

- The `visimark` engine and its public exports: no new export.
- The `visimark` CLI, `--json` envelopes and exit codes.
- `docs/vendor/visimark-browser.js`. The widget still loads it lazily on submit, and `visimark-site-index.js` does not import the engine at runtime.
- The `#repo-scan` anchor and the file name `site/src/pages/repo-scan.ts`, so the article links, the `dogfood.yml` comment and `site/test/html-callers.test.ts` all stay valid.
- `repo:pr`'s CLI.
- The review workflow, the issue templates and the catalogue's structure.

`engineVersion` comes from `readVersion()` in the CLI. In the widget it comes from `packages/visimark/package.json`'s `version`, imported as JSON at build time. That is the version of the engine bundle built by the same `build:playground` run.

## 7. Documentation to update

- `docs/index.html`: the widget's subtitle copy (it now reports wrong totals and line totals, not only `check` problems), and the header comment that points at `site/src/pages/repo-scan.ts`, which stays accurate.
- `docs/vendor/visimark-site-index.js`: regenerated by `bun run build:pages` and committed.
- `site/src/pages/repo-scan.ts`: the header comment (it no longer runs `infer`/`check` itself), and the two "Mirrors `scripts/repo-scan-lib.ts`" comments, which are removed with the copies.
- `scripts/repo-pr-clone.ts` header ("runs the same `infer`/`check` scan `repo-scan.ts` does"), `scripts/repo-pr.ts` header ("a `repo-scan --keep`-worthy repo"), and `scripts/repo-pr-manifest.ts` doc comments that name `repo-scan`.
- `scripts/repo-investigate.ts` gets its own header with the usage line from §3.1.
- `packages/visimark-investigate/README.md`, new: what the core is, the rule contract, how to add a rule (one file, one registry line, one fixture folder), and the Report schema with a pointer to this spec.
- `.github/workflows/dogfood.yml`, `.pre-commit-config.yaml`, `scripts/doc-set.test.ts`: the fixture exclusion (§5).
- `CHANGELOG.md`: nothing. `repo:*` scripts and the site widget are not part of any published package's changelog. The decision is recorded in the catalogue's Shipped register instead.
- `docs/vocabulary-catalogue.md`: the #407 row moves to the Shipped register as `UNRELEASED`.
- No change: `docs/cli-reference.md`, `CONTRIBUTING.md`, `README.md` and `docs/ci.md`, none of which mentions `repo:*`. Historical design docs that cite `repo-scan.ts` line numbers (`docs/design/clear-scanner-errors-lint-repo-in-ci-{spec,plan}.md`) are records and are left alone.

## 8. Non-goals

- **More rules.** Horizontal totals, delta and ratio columns, literal equations in prose, prose figures against table figures, `git blame` evidence, and unit-aware sums each get their own issue against the rule contract.
- **The downstream tools.** The issue-filing tool and the PR-drafting tool are separate issues. This spec only guarantees the Report they will read.
- **Porting `repo:pr` to the Report.** The PR-drafting tool replaces it.
- **Fixing `infer`.** Infer's two blind spots, treating a typed input as computed ([#409](https://github.com/michal-niedzwiedzki/visimark/issues/409)) and proposing nothing for a table with a Total row, are engine issues. The merge rule in §3.5 keeps the first from hiding a confirmed finding here.
- **Anything from `feat/repo-prospect` not listed in §6.1.**
- **Authenticated GitHub API use in the widget.**

## 9. Open questions

None. Pre-review questions 1–15 are closed in §§2–6 as the discussion summary settled them. These four points are settled at decision time:

- Adopted repos are always investigated.
- `STALE` is confirmed and the other engine errors are leads.
- The widget pins the scan to a commit.
- The widget's headline word is "Wrong number".

<!--vmark:no-formulas-->
