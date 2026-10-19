# Among required on best and deltas — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `report best` and `report deltas` require a trailing `among feasible|infeasible|all`, and `simulate` ranks only that population.

**Architecture:** The parser in `packages/visimark/src/lang/parser.ts` owns the synopsis and the parsed `among` word. `packages/visimark/src/lang/ast.ts` stores it on both report options. `packages/visimark/src/report/simulate.ts` owns who is ranked and the count line. `check` keeps printing a malformed report as the existing `TYPE`. No new module.

**Tech Stack:** TypeScript, Bun test runner, `bun run packages/visimark/src/cli/main.ts` for a session. No new dependency.

**Spec:** [`docs/design/among-is-required-on-best-and-deltas-spec.md`](among-is-required-on-best-and-deltas-spec.md)

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer `.agents/rules/ai-attribution.md` resolves for this session. Do not hardcode a vendor name.
- `bun test`, `bun run typecheck`, and `bun run build` are green after every task.
- No new [§10](../visimark-design.md#10-error-taxonomy) code. A bad clause is the malformed-report `TYPE` (spec §4).
- `ledger`, `gates`, and `forbidden` do not take `among`. Their synopses stay.
- `simulate` exit codes stay. A false assertion stays a reading. There is no `simulate --json`.
- `fmt` does not rewrite a `report` line, and does not insert `among`.
- An existing `deltas` line that is migrated so today's numbers stay gains `among all`. Do not rewrite it to `among feasible`.
- Shipped `best` lines that already say `among feasible` stay.
- Nouns stay uninflected: `1 feasible of 9 questions`, `chosen from 1 questions`.
- Do not close issue #351. Do not add a grammar table to `docs/cli-reference.md`.
- When a doc example nests a fence, the outer fence has one more backtick than the inner one (`.agents/rules/nested-code-fences.md`).

## Review Focus

These are the readings a reasonable author will hit first. Each one has a test in Task 2.

- A string scalar is a value, so the question is not faulted, and `best` on it still prints `no question evaluated` because nothing ranks. `deltas` on that string beside a number still counts the questions that have a number.
- `hours = 0` makes `margin / hours` unverified. Those three questions are faulted, so they leave every population. The `hours=20` questions verify `per_hour` as a negative number, so they stay infeasible and `among infeasible` still shows three of them.
- A file with no lattice prints `no grid: no param declares a lattice` for `feasible`, `infeasible`, and `all`. It does not print an empty-population line.
- The same refs with a different population are two reports. Two copies of the same line are `DUP`.
- `among` not last, or any other word, is the full synopsis. `report gates among all` stays `` `report gates` takes no options ``.

---

### Task 1: Grammar, and the lines that must still parse

**Files:**
- Modify: `packages/visimark/src/lang/ast.ts` (the `ReportOptions` union, around the `best` variant)
- Modify: `packages/visimark/src/lang/parser.ts` (`REPORT_SYNOPSIS` and `parseReport`, around lines 1050–1171)
- Test: `packages/visimark/test/lang/report.test.ts`
- Test: `packages/visimark/test/model/report-build.test.ts`
- Test: `packages/visimark/test/eval/report.test.ts`
- Test: `packages/visimark/test/simulation-acceptance.test.ts` (the best synopsis expectation)
- Test: `packages/visimark/test/eval/simulate.test.ts` (the `#broken` sheet's `report deltas` line)
- Test: `packages/visimark/test/report-nothing-to-read.test.ts`
- Modify, so `check` still passes and the quoted sessions still match: `packages/visimark/test/fixtures/simulation/simulate.md`, `packages/visimark/test/fixtures/simulation/levers.md`, `packages/visimark/test/simulate-acceptance.test.ts` (the report heading inside `BODY` only), `packages/visimark/test/report/simulate.test.ts` (the report heading inside each golden only), `docs/example-battery-storage.md`, `docs/tutorial/runway-sweep.md`, `docs/tutorial.md` (the quoted report line only), `docs/simulate/conference.md`
- Modify, so the package still typechecks: `packages/visimark/src/report/simulate.ts` (read `among`; the real ranking is Task 2)

**Interfaces:**
- Consumes: `REPORT_NAMES`, `ReportDecl.text` (the whitespace-normalised statement, already the `DUP` key).
- Produces: `export type ReportAmong = "feasible" | "infeasible" | "all"` from `ast.ts`. `deltas` options are `{ kind: "deltas"; on: Ref[]; among: ReportAmong }`. `best` options are `{ kind: "best"; scalar: Ref; direction: "max" | "min"; among: ReportAmong }`. `amongFeasible` is gone.

- [ ] **Step 1: Write the failing parser tests**

In `packages/visimark/test/lang/report.test.ts`, replace the optional-`among` expectations.

A line that parses:

```ts
const all = report("report deltas on plan.margin among all").options;
expect(all).toMatchObject({ kind: "deltas", among: "all" });

const inf = report("report best scalar margin direction min among infeasible").options;
expect(inf).toMatchObject({ kind: "best", direction: "min", among: "infeasible" });

expect(report("report deltas on all among all").text).toBe("report deltas on all among all");
expect(report("report best scalar margin direction max among feasible").text).toBe(
  "report best scalar margin direction max among feasible",
);
```

`report("report deltas")` and `report("report best scalar s.m direction max")` throw. The message is the new synopsis:

```ts
const BEST = "`report best` takes: scalar REF direction max|min among feasible|infeasible|all";
const DELTAS = "`report deltas` takes: [on REF {, REF}] among feasible|infeasible|all";
```

Use `BEST` for every bad `best` line already in the file, plus `report best scalar m direction max among all extra` and `report best scalar m direction max among other`. Use `DELTAS` for `report deltas`, `report deltas lines.margin`, `report deltas on`, `report deltas on a among`, and `report deltas among all on a`. `` `report gates` takes no options `` stays for `report gates among all`. `` `report ledger` takes: [assertions broken] `` stays for `report ledger among all`.

`report deltas on a, s.b` in the options tests becomes `report deltas on a, s.b among all`, and the expected `text` gains ` among all`. The bare-deltas options test (`on` equals `[]`) becomes `report("report deltas among feasible")`.

- [ ] **Step 2: Run the parser test and see it fail**

Run: `bun test packages/visimark/test/lang/report.test.ts`

Expected: FAIL. The synopsis still has brackets and only `feasible`, and a bare `report deltas` still parses.

- [ ] **Step 3: Change the AST and the parser**

In `ast.ts`, add `ReportAmong` and put `among: ReportAmong` on `deltas` and `best`. Delete `amongFeasible`.

In `parser.ts`, set the synopses to the strings in spec §4 (no brackets around `among`):

```ts
deltas: "[on REF {, REF}] among feasible|infeasible|all",
best: "scalar REF direction max|min among feasible|infeasible|all",
```

Parse the clause with one helper used by both reports. `on` stays optional and must come first. `among` is required and last. Any other word, a missing word, or a token after the word calls the existing `bad()`.

```ts
const amongWord = (): ReportAmong => {
  word("among");
  const w = at();
  if (
    w.kind !== "ident" ||
    (w.value !== "feasible" && w.value !== "infeasible" && w.value !== "all")
  ) {
    return bad();
  }
  i++;
  pieces.push(`among ${w.value}`);
  return w.value as ReportAmong;
};
```

Call it at the end of the `deltas` branch (after the optional `on` list, including when there is no `on`) and at the end of the `best` branch (after `direction`). Remove the optional `if (isWord("among"))` block. Store `among` on the options object. `text` already joins `pieces`, so the clause is in the `DUP` key.

`gates`, `forbidden`, and `ledger` have no call to `amongWord`. A trailing `among` on those names still hits `if (at().kind !== "eof") bad()`.

`simulate.ts` still has to compile. In `best`, replace `amongFeasible` with `among === "feasible"` in the three places that branch on it, and pass `r.options.among`. Leave `deltas` ranking as it is (every non-faulted question, no count line). `deltas` does not read `among` yet. Task 2 replaces both. This commit must not treat `among infeasible` as a finished reading.

- [ ] **Step 4: Run the parser test**

Run: `bun test packages/visimark/test/lang/report.test.ts`

Expected: PASS.

- [ ] **Step 5: Make every other parse expectation match**

Append ` among all` to every `report deltas` line that a test expects to parse, and ` among feasible` to every `report best` line that omits the clause and is expected to parse. Known sites:

- `packages/visimark/test/model/report-build.test.ts` — expected `text` and the source span include ` among all`.
- `packages/visimark/test/eval/report.test.ts` — each `report deltas on …` and the `report best scalar s.x direction max` line.
- `packages/visimark/test/simulation-acceptance.test.ts` — the expected best synopsis becomes the `BEST` string from step 1, and each `report deltas on …` that is expected to resolve gains ` among all`.
- `packages/visimark/test/eval/simulate.test.ts` — `report deltas on broken.bad among all`, so the sheet is still blocked on the fault and not on a synopsis `TYPE`.
- Fixtures and docs: `simulate.md`, `levers.md`, `conference.md`, `runway-sweep.md`, and both `report deltas` lines in `example-battery-storage.md` (`report deltas among all`, and `report deltas on debt.dscr_min, asset.soh_eol among all`).
- The same words inside expected stdout: the `BODY` heading in `simulate-acceptance.test.ts`, each deltas heading in `report/simulate.test.ts`, and the quoted report line in `docs/example-battery-storage.md` and `docs/tutorial.md`. Leave every low and high line as it is. Do not add a count line in this task.

`packages/visimark/test/fixtures/bakeoff-price-only/bakeoff.md` already says `among feasible`. Leave it.

- [ ] **Step 6: Point the nothing-to-read tests at the new split**

`packages/visimark/test/fixtures/simulation/bare-deltas.md` stays `report deltas` with no `among`.

In `report-nothing-to-read.test.ts`:

- Test 1 expects the `DELTAS` synopsis, not the nothing-to-read sentence. `details.message` is that synopsis. `code` is still `TYPE`, `location.name` is still absent, exit `1`.
- Test 2's clean line is `report deltas on plan.revenue among all`.
- Test 3's clean bodies use `report deltas among all` where they used `report deltas`. `report gates` and `report ledger` / `report forbidden` stay. The unparseable `x = (` case still does not contain `nothing to read`.
- Test 4's param-only sheet uses `report deltas among all` and still contains `nothing to read`.
- Test 8: two bare `report deltas` lines are two synopsis `TYPE`s.
- Test 9: two copies of `report deltas among all` are one nothing-to-read `TYPE` and one `DUP`. Two bare `report deltas` lines are not a `DUP`.

- [ ] **Step 7: Run the parse and check tests**

Run:

```bash
bun test packages/visimark/test/lang/report.test.ts packages/visimark/test/model/report-build.test.ts packages/visimark/test/eval/report.test.ts packages/visimark/test/report-nothing-to-read.test.ts packages/visimark/test/simulation-acceptance.test.ts packages/visimark/test/eval/simulate.test.ts
```

Expected: PASS. Then run `bun test` and `bun run typecheck` from the repo root. Expected: both green. `among infeasible` is parsed and not yet ranked; no acceptance test claims that it is.

- [ ] **Step 8: Commit**

```bash
git add packages/visimark/src/lang/ast.ts packages/visimark/src/lang/parser.ts packages/visimark/src/report/simulate.ts packages/visimark/test docs/example-battery-storage.md docs/tutorial/runway-sweep.md docs/tutorial.md docs/simulate/conference.md
git commit -m "$(printf 'feat: require among on report best and report deltas\n\n%s' '<the attribution trailer>')"
```

`deltas` still ranks every non-faulted question and prints no count line. Task 2 replaces that before the branch is ready for review. The pull request stays a draft until Task 3 is committed.

### Task 2: Rank the named population, and lock the transcript

**Files:**
- Modify: `packages/visimark/src/report/simulate.ts` (`body`, `deltas`, `best`)
- Create: `packages/visimark/test/fixtures/simulation/among.md` (spec §6, byte for byte)
- Create: `packages/visimark/test/among-acceptance.test.ts`
- Modify: `packages/visimark/test/simulate-acceptance.test.ts` (the `BODY` golden)
- Modify: `packages/visimark/test/report/simulate.test.ts` (each deltas golden)
- Modify: `docs/example-battery-storage.md` and `docs/tutorial.md` (add the count line to the quoted sessions)

**Interfaces:**
- Consumes: `ReportAmong` and `r.options.among` from Task 1. `View.feasible`, `View.infeasible`, `View.numOf`, `v.sim.gridSize`, `NO_GRID`.
- Produces: no new export. `best` and `deltas` take `among: ReportAmong` instead of `amongFeasible: boolean`.

- [ ] **Step 1: Write the failing acceptance test**

Create `packages/visimark/test/fixtures/simulation/among.md` as the fenced document in spec §6.

Create `packages/visimark/test/among-acceptance.test.ts` in the style of `simulate-acceptance.test.ts`: `runCli` with `now: () => 0`, so the duration is `0 ms`.

The clean `simulate` stdout is the `text` block in spec §6, including the padding on `low` and `high`. stderr is:

```text
simulate: <path>: 10 questions (2 lattice params)
simulate: <path>: 1 of 1 sheets ran in 0 ms
```

`check` on that file exits `0` and the output contains `0 problems`.

Add one test per further-case row in spec §6. Build each variant from `among.md` unless the row names another file. Expected bodies:

| Variant | Body that must appear |
|---|---|
| delete every `lattice` line | `no grid: no param declares a lattice` on each `best` and each `deltas`; exit `0`; the output does not contain `no feasible question` |
| `assert margin >= 2000`, then only `report best scalar margin direction max among feasible` and `report deltas on margin among feasible` | each body is exactly `no feasible question` |
| `assert margin >= -100000` and no `assert hours <= 15`, then the `infeasible` pair | each body is exactly `no infeasible question` |
| add `per_hour precision 2 = margin / hours` and `assert per_hour >= 0`, `best … direction max among all` | `hours=10 disc=0%`, `500.00`, `(0.00 against base)`, `chosen from 6 questions` |
| the same fault, `among infeasible` | `hours=20 disc=0%`, `-500.00`, `(-1000.00 against base)`, `chosen from 3 infeasible of 9 questions` |
| `label = "east"` and only `report deltas on label, margin among all` | `label  base ?`, no `low` under `label`, the `among all` margin low and high, `over 9 questions` |
| only `report best scalar label direction max among all` | the body is exactly `no question evaluated` |
| `report deltas among all` in a param-only sheet | the nothing-to-read `TYPE`; `check` exit `1` |
| `report deltas` with no `among` in that sheet | the `DELTAS` synopsis only; the output does not contain `nothing to read` |
| two copies of `report deltas on margin among all` | the second finding is `DUP` |
| `among all` and `among feasible` on the same refs | `check` exit `0` |
| `report gates among all` | `` `report gates` takes no options `` |
| `fmt` on `among.md` | stdout contains `unchanged` |
| `best scalar margin direction min among feasible` on a flat `flat precision 2 = 100.00` | `100.00`, `(0.00 against base)`, `chosen from 6 feasible of 9 questions`, `6 questions tie; the first in grid order is shown` |

The missing-clause test deletes every ` among …` tail from `among.md`. `check` exits `1`. stdout is the seven `TYPE` lines and the footer in spec §6, blank line between findings. `check --json` has `status` `"problems"`, `summary.errors` `7`, and each `details.message` equal to the sentence on that line.

- [ ] **Step 2: Run it and see it fail**

Run: `bun test packages/visimark/test/among-acceptance.test.ts`

Expected: FAIL. `among infeasible` is not a population yet, and `deltas` has no count line.

- [ ] **Step 3: Rank in `simulate.ts`**

Add two private helpers on `View`:

```ts
inPopulation(a: Answer, among: ReportAmong): boolean {
  if (among === "feasible") return this.feasible(a);
  if (among === "infeasible") return this.infeasible(a);
  return !a.faulted;
}

emptyPopulation(among: ReportAmong): string {
  if (among === "feasible") return "no feasible question";
  if (among === "infeasible") return "no infeasible question";
  return "no question evaluated";
}
```

`body` passes `r.options.among` into `deltas` and `best`.

`best` keeps the `gridSize === 0` check first and returns `[NO_GRID]`. Candidates are `v.grid.filter((a) => v.inPopulation(a, among) && v.numOf(a, id) !== undefined)`. An empty candidate list returns `[v.emptyPopulation(among)]` and nothing else. The winner loop stays `gt` / `lt`, so a tie keeps the first question in grid order. The count line is:

```ts
among === "all"
  ? `chosen from ${candidates.length} questions`
  : `chosen from ${candidates.length} ${among} of ${v.sim.gridSize} questions`
```

The tie line stays, and only on `best`, when `ties > 1`.

`deltas` keeps the `gridSize === 0` check first. The population is `v.grid.filter((a) => v.inPopulation(a, among))`. If it is empty, return `[v.emptyPopulation(among)]` and do not print a base line. If it is not empty, keep today's per-ref base line and the low/high table, iterating that population instead of every non-faulted question. A ref nobody in the population ranks keeps the base line and omits low and high. After the last ref, push one count line:

```ts
const ranked = population.filter((a) => ids.some((id) => v.numOf(a, id) !== undefined)).length;
const count =
  among === "all"
    ? `over ${ranked} questions`
    : `over ${ranked} ${among} of ${v.sim.gridSize} questions`;
```

Return that string with no extra indent. `renderSheet` adds the two leading spaces, which is the `  over 9 questions` in spec §6.

- [ ] **Step 4: Run the new acceptance test**

Run: `bun test packages/visimark/test/among-acceptance.test.ts`

Expected: PASS.

- [ ] **Step 5: Update the existing goldens**

`simulate.md`'s deltas line is already `report deltas on plan.margin among all` from Task 1. In `simulate-acceptance.test.ts` `BODY` and in every golden string in `packages/visimark/test/report/simulate.test.ts`:

- The heading matches the migrated line.
- Under a deltas report that ran, after the last ref, add the count line at the same indent as the base line.
- The clean nine-question plan, and the `margin >= 2000` plan (nobody faulted), say `  over 9 questions`. The low and high numbers stay.
- The `per_hour` golden has three faulted questions. Its deltas line is `among all`, the low and high stay, and the count is `  over 6 questions`.
- The no-lattice golden stays `no grid: no param declares a lattice` and gains no count line.
- `best … among feasible` blocks stay byte for byte, including `chosen from 6 feasible of 9 questions`.

`docs/example-battery-storage.md`: the source lines already end in `among all`. Run simulate and replace the quoted console blocks so they match the tool, including each new `over K questions` line. `docs/tutorial.md` chapter 31: same, against `docs/tutorial/runway-sweep.md`. The tests strip the duration before comparing, so leave the quoted duration in the form the page already uses.

- [ ] **Step 6: Run the simulate tests**

Run:

```bash
bun test packages/visimark/test/among-acceptance.test.ts packages/visimark/test/simulate-acceptance.test.ts packages/visimark/test/report/simulate.test.ts packages/visimark/test/example-battery-storage.test.ts packages/visimark/test/tutorial-sweep.test.ts packages/visimark/test/playground/pg-simulate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/report/simulate.ts packages/visimark/test docs/example-battery-storage.md docs/tutorial.md
git commit -m "$(printf 'feat: rank best and deltas inside the named population\n\n%s' '<the attribution trailer>')"
```

### Task 3: Documentation

**Files:**
- Modify: `docs/visimark-design.md` (the `report` paragraph in §4, around line 301)
- Modify: `docs/design/lattice-on-param-and-report-statements-spec.md` §2.2 and §4.2
- Modify: `docs/design/add-a-simulate-command-spec.md` §4 (the best and deltas bodies, and the `simulate.md` golden)
- Modify: `docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md` (the well-formed form)
- Modify: `docs/simulate.md`, `docs/ci.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/vocabulary-catalogue.md`

Do not edit `docs/cli-reference.md`. It does not list this grammar.

- [ ] **Step 1: Design doc and the three amended specs**

In `docs/visimark-design.md` §4, add one sentence to the `report` paragraph: `best` and `deltas` require a trailing `among feasible|infeasible|all`. Leave the rest of the paragraph, and leave the §10 `TYPE` row text, as they are.

In the lattice spec §2.2, replace the `deltas` and `best` grammar cells with spec §2 of this feature. Add `infeasible` and `all` to the sentence that lists contextual words. In §4.2, the malformed-options synopsis example loses the brackets and gains the three words. The nothing-to-read row stays, with the note that it applies to a parsed `report deltas among <word>` with no `on`.

In `add-a-simulate-command-spec.md` §4, the `best` and `deltas` bodies gain the three populations, the empty lines, and the deltas count line, matching spec §3 here. The embedded `simulate.md` golden gains ` among all` on the deltas line and `  over 9 questions` after its high line. `best` in that golden already says `among feasible`.

In the #333 spec, the well-formed empty-`on` line is `report deltas among feasible|infeasible|all`. A line with no `among` fails the synopsis and does not also emit the nothing-to-read sentence. The nothing-to-read sentence itself stays.

- [ ] **Step 2: Guide pages**

`docs/simulate.md`: every live or displayed `report deltas` line that omits `among` gains `among all`. Chapter 19 says `among all` is the range over every non-faulted question and `among feasible` is the range inside the rules. Sample sessions gain the count line. The synopsis table uses the required clause. The bare-deltas nothing-to-read example becomes `report deltas among all` when the point is #333, and stays a synopsis example when the point is a missing clause.

`docs/ci.md`: the displayed deltas line gains `among all`, and the sample session gains the count line.

`docs/simulate/conference.md` already gained `among all` in Task 1. If its prose quotes a deltas high, leave the number. The line now says the range is `all`.

- [ ] **Step 3: Changelog and the catalogue row**

Under `CHANGELOG.md` `## Unreleased` → `### Added`, one bullet: `report best` and `report deltas` require `among feasible|infeasible|all`. `all` is the range those reports used before. Omitting the clause is a `TYPE` and fails `check`. Link [#351](https://github.com/michal-niedzwiedzki/visimark/issues/351).

In `docs/vocabulary-catalogue.md`, delete the section E row for #351. Insert this row at the top of the Shipped table. `Landed` is this pull request. `Released` is `—`.

```markdown
| `among` required on `best` and `deltas` | language feature | [#351](https://github.com/michal-niedzwiedzki/visimark/issues/351) | [#354](https://github.com/michal-niedzwiedzki/visimark/pull/354) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/351#issuecomment-6004077852) |
```

- [ ] **Step 4: Full local checks**

Run from the repo root:

```bash
bun test
bun run typecheck
bun run build
bun run packages/visimark/src/cli/main.ts check docs/simulate/conference.md docs/example-battery-storage.md docs/tutorial/runway-sweep.md docs/simulate.md docs/tutorial.md docs/ci.md
```

`docs/simulate.md`, `docs/tutorial.md`, and `docs/ci.md` wrap examples in a display fence, so `check` stays green on those files even before the sample sessions are updated. The command is still the proof. `bunx visimark` is the published build. Do not use it.

Expected: all green. `check` prints `0 problems` for each named file.

- [ ] **Step 5: Commit**

```bash
git add docs/visimark-design.md docs/design/lattice-on-param-and-report-statements-spec.md docs/design/add-a-simulate-command-spec.md docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md docs/simulate.md docs/ci.md docs/simulate/conference.md CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: record required among on best and deltas\n\n%s' '<the attribution trailer>')"
```

Do not close #351. The row stays `UNRELEASED` until a tagged release.

<!--vmark:no-formulas-->
