# Runtime-portable CLI launcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published `visimark` command start under either Node or Bun, so `bun add -g visimark` works on a machine with no Node, and keep it that way with CI.

**Architecture:** The `bin` entry becomes a tiny `#!/bin/sh` launcher (`packages/visimark/bin/visimark`) that resolves its own symlink chain, then `exec`s the existing JS payload (`packages/visimark/bin/visimark.js`) under the first of `node` / `bun` it finds on `PATH`. `package.json` points `bin` at the launcher and adds an advisory `engines.bun`. CI gains a Node run of the worked-example checks and two isolated packaged-install smoke jobs (Node-only runner, Bun-only container). Release automation learns the general-track `issue/<n>-<slug>-impl` branch name. README and `cli-reference.md` state that either package manager works.

**Tech Stack:** POSIX `sh`, `bun test` (`bun:test`), GitHub Actions YAML, `npm pack`, the `oven/bun` container image.

**Spec:** [`docs/design/runtime-portable-launcher-spec.md`](runtime-portable-launcher-spec.md)

## Global Constraints

- The launcher script is POSIX `sh` — no bashisms. External commands it may use: `readlink`, `dirname` only (everything else is a shell builtin).
- Runtime preference is **Node first, then Bun, else exit `127`** with `visimark: needs Node.js or Bun on PATH` on stderr.
- `packages/visimark/bin/visimark` is committed with mode `100755` (executable bit set).
- No change to how the repo builds or is developed: `packageManager: bun@1.4.2`, `bun run --filter`, the root `postinstall`, and `bun test` all stay Bun-only.
- `packages/visimark/bin/visimark.js` keeps its name and its (now cosmetic) `#!/usr/bin/env node` shebang.
- The payload runs the existing node-target `dist/cli/main.js`; the launcher never branches into `src/`.
- `bin/visimark` is extensionless on purpose — it stays outside the oxfmt/oxlint globs (`*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`). Do not add it to any lint/format config.
- `engines`: keep `"node": ">=18"`, add `"bun": ">=1.0.0"`. Neither installer enforces the other's key.
- Local verification for every task runs from the repo root: `bun test`, `bun run typecheck`, `bun run build`, and `bun run lint && bun run format:check`.

---

### Task 1: The `sh` launcher and `bin` wiring

**Files:**
- Create: `packages/visimark/bin/visimark` (mode 100755)
- Modify: `packages/visimark/package.json` (`bin`, `engines`)
- Modify: `packages/visimark/src/cli/main.ts:73-77` (comment only)
- Test: `packages/visimark/test/cli/launcher.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the executable `packages/visimark/bin/visimark`. Invoked as `visimark <args>`; behaves exactly like `node packages/visimark/bin/visimark.js <args>` when Node is present. Later tasks (CI smoke jobs) call it only through a packaged global install.

- [ ] **Step 1: Write the failing test**

Create `packages/visimark/test/cli/launcher.test.ts`:

```ts
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../../package.json" with { type: "json" };

const binDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin");
const launcher = join(binDir, "visimark");
const expectedVersion = `visimark ${pkg.version}`;

function toolPath(name: string): string {
  return spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
}

test("launcher prints the version and exits 0", () => {
  const r = spawnSync(launcher, ["--version"], { encoding: "utf8" });
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe(expectedVersion);
});

test("launcher runs `check` on a document", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const doc = join(dir, "smoke.md");
  writeFileSync(doc, "# smoke\n\nNo arithmetic here.\n");
  const r = spawnSync(launcher, ["check", doc], { encoding: "utf8" });
  expect(r.status).toBe(0);
});

test("launcher resolves through a symlink chain", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const link = join(dir, "visimark");
  symlinkSync(launcher, link);
  const r = spawnSync(link, ["--version"], { encoding: "utf8" });
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe(expectedVersion);
});

test("launcher exits 127 with a message when no runtime is on PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-launcher-"));
  const fakeBin = join(dir, "bin");
  mkdirSync(fakeBin);
  for (const tool of ["readlink", "dirname"]) {
    const p = toolPath(tool);
    if (p) symlinkSync(p, join(fakeBin, tool));
  }
  const r = spawnSync("/bin/sh", [launcher, "--version"], {
    encoding: "utf8",
    env: { PATH: fakeBin },
  });
  expect(r.status).toBe(127);
  expect(r.stderr).toContain("needs Node.js or Bun on PATH");
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bun test packages/visimark/test/cli/launcher.test.ts`
Expected: FAIL — `packages/visimark/bin/visimark` does not exist (spawn ENOENT).

- [ ] **Step 3: Create the launcher script**

Create `packages/visimark/bin/visimark`:

```sh
#!/bin/sh
# visimark launcher. The published package links this file as the `visimark`
# command. It runs the real CLI (bin/visimark.js) under whichever JS runtime is
# on PATH — Node preferred, Bun as fallback — so that `npm i -g visimark` and
# `bun add -g visimark` both produce a working command.
# See docs/design/runtime-portable-launcher-spec.md.

# npm links node_modules/.bin/visimark and bun links ~/.bun/bin/visimark
# straight at this file, so $0 is a symlink chain — walk it to the real path.
target=$0
while [ -L "$target" ]; do
  link=$(readlink "$target")
  case $link in
    /*) target=$link ;;
    *) target=$(dirname "$target")/$link ;;
  esac
done
dir=$(CDPATH= cd -- "$(dirname -- "$target")" && pwd)

runtime=$(command -v node || command -v bun) || {
  echo "visimark: needs Node.js or Bun on PATH" >&2
  exit 127
}

exec "$runtime" "$dir/visimark.js" "$@"
```

- [ ] **Step 4: Set the executable bit**

Run:
```bash
chmod +x packages/visimark/bin/visimark
git add packages/visimark/bin/visimark
git ls-files -s packages/visimark/bin/visimark
```
Expected: mode `100755`.

- [ ] **Step 5: Point `bin` at the launcher and add `engines.bun`**

In `packages/visimark/package.json`:
- Change `"bin": { "visimark": "bin/visimark.js" }` to `"bin": { "visimark": "bin/visimark" }`.
- Change `"engines": { "node": ">=18" }` to `"engines": { "node": ">=18", "bun": ">=1.0.0" }`.

- [ ] **Step 6: Reword the `main.ts` comment**

In `packages/visimark/src/cli/main.ts`, the block at lines 73-77 currently ends
"…when `bin/visimark.js` is the entry point this is false and that shim calls
runCli itself." Replace that sentence with: "…when the `sh` launcher execs
`bin/visimark.js` as the entry point this is `false`, and `bin/visimark.js`
calls `runCli` itself." No code change.

- [ ] **Step 7: Run the launcher test, confirm it passes**

Run: `bun test packages/visimark/test/cli/launcher.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Full local verification**

Run:
```bash
bun test
bun run typecheck
bun run build
bun run lint && bun run format:check
```
Expected: all green. `lint`/`format:check` must not mention `bin/visimark`
(it is extensionless and outside their globs).

- [ ] **Step 9: Manual cross-check**

Run:
```bash
sh packages/visimark/bin/visimark --version
node packages/visimark/bin/visimark.js --version
```
Expected: both print `visimark <version>`.

- [ ] **Step 10: Commit**

```bash
git add packages/visimark/bin/visimark packages/visimark/package.json \
        packages/visimark/src/cli/main.ts packages/visimark/test/cli/launcher.test.ts
git commit -m "$(printf 'fix(cli): sh launcher so bun add -g visimark works without Node\n\nThe bin entry becomes a POSIX sh trampoline that execs bin/visimark.js\nunder node or bun (node preferred). Fixes the #!/usr/bin/env node shebang\nbeing honoured against a bare symlink on Node-less machines. Adds an\nadvisory engines.bun.\n\nIssue #29.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 2: CI — exercise both runtimes

**Files:**
- Modify: `.github/workflows/ci.yml` (append four jobs; existing `build` job unchanged)

**Interfaces:**
- Consumes: `packages/visimark/bin/visimark` and the `bin` wiring from Task 1.
- Produces: CI jobs `acceptance-node`, `pack`, `smoke-node`, `smoke-bun`. No code interface.

- [ ] **Step 1: Add the `acceptance-node` job**

Append to `.github/workflows/ci.yml` under `jobs:` (sibling of `build`):

```yaml
  acceptance-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: actions/setup-node@v7
        with:
          node-version: 20
      - run: bun install --frozen-lockfile
      - run: bun run build
      - name: the built CLI runs under Node against the worked examples
        run: |
          set -e
          bin=packages/visimark/bin/visimark.js
          node "$bin" --version | grep -qE '^visimark [0-9]'
          node "$bin" check docs/example-invoice.md
          if node "$bin" check docs/example-invoice-drift.md; then
            echo "::error::drift example passed under Node; it must fail"; exit 1
          fi
          if node "$bin" check docs/example-quote-plain.md; then
            echo "::error::plain quote passed under Node; it must fail (COVERAGE)"; exit 1
          fi
```

- [ ] **Step 2: Add the `pack` job**

```yaml
  pack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run build
      - name: pack the tarball
        working-directory: packages/visimark
        run: npm pack --pack-destination "$RUNNER_TEMP"
      - uses: actions/upload-artifact@v7
        with:
          name: visimark-tarball
          path: ${{ runner.temp }}/visimark-*.tgz
          if-no-files-found: error
```

- [ ] **Step 3: Add the `smoke-node` job**

```yaml
  smoke-node:
    needs: pack
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: 20
      - uses: actions/download-artifact@v7
        with:
          name: visimark-tarball
      - name: global install under Node only
        run: |
          set -e
          if command -v bun >/dev/null 2>&1; then
            echo "::error::bun is present; smoke-node must be Node-only"; exit 1
          fi
          npm i -g ./visimark-*.tgz
          vm="$(npm prefix -g)/bin/visimark"
          "$vm" --version | grep -qE '^visimark [0-9]'
          printf '# smoke\n' > smoke.md
          "$vm" check smoke.md
```

- [ ] **Step 4: Add the `smoke-bun` job**

```yaml
  smoke-bun:
    needs: pack
    runs-on: ubuntu-latest
    container: oven/bun:latest
    steps:
      - uses: actions/download-artifact@v7
        with:
          name: visimark-tarball
      - name: global install under Bun only
        run: |
          set -e
          # GitHub injects its own Node into container jobs to run JS actions.
          # Reset PATH to a clean set (plus Bun's global bin) so the launcher
          # actually exercises the Bun path, not that injected Node.
          export PATH="$(bun pm bin -g):/usr/local/bin:/usr/bin:/bin"
          if command -v node >/dev/null 2>&1; then
            echo "::error::node still on PATH; smoke-bun must be Bun-only"; exit 1
          fi
          bun add -g ./visimark-*.tgz
          visimark --version | grep -qE '^visimark [0-9]'
          printf '# smoke\n' > smoke.md
          visimark check smoke.md
```

Note: GitHub puts its own Node on `PATH` inside container jobs (to run JS
actions like `download-artifact`), so the step resets `PATH` before the
Bun-only assertion. If `download-artifact` itself misbehaves in the container,
that is a fix-and-repush inside the plan's green loop — do not weaken the
Bun-only guarantee to work around it.

- [ ] **Step 5: Validate the YAML locally**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "ci.yml parses"
```
Expected: `ci.yml parses`. (Semantic validation happens when the branch is pushed.)

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(printf 'ci: run the CLI under Node and smoke-test a global install on both runtimes\n\nacceptance-node runs the worked-example checks under Node; pack + smoke-node\n+ smoke-bun install the packed tarball globally on a Node-only runner and in\na Bun-only container and run visimark. smoke-bun is the regression test for #29.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 3: Release automation recognizes general-track branches

**Files:**
- Modify: `.github/workflows/release.yml` (the "Close shipped …" step and its preceding comment)
- Modify: `docs/releasing.md` (the "What one tag publishes" table row)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no code interface. The close step now matches both `vocab/issue-<n>-<slug>-impl` and `issue/<n>-<slug>-impl`.

- [ ] **Step 1: Prove the current filter misses this branch**

Run:
```bash
printf '%s\n' issue/29-runtime-portable-launcher-impl vocab/issue-18-sqrt-impl \
  | while read -r b; do
      echo "$b" | grep -qE '^vocab/issue-[0-9]+-.+-impl$' && echo "OLD matches $b" || echo "OLD skips  $b"
    done
```
Expected: `OLD skips issue/29-runtime-portable-launcher-impl`, `OLD matches vocab/issue-18-sqrt-impl`.

- [ ] **Step 2: Widen the branch filter and the issue-number extraction**

In `.github/workflows/release.yml`, the step named `Close shipped vocabulary-request issues`:
- Rename it to `Close shipped request issues`.
- In its `--jq` expression, change the regex
  `test("^vocab/issue-[0-9]+-.+-impl$")` to
  `test("^(vocab/issue-|issue/)[0-9]+-.+-impl$")`.
- Change the issue-number extraction line
  `n="${branch#vocab/issue-}"; n="${n%%-*}"`
  to
  `n="${branch#vocab/issue-}"; n="${n#issue/}"; n="${n%%-*}"`.
- In the comment block immediately above the step, change "An approved
  vocabulary primitive is implemented on a branch named
  `vocab/issue-<n>-<slug>-impl`" to "An approved request is implemented on a
  branch named `vocab/issue-<n>-<slug>-impl` (vocabulary) or
  `issue/<n>-<slug>-impl` (general); its issue is left open until the change
  ships. Close each such issue whose implementation PR merged into this
  release."

- [ ] **Step 3: Test the new filter and extraction**

Run:
```bash
for b in issue/29-runtime-portable-launcher-impl vocab/issue-18-sqrt-impl issue/6-eomonth-impl chore/not-an-issue; do
  echo "$b" | grep -qE '^(vocab/issue-|issue/)[0-9]+-.+-impl$' && m=match || m=skip
  n="${b#vocab/issue-}"; n="${n#issue/}"; n="${n%%-*}"
  echo "$b -> $m, n=$n"
done
```
Expected:
```
issue/29-runtime-portable-launcher-impl -> match, n=29
vocab/issue-18-sqrt-impl -> match, n=18
issue/6-eomonth-impl -> match, n=6
chore/not-an-issue -> skip, n=chore/not-an-issue
```

- [ ] **Step 4: Update `docs/releasing.md`**

In the "What one tag publishes" table, the last row currently reads:

```
| Each vocabulary-request issue whose primitive ships in this release, closed | the `vocab/issue-<n>-<slug>-impl` merge commit is an ancestor of the tag | the issue is still open — a re-run skips what is already closed |
```

Replace with:

```
| Each request issue whose change ships in this release, closed | the `vocab/issue-<n>-<slug>-impl` or `issue/<n>-<slug>-impl` merge commit is an ancestor of the tag | the issue is still open — a re-run skips what is already closed |
```

- [ ] **Step 5: Validate the YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "release.yml parses"
```
Expected: `release.yml parses`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml docs/releasing.md
git commit -m "$(printf 'ci: close general-track issue/<n>-<slug>-impl branches on release\n\n#27 renamed the general-track impl branch but left the release close step\nand releasing.md recognising only the vocab form. #29 is the first issue\nto run the general-track lifecycle.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 4: README and CLI reference — install with either manager

**Files:**
- Modify: `README.md` (the "Status" section and the extension block)
- Modify: `docs/cli-reference.md` (the install sentence + a Windows note)

**Interfaces:**
- Consumes: nothing.
- Produces: no code interface. Both files are checked by the `dogfood` workflow, so they must still pass `visimark check`.

- [ ] **Step 1: Update the README "Status" install sentence**

`README.md` lines 349-351 currently:

```
All five commands are implemented, in TypeScript. `npm install -g visimark`
puts a `visimark` command on your PATH; `npx visimark` runs it without
installing. All three worked examples pass as the
```

Replace the first two sentences (through "without installing.") with:

```
All five commands are implemented, in TypeScript. Install the `visimark`
command with `bun add -g visimark` or `npm i -g visimark` — it runs under
whichever of Bun or Node is on your PATH — or run it without installing with
`npx visimark`. (On Windows the `npx` / `npm i -g` shims need `sh` on PATH,
which Git Bash or WSL provide.)
```

Leave "All three worked examples pass as the acceptance suite …" and the rest of the paragraph unchanged.

- [ ] **Step 2: Retitle the extension block**

`README.md` line 366 currently:

```
To try the extension in your own VS Code:
```

Replace with:

```
The extension is not published to a marketplace yet; to build and install it
from a clone (Bun, like the rest of the repo's tooling):
```

The `bash` block (`bun run vscode-install` / `bun run vscode-uninstall`) and the
paragraph after it are unchanged.

- [ ] **Step 3: Update `docs/cli-reference.md`**

Lines 6-8 currently:

```
Install it with `npm install -g visimark`, or run it without installing with
`npx visimark`. From a clone, `bun packages/visimark/src/cli/main.ts` runs the
same CLI straight from source.
```

Replace with:

```
Install it with `bun add -g visimark` or `npm i -g visimark`, or run it
without installing with `npx visimark`. The installed command runs under
whichever of Bun or Node is on your PATH. From a clone,
`bun packages/visimark/src/cli/main.ts` runs the same CLI straight from source.

On Windows, `npx visimark` and `npm i -g visimark` work as elsewhere; npm's
global shim for the launcher invokes `sh`, so `sh` must be on PATH (Git Bash
and WSL provide it, plain PowerShell does not).
```

- [ ] **Step 4: Verify the docs still check clean**

Run:
```bash
bun run packages/visimark/src/cli/main.ts check README.md docs/cli-reference.md
```
Expected: `0 problems` for both.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/cli-reference.md
git commit -m "$(printf 'docs: install visimark with bun add -g or npm i -g\n\nThe published CLI now runs under either runtime. Consumer surfaces name both\nmanagers; the from-a-clone extension build is reframed as the contributor\nstep it is. Windows sh-shim caveat noted.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

### Task 5: Documentation

**Files:**
- Modify: `CHANGELOG.md` (`## Unreleased`)
- Modify: `docs/vocabulary-catalogue.md` (move the section F row to the Shipped register)

**Interfaces:**
- Consumes: the deciding comment URL and this PR's number (#34).
- Produces: nothing.

- [ ] **Step 1: CHANGELOG — add `### Fixed` and `### Changed`**

In `CHANGELOG.md`, under `## Unreleased`, above the existing `### Added`, insert:

```markdown
### Fixed

- **`bun add -g visimark` on a machine without Node.js** produced a `visimark`
  command that could not start (`env: 'node': No such file or directory`) — the
  `#!/usr/bin/env node` shebang was honoured against the bare symlink Bun's
  global install creates. The `visimark` bin is now a POSIX `sh` launcher that
  runs the CLI under whichever of Node or Bun is on PATH (issue #29).

### Changed

- **The `visimark` command runs under Node or Bun.** `bun add -g visimark` and
  `npm i -g visimark` both produce a working command; `package.json` gains an
  advisory `engines.bun`. On Windows the `npx` / `npm i -g` shims need `sh` on
  PATH (Git Bash or WSL).
```

- [ ] **Step 2: Move the catalogue row into the Shipped register**

In `docs/vocabulary-catalogue.md`:

1. In **section F**, replace the `Runtime-portable CLI launcher` row with the placeholder:
   ```
   | _(none yet)_ | | | | | |
   ```

2. In the **Shipped** section intro paragraph, change
   "a vocabulary primitive (now a [`visimark-design.md` §4](visimark-design.md#4-syntax) row) or a language feature (specified in the design doc section it changed)"
   to
   "a vocabulary primitive (now a [`visimark-design.md` §4](visimark-design.md#4-syntax) row), a language feature (specified in the design doc section it changed), or a tooling / process change",
   and change "while it was under review in sections A–E" to "while it was under review in sections A–F".

3. Append to the **Shipped** table:
   ```
   | Runtime-portable CLI launcher | tooling | [#29](https://github.com/michal-niedzwiedzki/visimark/issues/29) | [#34](https://github.com/michal-niedzwiedzki/visimark/pull/34) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/29#issuecomment-5572442105) |
   ```

- [ ] **Step 3: No change needed elsewhere — confirm and note**

- `docs/visimark-design.md` — **no edit**. This changes no language surface (no
  syntax, evaluation, finding, or CLI subcommand), so it has no design-doc
  section.
- `editors/vscode/CHANGELOG.md` — **no edit**. The LSP / extension surface is
  unchanged.
- `skills/visimark/SKILL.md` — **no edit required**. `node bin/visimark.js …`
  and `bun src/cli/main.ts …` from the "From a clone" note both still work.

- [ ] **Step 4: Verify the touched docs check clean**

Run:
```bash
bun run packages/visimark/src/cli/main.ts check CHANGELOG.md docs/vocabulary-catalogue.md
```
Expected: `0 problems` for both.

- [ ] **Step 5: Full local verification**

Run:
```bash
bun test
bun run typecheck
bun run build
bun run lint && bun run format:check
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
```
Expected: all green; the clean invoice exits 0.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "$(printf 'docs: changelog + move the launcher row to the Shipped register\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §2.1–2.3 launcher file + script + behaviour | Task 1 (steps 3, 4, 6) |
| §2.4 install-path matrix | Task 1 test + Task 2 smoke jobs |
| §2.5 correct regardless of Bun behaviour | Task 2 `smoke-bun` (demonstrates it works now) |
| §3 package.json (`bin`, `engines`) | Task 1 step 5 |
| §4.1 `acceptance-node` | Task 2 step 1 |
| §4.2 `pack` / `smoke-node` / `smoke-bun` | Task 2 steps 2-4 |
| §4.3 triggers (no new workflow file) | Task 2 (jobs appended to `ci.yml`) |
| §5 release automation | Task 3 |
| §6 README / cli-reference / Windows caveat | Task 4 |
| §6 `skills/visimark/SKILL.md` (no change) | Task 5 step 3 |
| §7 acceptance | Task 1 test (item 6), Task 2 (items 1-4), Task 4 step 4 / Task 5 step 4 (dogfood docs), Task 1 step 8 (item 5) |
| §8 non-goals | respected — no polyglot, no dev-tooling change, no `dist/` restructure, no Windows shim replacement |
| step-8 doc rule: `## Unreleased` line | Task 5 step 1 |
| step-8 doc rule: catalogue row to Shipped register `UNRELEASED` | Task 5 step 2 |

**Placeholder scan:** none — every code/YAML/prose block is literal.

**Type consistency:** the only cross-task name is the executable path
`packages/visimark/bin/visimark` and its payload `packages/visimark/bin/visimark.js`,
used identically in Tasks 1 and 2. `engines.bun` value `">=1.0.0"` matches the
Global Constraints. The deciding-comment URL and PR number (#34) are identical
in Task 5 and the spec header.

<!--vmark:no-formulas-->
