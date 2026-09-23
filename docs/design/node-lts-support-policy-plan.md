# Node LTS support policy — implementation plan

**Spec:** [`docs/design/node-lts-support-policy-spec.md`](../docs/design/node-lts-support-policy-spec.md)

## Goal

Close the two gaps the spec identifies that `#183` did not: `action.yml`'s
composite Action still hardcodes a stale `node-version: 20`, invisible to the
`node-support-policy` guard's `.github/workflows/`-only scope, and the
`CONTRIBUTING.md` edit `#183` shipped breaks a Markdown fence. Both are small,
independent fixes against current `master` (the core policy is already live).

## Architecture

No architectural change — this edits one workflow step's grep scope, one
composite-Action YAML value, and one paragraph of prose. No new files, no new
jobs, no new dependencies.

## Tech Stack

Bash (the existing `node-support-policy` job steps), GitHub Actions YAML,
Markdown.

## Global Constraints

- Follow `.agents/rules/ai-attribution.md` for this session's commit trailer —
  do not hardcode a vendor name.
- No CLI surface changes; verify with `bun run packages/visimark/src/cli/main.ts check` on the example documents already protected by CI (this change touches none of them, so this is a no-op check, not a new fixture).
- `bun test`, `bun run typecheck`, and `bun run build` must stay green after every task.

## Task 1: Widen `node-support-policy`'s numeric-pin grep to cover `action.yml`

- [ ] Update the guard's scanned scope and the `action.yml` pin itself.

**Files:**
- `.github/workflows/ci.yml`
- `action.yml`

**Interfaces:** none (no code interface; a CI job's grep target list).

**Steps:**
1. In `.github/workflows/ci.yml`, in the `node-support-policy` job's "no
   workflow pins a numeric Node version" step, change
   `grep -rnE '^[[:space:]]*node-version(-file)?:' .github/workflows/` to
   scan `.github/workflows/` **and** `action.yml` (e.g. pass both paths to
   the same `grep -r`). Update the step's own comment block, which currently
   says "no workflow pins a numeric Node version" and describes only
   `.github/workflows/` — it must state that `action.yml` is covered too, and
   why (it is the one artifact a downstream consumer's CI actually invokes).
2. Rename the step from "no workflow pins a numeric Node version" to "no
   workflow or action.yml pins a numeric Node version" (or equivalent), so a
   failing run's job-summary line names the real scope.
3. In `action.yml`, change the `actions/setup-node@v7` step's
   `node-version: 20` to `node-version: "lts/*"`. Leave the `version:` input
   (the `visimark` npm version the Action installs) untouched — it is
   unrelated, per the spec's non-goals.
4. Add a one-line comment above `action.yml`'s `setup-node` step (there is
   none today) stating that this tracks the Node LTS per
   `.agents/rules/runtime-parity.md`, matching the convention the other three
   files use.
5. Run `node-support-policy`'s logic locally by re-running the same `grep`
   command from a shell against the working tree, confirming it now reports
   clean; then revert `action.yml`'s pin to `20` temporarily and re-run to
   confirm the grep catches it (regression check, mirroring how `#183`
   verified its guards), then restore the fix.

## Task 2: Fix the `CONTRIBUTING.md` fence defect

- [ ] Insert the missing line break so the code fence actually closes.

**Files:**
- `CONTRIBUTING.md`

**Interfaces:** none.

**Steps:**
1. At the `nvm use` example (currently around line 97-98), change:
   ```
   $ nvm use          # reads .nvmrc -> the current LTS
   ``` **VisiMark supports the current Node LTS and
   newer**, and CI runs ...
   ```
   to put a line break (and, per normal Markdown spacing, a blank line)
   between the closing ` ``` ` and the following paragraph, so the fence
   closes on its own line and the prose starts its own paragraph:
   ```
   $ nvm use          # reads .nvmrc -> the current LTS
   ```

   **VisiMark supports the current Node LTS and newer**, and CI runs ...
   ```
2. No wording changes beyond the line break — this is a rendering fix, not a
   content edit.
3. Render the file locally (or visually inspect) to confirm the fence closes
   and the following paragraph is no longer inside the code block.

## Task 3: Documentation

- [ ] Move the catalogue row to Shipped; note the follow-up scope.

**Files:**
- `docs/vocabulary-catalogue.md`
- `CHANGELOG.md`

**Interfaces:** none.

**Steps:**
1. In `docs/vocabulary-catalogue.md`, move the "Enforce the Node support
   policy" row out of section F's table and into the Shipped register
   (`## Shipped`) as:
   `| Enforce the Node support policy (current LTS + latest stable, both blocking) | tooling | [#184](https://github.com/michal-niedzwiedzki/visimark/issues/184) | [this PR's URL] | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/184#issuecomment-5790907466) |`
   — condensed to the Shipped table's columns, dropping the prose Pros/Cons
   columns per the existing convention (see the `#169` row's move as the
   precedent).
2. In `CHANGELOG.md`, under the existing `## Unreleased` → `### Changed` entry
   for Node support (added by `#183`), append one sentence noting that
   `action.yml`'s own Node pin and the `node-support-policy` guard's scope now
   cover it too — do not duplicate the whole entry, just extend it, since the
   policy statement itself is unchanged.
3. Confirm no other file needs updating: `docs/cli-reference.md`,
   `docs/ci.md`, `.agents/rules/runtime-parity.md`, and `CONTRIBUTING.md`'s
   substantive wording were already updated by `#183` and are unaffected by
   this PR's two fixes (the `CONTRIBUTING.md` change in Task 2 is a rendering
   fix, not a content update, so no further prose review is needed there).

## Final verification

- `bun test`, `bun run typecheck`, `bun run build` all green.
- `bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md`
  and `docs/example-invoice-drift.md` behave as before (no command surface
  touched).
- Push and watch CI (`gh pr checks <PR> --watch`) — `node-support-policy` in
  particular must still pass, now scanning `action.yml` too.
