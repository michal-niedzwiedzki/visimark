# The VisiMark MCP server

Everything `visimark-mcp` exposes, in one place. The CLI's equivalent is
[`cli-reference.md`](cli-reference.md); this is the lookup table for agents and
for the people who run them.

`visimark-mcp` is a stdio [MCP](https://modelcontextprotocol.io) server over the
same engine the CLI uses. It imports the engine as a library and never shells
out, so a document an agent is drafting in context needs no temp file and no
path.

Install it with `bun add -g visimark-mcp` or `npm i -g visimark-mcp`, or run it
without installing with `npx visimark-mcp` — or, on a machine with Bun but no
Node, `bunx visimark-mcp`. The installed command runs under whichever of Bun or
Node is on your PATH.

On Windows, `npx visimark-mcp` and `npm i -g visimark-mcp` work as elsewhere;
npm's global shim for the launcher invokes `sh`, so `sh` must be on PATH (Git
Bash and WSL provide it, plain PowerShell does not).

## Adding it to a host

```console
$ claude mcp add visimark -- npx -y visimark-mcp
$ claude mcp add visimark -- bunx visimark-mcp        # a machine with no Node
```

Read-only, as above. To allow writes, see [the write gate](#the-write-gate).

```json
{
  "mcpServers": {
    "visimark": { "command": "npx", "args": ["-y", "visimark-mcp"] }
  }
}
```

## The command

```
visimark-mcp [--allow-write]
```

One binary, stdio transport, no other options. An unrecognised option is
refused with exit `2` before the transport starts. The server exits `0` on a
clean shutdown and never exits because a document had findings.

## Tools

| Tool | Reads | Writes | `readOnlyHint` | `destructiveHint` |
|---|---|---|---|---|
| `visimark_check` | `path` or `content` | nothing, ever | `true` | `false` |
| `visimark_eval` | `path` or `content`, plus `get`, `scenarioPath` or `scenarioContent` | nothing | `true` | `false` |
| `visimark_explain` | `path` or `content`, plus `sheet` | nothing | `true` | `false` |
| `visimark_infer` | `path` or `content` | nothing | `true` | `false` |
| `visimark_fmt` | `path` or `content` | nothing — it plans | `true` | `false` |
| `visimark_ref` | nothing at all | nothing | `true` | `false` |
| `visimark_fmt_apply` | `path`, `plan` | computed cells and anchors in place; generated artifacts, whole | `false` | `true` |
| `visimark_infer_apply` | `path`, `plan` | a `vmark` block after each table, an anchor after each matched figure | `false` | `true` |

`visimark_fmt` and `visimark_infer` are **read-only**: they return the edits
they would make and touch nothing. That is the plan half of the plan/apply
split, and it is why they carry `readOnlyHint: true` — planning is not writing.

Tool names are a frozen public surface. There is no deprecation channel
comparable to a CLI flag's, so renaming one after publication is a breaking
change with no migration path.

### `path` or `content`

Every read tool takes **either** `path` **or** `content`, never both and never
neither. This is the one place the surface deliberately does not mirror the
CLI: an agent frequently has a table it is drafting in context rather than a
file, and a path-only surface forces a temp file to ask "do these numbers add
up?".

| Input | Meaning |
|---|---|
| `path` only | imports, artifacts and staleness all resolve |
| `content` only | the filesystem phases stand down — see below |
| both | `USAGE` error, never a silent preference for one |
| neither | `USAGE` error |

`visimark_eval`'s scenario follows the same rule with `scenarioPath` and
`scenarioContent`, so a draft document can be evaluated against a draft
scenario without touching disk.

The apply tools take `path` only. There is nothing to apply to a string.

### What `content` mode cannot see

A document passed as `content` has no directory, so a declared `import` and a
`chart` target cannot resolve. Neither is an error and neither is silence: both
phases record `skipped`, and the result names them.

```json
{ "skipped": { "imports": ["ledger"], "charts": ["costs.trend"] } }
```

`skipped` is present as `{}` when nothing was skipped. An arm that would be
empty is omitted, so `skipped.charts` always means "these could not be checked"
and never "none were".

## Results

Every tool result is the same JSON envelope `visimark --json` emits, specified
in [`design/structured-output-json-spec.md`](design/structured-output-json-spec.md)
— not a reshaped one, so there is a single consumed contract rather than two
that can drift. Document quantities are decimal strings; dates are ISO strings;
named empty arrays and objects are present rather than omitted.

| The CLI would exit | The tool call is |
|---|---|
| `0` — clean | a successful call, `status: "ok"` |
| `1` — findings | a **successful** call, `status: "problems"` |
| `2` — usage, read, write or scenario fault | a tool error, carrying the envelope's `error` object |

**A failing `check` is a successful call.** Getting that backwards makes every
document that disagrees with itself look like a broken server, which is the
opposite of what the tool is for. Only the `2` class is a tool error, because
that class means "your request did not make sense".

| `error.code` | When |
|---|---|
| `USAGE` | the arguments do not make sense — both `path` and `content`, neither, an unknown sheet, an unknown value name, an unknown builtin |
| `READ` | the arguments made sense and the file could not be read |
| `SCENARIO` | the scenario named an undeclared param, or a value that does not fit |
| `WRITE` | the write gate refused, or a plan no longer matches the file |

The envelope's `visimark` field is the **engine** version. The MCP
`initialize` response's `serverInfo.version` is the **server** version. They
are in lockstep by policy, and the envelope is not widened to carry both.

## The plan/apply split

`visimark_fmt` returns the edits it would make, the artifact paths it would
write, and `sha256` of the source it computed them against:

```json
{ "command": "fmt", "visimark": "0.1.7", "status": "ok",
  "sha256": "e3b0c442…",
  "edits": [ { "start": 1204, "end": 1212, "text": "13200.00", "code": "STALE" } ],
  "cellsUpdated": 1, "anchorsUpdated": 0,
  "artifactsWouldWrite": [ "charts/quote-trend.svg" ],
  "skipped": {},
  "applied": false }
```

`visimark_fmt_apply` takes that object back. It rehashes the file and refuses
on a mismatch — *the document changed since this plan was computed* — because a
`PlannedEdit` carries byte offsets and a naive splice into a file that moved
corrupts it.

The plan is what gets applied. The apply tools do not silently re-plan: that
could not go stale, but it would mean the plan the agent reviewed is not what
lands, which undercuts the whole point of the split.

Artifacts cannot travel in a plan, since their bytes are rendered SVG, so they
are re-derived from the digest-proved-identical source and the path sets are
compared in both directions. A target the plan named that can no longer be
written — something appeared there, or it stopped being VisiMark's — is a
`WRITE` error rather than a silent omission.

Every refusal that can be decided before a byte moves is decided first, so one
rejected target does not leave half the charts written. Then the artifacts,
then the document: **on a refused artifact the document is left unspliced**,
because a partly-applied `fmt` is worse than none.

`visimark_infer_apply` takes `visimark_infer`'s result the same way. Drop any
proposal you rejected and only the rest is inserted; a plan whose proposals
were all rejected inserts nothing, and in particular does not mark the document
`no-formulas`.

## The write gate

Writes are off unless **both** hold:

1. the server was started with `--allow-write`, **and**
2. the host declared at least one MCP root.

**No roots means no writes**, even with the flag. An operator who passes the
flag into a host that declares nothing has not chosen a blast radius, and the
server does not choose one for them. Neither condition is reachable from a tool
call.

The apply tools are **listed even when writes are disabled**, and return a tool
error when called:

```
writes are disabled. Start the server with --allow-write.
```

Listed-and-erroring rather than hidden, so the error text tells the human
operator what to do. `destructiveHint: true` is on them in both states, because
the annotation describes the tool and not the session.

Writes are confined to the declared roots **on top of** the engine's existing
artifact gate: containment in the document's own directory, and the refusal to
overwrite any file that does not carry VisiMark's metadata marker — which is
what protects a hand-drawn SVG.

## Resources

Served from the installed package's own files, never fetched at runtime.

| URI | Serves |
|---|---|
| `visimark://skill` | the authoring discipline — read this first |
| `visimark://cli-reference` | every command, option, exit code and finding |
| `visimark://function-reference` | the builtins |
| `visimark://example/invoice` | a complete worked invoice |
| `visimark://example/drift` | the same invoice after one input changed and nothing derived from it was updated |

The highest-value payload here is not `check` — it is the skill. A server that
ships `check` without the authoring discipline hands an agent a verifier with
none of the reason it exists, above all the rule that a green check is evidence
of agreement, not of derivation.

The skill served here is generated from
[`skills/visimark/SKILL.md`](../skills/visimark/SKILL.md) at build time, with
"Running it" rewritten for a reader who has the server and not the repository.
CI regenerates it and fails on a diff.

## Prompts

| Name | The ordering it encodes |
|---|---|
| `visimark/take-over` | adopting an existing document: run `infer` first, and never hand-author rules for a document that already has its numbers |
| `visimark/author` | writing a new one: table → `vmark` block → anchors → prose → `fmt`, in that order |

Two, deliberately. A prompt earns its place when it encodes an ordering the
agent gets wrong unsupplied, and VisiMark has exactly two. The
change-an-input-and-watch-it-break probe is a step inside both rather than a
third prompt, because splitting it out invites an agent to treat it as
optional.

<!--vmark:no-formulas-->
