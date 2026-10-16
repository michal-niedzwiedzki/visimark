# Clear the community scanner's Errors and fixable advisories, and gate them in CI — feature spec

**Status:** approved (#402) · **Date:** 2026-10-17 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/402#issuecomment-6225858719

## 1. Purpose

The Obsidian community portal reads the root `manifest.json`, so its scanner
treats the whole monorepo as the plugin
([`releasing.md`](../releasing.md#submitting-to-the-community-registry)). Its
Scorecard for 0.4.0 (commit a8d3692) reads **Failed** on two Errors, both under
`site/`, and neither in the shipped `main.js`:

| Rule | Where |
|---|---|
| `no-unsanitized/property` ("Unsafe assignment to innerHTML") | 15 lines across `site/src/pages/{articles-carousel,demo-panes,index-page,preview-cards,preview-page,repo-scan}.ts` and `site/src/playground/{badges,pipeline,reference}.ts` |
| `obsidianmd/no-static-styles-assignment` | `site/src/playground/clipboard.ts:18-20` |

The same Scorecard flags dependency advisories on `braces`, `katex`, `moment`
and `smol-toml`. The repo's own osv-scanner confirms all four
(GHSA-vfj7-8cjw-p6xm, GHSA-238p-pmpm-9mq7, GHSA-4p3w-j4w9-5jqw,
GHSA-r4xh-jqrq-34v2).

Nothing caught either before a release. CI runs the scanner's ruleset only on
`editors/obsidian` (`ci.yml`, `bun run --filter visimark-obsidian lint`), and
`site/` became a workspace in #395. The repo's advisory policy in
`supply-chain.yml` reports these four advisories every week, and so far
nothing has acted on that report.

This spec does three things:

1. Replaces the flagged code.
2. Clears the three advisories that have a fix, and records the fourth as
   accepted.
3. Adds a CI step that fails when either Error rule fires anywhere in the
   tracked source.

The analysis is in the
[pre-review](https://github.com/michal-niedzwiedzki/visimark/issues/402#issuecomment-6225352874)
and the
[discussion summary](https://github.com/michal-niedzwiedzki/visimark/issues/402#issuecomment-6225657842);
this spec supersedes both where they differ.

## 2. The surface

### 2.1 `site/src/html.ts` — one module for HTML strings into the DOM

A new module with two exports. Nothing else in `site/` may parse markup into
the live DOM.

```ts
/** `s` with &, <, > and " replaced. Safe in text and in a double-quoted attribute. */
export function escapeHtml(s: string): string;

/** Replaces el's children with the nodes `html` parses to, as <body> content. */
export function setTrustedHtml(el: Element, html: string): void;
```

- **`escapeHtml` moves here.** It is the identical function now in
  `site/src/pages/dom.ts` and `site/src/playground/dom.ts`. Both copies are
  deleted. Callers import from `../html.js`, and so does
  `site/test/pages/site-scripts.test.ts`. The doc comment from the `pages/`
  copy (why the double quote is escaped) comes with it.
- **What `setTrustedHtml` does:**
  `el.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes)`.
  This is the one markup path the scanner's `no-unsanitized` rule accepts. The
  rule flags `escapeHtml` templates, `DOMPurify.sanitize`, `insertAdjacentHTML`,
  `createContextualFragment`, `setHTMLUnsafe` and `<template>.innerHTML`.
- **Its doc comment is the single statement of the trust boundary**, merged
  from the comments now in `site/src/playground/pipeline.ts` (the preview) and
  `site/src/pages/demo-panes.ts`. It says:
  - every string passed in today is either the visitor's own typing or a
    document committed to this origin, so at worst this is self-XSS;
  - it becomes a real boundary as soon as content written by one person is
    shown to another (a document in the URL, an import from a gist, a paste
    target, a shared workspace);
  - the commit that adds such a path puts the sanitizer inside this function;
  - each page's CSP is the second lock;
  - parsing happens as `<body>` content, so a fragment that only parses inside
    a table or a `<select>` (`<tr>`, `<td>`, `<option>`) must not be passed;
  - this changes the pattern the scanner flags, not security: the same markup
    reaches the page.
- **The CodeQL suppression.** The `lgtm[js/xss-through-dom]` suppression now on
  `demo-panes.ts:77` moves to the helper's `replaceChildren` line, but only if
  CodeQL flags the helper. The implementation PR records which way it went
  (CodeQL default setup runs on the PR).
- **The two old comments shrink to one line each:**
  `// Trust boundary: see setTrustedHtml in ../html.ts.`

### 2.2 The 15 call sites

| Site | Becomes |
|---|---|
| `pages/demo-panes.ts:77` (`marked.parse`) | `setTrustedHtml` |
| `pages/preview-page.ts:58` and `:77` (`marked.parse`, or raw text when `marked` is absent) | `setTrustedHtml` |
| `playground/pipeline.ts:343` (`marked.parse`) | `setTrustedHtml` |
| `pages/preview-cards.ts:236` (prebuilt highlighted slots) | `setTrustedHtml` |
| `pages/repo-scan.ts:420` (the report) | `setTrustedHtml` |
| `pages/articles-carousel.ts:36` (the slides, from `articleBody`) | `setTrustedHtml` |
| `playground/badges.ts:126` and `:155` (SVG icon strings) | `setTrustedHtml` |
| `playground/reference.ts:65` (the description cell's lines) | `setTrustedHtml` |
| `playground/reference.ts:63` (`<code>` + signature) | `createElement("code")` + `textContent` |
| `pages/preview-page.ts:64` (the GitHub link) | `createElement("a")` with `href`, `target`, `rel` set as attributes, plus a text node |
| `pages/repo-scan.ts:440` (the status line) | `createElement` for the spinner, the message and the bar; the fill's width is `fill.style.width = \`${pct}%\`` |
| `pages/articles-carousel.ts:39` (the dots) | one `createElement("button")` per article |
| `pages/index-page.ts:70` (the `infer` button label) | text nodes and a `createElement("code")` carrying a class, in place of the inline `style=` |

- **The dynamic width is allowed.** The rule flags static style values, not
  computed ones, so `fill.style.width` passes (probed).
- **The `infer` button's inline style moves to a class.** That style
  (`background:none;color:inherit;padding:0`) becomes the class `code-plain` in
  `docs/styles.css`, which `index.html` loads.
- **The `= ""` clears stay as they are.** The rule accepts a string literal,
  and `replaceChildren()` is not required. These are in `files.ts`,
  `builder.ts`, `quest.ts`, and `repo-scan.ts:447`.

### 2.3 `clipboard.ts`

The three `ta.style.*` assignments become `ta.className = "clipboard-scratch"`.
The class goes in the inline `<style>` block of `docs/playground.html`, the
only stylesheet the playground loads, with `position: fixed; top: 0; left:
-9999px`. `docs/styles.css` is the wrong place: the playground does not load
it.

### 2.4 Root `overrides`

Added to the root `package.json` as exact versions, next to the four
CodeMirror overrides:

| Package | Override | Advisory range | Held back by |
|---|---|---|---|
| `moment` | `2.31.0` | `>=2.29.2 <2.31.0` | `obsidian` (and the copy nested under `eslint-plugin-obsidianmd`) pins `2.29.4` exactly |
| `smol-toml` | `1.9.1` | `<=1.8.0` | `markdownlint-cli2` pins `1.8.0` exactly |
| `katex` | `0.18.11` | `>=0.11.0 <0.18.2` | `micromark-extension-math` declares `^0.16.0` |

- **`katex` stays on 0.18**, so the jump is one 0.x minor rather than two.
- **`bun.lock` is regenerated**, and `bun install --frozen-lockfile` passes
  afterwards.
- **The `markdownlint-rule-visimark` suite runs green under these versions**
  (35 tests at the time of writing).

### 2.5 `osv-scanner.toml` — the accepted-advisory list

A new file at the repo root, next to `bun.lock`, where osv-scanner looks for
its config:

```toml
# Advisories accepted rather than fixed. Each entry expires: when ignoreUntil
# passes, supply-chain.yml's weekly scan goes red and the entry is re-judged.
# An entry that matches nothing fails both supply-chain jobs (see there).

[[IgnoredVulns]]
id = "GHSA-vfj7-8cjw-p6xm"
ignoreUntil = 2027-04-17
reason = "braces: no patched release exists (latest 3.0.3 is affected). Dev-only, via markdownlint-cli2 and @vscode/vsce > secretlint; never bundled."
```

`braces` cannot be overridden because no fixed version exists. The ignore lasts
six months.

### 2.6 `supply-chain.yml` — fail on a stale ignore

The policy stays exactly as it is:
- **`osv-pr`** fails on a new advisory of CVSS 7 or more and warns on lower ones.
- **`osv-scan`** reports every advisory weekly, goes red, and blocks nothing.

One rule is added to both jobs. When the head-tree scan prints `has unused
ignores`, the step emits this annotation, once per id, and exits 1:

```text
::error file=osv-scanner.toml::GHSA-… is ignored in osv-scanner.toml but no longer matches anything in bun.lock. Remove the entry.
```

In `osv-pr` this applies to the head scan only. The base lockfile is scanned
from `$RUNNER_TEMP/base/`, where no config applies. The osv-scanner version and
its SHA-256 do not change.

### 2.7 The scanner step

| Piece | Exact form |
|---|---|
| Config | `editors/obsidian/eslint.scanner.config.mjs` |
| Workspace script | `editors/obsidian/package.json` → `"lint:scanner"`: runs `eslint --config editors/obsidian/eslint.scanner.config.mjs` **with the repository root as the working directory**, over `git ls-files -- '*.ts' '*.mts' '*.cts' '*.js' '*.mjs' '*.cjs' ':!docs/vendor/**'` |
| Root script | `package.json` → `"lint:scanner": "bun run --filter visimark-obsidian lint:scanner"` |
| CI | `ci.yml`, `build` job, directly after `bun run --filter visimark-obsidian lint`: `- run: bun run lint:scanner` |

- **The working directory must be the root.** ESLint ignores files outside the
  base path ("File ignored because outside of base path", probed). A
  `basePath` inside the config does not lift that.
- **What the config contains:**
  - exactly two rules at `error`: `no-unsanitized/property` and
    `obsidianmd/no-static-styles-assignment`;
  - the parser from `typescript-eslint`;
  - no type information and no `parserOptions.project`;
  - the plugin objects taken from `eslint-plugin-obsidianmd`'s
    `configs.recommended`, not imported by name. `eslint-plugin-no-unsanitized`
    is that plugin's dependency, not ours, so importing it would break the
    rule that a package uses only what it declares;
  - one ignore, `docs/vendor/**`, so a bare `eslint --config … .` run by hand
    agrees with the script.
- **Why only two rules.** The scanner runs type-aware rules with a setup this
  repo cannot reproduce: the full typed `recommended` gives 26 Errors the
  Scorecard does not list. So the step checks the two rules that turned the
  Scorecard to Failed. A comment at the top of the config says so, and says
  that bumping `eslint-plugin-obsidianmd` means re-reading the next Scorecard
  for new Error rules.
- **The file set is a superset of the scanner's:** every tracked JS/TS file
  except committed build output (`docs/vendor/`). `editors/obsidian/main.js`
  is not tracked. So CI is never more lenient than the scanner, whatever the
  scanner skips.
- **Dependencies.** No new dependencies anywhere: `eslint`,
  `eslint-plugin-obsidianmd` and `typescript-eslint` are already
  `editors/obsidian` devDependencies.

The superset includes `packages/markdown-it-visimark/test/fence.test.ts:42`
and `acceptance.test.ts:27` (`innerHTML` in test setup). Both change:

| Test | Fix |
|---|---|
| `fence.test.ts:42` | `host.replaceChildren(...new DOMParser().parseFromString(out, "text/html").body.childNodes)`, the same pattern as the helper. The engine package cannot import from `site/`. |
| `acceptance.test.ts:27` | the same fix |

### 2.8 `check-overrides.ts`

Its range check is unchanged. Its header comment changes from "The root
`overrides` keep one copy of each CodeMirror package" to two purposes:
- **one copy per CodeMirror package**, checked here against workspace ranges;
- **a fix for an advisory in a transitive dependency.** No workspace declares
  these, so the line reads "checked against 0 declared range(s)". The check
  that matters for them is osv-scanner in `supply-chain.yml`: delete the
  override and the advisory comes back.

The header also states the non-goal from [§8](#8-non-goals): bumping `obsidian` or
`markdownlint-cli2` means re-checking whether the `moment`, `smol-toml` and
`katex` overrides still hold, or now hold a package back.

## 3. The machine contract

The `visimark` CLI, its exit codes, its streams and `--json` do not change.
Nothing under `packages/visimark/src/cli/` is touched. The new and changed CI
outcomes:

| Condition | Command | Exit | stdout | stderr |
|---|---|---|---|---|
| No flagged pattern in tracked source | `bun run lint:scanner` | 0 | nothing from ESLint | — |
| A flagged `innerHTML` or static style anywhere tracked | `bun run lint:scanner` | 1 | ESLint's stylish report: file, `line:col  error  <message>  <rule>`, then `✖ N problems (N errors, 0 warnings)` | — |
| Config cannot load (for example a missing plugin) | `bun run lint:scanner` | 2 | — | ESLint's "Oops! Something went wrong!" |
| Weekly scan, only accepted advisories present | `osv-scan` job | 0 | `Filtered 1 vulnerability from output` … `No issues found` | — |
| Weekly scan, an advisory not accepted | `osv-scan` job | 1 | osv-scanner's table | — |
| An `osv-scanner.toml` entry matches nothing | either supply-chain job | 1 | `::error file=osv-scanner.toml::GHSA-… is ignored in osv-scanner.toml but no longer matches anything in bun.lock. Remove the entry.` | — |
| An ignore past its `ignoreUntil` | `osv-scan` job | 1 | the advisory, unfiltered, in osv-scanner's table | — |
| A PR adds a new advisory below CVSS 7 (for example by deleting an override) | `osv-pr` job | 0 | the existing `::warning file=bun.lock::…` | — |
| A PR adds a new advisory of CVSS 7 or more | `osv-pr` job | 1 | the existing `::error file=bun.lock::…` | — |

## 4. Behaviour table and acceptance

| # | Case | Session | Result |
|---|---|---|---|
| 1 | Fixed tree | `bun run lint:scanner` | exit 0, no output from ESLint |
| 2 | Regression, enforced by a test | `editors/obsidian/test/scanner-config.test.ts` loads the scanner config through ESLint's Node API (`new ESLint({ overrideConfigFile })`, `lintText`, with the working directory set to the repo root) and lints three fixtures | `el.innerHTML = html;` gives exactly one message, ruleId `no-unsanitized/property`, severity 2. `el.style.left = "-9999px";` gives exactly one message, ruleId `obsidianmd/no-static-styles-assignment`, severity 2. `setTrustedHtml(el, html);` with an `el.replaceChildren(...)` body gives zero messages. |
| 3 | Caller list, enforced by a test | `site/test/html-callers.test.ts` lists every `site/src` file containing `setTrustedHtml(` | exactly `pages/articles-carousel.ts`, `pages/demo-panes.ts`, `pages/preview-cards.ts`, `pages/preview-page.ts`, `pages/repo-scan.ts`, `playground/badges.ts`, `playground/pipeline.ts`, `playground/reference.ts` (plus `html.ts`, which defines it). A new caller fails with: `setTrustedHtml has a caller not on the list: <file>. Add it here only after checking that everything it passes is trusted — see the boundary in site/src/html.ts.` |
| 4 | Helper behaviour, enforced by a test | `site/test/html.test.ts` under happy-dom | for a `marked`-style block (`<h2>…</h2><table>…</table>`), an inline SVG and a text-only string, `setTrustedHtml(el, s)` leaves `el.innerHTML` equal to what `el.innerHTML = s` would. It replaces existing children rather than appending. A `<script>` in the input is present as a node but not executed. |
| 5 | Site tests still pass | `bun run --filter visimark-site test` | green. The fake DOM gains a minimal `DOMParser` and `replaceChildren` so that `quest-render`, `persistence` and `builder` tests still drive `badges.ts` and `pipeline.ts`. The parsed result records the string, the way the `innerHTML` setter does today. |
| 6 | Bundles current | `playground-bundle` job | `docs/vendor/` is rebuilt with the pinned Bun and committed in the same commit as the site change. `bundle-size.test.ts` passes under its current ceiling (628,848 of 638,894 bytes before this change). |
| 7 | Advisories | `osv-scanner scan source --lockfile=bun.lock` on the result | `GHSA-vfj7-8cjw-p6xm … filtered out because: braces: …`, `Filtered 1 vulnerability from output`, `No issues found`, exit 0. Also `bun audit` lists only `braces`. |
| 8 | Stale ignore | temporarily add a bogus `[[IgnoredVulns]] id = "GHSA-xxxx-xxxx-xxxx"` and run the supply-chain step script | the `::error file=osv-scanner.toml::GHSA-xxxx-xxxx-xxxx is ignored …` line, exit 1. Proven once in the PR description, not committed. |
| 9 | Existing checks | `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run build`, `bun run test`, `bun scripts/check-overrides.ts`, `bun scripts/check-links.ts` | all exit 0 |
| 10 | Rendering | manual check on the PR: the playground's PREVIEW panel, the badge gallery, the reference table, the articles carousel and dots, the `infer` toggle, the repo-scan status bar and report, a preview page | the same output as before |

## 5. Compatibility

- **The composite Action, `dogfood.yml`, `docs/ci.md` recipes, published
  packages, the VS Code extension, the Obsidian plugin's `main.js`:** unchanged.
  No released artifact changes, so no release is needed (see [§6](#6-interaction-with-the-rest-of-the-tooling)).
- **Open PRs** that add an `innerHTML` assignment, or a static style
  assignment, anywhere in tracked source now fail `build`. That is the intent.
- **Dependabot** is unaffected. The three new overrides are transitive, so
  there is no manifest entry for it to bump and no `ignore` entry to add.
- **A Dependabot PR that fixes `braces`** fails the supply-chain jobs until the
  same PR deletes the `osv-scanner.toml` entry. That is the intended forcing
  function.
- **The live site** changes on merge, because `pages.yml` uploads `docs/`
  verbatim. A rendering regression is user-visible at once. Revert is clean.

## 6. Interaction with the rest of the tooling

- **Release:** no release is cut for this change alone. The next real patch
  produces a new Scorecard. If the portal submission turns out to be blocked
  while the Scorecard reads Failed, cut a patch then, by the normal process in
  [`releasing.md`](../releasing.md). Acceptance on merge is [§4](#4-behaviour-table-and-acceptance). The Scorecard
  is an observation at the next release: the two Errors gone, three of the
  four advisories gone.
- **The `editors/obsidian` lint step** (the full typed `recommended` ruleset
  on the plugin) is unchanged, and stays the step that keeps the plugin's own
  Warnings visible.
- **`oxlint`** (`bun run lint`) is unchanged. The 26 type-aware findings are
  filed as a separate tooling issue, to be handled with oxlint's type-aware
  rules. The implementation PR links it.
- **The review workflow and the issue templates:** unchanged.

## 7. Documentation to update

- **`docs/releasing.md`:**
  - line 180 ("Before tagging, `bun run --filter visimark-obsidian lint` must
    show no errors") gains `bun run lint:scanner`;
  - the "What the scanner looks at" bullets (lines 222-226): drop "three
    warnings are known" and "about twenty warnings". Say that warnings are
    accepted and printed by the two lint steps, with no count. Say that CI
    runs the scanner's Error rules over every tracked file
    (`lint:scanner`), and that dependency advisories are handled by
    `osv-scanner.toml` and `supply-chain.yml`.
- **`CONTRIBUTING.md`** (the command table near line 242): a row for
  `bun run lint:scanner`.
- **`.agents/rules/dependencies-and-pins.md`:**
  - the pins table gains "An accepted advisory (`osv-scanner.toml`, with
    `ignoreUntil`) → `supply-chain.yml`'s osv-scanner jobs";
  - the "A root `overrides` entry" row adds "an advisory override also
    `supply-chain.yml`".
- **`.github/workflows/ci.yml`:** the comment above the obsidian lint step
  (lines 81-83) is rewritten to describe both steps.
- **`.github/workflows/supply-chain.yml`:** comments for the unused-ignore
  rule.
- **`scripts/check-overrides.ts`:** the header ([§2.8](#28-check-overridests)).
- **`site/src/playground/pipeline.ts`, `site/src/pages/demo-panes.ts`:** the
  boundary comments shrink to pointers ([§2.1](#21-sitesrchtmlts--one-module-for-html-strings-into-the-dom)).
- **`CHANGELOG.md` `## Unreleased` → `### Added`:**
  - the scanner-rule CI step;
  - the accepted-advisory file and the stale-ignore failure;
  - the three overrides, with advisory ids.
- **`editors/obsidian/CHANGELOG.md` `## Unreleased`:** one line saying that
  the repository no longer trips the scanner's two Errors, the code was in
  `site/` and never in `main.js`, and three dependency advisories are cleared.
- **`docs/vocabulary-catalogue.md`:** the #402 row moves to the Shipped
  register as `UNRELEASED`.
- **Not affected:** `docs/ci.md`. It documents VisiMark in users' CI, not this
  repository's own lint.

## 8. Non-goals

- **Raising `minAppVersion` to 1.13** for `getSettingDefinitions()`. That
  warning stays. It is a change to the supported range, it isn't lint, and it
  can't be tested here.
- **A separate plugin repository.** It conflicts with the single release line
  (#396). It needs its own issue if wanted.
- **The 26 Errors from the full typed ruleset.** A separate issue, to be
  handled with oxlint.
- **The scanner's Warnings in general.** They stay accepted, apart from the 15
  `@microsoft/sdl/no-inner-html` warnings on the same lines, which go away
  with the fix.
- **Sanitising.** No sanitiser is added. [§2.1](#21-sitesrchtmlts--one-module-for-html-strings-into-the-dom) states when one becomes
  required.
- **Detecting a stale override.** An override that now holds a package below a
  dependent's newer pin is not detected. `check-overrides.ts` names the
  re-check as a manual step when `obsidian` or `markdownlint-cli2` is bumped.
- **Changing `supply-chain.yml`'s severity policy.** Only the unused-ignore
  rule is added.

## 9. Open questions

None.
