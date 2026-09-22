# A pre-commit hook for the pre-commit framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A repository using the [pre-commit](https://pre-commit.com) framework can add `repo: https://github.com/michal-niedzwiedzki/visimark`, `rev: v0.1.7`, `hooks: [id: visimark]` to its `.pre-commit-config.yaml` and get `visimark check` on every commit, on a Node machine, a Bun-only machine, or one with both — per `docs/design/pre-commit-hook-spec.md`.

**Architecture:** Three new files at the repository root and in `scripts/`: `scripts/precommit-visimark-check.sh` (the visimark-on-PATH → `bunx` → `npx` dispatch, one script, no duplication), `.pre-commit-hooks.yaml` (the published hook definition, `entry: sh scripts/precommit-visimark-check.sh`), and `.pre-commit-config.yaml` (this repo's own dogfood config, `repo: local`, the same `entry:`). `.github/workflows/dogfood.yml` gains a second job that runs `pre-commit try-repo` against the clean and drift invoices, mirroring the existing `self-check` job's shape. `.github/workflows/ci.yml`'s version-agreement step gains a fifth file. No engine, CLI, or document-semantics change of any kind.

**Tech Stack:** POSIX `sh`; YAML; GitHub Actions; the existing Bun workspace tooling. No new npm dependency; the CI job installs `pre-commit` itself via `pip`.

**Spec:** `docs/design/pre-commit-hook-spec.md`

## Global Constraints

- No change to `packages/visimark`, `packages/visimark-lsp`, or `editors/vscode` — this is entirely new files plus two workflow-file edits. `check`'s exit codes and streams are exercised, never modified.
- `scripts/precommit-visimark-check.sh` and `.pre-commit-hooks.yaml`'s `entry:` line are the **only** two places `visimark@0.1.7` may be hardcoded for this feature; `.pre-commit-config.yaml`'s `entry:` references the script and carries no version string of its own.
- `.pre-commit-hooks.yaml` must sit at the repository root — that exact path and filename is what `pre-commit` looks for when a consumer's config names this repo as `repo:`.
- `scripts/precommit-visimark-check.sh` ships with the executable bit set (`git update-index --chmod=+x`), the same way `packages/visimark/bin/visimark` does.
- Never weaken or delete an existing check to get a new one green. If the new `dogfood.yml` job or the widened `ci.yml` step turns up a real gap, fix the gap, not the assertion.
- Work on branch `issue/149-pre-commit-hook-impl` (draft PR #151); do not open a new PR. Every commit's message body ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the agent writing it — do not copy a trailer from this plan verbatim without checking the session that runs the commit is still the same one.
- Fixtures: `docs/example-invoice.md` (passes `check`) and `docs/example-invoice-drift.md` (fails it) — the same two `dogfood.yml`'s existing job already uses. Do not modify either.
- After each task, run locally from the repo root: `bun test`, `bun run typecheck`, `bun run build`, and `bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/example-invoice-drift.md` (expect exit `0` then exit `1`) — `bunx visimark` would run the *published* build and must not be used for verification here.

---

### Task 1: the shared dispatch script

**Files:**
- Create: `scripts/precommit-visimark-check.sh`

**Interfaces:** none (POSIX shell entry point, invoked with staged file paths as `"$@"`).

- [ ] **Step 1: write the script**

```sh
#!/bin/sh
# Dispatch for the visimark pre-commit hook. Tries an already-on-PATH
# `visimark` first (so this repo's own workspace build, and any consumer who
# installed visimark globally, is used straight rather than re-fetched), then
# Bun's bunx, then npm's npx. Both fetcher branches pin the same version so a
# consumer's `rev:` pin stays coherent with the engine it runs — see
# docs/design/pre-commit-hook-spec.md §5. Referenced by both
# .pre-commit-hooks.yaml (the published hook) and .pre-commit-config.yaml
# (this repo's own dogfood config) — keep it as the one place the version is
# written.
if command -v visimark >/dev/null 2>&1; then
  exec visimark check "$@"
elif command -v bunx >/dev/null 2>&1; then
  exec bunx visimark@0.1.7 check "$@"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes visimark@0.1.7 check "$@"
else
  echo "visimark: needs npx (Node) or bunx (Bun) on PATH" >&2
  exit 127
fi
```

- [ ] **Step 2: set the executable bit**

```bash
chmod +x scripts/precommit-visimark-check.sh
git add scripts/precommit-visimark-check.sh
git update-index --chmod=+x scripts/precommit-visimark-check.sh
```

- [ ] **Step 3: manual verification of all three branches**, from the repo root (`node_modules/.bin` already has `visimark` linked by `bun install`):

```console
$ ./scripts/precommit-visimark-check.sh docs/example-invoice.md
docs/example-invoice.md

  0 problems (0 stale, 0 errors)
$ echo $?
0

$ PATH="$(echo "$PATH" | tr ':' '\n' | grep -v 'node_modules/.bin' | tr '\n' ':')" ./scripts/precommit-visimark-check.sh docs/example-invoice.md
# (falls through to bunx if bun is installed locally, else npx)

$ PATH=/usr/bin:/bin ./scripts/precommit-visimark-check.sh docs/example-invoice.md
visimark: needs npx (Node) or bunx (Bun) on PATH
$ echo $?
127
```

Paste the actual transcript (not the expected one above) into the task's commit message or a scratch note — this is the acceptance evidence for the three-way dispatch that `bun test` cannot exercise, since it is a shell script, not TypeScript.

---

### Task 2: `.pre-commit-hooks.yaml`

**Files:**
- Create: `.pre-commit-hooks.yaml`

**Interfaces:** the published hook definition; `id: visimark` is the name a consumer's `.pre-commit-config.yaml` references.

- [ ] **Step 1: write the file**

```yaml
- id: visimark
  name: visimark check
  description: Recompute every formula in a Markdown document and fail if a number no longer agrees with it.
  language: system
  entry: sh scripts/precommit-visimark-check.sh
  files: \.md$
```

- [ ] **Step 2: verify with `pre-commit try-repo`** (install `pre-commit` locally if not already: `pip install --user pre-commit` or `pipx install pre-commit`):

```console
$ pre-commit try-repo . visimark --files docs/example-invoice.md
visimark check...........................................................Passed

$ pre-commit try-repo . visimark --files docs/example-invoice-drift.md
visimark check...........................................................Failed
- hook id: visimark
- exit code: 1

docs/example-invoice-drift.md
  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  ...
```

Paste the actual output into the commit message or a scratch note.

---

### Task 3: dogfood `.pre-commit-config.yaml`

**Files:**
- Create: `.pre-commit-config.yaml`

**Interfaces:** `repo: local`, the same `entry:` as Task 2, so there is exactly one dispatch script referenced from two places.

- [ ] **Step 1: write the file**

```yaml
repos:
  - repo: local
    hooks:
      - id: visimark
        name: visimark check
        language: system
        entry: sh scripts/precommit-visimark-check.sh
        files: \.md$
```

- [ ] **Step 2: verify locally**

```console
$ pre-commit run --all-files
visimark check...........................................................Passed
```

(All tracked `.md` files in this repo pass `check` today — confirmed by the existing `dogfood.yml` `self-check` job's "the clean invoice and this repo's own prose must pass" step, which lists the same file set.)

---

### Task 4: automated verification in CI

**Files:**
- Modify: `.github/workflows/dogfood.yml`

**Interfaces:** a new job `precommit-hook-self-check`, independent of `self-check`, following the same checkout → setup-bun → `bun install` → `GITHUB_PATH` shape so `visimark` resolves to this branch's build inside the hook's `language: system` step (which inherits the job's `PATH`).

- [ ] **Step 1: add the job**

```yaml
  precommit-hook-self-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: echo "${{ github.workspace }}/node_modules/.bin" >> "$GITHUB_PATH"

      - name: the hook must run this branch's CLI, not the published package
        run: |
          resolved="$(command -v visimark || true)"
          echo "visimark resolves to: ${resolved:-<nothing>}"
          if [ "$resolved" != "${{ github.workspace }}/node_modules/.bin/visimark" ]; then
            echo "::error::visimark does not resolve to this branch's build. Fix the PATH wiring rather than the assertion."
            exit 1
          fi

      - run: pip install --user pre-commit
      - run: echo "$HOME/.local/bin" >> "$GITHUB_PATH"

      - name: the clean invoice must pass through the published hook definition
        run: pre-commit try-repo . visimark --files docs/example-invoice.md

      - name: the drift invoice is supposed to fail through the published hook definition
        id: drift
        continue-on-error: true
        run: pre-commit try-repo . visimark --files docs/example-invoice-drift.md

      - name: fail the job if the drift example stopped failing under the hook
        if: steps.drift.outcome != 'failure'
        run: |
          echo "::error::docs/example-invoice-drift.md is supposed to fail the visimark pre-commit hook — it passed instead."
          exit 1

      - name: the repo's own dogfood config must pass over its own tracked Markdown
        run: pre-commit run --config .pre-commit-config.yaml --all-files
```

This mirrors `self-check`'s existing "resolve, then clean-must-pass, then drift-must-fail" shape (lines 39–67 of the current file) rather than inventing a new pattern.

- [ ] **Step 2: push and confirm the job passes in CI** (not merely locally — `pip`/`pre-commit` availability on `ubuntu-latest` is a real environment fact to confirm, not assume).

---

### Task 5: widen `ci.yml`'s version-agreement check

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:** the existing "every version-carrying file must agree" step (currently comparing `packages/visimark-lsp/package.json`, `editors/vscode/package.json`, `action.yml`'s `version` default against `packages/visimark/package.json`) gains a fifth comparison against `scripts/precommit-visimark-check.sh`.

- [ ] **Step 1: extend the step**

Add, after the existing `pinned=$(awk ...)` line and before the `fail=0` loop:

```bash
          # scripts/precommit-visimark-check.sh pins the same version twice
          # (the bunx and npx branches) — both must agree with each other
          # before either is compared with the engine.
          precommit_versions=$(grep -oE 'visimark@[0-9]+\.[0-9]+\.[0-9]+' scripts/precommit-visimark-check.sh | sed 's/^visimark@//' | sort -u)
          precommit_count=$(echo "$precommit_versions" | grep -c .)
          if [ "$precommit_count" != "1" ]; then
            echo "::error file=scripts/precommit-visimark-check.sh::expected exactly one visimark@<version> pin (bunx and npx branches must agree), found: $(echo "$precommit_versions" | tr '\n' ' ')"
            fail=1
            precommit=""
          else
            precommit=$precommit_versions
          fi
```

Then add `"scripts/precommit-visimark-check.sh:$precommit"` to the existing `for pair in ...` list, and extend the initial `echo "engine=... action.yml=$pinned"` line to also print `precommit-hook=$precommit`.

- [ ] **Step 2: update the step's leading comment** (currently "Four files carry the version...") to say five, and name `scripts/precommit-visimark-check.sh`, with the same one-line reason `action.yml` already carries: a consumer who pinned this repo's tag would otherwise silently run an older engine than the tag implies.

- [ ] **Step 3: verify the check catches a real drift** — temporarily edit one `visimark@` pin in the script to a wrong version, confirm the CI step fails with the new error message, then revert.

---

### Task 6: documentation (final task)

**Files:**
- Modify: `docs/ci.md`
- Modify: `docs/cli-reference.md`
- Modify: `docs/releasing.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/vocabulary-catalogue.md`

- [ ] **Step 1: `docs/ci.md` chapter 23** ("Git hooks and pre-commit") — reorder so the published-hook form leads:

Replace the existing "With the [pre-commit](https://pre-commit.com) framework..." paragraph and its `repo: local` example with:

```markdown
With the [pre-commit](https://pre-commit.com) framework, four lines in
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/michal-niedzwiedzki/visimark
    rev: v0.1.7
    hooks:
      - id: visimark
```

`pre-commit autoupdate` moves `rev:` forward as releases ship. Under the hood
the hook tries an already-installed `visimark` first, then Bun's `bunx`, then
npm's `npx` — so it works whether the machine has Node, Bun, or both.

Without the framework, or to pin the fetch command yourself, the same recipe
by hand:

```yaml
repos:
  - repo: local
    hooks:
      - id: visimark
        name: visimark check
        language: system
        entry: npx --yes visimark@0.1.7 check
        files: \.md$
```
```

Keep the paragraph below ("The framework passes the staged file names...") and the "keep the CI job" closing paragraph as they are.

- [ ] **Step 2: `docs/cli-reference.md`** intro paragraph — after "...or run it without installing with `npx visimark`", add: "or, on a machine with Bun but no Node, `bunx visimark`." Keep the rest of the paragraph (the runtime-resolution sentence, the Windows note) unchanged.

- [ ] **Step 3: `docs/releasing.md`** — in the "Bump the version" step's fenced list (`packages/visimark/package.json`, `packages/visimark-lsp/package.json`, `editors/vscode/package.json`, `action.yml`), add a fifth line: `scripts/precommit-visimark-check.sh  # both visimark@ pins inside it`. Update the surrounding sentence from "all four version-carrying files" to "all five", and extend "`action.yml` is in the list because..." with one clause: "`scripts/precommit-visimark-check.sh` joins them for the same reason — it is what a consumer's pinned `pre-commit` `rev:` actually runs."

- [ ] **Step 4: `CONTRIBUTING.md`** — in "Setting up", after the existing "Then check that it works" block, add a short paragraph: this repo dogfoods its own pre-commit hook (`.pre-commit-config.yaml`, `pre-commit install` to wire it into `git commit` locally), the way `bun run vscode-install` is a from-a-clone convenience rather than a requirement.

- [ ] **Step 5: `CHANGELOG.md`** — under `## Unreleased`, add:

```markdown
### Added

- **A `.pre-commit-hooks.yaml` for the [pre-commit](https://pre-commit.com) framework** —
  a repository can now add `repo: https://github.com/michal-niedzwiedzki/visimark`,
  `rev: v0.1.7`, `hooks: [id: visimark]` to `.pre-commit-config.yaml` instead of
  hand-copying the recipe in [`ci.md`](docs/ci.md) chapter 23. Works on Node, Bun,
  or both. See [`pre-commit-hook-spec.md`](docs/design/pre-commit-hook-spec.md)
  and [#149](https://github.com/michal-niedzwiedzki/visimark/issues/149).
```

- [ ] **Step 6: `docs/vocabulary-catalogue.md`** — move the `.pre-commit-hooks.yaml` row out of section F's table (it currently sits there with `Status: [APPROVED](...)`) into the [Shipped register](#shipped), condensed to that table's columns:

```markdown
| A pre-commit hook for the pre-commit framework | tooling | [#149](https://github.com/michal-niedzwiedzki/visimark/issues/149) | [#151](https://github.com/michal-niedzwiedzki/visimark/pull/151) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/149#issuecomment-5780522480) |
```

inserted in the same position (chronological by issue number) among the other `UNRELEASED`-pending rows already there. Delete the row from section F's table entirely — it does not stay in both places.

- [ ] **Step 7: run the full local check suite once more**, plus `bun run packages/visimark/src/cli/main.ts check` against every file this task touched that is itself a VisiMark document (none of the modified files are — `docs/ci.md`, `docs/cli-reference.md`, `docs/releasing.md`, `docs/vocabulary-catalogue.md`, `CONTRIBUTING.md`, `CHANGELOG.md` carry no `vmark` blocks of their own beyond what already exists and already passes `dogfood.yml`'s "the clean invoice and this repo's own prose must pass" step — re-run that exact file list locally as a final sanity check:

```bash
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/tutorial.md docs/ci.md docs/tutorial/order.md docs/tutorial/capstone.md docs/tutorial/runway.md docs/visimark-design.md docs/visimark-editor-plugins-design.md docs/cli-reference.md docs/releasing.md docs/vocabulary-catalogue.md README.md CHANGELOG.md CONTRIBUTING.md skills/visimark/SKILL.md
```

Expect `0 problems` for every file, matching `dogfood.yml`'s existing assertion.
