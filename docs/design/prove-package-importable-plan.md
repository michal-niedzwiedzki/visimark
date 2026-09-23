# Prove the published package is importable — implementation plan

**Goal:** `smoke-node` and `smoke-bun` in `.github/workflows/ci.yml` each gain
two assertions — that `import("visimark")` resolves and its `check()` works,
and that `import("visimark-mcp")` resolves and its `engineVersion()` works —
closing the gap that let #170 ship.

**Architecture:** No new job, script file, or artifact. Two small inline
`node -e` / `bun -e` blocks, appended to two existing steps per job, each
wrapped in a `cd` into the package's real `node_modules` directory (resolved
from a bin symlink's realpath) because a global install is not on the
ordinary module-resolution path for a bare specifier.

**Tech Stack:** GitHub Actions YAML (`ci.yml`), inline Node/Bun one-liners.
No new dependency.

**Spec:** [`docs/design/prove-package-importable-spec.md`](prove-package-importable-spec.md)

**Global Constraints:**
- Every commit ends with the trailer named in
  [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md)
  for this session — never a hardcoded vendor name.
- `smoke-bun`'s new assertion must run inside the existing `PATH`-reset shell
  block (spec §2) — never in a step or block that runs before that reset.
- The `visimark-mcp` assertion must run after the existing `mcp_root` swap
  and `packed == installed` verification in the second step, never before
  (spec §2, §6).
- No `bunx`/published-build invocation anywhere in verification — this
  exercises the branch, and CI exercises the packed tarball built from it.

## Task 1: `smoke-node` — both assertions

**Files:** `.github/workflows/ci.yml`

**Interfaces:** none (workflow YAML only)

**Steps:**
1. In the `smoke-node` job's `global install under Node only` step, after the
   existing `"$vm" check smoke.md` line, add:
   ```sh
   pkg_root=$(cd "$(dirname "$(readlink -f "$vm")")/.." && pwd)
   (cd "$(dirname "$pkg_root")" && node --input-type=module -e '
     const vm = await import("visimark");
     const model = vm.build(vm.locate("# smoke\n"));
     const result = vm.check(model);
     if (result.findings.length !== 0) {
       console.error("::error::import(\"visimark\") resolved, but check() found findings on a trivial document:", JSON.stringify(result.findings));
       process.exit(1);
     }
     console.log("import(\"visimark\") ok — check() returned 0 findings");
   ')
   ```
2. In the `smoke-node` job's `the MCP server speaks the protocol under Node
   only` step, after the existing
   `[ "$packed" = "$installed" ] || { echo "::error::the engine under test is not the packed one"; exit 1; }`
   line and **before** `node handshake.mjs "$MCP_BIN"`, add:
   ```sh
   (cd "$(dirname "$mcp_root")" && node --input-type=module -e '
     const mcp = await import("visimark-mcp");
     if (!/^\d+\.\d+\.\d+/.test(mcp.engineVersion())) {
       console.error("::error::import(\"visimark-mcp\") resolved, but engineVersion() did not return a version:", mcp.engineVersion());
       process.exit(1);
     }
     console.log(`import("visimark-mcp") ok — engine ${mcp.engineVersion()}`);
   ')
   ```
3. Sanity-check the YAML locally: `bun -e 'require("js-yaml")'` is not a repo
   dependency, so instead diff-review the indentation by eye against the
   surrounding `run: |` block — a misindented heredoc silently becomes a
   no-op step in Actions, not a YAML parse error.

## Task 2: `smoke-bun` — both assertions

**Files:** `.github/workflows/ci.yml`

**Interfaces:** none (workflow YAML only)

**Steps:**
1. In the `smoke-bun` job's `global install under Bun only` step, after the
   existing `visimark check smoke.md` line — **inside the same shell block**
   that sets `export PATH="$(bun pm bin -g):/usr/local/bin:/usr/bin:/bin"` —
   add:
   ```sh
   vm="$(command -v visimark)"
   pkg_root=$(cd "$(dirname "$(readlink -f "$vm")")/.." && pwd)
   (cd "$(dirname "$pkg_root")" && bun -e '
     const vm = await import("visimark");
     const model = vm.build(vm.locate("# smoke\n"));
     const result = vm.check(model);
     if (result.findings.length !== 0) {
       console.error("::error::import(\"visimark\") resolved, but check() found findings on a trivial document:", JSON.stringify(result.findings));
       process.exit(1);
     }
     console.log("import(\"visimark\") ok — check() returned 0 findings");
   ')
   ```
2. In the `smoke-bun` job's `the MCP server speaks the protocol under Bun
   only` step, after its existing `packed == installed` verification line
   (`[ "$packed" = "$installed" ] || { echo "::error::the engine under test
   is not the packed one"; exit 1; }`) and **before** the existing
   `bun handshake.mjs "$MCP_BIN"` line (this step already uses `bun`, not
   `node`, to run the handshake — leave that line untouched), add:
   ```sh
   (cd "$(dirname "$mcp_root")" && bun -e '
     const mcp = await import("visimark-mcp");
     if (!/^\d+\.\d+\.\d+/.test(mcp.engineVersion())) {
       console.error("::error::import(\"visimark-mcp\") resolved, but engineVersion() did not return a version:", mcp.engineVersion());
       process.exit(1);
     }
     console.log(`import("visimark-mcp") ok — engine ${mcp.engineVersion()}`);
   ')
   ```
3. Same indentation sanity check as Task 1 step 3.

## Task 3: Local verification against the branch

**Files:** none (verification only, no new test file — this is a CI-workflow
change with no unit-testable surface; see spec §8 "Non-goals" on why no
meta-test infrastructure is added)

**Steps:**
1. `bun install --frozen-lockfile && bun run build` from repo root.
2. Pack both tarballs with `bun pm pack --destination <tmp>` from
   `packages/visimark` and `packages/visimark-mcp`.
3. Reproduce `smoke-node`'s two modified steps locally against the packed
   tarballs, using `npm i -g` (or `bun add -g` as a stand-in if `npm` is
   unavailable locally — the resolution mechanism is package-manager
   agnostic, per spec §2) into an isolated `$HOME`/prefix, then run the exact
   new script blocks from Task 1 and confirm both print their `ok` lines with
   exit `0`.
4. Reproduce `smoke-bun`'s two modified steps locally under `bun`, with
   `node` excluded from `PATH`, against the same tarballs; confirm both print
   their `ok` lines with exit `0`.
5. Negative control: reintroduce the exact #170 shape into
   `packages/visimark/package.json`'s `exports["."]` (a `"bun"` condition
   pointing at `./src/index.ts`) on a throwaway copy, rebuild, repack, and
   confirm the new `smoke-bun` `visimark` import assertion fails with
   `Cannot find package 'visimark'` and nonzero exit. Discard the modified
   manifest afterward — never commit it.
6. Run `bun test`, `bun run typecheck`, `bun run lint`, `bun run format:check`
   from repo root and confirm all green (these don't exercise the new CI
   steps directly, but must not regress).
7. Push and watch the actual `smoke-node` / `smoke-bun` jobs go green on the
   PR — this is the real proof; steps 3–5 are local approximations of a
   `container:`-based Action job that cannot be perfectly reproduced outside
   GitHub's runner.

## Task 4: Documentation

**Files:**
- `.agents/rules/runtime-parity.md`
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`

**Steps:**
1. In `.agents/rules/runtime-parity.md`, replace the sentence at lines 36–37:
   ```
   - CI already exercises the published CLI under Node (`acceptance-node`,
     `smoke-node`) and under Bun alone (`smoke-bun`).
   ```
   with:
   ```
   - CI already exercises the published CLI under Node (`acceptance-node`,
     `smoke-node`) and under Bun alone (`smoke-bun`); `smoke-node` and
     `smoke-bun` also prove the published `visimark` and `visimark-mcp`
     packages import cleanly as libraries under each runtime, not only that
     their `bin` runs (issue #190).
   ```
   Keep the rest of that bullet (the "A new published `bin` says..." sentence)
   unchanged.
2. Add a `CHANGELOG.md` entry under `## Unreleased` → `### Added`, in this
   repo's established style (see the #173 and #169 entries for tone and
   length — one paragraph, names the issue, states what could previously slip
   through):
   ```markdown
   - **`smoke-node` and `smoke-bun` now prove `visimark` and `visimark-mcp`
     are importable, not just runnable** (issue #190). Both jobs already
     installed the packed tarballs and ran the CLI/server through their
     `bin`; neither ever did `import("visimark")` and used the result, which
     is exactly how #170 shipped — a broken `exports` condition that failed
     module resolution while the `bin` kept working. Each job now also
     resolves the installed package's `node_modules` directory and imports
     both packages directly, calling `check()` and `engineVersion()`
     respectively.
   ```
3. In `docs/vocabulary-catalogue.md`, move the section F row for #190 out of
   the `## F. Tooling and process` table and into the
   [Shipped register](../vocabulary-catalogue.md#shipped) at
   `UNRELEASED`, condensed to that table's columns:
   `Name` = "Prove the published package is importable", `Kind` = tooling,
   `Request` = `[#190](https://github.com/michal-niedzwiedzki/visimark/issues/190)`,
   `Landed` = this PR's URL (fill in once opened/merged), `Released` = `—`,
   `Decision` = the deciding comment URL already in the spec header.

Do **not** promote the row to `SHIPPED`, and do not close issue #190 — both
happen automatically when the next tagged release ships it
(`docs/releasing.md`, `.github/workflows/release.yml`).
