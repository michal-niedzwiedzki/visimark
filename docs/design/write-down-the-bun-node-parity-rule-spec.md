# Bun/Node parity as an always-on rule — feature spec

**Status:** approved (#171) · **Date:** 2026-09-23 · **Decision:** [#171 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/171#issuecomment-5785197844)

## 1. Purpose

The expectation that Bun and Node are both first-class runtimes for anything
this repository publishes is already enforced. It is not written anywhere an
agent reads when it adds a package.

Three places each record one past incident:

- [`docs/design/runtime-portable-launcher-spec.md`](runtime-portable-launcher-spec.md)
  states the Bun half, for one file. `bun install -g` links a `bin` as a bare
  symlink, so a `#!/usr/bin/env node` shebang makes the kernel hunt for `node`
  and abort before Bun is consulted. That broke `bun add -g visimark`
  ([#29](https://github.com/michal-niedzwiedzki/visimark/issues/29)).
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) states the Node half: "The built
  CLI must run under Node, not only Bun." The `acceptance-node` job is that
  sentence.
- The comment at the top of [`packages/visimark/bin/visimark`](../../packages/visimark/bin/visimark)
  states the mechanism: an `sh` launcher that picks `node` or `bun`.

None of those is under [`.agents/rules/`](../../.agents/rules/). The rules an
agent loads today are only `ai-attribution.md`. [#169](https://github.com/michal-niedzwiedzki/visimark/issues/169)
proposes `packages/visimark-mcp`, the first new published `bin` since the
launcher. A stock MCP server template ships `#!/usr/bin/env node`, which is
the shape that produced #29. #169 already lists this rule as documentation it
invalidates. This issue is that half, split out so the rule is not a side
effect of the server.

This is a tooling / process decision, catalogued in
[`docs/vocabulary-catalogue.md`](../vocabulary-catalogue.md) **section F**. It
changes no language surface and no machine contract.

## 2. The surface

No `visimark` command, option, short form, exit code, stream, or `--json`
shape changes. No workflow file changes. Three files change.

### 2.1 The rule

New file: `.agents/rules/runtime-parity.md`.

It carries the same front matter as `ai-attribution.md`, so the harnesses that
load that file load this one. The issue's sketch omitted the front matter;
without `alwaysApply: true` the file would sit in the directory and not be an
always-on rule.

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

No second copy. `.claude/rules` is a symlink to `../.agents/rules`, so Claude
and Grok (through Claude compatibility) see the new file with no edit under
`.claude/` or `.grok/`. Do not add `.grok/rules`: `AGENTS.md` already refuses
that directory because it would load `ai-attribution.md` twice. Codex is
pointed at the rules from `AGENTS.md`.

### 2.2 `AGENTS.md`

The rules row becomes:

```markdown
| [`.agents/rules/`](.agents/rules/) | Always-on rules: [`ai-attribution.md`](.agents/rules/ai-attribution.md), [`runtime-parity.md`](.agents/rules/runtime-parity.md). |
```

The sentence below the table stays: Grok does not scan `.agents/rules/`
itself; attribution reaches Grok through `.claude/rules`. That sentence is
still true, and it covers the new file by the same symlink. It is not edited.

### 2.3 `CONTRIBUTING.md`

The Node paragraph cites the rule. The following paragraph, the one-runtime
global install, cites it too. Both halves currently stand alone.

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

## 3. The machine contract

| Outcome | Exit | stdout | stderr | `--json` |
|---|---|---|---|---|
| Any current `visimark` invocation (`check`, `fmt`, `infer`, `eval`, `explain`, `ref`, including `--json`) | Unchanged: `0` clean, `1` findings, `2` usage | Unchanged | Unchanged | Unchanged |
| `acceptance-node`, `smoke-node`, `smoke-bun`, `pack`, `dogfood.yml`, the composite Action | Unchanged | Unchanged | Unchanged | n/a — none of these is the CLI's `--json` |

No new exit code. The rule describes checks that already exist. It adds none.

## 4. Behaviour table

There is no CLI session. Acceptance is the files.

| Case | What you read | What it must say |
|---|---|---|
| The rule exists | `.agents/rules/runtime-parity.md` | The text in §2.1, including the front matter. `ls .agents/rules/` lists `ai-attribution.md` and `runtime-parity.md`. |
| The table points at it | `AGENTS.md` rules row | The cell in §2.2. `grep -n runtime-parity AGENTS.md` matches that row. |
| Both contributor paragraphs cite it | `CONTRIBUTING.md` | The two paragraphs in §2.3. `grep -n runtime-parity CONTRIBUTING.md` matches both. |
| The payload shebang stays | `packages/visimark/bin/visimark.js` line 1 | `#!/usr/bin/env node` |
| The launcher stays the `bin` target | `packages/visimark/package.json` `"bin"` | `"visimark": "bin/visimark"`, and that file's first line stays `#!/bin/sh` |
| No shim copy | `.claude/rules`, `.grok/` | `.claude/rules` remains a symlink to `../.agents/rules`. `.grok/` gains no `rules` directory. |
| Documents that pass `check` today | `docs/example-invoice.md`, `docs/example-charts.md`, `docs/example-invoice-drift.md` | Same results as before this change. The drift invoice still fails `check`. No example document is edited. |
| CI | `.github/workflows/ci.yml`, `.github/workflows/dogfood.yml`, `action.yml` | Byte-identical to before this change. |

## 5. Compatibility

| Surface | Before | After |
|---|---|---|
| `.github/workflows/ci.yml` jobs `acceptance-node`, `smoke-node`, `smoke-bun`, `pack` | Build the CLI, run `node packages/visimark/bin/visimark.js` on the worked examples, install the packed tarball on a Node-only runner and in a Bun-only container | Same jobs, same commands. Not edited. |
| `.github/workflows/dogfood.yml` | Runs the composite Action on this repo's documents | Unchanged. |
| `action.yml` | Composite Action; consumers pin a ref and pass files | Unchanged. No migration note. |
| A script that calls `npx visimark` or `bunx visimark` | Works as it does today | Unchanged. |
| `packages/visimark/bin/visimark.js` shebang | `#!/usr/bin/env node`, kept by the #29 spec because `acceptance-node` executes the file with `node` | Unchanged. A guard that rejected every `node` shebang under `bin/` would fail this file. This change adds no such guard. |
| Installed extension, LSP, remark plugin, markdownlint rule | No `bin` entry | Unchanged. They do not start failing a check they were not under. |

Reversible without a release: delete `.agents/rules/runtime-parity.md` and
restore the two edited paragraphs. No pin, no cache, no published artifact.

## 6. Interaction with the rest of the tooling

Does **not** change:

- Any `visimark` subcommand, option, exit code, stream, or `--json` shape.
- The launcher script, its shebang, or the payload shebang.
- `acceptance-node`'s hardcoded `packages/visimark/bin/visimark.js` and the
  worked examples. A second package has no drift invoice; its fixture belongs
  in that package's issue.
- `docs/ci.md`, the README CI one-liner, `docs/cli-reference.md`,
  `docs/tutorial.md`, the comments in `ci.yml`, and the launcher header. They
  stay true. The rule points at them. They do not point back, except
  `CONTRIBUTING.md`.
- [`docs/design/runtime-portable-launcher-spec.md`](runtime-portable-launcher-spec.md).
  It remains the record of the #29 decision about one file. The rule links to
  it. The spec is not rewritten into a general policy.
- The review commands, `docs/issue-runbook.md`, and `.github/ISSUE_TEMPLATE/`.
  No new finding, precision variant, or exit code.
- Deno, or any runtime other than Bun and Node. The repo tests two.
  `packageManager` names Bun. A rule that promised a third would be wider than
  what CI runs.
- What a document means. A number does not depend on which runtime launched
  the checker ([§2](../visimark-design.md#2-constraints-that-shaped-the-design)
  constraint 4).

## 7. Documentation to update

1. `.agents/rules/runtime-parity.md` — the new file, text in §2.1.
2. `AGENTS.md` — the rules-row cell in §2.2.
3. `CONTRIBUTING.md` — the two paragraphs in §2.3.
4. `docs/vocabulary-catalogue.md` — when the implementation PR merges, move
   the #171 row out of section F into the Shipped register as `UNRELEASED`
   (`Name` = "Bun/Node parity as an always-on rule", `Kind` = tooling,
   `Request` = #171, `Landed` = this PR, `Released` = `—`, `Decision` = the
   deciding comment).

Deliberately **not** updated, per [`docs/releasing.md`](../releasing.md)
("a change that only touches CI, the build, or the tests" — here, agent
config and two contributor paragraphs — "does not need a changelog line"
unless a consumer can observe it; none can):

- `CHANGELOG.md`
- `editors/vscode/CHANGELOG.md`
- `docs/cli-reference.md`, `README.md`, `docs/tutorial.md`, `docs/ci.md`
- `.github/workflows/ci.yml` and the header of `packages/visimark/bin/visimark`
- `docs/design/runtime-portable-launcher-spec.md`
- `docs/issue-runbook.md`, `.agents/commands/issue-review.md`,
  `.github/ISSUE_TEMPLATE/`

## 8. Non-goals

- A CI grep, including one that reads each package's `package.json` `"bin"`
  target and refuses a `node` shebang on that file. Worth a later issue. Out
  of this acceptance. A grep of every file under `bin/` is the wrong check: it
  rejects `packages/visimark/bin/visimark.js`.
- Extending `acceptance-node` or `smoke-bun` to a package that does not exist
  yet. #169 owns that fixture.
- Rewriting `docs/ci.md` or the README so every `npx` has a `bunx` beside it.
- Moving the body into `CONTRIBUTING.md` and leaving a one-line pointer in
  `.agents/rules/`. The failure mode is an agent that does not load
  `CONTRIBUTING.md`.
- Editing the #29 spec, the launcher, or the payload.
- Supporting Deno, or claiming "all runtimes".
- Any change shipped inside #169. That issue consumes this rule. It does not
  define it.

## 9. Open questions

None.
