# Obsidian: a manual test scenario

**Status of the thing under test.** `editors/obsidian` exists, builds, and
implements **all twelve of v1's rows**. Part 2 is runnable end to end.

What a machine asserts and what it cannot is set out in the table at the head
of Part 2. The short version: the questions that are about a *document* are
tested against the engine and the CLI, and the questions that are about a
*screen* are not tested at all. §2.2, §2.5 and §2.11 are where that gap is
widest.

**Part 1 has been run** — on 2026-09-23, against Obsidian 1.13.7 on desktop and
Android, before the fork-B decision on
[#176](https://github.com/michal-niedzwiedzki/visimark/issues/176), as that
decision required. The results are in *Recording Part 1* below and in
`visimark-design.md` §16. It is kept runnable, and is worth re-running against
a new Obsidian release: it needs no plugin, no build and no code — only
Obsidian and this repository.
It pays off a debt the design doc has carried since it was written:
`visimark-design.md` §16 records that **Obsidian was never tested**, and that
the belief it hides HTML comments in reading view "is unverified and no
document should claim it". Constraint 1 names Obsidian as a renderer a
VisiMark document must render correctly in. That claim has never been checked
by anyone.

**Record what you observe, not what you expect.** Every row below states what
constraint 1 *requires*. It deliberately does not state what Obsidian *does*,
because nobody knows, and writing a guess down is how the unverified §16 claim
got there in the first place.

---

## Part 1 — constraint 1, first hand, no plugin

### Setup

1. Install Obsidian (desktop) and, for §1.6, Obsidian on a phone.
2. Open this repository's `docs/` directory as a vault:
   **Open folder as vault** → select `<repo>/docs`.
3. When Obsidian offers to enable Restricted Mode, **accept it**. The whole
   point is an unmodified renderer with no community plugins. If a plugin is
   needed to make a document render, constraint 1 has failed.
4. Turn off **Settings → Editor → Readable line length** only if it stops you
   seeing a table's right-hand columns. Nothing else is changed.
5. Check both of Obsidian's renderers for every test below — they are
   different engines and can disagree:
   - **Reading mode** (`Ctrl/Cmd+E` toggles)
   - **Live Preview** (Settings → Editor → Default editing mode)

A third mode, **Source mode**, shows raw text and is not under test: it is
expected to show everything, including anchors.

### 1.1 Anchors must be invisible — the one that decides the rest

**File:** `example-invoice.md`

That document carries eight anchor comments in prose, for example at line 33:

```markdown
Net of tax the engagement comes to **23300.00**<!--vmark=lines.net_total--> PLN.
```

**Required:** the sentence reads `Net of tax the engagement comes to 23300.00 PLN.`
with `23300.00` in bold. No `<!--`, no `vmark=`, no `-->`, and no stray gap
where the comment sits.

**Check in reading mode and in Live Preview separately, and record each.**

**If this fails**, constraint 1 is broken today for every anchored document,
and that is a finding about the *format*, not about a plugin — file it as a
bug and it outranks the fork-B question entirely. A reader who sees
`<!--vmark=lines.net_total-->` in the middle of an invoice is the failure the
constraint exists to prevent.

### 1.2 `vmark` blocks render as ordinary code blocks

**File:** `example-invoice.md`, the four fenced blocks beginning at line 23.

**Required:** each ```` ```vmark ```` block renders as a plain, monospaced,
unhighlighted code block showing its text verbatim — `vat = 23%`,
`VAT precision 2 = Net * vat`, and so on. Alignment whitespace is preserved.

`vmark` is not a language Obsidian knows. The acceptable outcomes are "plain
code block" and nothing else: not hidden, not collapsed, not errored, not
reflowed, and not swallowed by a highlighter guessing at another language.

### 1.3 Tables, and the computed cells inside them

**File:** `example-invoice.md`, the line-items table at lines 16–21.

**Required:** a GFM table with six columns, every numeric cell shown exactly
as the bytes say — `2500.00`, `575.00`, `3075.00`. Trailing zeros intact.
Column alignment as the delimiter row specifies.

A computed cell is an ordinary table cell; this test confirms Obsidian does
not reformat numbers. If `2500.00` renders as `2500`, the format's core
promise — the number you see is the number in the file — is false in this
renderer.

### 1.4 Image anchors and relative artifact paths

**File:** `example-charts.md`, lines 36, 42, 47, 70, 75. Each is an image
followed immediately by an anchor comment:

```markdown
![revenue, cost and profit by month](charts/example-charts-sales.svg)<!--vmark=sales.performance-->
```

**Required:** five SVG charts render inline, and no anchor comment is visible.

This is the highest-risk row in Part 1. `charts/example-charts-sales.svg` is a
relative Markdown path; Obsidian resolves links by its own rules
(Settings → Files and links → **New link format** and **Default location for
new attachments**), which are not GitHub's. Record whether the image resolves
with the vault opened at `docs/`, and note the link-resolution settings in
force when you test.

**If the images resolve on GitHub but not in Obsidian**, that is a real
constraint-1 gap and a TOOLING issue in its own right, independent of any
plugin — a chart is "data in another form, committed beside the Markdown"
(`visimark-design.md` §18), and a renderer that cannot find it shows a broken
document.

### 1.5 The drift document is still readable when it is wrong

**File:** `example-invoice-drift.md`

This document's numbers disagree with their formulas on purpose — it is the
repository's worked example of a document that fails `check`.

**Required:** it renders exactly as cleanly as `example-invoice.md` does.
Obsidian has no idea anything is wrong and must not. Staleness is a finding
the tool reports, never something the format encodes, and a document that
renders differently when stale would mean the format leaked a machine concern
into the page.

### 1.6 The same six tests on a phone

Sync or copy `docs/` to Obsidian mobile (iOS or Android) and repeat §1.1
through §1.5 in reading mode.

Mobile is the entire reason fork B exists rather than being a VS Code feature,
so a mobile-only failure is decision-relevant in a way a desktop pass cannot
compensate for. Record the platform and the Obsidian version.

### 1.7 Frontmatter, which Obsidian adds on its own

**File:** a copy of `example-invoice.md`.

None of the worked examples has YAML frontmatter; Obsidian adds properties the
moment a user touches the Properties UI. Add one property (`tags: invoice`)
through Obsidian, save, then run against the copy:

```sh
bun run packages/visimark/src/cli/main.ts check <path-to-copy>
```

**Required:** exit `0`, zero findings — the frontmatter is prose as far as
VisiMark is concerned.

**If it does not**, every Obsidian user breaks their document by using a core
Obsidian feature, and that is a LANGUAGE or TOOLING bug that must be fixed
before a plugin is worth building. This is also the first real evidence for
whether v2 row 20 (publishing scalars to YAML properties) has a foundation.

### Recording Part 1

Run on 2026-09-23.

| # | What | Reading mode | Live Preview | Mobile | Notes |
|---|------|---|---|---|---|
| 1.1 | Anchors invisible | yes | **no** | yes | Live Preview shows `<!--vmark=…-->` as literal text, regardless of where the cursor is |
| 1.2 | `vmark` blocks plain | yes | yes | yes | Live Preview shows the block plain with the cursor outside it and reveals the fence with the cursor inside — ordinary Live Preview behaviour, and accepted |
| 1.3 | Table cells verbatim | yes | yes | yes | trailing zeros intact; computed cells render clean in both renderers |
| 1.4 | Chart images resolve | yes | yes | yes | relative `charts/*.svg` paths resolve with the vault opened at `docs/`; Live Preview renders the images clean but shows the image anchor at all times, focused or not — the §1.1 behaviour, and accepted with it |
| 1.5 | Drift doc renders clean | yes | yes | yes | indistinguishable from `example-invoice.md` in both renderers |
| 1.7 | Frontmatter survives `check` | n/a | n/a | n/a | exit code: 0, zero findings |

Obsidian version: 1.13.7  Platform(s): desktop + Android  Restricted Mode on: **Y**

**Any `no` in 1.1 or 1.3 is a format bug and outranks the fork-B decision.**

**1.1's Live Preview `no` was reviewed and accepted** on
[#176](https://github.com/michal-niedzwiedzki/visimark/issues/176), not
softened here: Live Preview is an editing surface, seeing the anchor while
authoring is useful rather than a defect, and reading mode — what a reader
actually encounters — is unaffected. The result is recorded in
`visimark-design.md` §16, which until now said the question was never asked.

---

## Part 2 — the v1 plugin acceptance script

**All of it is runnable.** v1's twelve rows are built, so every section below
is a test somebody can perform rather than a bar set for later. This is the
script written *before* the implementation, so the acceptance bar was set
first; each section names the v1 row from #176 that it accepts and states a
single pass condition.

The table records which row made each section runnable, and **how much of it a
machine already asserts** — because the rows where a machine asserts little or
nothing are the ones that most need a person.

| Section | Row | Asserted by a machine | Left to a person |
|---|---|---|---|
| §2.1 activation, status and ribbon | constraint 4, row 12 | the gate's predicate, and every status state's wording | that the bar appears, reads right, and opens the findings view |
| §2.2 provenance and staleness | row 2 | *where* every mark goes, and that nothing uncomputed is marked | **everything about what is on screen**, in both renderers |
| §2.3 hover and tap | row 3 | the line's content — formula, result, inputs | the gesture, and that a cell answers for *that* cell |
| §2.4 the five commands | row 4 | Explain's caret resolution; Format's plan | the palette, the dialogs, the presses |
| §2.5 nothing is written unbidden | constraint 3 | — | **all of it**, and on mobile, where an autosave is easiest to trigger |
| §2.6 format, declined artifact | rows 6–7 | the repair plan, and that it converges on `fmt` | format-on-save, which is still row 7 |
| §2.7 `infer` on a pasted table | row 5 | that no existing byte is rewritten, by reconstruction | the preview, and the insertion landing where the plan said |
| §2.8 the vault sweep | row 8 | this section's own fixture, note for note | the phone: does it stay responsive, and does **Stop** stop it |
| §2.9 the plugin API | row 9 | every name compared against `eval --get` | that the object is there and nothing was reached past |
| §2.10 templates | row 10 | zero findings, and no Obsidian-only syntax | the insertion not changing the bytes |
| §2.11 portability, run last | all | — | **all of it, and it outranks every section above** |

### 2.1 Activation is opt-in per note — v1 constraint 4

- Open any ordinary note in the vault with no ```` ```vmark ```` block.
  **Pass:** no VisiMark UI appears anywhere — no status bar item, no ribbon
  state, no decorations, no commands doing anything visible.
- Open `example-invoice.md`. **Pass:** VisiMark activates.
- **Pass condition:** a vault of ordinary notes is indistinguishable from one
  without the plugin installed.

### 2.2 Provenance and staleness in reading mode — v1 row 2

- Open `example-invoice.md`. **Pass:** every computed value is marked as
  computed, in reading mode *and* Live Preview, and no marking is visible in
  source mode's raw bytes.
- Open `example-invoice-drift.md`. **Pass:** the values that disagree with
  their formulas are distinguishable from the ones that agree.
- **Pass condition, and this is the one that matters:** copy both files out of
  the vault and open them on GitHub. They must render exactly as they did
  before the plugin existed. Any decoration that survives into the file is a
  constraint-1 violation and a failed acceptance, whatever it looks like in
  Obsidian.
- **Audience-B check (v1 constraint 6):** no red, no `STALE`, no
  "1 problem", no exit code anywhere in the UI. The mark is a hairline under
  the value and a doubled line when it disagrees — deliberately not a colour,
  because a red number says *error* to someone trained by build logs and
  *something is wrong with my document* to someone who has not been. Judge
  whether it is findable when looked for and invisible when reading; that is
  the whole of the design and it is the one thing no test can answer.
- **The mapping is the part most likely to be wrong**, and it is different in
  each renderer. Live Preview decorates source offsets, which cannot land on
  the wrong value. Reading mode addresses a table cell by its grid position
  but finds a prose value by matching its text among elements of its own kind —
  so the case to try deliberately is **two identical bold numbers in one
  paragraph where only one is anchored**. The mark landing on the other one is
  the known limit; anything else is a defect.
- **Try a note whose CSV import is missing.** Live Preview decorates without
  waiting for the vault snapshot, so it checks a note whose imports are
  unresolved. The values must not be marked as disagreeing — an unresolved
  import is `IMPORT`, not `STALE` — and the findings view, which does wait,
  must say what is wrong.

### 2.3 Hover and tap — v1 row 3

- Hover a computed value on desktop; tap it on the phone. **Pass:** a popover
  naming the formula, its inputs and the result.
- Check a value whose formula reads another sheet — `terms.eur_total` in
  `example-invoice.md` is `lines.gross_total / fx_eur`. **Pass:** the
  cross-sheet input is named.
- **Pass condition:** the popover's numbers are byte-identical to what
  `bun run packages/visimark/src/cli/main.ts explain docs/example-invoice.md`
  prints for the same binding.

  The line's *content* — the formula, the result and what it reads, with a
  cross-sheet input named — is asserted in
  `editors/obsidian/test/hover.test.ts`, against the same API row 9 compares
  to the engine. So a failure here is about the **gesture**: the wrong element
  answered, or none did.
- **A cell must say what that cell comes to**, not what its whole column does.
  Hover the four `Net` cells in `example-invoice.md` and expect four different
  numbers. This is the one thing a column's explanation gets wrong if the row
  is not carried through, and it looks plausible when it is wrong.
- **Tap, do not hover, on the phone.** There is no hover there, which is why
  the tap opens the same dialog Explain does rather than a tooltip. A tap on an
  ordinary number must do nothing at all.

### 2.4 The five commands — v1 row 4

For each of **Check this note**, **Format this note**, **Infer the formulas**,
**Evaluate this note** and **Explain this value**, run the command from the
palette on `example-invoice.md` and on `example-invoice-drift.md`.

- **Pass condition:** each result matches the CLI's result for the same file,
  run from the repository. This is the acceptance for "one engine, thin
  client", and it is a diff, not an impression.
- **Explain** needs the caret on a value first. Try all three places a caret
  plausibly is: on an anchored number in a sentence, inside the
  `<!--vmark=…-->` comment behind it, and on the line that declares the name.
  All three answer with the same name, and `at-cursor.test.ts` pins that. A
  caret in ordinary prose must say to move it rather than explain something
  nearby.
- **Format** on the drifted note repairs every value and writes **no chart**;
  the stale-chart row stays in the findings view. That is the
  `--no-artifacts` contract, and §2.6 is where it is checked properly.

### 2.5 Nothing is written without an explicit act — v1 constraint 3

- Open `example-invoice-drift.md`, let it sit, type in it, scroll it, switch
  notes and come back. Do not invoke Format.
- **Pass condition:** `git status` inside the vault reports the file unchanged.
  Not "changed and changed back" — unchanged. Repeat on mobile, where an
  autosave is easiest to trigger accidentally.

### 2.6 Format, and the declined artifact write — v1 row 7

- Open `example-charts.md`, break one input number by hand, and run Format.
- **Pass:** the computed cells are repaired; the chart SVGs are **not** written
  by the plugin.
- **Pass condition, exactly as the shipped CLI contract states it
  (`docs/cli-reference.md`, `--no-artifacts`):** declining the artifact write
  does not silence the finding. The stale chart must still be reported by the
  plugin's findings view. A plugin that hides the finding because it declined
  the write has inverted the contract.

### 2.7 `infer` on a pasted table — v1 row 5

- Paste a plain Markdown table with a visibly arithmetic column — or use
  `example-quote-plain.md`, the repository's worked example of a document with
  nothing wired up — and run Infer.
- Run **VisiMark: Work out the formulas**.
- **Pass:** a preview of what would be inserted, before anything is inserted —
  the block as it will appear, not a summary of it.
- **Pass condition:** accepting the preview inserts a ```` ```vmark ```` block
  and rewrites **no existing byte** of the table. Verify with `git diff`, not
  by eye: `planInfer` only inserts.

  `editors/obsidian/test/infer-plan.test.ts` asserts this more strongly than a
  diff can — it deletes exactly the inserted ranges out of the result and
  requires the original document back, byte for byte — and asserts that
  accepting it on `example-quote-plain.md` leaves a document `check` reports
  **zero** findings in. So a failure here means the insertion, not the plan:
  the editor put the text somewhere else than the plan said.
- **Also worth doing:** select one table in a note that has two, and run it
  again. Only the selected table should be proposed for — and selecting a
  single character inside a table should propose for the whole of it.

### 2.8 The vault sweep — v1 row 8

- Copy `example-invoice-drift.md` to three different folders in the vault under
  three names, and leave a dozen ordinary notes around them.
- Run **VisiMark: Look through the vault**. **Pass:** exactly the three
  disagreeing notes are listed; no ordinary note appears; the clean
  `example-invoice.md` does not appear.

  That fixture is asserted, note for note, by
  `editors/obsidian/test/sweep.test.ts`. Running it here is worth doing anyway
  — it is the only place the real vault, the real reader and the real pane meet
  — but a failure means the wiring, not the sweep.
- **Pass condition:** the list is reachable and legible on the phone, since
  this is the row that justifies fork B over the VS Code extension.
- **The part only a phone can answer.** The sweep hands the thread back every
  fifty notes, and the numbers that say it needs to are a desktop measurement
  extrapolated (spec §2.4). On the largest vault available, and on the phone:
  does the app keep answering taps while the count moves, and does **Stop**
  stop it? Record the vault's note count and what it felt like. If it is not
  acceptable, that is the first real evidence for v1.1 row 13's index, and it
  belongs on that row rather than being absorbed here.

### 2.9 The plugin API — v1 row 9

- With the console open, call the documented API for a value in
  `example-invoice.md` — for instance `lines.gross_total`.
- **Pass condition:** the answer equals
  `bun run packages/visimark/src/cli/main.ts eval docs/example-invoice.md --get lines.gross_total`
  — which prints `28659`, not `28659.00`: the width is the cell's and the value
  is the value — and the call is made against the documented surface with no
  reach into plugin internals. This is spike check 2 shipped, so it is accepted
  the way the spike states it: a caller that sees only the types.

  The arithmetic half is asserted in `editors/obsidian/test/api.test.ts`,
  against the engine, for every name in the document rather than the one.
  **What only this console can check is the second half**: that
  `app.plugins.plugins["visimark"].api` is there, that `apiVersion` is `1`, and
  that nothing you had to reach past it to get the answer.

### 2.10 Templates — v1 row 10

- Insert each template into a new note.
- **Pass condition:** the note passes `check` from the CLI with zero findings
  before anything is edited, and contains no syntax that means something only
  inside Obsidian (v1 constraint 5).

### 2.11 The portability test, run last and run on everything

Take every note touched anywhere in Part 2, copy them out of the vault, and:

```sh
bun run packages/visimark/src/cli/main.ts check <each file>
```

then open each on GitHub.

- **Pass condition:** every file gives the same findings as the plugin showed,
  and renders on GitHub as ordinary Markdown with nothing Obsidian-specific in
  it.

**This section is the acceptance for the whole of v1.** A plugin that is
pleasant inside Obsidian and leaves files that only work inside Obsidian has
failed, however well every other section scored.

<!--vmark:no-formulas-->
