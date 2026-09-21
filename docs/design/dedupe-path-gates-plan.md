# De-duplicate the two path gates — Implementation Plan

**Source:** `REVIEW.md` §2.2 (row 5, rated C+). Refactor only — no paired spec, per
the repo convention that refactors do not carry a design doc.

**Goal:** Replace the two near-identical path gates in
`packages/visimark/src/artifact/path.ts` (chart-output write gate) and
`packages/visimark/src/import/path.ts` (CSV-input read gate) with one shared
`gatePath()` parameterised by noun and extension, without changing one byte of any
error message.

**Architecture:** A single module-level `gatePath(docPath, url, spec)` in
`packages/visimark/src/fs/gate.ts` owns the full refusal sequence and the
`PathResult` type. The two existing modules keep their file paths, their exported
names and their signatures, and become one-line delegations carrying a module-level
`GateSpec` constant. No caller changes.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), Bun test.

---

## Findings from validating the review's brief

**The request is well founded, and more strongly than the brief states.** Normalising
away only the noun (`artifact path` → `imported file path`) and the extension
(`.svg` → `.csv`) leaves exactly **44 differing lines**, as the review claimed — and
every one of those 44 is a comment, an import-statement ordering difference, a
formatter line-wrap, the function name, or the extra `isSymlink` export. **After
normalisation the executable logic is byte-identical**: same nine refusals, same
order, same `contains()`, same `realpathSyncSafe()`, same two-stage symlink check on
target and parent. There is no behavioural divergence to preserve, which makes this
one of the safest possible extractions.

Four corrections and additions to the brief, which change the plan:

1. **`isSymlink()` is dead code.** The brief says "`isSymlink()` stays in
   `artifact/path.ts` — only the write side uses it." Nothing uses it. It is exported
   from `artifact/path.ts:90`, is not re-exported from `src/index.ts`, and grep across
   `src/` and `test/` in all three packages finds no call site. It was introduced in
   `8646427` (Spec #36, charts) and the overwrite protection it was meant to serve was
   instead implemented as the metadata-marker check (point 3). **Maintainer decision
   (2026-09-15): delete it** — an unused export in the most security-sensitive module
   invites someone to assume it is load-bearing, and history restores it trivially if a
   caller ever wants it. Task 3.

2. **The import gate has almost no test coverage, and that is the concrete form of the
   risk the review describes.** `test/artifact/path.test.ts` exercises all nine
   refusal rules with exact-string assertions. On the read side,
   `test/import/resolve.test.ts:105` has a single `toContain("escapes")` case reached
   through `resolveImports`, and `test/import/` has no direct unit test of
   `resolveImportPath` at all. So today a hardening fix applied to one gate and not the
   other would be caught by nothing. The extraction fixes the duplication; a mirrored
   test file is what makes the fix *stay* fixed, so it is part of this work rather than
   a follow-up.

3. **Constraint 4 confirmed: the overwrite rule is genuinely in the caller.** The
   "refuse to overwrite a file without VisiMark's marker" behaviour lives in
   `src/eval/check-charts.ts` (the `disk.state === "unowned"` branch), driven by
   `classify()` in `src/artifact/stale.ts`. It never enters the gate. Nothing about
   this refactor touches it.

4. **`PathResult` is a third copy.** Both modules declare
   `export type PathResult = { ok: string } | { err: string }` independently. It moves
   to `fs/gate.ts` and both modules re-export it, so the structural type also stops
   being duplicated. Neither is exported from `src/index.ts`, so this is package-internal.

**Error-message uniformity.** All nine messages are `<noun> + <fixed suffix>`, with the
extension interpolated in exactly one of them. A `{ noun, ext }` spec is sufficient;
no per-gate message table is needed.

| Refusal | Message |
|---|---|
| empty | `<noun> is empty` |
| control character | `<noun> contains a control character` |
| drive letter | `<noun> must be relative, not a drive letter` |
| URL scheme | `<noun> must be a relative path, not a URL` |
| absolute | `<noun> must be relative` |
| extension | ``<noun> must end in `<ext>` `` |
| device name | ``<noun> uses a reserved device name `<segment>` `` |
| containment | `<noun> escapes the document's directory` |
| symlink escape (target *and* parent) | `<noun> resolves through a symlink out of the document's directory` |

---

## Global Constraints

- **Pure refactor. No error message may change by a byte**, including the two
  symlink-escape messages that today differ only in how the formatter wrapped them.
- **The order of the checks is load-bearing.** The drive-letter test runs before the
  URL-scheme test because `C:` also matches the scheme regex; `artifact/path.ts`
  carries a comment saying so and that comment moves onto the shared function.
- **Carry the rationale comments across verbatim.** The "every rule here is a
  **refusal, never a transformation**" paragraph is the design principle behind the
  module and belongs on `gatePath`. The gate-specific halves of each header comment
  (the marker safeguard on the write side, the design-doc reference and "nothing is
  ever written here" on the read side) stay in their own modules — they document the
  *caller's* contract, not the gate's.
- **No new dependency, no `any`, no `as any`, no `@ts-ignore`/`@ts-expect-error`.**
  The two `oxlint-disable-next-line no-control-regex` suppressions collapse to one,
  keeping its one-line justification.
- **Do not fix bugs or harden behaviour found along the way** — including the TOCTOU
  window, which is §2.3's decision and explicitly asks the maintainer first. Note
  anything found and leave it.
- `refactor:` prefix, conventional commits.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 686 pass, 0 fail (baseline on this branch)
bun run typecheck
bun run lint                  # unchanged: 1785 warnings, all from docs/vendor/ (§2.6)
cd packages/visimark && bun src/cli/main.ts check ../../docs/example-charts.md
cd ../.. && git diff --exit-code -- docs/
```

Plus a mechanical proof that the extraction is behaviour-preserving, captured **once
before Task 1** and re-run after each task — for every rule, against both gates:

```
bun <scratch>/gate-matrix.ts > gate-baseline.txt   # scratch harness, not committed
```

The harness calls `resolveArtifactPath` and `resolveImportPath` over a fixed list of
~25 hostile and legal URLs in a temp directory and prints each verdict. `diff` against
the baseline must be empty. This is stronger than `bun test` here, because the read
gate's rules are today almost entirely untested (finding 2).

---

### Task 1: Extract the shared gate

**Files:**
- Create: `packages/visimark/src/fs/gate.ts`
- Modify: `packages/visimark/src/artifact/path.ts`
- Modify: `packages/visimark/src/import/path.ts`

**Interfaces:**

```ts
// fs/gate.ts
export type PathResult = { ok: string } | { err: string };

export interface GateSpec {
  /** the noun opening every refusal message, e.g. "artifact path" */
  readonly noun: string;
  /** required lowercase extension including the dot, e.g. ".svg" */
  readonly ext: string;
}

export function gatePath(docPath: string, url: string, spec: GateSpec): PathResult;
```

- [x] **Step 1.1** Capture the gate-matrix baseline above.
- [x] **Step 1.2** Create `fs/gate.ts` with `gatePath`, `contains`, `realpathSyncSafe`,
      `WINDOWS_DEVICE` and `CONTROL_CHARS`, moved verbatim from `artifact/path.ts`
      (the copy with the fuller comments) with `"artifact path"` replaced by
      `spec.noun` and `".svg"` by `spec.ext`. The "refusal, never a transformation"
      paragraph becomes the module header.
- [x] **Step 1.3** Reduce `artifact/path.ts` to its header comment, a
      `const ARTIFACT: GateSpec = { noun: "artifact path", ext: ".svg" }`, a
      `resolveArtifactPath` delegating to `gatePath`, a re-export of `PathResult`, and
      `isSymlink` unchanged.
- [x] **Step 1.4** The same for `import/path.ts` with
      `{ noun: "imported file path", ext: ".csv" }`.
- [x] **Step 1.5** Verification gate + gate-matrix diff.

**Commit:** `refactor: extract one shared path gate behind gatePath()`

---

### Task 2: Mirror the write gate's test coverage onto the read gate

**Files:**
- Create: `packages/visimark/test/fs/gate.test.ts`
- Modify: `packages/visimark/test/artifact/path.test.ts` (unchanged assertions; add
  only a note that the shared rules are covered in `fs/gate.test.ts`)

Per finding 2, the extraction removes the duplicated *code* but the duplicated
*risk* only goes away once both nouns are asserted from one table. `gate.test.ts`
runs the nine refusals and the three acceptances against **both** specs, table-driven,
asserting the exact message each produces.

- [x] **Step 2.1** Write the table-driven test over `[artifactSpec, importSpec]`.
- [x] **Step 2.2** Leave every existing test in `test/artifact/path.test.ts` and
      `test/import/resolve.test.ts` exactly as it is. They now overlap with the new
      file; that is correct, since they pin the *public* names while `gate.test.ts`
      pins the shared implementation.
- [x] **Step 2.3** Verification gate.

**Commit:** `test: assert every path-gate refusal against both gate specs`

---

### Task 3: Delete the unused `isSymlink()`

Kept as its own commit so Task 1 stays a provably pure extraction, and so the removal
is independently revertible.

- [x] **Step 3.1** Remove `isSymlink` and its now-unused `lstatSync` import from
      `artifact/path.ts`. Verification gate.

**Commit:** `refactor: drop the unused isSymlink() export`

---

## Maintainer decisions (2026-09-15)

1. **`isSymlink()`** — delete; easily recreated if it becomes wanted again. Task 3.
2. **`src/fs/`** — confirmed. One more directory is affordable for a responsibility
   this well isolated.
3. **§2.3 (TOCTOU)** — stays out; follow the review's ordering.

## Outcome

The two gates went from ~85 lines each to 19 lines each over one 96-line `fs/gate.ts`.
No caller changed, no error message changed, no dependency added.

Verified three ways:

- The 122-case gate matrix (every refusal, bare and extension-suffixed, over both
  gates, plus symlink escapes) is **byte-identical** before and after.
- `bun test` went 686 → 725 green, the 39 new tests coming entirely from
  `test/fs/gate.test.ts`. Typecheck clean; lint unchanged at 1,785 warnings, all from
  `docs/vendor/` (§2.6's problem, untouched).
- **Mutation-tested.** Dropping `\x7f` from the control-char class, reordering the
  drive-letter and URL-scheme checks, and disabling the parent-symlink re-check each
  fail on *both* gates. Before this branch the first and third would have failed on the
  write gate alone — which is finding 2 stated as a passing test.

No bug was found in the gate logic along the way. The TOCTOU window (§2.3) is
untouched and is now a one-place change.

## Out of scope

- §2.3 (TOCTOU window) — a separate decision the review says to put to the maintainer
  before any work.
- §2.6 (lint ignore patterns) — the 1,785 vendor-bundle warnings stay until then.
- Any change to the overwrite/marker rule in `check-charts.ts` or `artifact/stale.ts`.
