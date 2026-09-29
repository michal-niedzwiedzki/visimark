# `nbsp` display rule for string anchors — implementation plan

**Spec:** [`docs/design/nbsp-display-rule-for-string-anchors-spec.md`](nbsp-display-rule-for-string-anchors-spec.md)

## Goal

Add `nbsp` as the second entry in the closed display-rule registry, exactly as
the spec defines it. The work has four parts:

- a string-only rule that joins the stored words with `&nbsp;`;
- an in-place round-trip proof before anything is written;
- a text branch in both `check`'s `STALE` gate and `fmt`'s write-back gate;
- a `TYPE` message built from the registry.

This PR also carries one unrelated maintainer commit, the numbered-open-questions
change to the issue workflow (`4e2fedd`). The maintainer folded it in when
approving this plan.

## Architecture

- **`packages/visimark/src/eval/display-rules.ts`** owns the registry. It gets:
  - two new `DisplayRule` fields, `accepted: string` and `inlineCode: boolean`;
  - the `nbsp` entry and its `nbspDisplay` renderer;
  - `displayRuleTypeMessage()`, the single builder for the shared `TYPE`
    message;
  - `markdownSyntaxIn(s)`, which lists the characters the round-trip message
    names.
- **`packages/visimark/src/eval/display-round-trip.ts`** (new) owns the
  round-trip proof (spec §3 step 1). It is the only module that re-parses, and
  it calls `locate` from `parse/document.ts`. Keeping it out of `check.ts` stops
  that file's evaluation loop from growing a parser dependency inline.
- **`packages/visimark/src/parse/document.ts`** adds `RawAnchor.valueText?`
  (the decoded text of a `strong` or `emphasis` target's single text child) and
  `RawAnchor.delimiters?` (the open and close delimiter source, for the
  message). The grammar is unchanged.
- **`packages/visimark/src/eval/check.ts`** owns the new findings:
  - the code-span `ANCHOR`, in the per-anchor pre-loop;
  - the round-trip `ANCHOR` and the string `STALE`, in a new branch beside the
    numeric `STALE` branch;
  - the registry-built `TYPE` message.
- **`packages/visimark/src/eval/check-report.ts`** switches the chart-image
  `TYPE` message to the builder.
- **`packages/visimark/src/write/fmt.ts`** gets a text branch before the
  `prec === undefined` skip.

## Tech Stack

TypeScript, the Bun test runner, `remark-parse` + `remark-gfm` (already
dependencies, through `locate`), and the repo's own CLI via
`bun run packages/visimark/src/cli/main.ts` for acceptance sessions. Do not use
`bunx visimark`, which runs the published build. No new dependency.

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer that
  `.agents/rules/ai-attribution.md` resolves to for the session doing the work.
  Do not hardcode a vendor name.
- `bun test`, `bun run typecheck` and `bun run build` stay green after every
  task.
- `bun run packages/visimark/src/cli/main.ts check` exits `0` on every
  document in `.github/workflows/dogfood.yml`'s `files:` list and on
  `packages/visimark/test/fixtures/display-rule-percent.md`.
- `matchesStored` is **not** modified (spec §5). `percentDisplay`,
  `isPercentText` and every `percent` finding are unchanged, except the shared
  `TYPE` parenthetical.
- Nothing in `cli/`, `eval/evaluate.ts`, `infer/`, `report/json.ts` or the
  anchor grammar (`ANCHOR_RE`) changes. `eval`, `explain` and `--json` are
  untouched (spec §5).
- No `.skip` or `.only` is left in tests, and no assertion is loosened to pass.

---

## Task 1: Carry the numbered-open-questions commit

**Files:** `.agents/commands/issue-decide.md`, `.agents/commands/issue-discuss.md`,
`.agents/commands/issue-prepare.md`, `.agents/commands/issue-review.md`,
`.github/ISSUE_TEMPLATE/language-feature.yml`, through the cherry-pick only.

**Interfaces:** none.

- [ ] `git cherry-pick 4e2fedd` onto `issue/305-nbsp-display-rule-for-string-anchors-impl`.
      It applies cleanly to `origin/master` at `f80690b`. The commit is the
      maintainer's own and keeps its original message and trailer. Do not
      amend it.
- [ ] Run `bun test` and confirm it is green. The commit touches only Markdown
      and YAML.
- [ ] Add one line to the draft PR #309 body saying that the PR carries
      `4e2fedd` ("number open questions so they can be answered by number"),
      folded in at the maintainer's request.

## Task 2: Registry — `nbsp`, the new fields, the message builder

**Files:** `packages/visimark/src/eval/display-rules.ts`,
`packages/visimark/test/eval/display-rules.test.ts`.

**Interfaces:**

```ts
export interface DisplayRule {
  accepts(v: Value): boolean;
  render(v: Value, places: number): string;
  accepted: string;    // "numeric only" | "string only"
  inlineCode: boolean; // percent: true, nbsp: false
}
export function nbspDisplay(v: Value): string;             // throws on non-str, like percentDisplay
export function displayRuleTypeMessage(): string;          // built from DISPLAY_RULES in insertion order
export const MARKDOWN_SYNTAX_CHARS: readonly string[];     // ["\\", "`", "*", "_", "[", "]", "<", "&", "~"]
export function markdownSyntaxIn(s: string): string[];     // distinct, in order of first appearance
```

- [ ] Add `nbspDisplay`: `v.s.trim().split(/\s+/).join("&nbsp;")`. It throws
      `nbspDisplay expects a string` on a non-`str` value. Its `places`
      argument is accepted and ignored so it fits `render`'s signature.
- [ ] Add `accepted` and `inlineCode` to `percent` (`"numeric only"`, `true`)
      and add `nbsp` (`accepts: v.t === "str"`, `render: nbspDisplay`,
      `"string only"`, `false`). Keep the null-prototype `Object.assign`
      construction, with `percent` inserted first.
- [ ] Add `displayRuleTypeMessage()`. It returns
      `` `a display rule is only legal on a value it accepts (${entries.map(([n, r]) => `${n}: ${r.accepted}`).join("; ")})` ``.
      With today's registry that is
      `a display rule is only legal on a value it accepts (percent: numeric only; nbsp: string only)`.
- [ ] Add `markdownSyntaxIn(s)` over the fixed set
      `` \ ` * _ [ ] < & ~ `` (spec §4).
- [ ] Tests in `display-rules.test.ts`:
  - [ ] Change `the registry holds exactly one entry, percent` to expect
        `["percent", "nbsp"]` and rename it to match.
  - [ ] `nbspDisplay` over every spec §3 rendering input:
        - `past due` → `past&nbsp;due`
        - `paid in full` → `paid&nbsp;in&nbsp;full`
        - `"  past   due "` → `past&nbsp;due`
        - `past` U+00A0 `due` → `past&nbsp;due`
        - `settled` → `settled`
        - `user_id` → `user_id`
        - `""` → `""`
        - `"   "` → `""`
        - a tab or newline between words → one `&nbsp;`
  - [ ] `nbsp.accepts`: true for `str`, false for `num` and `date`.
  - [ ] `displayRuleTypeMessage()` equals the literal above.
  - [ ] `markdownSyntaxIn("a *b* c")` → `["*"]`;
        ``markdownSyntaxIn("run `ls` now")`` → ``["`"]``;
        `markdownSyntaxIn("already&nbsp;joined")` → `["&"]`;
        `markdownSyntaxIn("www.example.com")` → `[]`;
        `markdownSyntaxIn("_a_ *b*")` → `["_", "*"]`.

## Task 3: Anchor target text and delimiters

**Files:** `packages/visimark/src/parse/document.ts`,
`packages/visimark/test/parse/document.test.ts`.

**Interfaces:**

```ts
export interface RawAnchor {
  // …existing fields…
  /** decoded value of a strong/emphasis target's single text child */
  valueText?: string;
  /** the target's own delimiter source, e.g. { open: "**", close: "**" } */
  delimiters?: { open: string; close: string };
}
```

- [ ] In `collectAnchors`, when `prev` is `strong` or `emphasis` and
      `innerValueSpan(prev)` is non-null, set `valueText` to the text child's
      `value`. Set `delimiters` to
      `{ open: source.slice(prev.start, span.start), close: source.slice(span.end, prev.end) }`.
      Set neither field for any other target kind. `source` is already in
      scope.
- [ ] Tests in `document.test.ts`:
  - [ ] `**past&nbsp;due**<!--vmark=s.a|nbsp-->` gives `valueText` equal to
        `"past due"`, `delimiters` `{open:"**",close:"**"}`, and a value
        span covering the 13 raw source characters.
  - [ ] `_user_id_<!--vmark=s.a-->` gives `valueText` `"user_id"` and
        delimiters `_`/`_`.
  - [ ] An `inlineCode` or text target carries neither field.

## Task 4: The round-trip proof

**Files:** `packages/visimark/src/eval/display-round-trip.ts` (new),
`packages/visimark/test/eval/display-round-trip.test.ts` (new).

**Interfaces:**

```ts
import type { RawAnchor } from "../parse/document.js";
/** spec §3 step 1: splice `rendered` into `source` at the anchor's value span,
 *  re-parse, and prove the anchor still targets the same node kind wrapping one
 *  text child whose source is exactly `rendered` and whose decoded value is
 *  `expected`. */
export function roundTrips(
  source: string,
  anchor: RawAnchor,
  rendered: string,
  expected: string,
): boolean;
```

- [ ] Return `false` at once when `rendered === ""`.
- [ ] Build `spliced = source.slice(0, v.start) + rendered + source.slice(v.end)`
      and call `locate(spliced)`. Shift `commentSpan.start` by
      `rendered.length − (v.end − v.start)` and find the anchor in the result
      whose `commentSpan.start` equals the shifted value. All of these must
      hold:
      - that anchor exists;
      - its `value.kind` equals the original anchor's;
      - `value.start === v.start`;
      - `value.end === v.start + rendered.length`;
      - `valueText === expected`.

      `innerValueSpan` already returns `null` unless the node has exactly one
      text child.
- [ ] Tests, each on a whole small document that also holds a `vmark` block,
      so the re-parse sees realistic context:
  - [ ] `**past&nbsp;due**` → true.
  - [ ] `**_**` with `past&nbsp;due` → true.
  - [ ] `*…*` with `past&nbsp;due` → true.
  - [ ] `_user_id_` → true.
  - [ ] `a&nbsp;*b*&nbsp;c` → false.
  - [ ] ``run&nbsp;`ls`&nbsp;now`` → false.
  - [ ] `already&nbsp;joined` against expected `"already&nbsp;joined"` → false.
  - [ ] `""` → false.
  - [ ] `www.example.com` → false (GFM autolink).
  - [ ] `x**_**y` spliced with `"a"` → false (flanking in context). The same
        in isolation, `**"a"**`, → true, which proves the splice is in place.
  - [ ] A document defining `[foo]: https://example.com`, with `**_**`
        spliced to `[foo]` → false.

## Task 5: `check` — the code-span refusal, the text branch, the `TYPE` builder

**Files:** `packages/visimark/src/eval/check.ts`,
`packages/visimark/src/eval/check-report.ts`,
`packages/visimark/test/eval/check.test.ts`.

**Interfaces:** no exported signature changes. `CheckResult.refusedAnchors`
and `staleScalars` are reused.

- [ ] **Code-span refusal.** In the per-anchor pre-loop (today
      `for (const a of valueAnchorsOf(model, binding.id)) { if (a.value!.kind !== "text") continue; … }`),
      handle `a.value.kind === "inlineCode"` before the text-only `continue`.
      When `a.displayRule` names a registered rule with `inlineCode === false`,
      add the anchor to `refusedAnchors` and emit `ANCHOR`
      ``display rule `${a.displayRule}` cannot render inside a code span — wrap the seed in **…** or *…* instead``,
      with `sourceOffset` / `span` on `a.commentSpan`. The check does not look
      at the value type (spec §4: both findings).
- [ ] **`TYPE` builder.** Replace both literal
      `"a display rule is only legal on a value it accepts (percent: numeric only)"`
      strings, in `check.ts` and in `check-report.ts`, with
      `displayRuleTypeMessage()`.
- [ ] **Text branch.** After the existing numeric `STALE` block, add:
  ```ts
  if (!sigilBlocked && v.t === "str") {
    for (const a of registeredMine) {
      if (refusedAnchors.has(a.commentSpan.start)) continue;
      // spec §3 step 1, then step 2
    }
  }
  ```
  - `rendered = rule.render(v, 0)` and `expected = v.s.trim().split(/\s+/).join(" ")`.
    When `v.s.trim() === ""`, `expected` is `""`.
  - If `!roundTrips(model.source, a, rendered, expected)`, add the anchor to
    `refusedAnchors` and emit `ANCHOR`. Let `d = a.delimiters` and
    `inside = `${d.open}…${d.close}``. The message is:
    - when `rendered === ""`: ``display rule `${a.displayRule}` cannot write an empty value inside ${inside}``;
    - when `markdownSyntaxIn(v.s)` is non-empty:
      ``display rule `${a.displayRule}` cannot write this value inside ${inside} and read it back unchanged — it contains Markdown syntax: ${chars.join(" ")}``;
    - otherwise the same sentence without the `— it contains …` tail.
  - Otherwise compare `source.slice(a.value.start, a.value.end) !== rendered`.
    On a mismatch, add the binding to `staleScalars` and, under the same
    `!isCrossSheetAggregate` guard as the numeric branch, emit `STALE` with
    `stored` = the span, `computed` = `rendered`,
    `formula: formulaText(model, binding)` and `span` = the value span.
  - `registeredMine` excludes unknown names already. Wrong-type anchors never
    reach this branch, because `sigilBlocked` is set.
- [ ] Tests in `check.test.ts`, using the file's existing `run(src)` helper.
      Cover every spec §3 row that `check` decides:
  - [ ] Clean: `**past&nbsp;due**` with `past due`.
  - [ ] Drifted: `STALE` with `stored` `past&nbsp;due` and `computed`
        `paid&nbsp;in&nbsp;full`.
  - [ ] `**_**` → `STALE` `_`.
  - [ ] Hand-typed `past due`, `past` U+00A0 `due` and `past&#160;due` → each
        `STALE`.
  - [ ] Single word → clean.
  - [ ] Extra whitespace in the stored value → clean.
  - [ ] Stored U+00A0 → clean.
  - [ ] `user_id` in `**…**` and in `_…_` → clean.
  - [ ] Round-trip refusals, with the exact messages from spec §6:
        `a *b* c`, ``run `ls` now``, `already&nbsp;joined`, `""`, `"   "`,
        `www.example.com` (no character tail), and `"a"` in `x**_**y`
        (no tail).
  - [ ] Code span on a string → one `ANCHOR`.
  - [ ] Code span on a number → `TYPE` and `ANCHOR`.
  - [ ] `|nbsp` on a date → `TYPE`.
  - [ ] An unknown rule in a code span → only the unknown-rule `ANCHOR`.
  - [ ] A plain `**past due**<!--vmark=s.status-->` with a drifted value → no
        finding.
  - [ ] A string binding whose expression is unevaluable upstream → no
        `|nbsp` finding.
  - [ ] Two `|nbsp` anchors of one scalar, one current and one stale →
        exactly one `STALE`.
  - [ ] The `&nbsp;&nbsp;` separator beside an anchor → clean.

## Task 6: `fmt` — the text write-back branch

**Files:** `packages/visimark/src/write/fmt.ts`,
`packages/visimark/test/write/fmt.test.ts`.

**Interfaces:** none new.

- [ ] In `planFmt` section 2 ("anchored scalar values"), after the
      `refusedAnchors` skip and the `v` lookup, and **before**
      `const prec = result.scalarPrecision.get(id); if (prec === undefined) continue;`,
      add the following:
  ```ts
  if (v.t === "str") {
    const rule = a.displayRule !== undefined ? DISPLAY_RULES[a.displayRule] : undefined;
    if (!rule || sigilBlocked.has(id)) continue;
    const wanted = rule.render(v, 0);
    if (current !== wanted) edits.push({ start: a.value.start, end: a.value.end, text: wanted, finding: findingFor(a.value.start, a.value.end) });
    continue;
  }
  ```
  `current` is already computed above that line. Move its declaration up if
  needed. A `str` value with no rule is skipped, as it is today.
- [ ] Tests in `fmt.test.ts`:
  - [ ] Drift is rewritten, and a second `fmt` produces no edits.
  - [ ] `**_**` is seeded.
  - [ ] `past&#160;due` is normalised to `past&nbsp;due`.
  - [ ] A refused round-trip anchor (`a *b* c`) is not written.
  - [ ] A code-span anchor is not written.
  - [ ] A plain string anchor is not written.
  - [ ] Two `|nbsp` anchors of one drifted scalar, in `**…**` and `*…*`, are
        both written in one run, and the result passes `check`.
  - [ ] The `&nbsp;&nbsp;` separator and a plain anchor next to them are
        byte-identical after `fmt`.

## Task 7: Fixtures and CLI acceptance

**Files:** `packages/visimark/test/fixtures/display-rule-nbsp.md` (new),
`packages/visimark/test/fixtures/display-rule-nbsp-errors.md` (new),
`packages/visimark/test/cli/cli.test.ts`.

- [ ] Create both fixtures **byte-for-byte** as written in spec §6.
- [ ] CLI tests, following the `display-rule-percent` tests' pattern
      (`capture()`, `runCli`, `mkdtempSync` for the mutating cases):
  - [ ] `check display-rule-nbsp.md` → exit `0`, `0 problems`.
  - [ ] `eval --json` → `values["s.status"] === "past due"`.
  - [ ] `explain` does not contain `status|nbsp`.
  - [ ] Drift: copy the fixture with `status = "paid in full"`. `check`
        exits `1`, and its output contains
        `past&nbsp;due ≠ paid&nbsp;in&nbsp;full`,
        `3 prose anchors bound to the values above` and
        `5 problems (5 stale, 0 errors)`. `fmt` exits `0` and its output
        contains `updated 2 anchors`. The file then contains the spec §6
        status line verbatim and `**past due**<!--vmark=s.status-->`
        unchanged. A second `fmt` prints `unchanged`, and `check` exits `0`.
  - [ ] Errors fixture: `check` exits `1`, and its output contains each of
        the nine finding lines in spec §6 (`toContain` per message) and
        `9 problems (0 stale, 9 errors)`. `fmt` on a temp copy prints
        `unchanged`, and the copy is byte-identical afterwards.
  - [ ] The existing `display-rule-errors.md` test still passes unmodified,
        because it asserts the `TYPE` prefix only.
- [ ] Run the spec §6 sessions by hand with
      `bun run packages/visimark/src/cli/main.ts check|fmt …` and compare the
      output literally against the spec, including column alignment. If
      the literal output differs from the spec only in ordering or spacing
      that the spec got wrong, correct the spec in the same commit and say so
      in the commit message. If it differs in substance, stop and raise it
      with the maintainer.

## Task 8: Documentation

**Files:** `docs/visimark-design.md`, `docs/tutorial.md`,
`docs/cli-reference.md`, `CHANGELOG.md`, `editors/vscode/CHANGELOG.md`,
`editors/obsidian/CHANGELOG.md`, `docs/vocabulary-catalogue.md`, and the
generated outputs listed at the end of this task.

- [ ] `docs/visimark-design.md` [§3](../visimark-design.md#3-document-model),
      the display-rule paragraph (starts "An optional `|name` suffix"):
      - Say that the registry has two entries.
      - Add `nbsp`: string-only; the stored words joined with the `&nbsp;`
        entity; the span compared byte-for-byte; every rendering proved by an
        in-place re-parse before `fmt` writes it, and refused as `ANCHOR`
        otherwise; refused in a code span.
      - Change "a date or a string for `percent`" to also cover "a number or a
        date for `nbsp`".
- [ ] Same section, the anchor-acceptance paragraph (ends "…which the old
      numeric requirement prevented."): add one sentence. A plain string
      anchor is still not compared with its prose. A `|nbsp` anchor is.
- [ ] [§9](../visimark-design.md#9-write-back), first paragraph:
      - Replace the stale "An anchored value with a `%` comment" with "An
        anchored value with a display rule".
      - Add that `|nbsp` is the one case where `fmt` writes an author-supplied
        string into prose, and only after the round trip proves it.
- [ ] [§10](../visimark-design.md#10-error-taxonomy):
      - `TYPE` row: "(a date or a string for `percent`; a number or a date for
        `nbsp`)".
      - `ANCHOR` row: append ", a display rule that cannot render in a code
        span, or a string display rule whose rendering would not read back as
        the stored text".
      - `STALE` row: unchanged (spec §4).
      - The `ANCHOR` widening paragraph below the table: add one sentence for
        the same two cases.
- [ ] `docs/tutorial.md` ch. 9, "One current limit":
      - Numeric anchors are checked. `|nbsp` string anchors are checked
        (chapter 15).
      - A plain string anchor and a date anchor are still left alone, with no
        `STALE`.
      - Keep the advice for plain string and date anchors.
- [ ] `docs/tutorial.md` ch. 15, the "What `|percent` refuses" table: update
      the `TYPE` message to the registry-built text.
- [ ] Add a new subsection after it, `### A multi-word string: add \`|nbsp\``,
      marked *New after 0.1.10: this ships in the next release.*:
      - the motivating before and after from spec §1;
      - the drift `STALE` line and the `fmt` result from spec §6;
      - a short table of what `|nbsp` refuses (code span, value with Markdown
        syntax, empty value, non-string);
      - the note that `fmt` and `infer --write` never add `|nbsp`.
      - Also change "chapter 15 covers only `percent`; nothing else ships yet"
        in the `|percent` intro so it names both rules.
- [ ] `docs/cli-reference.md`:
      - `fmt` row: "Repairs stale numbers" becomes "Repairs stale values",
        or equivalent wording that covers `|nbsp` strings.
      - `ANCHOR` row: add "a display rule it cannot render there (a code span,
        or a string that would not read back as itself)".
- [ ] `CHANGELOG.md`: add an entry under `## Unreleased` → `### Added`, in the
      bold-lead-sentence style of the entries already there. It covers the
      `|nbsp` display rule for string anchors, the new `STALE` coverage, the
      round-trip refusal, the code-span refusal, and the `TYPE` message now
      naming every rule. Link #305.
- [ ] `editors/vscode/CHANGELOG.md`: add `## Unreleased` above `0.1.10`, if
      absent. The one-line entry: a `|nbsp` anchor on a string value now gets
      a `STALE` diagnostic when its prose drifts, plus a formatting fix, and
      `ANCHOR` when the value cannot be written there.
      `docs/releasing.md` allows an `## Unreleased` section in this file.
- [ ] `editors/obsidian/CHANGELOG.md`: add the same one-liner under the
      existing `## Unreleased`.
- [ ] `docs/vocabulary-catalogue.md`: move the #305 row out of section E into
      the Shipped register as `UNRELEASED`, condensed to that table's columns:
      - `Name`: `` `nbsp` display rule for string anchors ``
      - `Kind`: `language feature`
      - `Request`: [#305](https://github.com/michal-niedzwiedzki/visimark/issues/305)
      - `Landed`: [#309](https://github.com/michal-niedzwiedzki/visimark/pull/309)
      - `Released`: `—`
      - `Decision`: [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/305#issuecomment-5892873150)

      Put it at the top of the register, above the #297 row. Update the prose
      line under section E's table ("… shipped, and … landed unreleased") if
      it lists unreleased features.
- [ ] Regenerate every derived file that CI compares:
      - `bun run gen:docs` (`docs/visimark-design.md`, `docs/tutorial.html`,
        `docs/function-reference.md`, …);
      - `bun run gen:mcp` (`packages/visimark-mcp/docs/cli-reference.md`,
        `skill.md`);
      - `bun run --filter visimark build:playground` (`docs/vendor/`, under
        the pinned Bun `1.4.2`);
      - `bun run gen:examples` and `bun run gen:articles`, if their outputs
        change.

      Commit the results.
- [ ] Run `bun run packages/visimark/src/cli/main.ts check` over every file in
      `dogfood.yml`'s `files:` list, plus both new fixtures, and confirm exit
      `0` (the errors fixture excepted, which exits `1` by design).
- [ ] Neither this plan nor the PR promotes the row to `SHIPPED` or closes
      #305. `release.yml` does both at the next tag.
