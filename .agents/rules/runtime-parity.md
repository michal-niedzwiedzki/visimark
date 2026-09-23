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
  `smoke-node`) and under Bun alone (`smoke-bun`); `smoke-node` and
  `smoke-bun` also prove the published `visimark` and `visimark-mcp`
  packages import cleanly as libraries under each runtime, not only that
  their `bin` runs (issue #190). A new published `bin` says, in its own
  issue, how the packed artifact is installed and run with only Node present
  and with only Bun present. This rule does not invent that fixture.
- The launcher is `sh`. On Windows, npm's global shim needs `sh` on PATH. Do
  not put `#!/usr/bin/env node` back in the `bin` slot to make PowerShell
  work. The user-facing caveat stays in `docs/cli-reference.md` and the
  README.

## Which Node

**The supported floor is the current Node LTS.** CI runs every Node-facing job
on the current LTS **and** on the latest stable release, and both block.

- Workflows name Node with **`lts/*`** or **`latest`**, never a number. A
  numeric pin is a fact about the day it was typed: `node-version: 20` was
  written on 2026-09-07, four months after Node 20 went end-of-life, and
  nothing noticed. Aliases cannot go stale because they are not versions.
- **`engines.node` is `>=<current LTS major>`** in every published manifest,
  and `ci.yml`'s `node-support-policy` job asserts it against the LTS that
  `lts/*` actually resolves to. A floor no job exercises is not a support
  claim; this repository carried `>=18` for seventeen months after Node 18
  was EOL.
- The latest-stable leg is **blocking**, not a soft canary. A break there is a
  break for every user who upgrades, and a check nothing enforces is a check
  that gets ignored.
- `release.yml` uses `lts/*` too, though Node is only a tool there — npm does
  the publishing. Tracking the alias keeps that file from drifting onto an EOL
  runtime while `ci.yml` moves on.
- **`.nvmrc` holds `lts/*`**, not a number, so a contributor's `nvm use` lands
  on the same runtime CI tests. It is a version-carrying file and is checked
  like one. `node-version-file:` in a workflow may name `.nvmrc` and nothing
  else — otherwise it is a way around the rule above, satisfying the key while
  the file it points at says `20`.

**When Node promotes a new LTS, `node-support-policy` goes red.** That is the
design, not a defect: the floor moves on a deliberate commit — bump every
`engines.node`, add a `CHANGELOG.md` entry, update the prose in
`CONTRIBUTING.md` and `docs/ci.md` — rather than by drifting. Do **not** pin
the job to an older LTS to make it pass.

This says nothing about Bun. In-repo development stays Bun-first, and the
`packageManager` pin in `package.json` is unaffected.

In-repo `bun test`, `bun run`, and `bun packages/visimark/src/cli/main.ts` are
development commands. They are not published invocations. This rule does not
ask for an `npx` twin of any of them.
