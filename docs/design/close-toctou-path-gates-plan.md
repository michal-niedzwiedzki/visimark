# Close the TOCTOU window in the path gates — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.3 (row 6, rated B). Hardening only — no
paired spec, per the repo convention that non-vocabulary work does not carry a design
doc. Sits after [`dedupe-path-gates-plan.md`](dedupe-path-gates-plan.md), which left
this window explicitly untouched.

**Goal:** Make the artifact write and the import read operate on a **file descriptor
the gate's verdict still describes**, so a path swapped between the check and the use
is refused rather than followed. Close it for the final path component; state plainly
in code and in `SECURITY.md` what remains open.

**Architecture:** One new module, `packages/visimark/src/fs/open.ts`, holding
`openForWrite()` and `openForRead()` — the fd-acquiring counterpart to
`fs/gate.ts`'s path-legality refusals. `cmdFmt` stops calling `writeFileSync` on a
gated path and calls `writeArtifact()`, which re-verifies ownership **through the
descriptor it writes through**. `import/resolve.ts` reads through an
`O_NOFOLLOW` descriptor instead of `readFileSync(path)`.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), `node:fs` only,
Bun test. No new dependency.

---

## Findings from validating the review's brief

**The request is well founded, and the window is materially wider and more consequential
than the brief describes.** Three corrections, each of which changes the plan.

### 1. The window is not "gate → write". It is "gate → *the rest of the run* → write"

The brief describes `existsSync` → `realpathSync` → `writeFileSync` as though these
were adjacent. They are not. The verdict is produced deep inside evaluation and the
write happens in the CLI, after everything else:

| Step | Where |
|---|---|
| `resolveArtifactPath` → `gated.ok` | [`eval/check-charts.ts:182`](../../packages/visimark/src/eval/check-charts.ts#L182) |
| `classify()` — exists? marker? bytes equal? | [`eval/check-charts.ts:188`](../../packages/visimark/src/eval/check-charts.ts#L188), via [`artifact/stale.ts`](../../packages/visimark/src/artifact/stale.ts) |
| verdict carried as plain data `{target, svg}` | [`write/fmt.ts:197-199`](../../packages/visimark/src/write/fmt.ts#L197-L199) |
| … remaining charts, `planFmt`, `applyEdits`, **and every earlier file in a multi-file `fmt` run** | |
| `mkdirSync` + `writeFileSync(a.target, a.svg)` | [`cli/commands.ts:153-154`](../../packages/visimark/src/cli/commands.ts#L153-L154) |

`visimark fmt docs/*.md` on a repo of any size holds that verdict across hundreds of
milliseconds of unrelated work. This is not a tight race that needs precise timing.

### 2. The marker check races too — and that is the check that protects a human's file

The brief frames the risk as "a symlink pointing outside the tree, defeating the
containment check". But the gate is not the only thing being outrun. `classify()`'s
`unowned` verdict — *this file carries no `<visimark .../>` marker, so a person drew
it, refuse* — is computed in the same breath as the gate and consumed at the same
distant `writeFileSync`. It is the safeguard `artifact/path.ts`'s own header comment
names as the one "that protects a hand-drawn SVG", and it is stale by the time it is
acted on.

So the reachable outcomes are broader than the brief's: not only *write outside the
tree*, but *destroy an unmarked file inside it* by creating it after `classify()` said
`missing`. The second needs no symlink at all — just a `creat` in a directory the
attacker can already write to. Any fix that only re-resolves the path and does not
re-read the marker leaves the more likely outcome open.

### 3. The read side has the same window, and it is an exfiltration path, not just a clobber

The brief covers "the gates" but only prescribes write-side remedies.
[`import/resolve.ts:47-56`](../../packages/visimark/src/import/resolve.ts#L47-L56)
gates then `readFileSync(gated.ok)`. The window is short — the next statement — but the
consequence is that a swapped symlink causes an out-of-tree file's bytes to be parsed as
CSV, bound to columns, and rendered into `visimark check` output and `--json`. The
stamp clause does not help: an *unstamped* import (the common case; `fmt` adds the
stamp) has nothing to compare against. `O_NOFOLLOW` on the read is two lines and closes
it, so it belongs in this change rather than in a follow-up nobody writes.

### 4. Verified: the primitives behave as needed on this platform

Measured under Bun 1.x on Linux, in a temp directory:

| Attempt | Result |
|---|---|
| `open(link → existing file, 'wx')` | refused, `EEXIST` |
| `open(link → nonexistent, 'wx')` | refused, `EEXIST` (dangling links do not slip through) |
| `open(link, O_RDWR\|O_NOFOLLOW)` | refused, `ELOOP` |
| `fstat(fd).isFile()` on a regular file | `true`; `readFileSync(fd)` then `ftruncate`/`write` works |

`fs.constants.O_NOFOLLOW` is `131072` on Linux/macOS and **`undefined` on Windows**;
the code must read it as `?? 0` and the Windows path degrades to `wx`-only protection.
Creating a symlink on Windows requires Developer Mode or elevation, so the degradation
is acceptable — but it must be stated, not assumed.

### 5. What this cannot close, and must therefore be written down

- **Directory-component swaps.** `O_NOFOLLOW` guards the *final* component only. An
  attacker who can replace an intermediate directory with a symlink still redirects the
  open. Closing that needs `openat`-per-component, which Node does not expose. Out of
  reach, not out of mind.
- **Hardlinks.** A hardlink to an out-of-tree file is not a symlink and passes
  `O_NOFOLLOW` and `isFile()`. The marker re-check catches it unless the attacker links
  an already-VisiMark-generated artifact, at which point they have write access to a
  file we were going to overwrite anyway.
- **`mkdirSync(dirname, {recursive: true})`** follows symlinks by design and runs at
  write time. It stays: refusing it would break the legitimate "artifact in a
  not-yet-created subdirectory" case, and the subsequent `wx` open is what actually
  decides.

### Recommendation

**Fix, partially and honestly** — take §2.3's "if fixing" branch for the final
component, and take its "if accepting" branch *as well* for the residue in §5. The
brief presents these as alternatives; the defensible outcome is both. The cost is one
~70-line module, three call-site changes and a symlink-swap test; the benefit is that
the marker rule — the repo's stated protection for a user's own files — becomes true
at the moment it matters rather than several hundred milliseconds earlier.

---

## Global Constraints

- **Behaviour on non-hostile input must not change by a byte.** Every existing
  document, every existing message, every exit code, `fmt` idempotence and the
  acceptance tests that parse published docs all stay as they are.
- **Refusal, never transformation** — the principle `fs/gate.ts` states applies to the
  new module too. A descriptor that does not match the verdict is refused; nothing is
  retried, relocated or repaired.
- **Every descriptor is closed on every path**, including the refusal paths. `try` /
  `finally` around each use, no exceptions.
- **The engine stays free of process state.** `check()` and `fmt()` return data, as
  they do now. No fd, no handle and no open file crosses the `write/fmt.ts` boundary —
  the LSP and the browser build both import that path.
- **Name the residue in code.** The directory-component and hardlink limits get a
  comment in `fs/open.ts` and a sentence in `SECURITY.md` Scope, per §2.3's "if
  accepting" branch.
- **No new dependency, no `any`, no `as any`, no `@ts-ignore`/`@ts-expect-error`.**
- `fix:` prefix for the hardening commits, conventional commits.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 725 pass, 0 fail (baseline on this branch)
bun run typecheck
bun run lint                  # unchanged: 1785 warnings, all from docs/vendor/ (§2.6)
cd packages/visimark && bun src/cli/main.ts check ../../docs/example-charts.md
cd packages/visimark && bun src/cli/main.ts fmt ../../docs/example-charts.md
cd ../.. && git diff --exit-code -- docs/
```

The last two together are the real regression test for this change: `fmt` on a
document whose artifacts are already current must write nothing and leave `docs/`
untouched. If the new open path is wrong, that is where it shows.

---

### Task 1: The fd-acquiring module

**Files:**
- Create: `packages/visimark/src/fs/open.ts`

**Interfaces:**

```ts
export type OpenResult = { ok: number } | { err: string };

/** O_NOFOLLOW where the platform has it; 0 on Windows, which has no symlinks
 *  without elevation. */
const NOFOLLOW: number;

/**
 * Open `target` for writing without following a symlink at the final
 * component. `expectExisting` picks the mode: `false` → `wx` (O_EXCL, which
 * refuses a symlink and a file alike), `true` → `O_RDWR | O_NOFOLLOW`.
 */
export function openForWrite(target: string, expectExisting: boolean): OpenResult;

/** Open for reading with O_NOFOLLOW; the read-side counterpart. */
export function openForRead(target: string): OpenResult;
```

- [x] **Step 1.1** Write the module, with the header comment explaining the
      check-then-use window it exists to narrow, the `O_EXCL`-refuses-symlinks fact
      (it is not obvious and will otherwise be "simplified" away), and the residue
      from findings §5.
- [x] **Step 1.2** `errno` → message mapping: `EEXIST` and `ELOOP` produce
      `"refused: `<path>` changed between check and write"`; `EACCES`/`EPERM`/`ENOENT`
      keep their own wording so a plain permissions problem does not read as an attack.
- [x] **Step 1.3** Verification gate.

**Commit:** `feat: add fs/open.ts, the fd-acquiring half of the path gate`

---

### Task 2: Re-verify artifact ownership through the descriptor

**Files:**
- Modify: `packages/visimark/src/write/fmt.ts` (`ArtifactWrite` gains the verdict)
- Create: `packages/visimark/src/artifact/write.ts`
- Modify: `packages/visimark/src/cli/commands.ts`

`ArtifactWrite` currently carries `{ target, svg, path }` — enough to write, not enough
to re-check. It gains `state: "missing" | "stale"`, `sheetId` and `chart`, all already
on the chart record at [`write/fmt.ts:197`](../../packages/visimark/src/write/fmt.ts#L197).
This is additive; `commands.ts:183` reports only `a.path` and is unaffected.

```ts
// artifact/write.ts
export function writeArtifact(a: ArtifactWrite): { ok: true } | { err: string };
```

`writeArtifact` is the whole fix in one place:

1. `state === "missing"` → `openForWrite(target, false)`. `O_EXCL` means *anything*
   that appeared since `classify()` — file, symlink, directory — is refused.
2. `state === "stale"` → `openForWrite(target, true)`, then `fstatSync(fd).isFile()`,
   then **re-read the bytes through that fd and re-run `readMarker`**, refusing on
   `unowned` or `foreign` with the same wording `check-charts.ts` uses. This is the
   correction from finding 2: the marker verdict is re-established on the object being
   written, not on a name.
3. `ftruncateSync(fd, 0)` then `writeSync(fd, svg, 0, "utf8")`, then `closeSync` in a
   `finally`.

- [x] **Step 2.1** Extend `ArtifactWrite` and the `.map()` in `fmt()`.
- [x] **Step 2.2** Write `artifact/write.ts`.
- [x] **Step 2.3** In `cmdFmt`, replace `writeFileSync(a.target, a.svg)` with
      `writeArtifact(a)`; keep the `mkdirSync` (finding §5). On `err`: print
      `visimark: <message>` to stderr, set `exit = 2`, and in `--json` mode push
      `{ path, error: { code: "WRITE", message } }` onto `fileEntries`, mirroring the
      existing `READ` branch at [`commands.ts:145`](../../packages/visimark/src/cli/commands.ts#L145).
      A genuine `EACCES` stops being an uncaught stack trace, which is a small
      independent win.
- [x] **Step 2.4** Verification gate, plus `fmt` twice over a fresh chart document to
      confirm the missing → stale → current progression still works end to end.

**Commit:** `fix: write artifacts through a verified descriptor, not a re-resolved path`

---

### Task 3: Read imports through an O_NOFOLLOW descriptor

**Files:**
- Modify: `packages/visimark/src/import/resolve.ts`

- [x] **Step 3.1** Replace `readFileSync(gated.ok)` with `openForRead` + `readFileSync(fd)`
      + `closeSync` in a `finally`. Both the `ELOOP` and the `ENOENT` refusals must
      still produce today's exact message,
      ``"imported file not found: `<path>`"`` — the existing `catch` already collapses
      every failure to that, and finding 3 is about what is *read*, not about a new
      diagnostic.
- [x] **Step 3.2** Verification gate.

**Commit:** `fix: read declared imports through a non-following descriptor`

---

### Task 4: Tests that plant the swap

**Files:**
- Create: `packages/visimark/test/fs/open.test.ts`
- Create: `packages/visimark/test/artifact/toctou.test.ts`
- Modify: `packages/visimark/test/import/` (add the read-side case)

These are the only tests in the repo that simulate a concurrent attacker, so the
mechanism gets a comment saying so.

- [x] **Step 4.1** `open.test.ts`: `wx` over a live symlink, over a dangling symlink,
      over a plain existing file; `O_RDWR|O_NOFOLLOW` over a symlink and over a
      regular file. Guarded with `describe.skipIf(process.platform === "win32")` for
      the symlink cases.
- [x] **Step 4.2** `toctou.test.ts`, the test §2.3 asks for: run `fmt` to get the
      `ArtifactWrite` verdict, **then** swap the target for a symlink pointing outside
      the temp tree, **then** call `writeArtifact` — assert it refuses and that the
      out-of-tree file is byte-unchanged. Second case: verdict `missing`, then plant an
      unmarked file at the target, assert refusal and that the planted file survives.
      That second case is finding 2 as an executable test and would pass today's code
      only by accident.
- [x] **Step 4.3** Read side: gate an import, swap the CSV for a symlink to an
      out-of-tree file, assert the out-of-tree contents never reach the model.
- [x] **Step 4.4** Verification gate.

**Commit:** `test: refuse a target swapped between the gate and the write`

---

### Task 5: Record the decision and the residue

**Files:**
- Modify: `SECURITY.md`
- Modify: `packages/visimark/src/fs/gate.ts` (one cross-reference comment)

- [x] **Step 5.1** `SECURITY.md` Scope gains a short paragraph: writes and declared
      reads go through a descriptor checked at the moment of use; a concurrent local
      process that can replace an *intermediate directory* is outside the threat model,
      and what would change that (VisiMark running as a service, or in a shared CI
      workspace).
- [x] **Step 5.2** `fs/gate.ts` gets one line pointing at `fs/open.ts` as where the
      verdict is re-established, so the next reader of the gate does not assume the
      path result is still true at write time.
- [x] **Step 5.3** Verification gate.

**Commit:** `docs: scope the residual path race in SECURITY.md`

---

## Maintainer decisions (2026-09-15)

1. **Exit code `2`** for a refused write — approved. A refused write is a tool-level
   failure, not the document's fault.
2. **Read side included** — Task 3 stays in this change.
3. **`--json` shape — the answer to "check first" is yes, there is a contract.**
   [`structured-output-json-spec.md`](structured-output-json-spec.md) documents
   `error.code` as a closed enum, `"USAGE" | "READ"`, in both the envelope table (§3)
   and the error table (§4). `WRITE` is therefore a spec change, not just an
   implementation detail, and Task 5 widens the enum and adds the row rather than
   letting the code and the spec drift apart.

## Outcome

Four source files, ~150 lines of new code, 15 new tests. 725 → 741 green; typecheck
clean; lint unchanged at 1,785 warnings, all from `docs/vendor/` (§2.6's problem,
untouched).

**The fix works where it was claimed to.** Mutation-tested: restoring the old
`writeFileSync(a.target, a.svg)` fails five of the six cases in
`test/artifact/toctou.test.ts`, the happy path being the one that still passes. The
two most valuable of those five are not the symlink cases the review named — they are
the marker cases from finding 2, where a plain file is planted after `classify()` said
`missing` or after it said the artifact was ours. Those need no symlink and no
elevated privilege.

**End-to-end, nothing else moved.** `fmt` over `docs/example-charts.md` is still a
no-op, and the missing → stale → current progression over a fresh scratch copy still
writes 5 artifacts, then 0, then repairs exactly the one perturbed. `git diff` over
`docs/` is empty.

Three things worth knowing that the plan did not anticipate:

- **`result.charts` needed a narrowing loop, not `filter().map()`.** TypeScript does
  not narrow a union through `filter` without a type predicate, and the plan's shape
  would have needed `c.state as "missing" | "stale"`. A plain `for` loop with
  `continue` guards gets the same result with no cast, which is what the repo's
  zero-assertion posture asks for.
- **A refused write now abandons the whole file**, document splice included: the
  refusal `break`s out of the artifact loop and `continue`s to the next file, so
  `r.output` is never written. A `fmt` that updated the anchors but not the artifact
  they point at is worse than one that did nothing. Artifacts written *before* the
  refusal in the same file do stay written; making that all-or-nothing would need a
  staging directory, which is more machinery than this warrants.
- **The read-side race has no test seam.** `resolveImports` gates and reads in
  consecutive statements with nothing injectable between them, so a link cannot be
  planted mid-function from a test. `test/fs/open.test.ts` asserts `O_NOFOLLOW`
  directly instead, and the comment in `resolve.test.ts` says which refusal each test
  is actually pinning rather than implying a TOCTOU case it does not exercise.

`fs/open.ts` is now the one place any future writer should acquire a descriptor
through, and `fs/gate.ts` carries a line pointing at it so the next reader does not
assume a path verdict survives to write time.

## Out of scope

- §2.4 (parser depth cap), §2.5 (playground bundle), §2.6 (lint), §2.7, §2.8.
- The document write itself (`writeFileSync(path, r.output)`): that path comes from
  `argv`, not from a document, so it is outside the threat model `SECURITY.md` states.
- Any change to the gate's nine refusals, its messages, or `classify()`'s verdicts.
