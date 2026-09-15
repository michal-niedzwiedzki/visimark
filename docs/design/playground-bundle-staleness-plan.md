# Fix playground bundle staleness — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.5 (row 13, rated C). CI plumbing plus one
artifact rebuild — no paired spec, per the repo convention that non-vocabulary work does
not carry a design doc. Independent of §2.1–§2.4, which have landed.

**Goal:** Make it impossible for `docs/vendor/` to drift from
`packages/visimark/src/**` without CI saying so, and restore the live playground to the
engine set the docs claim shipped.

**Architecture:** No source change. One new CI job that rebuilds the committed bundle
and byte-compares it; one rebuild commit; one obsolete generated artifact retired at
the source rather than guarded.

**Tech Stack:** GitHub Actions, `bun build --minify`, plain HTML. No new dependency, no
TypeScript change.

---

## Findings from validating the review's brief

**The request is well founded — the user-visible failure is real and reproduced.** But
the brief's prescription is wrong in three places, two of which would have broken CI on
the first run.

### 1. Verified: the committed bundle is stale, and the engines really are missing

Measured on `master` at `53f13d2`, Bun 1.4.2, Linux:

| Check | Result |
|---|---|
| `git log -1 -- docs/vendor/visimark-browser.js` | `4e66265` (PR #82) — as the brief says |
| `"area"` in the committed bundle | **0 occurrences** |
| `"stacked-bar"` in the committed bundle | **0 occurrences** |
| `"pie"` / `"bar"` / `"line"` in the committed bundle | present |
| `"area"` / `"stacked-bar"` after `bun run build:playground` | present |
| `git diff --numstat` after rebuild | `50` insertions, `49` deletions |

`packages/visimark/src/artifact/index.ts:94-95` registers both engines. The deployed
bundle predates that. The brief's "47-line diff" is now 99 lines because §2.1–§2.4
have landed since the review; the conclusion is unchanged.

### 2. Verified: the build is byte-deterministic — on a fixed Bun

`bun run build:playground` three times in a row produces an identical SHA-256
(`e287ab0d…`). The brief asked for this confirmation and it holds.

**But it holds per Bun version, and CI does not fix the Bun version.** Every
`setup-bun` step in `.github/workflows/` uses `bun-version: latest`, while the repo
pins `"packageManager": "bun@1.4.2"` and the committed artifact was produced by that
pinned toolchain. A byte-exact comparison between an artifact built on 1.4.2 and one
rebuilt on whatever `latest` resolves to is comparing two different things, and any
Bun release that touches the minifier turns this guard into a red X on an unrelated
PR — a dependabot bump, say — with a failure message that points at the wrong cause.

This changes the plan: the check goes in **its own job with Bun pinned to the
`packageManager` version**, rather than appended to the `build` job as the brief
proposes. The `build` job keeps `latest` so the "VisiMark works on current Bun" signal
is not lost. Cost is one extra ~40-second job.

### 3. The brief's CI snippet would fail immediately: `gen-playground-data.mjs` is broken

The snippet runs `bun scripts/gen-playground-data.mjs`. That script throws:

```
error: logo data URI not found in docs/index.html
      at scripts/gen-playground-data.mjs:18:19
```

Its premise is obsolete. The script searches `docs/index.html` for a
`data:image/webp;base64,…` URI, on the stated grounds that the logo is "embedded in
`docs/index.html` … rather than a standalone image file". It is a standalone image
file: `docs/visimark.webp`, referenced directly by `index.html` at lines 7 and 26.

`git log -S 'data:image/webp;base64' -- docs/index.html` returns **nothing** — the URI
was never in that file under that path. It lived inline in the landing page at
`6ec759f` (#24) and was extracted to `visimark.webp` before the playground was written
at `34c75d0` (#51). `docs/vendor/playground-data.js` has never been regenerated since
that commit, and cannot be.

So there is no drift to guard on the second artifact; there is a dead script and a
22 KB hand-frozen base64 blob. See the decision below.

### 4. The brief's step 2 (`pages.yml` paths) is unnecessary once step 1 lands

The brief asks to add `packages/visimark/src/**` to the `pages.yml` `paths` filter, on
the grounds that "even a correctly-rebuilt bundle might not deploy if the same commit
touches nothing else under `docs/`".

A correctly-rebuilt bundle **is** a change under `docs/` — the build output path is
`docs/vendor/visimark-browser.js`. The two cases are exhaustive:

- the src change alters the bundle → `docs/vendor/` changes → `docs/**` matches → deploys;
- the src change does not alter the bundle → the deployed site is already correct → nothing to deploy.

Adding the src glob would instead trigger a Pages deploy of a byte-identical site on
every engine-unrelated source commit. Recommendation: **skip it.** Left in the plan as
a maintainer decision rather than dropped silently, since it is an explicit instruction
in the brief.

### 5. The rebuilt bundle passes the existing gates

`bun run format:check` is clean with the rebuilt bundle in place (oxfmt accepts it;
`.oxfmtrc.json` does not ignore `docs/vendor/`). `bun run lint` goes from 1,785 to
1,809 warnings, all still from that one file — §2.6's problem, untouched here.
`bun test` stays at 758 pass / 0 fail.

### Recommendation

Implement the guard as the brief intends, with the Bun pin from finding 2; commit the
rebuild as its own `fix:`; retire the dead `playground-data.js` path rather than
guarding an artifact that cannot be regenerated; skip the `pages.yml` change.

---

## Maintainer decisions (2026-09-15) — all three recommendations approved

**D1 — `playground-data.js` (finding 3).** The generator is broken and its premise is
gone. Two ways out:

- **(a) Retire it — recommended.** Delete `scripts/gen-playground-data.mjs` and
  `docs/vendor/playground-data.js`; give `<img id="logo">` a plain
  `src="visimark.webp"` and point the injected favicon at the same file; drop the
  `LOGO_DATA_URI` lines and the `<script src="./vendor/playground-data.js">` tag. The
  original reason for baking a data URI — the page being opened over `file://` — is
  already dead by the page's own account: the comment above those script tags says
  `playground.html` "must be served over http(s) … rather than opened directly via
  `file://`" because it `fetch()`es its starter documents. One fewer generated
  artifact, 22 KB less repo, and nothing left to keep in sync by hand.
- **(b) Repair it.** Rewrite the script to read `docs/visimark.webp` and base64 it,
  and include it in the Task 2 guard. Keeps the logo inline at the cost of keeping a
  generated file alive to serve one image that already sits next to it.

This is a (small) user-visible change to `docs/playground.html` — the logo becomes a
second HTTP request instead of an inline URI — so it is the maintainer's call, per the
repo rule that observable behaviour changes stop for sign-off.

**D2 — deployment model (the brief's "Consider, and raise with the maintainer").**
Building the bundle inside `pages.yml` would remove this failure mode at the root.
**Recommendation: keep it committed.** A plain clone plus `bun run serve` previews the
real site with no build step, `pages.yml` stays toolchain-free, and the Task 2 guard
closes the actual hole. Revisit if `docs/vendor/` ever grows a second build output.

**D3 — `pages.yml` paths (finding 4).** Recommendation: skip. Say so if you want it
added anyway.

### Answers

1. **D1 → (a), retire it.** Task 4 runs; `pages.yml` and `gen-playground-data.mjs` both
   leave the tree.
2. **D2 → keep the bundle committed.** `pages.yml` is not touched; the Task 2 guard is
   the whole mitigation.
3. **D3 → skip the `paths` change.** Finding 4's reasoning accepted; `pages.yml` is
   unchanged by this branch.

---

## Global Constraints

- **No source change.** `packages/visimark/src/**` is not touched. This is CI, one
  rebuilt artifact, and (under D1a) markup.
- **The rebuild is a pure artifact commit.** `docs/vendor/visimark-browser.js` is
  replaced by the verbatim output of `bun run build:playground` under Bun 1.4.2 — not
  hand-edited, not reformatted, not partially applied.
- **Do not `.gitignore` the bundle.** `docs/` is the deployed tree; removing the file
  breaks the playground, as the brief says.
- **The guard must be honest about why it failed.** Its error message names both
  causes — a forgotten rebuild *and* a Bun version mismatch — so the next person to
  hit it is not left guessing.
- **`bun test` stays at 758 pass / 0 fail**, `typecheck` clean, `format:check` clean.
  Lint warning count may move with the bundle; it stays 100% `docs/vendor/`.
- Conventional commits: `fix:` for the rebuild, `ci:` for the guard, `refactor:`/`fix:`
  for D1a.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 758 pass, 0 fail
bun run typecheck
bun run format:check
cd packages/visimark && bun run build:playground && cd ../..
git diff --exit-code -- docs/vendor/     # must be clean after Task 1
```

---

### Task 1: Commit the rebuild

**Files:**
- Modify: `docs/vendor/visimark-browser.js` (regenerated, not edited)

- [x] **Step 1.1** `cd packages/visimark && bun run build:playground`.
- [x] **Step 1.2** Confirm `"area"` and `"stacked-bar"` are now present in the output
      and that a second consecutive build leaves the file byte-identical.
- [x] **Step 1.3** Verification gate.

**Commit:** `fix: rebuild the playground bundle so the live engine set matches the docs`

Kept separate from Task 2 deliberately: this one restores correctness, the next
prevents recurrence.

---

### Task 2: The staleness guard (depends on D1)

**Files:**
- Modify: `.github/workflows/ci.yml`

A new top-level job, not a step inside `build`, so the Bun pin is scoped to the one
check that needs it (finding 2):

```yaml
  # docs/vendor/visimark-browser.js is a committed build artifact: pages.yml
  # uploads docs/ verbatim with no build step, so nothing else in the pipeline
  # would notice it drifting from packages/visimark/src/**. It did drift, for
  # two releases (see docs/reviews/2026-09-15.md §2.5).
  #
  # Bun is pinned to the packageManager version rather than `latest` because the
  # comparison is byte-exact against an artifact produced by that toolchain; a
  # minifier change in a newer Bun would otherwise fail this job for a reason
  # that has nothing to do with the PR.
  playground-bundle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: bun install --frozen-lockfile
      - name: the committed playground bundle must match the source
        run: |
          bun run --filter visimark build:playground
          if ! git diff --exit-code -- docs/vendor/; then
            echo "::error::docs/vendor/ is stale. Run 'bun run --filter visimark build:playground' and commit the result. If the diff looks like pure minifier churn, check that your local Bun matches packageManager in package.json."
            exit 1
          fi
```

- [x] **Step 2.1** Add the job. Under **D1b**, add the `gen-playground-data.mjs` run
      to the same step; under **D1a**, do not — there is nothing left to generate.
- [x] **Step 2.2** Confirm the guard actually bites: touch a string in
      `packages/visimark/src/playground/browser-entry.ts`, run the job's commands
      locally, confirm non-zero exit, then revert.
- [x] **Step 2.3** Verification gate.

**Commit:** `ci: fail the build when the committed playground bundle is stale`

---

### Task 3: Update the review document

**Files:**
- Modify: `docs/reviews/2026-09-15.md`

- [x] **Step 3.1** Add `**Status: DONE [PR#NN](…)**` under the §2.5 heading, matching
      the placement and wording used for §2.1–§2.4.
- [x] **Step 3.2** Verification gate.

**Commit:** folded into the final commit of the branch.

---

### Task 4: Retire `playground-data.js` — **D1a, approved**

**Files:**
- Delete: `scripts/gen-playground-data.mjs`
- Delete: `docs/vendor/playground-data.js`
- Modify: `docs/playground.html`

- [x] **Step 4.1** `<img id="logo" alt="VisiMark logo" />` at line 894 gains
      `src="visimark.webp"`; the favicon `<link>` is declared in `<head>` next to
      `index.html`'s rather than injected from JS.
- [x] **Step 4.2** Drop the `<script src="./vendor/playground-data.js">` tag, the
      `LOGO_DATA_URI` lines, and rewrite the script-tag comment above it — it
      currently explains a two-file arrangement that becomes a one-file arrangement,
      and the "contrast the logo above, which still is [baked]" aside becomes false.
- [x] **Step 4.3** `bun run serve`, open `/playground.html`, confirm the logo and
      favicon render and the console is clean.
- [x] **Step 4.4** Verification gate.

**Commit:** `fix: serve the playground logo from visimark.webp and drop the dead generator`

---

## Outcome

Three commits, no source change, one CI job added and two files deleted. 758 green
before and after; typecheck and `format:check` clean.

**The live failure is fixed.** The rebuilt bundle carries `area` and `stacked-bar`,
which the deployed one had not since #82. The diff was 99 lines, not the review's 47,
because §2.1–§2.4 landed in between.

**The guard was mutation-tested, not just written.** Changing one string literal in
`browser-entry.ts` makes `bun run --filter visimark build:playground` +
`git diff --exit-code -- docs/vendor/` exit non-zero; reverting it makes the check
pass. A comment-only change is *not* detected, which is correct — the minifier strips
comments, so the artifact genuinely has not changed.

Two things worth knowing that the plan did not anticipate:

- **`docs/vendor/` is not excluded from `oxfmt`.** `.oxfmtrc.json` ignores `**/*.md`
  and `.vscode/**` only, so `format:check` walks the 797 KB minified bundle on every
  run and passes it. Rebuilding therefore risked a format failure that never came.
  Worth keeping in mind for §2.6, which proposes an `ignorePatterns` list for oxlint —
  the two configs will read as parallel but cover different file sets.
- **`docs/playground.html:2185` still claims the page is "often opened straight off
  disk (`file://`)"**, contradicting the accurate comment eight hundred lines above it
  that says `fetch()` forces http(s). Left alone: it sits in the clipboard-fallback
  block and has nothing to do with the bundle. The `execCommand` fallback it justifies
  is still correct for plain-http mirrors regardless.

## Out of scope

- §2.6 (lint signal). The rebuild moves the warning count because the bundle changed;
  it does not change the fact that every warning comes from that one file. Fixing that
  is §2.6's job and would bury this change's diff.
- §2.7, §2.8.
- The stale `file://` comment at `docs/playground.html:2185`, which contradicts the
  accurate one at line 1207. Noted, not fixed — it is unrelated to the bundle and
  belongs with whatever next touches that block.
- Any change to `build:playground` itself, to the browser entry point, or to the engine
  registry.
