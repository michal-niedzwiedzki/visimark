# Clear the community scanner's Errors and fixable advisories — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the Obsidian community scanner's two Errors and three fixable advisories, and gate both in CI.

**Architecture:**
- **One module, `site/src/html.ts`, owns every HTML-string-to-DOM path in `site/`.** Its doc comment is the trust boundary. Fifteen call sites move to it or to plain `createElement`.
- **Advisories reuse the osv-scanner that `supply-chain.yml` already runs.** Exact root `overrides` clear three; a root `osv-scanner.toml` accepts the fourth with an expiry.
- **A new CI step**, `lint:scanner`, runs the scanner's two Error rules, untyped, over every tracked JS/TS file except `docs/vendor/`.

**Tech Stack:** TypeScript, Bun 1.4.2 (`packageManager`), ESLint 10 with `eslint-plugin-obsidianmd` 0.4.2 and `typescript-eslint` (existing `editors/obsidian` devDependencies), happy-dom (existing `site` devDependency), osv-scanner 2.7.0 (already pinned in `supply-chain.yml`), GitHub Actions.

**Spec:** [`clear-scanner-errors-lint-repo-in-ci-spec.md`](clear-scanner-errors-lint-repo-in-ci-spec.md)

## Global Constraints

- **Commits:** every commit ends with the `Co-Authored-By:` trailer that [`ai-attribution.md`](../../.agents/rules/ai-attribution.md) names for the session doing the work.
- **No new dependencies, peer dependencies or public exports** in any published package ([`dependencies-and-pins.md`](../../.agents/rules/dependencies-and-pins.md)). `site/` is private.
- **What must not change:** the `visimark` CLI, its exit codes, streams and `--json`; the composite Action; `editors/obsidian/main.js`; every published package's `dist/`.
- **No security claim.** `setTrustedHtml` is not a sanitiser, and no comment or commit message may call it one.
- **The vendor bundles:** `docs/vendor/` is rebuilt with the pinned Bun (`bun run --filter visimark-site build:playground`) and committed in the same commit as the site source it is built from.
- **No inline styles:** no static inline style value is assigned from TypeScript anywhere in tracked source after Task 2.
- **The local gate after each task:** `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run build` and `bun run test` from the repo root all exit 0.

## Review Focus

1. **Repeated renders.** The playground preview re-renders on every typing settle, so `setTrustedHtml` must *replace* children, never append. This is pinned in Task 1's `replaces existing children` test.
2. **Inline SVG must stay SVG.** A badge icon parsed as `text/html` must keep the SVG namespace or it renders as nothing. This is pinned in Task 1's `keeps the SVG namespace` test.
3. **An empty string clears.** `BADGE_ICONS[x] ?? ""` passes `""`, and the element must end up empty, not keep its old icon. This is pinned in Task 1's `empty string clears` test.
4. **Charts embedded after the preview.** `pipeline.ts` calls `embedCharts(...)` right after filling the preview, and it queries the preview's nodes. The fill must therefore be synchronous, which `replaceChildren` is. This is pinned by the existing `persistence` and `builder` tests staying green in Task 2, and by manual check 10 in the spec.
5. **A deleted, uncommitted file.** `git ls-files` still lists a file deleted in the working tree but not yet committed, so ESLint exits 2 ("No files matching"). This is local-only; CI checks out clean trees. Pinned as a sentence in the `lint:scanner` script's comment in Task 4. No test.

---

### Task 1: `site/src/html.ts` — the helper and the merged `escapeHtml`

**Files:**
- Create: `site/src/html.ts`
- Modify: `site/src/pages/dom.ts` (delete `escapeHtml` and its doc comment; update the module comment's "two text helpers")
- Modify: `site/src/playground/dom.ts` (delete `escapeHtml`)
- Modify: every `site/src` importer of either `escapeHtml`. List them with `grep -rln "escapeHtml" site/src`; repoint each to `../html.js`.
- Modify: `site/test/pages/site-scripts.test.ts:16` (import `escapeHtml` from `../../src/html.js`)
- Test: `site/test/html.test.ts`

**Interfaces:**
- Produces: `escapeHtml(s: string): string` and `setTrustedHtml(el: Element, html: string): void`, both from `site/src/html.ts`.

- [ ] **Step 1: Write the failing test `site/test/html.test.ts`.** It registers happy-dom the way `site/test/playground/editor.test.ts:1-2` does. Each test compares against `ref.innerHTML = s` on a sibling element:
  - `matches innerHTML for a marked-style block`: `s = "<h2>T</h2><table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>"`; `el.innerHTML === ref.innerHTML`.
  - `keeps the SVG namespace`: `s = '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>'`; `el.querySelector("svg")!.namespaceURI === "http://www.w3.org/2000/svg"`.
  - `text-only string becomes a text node`: `s = "plain & simple"` (as markup); `el.textContent === "plain & simple"` and `el.childNodes.length === 1`.
  - `replaces existing children`: call twice with `"<p>a</p>"` then `"<p>b</p>"`; `el.innerHTML === "<p>b</p>"`.
  - `empty string clears`: fill with `"<p>a</p>"`, then call with `""`; `el.childNodes.length === 0`.
  - `script is inert`: `s = "<script>globalThis.__ran = true</script>"`; `el.querySelector("script") !== null` and `globalThis.__ran === undefined`.

- [ ] **Step 2: Run it and see it fail.**
  Run: `cd site && bun test test/html.test.ts`
  Expected: FAIL. The module `../src/html.js` is not found.

- [ ] **Step 3: Implement `site/src/html.ts`.**
  - `escapeHtml` moves verbatim from `site/src/pages/dom.ts`, with that file's doc comment (the double-quote rationale).
  - `setTrustedHtml(el, html)` is `el.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes)`.
  - The module doc comment is the trust boundary. It carries the six points of spec [§2.1](clear-scanner-errors-lint-repo-in-ci-spec.md#21-sitesrchtmlts--one-module-for-html-strings-into-the-dom), merged from `site/src/playground/pipeline.ts:326-342` and `site/src/pages/demo-panes.ts:62-75`. Keep their concrete examples: `?file=` cannot carry content, `index.html` has no `connect-src`, and the page's `script-src`.
  - Delete both `escapeHtml` copies and repoint every importer.

- [ ] **Step 4: Run the tests and see them pass.**
  Run: `cd site && bun test test/html.test.ts test/pages/site-scripts.test.ts`
  Expected: PASS.
  Run: `bun run typecheck`
  Expected: exit 0.

- [ ] **Step 5: Commit.**
  `git add site/src/html.ts site/src/pages site/src/playground site/test`, then commit with `feat(site): one module for HTML strings into the DOM (#402)` plus the trailer.
  `docs/vendor/` is rebuilt in Task 2. Task 1 changes imports only, so the bundles stay byte-identical. Confirm with `bun run --filter visimark-site build:playground && git diff --exit-code -- docs/vendor/`; if they differ, add them to this commit.

### Task 2: Move the 15 call sites and the clipboard styles

**Files:**
- Modify: `site/src/pages/demo-panes.ts:62-77`, `site/src/pages/preview-page.ts:58,64-66,77`, `site/src/pages/preview-cards.ts:236`, `site/src/pages/repo-scan.ts:420,432-441`, `site/src/pages/articles-carousel.ts:36-41`, `site/src/pages/index-page.ts:70-72`
- Modify: `site/src/playground/pipeline.ts:326-343`, `site/src/playground/badges.ts:126,155`, `site/src/playground/reference.ts:63,65`, `site/src/playground/clipboard.ts:16-20`
- Modify: `docs/styles.css` (add `.code-plain`), `docs/playground.html` (add `.clipboard-scratch` to the inline `<style>` block)
- Modify: `site/test/support/fake-dom.ts`
- Create: `site/test/html-callers.test.ts`
- Regenerate: `docs/vendor/*.js`

**Interfaces:**
- Consumes: `setTrustedHtml` from Task 1.
- Produces: the caller list that Task 4's gate relies on (no `innerHTML` writes left in `site/src` except `= ""`).

- [ ] **Step 1: Write the failing caller-list test, `site/test/html-callers.test.ts`.**
  - It walks `site/src` (with `readdirSync` and `recursive: true`) for `.ts` files whose text contains `setTrustedHtml(`, excluding `html.ts`.
  - It asserts that the sorted list equals `["pages/articles-carousel.ts", "pages/demo-panes.ts", "pages/preview-cards.ts", "pages/preview-page.ts", "pages/repo-scan.ts", "playground/badges.ts", "playground/pipeline.ts", "playground/reference.ts"]`.
  - When a file outside the list calls it, the failure message is exactly: `setTrustedHtml has a caller not on the list: <file>. Add it here only after checking that everything it passes is trusted — see the boundary in site/src/html.ts.`
  - A second test, `no innerHTML write outside literal clears`, asserts that no `site/src` file matches `/\.innerHTML\s*=\s*(?!""\s*;)/`.

- [ ] **Step 2: Run it and see it fail.**
  Run: `cd site && bun test test/html-callers.test.ts`
  Expected: FAIL. The list is empty, and the `innerHTML` test names 9 files.

- [ ] **Step 3: Extend `site/test/support/fake-dom.ts`.**
  - **`installFakeDom()`** sets `globalThis.DOMParser` and restores it in `restore()`. It is a class whose `parseFromString(html)` returns `{ body: { childNodes: [p] } }`, where `p` is a `FakeElement` with `tagName === "#parsed"` and `html === html`.
  - **`FakeElement.replaceChildren(...nodes: FakeElement[]): void`** clears `children`, `ownText` and `html`. A `#parsed` node's `html` is appended to `this.html`; any other node is appended with `appendChild`.
  - **Comments:** update the `html` field's comment to "whatever was last assigned to `innerHTML` or handed to `setTrustedHtml`". The header's "worth noticing" rule is met by a one-line note naming the reason (`site/src/html.ts`).

- [ ] **Step 4: Move each call site, as the table in spec [§2.2](clear-scanner-errors-lint-repo-in-ci-spec.md#22-the-15-call-sites) says.**
  - **`repo-scan.ts:440`:** the bar fill's width is `fill.style.width = \`${Math.round(fraction * 100)}%\``.
  - **`index-page.ts`:** the `code` element gets `className = "code-plain"`. Add `.code-plain { background: none; color: inherit; padding: 0; }` to `docs/styles.css`.
  - **`clipboard.ts`:** `ta.className = "clipboard-scratch"`. Add `.clipboard-scratch { position: fixed; top: 0; left: -9999px; }` to `docs/playground.html`'s inline `<style>`. Keep the existing "Off-screen rather than hidden" comment.
  - **The boundary comments** in `pipeline.ts` and `demo-panes.ts` become `// Trust boundary: see setTrustedHtml in ../html.ts.`
  - **The `lgtm[js/xss-through-dom]` marker** leaves `demo-panes.ts`. Task 5 re-adds it on the helper only if CodeQL flags the PR.

- [ ] **Step 5: Rebuild the bundles and run the site tests.**
  Run: `bun run --filter visimark-site build:playground`
  Then run: `bun run --filter visimark-site test`
  Expected: PASS, including `bundle-size.test.ts` (ceiling 638,894 bytes), `html-callers.test.ts`, `quest-render`, `persistence` and `builder`.

- [ ] **Step 6: Check no static style remains in `site/src`.**
  Run: `grep -rnE '\.style\.[a-zA-Z]+\s*=\s*"' site/src`
  Expected: no output. The ESLint-level proof that both Error rules are gone is Task 4's Step 7.

- [ ] **Step 7: Commit.**
  `git add site docs/styles.css docs/playground.html docs/vendor`, then commit with `fix(site): replace the scanner-flagged innerHTML writes and inline styles (#402)` plus the trailer.

### Task 3: Advisory overrides and the accepted-advisory list

**Files:**
- Modify: `package.json` (`overrides`), `bun.lock`
- Create: `osv-scanner.toml`
- Modify: `.github/workflows/supply-chain.yml` (both jobs)
- Modify: `scripts/check-overrides.ts` (header comment only)

**Interfaces:**
- Produces: `osv-scanner.toml` (read by osv-scanner from the lockfile's directory); the root overrides `"moment": "2.31.0"`, `"smol-toml": "1.9.1"`, `"katex": "0.18.11"`.

- [ ] **Step 1: Add the three overrides** to the root `package.json`, after the four CodeMirror entries.
  Then run `bun install`. Expected: `bun.lock` resolves `moment@2.31.0`, `smol-toml@1.9.1` and `katex@0.18.11`.
  Then run `bun install --frozen-lockfile`. Expected: exit 0.

- [ ] **Step 2: Check the advisories and the lint-rule tests.**
  Run: `bun audit`
  Expected: only `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm).
  Run: `cd packages/markdownlint-visimark && bun test`
  Expected: PASS (35 tests at plan time).

- [ ] **Step 3: Create `osv-scanner.toml`** with exactly the content in spec [§2.5](clear-scanner-errors-lint-repo-in-ci-spec.md#25-osv-scannertoml--the-accepted-advisory-list): the comment block plus the one `braces` entry, with `ignoreUntil = 2027-04-17`.

- [ ] **Step 4: Fail `supply-chain.yml` on an unused ignore.**
  - **Where osv-scanner reports it:** "<path> has unused ignores:" followed by ` - <id>` lines. It goes to **stderr** under `--format json` (the `osv-pr` job) and to **stdout** in table format (the `osv-scan` job). It does not change the exit code.
  - **The shell function**, defined in each job's step: `unused_ignores <logfile>` prints each id from the lines after `has unused ignores:` that match `^ - `. For each id it echoes `::error file=osv-scanner.toml::<id> is ignored in osv-scanner.toml but no longer matches anything in bun.lock. Remove the entry.`, and it returns 1 if it printed any.
  - **`osv-pr`:** scan the head lockfile with `2> "$RUNNER_TEMP/head.err"` (the base scan is unchanged), `cat` that file into the log, then call `unused_ignores "$RUNNER_TEMP/head.err"` before the advisory diff. The existing diff logic and messages stay byte-identical.
  - **`osv-scan`:** run the scan into `tee "$RUNNER_TEMP/scan.log"` with `2>&1`, keep osv-scanner's exit status, call `unused_ignores`, and exit non-zero if either failed.
  - **Comments:** update the job comments to name the new rule.

- [ ] **Step 5: Prove both outcomes locally**, using the pinned binary. Download v2.7.0 to a temp directory and check it against the SHA-256 in `supply-chain.yml` before running it.
  - On the real tree: `osv-scanner scan source --lockfile=bun.lock`. Expected: `filtered out because: braces: …`, `Filtered 1 vulnerability from output`, `No issues found`, exit 0.
  - With a temporary bogus `[[IgnoredVulns]] id = "GHSA-xxxx-xxxx-xxxx"` added, run the `osv-scan` step's script body under `bash`. Expected: `::error file=osv-scanner.toml::GHSA-xxxx-xxxx-xxxx is ignored in osv-scanner.toml but no longer matches anything in bun.lock. Remove the entry.`, exit 1.
  - Revert the bogus entry. Keep the transcript for the PR description.

- [ ] **Step 6: Rewrite the `check-overrides.ts` header** to the two purposes and the manual re-check from spec [§2.8](clear-scanner-errors-lint-repo-in-ci-spec.md#28-check-overridests).
  Run: `bun scripts/check-overrides.ts`
  Expected: exit 0. The three new lines read `checked against 0 declared range(s)`.

- [ ] **Step 7: Commit.**
  `git add package.json bun.lock osv-scanner.toml .github/workflows/supply-chain.yml scripts/check-overrides.ts`, then commit with `chore(deps): clear the moment, smol-toml and katex advisories; accept braces with an expiry (#402)` plus the trailer.

### Task 4: The scanner step

**Files:**
- Create: `editors/obsidian/eslint.scanner.config.mjs`
- Modify: `editors/obsidian/package.json` (script `lint:scanner`), root `package.json` (script `lint:scanner`)
- Modify: `.github/workflows/ci.yml:81-84`
- Modify: `packages/markdown-it-visimark/test/fence.test.ts:42`, `packages/markdown-it-visimark/test/acceptance.test.ts:27`
- Test: `editors/obsidian/test/scanner-config.test.ts`

**Interfaces:**
- Consumes: Task 2's clean `site/` (the gate passes only after it).
- Produces: `bun run lint:scanner` (exit 0 clean, 1 on a flagged pattern, 2 if the config fails to load).

- [ ] **Step 1: Write the failing test, `editors/obsidian/test/scanner-config.test.ts`.**
  - Set it up with `new ESLint({ cwd: <repo root>, overrideConfigFile: "editors/obsidian/eslint.scanner.config.mjs" })` and `lintText(code, { filePath: "<repo root>/site/src/probe.ts" })`.
  - `flags an innerHTML assignment`: `"declare const el: HTMLElement; declare const html: string; el.innerHTML = html;"` → exactly one message, `ruleId === "no-unsanitized/property"`, `severity === 2`.
  - `flags a static style`: `"declare const el: HTMLElement; el.style.left = \"-9999px\";"` → exactly one message, `ruleId === "obsidianmd/no-static-styles-assignment"`, `severity === 2`.
  - `accepts setTrustedHtml`: a `setTrustedHtml(el, html)` declaration whose body is the `replaceChildren(...DOMParser...)` line, plus a call → zero messages.
  - `ignores docs/vendor`: `(await eslint.isPathIgnored("<repo root>/docs/vendor/x.js")) === true`.

- [ ] **Step 2: Run it and see it fail.**
  Run: `cd editors/obsidian && bun test test/scanner-config.test.ts`
  Expected: FAIL. The config file is not found.

- [ ] **Step 3: Create `editors/obsidian/eslint.scanner.config.mjs`.**
  - It collects the `plugins` objects from `obsidianmd.configs.recommended`, then exports `defineConfig([{ ignores: ["docs/vendor/**"] }, { files: ["**/*.{ts,mts,cts,js,mjs,cjs}"], languageOptions: { parser: tseslint.parser }, plugins: { "no-unsanitized": <collected>, obsidianmd: <collected> }, rules: { "no-unsanitized/property": "error", "obsidianmd/no-static-styles-assignment": "error" } }])`.
  - The header comment covers:
    - why only two rules: the scanner's typed setup can't be reproduced, and the full ruleset gives 26 Errors the Scorecard doesn't list;
    - why the plugins are not imported by name: `eslint-plugin-no-unsanitized` is not our dependency;
    - that the file set is a superset of the scanner's;
    - that bumping `eslint-plugin-obsidianmd` means reading the next Scorecard for new Error rules.

- [ ] **Step 4: Run the test and see it pass.**
  Run: `cd editors/obsidian && bun test test/scanner-config.test.ts`
  Expected: PASS. If happy-dom's globals from the workspace preload break ESLint, move the test to `scripts/scanner-config.test.ts`, which the root `bunfig.toml` runs, and update this plan's file list in the same commit.

- [ ] **Step 5: Add the scripts.**
  - **`editors/obsidian/package.json`:** `"lint:scanner": "cd ../.. && eslint --config editors/obsidian/eslint.scanner.config.mjs $(git ls-files -- '*.ts' '*.mts' '*.cts' '*.js' '*.mjs' '*.cjs' ':!docs/vendor/**')"`.
  - **Root `package.json`:** `"lint:scanner": "bun run --filter visimark-obsidian lint:scanner"`.
  - **The comment for Review Focus 5** (a deleted, uncommitted file makes ESLint exit 2) goes in `CONTRIBUTING.md`'s row in Task 5, since `package.json` has no comments.

- [ ] **Step 6: Fix the two `markdown-it-visimark` test lines** to `host.replaceChildren(...new DOMParser().parseFromString(out, "text/html").body.childNodes)` and the same shape at `acceptance.test.ts:27`.
  Run: `cd packages/markdown-it-visimark && bun test`
  Expected: PASS.

- [ ] **Step 7: Run the gate.**
  Run: `bun run lint:scanner`
  Expected: exit 0, no ESLint output.
  Then add `el.innerHTML = location.hash;` to any `site/src` file temporarily, run it again, and expect exit 1 with one `no-unsanitized/property` error naming that file and line. Revert the line.

- [ ] **Step 8: Wire it into CI.** In `ci.yml`, directly after `- run: bun run --filter visimark-obsidian lint`, add `- run: bun run lint:scanner`. Rewrite the comment above the two steps:
  - the first step is the scanner's full typed ruleset on the plugin, whose warnings are listed in `editors/obsidian`'s changelog;
  - the second is the scanner's two Error rules over every tracked file, because the portal lints the whole repository.

- [ ] **Step 9: Commit.**
  `git add editors/obsidian package.json .github/workflows/ci.yml packages/markdown-it-visimark/test`, then commit with `ci: run the community scanner's Error rules over every tracked file (#402)` plus the trailer.

### Task 5: Documentation, follow-up issue and the CodeQL check

**Files:**
- Modify: `docs/releasing.md:180,220-226`
- Modify: `CONTRIBUTING.md` (command table near line 242)
- Modify: `.agents/rules/dependencies-and-pins.md` (pins table)
- Modify: `CHANGELOG.md` (`## Unreleased`)
- Modify: `editors/obsidian/CHANGELOG.md` (`## Unreleased`)
- Modify: `docs/vocabulary-catalogue.md` (move the #402 row to the Shipped register)
- Modify (conditional): `site/src/html.ts` (CodeQL marker)

**Interfaces:**
- Consumes: the command name `bun run lint:scanner` (Task 4) and the file `osv-scanner.toml` (Task 3).

- [ ] **Step 1: `docs/releasing.md`.**
  - **Line 180:** "Before tagging, `bun run --filter visimark-obsidian lint` and `bun run lint:scanner` must show no errors."
  - **Lines 222-226:** replace the two count-bearing bullets with three:
    - the scanner lints with `eslint-plugin-obsidianmd`; CI runs its full typed ruleset on the plugin and its two Error rules over every tracked file (`lint:scanner`);
    - warnings show on the public Scorecard and are accepted, with no count written down;
    - dependency advisories are fixed with root overrides or accepted in `osv-scanner.toml`, and `supply-chain.yml` checks both.

- [ ] **Step 2: `CONTRIBUTING.md`.** Add a row: `bun run lint:scanner` — "the Obsidian community scanner's two Error rules over every tracked JS/TS file (a file deleted but not yet committed makes it exit 2: commit or restore it)".

- [ ] **Step 3: `.agents/rules/dependencies-and-pins.md`.**
  - Add the pins-table row: `| An accepted advisory (`osv-scanner.toml`, with `ignoreUntil`) | `supply-chain.yml`'s osv-scanner jobs: an expired or unused entry fails |`.
  - Amend the overrides row's check to `scripts/check-overrides.ts`; an advisory override also `supply-chain.yml`.

- [ ] **Step 4: The changelogs.**
  - **`CHANGELOG.md` `## Unreleased`**, under `### Added`:
    - `bun run lint:scanner` in CI;
    - `osv-scanner.toml` and the unused-ignore failure;
    - the three overrides, each with its GHSA id.
  - **`editors/obsidian/CHANGELOG.md` `## Unreleased`:** the one line from spec [§7](clear-scanner-errors-lint-repo-in-ci-spec.md#7-documentation-to-update).

- [ ] **Step 5: `docs/vocabulary-catalogue.md`.** Move the #402 row out of section F into the Shipped register as `UNRELEASED`, using that table's columns:
  - `Name`: Clear the community scanner's Errors and fixable advisories, and gate them in CI;
  - `Kind`: tooling;
  - `Request`: `[#402](…)`;
  - `Landed`: `[#404](https://github.com/michal-niedzwiedzki/visimark/pull/404)`;
  - `Released`: `—`;
  - `Decision`: `[APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/402#issuecomment-6225858719)`.

- [ ] **Step 6: Verify the docs.**
  Run: `bun scripts/check-links.ts`
  Expected: exit 0.

- [ ] **Step 7: Commit.**
  `git add docs CONTRIBUTING.md .agents/rules CHANGELOG.md editors/obsidian/CHANGELOG.md`, then commit with `docs: the scanner gate, accepted advisories and the trust-boundary helper (#402)` plus the trailer.

- [ ] **Step 8: After the push, the CodeQL check.** When CodeQL's run on PR #404 finishes, read its alerts on the PR.
  - **If it flags `site/src/html.ts`:** add `// lgtm[js/xss-through-dom]` to the `replaceChildren` line, with one sentence pointing to the boundary comment. Commit it as `chore(site): carry the CodeQL suppression on setTrustedHtml (#402)`.
  - **If it does not:** state that in the PR description.

- [ ] **Step 9: The follow-up issue.** Draft it with `/issue-prepare`. Its subject is the 26 Errors that the full typed `eslint-plugin-obsidianmd` ruleset reports, to be handled with oxlint's type-aware rules. The rules and counts are in the pre-review of #402. File it only on the maintainer's confirmation, and link it from the PR description.
