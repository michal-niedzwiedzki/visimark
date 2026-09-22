# A remark plugin wrapping visimark check — feature spec

**Status:** approved (#152) · **Date:** 2026-09-22 · **Decision:** [#152 (comment)](https://github.com/michal-niedzwiedzki/visimark/issues/152#issuecomment-5781287493)

## 1. Purpose

A project that already runs `remark`/`remark-lint` (Docusaurus, Astro, or any
other `unified`-based Markdown toolchain) has no way to see VisiMark findings
in that same pipeline. `visimark`'s own findings are invisible to a `remark
--frail` run — a second, separate invocation is the only way to see them:

```console
$ cat .remarkrc.json
{ "plugins": ["remark-preset-lint-recommended"] }
$ npx remark docs/ --frail
docs/quote.md
  12:1  warning  Unexpected literal heading level, expected level "1"  no-heading-like-paragraph  remark-lint

no issues found
$ npx visimark check docs/quote.md
docs/quote.md:12  ASSERT  Total should equal 1068.00, found 948.00
1 problem (0 stale, 1 error)
$ echo $?
1
```

This spec adds a new package, `remark-lint-visimark`, exposing a `unified`
plugin so one line in an existing `remark` config reports VisiMark findings
inline with a project's other lint rules:

```console
$ cat .remarkrc.json
{ "plugins": ["remark-preset-lint-recommended", "remark-lint-visimark"] }
$ npx remark docs/ --frail
docs/quote.md
  12:1  error  0.4266 <= 2.00 is false  visimark-assert  visimark

1 error
$ echo $?
1
```

This reaches an audience that will never invoke the `visimark` CLI directly
or read the landing page — the cheapest kind of distribution this project has
(roadmap item 2.2). It is a new distribution surface only: no document's
meaning changes, [§2](../visimark-design.md#2-constraints-that-shaped-the-design)
constraint 4 is untouched (`analyze()` stays a pure function of the source
string; the plugin adds no environment, clock, or ambient-config dependency),
and existing `visimark` exports are reused, not reinvented, wherever they
already cover the need.

This is not a reopening of the "no plugin architecture" refusal
([§2](../visimark-design.md#2-constraints-that-shaped-the-design),
`docs/tutorial.md`): that constraint is about a *document* selecting
host-supplied code — an extension point inside a VisiMark document. This is
the opposite direction, VisiMark running as a rule inside someone else's
linter, and does not touch it.

## 2. The surface

### 2.1 The package

- **Directory:** `packages/remark-visimark` (new workspace member; the root
  `workspaces: ["packages/*", "editors/*"]` glob picks it up with no change).
- **npm name:** `remark-lint-visimark` — follows `remark-lint`'s own naming
  convention for lint rules, which is what a consumer searching the `unified`
  ecosystem's plugin list expects, and is what `remark-preset-lint-*` presets
  document as the pattern for a third-party rule.
- **Default export:** the plugin's attacher function, `remarkLintVisimark`,
  matching every other `unified`/`remark-lint` plugin's shape:

  ```ts
  export default function remarkLintVisimark(): (tree: Root, file: VFile) => void {
    return (_tree, file) => {
      const source = String(file.value);
      const { result } = analyze(source);
      for (const finding of result.findings) {
        if (!finding.span) continue; // no single site to attach a Position to
        const line = lineOf(source, finding.span.start);
        const message = file.message(describeFinding(finding), { line }, originFor(finding));
        message.fatal = isProblem(finding) ? true : undefined;
      }
    };
  }
  ```

  `originFor(finding)` returns `` `visimark:${ruleId(finding)}` `` — the
  `"source:ruleId"` string form `VFile#message` parses into
  `message.source`/`message.ruleId` (§3).

- **v1 takes no options.** `remarkLintVisimark()` is called with no
  arguments and accepts none; there is no rule-options parameter to suppress
  non-fatal findings or otherwise configure behaviour (§8).
- **Dependency on the engine.** `visimark` is already published to npm (the
  existing `Publish the engine to npm` leg in `release.yml`). Unlike
  `packages/visimark-lsp` and `editors/vscode` — both `"private": true` /
  bundled into a `.vsix`, so their `"visimark": "workspace:*"` dependency
  never needs registry resolution — this package **is** published externally,
  and `workspace:*` is not a valid specifier outside the monorepo. So
  `packages/remark-visimark/package.json` declares a real dependency, exact-
  pinned to match the engine release it was built against:
  `"dependencies": { "visimark": "0.1.7" }`, bumped in the same release
  commit as every other version-carrying file (§5).
- **New, small engine export.** `analyze`, `lineOf`, `isProblem` and
  `ERROR_CODES` are already public and reused as-is. One new export is added:
  `describeFinding(f: Finding): string` in
  `packages/visimark/src/report/format.ts`, re-exported from
  `packages/visimark/src/index.ts` alongside `formatCheck`. It renders a
  single-line, plain-English sentence for one finding — the same information
  `formatCheck`'s per-code branches already carry, flattened to one line with
  no column padding, rather than a second, hand-authored copy of that text
  that could drift from the CLI's own wording. `formatCheck` itself is
  unchanged; nothing about the terminal report's layout moves.  Per-code
  rendering (mirrors the existing branches in `report/format.ts`,
  `renderGroup`/`staleLine`):

  | Code | Reason text |
  |---|---|
  | `STALE` (normal cell) | `` `${sheetId}.${name}: stored ${stored} ≠ computed ${computed}` `` (append `` ` (${formula})` `` when `formula` is set) |
  | `STALE` (artifact) | `f.message` verbatim (already a full sentence) |
  | `STALE` (anchor group) | not emitted — no single `span` (see 2.1's `finding.span` guard) |
  | `ASSERT` | `` `${source}: ${message} is false` `` |
  | `DATE` | `` `"${raw}" is not an ISO 8601 date (YYYY-MM-DD)` ``, append `` `; unambiguous fix is ${isoFix}` `` if set, else `` `; ambiguous: ${altA} or ${altB}, ${daysApart} days apart` `` if set |
  | `UNDEF` | `` `unknown name \`${raw}\`` ``, append `` `; did you mean \`${suggestion}\`?` `` if set |
  | `DUP` | `` `\`${name}\` is already defined in this scope` `` |
  | `VECTOR` | `` `\`${raw}\` is a column, not a value — wrap it in an aggregate` `` |
  | `CYCLE` | `cyclePath.join(" → ")` |
  | `WARN` | `` `${sheetId}.${name} is defined and never read` ``, append did-you-mean if `suggestion` is set |
  | `UNIT`, `SHEET`, `IMPORT`, `COVERAGE`, `ARTIFACT`, `TYPE`, `ANCHOR`, `NOTE`, `PRECISION` | `f.message` verbatim (`format.ts`'s own branches already treat these as complete sentences); `PRECISION`'s existing fallback text when `f.message` is absent |

### 2.2 Consumer-side usage

```json
{ "plugins": ["remark-preset-lint-recommended", "remark-lint-visimark"] }
```

or programmatically:

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkLintVisimark from "remark-lint-visimark";

const file = await unified().use(remarkParse).use(remarkLintVisimark).process(vfile);
```

The plugin ignores the `tree` argument the host pipeline hands it and
re-parses `file.value` through the already-public `analyze(source)` — the
same code path `check`'s CLI command uses (option (a) from the issue,
recommended by both the issue and the pre-review). **Option (b) — an engine
entry point that accepts an already-parsed mdast tree instead of a source
string — is closed for this version, not merely deferred**, for the reason
the issue gave: it is new engine surface, and only correct when the host's
tree was built with the same extensions `locate()` assumes (`remark-gfm` for
tables); a host pipeline without `remark-gfm` would hand the engine a tree
missing the shape its position-mapping code expects, silently under-finding.
Reopen only if a measured double-parse cost on a real, large document shows
it matters — this repository's own playground numbers
(`docs/design/playground-pipeline-cost-plan.md`) show single-digit-millisecond
parses even at 2,000 rows, so v1 does not chase that speculatively.

## 3. The machine contract

Not a CLI change — `visimark`'s own exit codes and `--json` shape are
untouched; this is a new package exposing a `unified` plugin function, no new
flag on the existing binary.

| Outcome | `file.message()` called? | `.fatal` | `.source` | `.ruleId` | `.place` |
|---|---|---|---|---|---|
| A finding with `code` in `ERROR_CODES`, or `STALE` (`isProblem(f)` true) | yes | `true` | `"visimark"` | `` `visimark-${code.toLowerCase()}` `` (e.g. `visimark-assert`) | `{ line }` from `lineOf(source, finding.span.start)` |
| A `WARN` or `NOTE` finding | yes | `undefined` (vfile's own "warning" default) | `"visimark"` | `` `visimark-${code.toLowerCase()}` `` | `{ line }` |
| A finding with no `span` (the collapsed anchor-group `STALE` line) | no | — | — | — | — |
| Document has zero findings | no calls | — | — | — | — |

Column is not reported in v1 — `Position` carries `{ line }` only, matching
most `remark-lint` rules' own granularity and needing no new engine surface;
`lineOf()` already gives exactly this. A `Finding.span`-derived column is a
later addition if a consumer asks for one, not built speculatively.

The `ruleId` is per-`FindingCode` (`visimark-stale`, `visimark-assert`,
`visimark-date`, …) rather than one fixed `"visimark"` id — it is public API
the moment a consumer's `remark-lint` config references it by name, and a
per-code id lets a consumer selectively act on one finding kind the way any
other `remark-lint` rule's id does.

This is `check`'s existing finding set, unchanged — the plugin translates
`Finding[]` to `VFileMessage[]`, it does not compute anything new:

```console
$ bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
docs/example-invoice.md

  0 problems (0 stale, 0 errors)
$ echo $?
0

$ bun run packages/visimark/src/cli/main.ts check docs/example-invoice-drift.md
docs/example-invoice-drift.md
  STALE   lines.Net       · On-call support         3120.00 ≠ 5200.00    Qty * Rate
  ...
  26 problems (21 stale, 5 errors)
$ echo $?
1
```

`docs/example-invoice-drift.md`'s first `STALE` finding (`lines.Net`, "On-call
support" row) sits at source line 22 — confirmed with `analyze()` +
`lineOf()` against the working tree, not assumed.

## 4. Behaviour table

| Case | Fixture / invocation | `file.messages` after `.process()` |
|---|---|---|
| Clean document, no findings | `docs/example-invoice.md` | `[]` |
| One `STALE` cell, plain (no artifact, no anchor group) | `docs/example-invoice-drift.md`, `lines.Net` | `{ reason: "lines.Net: stored 3120.00 ≠ computed 5200.00 (Qty * Rate)", fatal: true, source: "visimark", ruleId: "visimark-stale", place: { line: 22 } }` |
| A failing `assert` | a copy of `docs/example-agent-budget.md` with `rates.budget`'s `default` lowered below `spent` | `{ reason: "assert spent <= rates.budget: 0.4266 <= 0.01 is false", fatal: true, source: "visimark", ruleId: "visimark-assert", place: { line: 65 } }` — confirmed against the working tree with the budget default edited to `0.01` |
| Collapsed anchor-group `STALE` (the "N prose anchors bound to the values above" line, no `span`) | any document whose stale cell has ≥2 prose anchors | no `file.message()` call for that finding — nothing to attach a `Position` to; the underlying cell's own `STALE` finding (which does have a `span`) still reports |
| `WARN` (unread binding) | a document with a defined-and-never-read name | `{ ..., fatal: undefined, ruleId: "visimark-warn" }` — visible under `remark --frail`, does not fail a plain `remark` run |
| Document `unified().use(remarkParse).use(remarkLintVisimark)` with no `remark-gfm` | any document with a table | unaffected — the plugin ignores the host's `tree` and re-parses `file.value` with its own `locate()`, which already applies `remark-gfm` internally (§2.2) |
| Plugin invoked with an option, e.g. `.use(remarkLintVisimark, { suppressWarnings: true })` | any document | the option is ignored — v1 accepts none (§2.1, §8) |

The `assert` row is the acceptance test for the ASSERT reason-text shape,
confirmed by running `analyze()` against a scratch copy of
`docs/example-agent-budget.md` with `rates.budget`'s default lowered to
`0.01` during implementation, not assumed from the issue's illustrative
(non-literal) example text.

## 5. Compatibility

- **No existing CI job, script, or the composite Action changes behaviour.**
  `action.yml`, `.github/workflows/ci.yml` (beyond the version-carrying-file
  addition below), `.github/workflows/dogfood.yml`, and
  `.github/workflows/release.yml` (beyond the new publish leg below) are
  otherwise unmodified. This is additive and opt-in: a project not already
  depending on `remark-lint-visimark` sees no change at all.
- **`ci.yml`'s "every version-carrying file must agree" step** currently
  tracks five files (`packages/visimark/package.json`,
  `packages/visimark-lsp/package.json`, `editors/vscode/package.json`,
  `action.yml`'s pinned default, `scripts/precommit-visimark-check.sh`'s
  `visimark@` pins, per #149). `packages/remark-visimark/package.json`'s own
  `"version"` field and its `"visimark"` dependency pin join as a **sixth**
  and **seventh** value that must equal the engine's version — for the same
  reason the others joined: a consumer who installed `remark-lint-visimark@x`
  and got a `visimark` dependency resolved to a different version than `x`
  would silently run a mismatched engine. This is the first of the two new
  packages under roadmap item 2.2 to reach a decision; #153 (the markdownlint
  counterpart) should follow the same join-the-check answer rather than
  re-litigate it, once it is decided.
- **`release.yml` gains a new publish leg**, `Publish the remark plugin to
  npm`, mirroring the existing `Publish the engine to npm` step exactly —
  same working directory pattern (`working-directory:
  packages/remark-visimark`), same "ask the registry whether this exact
  version is already there, publish or skip" idempotency, same
  `--provenance --access public`, gated the same independent,
  `continue-on-error: true` way every other leg already is (so a
  `remark-lint-visimark` publish failure does not strand the engine's own
  npm leg, the Marketplace leg, or the GitHub Release). No new secret is
  needed — it reuses the existing `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
  the engine's own leg already has.
- **`docs/releasing.md`'s "Bump the version" step** gains
  `packages/remark-visimark/package.json` (both its own `version` and its
  `visimark` dependency pin) as the sixth/seventh entry in its file list.
- Fully reversible: deleting the package and its `release.yml` leg (or a bad
  version bump) is undone by a normal commit. An already-published npm
  version is not unpublished (npm's own policy, unrelated to this project),
  the same as the engine's own npm leg today.

## 6. Interaction with the rest of the tooling

- **`--json`, `fmt`, `infer`, `explain`, `eval`, `ref`** are all untouched;
  the plugin only ever calls `analyze()` (which itself only calls `locate` +
  `build` + `check`, the same three phases `check`'s CLI command runs).
- **The pre-commit hook (#149) and the composite Action** are unaffected and
  share no code path with this plugin beyond the same public `analyze()`/
  `check()` engine both already depend on; neither is a `unified` pipeline.
- **The review workflow itself** — `docs/issue-runbook.md`,
  `.agents/commands/issue-review.md` — is unaffected; this is not a change to
  how issues are decided.
- **The new `describeFinding` export** (§2.1) is available to any future
  caller — the CLI's own `formatCheck` is not required to adopt it for this
  version, and does not.

Nothing about what a VisiMark *document* means changes. No new finding code,
no new syntax, no widened taxonomy entry.

## 7. Documentation to update

- **`docs/ci.md`** — a new chapter, after chapter 23 ("Git hooks and
  pre-commit"), documenting the `remark`/`unified` integration: the
  `.remarkrc.json` config line, the programmatic `unified().use(...)` form,
  and a pointer to `remark`'s own `--frail` flag for turning `WARN`/`NOTE`
  into a failing run.
- **`docs/cli-reference.md`** — unaffected; this package exposes no CLI
  surface of its own (no `bin` entry).
- **`docs/releasing.md`** — "Bump the version" step's file list gains
  `packages/remark-visimark/package.json` (§5).
- **`.github/workflows/ci.yml`** — the "every version-carrying file must
  agree" step's comment and extraction logic gain the sixth/seventh file
  (§5).
- **`.github/workflows/release.yml`** — the new publish leg (§5).
- **`CHANGELOG.md`** — an `## Unreleased` → `### Added` entry.
- **`README.md`** — no existing distribution-surface list names the
  composite Action, the pre-commit hook, or the VS Code extension together
  (checked against the working tree; #149's own spec did not add one
  either), so none is invented here. The "In CI" section gains one sentence
  pointing at the new `docs/ci.md` chapter, the same weight the composite
  Action gets there today.

## 8. Non-goals

- **No autofix.** `fmt`'s write-back is deliberately explicit
  ([§9](../visimark-design.md#9-write-back)), and `remark`'s own
  `--output`/fix pipelines apply plugin-proposed fixes automatically as part
  of a build. This is closed for this version, not merely considered and set
  aside — wiring `fmt` into that path is a real design question on its own,
  worth its own decision once report-only ships and the pattern of who
  actually runs `remark --output` against a visimark-checked document is
  clearer.
- **No rule-options / configurability.** v1's `remarkLintVisimark()` takes no
  arguments and exposes no way to suppress `WARN`/`NOTE` findings,
  reclassify a code's severity, or otherwise configure behaviour beyond what
  `isProblem()` already decides. A future version may add a rule-options
  parameter; this one does not.
- **No column position.** `Position` carries `{ line }` only (§3).
- **No engine entry point accepting a pre-parsed mdast tree** (option (b),
  §2.2) — closed for this version.
- **No markdownlint counterpart.** Filed separately as #153 — different
  parser, different rule API, no shared AST, judged on its own.
- **No change to `visimark`'s own CLI, exit codes, or `--json` shape.**

## 9. Open questions

None.
