# Pin the composite Action's default version — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.7 (row 18, rated B−). Action interface plus
CI plumbing and docs — no paired spec, per the repo convention that non-vocabulary work
does not carry a design doc (`close-toctou-path-gates-plan.md` and
`playground-bundle-staleness-plan.md` are the precedent).

**Goal:** A consumer who pins `uses: michal-niedzwiedzki/visimark@vX.Y.Z` gets the
engine that Action ref was tested against, every time, forever — and the pin cannot rot
silently across releases.

**Architecture:** No source change. One `action.yml` default, one CI guard that ties
that default to `packages/visimark/package.json`, one line in the release runbook, and
two stale documentation snippets corrected.

**Tech Stack:** GitHub Actions, bash, YAML. No new dependency, no TypeScript change.

---

## Findings from validating the review's brief

**The request is well founded, and the problem is worse than the brief says.** The
unpinned default is real; on top of it, both places that document how to call the Action
name a git ref that does not exist.

### 1. Verified: the default is `latest` and it is resolved at run time

`action.yml:26-29` declares `version` with `default: "latest"`, and line 58 runs
`npx --yes "visimark@$VISIMARK_VERSION"`. Pinning the Action ref pins the YAML, the
`setup-node` version and the shell — not the engine that does the work. The review's two
consequences both hold: a re-run of an unchanged commit can behave differently, and one
bad publish reaches every downstream consumer at once with no way to have opted out.

For a tool whose product claim is *proving* that numbers have not drifted, an unpinned
verifier is the sharpest version of this. Worth fixing.

### 2. New, and a live break: the documented Action ref does not exist

Both consumer-facing snippets say:

```yaml
- uses: michal-niedzwiedzki/visimark@v0.1.0
```

- `README.md:303`
- `docs/index.html:697` (the landing page's CI panel)

`git tag -l` and `git ls-remote origin` agree: the tags are **`v0.1.1`, `v0.1.2`,
`v0.1.3`**. There is no `v0.1.0` tag and no `v0.1.0` branch. A consumer who copies
either snippet gets `Unable to resolve action michal-niedzwiedzki/visimark@v0.1.0` and
the job fails before the Action runs at all.

`v0.1.0` is the hand-published npm mis-publish that `docs/releasing.md:8` and
`CHANGELOG.md:285` both record — a version number that was burned without ever being
tagged. The docs pinned to it and nothing has caught that since.

This is squarely inside §2.7's subject (what version a consumer actually gets), it is a
harder failure than the one the brief describes, and it is one line each. Folding it in.

### 3. There is no version-consistency guard anywhere in the repo

`grep` over `packages/*/test`, `editors/*/test` and `.github/workflows/ci.yml` finds
nothing that compares the version-carrying files. `docs/releasing.md` step 3 asks the
releaser to `grep -r '"version"' packages/*/package.json editors/*/package.json` **by
hand** and confirm the three agree. Adding a fourth place to bump without automating the
comparison makes that manual step worse, so the guard in Task 2 is not optional garnish
— it is what makes the pin safe to add.

### 4. The release window is real but narrow, and only bites unpinned consumers

If `action.yml`'s default must equal `packages/visimark/package.json`, then between the
`chore: release vX.Y.Z` commit landing on `master` and the tag's npm publish finishing,
`master`'s `action.yml` names a version that is not on the registry yet.

Who is exposed: only `uses: michal-niedzwiedzki/visimark@master`. A tag-pinned consumer
is never exposed, because the tag and the publish are the same event. Per
`docs/releasing.md`, the three manifests are bumped *in* the release commit and not
before, so outside that window `master` always names the last published version.

Nothing the repo publishes recommends `@master`. Accepting the window; naming it in a
comment so the next person to hit it knows it is deliberate.

### 5. The `dogfood` escape hatch is unaffected — but nothing tests the npx path

`.github/workflows/dogfood.yml` puts `node_modules/.bin` on `GITHUB_PATH`, and asserts
that `command -v visimark` resolves to the branch build before running the Action, so
every dogfood invocation takes the `command -v` branch and never reads `VISIMARK_VERSION`
at all. The brief's constraint ("do not touch the `command -v visimark` branch") is
honoured trivially by this change, which touches only the input default.

The flip side: **the `npx` branch is exercised by no workflow in this repo.** That is
pre-existing and not something §2.7 introduces, but it means the pinned default's
correctness rests entirely on the Task 2 guard rather than on anything executing it.
Raised as D3 below.

### Recommendation

Pin the default to the concrete release, guard it in CI against
`packages/visimark/package.json`, add one line to the release runbook, and fix the two
`@v0.1.0` snippets. Decisions D1–D3 below are the places where I would not choose for
the maintainer.

---

## Maintainer decisions — needed before Task 1

**D1 — how the default is expressed.**

- **(a) A literal pinned default — recommended.** `default: "0.1.3"` in `action.yml`,
  kept honest by the Task 2 CI guard and one line in `docs/releasing.md`. The
  consumer-facing interface states, in the file they read, exactly what they get.
  Cost: a fourth place to bump at release time, which the guard makes unmissable.
- **(b) Resolve it from the Action's own checkout.** `default: ""`, and the run step
  falls back to
  `node -p "require('$GITHUB_ACTION_PATH/packages/visimark/package.json').version"`.
  Because `uses: owner/repo@ref` clones the whole repository, the Action always resolves
  to the engine version of the ref the consumer pinned — self-pinning, nothing to bump,
  no guard needed, no way to rot. Cost: the default stops being visible in `action.yml`,
  which is the file a consumer reads to learn what the Action does, and the indirection
  needs a comment to be followable.

I lean (a) because this repo's house style is an explicit value plus a CI guard that
says why, not cleverness that removes the need for one — and because `action.yml` is
interface documentation as much as it is code. (b) is genuinely the more rot-proof
design and I will happily take it.

**D2 — how wide the Task 2 guard is.**

- **(a) `action.yml` against `packages/visimark/package.json` only — recommended.** The
  narrowest thing that makes D1a safe.
- **(b) All four manifests.** Also assert `packages/visimark`,
  `packages/visimark-lsp` and `editors/vscode` agree with each other, retiring the
  manual `grep` in `docs/releasing.md` step 3. Finding 3 says nothing checks this today,
  and `releasing.md`'s own "Rules that bite" table lists a version mismatch as a way to
  publish a broken release.
- **(c) (b) plus the two doc snippets**, asserting `README.md` and `docs/index.html` pin
  the current release tag. Catches finding 2 recurring. Costs a regex over prose, which
  is more brittle than reading JSON and can fail for cosmetic edits.

(b) is more value for the same job and I would take it, but it is scope beyond §2.7, so
it is your call. If you want the branch to stay minimal, (a).

**D3 — should CI prove the pinned default actually exists on npm?**

A step running `npm view "visimark@$(default)" version` would catch a pin to a version
that was never published — the exact class of mistake `v0.1.0` is. It also fails for the
whole release window in finding 4, and adds a network dependency to CI.

**Recommendation: no in `ci.yml`, yes in `docs/releasing.md`.** Add
`npm view visimark@X.Y.Z version` confirmation to the "Verify every leg" list, which is
run after the publish and so is on the right side of the window. Say if you would rather
have it as a CI step on `master` pushes only.

### Answers (2026-09-15)

1. **D1 → (a), the literal pinned default.** `action.yml` states `default: "0.1.3"` and
   the Task 2 guard keeps it honest. Task 1 takes its D1a form.
2. **D2 → (b), all four manifests.** The guard asserts `action.yml`'s default,
   `packages/visimark/package.json`, `packages/visimark-lsp/package.json` and
   `editors/vscode/package.json` all agree. All four read `0.1.3` today, so the guard is
   green on arrival. `docs/releasing.md` step 3's hand-run `grep` is replaced by a
   pointer at the guard.
3. **D3 → verify in the runbook, not in CI.** `ci.yml` makes no network call; the
   `npm view` confirmation of the pinned default joins "Verify every leg", which runs
   after the publish and so is on the right side of the window in finding 4.

---

## Global Constraints

- **No source change.** `packages/visimark/src/**` is not touched. This is `action.yml`,
  `ci.yml`, `docs/releasing.md`, `README.md` and `docs/index.html`.
- **Do not touch the `command -v visimark` branch** in `action.yml`'s run step. It is
  what lets `dogfood.yml` run the Action against the branch under test rather than the
  last published package; the long comment in `dogfood.yml` explains the `GITHUB_PATH`
  wiring that makes it work.
- **`$VISIMARK_ARGS` stays unquoted** so it word-splits into separate flags;
  `"${files[@]}"` stays quoted. Neither is a bug, neither gets "fixed".
- **`latest` must remain reachable.** A consumer who wants rolling updates sets
  `version: latest` explicitly; the input's `description` has to say so.
- **The guard must be honest about why it failed.** Its message names the file to edit
  and the file it must match, so the next person to hit it does not go looking.
- **`bun test` stays at 758 pass / 0 fail**, `typecheck` clean, `format:check` clean.
- Conventional commits: `fix:` for the pin and the stale snippets, `ci:` for the guard,
  `docs:` for the runbook line.
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
bun run lint
```

Plus, once Task 2 has landed, the guard's own commands run locally.

---

### Task 1: Pin the default (depends on D1)

**Files:**
- Modify: `action.yml`

Under **D1a**, the `version` input becomes:

```yaml
  version:
    description: >-
      visimark npm version or dist-tag to install. Defaults to the release this
      Action ref ships, so pinning the Action pins the engine too; set it to
      `latest` if you would rather track releases as they land.
    required: false
    default: "0.1.3"
```

with a comment above it recording that the default is asserted against
`packages/visimark/package.json` in `ci.yml`, so it is bumped by the release commit and
not by hand.

Under **D1b**, `default: ""` and the run step resolves it from `$GITHUB_ACTION_PATH`.

- [x] **Step 1.1** Apply the chosen form.
- [x] **Step 1.2** Confirm the `command -v visimark` branch is byte-identical to before
      (`git diff` shows only the input block).
- [x] **Step 1.3** Verification gate.

**Commit:** `fix: pin the composite Action's default engine version`

---

### Task 2: The version-consistency guard (depends on D1, D2)

**Files:**
- Modify: `.github/workflows/ci.yml`

Under **D1a + D2a**, a step in the existing `build` job (no new toolchain is needed, so
unlike §2.5's guard this does not warrant its own job):

```yaml
      # action.yml pins the engine version consumers get, so that pin has to move
      # with the release commit or a tag-pinned consumer silently keeps running an
      # older engine than the Action ref they pinned. Nothing else in the pipeline
      # reads action.yml, so nothing else would notice.
      - name: the Action's default version must match the engine
        run: |
          pinned=$(node -p "require('js-yaml')" 2>/dev/null >/dev/null; \
                   grep -A3 '^  version:' action.yml | sed -n 's/.*default: "\(.*\)".*/\1/p')
          engine=$(node -p "require('./packages/visimark/package.json').version")
          if [ "$pinned" != "$engine" ]; then
            echo "::error::action.yml pins visimark@$pinned but packages/visimark/package.json is $engine. Bump the action.yml default in the release commit."
            exit 1
          fi
```

The extraction must not depend on a YAML parser that is not a dependency — settle the
exact one-liner while implementing and keep it readable. Under **D2b**, extend the same
step to compare the three manifests, and delete the manual `grep` instruction from
`docs/releasing.md` step 3 in favour of pointing at this guard.

- [x] **Step 2.1** Add the step and settle the extraction.
- [x] **Step 2.2** Mutation-test it: change the `action.yml` default to a wrong value,
      run the step's commands locally, confirm non-zero exit and a message that names
      both files; revert.
- [x] **Step 2.3** Verification gate.

**Commit:** `ci: fail the build when the Action's pinned version drifts from the engine`

---

### Task 3: Fix the two `@v0.1.0` snippets (finding 2)

**Files:**
- Modify: `README.md` (line 303)
- Modify: `docs/index.html` (line 697)

- [x] **Step 3.1** Both become `uses: michal-niedzwiedzki/visimark@v0.1.3`.
- [x] **Step 3.2** Confirm no other file pins a non-existent ref:
      `grep -rn 'michal-niedzwiedzki/visimark@' --include='*.md' --include='*.html' .`
      (excluding `docs/vendor/`).
- [x] **Step 3.3** `bun run serve`, open `/`, confirm the CI panel renders the new ref.
- [x] **Step 3.4** Verification gate.

**Commit:** `fix: the documented Action ref must be a tag that exists`

---

### Task 4: Wire the pin into the release runbook

**Files:**
- Modify: `docs/releasing.md`

- [x] **Step 4.1** Extend "Before you tag" step 3 to name `action.yml`'s `version`
      default alongside the three manifests, and say the CI guard enforces it.
- [x] **Step 4.2** Add a row to the "Rules that bite" table: a stale `action.yml`
      default means every tag-pinned consumer runs an older engine than the Action ref
      they pinned, with nothing at run time to tell them.
- [x] **Step 4.3** Under **D3**, add `npm view visimark@X.Y.Z version` confirmation of
      the pinned default to "Verify every leg".
- [x] **Step 4.4** Verification gate.

**Commit:** `docs: the release checklist owns the Action's pinned version`

---

### Task 5: Update the review document

**Files:**
- Modify: `docs/reviews/2026-09-15.md`

- [x] **Step 5.1** Add `**Status: DONE [PR#97](…)**` under the §2.7 heading, matching
      the placement and wording used for §2.1–§2.5.
- [x] **Step 5.2** Verification gate.

**Commit:** folded into the final commit of the branch.

---

## Outcome

Five commits, no source change. 758 green before and after; `typecheck`,
`format:check` and the now-strict `bun run lint` all clean.

**The pin is in and the guard has teeth.** `action.yml` defaults to `0.1.3`, and
`ci.yml`'s "every version-carrying file must agree" step ties it to all three
manifests. All four read `0.1.3` today, so the guard was green on arrival — which
means it had to be mutation-tested rather than trusted. Four cases, each exiting
non-zero with the file named: a stale `action.yml` default, a drifted
`visimark-lsp` manifest, a drifted extension manifest, and the `default:` line
deleted outright. That last one matters most: an `awk` extraction that silently
stops matching would turn the guard into a permanent pass, so an empty read is a
hard failure telling the reader to fix the check rather than delete it.

**Finding 2 was the bigger bug.** The unpinned default was a reproducibility
problem; `@v0.1.0` in `README.md` and `docs/index.html` was a hard break, and had
been since those snippets were written. Anyone copying the documented usage got
`Unable to resolve action` before the Action ran at all. Verified fixed by serving
`docs/` and reading the rendered CI panel back.

Three things worth knowing that the plan did not anticipate:

- **A shared working tree cost more than the work did.** Two sessions (this one and
  §2.6) had one checkout between them, and two of §2.6's commits landed on this
  branch before either of us noticed. Recovered with `git reset --hard` to the
  branch point — nothing lost, nothing pushed — but `git worktree add` per session
  is the actual fix and is worth adopting before the next parallel pair.
- **Port 8080 was already serving a different tree.** `bun run serve` failed with
  `EADDRINUSE` and the verification `curl` silently hit someone else's server,
  which returned the *old* `@v0.1.0` panel and briefly looked like the edit had not
  applied. Verifying on an explicit free port is the honest form of that check.
- **Backticks in a GitHub Actions `run:` block are command substitution.** The
  first draft of the guard's error message wrote `` `version:` `` inside a
  double-quoted `echo`, which bash would have executed. Caught before committing;
  prose conventions and shell quoting do not mix.

## Out of scope

- §2.6 (lint signal) and §2.8 (`cmdExplain` / `build()`), both unstarted.
- Exercising the `npx` branch of `action.yml` in CI. Finding 5 notes that no workflow
  runs it; building a fixture consumer workflow that installs from the registry is a
  larger change than §2.7 and would make every CI run depend on npm being up.
- Pinning `actions/setup-node@v7` or the other Action refs to commit SHAs. That is the
  other half of "composite Action supply chain" and the review did not raise it; it
  deserves its own decision about Dependabot's `github-actions` ecosystem.
- Anything about `latest` as a *dist-tag* strategy on npm.
