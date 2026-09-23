# Record the browser bundle's size — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/vendor/visimark-browser.js` can grow without anything noticing — the
`playground-bundle` CI job only checks rebuild fidelity, not size. Add one `bun:test`
assertion that fails when the committed bundle exceeds 10% over its recorded 299,700-byte
baseline, so growth becomes a reviewable CI failure. The second of three follow-ups spiked
in [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176)'s check 4.

**Architecture:** No engine change, no new file, no new CI job. One sibling test and two
constants appended to the existing `packages/visimark/test/playground/browser-graph.test.ts`,
in the file's own comment block distinct from the `node:`-builtin invariant the rest of the
file guards. The test runs in the ordinary `bun test` step of the existing `build` CI job —
unlike the byte-diff `playground-bundle` job, it needs no pinned Bun, since it only measures
a file already present in the checkout.

**Tech Stack:** TypeScript, `bun:test`, `node:fs`'s `statSync` (byte length, matching
`wc -c` — not `readFileSync(..., "utf8").length`, which is a UTF-8 character count and
would not match the baseline's provenance).

**Spec:** [`docs/design/browser-bundle-size-spec.md`](browser-bundle-size-spec.md)

## Global Constraints

- No change to `.github/workflows/ci.yml`, `playground-bundle`, or any published surface —
  the spec's §2 and §5 rule this out explicitly.
- No new fixture file. The fixture is the already-committed `docs/vendor/visimark-browser.js`.
- `BASELINE_BYTES` is `299_700` and `MAX_BUNDLE_BYTES` is `Math.ceil(BASELINE_BYTES * 1.1)`
  (`329_670`) — a formula against the baseline, not a frozen ceiling number, per the spec's
  §2.1. Do not hardcode `329670` as the compared value; compute it from `BASELINE_BYTES`.
- The new test and its constants get their own comment block, placed at the end of the file
  after the four existing tests. Do not rewrite the file's existing top-of-file
  "**Why this file exists**" header — it stays scoped to the `node:`-builtin invariant it
  already describes accurately (spec §2.1, §6).
- The failure message must match the spec's §4 behaviour table literally (modulo the actual
  measured byte count): it names the current size, the ceiling, the baseline, the baseline's
  recorded date, and what to do next (bump `BASELINE_BYTES` with a reason, or check
  `src/playground/browser-entry.ts`'s import graph).
- No documentation file changes beyond this plan's final task — the spec's §7 found no
  external doc invalidated by this change.
- Every commit ends with the one `Co-Authored-By` trailer from
  [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session
  doing the commit. Do not copy a trailer out of this plan or an older commit.
- Work on branch `issue/191-browser-bundle-size-impl` (draft PR #198). Do not open a new PR.
  Do not close issue #191 — it stays open until a release tag ships this.

---

### Task 1: add the size assertion

**Files:**
- Modify: `packages/visimark/test/playground/browser-graph.test.ts`

**Interfaces:**
- Consumes: `statSync` from `node:fs` (new import alongside the existing `readFileSync`);
  the file-scope `bundle` path constant already defined at the top of the file.
- Produces: two new file-scope constants, `BASELINE_BYTES` and `MAX_BUNDLE_BYTES`, and one
  new `test(...)` block. No exported symbols — this is a test file.

- [ ] **Step 1: add `statSync` to the existing `node:fs` import**

  Change line 2 from:
  ```ts
  import { readFileSync } from "node:fs";
  ```
  to:
  ```ts
  import { readFileSync, statSync } from "node:fs";
  ```

- [ ] **Step 2: append the constants and the test**

  At the end of the file, after the closing brace of the last existing test
  (`"the committed bundle contains no node:fs or node:crypto call site"`, currently ending
  at line 128), append:

  ```ts

  /**
   * The size of docs/vendor/visimark-browser.js the day this check was added
   * (2026-09-23), measured the same way the assertion below measures it —
   * statSync(...).size, matching `wc -c`, not a UTF-8 character count.
   *
   * Bump this only when the growth is real and reviewed. Record the date, the
   * new value, and why, directly above this constant — the way ALLOWED_BUILTINS
   * above records why node:path is the one builtin let through. A bump with no
   * reason is indistinguishable from a bundle nobody looked at.
   */
  const BASELINE_BYTES = 299_700;

  /** 10% over the baseline — a margin, not a byte-exact pin, so an unrelated
   * minifier version bump doesn't fail this check the way a byte-exact pin
   * would (the exact churn `playground-bundle` is pinned to Bun 1.4.2 to avoid). */
  const MAX_BUNDLE_BYTES = Math.ceil(BASELINE_BYTES * 1.1); // 329,670

  test("the committed bundle stays under a size ceiling with margin over the recorded baseline", () => {
    const actual = statSync(bundle).size;
    expect(
      actual,
      `docs/vendor/visimark-browser.js is ${actual} bytes, over the ${MAX_BUNDLE_BYTES}-byte ` +
        `ceiling (10% over the ${BASELINE_BYTES}-byte baseline recorded 2026-09-23). If this ` +
        `growth is real and reviewed, bump BASELINE_BYTES above with the date and reason and ` +
        `rebuild; if not, something new was pulled into src/playground/browser-entry.ts's ` +
        `import graph — the source-walk test above names the file.`,
    ).toBeLessThanOrEqual(MAX_BUNDLE_BYTES);
  });
  ```

- [ ] **Step 3: run it and confirm it passes today**

  ```bash
  bun test packages/visimark/test/playground/browser-graph.test.ts
  ```
  All five tests in the file pass; the new one passes because 299,700 ≤ 329,670.

- [ ] **Step 4: verify the failure message, then revert**

  Temporarily change `MAX_BUNDLE_BYTES`'s multiplier from `1.1` to `0.5` (forcing a
  ceiling of `149_850`, below the actual bundle size) and re-run the same command. Confirm
  the test fails and the printed message correctly substitutes the actual bundle size, the
  temporary `149850` ceiling, and the unchanged `299700`/`2026-09-23` baseline text — proving
  the template's interpolation matches Step 2's pattern. Revert the multiplier to `1.1` and
  re-run to confirm green again. This step is verification only — no code change survives
  it.

- [ ] **Step 5: full local check**

  ```bash
  bun test
  bun run typecheck
  bun run build
  ```
  All green. `bun run build` is unaffected by this change (no source file under
  `packages/visimark/src/` changed) but is run per the standing loop-until-green discipline.

---

### Task 2: documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/vocabulary-catalogue.md`

**Interfaces:** None — prose only.

- [ ] **Step 1: `CHANGELOG.md` entry**

  Under `## Unreleased` → `### Added`, in the house style (see the `cross-host` CI-check
  entry for #189 immediately above it in the same section), add:

  ```markdown
  - **The committed browser bundle's size is now checked** (issue #191).
    `docs/vendor/visimark-browser.js` could grow without anything noticing — the
    `playground-bundle` CI job only checks rebuild fidelity against a fresh build, never
    size. A new assertion in `browser-graph.test.ts` fails when the bundle exceeds 10%
    over its recorded 299,700-byte baseline, so growth is now a reviewable CI failure
    instead of an unwatched minified-file diff. The second of three follow-ups spiked in
    #176's architectural-spike check 4.
    See [`browser-bundle-size-spec.md`](docs/design/browser-bundle-size-spec.md).
  ```

- [ ] **Step 2: move the catalogue row to the Shipped register**

  In `docs/vocabulary-catalogue.md`, remove the "Record the browser bundle's size as a
  checked ceiling" row from **section F**'s table, and add a row to the
  [Shipped register](../vocabulary-catalogue.md#shipped) table (top of the table, matching
  the existing most-recent-first order) with only that table's columns:

  ```markdown
  | Record the browser bundle's size as a checked ceiling | tooling | [#191](https://github.com/michal-niedzwiedzki/visimark/issues/191) | [#198](https://github.com/michal-niedzwiedzki/visimark/pull/198) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/191#issuecomment-5796346439) |
  ```

  `Released` stays `—` — this promotes to `SHIPPED` only when the next `vX.Y.Z` tag ships
  it, which also closes issue #191 (`release.yml`; see `docs/releasing.md`). Neither this
  task nor this plan does that promotion.

- [ ] **Step 3: commit**

  Do not write `Closes #191` or any closing keyword in this commit message or in the PR —
  issue #191 stays open until the release tag ships this (`release.yml` closes it then, per
  `docs/releasing.md`), not when this PR merges.

  ```bash
  git add CHANGELOG.md docs/vocabulary-catalogue.md packages/visimark/test/playground/browser-graph.test.ts
  git commit -m "$(printf 'feat: record the browser bundle size as a checked ceiling\n\nSee docs/design/browser-bundle-size-spec.md. Part of #191.\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
  ```

  (If Task 1's commit already landed separately, this step covers only the two
  documentation files plus a follow-up commit — do not squash over Task 1's commit.)
