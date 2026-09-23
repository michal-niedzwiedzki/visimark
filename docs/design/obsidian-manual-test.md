# Obsidian: a manual test scenario

**Status of the thing under test.** `editors/obsidian` exists and builds, and
**§2.1 is the only section of Part 2 that can be run.** v1 row 1
([#200](https://github.com/michal-niedzwiedzki/visimark/issues/200)) ships the
browser bundle, the activation gate and one status bar item; every other
section below accepts a row that is not implemented. Each states which.

The negative half of §2.1 — an ordinary note shows nothing — was true of an
empty plugin too, so it is worth little on its own; the half that means
something is that `example-invoice.md` activates and an ordinary note does
not, and that is what row 1 makes runnable.

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

**Runnable one section at a time, as the rows land.** This is the script to
run against the `editors/obsidian` build, written before the implementation so
the acceptance bar was set first. Each section names the v1 row from #176 that
it accepts, and each states a single pass condition. A section whose row is not
implemented is not a failure; it is not yet a test.

| Section | Row | Runnable |
|---|---|---|
| §2.1 activation | v1 constraint 4 | **yes**, since [#200](https://github.com/michal-niedzwiedzki/visimark/issues/200) |
| §2.2 – §2.11 | v1 rows 2–10 | not yet |

Run every section in **Restricted Mode with only the VisiMark plugin
enabled**, on desktop and on a phone.

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
  "1 problem", no exit code anywhere in the UI.

### 2.3 Hover and tap — v1 row 3

- Hover a computed value on desktop; tap it on the phone. **Pass:** a popover
  naming the formula, its inputs and the result.
- Check a value whose formula reads another sheet — `terms.eur_total` in
  `example-invoice.md` is `lines.gross_total / fx_eur`. **Pass:** the
  cross-sheet input is named.
- **Pass condition:** the popover's numbers are byte-identical to what
  `bun run packages/visimark/src/cli/main.ts explain docs/example-invoice.md`
  prints for the same binding.

### 2.4 The five commands — v1 row 4

For each of Check, Format, Infer, Evaluate, Explain, run the command from the
palette on `example-invoice.md` and on `example-invoice-drift.md`.

- **Pass condition:** each result matches the CLI's result for the same file,
  run from the repository. This is the acceptance for "one engine, thin
  client", and it is a diff, not an impression.

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
- **Pass:** a preview of what would be inserted, before anything is inserted.
- **Pass condition:** accepting the preview inserts a ```` ```vmark ```` block
  and rewrites **no existing byte** of the table. Verify with `git diff`, not
  by eye: `planInfer` only inserts.

### 2.8 The vault sweep — v1 row 8

- Copy `example-invoice-drift.md` to three different folders in the vault under
  three names, and leave a dozen ordinary notes around them.
- Run the sweep. **Pass:** exactly the three disagreeing notes are listed;
  no ordinary note appears; the clean `example-invoice.md` does not appear.
- **Pass condition:** the list is reachable and legible on the phone, since
  this is the row that justifies fork B over the VS Code extension.

### 2.9 The plugin API — v1 row 9

- With the console open, call the documented API for a value in
  `example-invoice.md` — for instance `lines.gross_total`.
- **Pass condition:** the answer equals
  `bun run packages/visimark/src/cli/main.ts eval docs/example-invoice.md --get lines.gross_total`,
  and the call is made against the documented surface with no reach into
  plugin internals. This is spike check 2 shipped, so it is accepted the way
  the spike states it: a caller that sees only the types.

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
