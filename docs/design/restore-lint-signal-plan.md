# Restore lint signal — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.6 (row 14, rated C). Tooling configuration
only — no paired spec, per the repo convention that non-vocabulary work does not carry a
design doc. Independent of §2.1–§2.5, all of which have landed.

**Goal:** Make `bun run lint` say something. Today it emits 1,809 warnings, every one of
them from a single committed minified artifact, and CI does not fail on any of them —
so a genuine warning in real source is invisible and nothing enforces its absence.

**Architecture:** No source change. One new config file, one one-word script change.

**Tech Stack:** oxlint 1.81 (declared `^1.82.0`, resolved 1.81.0), JSONC config. No new
dependency.

---

## Findings from validating the review's brief

**The request is well founded, and the core of the brief is correct.** Measured on this
branch's base (`91e5e62`), Bun 1.4.2, Linux:

| Check | Result |
|---|---|
| `bun run lint` warning lines | **1,809** (the brief says 1,785 — see below) |
| Warning lines *not* from `docs/vendor/visimark-browser.js` | **0** |
| `bun run lint` exit code | **0** — warnings do not fail CI |
| `.oxlintrc.json` present | no |
| `ignorePatterns` in the installed schema | yes, `node_modules/oxlint/configuration_schema.json` |
| `--max-warnings=INT` in `oxlint --help` | yes (`--deny-warnings` also exists) |

The 1,785 → 1,809 difference is expected: §2.5 (#95) rebuilt the bundle, and a bigger
bundle carries more minifier artefacts. By rule, `no-unused-expressions` accounts for
1,705 of them — comma-sequenced minifier output, exactly what you would expect from
running a linter over a `--minify` build.

Three corrections to the brief, one of which changes what gets written.

### 1. The brief's ignore list is two-thirds redundant — `dist` and `node_modules` are already excluded

The brief proposes `["docs/vendor/**", "**/dist/**", "**/node_modules/**"]`, with the
stated rationale that `dist/` "is gitignored but exists locally after a build; ignoring
it prevents a confusing difference between local and CI lint output."

There is no such difference. oxlint honours `.gitignore` by default, and `dist` is the
second line of it. Verified directly, with both `packages/visimark/dist` and
`editors/vscode/dist` present on disk from a real build:

```
$ bun x oxlint packages/visimark/dist
No files found to lint. Please check your paths and ignore patterns.
```

Not "0 warnings" — *no files walked*. The same holds for `node_modules`. Local and CI
output already agree, and they agreed before this change.

**Recommendation: ignore `docs/vendor/**` and nothing else.** A three-entry list would
read as three load-bearing exclusions when only one is doing work, and the two dead
entries would quietly outlive any future change to how oxlint resolves ignores — at
which point nobody could tell which entries still mattered. `docs/vendor/` holds exactly
one tracked file, the bundle, since §2.5 retired `playground-data.js`.

### 2. `docs/vendor/**` is the whole problem set — no source file is being silenced

The five tracked non-`docs/vendor` JavaScript files (`editors/vscode/esbuild.mjs`,
`packages/visimark/bin/visimark.js`, `scripts/serve.mjs`, `scripts/stack-headroom.mjs`)
and all TypeScript source stay in scope and are clean. The brief's step 2 — "confirm the
source is genuinely clean" — holds: output is empty.

The linter is not merely quiet after the change, it is still *working*. Mutation-tested
rather than assumed: a throwaway `packages/visimark/src/__lintprobe.ts` containing an
unused local and an `if (true)` produces

```
packages/visimark/src/__lintprobe.ts:2:9: warning eslint(no-unused-vars) …
packages/visimark/src/__lintprobe.ts:3:7: warning eslint(no-constant-condition) …
```

with the config in place, and `oxlint --max-warnings 0` exits 1. Removing the probe
returns exit 0. So the config narrows the file set without touching the rule set.

### 3. The brief's suppression count is stale — there is one, not two

The brief's constraint says "there are exactly two suppressions in the entire codebase
today (`no-control-regex`, in both path gates)". §2.2 (#92) merged those gates, so there
is now exactly one, at `packages/visimark/src/fs/gate.ts:38`. The constraint's *intent*
is unchanged and should be honoured: no new `oxlint-disable` in source.

### Recommendation

Implement the brief with a one-entry ignore list. Give the root `lint` script
`--max-warnings 0`. Do not widen the ignore list, do not add suppressions.

---

## Maintainer decisions (2026-09-15)

**D1 — ignore list scope (finding 1).**

- **(a) `["docs/vendor/**"]` — recommended.** One entry, one reason, empirically the
  only one that changes behaviour.
- (b) The brief's three entries, for defence in depth against someone running
  `oxlint --no-ignore` or a future oxlint that stops reading `.gitignore`.

**D2 — carry the *why* in the config, or keep parity with `.oxfmtrc.json`.**
oxlint parses `.oxlintrc.json` as JSONC; a `//` comment in it is accepted (verified,
and `bun run format:check` stays green with one present). `.oxfmtrc.json` is strict JSON
with no comment.

- **(a) One-line JSONC comment naming why the bundle is excluded — recommended.**
  "Comments explain why" is the repo's most consistently applied rule, and this file's
  entire content is one non-obvious decision.
- (b) Strict JSON, comment omitted, rationale lives only in this plan.

**D3 — how lint gets teeth, and what it costs.**
`--max-warnings 0` and `--deny-warnings` are equivalent here; the brief names the former
and it states the threshold explicitly, so: `"lint": "oxlint --max-warnings 0"`.
`lint:fix` stays as-is — a fixing run should report what it could not fix, not abort.

The cost is real and worth naming: **oxlint ships new default rules in minor releases,
and Dependabot bumps it weekly in a grouped PR.** After this change, a bump that adds a
rule VisiMark's source trips turns that grouped PR red for a reason unrelated to the
other dependencies in the group.

- **(a) Accept it — recommended.** That is the signal working: it surfaces in the
  Dependabot PR, where it is diagnosable and fixable, rather than nowhere. The
  alternative is the status quo, where nothing surfaces anywhere.
- (b) Pin `oxlint` to an exact version in `devDependencies` so rule-set changes arrive
  only on a deliberate bump. Costs a second decision point per bump and diverges from
  how every other dependency here is declared.

### Answers

1. **D1 → (a), one entry.** `ignorePatterns` is `["docs/vendor/**"]`; finding 1's
   measurement accepted, `dist` and `node_modules` not listed.
2. **D2 → (a), JSONC comment.** The exclusion carries its own rationale in the file.
3. **D3 → (a), accept.** `"lint": "oxlint --max-warnings 0"`; `lint:fix` untouched;
   `oxlint` stays on `^1.82.0` and a rule-adding bump is allowed to fail its own
   Dependabot PR.

---

## Global Constraints

- **No source change.** `packages/visimark/src/**`, `editors/**` and `scripts/**` are
  not touched. One new config file and one script string.
- **No `oxlint-disable` added to source.** There is exactly one in the repo
  (`fs/gate.ts:38`, `no-control-regex`, justified in a comment). That bar stands.
- **Do not widen the ignore list to make a real warning disappear.** If
  `--max-warnings 0` turns up a warning in source, fix it or report it. (It does not
  today — verified.)
- **No new dependency.**
- `bun test` stays at 758 pass / 0 fail; `typecheck` and `format:check` clean.
- Conventional commits: `ci:` for the config and the script.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun run lint                  # must print nothing
bun run lint; echo $?         # must be 0
bun run format:check
bun run typecheck
bun test                      # 758 pass, 0 fail
```

---

### Task 1: Add `.oxlintrc.json`

**Files:**
- Create: `.oxlintrc.json`

Under **D1a + D2a**:

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  // docs/vendor/visimark-browser.js is a committed `bun build --minify` artifact, not
  // source (see docs/reviews/2026-09-15.md §2.5). Linting it produced 1,809 warnings —
  // 100% of the repo's total — which buried every real one. dist/ and node_modules/ are
  // already skipped via .gitignore and do not need listing here.
  "ignorePatterns": ["docs/vendor/**"]
}
```

- [x] **Step 1.1** Write the file. `$schema` mirrors `.oxfmtrc.json`'s pointer into
      `node_modules`.
- [x] **Step 1.2** Confirm `bun run lint` prints nothing.
- [x] **Step 1.3** Confirm the rule set is intact, not just the output: add a throwaway
      source file with an unused local, confirm oxlint reports it, delete it.
- [x] **Step 1.4** Verification gate.

**Commit:** `ci: stop linting the committed playground bundle`

---

### Task 2: Give lint teeth

**Files:**
- Modify: `package.json` (root `scripts.lint`)

- [x] **Step 2.1** `"lint": "oxlint --max-warnings 0"`. Leave `lint:fix` alone.
- [x] **Step 2.2** Confirm `bun run lint` exits 0 on the clean tree, and exits non-zero
      with a deliberately unused variable in source. Revert the probe.
- [x] **Step 2.3** `.github/workflows/ci.yml` needs no change — line 25 already runs
      `bun run lint`, and it now fails the job.
- [x] **Step 2.4** Verification gate.

**Commit:** `ci: fail the build on any lint warning`

---

### Task 3: Update the review document

**Files:**
- Modify: `docs/reviews/2026-09-15.md`

- [x] **Step 3.1** Add `**Status: DONE [PR#96](…)**` under the §2.6 heading, matching
      the placement and wording used for §2.1–§2.5.
- [x] **Step 3.2** Verification gate.

**Commit:** folded into the final commit of the branch.

---

## Outcome

Two commits, no source change: one new config file and one script string. Lint goes
from 1,809 warnings and exit 0 to no output and a build that fails on the first new
one. 758 green before and after; typecheck and `format:check` clean.

**The guard was mutation-tested, not just written.** A throwaway
`packages/visimark/src/__lintprobe.ts` holding an unused local is reported with the
config in place, and `bun run lint` exits 1; deleting it returns exit 0. So the config
demonstrably narrows the file set while leaving the rule set alone — the failure mode
worth ruling out here was a config that silences everything and looks like success.

Two things worth knowing that the plan did not anticipate:

- **`dist` was never linted, even locally.** The brief's rationale for ignoring it
  assumed oxlint walks it after a build. It does not — `bun x oxlint
  packages/visimark/dist` reports *"No files found to lint"* with the directory
  populated, because oxlint reads `.gitignore` by default. Worth remembering before
  adding any future `ignorePatterns` entry: check whether it changes behaviour at all.
- **This branch was written in a git working tree shared with a concurrent session.**
  Two commits initially landed on that session's branch because it checked out between
  this branch's creation and its first commit, and the first `git push` therefore
  published an empty branch. Nothing was lost and the other branch was never pushed,
  but the episode is an argument for `git worktree add` per session rather than a
  shared checkout.

## Out of scope

- **`oxfmt` does not ignore `docs/vendor/` either.** `format:check` walks the 797 KB
  minified bundle on every run and passes it — noted at the end of the §2.5 plan. It
  costs time, not signal, so it is not §2.6's problem; but if the two configs are ever
  meant to read as parallel, that is the gap.
- §2.7 (pin the composite Action's default version), §2.8 (shrink `cmdExplain` and
  `build()`).
- Any change to the rule set, the enabled categories, or oxlint plugins. This branch
  changes *which files* are linted and *whether warnings fail*, not *what counts as a
  warning*.
