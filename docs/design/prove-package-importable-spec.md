# Prove the published package is importable — feature spec

**Status:** approved (#190) · **Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/190#issuecomment-5794137088

## 1. Purpose

`ci.yml`'s `pack` job packs `visimark` and `visimark-mcp` into tarballs; `smoke-node`
installs them globally under Node only (`lts/*` and `latest`, `bun` asserted
absent) and `smoke-bun` installs them globally under Bun only (`node` asserted
absent), then both jobs run `visimark --version`, `visimark check smoke.md`,
and drive `visimark-mcp` through `scripts/mcp-handshake.mjs`. All three
exercises go through the **`bin`** — the `sh` launcher and the CLI/server
behind it. Nothing in either job does `import("visimark")` (or
`import("visimark-mcp")`) as a library and uses the result.

[#170](https://github.com/michal-niedzwiedzki/visimark/issues/170) was
exactly this failure: `packages/visimark/package.json`'s `exports["."]` had a
`"bun"` condition pointing at `./src/index.ts`, a path `files` never ships.
Bun matched that condition, found nothing, and failed resolution instead of
falling through to `"default"`. `import("visimark")` was broken under Bun
while `visimark --version` and every other `bin`-based check passed, because
none of them resolve the package by its `exports` field.
[#179](https://github.com/michal-niedzwiedzki/visimark/pull/179) added
`packages/visimark/test/package.test.ts`, a **static** assertion that every
`exports` target lands inside `files`. That is real protection and would have
caught #170's specific manifest bug, but it cannot see a condition that
resolves to a *shipped* file the runtime still refuses to load — a different
failure class from the same bug family.

**What already gives partial, incidental coverage of this class, and why it
is not enough.** `visimark-mcp` is built with `--external visimark`, so its
`dist/main.js` keeps a real `import ... from "visimark"` for the engine
calls it needs (`src/version.ts`, `envelope.ts`, `input.ts`,
`tools/read.ts`, `tools/write.ts`). Starting the server — which the existing
MCP handshake step already does in both smoke jobs — forces the runtime to
resolve `visimark`'s `exports` field as a real dependency, the same mechanism
a direct `import("visimark")` would use. This was verified directly for this
spec: `packages/visimark/package.json`'s `exports["."]` was rewritten with
the exact #170 shape (a `"bun"` condition pointing at `./src/index.ts`),
both tarballs were packed and installed globally under Bun with the node_modules
swap `smoke-bun` performs, and `scripts/mcp-handshake.mjs` was run against
the result:

```
mcp-handshake: the server exited (code 1, signal null) before answering
--- the server's stderr ---
error: Cannot find package 'visimark' from '.../visimark-mcp/dist/main.js'
```

Against the unmodified `exports` field the same sequence produced
`mcp-handshake: ok — 8 tools, server 0.1.7, engine 0.1.7, and visimark_check ran`
(exit `0`). So `smoke-bun`'s MCP handshake already fails today on this exact
regression class. This coverage is real but incidental: it depends on
`visimark-mcp` continuing to import the engine unbundled, and a failure
surfaces as an opaque MCP server startup crash, not as a statement about
`visimark`'s importability. It also covers `visimark` only as *someone else's*
dependency, never the primary, documented pattern — a consumer's own
`import("visimark")` / `import("visimark-mcp")` after installing either
package directly. That direct path has no coverage today, incidental or
otherwise, and it is what this spec adds.

## 2. The surface

Two existing CI jobs in `.github/workflows/ci.yml` each gain two additional
assertions, appended to two of their existing steps (no new step, no new
job) — split across those steps rather than bundled into one, because the
second step is the one that guarantees `visimark-mcp`'s own `visimark`
dependency is the exact tarball under test:

- **The `visimark` import + `check()` assertion** — appended to the "global
  install" step (`smoke-node`: after the existing `"$vm" check smoke.md`
  line; `smoke-bun`: after the existing `visimark check smoke.md` line,
  inside the **same shell block** that already resets `PATH` to exclude
  Node, so the check cannot silently start running under an injected Node
  the moment someone adds a step above it).
- **The `visimark-mcp` import + `engineVersion()` assertion** — appended to
  the *second* existing step ("the MCP server speaks the protocol under
  Node/Bun only"), **after** its existing `mcp_root` swap and
  `packed == installed` verification, not in the first step. That step is
  the one that overwrites `visimark-mcp`'s own `node_modules/visimark` with
  the exact packed tarball and proves it did — the first step's `npm i -g`
  / `bun add -g` may or may not have already deduped onto the right copy
  (the existing comment on that swap says explicitly: "relying on that
  difference is how the two jobs stop testing the same thing"). Running the
  `visimark-mcp` import check before that guarantee holds would risk
  silently checking against an unverified — possibly registry, not
  locally-built — copy of the engine.

No CLI command, option, exit code, stream, or `--json` shape changes. No new
job, artifact, or runner is added.

### A hard prerequisite the issue's original sketch missed

A bare `import("visimark")` **does not resolve after a global install, from
any working directory — even with a correct, unmodified `exports` field.**
Verified directly: immediately after `bun add -g` of a correctly-packed
`visimark` tarball, `bun -e 'await import("visimark")'` fails with
`error: Cannot find package 'visimark'` both from the install's own working
directory and from an unrelated one. Global installs are not on the ordinary
module-resolution path for a bare specifier; that is exactly why every
existing smoke assertion goes through the `bin` (a separate resolution
mechanism — the global bin symlink) rather than `import`.

The fix, also verified directly: resolve the package's real `node_modules`
directory from its bin symlink's realpath — the same trick `smoke-bun`'s MCP
step already uses for `mcp_root` — and run the import from inside that
directory, where the installed package is a filesystem sibling:

```sh
pkg_root=$(cd "$(dirname "$(readlink -f "$vm")")/.." && pwd)
(cd "$(dirname "$pkg_root")" && node --input-type=module -e '...')
```

This must land as written. A script that omits the `cd` will fail on every
build, including a correctly-published one, and would have to be reverted or
"fixed" by someone who does not know why — which is worse than not having the
check.

### The two scripts (both jobs, adapted per runtime)

**In the "global install" step**, appended after the existing `bin` check —
`check`, built from `locate` + `build` (`check` takes a `DocModel`, not a
string — `packages/visimark/src/eval/check.ts:88`; every real caller builds
the model first, e.g. `packages/visimark/src/cli/commands.ts:92`):

```js
const vm = await import("visimark");
const model = vm.build(vm.locate("# smoke\n"));
const result = vm.check(model);
if (result.findings.length !== 0) {
  console.error(
    '::error::import("visimark") resolved, but check() found findings on a trivial document:',
    JSON.stringify(result.findings),
  );
  process.exit(1);
}
console.log(`import("visimark") ok — check() returned 0 findings`);
```

`smoke-node` already binds `vm="$(npm prefix -g)/bin/visimark"`; the new
block reuses it. `smoke-bun` has no equivalent variable today and gains
`vm="$(command -v visimark)"` immediately before the `pkg_root` line.

**In the second step** ("the MCP server speaks the protocol..."), appended
*after* the existing `packed == installed` verification and *before*
`node handshake.mjs "$MCP_BIN"` — `engineVersion()` (a re-export of
`visimark`'s own `readVersion`, `packages/visimark-mcp/src/version.ts:11`),
resolved from `$MCP_BIN`'s own already-computed `mcp_root`, whose parent is
the same global `node_modules` directory `visimark` lives in:

```js
const mcp = await import("visimark-mcp");
if (!/^\d+\.\d+\.\d+/.test(mcp.engineVersion())) {
  console.error(
    '::error::import("visimark-mcp") resolved, but engineVersion() did not return a version:',
    mcp.engineVersion(),
  );
  process.exit(1);
}
console.log(`import("visimark-mcp") ok — engine ${mcp.engineVersion()}`);
```

Both scripts run the same `cd "$(dirname "$pkg_root")" && node/bun -e '...'`
wrapper described above — the first step derives `pkg_root` from `$vm`, the
second already has `mcp_root` computed and reuses `$(dirname "$mcp_root")`
directly, since `visimark-mcp` and the just-swapped `visimark` are siblings
in that same directory.

Verified end-to-end against the built `dist/` under both `bun -e` and
`node --input-type=module -e`: `findings: 0`, and `engineVersion()` returns
the built version string.

## 3. The machine contract

This is CI-internal: no outcome here is reachable through the published CLI,
so there is no `--json` shape to specify. Every row is a shell-script exit
code inside a `run:` step that already has `set -e`, so any nonzero exit
fails the step and the job.

| Condition | Exit | stdout | stderr |
|---|---|---|---|
| `visimark` and `visimark-mcp` both import cleanly, `check()` reports 0 findings, `engineVersion()` is a version string | `0` (step continues) | the one-line `... both ok ...` summary | (empty) |
| `import("visimark")` cannot resolve (e.g. a broken `exports` condition) | `1` (uncaught exception in the `node -e`/`bun -e` process) | (none from this step) | the runtime's native resolution error, e.g. `error: Cannot find package 'visimark' from ...` |
| `import("visimark")` resolves but `check()` reports findings on the trivial document | `1` (explicit `process.exit(1)`) | (none) | `::error::import("visimark") resolved, but check() found findings on a trivial document: [...]` |
| `import("visimark-mcp")` resolves but `engineVersion()` is not a version string | `1` (explicit `process.exit(1)`) | (none) | `::error::import("visimark-mcp") resolved, but engineVersion() did not return a version: ...` |

The first failure row is deliberately left as a native, unwrapped error
rather than caught and re-annotated: this repo's other steps (e.g. the
`node_modules/visimark` swap in `smoke-bun`'s MCP step) follow the same
convention of letting an unexpected resolution failure surface in its own
words rather than paraphrasing it.

## 4. Behaviour table

Literal sessions, captured against the current `master` build
(`visimark 0.1.7`) with the verification tarballs described in §1:

**Success (control, unmodified `exports`):**

```console
$ bun -e '
  const vm = await import("visimark");
  const model = vm.build(vm.locate("# smoke\n"));
  const r = vm.check(model);
  console.log("findings:", r.findings.length);
'
findings: 0
```

```console
$ bun -e '
  const mcp = await import("visimark-mcp");
  console.log(typeof mcp.engineVersion, mcp.engineVersion());
'
function 0.1.7
```

**Failure (regressed `exports`, `"bun"` condition pointing outside `files`,
run through the actual `smoke-bun` MCP handshake as a proxy for the same
resolution mechanism this step exercises directly):**

```console
$ bun scripts/mcp-handshake.mjs "$MCP_BIN"
mcp-handshake: the server exited (code 1, signal null) before answering
--- the server's stderr ---
error: Cannot find package 'visimark' from '.../visimark-mcp/dist/main.js'

Bun v1.4.2 (Linux x64)
--- the server exited: {"code":1,"signal":null} ---
$ echo $?
1
```

The new step, run directly against the same regressed build, fails the same
way — `Cannot find package 'visimark'` — but from the step whose name says
what broke, rather than from the MCP handshake's protocol-level failure.

## 5. Compatibility

No existing CI job, script, or composite-Action invocation changes behaviour.
`smoke-node` and `smoke-bun` already exist, already isolate their runtime,
already install both tarballs globally; they gain two more assertions each,
appended after each of two existing steps' current final assertion (§2).
`acceptance-node`, `pack`,
`playground-bundle`, `function-reference`, `mcp-resources`,
`node-support-policy`, and `dogfood.yml` are unaffected — none of them
depends on `smoke-node`/`smoke-bun`'s internals beyond `pack`'s existing
artifact contract, which is unchanged. Nothing in `docs/ci.md` describes
this repo's own CI jobs (verified: `grep` for `smoke-node`, `smoke-bun`,
`acceptance-node` in `docs/ci.md` returns nothing — it is a guide for
consumers wiring `visimark check` into *their own* CI), so it is unaffected
and is not part of the documentation list in §7.

A CI run that currently passes continues to pass. A CI run would newly fail
only if the regression this step exists to catch is already present — which
is the point.

**Reversibility.** Fully reversible without a release: the change lives
entirely in `.github/workflows/ci.yml`, touches no published artifact, and a
revert of the PR restores exactly today's behaviour.

## 6. Interaction with the rest of the tooling

- **`pack`** — unchanged. It already packs both tarballs and uploads
  `scripts/mcp-handshake.mjs`; the new step needs neither a new artifact nor
  a new download, since it is written inline in each smoke job's existing
  step (§8 records this choice and why).
- **The MCP handshake** — unchanged in behaviour, but its relationship to
  this check is now documented (§1): it already gives incidental coverage of
  the same resolution mechanism, and continues to. This step does not
  duplicate the handshake's protocol-level assertions (tool list, tool call,
  annotations) — it only proves the two packages import cleanly as
  libraries.
- **`--json`, `explain`, `infer`, the did-you-mean list** — untouched; none
  of this is reachable through the CLI.
- **The release workflow** — untouched. This is a CI-only addition with no
  new artifact to publish or version.
- **`remark-visimark`, `markdownlint-visimark`** — out of scope. Neither has
  a `bin`, so neither is part of `smoke-node`/`smoke-bun` today
  (`.agents/rules/runtime-parity.md`: "A published package with no `bin` ...
  has nothing to launch"), and this spec does not change that. Both already
  import `visimark` as a library dependency and have no CI proof of it
  either, but that is a distinct gap on packages this spec does not touch —
  a candidate for a follow-up issue, not folded in here.

## 7. Documentation to update

- **`.agents/rules/runtime-parity.md`** (lines 36–37) — currently states "CI
  already exercises the published CLI under Node (`acceptance-node`,
  `smoke-node`) and under Bun alone (`smoke-bun`)". After this change,
  `smoke-node` and `smoke-bun` also prove the published **package** (not only
  the `bin`) imports cleanly under each runtime; the sentence must say so.

No other file states the current behaviour this change touches:
`docs/ci.md` does not describe this repo's own CI jobs (§5);
`packages/visimark/test/package.test.ts`'s doc comment does not claim to
close this failure class (it already scopes itself to "an `exports`
condition pointing outside `files`"), so it needs no correction, though a
future editor should not widen that comment to claim it covers runtime
resolution too.

(`CHANGELOG.md` under `## Unreleased` is handled by the implementation plan's
mandatory final documentation task, not listed again here.)

## 8. Non-goals

- Does not add import-based smoke coverage to `remark-visimark` or
  `markdownlint-visimark` (§6) — neither has a `bin`, so neither is in
  `smoke-node`/`smoke-bun`'s scope; a separate issue if that gap is judged
  worth closing.
- Does not add a new CI job, artifact, or download step. The script is
  written inline in each smoke job's existing step (§2), reusing the
  tarballs and PATH setup already in place.
- Does not add permanent "mutate the manifest and assert red" meta-test
  infrastructure to prove the check catches a regression. That was proven
  once, by hand, against a build with the exact #170 shape reintroduced
  (§1, §4), the same way `check-changelog-entries.ts`, `node-support-policy`,
  and `package.test.ts` were each proven against their respective historical
  or hypothetical regressions — not with a standing automated fixture.
- Does not change what `check()` or `engineVersion()` return for real
  documents or real packages; it only adds a CI-side assertion that calling
  them at all still works.
- Does not touch `acceptance-node`, which runs against a checkout and the
  built `dist/`, not an installed tarball, and so structurally cannot see a
  packaging fault — considered and rejected in the issue for that reason.

## 9. Open questions

None.
