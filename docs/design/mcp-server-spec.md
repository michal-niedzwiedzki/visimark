# An MCP server exposing the engine to agents — feature spec

**Status:** approved (#169), reconciled against the implementation on 2026-09-23 ·
**Date:** 2026-09-23 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/169#issuecomment-5786228235

Sections [3.4](#34-plans-and-the-staleness-guard),
[3.5](#35-the-engines-public-surface), [4](#4-behaviour-table),
[5.1](#51-what-does-not-change), [5.2](#52-version-lockstep) and
[5.4](#54-the-parity-fixture) were corrected where the implementation found
this spec wrong — most of all §3.5, which assumed the engine's front-end layer
was already reachable from `index.ts` and it was not. The decisions are
unchanged; what changed is what the document claims is true.

## 1. Purpose

VisiMark's engine is reachable three ways today: a CLI, a library import, and an
editor over LSP. All three assume the caller already knows the project exists.
An agent does not browse a marketplace; it loads an MCP server or a skill from a
registry. `skills/visimark/SKILL.md` ships inside this repository and is
reachable by anyone who has already cloned it — which is the set this project is
trying to grow, not the set it needs to reach.

This spec adds `packages/visimark-mcp`: a published stdio MCP server exposing
all six commands as tools, the authoring discipline as resources, and the two
orderings an agent gets wrong unsupplied as prompts. It reaches an agent working
on someone else's document, in someone else's repository, that has never heard
of VisiMark.

The motivating session, from the issue — an agent with the CLI installed can
only reach it by shelling out, and only for a document that already exists on
disk under a path it can name:

```console
$ visimark check quote.md
quote.md

  COVERAGE a table with no `vmark` rules — nothing in this document is checked
           run `visimark infer` to derive them, or mark it `<!--vmark:no-formulas-->`

  1 problem (0 stale, 1 error)
$ echo $?
1
```

A document the agent is drafting in context has no path, so there is nothing to
pass; the only route is a temp file. And nothing is listed anywhere an agent
discovers tools:

```console
$ curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=visimark'
{"servers":[],"metadata":{"count":0}}
```

**Why existing surfaces do not reach it.** The CLI requires a path and a shell.
The library requires a clone and a build step. The LSP speaks a different
protocol, to an editor, about a live buffer — there is no code to share beyond
the engine both already import.

This is a tooling / process change, catalogued in
[`docs/vocabulary-catalogue.md`](../vocabulary-catalogue.md) **section F**. It
changes no document syntax, evaluation, finding set, or write-back, and no
`visimark` CLI option, exit code or `--json` shape.

### 1.1 What this spec does not cover

The deciding comment carved two things out of #169.

- **Third-party listing and claiming** — Glama, PulseMCP, Smithery, mcp.so, and
  the `awesome-mcp-servers` list. Outreach with a maintenance owner and no
  design constraint to judge it by, which is what left
  [#45](https://github.com/michal-niedzwiedzki/visimark/issues/45) deferred
  whole. Only the official `registry.modelcontextprotocol.io` entry is in scope
  here, because it is a `release.yml` leg with a machine contract.
- **The README's stale marketplace sentence** (`README.md:426`, contradicted by
  `README.md:441`). A factual correction with no decision in it; it goes out on
  its own docs PR rather than waiting on this work.

## 2. The surface

### 2.1 The command

```
visimark-mcp [--allow-write]
```

One binary, stdio transport, no other options. `--allow-write` is the operator
gate in §2.4. An unrecognised option is refused with exit `2`, as the CLI does
([#121](https://github.com/michal-niedzwiedzki/visimark/issues/121)).

Installed and run both ways, per
[`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md):

```console
$ npm i -g visimark-mcp   # or: bun add -g visimark-mcp
$ npx visimark-mcp        # or: bunx visimark-mcp
$ claude mcp add visimark -- npx -y visimark-mcp
```

### 2.2 Tools

Eight tools. Names are `visimark_<command>`, underscore-separated and prefixed —
independent of the registry's reverse-DNS namespace, and safe in clients that
flatten tool names across servers. **Tool names are a frozen public surface:
there is no deprecation channel comparable to a CLI flag's, so renaming one
after publication is a breaking change with no migration path.**

| Tool | Input | `readOnlyHint` | `destructiveHint` |
|---|---|---|---|
| `visimark_check` | `path` \| `content` | `true` | `false` |
| `visimark_eval` | `path` \| `content`, `get?`, `scenarioPath?` \| `scenarioContent?` | `true` | `false` |
| `visimark_explain` | `path` \| `content`, `sheet?` | `true` | `false` |
| `visimark_infer` | `path` \| `content` | `true` | `false` |
| `visimark_fmt` | `path` \| `content` | `true` | `false` |
| `visimark_ref` | `name?` | `true` | `false` |
| `visimark_fmt_apply` | `path`, `plan` | `false` | `true` |
| `visimark_infer_apply` | `path`, `plan` | `false` | `true` |

`visimark_fmt` and `visimark_infer` are **read-only**: they return the planned
edits and never touch disk. This is the plan half of the plan/apply split, and
it is free — `write/fmt.ts` already exports `planFmt` returning `PlannedEdit[]`
and `infer/write.ts` exports `planInfer` returning `PlannedInsert[]`.

`visimark_ref` reads no file at all, which makes it the natural first tool to
build and a clean shakedown of the transport.

**Tool descriptions state the bounded blast radius**, because it is true and
reassuring: `fmt` repairs stale computed values, anchors and generated artifacts
and nothing else — never prose, never a column with no rule, never any other
finding class.

**Tool descriptions carry no counts.** "All fifteen builtins" was already wrong
when #169 was filed — there are sixteen. `docs/function-reference.md` is
generated from `packages/visimark/src/lang/reference.ts` and CI regenerates it;
a hand-written MCP description is not in that loop, so it must not contain a
number that can drift.

### 2.3 `path` or `content`

Every read tool accepts **either** `path` **or** `content`. This is the one
place the surface deliberately does not mirror the CLI. An agent frequently has
no file path — it has a table it is drafting in context, or an unsaved buffer —
and a path-only surface forces a temp file to ask "do these numbers add up?",
the single most common thing it will want to ask.

The engine already supports this. `packages/visimark/src/index.ts` exports a
content-in API (`analyze`, `check`, `planFmt`, `infer`, `planInfer`,
`describeFunction`), and `fs/reader.ts` states the condition structurally: a
caller that does not have a document on disk passes no `doc`, and the filesystem
phases stand down. `packages/remark-visimark` and the browser playground consume
exactly this surface today.

| Input | Meaning |
|---|---|
| `path` only | `doc: onDisk(path)` — imports, artifacts and staleness all resolve |
| `content` only | no `doc` — the filesystem phases stand down (§2.5) |
| both | usage error, `USAGE`, MCP tool error (§3) — **never** a silent preference |
| neither | usage error, `USAGE`, MCP tool error |

`visimark_eval`'s scenario mirrors the same rule: `scenarioPath` or
`scenarioContent`, never both, so an agent can evaluate a draft document against
a draft scenario without touching disk.

`visimark_fmt_apply` and `visimark_infer_apply` take `path` only. There is
nothing to apply to a string.

### 2.4 The write gate

Writes are off unless **both** conditions hold:

1. the server was started with `--allow-write`, and
2. the host declared at least one MCP root.

**No roots means no writes**, even with the flag. The gate fails closed: an
operator who passes the flag into a host that declares nothing has not chosen a
blast radius, and the server does not choose one for them. The agent cannot
argue its way past either condition — neither is reachable from a tool call.

The apply tools are **listed in `tools/list` even when writes are disabled**,
and return a tool error when called:

```
writes are disabled. Start the server with --allow-write.
```

Listed-and-erroring rather than hidden, so the error text tells the human
operator exactly what to do. The annotations are truthful in both states:
`destructiveHint: true` is on the apply tools whether or not the gate is open,
because the annotation describes the tool, not the session. **Hosts gate on
these, and a server that lies about them is untrustworthy in precisely the
community this is meant to reach.**

Writes are confined to the declared roots, **on top of** the existing artifact
path gate — containment in the document's directory, and the refusal to
overwrite any file lacking VisiMark's metadata marker.

### 2.5 `content` mode and the filesystem phases

A document passed as `content` has no base directory, so a declared `import` and
a `chart` target cannot resolve. The engine already has a defined, documented
answer for this and it is neither an error nor silence: both phases record
`state: "skipped"`.

| Phase | Behaviour with no reader | Source |
|---|---|---|
| Import resolution | `ImportStatus` `state: "skipped"`; no finding | `import/resolve.ts:45` |
| Chart staleness | `ChartResult` `state: "skipped"`; SVG still rendered | `check-charts.ts:178` |

`"skipped"` means *valid, but nothing on disk can be checked, so nothing is
reported*. The MCP result **surfaces that state explicitly** rather than letting
it read as a clean pass, because an agent that gets an import finding under
`path` and not under `content` will otherwise read the difference as a bug:

```json
{ "skipped": { "imports": ["ledger"], "charts": ["costs.trend"] } }
```

The key is present as `{}` when nothing was skipped, per the envelope's
empty-objects-are-present rule. `visimark_check`'s and `visimark_fmt`'s
descriptions say in one line that `content` mode cannot verify imports or
artifacts.

### 2.6 Resources

Served from the **installed package's own files** — added to `files` in
`package.json` — never fetched at runtime. A network fetch would give the server
an ambient dependency the CLI does not have, and would make a resource's content
depend on something other than the installed version.

| URI | Serves |
|---|---|
| `visimark://skill` | The VisiMark authoring skill (§2.7) |
| `visimark://cli-reference` | `docs/cli-reference.md` — every command, option, exit code and finding |
| `visimark://function-reference` | `docs/function-reference.md` — the builtins |
| `visimark://example/invoice` | `docs/example-invoice.md` — a complete worked invoice |
| `visimark://example/drift` | `docs/example-invoice-drift.md` — the same invoice after one input changed and nothing derived from it was updated |

The highest-value payload is not `check` — it is the skill. **A server that
ships `check` without the authoring discipline hands an agent a verifier with
none of the reason it exists**, above all the rule that a green `check` is
evidence of agreement, not of derivation.

The worked examples are resources rather than prompt content on a deliberate
distinction: resources are pull, prompts are push, and samples want pull. An
invoice should not enter context unless the task is an invoice.

### 2.7 The served skill is generated

`skills/visimark/SKILL.md` is written for a reader inside the clone. The
resource at `visimark://skill` is a **generated variant** derived from it at
build time, with the "Running it" section rewritten for a reader who has the MCP
server and not the repository.

Generation, not a second hand-maintained file, because two hand-written variants
drift. The generator gets the same treatment `docs/function-reference.md` has: a
CI freshness check that regenerates and fails on a diff.

### 2.8 Prompts

Two, deliberately. **A prompt earns its place when it encodes an ordering the
agent gets wrong unsupplied.** VisiMark has exactly two, and the skill already
documents both as traps.

| Name | Ordering it encodes |
|---|---|
| `visimark/take-over` | Adopt an existing document: run `infer` first. Never hand-author rules for a document that already has its numbers. |
| `visimark/author` | Write a new one: table → `vmark` block → anchors → prose → `fmt`, in that order. |

The change-an-input-and-watch-it-break probe is **not** a third prompt. It is a
step inside both of the above, and splitting it out invites an agent to treat it
as optional.

## 3. The machine contract

### 3.1 Exit codes become tool results

`visimark`'s process exit codes are `0` clean, `1` findings, `2` usage. Over
MCP:

| CLI outcome | MCP result |
|---|---|
| `0` — clean | successful tool call, `status: "ok"` |
| `1` — findings | **successful tool call**, `status: "problems"` |
| `2` — usage / read / write / scenario fault | **MCP tool error**, carrying the envelope's `error` object |

**`check` returning `1` is a successful tool call reporting problems, not an
MCP error.** Getting this backwards makes every failing document look like a
broken server — which is the opposite of what the tool is for. Only the `2`
class surfaces as a tool error, because that class means "your request did not
make sense".

The server process itself exits `0` on clean shutdown and `2` on a usage error
in its own arguments. It never exits because a document had findings.

### 3.2 The `--json` envelope is the wire format

Tool results are the envelope specified in
[`structured-output-json-spec.md`](structured-output-json-spec.md), **not a
reshaped one**, so there is a single consumed contract rather than two that can
drift. That means, unchanged:

- `command`, `visimark`, `status`, `error`, then the command body, in that field
  order;
- `status` is `"ok"` / `"problems"` / `"error"`, tracking what the exit code
  would have been;
- document values are **decimal strings**, never JSON numbers
  ([§7](../visimark-design.md#7-numeric-semantics)); dates are ISO strings;
- named empty arrays and objects are present as `[]` / `{}`, not omitted;
- findings are the public finding shape of §3.1 of that spec — `code`, `class`,
  `location`, `details` — never the internal `Finding` type.

**Which findings are problems** follows the existing `isProblem()` split in
`packages/visimark/src/model/types.ts`, reused rather than reimplemented — the
same point review made on #152. Advisory findings (`WARN`, `NOTE`) never turn
`ok` into `problems`.

Two additions, both outside the envelope's existing keys:

- `skipped` (§2.5), on the read tools that have filesystem phases.
- the apply tools' `plan` / `applied` bodies (§3.4).

### 3.3 Versions

| Version | Where it appears |
|---|---|
| Engine | the envelope's `visimark` field, exactly as `--json` emits it today |
| Server | the MCP `initialize` response's `serverInfo.version` |

The envelope is not widened to carry the server version. They are in lockstep by
policy (§5.1), and the protocol already has a place for a server to name itself.

### 3.4 Plans and the staleness guard

A `PlannedEdit` carries byte offsets. If the file changes between the plan call
and the apply call, a naive splice corrupts it.

**The plan result carries `sha256` of the source it was computed against.** The
apply tool rehashes the file it is about to write and refuses on mismatch:

```
the document changed since this plan was computed — re-run visimark_fmt
```

as a tool error. The primitive already exists: `ReaderPort.readSealed` is a
single indivisible open-read-close-hash, built for exactly this class of
problem, and `fs/reader.ts` documents why it must stay one call.

The plan is what gets applied — the apply tools do **not** silently re-plan.
Re-planning cannot go stale by construction, but it would mean the agent's
reviewed plan is not what lands, which undercuts the entire point of the
plan/apply split.

`visimark_infer`'s plan carries `sha256` on the same terms and for the same
reason. A guard on one plan shape and not the other would leave
`visimark_infer_apply` splicing into a document that had moved.

`visimark_fmt`'s plan body additionally lists **the artifact paths it would
create**, so nothing is written that the caller did not see named first:

```json
{ "command": "fmt", "visimark": "0.1.7", "status": "problems",
  "file": "quote.md",
  "sha256": "6d482ed8…",
  "edits": [ { "start": 912, "end": 919, "text": "5200.00", "code": "STALE" } ],
  "cellsUpdated": 7, "anchorsUpdated": 8, "stampsUpdated": 0,
  "artifactsWouldWrite": [ "charts/quote-trend.svg" ],
  "findings": [], "summary": { "problems": 26, "stale": 21, "errors": 5 },
  "skipped": {},
  "applied": false }
```

An edit is `{ start, end, text, code }` — the byte span this paragraph opens
by naming, the replacement, and the finding code it resolves. A friendlier
`{ name, from, to }` would be unappliable: the apply tool splices the plan it
was given, and a name is not a span.

The counts are the engine's own arithmetic, carried in the plan rather than
re-derived at apply time, so `visimark_fmt_apply` reports the numbers the
caller reviewed and not a second set that could disagree with them.

**Artifacts cannot travel in a plan**, because their content is rendered SVG.
They are re-derived at apply time from the source the digest has just proved
identical, and the two path sets are compared **in both directions**. A target
this run would write that the plan did not name is a `WRITE` error; so is a
target the plan named that this run will no longer write — something has
appeared there, or it has stopped being VisiMark's. Only the second direction
is load-bearing in practice, and without it that target is dropped in silence
and the call reports success, leaving a document whose numbers moved and whose
chart did not.

**Every refusal that can be decided before a byte moves is decided first** —
the gate, the digest, both path-set comparisons, and root containment for each
artifact target. Then the artifacts, then the document. One rejected target
therefore leaves no artifact written at all, rather than half of them.

### 3.5 The engine's public surface

`visimark_fmt_apply` writes generated artifacts, so it needs the gate that
protects them. That gate is **in the engine** — `packages/visimark/src/artifact/write.ts`
re-proves the path verdict against the open descriptor: `O_EXCL` for a target
that was supposed to be absent, `O_NOFOLLOW`, a regular-file check, and the
marker read back out of the same descriptor the bytes then go into.

It is not currently exported. `packages/visimark/src/index.ts` gains:

```ts
export { writeArtifact } from "./artifact/write.js";
export type { ArtifactWrite } from "./write/fmt.js";
export { resolveArtifactPath, type PathResult } from "./artifact/path.js";
```

The alternative is for `visimark-mcp` to reimplement a security boundary,
which is the last thing a second consumer of one should do. The gate becomes a
supported API and is documented as one.

**`resolveArtifactPath` gates containment and extension only.** The
marker-and-provenance refusal lives in `writeArtifact`, in the caller position,
because it is about a file's provenance and not its path — `artifact/path.ts`
says so in its own comment. Both are needed; neither substitutes for the other.

#### 3.5.1 The front-end layer, which this spec assumed was already reachable

This section was drafted believing the artifact gate was the *only* thing
`index.ts` would have to expose. That was wrong, and the implementation found
it out: almost none of the engine's front-end layer was exported at all. It had
never needed to be, because the CLI is compiled in the same tree and imports
its neighbours directly.

So §3.2's "consume the envelope, do not reshape it" and the reuse rule that
review made on [#152](https://github.com/michal-niedzwiedzki/visimark/issues/152)
could not both be honoured without a second copy of the public finding shape
inside `visimark-mcp` — which is precisely the drift both rules exist to
prevent. `index.ts` therefore also gains, additively:

| Exported from | What, and why it is needed |
|---|---|
| `report/json.ts` | `publicFinding`, `publicProposal`, `publicAssertions`, `publicCharts`, `publicFnEntry`, `evalValues`, `findingSummary`, `inferSummary`, `statusFromExit`, `errorEnvelope`, `signature` — the envelope's own pieces. A consumer that re-derives these is the second serialisation §3.2 forbids. |
| `report/explain.ts` | `explainView`, `explainJson`, `explainText` — `explain`'s result *is* an envelope, produced whole by `explainJson`. |
| `report/levenshtein.ts` | `closest` — so `visimark_ref`'s did-you-mean is the CLI's, from the same call, rather than a second guess with its own threshold. |
| `eval/scenario.ts` | `parseScenarioJson`, `resolveScenario`, `applyScenario`, `listParams`, `ScenarioError` — `visimark_eval`'s scenario arm, which §2.3 requires. |
| `cli/version.ts` | `readVersion` — so the envelope's `visimark` field is the version of the engine that actually ran, not a string the server carries separately and hopes agrees. |

Two supporting changes fall out of it, neither a behaviour change:

- `publicFnEntry` and `signature` move from `cli/commands.ts` into
  `report/json.ts`, beside the other public shapes. The CLI imports them from
  their new home and its output is byte-identical.
- `readVersion()` could not resolve its own manifest from the **bundled
  library entry point**: `dist/index.js` looked for `../../package.json` and
  found `packages/package.json`, so any library consumer that asked for an
  envelope got `Cannot find module`. It now tries `../` as well. A latent bug
  this work surfaced, not one it introduced.

Everything here is additive. Nothing is removed or re-typed, so no existing
library consumer changes — the property §5.1 actually turns on.

## 4. Behaviour table

Every outcome, with its literal result. This doubles as acceptance.

| Case | Result |
|---|---|
| `visimark_check { path: "invoice.md" }`, clean | `status: "ok"`, `findings: []` |
| `visimark_check { path: "example-invoice-drift.md" }` | `status: "problems"`, 21 findings, summing to 27 problems (22 stale, 5 errors) |
| `visimark_check { content: "\| Item \| Qty \|…" }` | `status: "problems"`, `COVERAGE` finding, `skipped: {}` |
| `visimark_check { content }` on a document with an `import` | `status` per the other findings; `skipped.imports` names the sheet; **no** `IMPORT` finding |
| `visimark_check { path, content }` | tool error, `error.code: "USAGE"` |
| `visimark_check {}` | tool error, `error.code: "USAGE"` |
| `visimark_check { path: "nope.md" }` | tool error, `error.code: "READ"` |
| `visimark_eval { path, get: "lines.gross_total" }` | `status: "ok"`, `values` with one key |
| `visimark_eval { path, get: "nope" }` | tool error, `error.code: "USAGE"` |
| `visimark_eval { path, scenarioContent }` | `status` per the run; scenario applied without a temp file |
| `visimark_eval { path, scenarioPath, scenarioContent }` | tool error, `error.code: "USAGE"` |
| `visimark_eval { path, scenarioContent }` with a bad key/type/width | tool error, `error.code: "SCENARIO"` |
| `visimark_eval { path }`, an assertion fails | `status: "problems"`, `holds: false` |
| `visimark_explain { path, sheet: "nope" }` | tool error, `error.code: "USAGE"` |
| `visimark_infer { path }` | `status: "ok"`, proposals, `sha256`, **no** `written` key — it never writes |
| `visimark_infer_apply { path, plan }` with every proposal removed from the plan | `applied: true`, `changed: false`, and **no** `no-formulas` marker — a document whose rules the agent read and declined is not a document with nothing to derive |
| `visimark_ref {}` | `status: "ok"`, every builtin |
| `visimark_ref { name: "SUM" }` | `status: "ok"`, one entry |
| `visimark_ref { name: "AVERAGE" }` | tool error, `USAGE`, ``visimark: unknown function `AVERAGE` `` — **no** suggestion, because AVERAGE is four edits from AVG and `closest` stops at three. This row previously claimed a suggestion; the CLI does not produce one either. What the two surfaces share is the wording and the same `closest` call, which is what the tests pin. |
| `visimark_ref { name: "SUMM" }` | tool error, `USAGE`, with the did-you-mean suggestion the CLI produces — ``did you mean `SUM`?`` |
| `visimark_fmt { path }` | `status: "ok"`, `edits`, `artifactsWouldWrite`, `sha256`, `applied: false`. **Nothing written.** |
| `visimark_fmt { content }` | as above, `artifactsWouldWrite: []`, `skipped.charts` names them |
| `visimark_fmt_apply { … }`, gate closed | tool error: `writes are disabled. Start the server with --allow-write.` |
| `visimark_fmt_apply { … }`, flag set, no roots declared | same tool error — no roots means no writes (§2.4) |
| `visimark_fmt_apply { path }`, path outside every declared root | tool error, `error.code: "WRITE"` |
| `visimark_fmt_apply { path, plan }`, `sha256` mismatch | tool error: the document changed since the plan was computed |
| `visimark_fmt_apply { path, plan }`, gate open, hash matches | `applied: true`, counts for cells / anchors / artifacts |
| `visimark_fmt_apply`, artifact target is not VisiMark's | tool error, `error.code: "WRITE"`; **the document is left unspliced** — a partly-applied `fmt` is worse than none. In practice the refusal arrives from the path-set comparison in §3.4 rather than from `writeArtifact`: a target that stopped being ours is one this run will no longer write, and that is caught before any byte moves. `writeArtifact`'s own refusal remains the backstop for a file that appears between that check and the write. |
| `visimark_fmt { path }` then an artifact target changes, then `visimark_fmt_apply` | tool error, `error.code: "WRITE"`, naming the target — **no artifact is written at all**, not even ones that precede it in the plan |
| `visimark_infer_apply { path, plan }`, gate open | `applied: true`, the `vmark` block inserted |
| `visimark-mcp --nope` | stderr usage line, exit `2`, before the transport starts |

## 5. Compatibility

### 5.1 What does not change

**No existing CI job, script, composite-Action invocation or installed extension
behaves differently.** This is a new, opt-in package. Specifically unchanged:

| Surface | Effect |
|---|---|
| `visimark` CLI — commands, options, exit codes, streams, `--json` | Unchanged. No option is added, removed or re-spelled. |
| `docs/ci.md`'s `npx visimark check` recipes | Unchanged. |
| `action.yml` (the composite Action) | Unchanged. |
| `.github/workflows/dogfood.yml` | Unchanged. |
| `scripts/precommit-visimark-check.sh` | Unchanged. |
| `packages/remark-visimark`, `packages/markdownlint-visimark` | Unchanged. |
| `packages/visimark-lsp`, `editors/vscode` | Unchanged. LSP speaks a different protocol to an editor about a live buffer; there is no code to share beyond the engine. |
| Document syntax, evaluation, the finding set, write-back | Unchanged. |
| The `--json` envelope | Unchanged — consumed as-is, not reshaped. |

The engine's public surface **is** widened, additively, by the exports in §3.5
— the artifact gate, and the front-end layer in §3.5.1 that this spec wrongly
assumed was already reachable. Nothing is removed or re-typed, so no existing
library consumer changes, which is the property that matters here.

### 5.2 Version lockstep

`visimark-mcp` is published, depends on `visimark` by an **exact pin**, and
imports the library. It is shaped like `packages/remark-visimark` and
`packages/markdownlint-visimark`, not like the private `packages/visimark-lsp`.

| | `remark-visimark` | `markdownlint-visimark` | `visimark-lsp` | `visimark-mcp` |
|---|---|---|---|---|
| published | yes | yes | no (`private: true`) | **yes** |
| depends on core | `"visimark": "0.1.7"` exact | `"visimark": "0.1.7"` exact | `workspace:*` | **exact, in lockstep** |
| consumes core by | library import | library import | library import | **library import** |
| has a `bin` | no | no | no | **yes** |

**`visimark-mcp` must never be published ahead of the engine it pins.** The
exact pin is resolved from the registry by anyone installing the server, so a
server released against an engine version that is broken *for a given runtime*
is a server that does not start on that runtime, whatever this repository's
tree says. That is not hypothetical: `visimark@0.1.7` carries the #170 `bun`
exports condition, so `bun add -g visimark-mcp` would have failed for every
user had the server shipped against it. Publishing both in lockstep from one
tag, which §5.5's release legs do, is what makes this safe.

**Import the library; do not shell out.** Shelling out costs a process spawn and
a JSON reparse per call, forces every call through a file path — killing §2.3 —
and would inherit `fmt`'s writes as the *only* option, losing the entire
demarcation in §2.4. It would actively cost the security story.

`visimark-mcp` is the **first** published package in this repo with a `bin`
other than the engine itself, which is why §5.3 applies to it and not to the
other two.

### 5.3 Runtime parity

[`.agents/rules/runtime-parity.md`](../../.agents/rules/runtime-parity.md) is an
always-on rule and applies in full, because this package has a `bin`.

- **The `bin` entry points at an `sh` launcher**, copied in shape from
  `packages/visimark/bin/visimark`, which walks the symlink chain and execs
  under `command -v node || command -v bun`. The payload beside it keeps
  `#!/usr/bin/env node` on purpose: it is executed as an argument, never as the
  `bin` target. **A plain Node shebang in the `bin` slot produces a broken
  command under `bun add -g visimark-mcp`** — `bun install -g` links a bin as a
  bare symlink rather than writing a launcher shim, so the kernel hunts for
  `node` and aborts before Bun is ever consulted. This is the easiest thing in
  the whole change to get wrong; it is
  [#29](https://github.com/michal-niedzwiedzki/visimark/issues/29) again.
- **Both invocations in every snippet** — `npx visimark-mcp` beside
  `bunx visimark-mcp`, and `npm i -g` beside `bun add -g`, in `README.md` and
  `docs/mcp.md`, as `docs/cli-reference.md` already does for the CLI.
- **CI exercises the packed artifact under each runtime alone** — §5.4.

### 5.4 The parity fixture

The rule requires this spec to say how the packed artifact is installed and run
with only Node present and with only Bun present. It is not a new pair of jobs:
`smoke-node` and `smoke-bun` already exist, already depend on `pack`, and
already assert that the *other* runtime is absent from `PATH` — which is the
assertion that actually catches the shebang bug.

- `pack` packs a second tarball from `packages/visimark-mcp` and uploads it
  beside the engine's.
- `smoke-node` (Node-only, `bun` asserted absent) and `smoke-bun`
  (`oven/bun` container, `PATH` reset, `node` asserted absent) each additionally
  install the MCP tarball globally and drive a **stdio handshake**, not just a
  `--version` line: `initialize`, then `tools/list`, asserting the eight tool
  names and their annotations, and then **one `tools/call`**.

A `--version` check would pass on a server that cannot speak the protocol. The
handshake is the smallest assertion that proves the binary is actually usable.
Listing the tools proves only that the server started; calling
`visimark_check` with `content` proves the engine it imports loaded and ran,
which is a different failure and the one a bad install produces.

**Each job installs the packed engine into the MCP package explicitly.** This
is not belt-and-braces. `bun add -g` resolves `visimark-mcp`'s exact `visimark`
pin **from the registry** even when the engine tarball is named in the same
command; `npm i -g` happens to dedupe against the sibling tarball. Left to the
package managers, the two jobs therefore test different engines, and the Bun
one tests a *published* engine rather than the one the run just built — which
is how the first green-looking implementation of this section failed: it picked
up a released `visimark` still carrying the
[#170](https://github.com/michal-niedzwiedzki/visimark/issues/170) `bun`
exports condition, already fixed in the tree it was supposed to be testing.
Each job now unpacks the engine tarball over `node_modules/visimark` and
asserts the manifest it installed is byte-identical to the packed one.

### 5.5 Version-carrying files and release legs

Two counts move. Both are edits, not breakage, but an unlisted stale count is
how a release ships under the wrong number.

| Today | After |
|---|---|
| `.github/workflows/ci.yml:26` — "**Nine** files/fields carry the version and all nine must agree", over **five** package manifests | **Eleven** fields over **six** manifests: `visimark-mcp`'s own `version` and its `dependencies.visimark` pin join, for the same two reasons `remark-visimark` and `markdownlint-visimark` each join twice |
| `docs/releasing.md:35` — the final gate "asks all **three** registries" | **Four**: npm, the VS Code Marketplace, Open VSX, and `registry.modelcontextprotocol.io` |
| `docs/releasing.md:227` — "All **three** `package.json` versions equal the tag" | Already stale at three (there are five manifests today); becomes **six** |

`docs/releasing.md`'s "What one tag publishes" table also omits the existing
`remark-lint-visimark` and `markdownlint-rule-visimark` legs. The documentation
task repairs that while it adds the MCP rows, since it is the same table.

### 5.6 Reversibility

Additive and reversible. The package can be deprecated on npm and delisted from
the registry without touching the engine; the three new engine exports are
additive and would simply go unused. No re-release of the CLI, the Action, the
extension or either plugin is required to undo it.

The one irreversible commitment is the **public tool surface**: once agents
depend on tool names and argument shapes, renaming one is a breaking change with
no deprecation channel. §2.2 names them once, carefully, for that reason.

## 6. Interaction with the rest of the tooling

| Area | Effect |
|---|---|
| The six CLI commands | Unchanged. `visimark-mcp` is a second front end over the same library calls. |
| `--json` | Consumed as the wire format (§3.2). Not changed, not reshaped, not versioned separately. |
| `fmt --no-artifacts` ([#168](https://github.com/michal-niedzwiedzki/visimark/issues/168)) | Available as a library option. Not required by this spec — the plan/apply split already prevents unseen writes by listing artifact paths before anything is applied — but it is what makes "plan the document edits, skip the SVGs" a first-class call rather than a special case. |
| `release.yml` | Gains a publish leg for `visimark-mcp` on npm and one for the MCP registry, both in the existing shape: ask the registry for this exact version, publish or skip on the answer, `continue-on-error`, and the final "every leg must have landed" gate re-asks. That shape exists because v0.1.3 lost Open VSX, the GitHub Release and the issue bookkeeping to an unrelated Marketplace credential failure; a bolted-on step would reintroduce it. The MCP registry's `GET /v0/servers?search=` is the probe for its leg's guard. |
| `ci.yml` | `pack` packs a second tarball; `smoke-node` / `smoke-bun` gain the handshake (§5.4); the version-agreement check gains two fields (§5.5); a freshness check for the generated skill variant (§2.7). |
| The LSP and the extension | Unchanged. |
| `docs/cli-reference.md` | Unaffected directly, but it is the **normative source** the MCP tool descriptions paraphrase. The two must not drift; §2.2's no-counts rule is the first consequence. |
| The review workflow and `docs/issue-runbook.md` | Unchanged — this adds no template, kind or track. |

**Namespace.** `io.github.michal-niedzwiedzki/visimark` on the official
registry, with namespace ownership proven by GitHub login. It is independent of
the `visimark_` tool-name prefix (§2.2), so a later move to a domain-verified
namespace changes the registry entry and not a single tool name.

**The contributor escape hatch.** Testing the server from a clone needs the same
escape the CLI has, or a contributor silently tests the *published* build
instead of their working tree. `CONTRIBUTING.md` documents
`bun run packages/visimark-mcp/src/main.ts` and the `claude mcp add` line that
points a client at it.

## 7. Documentation to update

This list is the plan's final task, verbatim.

| File | Change |
|---|---|
| **`docs/mcp.md`** — new | The full surface, modelled on `docs/cli-reference.md`'s table discipline: one row per tool, what it reads, what it writes, which annotation it carries. Both `npx` and `bunx` forms. |
| `README.md` | A new MCP section in the distribution list beside the GitHub Action, the remark plugin, the markdownlint rule and the extension. Install and run lines in both forms. (The stale marketplace sentence at `:426` is **not** fixed here — §1.1.) |
| `docs/releasing.md` | The new npm and MCP-registry legs in "What one tag publishes"; the existing `remark` and `markdownlint` legs added to the same table; "all three registries" → four; "All three `package.json` versions" → six. |
| `docs/ci.md` | A chapter for the MCP server — no existing one covers it. |
| `CONTRIBUTING.md` | Building and running the server locally under both runtimes, and the published-build trap. |
| `skills/visimark/SKILL.md` | "Running it" mentions the MCP server as an alternative to shelling out; the framing gets a pass for a reader who has not cloned the repo, since a variant of this file is served as a resource. |
| `.github/workflows/ci.yml` | The nine→eleven comment block above the version check, which explains *why* each field joins. |
| `CHANGELOG.md` | `## Unreleased` → `### Added`. |
| `docs/vocabulary-catalogue.md` | The section F row moved into the Shipped register as `UNRELEASED` — `Name`, `Kind`, `Request`, `Landed`, `Released` = `—`, `Decision`. |

`docs/cli-reference.md`, `docs/issue-runbook.md`, `.github/ISSUE_TEMPLATE/` and
`editors/vscode/CHANGELOG.md` need **no** change: no CLI surface, workflow, form
question or editor behaviour moves.

## 8. Non-goals

- **Third-party registry listings and claiming** (§1.1) — Glama, PulseMCP,
  Smithery, mcp.so, `awesome-mcp-servers`.
- **The README marketplace correction** (§1.1) — its own docs PR.
- **A third prompt** for the change-an-input probe (§2.8).
- **HTTP or SSE transport.** Stdio only.
- **Any change to what a document means.** A tool that changed document meaning
  would be a language change wearing a tool name, and belongs in section E.
- **Reshaping the `--json` envelope** for MCP ergonomics (§3.2).
- **A `--format` flag or a second serialization.** Out of scope in the `--json`
  spec, and out of scope here.
- **Building on `packages/visimark-lsp`** — a different protocol, to a different
  consumer, about a live buffer.

## 9. Open questions

None.
