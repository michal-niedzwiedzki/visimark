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
| §2.1 activation, status and ribbon | constraint 4, row 12, #232 | the gate's predicate, every status state's wording, and — since the row 12 harness (`test/harness/`, `onload.test.ts`) — that `onload` itself succeeds with no duplicate view registration, and that `refresh` actually reaches `HIDDEN` for an ordinary note and `VisiMark ✓` for `example-invoice.md` | that the bar (desktop) and the view-header icon (desktop and mobile) appear, read right, and open the findings view |
| §2.2 provenance and staleness | row 2 | *where* every mark goes, and that nothing uncomputed is marked | **everything about what is on screen**, in both renderers |
| §2.3 hover and tap | row 3 | the line's content — formula, result, inputs; and, since the row 12 harness, that a hover answers from a mark's own `data-vmark-path` rather than whichever note is active | the gesture, and that a cell answers for *that* cell |
| §2.4 the five commands | row 4 | Explain's caret resolution; Format's plan; and, since the row 12 harness, that Format refuses (with a notice, unchanged buffer) when the note changed while the vault read it started was still in flight | the palette, the dialogs, the presses |
| §2.5 nothing is written unbidden | constraint 3 | — | **all of it**, and on mobile, where an autosave is easiest to trigger |
| §2.6 format, declined artifact, format on save | rows 6–7, #239 | the repair plan, and that it converges on `fmt` | that the keystroke does it, silently, and that the setting's off default and command-palette limit hold |
| §2.7 `infer` on a pasted table | row 5 | that no existing byte is rewritten, by reconstruction | the preview, and the insertion landing where the plan said |
| §2.8 the vault sweep | row 8 | this section's own fixture, note for note | the phone: does it stay responsive, and does **Stop** stop it |
| §2.9 the plugin API | row 9 | every name compared against `eval --get` | that the object is there and nothing was reached past |
| §2.10 templates | row 10 | zero findings, and no Obsidian-only syntax | the insertion not changing the bytes |
| §2.11 portability, run last | all | — | **all of it, and it outranks every section above** |

### 2.1 Activation is opt-in per note — v1 constraint 4

- Open any ordinary note in the vault with no ```` ```vmark ```` block.
  **Pass:** no VisiMark UI appears anywhere — no status bar item, no
  view-header icon, no ribbon state, no decorations, and the note-scoped
  commands (Check, Format, Evaluate, Explain) do nothing visible. **Infer**,
  **Sweep the vault**, and the template commands are the exception by design
  (§2.3): they exist to act on a note with no block yet, or have no note to
  gate on at all, so they remain usable and may visibly insert text or open a
  view.
- Open `example-invoice.md`. **Pass:** VisiMark activates — on desktop, the
  status bar reads a state and a view-header icon appears in the note's own
  tab; `addStatusBarItem` is desktop-only (#232), so on a phone the
  view-header icon is the only witness, and it must appear there too.
- **Pass condition:** a vault of ordinary notes is indistinguishable from one
  without the plugin installed, on desktop and on a phone alike.

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
- **Try a note whose CSV import is missing.** Both renderers now decorate from
  the snapshot-backed analysis, the same one the status bar uses (2026-09-25
  review, row 6) — Live Preview shows no mark at all on a value that reads
  the import until the snapshot resolves, rather than asserting an answer
  computed without ever reading the file. **Pass:** once it resolves, an
  unresolved import's mark and the findings view agree — both `IMPORT`, never
  one of them silently `computed`.
- **Try a note whose CSV import disagrees with an anchored value** (a value
  written from the CSV before its data changed). **Pass:** the mark on that
  value is `disagrees`, not `computed` — the bug the review found was the
  opposite: a value that actually disagreed with its import rendered as if it
  did not, because the renderer that drew it had never read the file.
- **In reading mode, edit a scalar in one section of a note whose table in
  another section reads it**, then scroll back to the table without touching
  it. **Pass:** the table's marks update — `refreshState` rerenders every
  reading view of a note whose disagreeing set changed, since Obsidian's own
  post-processor re-runs only for the section whose text changed (row 7). Hover
  the table again first if you had already hovered it; **pass:** it explains
  the current formula, not whatever answer was cached before the edit.

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
  notes and come back. Do not invoke Format. Do not press Ctrl/Cmd+S.
- **Pass condition:** `git status` inside the vault reports the file unchanged.
  Not "changed and changed back" — unchanged. Repeat on mobile, where an
  autosave is easiest to trigger accidentally.
- With **Format on explicit save** left at its default (off, Settings →
  VisiMark), repeat the same steps but *do* type something and press
  Ctrl/Cmd+S a few times. **Pass condition:** the saved file contains exactly
  the tester's own edits and no VisiMark repair — not "unchanged": Obsidian's
  own save can land the typed edits on disk, so `git status` reporting a diff
  here is expected and the setting being off means that diff is the tester's
  alone.

### 2.6 Format, and the declined artifact write — v1 row 7

- With **Write chart artifacts** off (the default), open `example-charts.md`,
  break one input number by hand, and run Format.
- **Pass:** the computed cells are repaired; the chart SVGs are **not** written
  by the plugin.
- **Pass condition, exactly as the shipped CLI contract states it
  (`docs/cli-reference.md`, `--no-artifacts`):** declining the artifact write
  does not silence the finding. The stale chart must still be reported by the
  plugin's findings view. A plugin that hides the finding because it declined
  the write has inverted the contract.
- Turn on **Format on explicit save** (Settings → VisiMark). Break a computed
  cell in `example-invoice-drift.md` by hand and press Ctrl/Cmd+S.
  **Pass:** the cell repairs itself, silently — no notice, the same way
  Format's own "already clean" case has nothing to say when there is nothing
  worth reporting on a surface the reader did not ask a question of.
- **Also worth doing:** invoke the native save another way — the command
  palette's "Save file" — with the setting on. **Pass condition:** nothing
  repairs. This is the documented limit, not a bug: Obsidian has no event for
  an explicit save distinct from autosave, so the setting only answers the
  Ctrl/Cmd+S keystroke specifically.

### 2.6a Format actually writes a chart — v1.1 row 14

- Turn on **Write chart artifacts** (Settings → VisiMark; off by default).
  Open `example-charts.md`, break one input number by hand, and run Format.
  **Pass:** the computed cells are repaired, **and** the chart's SVG file in
  the vault is rewritten — open it (or the note that embeds it) and confirm
  the image changed. The notice says how many charts were written.
- Run Format again immediately, nothing changed. **Pass:** the notice says
  "Nothing to repair. No chart needed writing." — the chart is current, not
  regenerated a second time for nothing.
- **Pass condition — every claim §2.6 already made still holds with the
  setting on.** The chart being current now is a *result* of Format having
  run, not a relaxation of the finding: turn the setting back off, break the
  input again, and confirm the stale-chart finding still appears exactly as
  in §2.6, since `check`'s verdict has never depended on this setting.
- **Deliberately not covered by this row:** a per-finding "regenerate this
  chart" button in the findings view, the way other rows get a per-row
  repair. Format (whole-note) is the only entry point row 14 wires up; see
  #252's "what you considered and rejected" for why.

### 2.6b A CSV import stamps itself through Format — v1.1 row 16

Row 16 needed no new production code — see #254 for why the write-port
premise it was filed under did not hold, and
`editors/obsidian/test/csv-import.test.ts` for the automated proof. This
manual step is the "a person, not just a machine" half.

- Create a note in a subfolder, say `Finance/2026 Budget.md`, and a CSV
  beside it in a folder of its own, `Finance/data/rates.csv`, with a couple
  of rows of numbers.
- In the note, add:

  ```` markdown
  ```vmark #rates from data/rates.csv
  Mean = AVG(rates.Rate)
  ```
  ````

  (Column names match the CSV's header.)
- Run **Check this note**. **Pass:** one `IMPORT` finding, "unstamped
  import" — the path resolved (the CSV's rows are readable at all is proof
  of that; an unresolved path would be a different `IMPORT` message
  entirely) and the note is only waiting on a stamp.
- Run **Format this note**. **Pass:** the block's first line gains
  `at sha256:…`, and the `IMPORT` finding is gone. This is the same one
  `editor.transaction` every other repair goes through — no notice about a
  chart, because there is none in this note, and no setting to turn on
  first: nothing about the write half of row 16 was ever gated, since
  nothing here writes anything but the note itself.
- Edit `rates.csv` (change a number). Run **Check this note** again.
  **Pass:** `STALE`, not `IMPORT` — the stamp is present but no longer
  matches. Run **Format** again. **Pass:** the stamp updates to the new
  hash and the finding clears.

### 2.6c Fix unambiguous dates — v1.1 row 17

- With **Fix unambiguous dates** off (the default), open a note with a
  `DATE` finding on a decidable date — `example-invoice-drift.md`'s
  schedule table has one, `15.10.2026`. Run Format. **Pass:** every other
  repair applies; that date is untouched, and `DATE` still shows in
  Check.
- Turn the setting on. Run Format again. **Pass:** the date becomes
  `2026-10-15`, and `DATE` no longer shows for it.
- **Pass condition:** the ambiguous date in the same document
  (`11/12/2026`) is untouched either way — VisiMark cannot read it at all,
  and no setting here changes that. Same distinction the CLI's
  `--fix-dates` draws.
- **Pass condition:** no row in the findings view ever grows a repair
  button for a `DATE` finding, setting on or off — this is a whole-note
  Format behaviour, the same shape the CLI flag has, not a per-finding one.

### 2.7 `infer` on a pasted table — v1 row 5

- Paste a plain Markdown table with a visibly arithmetic column — or use
  `example-quote-plain.md`, the repository's worked example of a document with
  nothing wired up — and run Infer.
- Run **VisiMark: Infer the formulas**.
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
- Run **VisiMark: Sweep the vault**. **Pass:** exactly the three
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

### 2.8a The incremental vault index — v1.1 row 13

- Turn on **Sweep the vault on open** in settings. **Pass:** a scan starts
  immediately (no restart needed — the toggle starts it in this session too),
  and once it finishes, the ribbon icon carries a small numeric badge equal
  to the count §2.8's sweep would report.
- Fix one of the three drifting notes from §2.8's fixture (correct the total
  so it agrees with its formula again), then wait a second or two.
  **Pass:** the ribbon badge count drops by one, with no command run — the
  index is watching `vault.on("modify")`, not being asked.
- Open **VisiMark: Sweep the vault** again. **Pass:** the pane shows the
  current list immediately, with no "Looking at note…" progress — it is
  reading the index, not scanning. Break the note back the way it was, with
  the pane still open. **Pass:** the pane's list updates on its own while it
  is open, the same way the badge did.
- Click **Look again** in that pane. **Pass:** this does run a full scan
  (progress shows), which is the manual override that re-derives the index
  from scratch — the one path in this row that reports a note it could not
  read at all, rather than the incremental path's silent removal (see
  `vault-index.ts`'s module note on why).
- Rename one of the three drifting notes. **Pass:** the badge count is
  unchanged (the note still disagrees with itself, just at a new path), and
  the findings view opened from the sweep pane's new row opens the renamed
  file, not the old path.
- Delete one of the three drifting notes. **Pass:** the badge count drops
  by one within a couple of seconds, with no scan run.
- **What this does not claim**, and is not a fail if it does not hold: a
  change made to a note through something other than Obsidian itself — a
  sync client writing to the vault folder while the app is backgrounded, for
  instance — is not guaranteed to update the badge until **Look again** is
  run once. That gap is accepted, not hidden; §2.8's own "Look again" is
  what closes it.

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

- Run each of the four **VisiMark: Insert … template** commands into a new,
  empty note. They are the one family of commands that is **not** gated on the
  note already containing a block — see spec §2.3 — so try one on an ordinary
  note too, and expect it to work.
- **Pass:** the status bar flips to `VisiMark` as the template lands, because
  the note now has a block.
- **Pass condition:** the note passes `check` from the CLI with zero findings
  before anything is edited, and contains no syntax that means something only
  inside Obsidian (v1 constraint 5).

  Both halves of that condition are asserted by
  `editors/obsidian/test/templates.test.ts` over the documents themselves, so
  a failure here means the *insertion* changed the bytes — a trailing newline
  eaten, an indent added, a selection replaced that should not have been.
  That is the part only a person can check, and it is worth checking on the
  phone as well, where the editor is a different one.
- Try a template command again with the caret in the **middle of a sentence**
  in an otherwise-ordinary note. **Pass:** the template lands as its own
  block, on fresh lines, never sharing a line with the prose the caret was
  in (review row 21).
- Try a template command with the caret **inside a note that already has a
  VisiMark block**. **Pass:** a notice says the note already has one and
  points at inserting into a new note instead; nothing is inserted.

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

### Recording Part 2

Run 2026-09-24 through 2026-09-25, against Obsidian 1.13.7 on desktop, vault
`visimark` opened at the repository root, driven mostly through the `obsidian`
CLI rather than by hand.

| # | What | Result | Notes |
|---|------|---|---|
| 2.1 | Activation, status, ribbon | pass | |
| 2.2 | Provenance and staleness | pass | |
| 2.3 | Hover and tap | pass | |
| 2.4 | Five commands vs CLI | pass | |
| 2.5 | Nothing written unbidden | pass (desktop only) | no phone available this run |
| 2.6 | Format, declined artifact, format on save | pass | |
| 2.6a | Chart write on | pass | |
| 2.6b | CSV import stamping | pass, after a fix | two findings misdescribed a CSV import's own `IMPORT`/`STALE` states in `editors/obsidian/src/findings.ts`; fixed and merged as `4faaba2` |
| 2.6c | `fix-dates` | pass | |
| 2.7 | `infer` preview | pass | |
| 2.8 | Vault sweep | pass, verified at the data level | see the right-sidebar note below |
| 2.8a | Incremental vault index | pass, verified through `plugin.index` and the ribbon badge | every sub-check held: badge count on toggle, live drop on fix, live rise on re-break, "Look again" reseeding, rename preserving the disagreeing note at its new path with no count change, delete dropping the count with no scan |
| 2.9 | Plugin API | pass | |
| 2.10 | Templates | pass | all four templates land with zero CLI findings and flip the status bar; one template inserted into a note with existing content left the existing prose untouched and still passed `check` |
| 2.11 | Portability, run last | pass | every file touched in Part 2 gave the same findings from the CLI as the plugin showed; `bun test` (1834 tests) and `templates.test.ts` specifically both green; no Obsidian-only syntax in anything the plugin generated |

**The right sidebar could not be visually verified for §2.8 or §2.8a.**
Partway through an earlier session, a stray cleanup `eval` detached a live
workspace leaf and left the right-sidebar split in a state where new
`visimark-sweep`/`visimark-findings` leaves are created with a correct
*model* (`workspace.rightSplit` reports the right child count, width and
`display: flex`) but an orphaned *view*: `leaf.view.containerEl` — the actual
`.view-header`/`.view-content` DOM the `ItemView` builds — is never appended
into `leaf.containerEl`, so the pane paints nothing even though nothing
throws and `obsidian dev:errors` reports clean. A full `obsidian restart`
(process relaunch, not just a vault reload) does **not** clear it, and the
persisted `.obsidian/workspace.json` layout is structurally ordinary — this
is runtime attachment state, not saved-layout corruption. Core view types in
the same split (Backlinks, Outline, Tags, …) render normally throughout, so
this is specific to how these two custom leaves get re-attached after the
prior session's stray `.detach()` calls, not a general sidebar failure.
Every §2.8/§2.8a pass condition above was instead verified by driving the
same objects the pane would have drawn from (`plugin.index`, the ribbon
badge, and `SweepView.run()` called directly) — which is a check of the same
underlying state, but is not the same as watching the pane. This needs a
person, with a fresh vault window (not just a fresh app process), to confirm
the pane itself renders before this row can be called fully closed.

Obsidian version: 1.13.7  Platform(s): desktop only  Restricted Mode on: **Y**

<!--vmark:no-formulas-->
