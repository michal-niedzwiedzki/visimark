# An MCP server exposing the engine to agents — Implementation Plan

**Spec:** [`mcp-server-spec.md`](mcp-server-spec.md) · approved on
[#169](https://github.com/michal-niedzwiedzki/visimark/issues/169) ·
[deciding comment](https://github.com/michal-niedzwiedzki/visimark/issues/169#issuecomment-5786228235)

**Goal:** Publish `packages/visimark-mcp`, a stdio MCP server that exposes all six
`visimark` commands as tools, the authoring discipline as resources, and the two
orderings an agent gets wrong unsupplied as prompts — reachable by an agent that has
never cloned this repository, installable under both Node and Bun, and read-only
unless an operator deliberately opens the write gate.

**Architecture:** A new published workspace package that **imports the engine as a
library** and never shells out. Its `src/` is five modules and an entry point: an
input layer that turns `{ path } | { content }` into a `CheckOptions.doc` or its
absence, a tool layer that calls `check` / `planFmt` / `infer` / `planInfer` /
`describeFunction` and serialises through the existing `--json` envelope, a resource
layer serving files shipped in the tarball, a prompt layer, and a write gate that
sits between the apply tools and `applyEdits` / `writeArtifact`. The engine's
`index.ts` gains three exports so the artifact gate is reachable without
reimplementation. The published `bin` is an `sh` launcher copied in shape from
`packages/visimark/bin/visimark`.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), `bun test`,
`@modelcontextprotocol/sdk` **pinned exact** (as `visimark` is), `visimark` pinned
exact. No other runtime dependency.

---

## Global Constraints

1. **Attribution.** Every commit ends with the `Co-Authored-By:` trailer for the
   session that wrote it, resolved from
   [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md). Do not
   paste a vendor name out of this plan, an earlier commit, or a command file.
2. **Runtime parity** ([`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md)).
   This package has a `bin`, so the rule applies in full. The `bin` entry points at an
   `sh` launcher; the payload beside it keeps `#!/usr/bin/env node` because it is only
   ever executed as an argument. Every install and run line appears in both forms.
3. **No reshaped contract.** Tool results are the envelope in
   [`structured-output-json-spec.md`](structured-output-json-spec.md). Do not invent a
   second serialisation, do not widen the envelope's existing keys, and reuse
   `isProblem()` rather than reimplementing the problem/advice split.
4. **Exit `1` is a successful tool call.** Only the `2` class is an MCP tool error.
   A test asserts this for every read tool; getting it backwards makes every failing
   document look like a broken server.
5. **The gate fails closed.** Writes require `--allow-write` *and* at least one
   host-declared root. Neither is reachable from a tool call.
6. **No counts in any tool or resource description.** `docs/function-reference.md` is
   generated and CI-checked; a hand-written description is not, and "fifteen builtins"
   was already wrong when #169 was filed.
7. **Test the branch, never the published build.** In-repo, run
   `bun run packages/visimark/src/cli/main.ts` and
   `bun run packages/visimark-mcp/src/main.ts`. `bunx visimark` silently runs the
   release.
8. After every task: `bun test`, `bun run typecheck`, `bun run build`, and
   `bun run lint` from the repo root, all green before the next task starts.

---

## Task 1 — Package skeleton, launcher, and the parity guard

- [x] Create the package so that it is installable and runnable under both runtimes
      before it does anything useful.

**Files**

- `packages/visimark-mcp/package.json` — new
- `packages/visimark-mcp/bin/visimark-mcp` — new, `sh`, mode `755`
- `packages/visimark-mcp/bin/visimark-mcp.js` — new, the payload
- `packages/visimark-mcp/tsconfig.json`, `tsconfig.build.json` — new, copied from
  `packages/remark-visimark`
- `packages/visimark-mcp/README.md`, `LICENSE` — new
- `packages/visimark-mcp/src/main.ts` — new, a stub that parses `--allow-write` and exits
- `packages/visimark-mcp/test/package.test.ts` — new

**Interfaces**

```jsonc
// package.json — the fields that matter
{
  "name": "visimark-mcp",
  "version": "<engine version>",          // lockstep; task 8 adds the CI assertion
  "files": ["dist", "bin", "skill.md", "docs", "README.md", "LICENSE"],
  "bin": { "visimark-mcp": "bin/visimark-mcp" },
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "dependencies": {
    "visimark": "<engine version>",       // exact, no caret
    "@modelcontextprotocol/sdk": "<x.y.z>" // exact, no caret
  }
}
```

**Steps**

1. Copy `packages/visimark/bin/visimark` to `bin/visimark-mcp`, changing only the
   comment and the exec target (`visimark-mcp.js`). Keep the symlink walk verbatim:
   `bun install -g` links the bin as a bare symlink, so `$0` is a chain.
2. `bin/visimark-mcp.js` keeps `#!/usr/bin/env node` and does nothing but
   `import("../dist/main.js")`. **Never point `bin` at this file.**
3. `chmod 755` both, and assert the mode in `package.test.ts` — an unexecutable bin is
   a broken global install that no unit test otherwise catches.
4. Port `test/package.test.ts` from `packages/markdownlint-visimark` verbatim: every
   `exports` target must resolve inside a `files` entry. This is the check that exists
   because of [#170](https://github.com/michal-niedzwiedzki/visimark/issues/170) — a
   `bun` condition pointing outside `files` fails the *whole* package resolution
   rather than degrading. Extend it to assert the `bin` target is inside `files` too.
5. Add a test asserting `bin/visimark-mcp` does **not** start with `#!/usr/bin/env node`
   and `bin/visimark-mcp.js` does. Both halves of the parity rule, pinned.
6. Verify by hand under both runtimes before moving on:
   `npm pack`, then `npm i -g ./visimark-mcp-*.tgz` and `bun add -g "$(pwd)/…tgz"`.

---

## Task 2 — The input layer: `path` or `content`

- [x] Turn a tool's arguments into an engine call, and make every refusal a `USAGE`
      error rather than a silent preference.

**Files**

- `packages/visimark-mcp/src/input.ts` — new
- `packages/visimark-mcp/test/input.test.ts` — new

**Interfaces**

```ts
export type DocInput = { path: string } | { content: string };

/** Refuses both-given and neither-given. Reads the file for `path`. */
export function resolveInput(args: unknown): Resolved | UsageError;

export interface Resolved {
  readonly source: string;
  /** `onDisk(path)` for a path; `undefined` for content — the phases stand down. */
  readonly doc: DocumentFile | undefined;
  readonly file: string | undefined;
}
```

**Steps**

1. `path` only → `onDisk(path)`. `content` only → `doc: undefined`, which is how
   `fs/reader.ts` states "this document is not on a filesystem".
2. Both → `USAGE`. Neither → `USAGE`. Message wording matches the CLI's
   `visimark: …` idiom so the same situation reads the same way on both surfaces.
3. An unreadable `path` → `READ`, not `USAGE`.
4. The same shape for `scenarioPath` / `scenarioContent`.
5. Tests: all four arms for both the document and the scenario, plus an unreadable path.

---

## Task 3 — The envelope and the `skipped` surface

- [x] Serialise every result as the existing `--json` envelope, and make `content`
      mode's stood-down phases visible instead of silent.

**Files**

- `packages/visimark-mcp/src/envelope.ts` — new
- `packages/visimark-mcp/test/envelope.test.ts` — new

**Interfaces**

```ts
/** `status` tracks the exit code the CLI would have produced. */
export function envelope(command: string, body: object, findings: Finding[]): object;

/** Imports and charts the run could not verify because there was no reader. */
export function skipped(result: CheckResult): { imports: string[]; charts: string[] };
```

**Steps**

1. Reuse the engine's own report layer wherever it already produces envelope pieces
   (`report/json.ts`), rather than re-deriving the public finding shape. The public
   finding is **not** the internal `Finding` — no spans, no parser nodes.
2. `status` from `isProblem()` over the findings, imported from the engine. `WARN` and
   `NOTE` never turn `ok` into `problems`.
3. Document values stay decimal **strings**. A JSON number here is the `§7` violation
   the envelope spec exists to prevent; add a test that asserts a known value is a
   string.
4. `skipped` reads the `ImportStatus` `"skipped"` state
   (`import/resolve.ts:45`) and the `ChartResult` `"skipped"` state
   (`check-charts.ts:178`). Present as `{}` when nothing was skipped, per the
   envelope's empty-objects-are-present rule.
5. Test: the same document via `path` and via `content` produces the same findings
   *except* that the import finding is absent under `content` and the sheet is named
   in `skipped.imports`.

---

## Task 4 — The read tools

- [x] Six tools, `visimark_ref` first.

**Files**

- `packages/visimark-mcp/src/tools/read.ts` — new
- `packages/visimark-mcp/test/tools-read.test.ts` — new

**Interfaces**

```ts
export const READ_TOOLS: ToolDef[];   // check, eval, explain, infer, fmt, ref
```

**Steps**

1. **`visimark_ref` first** — it reads no file at all, which makes it trivially safe
   and a clean shakedown of the whole result path. `name` optional, mirroring the CLI;
   an unknown name is `USAGE` **with the did-you-mean suggestion** the CLI produces
   (`report/levenshtein.ts`).
2. `visimark_check` → `check`. `visimark_explain`, `visimark_eval` (`get`, scenario
   from task 2), `visimark_infer` → `infer` (proposals only; **no** `written` key —
   it never writes).
3. `visimark_fmt` → `planFmt`. Returns `edits`, `artifactsWouldWrite`, `sha256`
   (task 6), `skipped`, `applied: false`. **Nothing is written.** A test asserts the
   file's mtime and bytes are unchanged after the call.
4. Annotations: `readOnlyHint: true`, `destructiveHint: false` on all six, `fmt` and
   `infer` included, because planning is not writing.
5. Descriptions state the bounded blast radius — `fmt` repairs stale computed values,
   anchors and generated artifacts and nothing else — and, on `check` and `fmt`, that
   `content` mode cannot verify imports or artifacts.
6. Tests, per tool: the clean case is `status: "ok"`; the findings case is a
   **successful call** with `status: "problems"`; the `2` class is a tool error.
   `visimark_check` on `docs/example-invoice-drift.md` asserts 26 findings.

---

## Task 5 — Resources, the generated skill, and prompts

- [x] Ship the discipline, not only the verifier.

**Files**

- `packages/visimark-mcp/src/resources.ts`, `src/prompts.ts` — new
- `scripts/gen-mcp-skill.ts` — new
- `packages/visimark-mcp/skill.md` — new, **generated and committed**
- `packages/visimark-mcp/docs/` — the doc copies the package ships
- `packages/visimark-mcp/test/resources.test.ts` — new

**Steps**

1. Five resources at the URIs in spec §2.6, served from files **inside the tarball**.
   Never fetch at runtime: a network read would give the server an ambient dependency
   the CLI does not have, and make a resource's content depend on something other than
   the installed version.
2. Whatever mechanism puts `docs/cli-reference.md`, `docs/function-reference.md`,
   `docs/example-invoice.md` and `docs/example-invoice-drift.md` into the package, it
   runs in `build` and the files are listed in `files`. A missing resource file must
   fail the build, not surface as an empty resource at runtime — add a test that every
   declared URI resolves to non-empty content.
3. `scripts/gen-mcp-skill.ts` derives `skill.md` from `skills/visimark/SKILL.md`,
   rewriting "Running it" for a reader who has the server and not the repository.
   Modelled on `scripts/gen-function-reference.ts`.
4. Two prompts only: `visimark/take-over` (`infer` first) and `visimark/author`
   (table → `vmark` block → anchors → prose → `fmt`). **No third prompt** for the
   change-an-input probe — it is a step inside both, and splitting it out invites an
   agent to treat it as optional.

---

## Task 6 — The write gate, the engine exports, and the apply tools

- [x] The only security boundary in the package. Build it last and deliberately.

**Files**

- `packages/visimark/src/index.ts` — **widened** (the one engine change)
- `packages/visimark-mcp/src/gate.ts`, `src/tools/write.ts` — new
- `packages/visimark-mcp/test/gate.test.ts`, `test/tools-write.test.ts` — new

**Interfaces**

```ts
// packages/visimark/src/index.ts — additive only
export { writeArtifact } from "./artifact/write.js";
export type { ArtifactWrite } from "./write/fmt.js";
export { resolveArtifactPath, type PathResult } from "./artifact/path.js";
```

**Steps**

1. Widen `index.ts` with the three exports, in this task, so the diff shows the reason
   for each beside the code that consumes it. Additive only — nothing is removed or
   re-typed, so no existing library consumer changes. Document the gate as **supported
   API** in the export comment: `resolveArtifactPath` gates containment and extension;
   the marker-and-provenance refusal lives in `writeArtifact`, in the caller position.
   Neither substitutes for the other.
2. `gate.ts` — writes permitted only when `--allow-write` **and** at least one declared
   root. No roots means no writes. Tests for all four combinations.
3. Apply tools are **listed in `tools/list` even when writes are disabled** and return
   a tool error on call: `writes are disabled. Start the server with --allow-write.`
   `destructiveHint: true` in **both** states — the annotation describes the tool, not
   the session. Hosts gate on these.
4. `sha256` staleness guard: the plan carries the digest of the source it was computed
   against; the apply tool rehashes and refuses on mismatch. Use `ReaderPort.readSealed`
   — a single indivisible open-read-close-hash, built for this class of problem;
   `fs/reader.ts` explains why it must stay one call. **Do not re-plan silently**: the
   agent's reviewed plan is what lands, or nothing does.
5. `visimark_fmt_apply` splices via `applyEdits` and writes artifacts via
   `writeArtifact`. On a refused artifact the **document is left unspliced** — a
   partly-applied `fmt` is worse than none. Test this explicitly.
6. Path outside every declared root → `WRITE`. Artifact target not VisiMark's →
   `WRITE`, with `writeArtifact`'s own wording.
7. `visimark_infer_apply` via `planInfer` + `applyEdits`.

---

## Task 7 — Transport, entry point, and the handshake tests

- [x] Make it a server.

**Files**

- `packages/visimark-mcp/src/server.ts`, `src/main.ts` — completed
- `packages/visimark-mcp/test/handshake.test.ts` — new
- `packages/visimark-mcp/test/spawn.test.ts` — new

**Steps**

1. `main.ts` parses `--allow-write` and refuses an unrecognised option with exit `2`
   **before the transport starts**, as the CLI does (#121).
2. Stdio transport from the SDK. The server process exits `0` on clean shutdown and
   `2` on a usage error in its own arguments — **never** because a document had
   findings.
3. `serverInfo.version` is the **server** version. The envelope's `visimark` field
   stays the **engine** version. The envelope is not widened to carry both.
4. In-process handshake tests for every tool's behaviour and error class, driven
   through an in-memory transport — fast and hermetic.
5. One **spawned** test: run the built binary, complete `initialize`, assert
   `tools/list` returns the eight names with their annotations. This is the only test
   that exercises the launcher and the real framing.
6. Nothing on stdout but protocol traffic. A stray `console.log` corrupts the stream;
   add a test that asserts it.

---

## Task 8 — CI

- [x] Prove the packed artifact works with only Node, and with only Bun.

**Files**

- `.github/workflows/ci.yml`

**Steps**

1. `pack` packs a second tarball from `packages/visimark-mcp` and uploads it beside the
   engine's.
2. `smoke-node` and `smoke-bun` each additionally install the MCP tarball globally and
   drive an `initialize` + `tools/list` **handshake**. Not `--version`: that would pass
   on a server that cannot speak the protocol. Both jobs already assert the *other*
   runtime is absent from `PATH`, which is the assertion that catches the shebang bug —
   leave those assertions exactly as they are.
3. Version-agreement check: **nine fields → eleven**, five manifests → six.
   `visimark-mcp`'s own `version` and its `dependencies.visimark` pin join, for the
   same two reasons `remark-visimark` and `markdownlint-visimark` each join twice.
   Update the explanatory comment block above the check — it explains *why* each field
   is there, and a field added without its reason is one a later reader deletes.
4. A freshness job for `packages/visimark-mcp/skill.md`, modelled on
   `function-reference`: regenerate, `git diff --exit-code`, fail on drift.

---

## Task 9 — Release legs and the registry entry

- [x] Publish it, in the shape the existing legs already use.

**Files**

- `.github/workflows/release.yml`
- `server.json` — new, reverse-DNS namespace

**Steps**

1. An npm leg for `visimark-mcp`, copied in shape from the `markdownlint-visimark` leg:
   ask `npm view visimark-mcp@$ENGINE_VERSION`, publish or skip on the answer,
   `continue-on-error`, `--provenance --access public`.
2. An MCP-registry leg using `mcp-publisher` and `server.json`, guarded by
   `GET /v0/servers?search=visimark` for this exact version.
3. Both join the final **every leg must have landed** gate, which now re-asks **four**
   registries. That shape exists because v0.1.3 lost Open VSX, the GitHub Release and
   the issue bookkeeping to an unrelated Marketplace credential failure — a bolted-on
   step would reintroduce exactly that.
4. Namespace `io.github.michal-niedzwiedzki/visimark`, ownership proven by GitHub
   login. It is independent of the `visimark_` tool-name prefix, so a later move to a
   domain-verified namespace changes the registry entry and not one tool name.

---

## Task 10 — Documentation

- [x] The final task. Every file that states the current behaviour, from spec §7.

**Files**

- `docs/mcp.md` — **new**
- `README.md`
- `docs/releasing.md`
- `docs/ci.md`
- `CONTRIBUTING.md`
- `skills/visimark/SKILL.md`
- `.github/workflows/ci.yml` (the version-check comment block)
- `CHANGELOG.md`
- `docs/vocabulary-catalogue.md`

**Steps**

1. **`docs/mcp.md`**, new — the full surface, modelled on `docs/cli-reference.md`'s
   table discipline: one row per tool, what it reads, what it writes, which annotation
   it carries. Both `npx` and `bunx` forms, both `npm i -g` and `bun add -g`.
2. `README.md` — an MCP section in the distribution list beside the GitHub Action, the
   remark plugin, the markdownlint rule and the extension. **Do not touch the stale
   "not published to a marketplace yet" sentence at `:426`** — the deciding comment
   carved it out to its own docs PR.
3. `docs/releasing.md` — the new npm and MCP-registry rows in "What one tag publishes";
   **also add the existing `remark-lint-visimark` and `markdownlint-rule-visimark` legs,
   which that table already omits**; "all three registries" → four; "All three
   `package.json` versions" → six.
4. `docs/ci.md` — a chapter for the MCP server; no existing one covers it.
5. `CONTRIBUTING.md` — building and running the server locally under both runtimes, and
   the published-build trap: `bun run packages/visimark-mcp/src/main.ts`, plus the
   `claude mcp add` line that points a client at the working tree.
6. `skills/visimark/SKILL.md` — "Running it" mentions the MCP server as an alternative
   to shelling out, and the framing gets a pass for a reader who has **not** cloned the
   repo, since a generated variant of this file is served as a resource.
7. `CHANGELOG.md` — an entry under `## Unreleased` → `### Added`. **A merged
   implementation PR with no `## Unreleased` line is a bug in this plan.**
8. `docs/vocabulary-catalogue.md` — move the section F row into the **Shipped register**
   as `UNRELEASED`, condensed to that table's columns: `Name`, `Kind` = `tooling`,
   `Request` = [#169], `Landed` = this PR, `Released` = `—`, `Decision` = the deciding
   comment. Drop the prose columns. The row stays `UNRELEASED` until a tagged release
   ships it; `releasing.md` fills `Released` and `release.yml` closes #169. **Neither
   this plan nor the implementation promotes it to `SHIPPED` or closes the issue.**

`docs/cli-reference.md`, `docs/issue-runbook.md`, `.github/ISSUE_TEMPLATE/` and
`editors/vscode/CHANGELOG.md` need **no** change: no CLI surface, workflow, form
question or editor behaviour moves.
