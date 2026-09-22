# Bun/Node parity as an always-on rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the existing Bun/Node parity expectation into `.agents/rules/runtime-parity.md`, point `AGENTS.md` and `CONTRIBUTING.md` at it, and move the #171 catalogue row into the Shipped register as unreleased — per `docs/design/write-down-the-bun-node-parity-rule-spec.md`.

**Architecture:** One new always-on rule file, two citation edits, and a catalogue-row move. No engine, CLI, workflow, launcher, or example-document change. The rule describes checks that already exist (`acceptance-node`, `smoke-node`, `smoke-bun`). It adds none.

**Tech Stack:** Markdown. The harness front matter matches `.agents/rules/ai-attribution.md` (`description`, `alwaysApply: true`). No new dependency.

**Spec:** `docs/design/write-down-the-bun-node-parity-rule-spec.md`

## Global Constraints

- The rule text is the fenced block in spec §2.1, including the front matter. Do not shorten it, and do not add a CI grep, a Deno sentence, or a second copy under `.grok/` or `.claude/`.
- `.claude/rules` stays a symlink to `../.agents/rules`. Do not create `.grok/rules`.
- `packages/visimark/bin/visimark` stays the `bin` target and stays `#!/bin/sh`. `packages/visimark/bin/visimark.js` line 1 stays `#!/usr/bin/env node`.
- Do not edit `.github/workflows/ci.yml`, `.github/workflows/dogfood.yml`, `action.yml`, `docs/ci.md`, `README.md`, `docs/cli-reference.md`, `docs/tutorial.md`, `docs/design/runtime-portable-launcher-spec.md`, `docs/issue-runbook.md`, `.agents/commands/issue-review.md`, or `.github/ISSUE_TEMPLATE/`.
- Do not add a `CHANGELOG.md` or `editors/vscode/CHANGELOG.md` line. Spec §7: a consumer cannot observe this change.
- Do not edit `docs/example-invoice.md`, `docs/example-charts.md`, or `docs/example-invoice-drift.md`.
- Work on branch `issue/171-write-down-the-bun-node-parity-rule-impl` (draft PR #175). Do not open a new PR.
- Every commit ends with the one `Co-Authored-By` trailer from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the commit. Do not copy a trailer out of this plan, an older plan, or an older commit.
- Never `bunx visimark`. Verify documents with `bun run packages/visimark/src/cli/main.ts`.
- Per-task acceptance is the spec §4 read. The full `bun test`, `bun run typecheck`, and `bun run build` run once, in Task 3, because Tasks 1 and 2 cannot change TypeScript.

## Review Focus

A person (or the next agent) can undo #29 while "following" this rule. These five are the ways, and Task 3 pins each one.

1. A `node` shebang written back onto the `bin` target, to "fix" Windows or a stock MCP template. Expected: `package.json` `"bin"` still points at `bin/visimark`, whose first line is `#!/bin/sh`.
2. The payload shebang stripped from `bin/visimark.js`. Expected: line 1 stays `#!/usr/bin/env node`, because `acceptance-node` executes that file with `node`.
3. A second copy of the rule under `.grok/rules`, which would load `ai-attribution.md` twice. Expected: `.grok/rules` does not exist, and `.claude/rules` is still the symlink.
4. `docs/ci.md` or the README CI one-liner rewritten so every `npx` has a `bunx`. Expected: neither file is in the diff.
5. The #171 row left in section F and also copied into Shipped. Expected: one row, in the Shipped register, `Released` = `—`.

---

### Task 1: the rule file

**Files:**
- Create: `.agents/rules/runtime-parity.md`

**Interfaces:**
- Consumes: nothing
- Produces: the path `AGENTS.md` and `CONTRIBUTING.md` will link, `.agents/rules/runtime-parity.md`

- [ ] **Step 1: Write the file**

Create `.agents/rules/runtime-parity.md` with exactly:

```markdown
---
description: Bun and Node are both first-class for anything this repo publishes
alwaysApply: true
---

# Runtime parity

Bun and Node are both first-class runtimes for anything this repo publishes.
In-repo development is Bun-first; Node is a CI-tested target.

**Why.** `bun install -g` links a bin as a bare symlink rather than writing a
launcher shim, so a `#!/usr/bin/env node` shebang makes the kernel hunt for
`node` and abort before Bun is ever consulted. That broke the published
`visimark` command on Bun-only machines — issue #29, spec at
`docs/design/runtime-portable-launcher-spec.md`.

**How to apply.**

- A published `bin` entry points at an `sh` launcher that resolves the runtime
  itself, as `packages/visimark/bin/visimark` does. Never point `bin` at a
  file whose shebang is `node`. The payload next to that launcher,
  `packages/visimark/bin/visimark.js`, keeps `#!/usr/bin/env node` on purpose:
  it is executed as an argument (`node bin/visimark.js`, or by the launcher),
  never as the `bin` target. `acceptance-node` calls it with `node`.
- A published package with no `bin` — `remark-visimark`,
  `markdownlint-visimark`, `visimark-lsp`, the VS Code extension — has nothing
  to launch. Do not add a `bin` whose target starts with a `node` shebang.
  Those packages do not gain an `sh` launcher or a second CI job until they
  gain a `bin`.
- Write the install line and the "run it without installing" line for a
  published command in both forms: `npm i -g` and `bun add -g`, and `npx` and
  `bunx`. A snippet that documents one named runner stays in that runner's
  form. `docs/ci.md` is `npx` because those snippets run on Node runners. The
  README's CI one-liner is `npx visimark check **/*.md` for the same reason.
  Do not pair those, and do not rewrite them to satisfy this rule.
- CI already exercises the published CLI under Node (`acceptance-node`,
  `smoke-node`) and under Bun alone (`smoke-bun`). A new published `bin` says,
  in its own issue, how the packed artifact is installed and run with only
  Node present and with only Bun present. This rule does not invent that
  fixture.
- The launcher is `sh`. On Windows, npm's global shim needs `sh` on PATH. Do
  not put `#!/usr/bin/env node` back in the `bin` slot to make PowerShell
  work. The user-facing caveat stays in `docs/cli-reference.md` and the
  README.

In-repo `bun test`, `bun run`, and `bun packages/visimark/src/cli/main.ts` are
development commands. They are not published invocations. This rule does not
ask for an `npx` twin of any of them.
```

- [ ] **Step 2: Check the file is the only new rule, and the payload shebang is untouched**

```bash
ls .agents/rules/
# ai-attribution.md  runtime-parity.md
head -4 .agents/rules/runtime-parity.md
# ---
# description: Bun and Node are both first-class for anything this repo publishes
# alwaysApply: true
# ---
head -1 packages/visimark/bin/visimark.js
# #!/usr/bin/env node
head -1 packages/visimark/bin/visimark
# #!/bin/sh
test -L .claude/rules && readlink .claude/rules
# ../.agents/rules
test ! -e .grok/rules
```

- [ ] **Step 3: Commit**

```bash
git add .agents/rules/runtime-parity.md
git commit -m "$(printf '%s\n\n%s' 'docs: add the Bun/Node runtime-parity rule' '<trailer>')"
```

`<trailer>` is the one `Co-Authored-By` line from `.agents/rules/ai-attribution.md` for this session.

### Task 2: point the two docs at the rule

**Files:**
- Modify: `AGENTS.md` (the rules-row cell)
- Modify: `CONTRIBUTING.md` (the two runtime paragraphs, about lines 172–180)

**Interfaces:**
- Consumes: `.agents/rules/runtime-parity.md` from Task 1
- Produces: the two citations spec §4 checks with `grep`

- [ ] **Step 1: Replace the `AGENTS.md` rules cell**

Replace:

```markdown
| [`.agents/rules/`](.agents/rules/) | Always-on rules. Start with [`ai-attribution.md`](.agents/rules/ai-attribution.md). |
```

with:

```markdown
| [`.agents/rules/`](.agents/rules/) | Always-on rules: [`ai-attribution.md`](.agents/rules/ai-attribution.md), [`runtime-parity.md`](.agents/rules/runtime-parity.md). |
```

Leave the sentence under the table unchanged. It already says Grok loads rules through `.claude/rules`.

- [ ] **Step 2: Cite the rule from both `CONTRIBUTING.md` paragraphs**

Replace:

```markdown
**The built CLI must run under Node, not only Bun.** A separate job builds with
Bun and then exercises `dist/` under Node against the worked examples, including
the drift invoice, which is required to *fail*. It also feeds the parser a
pathological deeply nested expression and requires a finding rather than a stack
overflow.

**A global install must work with only one runtime present.** Two smoke jobs
install the packed tarball in a Node-only runner and a Bun-only container. The
launcher has to work in both.
```

with:

```markdown
**The built CLI must run under Node, not only Bun**
([`.agents/rules/runtime-parity.md`](.agents/rules/runtime-parity.md)). A
separate job builds with Bun and then exercises `dist/` under Node against the
worked examples, including the drift invoice, which is required to *fail*. It
also feeds the parser a pathological deeply nested expression and requires a
finding rather than a stack overflow.

**A global install must work with only one runtime present**
([`.agents/rules/runtime-parity.md`](.agents/rules/runtime-parity.md)). Two
smoke jobs install the packed tarball in a Node-only runner and a Bun-only
container. The launcher has to work in both.
```

- [ ] **Step 3: Check both citations**

```bash
grep -n runtime-parity AGENTS.md
# one match, the rules row
grep -n runtime-parity CONTRIBUTING.md
# two matches, one in each paragraph
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CONTRIBUTING.md
git commit -m "$(printf '%s\n\n%s' 'docs: cite the Bun/Node runtime-parity rule' '<trailer>')"
```

`<trailer>` is the session line from `.agents/rules/ai-attribution.md`.

### Task 3: documentation

**Files:**
- Modify: `docs/vocabulary-catalogue.md` — move the #171 row out of section F into the Shipped register

**Interfaces:**
- Consumes: the rule and the two citations from Tasks 1 and 2
- Produces: the Shipped row below. `Landed` is PR #175. `Released` stays `—` until a tag. Do not close issue #171.

- [ ] **Step 1: Move the row**

Delete the section F row whose Request cell is `[#171](https://github.com/michal-niedzwiedzki/visimark/issues/171)`. Do not delete the #45 or "Shared build" rows.

Insert this as the first data row of the Shipped table, directly under the header separator, above `` `IRR(flows)` ``:

```markdown
| Bun/Node parity as an always-on rule | tooling | [#171](https://github.com/michal-niedzwiedzki/visimark/issues/171) | [#175](https://github.com/michal-niedzwiedzki/visimark/pull/175) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/171#issuecomment-5785197844) |
```

- [ ] **Step 2: Pin the five review-focus cases, and the files this change must not touch**

```bash
# 1 and 2 — launcher and payload
head -1 packages/visimark/bin/visimark
head -1 packages/visimark/bin/visimark.js
grep -n '"visimark"' packages/visimark/package.json
# "visimark": "bin/visimark"

# 3 — no second copy
test -L .claude/rules && test "$(readlink .claude/rules)" = "../.agents/rules"
test ! -e .grok/rules

# 4 — named-runner docs are not rewritten
git diff --exit-code origin/master -- README.md docs/ci.md docs/cli-reference.md docs/tutorial.md

# 5 — one catalogue row, in Shipped, not still in section F
grep -n "Bun/Node parity" docs/vocabulary-catalogue.md
# exactly one line, and it sits below the Shipped header

# workflows and the #29 spec are byte-identical to master
git diff --exit-code origin/master -- .github/workflows/ci.yml .github/workflows/dogfood.yml action.yml docs/design/runtime-portable-launcher-spec.md CHANGELOG.md editors/vscode/CHANGELOG.md docs/issue-runbook.md .github/ISSUE_TEMPLATE
```

The diff against `origin/master` for the whole branch may also contain this plan and `docs/design/write-down-the-bun-node-parity-rule-spec.md`. Those two are this PR's spec and plan. Nothing else outside the three files in Tasks 1–2 and the catalogue row belongs in the diff.

- [ ] **Step 3: Run the repo checks once**

From the repo root:

```bash
bun test
bun run typecheck
bun run build
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
bun run packages/visimark/src/cli/main.ts check docs/example-charts.md
bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
```

Expected: tests, typecheck, and build pass. The invoice and the charts check exit 0. The drift invoice exits 1. Do not edit those documents to change that.

- [ ] **Step 4: Commit**

```bash
git add docs/vocabulary-catalogue.md
git commit -m "$(printf '%s\n\n%s' 'docs: move #171 to the shipped register (UNRELEASED)' '<trailer>')"
```

`<trailer>` is the session line from `.agents/rules/ai-attribution.md`.

- [ ] **Step 5: Push**

```bash
git push
```

The push updates draft PR #175. Leave the PR a draft until CI on that push is green; promoting it is the decide-workflow's last step, not this task.
