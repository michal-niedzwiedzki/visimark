# Set up and run the VisiMark MCP server

**From nothing on the machine to an agent that can check, plan and — when you
let it — fix the arithmetic in your Markdown.**

This guide is about one package: `visimark-mcp`. It is the same VisiMark
engine as the CLI and the CI Action, wearing a different transport — instead
of an exit code, it speaks [MCP](https://modelcontextprotocol.io) over stdio,
so an agent can call it as a tool.

It is written for someone who has not run an MCP server before. You do not
need to know VisiMark's language to get through Part 2; [`tutorial.md`](tutorial.md)
is there for the language itself, and [`mcp.md`](mcp.md) is the complete
reference this guide keeps pointing at rather than repeating.

Every transcript here is a real one — either captured from this repository's
own test suite (`packages/visimark-mcp/test/`) or from the handshake script CI
runs against the packed package (`scripts/mcp-handshake.mjs`). Nothing is
invented.

## How to read this

There are 20 short chapters in six parts. Part 1 says why this exists at all.
Part 2 gets a server running and answering in a few minutes. The rest answers
the questions that turn up once you are actually using it.

| Part | Chapters | What you get |
|---|---|---|
| 1. What this is, and what it is not | 1–2 | The shape of the thing, and its one hard boundary |
| 2. The five-minute setup | 3–6 | A running server your agent can talk to |
| 3. The six read tools | 7–11 | `check`, `eval`, `explain`, `infer`, `fmt`, `ref` |
| 4. Turning on writes | 12–15 | The gate, the plan/apply split, and what refuses it |
| 5. What the server teaches the agent | 16–17 | Resources and prompts |
| 6. Operating it | 18–20 | Runtimes, versions, and what still belongs in CI |

---

# Part 1 — What this is, and what it is not

## 1. Why a CLI needed a second front door

`visimark check` is a command a shell runs and a person reads. An agent
working in a repository it has never seen has neither: no shell it is safe to
hand arbitrary commands to, and no reason to already know a CLI called
`visimark` exists.

MCP is the standard answer to that gap — a host (an editor, an agent
framework, a chat client) declares a server, the server declares tools, and
the model calls them the way it calls any other tool. `visimark-mcp` is
VisiMark's half of that: it imports the same engine the CLI does — never
shells out to it — and serves every command as a tool, the authoring
discipline as resources, and two orderings agents reliably get wrong as
prompts.

The "imports, never shells out" part matters for one concrete reason: a
document an agent is drafting *in context* — not yet saved anywhere — can be
checked as a string. There is no temp file to create, no path to make up, no
cleanup to remember. Every read tool takes `content` exactly as readily as
`path`.

## 2. The one thing it will not do for you

**It does not replace `visimark check` in CI, and it is not a gate.**

A gate is something that fails a build. `visimark-mcp` is something an agent
*consults* — and an agent that can read a verdict can also decide not to act
on it, or forget to ask in the first place. Keep `visimark check **/*.md` in
your CI workflow ([`ci.md`](ci.md) is the guide) no matter how thoroughly your
agent uses this server. This guide will not repeat that boundary again, but
everything in it is built on top of it.

The second thing worth knowing before you install anything: **it is read-only
by default, and deliberately hard to make otherwise.** Chapter 12 is the whole
story; until then, assume nothing you do through this server touches a file
on disk.

---

# Part 2 — The five-minute setup

## 3. Install it

Runtime parity applies here exactly as it does to the engine itself: install
with either package manager, run with either runner.

```console
$ npm i -g visimark-mcp
$ bun add -g visimark-mcp
```

or run it without installing anything:

```console
$ npx visimark-mcp
$ bunx visimark-mcp        # a machine with Bun but no Node
```

The installed command runs under whichever of Bun or Node is on your `PATH`.
On Windows, npm's global shim needs `sh` on `PATH` — Git Bash or WSL provide
it, plain PowerShell does not.

There is exactly one flag, and you do not need it yet:

```
visimark-mcp [--allow-write]
```

An unrecognised option is refused with exit `2` before the transport starts —
the same discipline as the CLI. Once stdio is the protocol stream there is
nowhere left to print a usage line, so the check happens first.

## 4. Point a host at it

The transport is stdio, so "pointing a host at it" always means the same
thing: a command the host spawns and talks to over its stdin/stdout. Every
host's configuration is a thin skin over that one fact.

**Claude Code**, from a shell:

```console
$ claude mcp add visimark -- npx -y visimark-mcp
$ claude mcp add visimark -- bunx visimark-mcp        # a machine with no Node
```

**Any host that reads an `mcpServers` object** — Claude Desktop's
configuration file, and several other agent clients follow the same shape:

```json
{
  "mcpServers": {
    "visimark": { "command": "npx", "args": ["-y", "visimark-mcp"] }
  }
}
```

Swap `npx`/`-y visimark-mcp` for `bunx`/`visimark-mcp` on a Bun-only machine,
and add `"args": ["-y", "visimark-mcp", "--allow-write"]` once you have read
chapter 12 and actually mean it.

Whatever the host, the same three facts are what you are configuring: a
command, its arguments, and nothing else. There is no environment variable,
no config file and no network address — the server reads only what the host
tells it and the documents the agent hands it.

## 5. Prove it is actually alive

Before you trust a host's UI to tell you the server started, talk to it
yourself. This is the exact exchange CI runs against every release, trimmed to
the two calls that matter — and it is worth doing once by hand, the same way
chapter 4 of [`ci.md`](ci.md) has you break a document on purpose before
trusting a check.

MCP over stdio is JSON-RPC, one message per line. `initialize` first:

```json
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"0.0.0"}}}
← {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"visimark","version":"0.1.8"}, …}}
```

`serverInfo.name` is always `"visimark"`; `serverInfo.version` is the
**server's** version — a different number from the engine version you will
see in every tool result. Chapter 19 is why they can differ and why that is
fine.

Then `notifications/initialized`, and `tools/list`:

```json
→ {"jsonrpc":"2.0","method":"notifications/initialized"}
→ {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
← … eight tools, named visimark_check, visimark_eval, visimark_explain,
    visimark_fmt, visimark_fmt_apply, visimark_infer, visimark_infer_apply,
    visimark_ref …
```

If your host has no console for this, the repository's own smoke test does
exactly this exchange, with no dependency on anything else in the repo:

```console
$ node scripts/mcp-handshake.mjs "$(which visimark-mcp)"
mcp-handshake: ok — 8 tools, server 0.1.8, engine 0.1.8, and visimark_check ran
$ bun  scripts/mcp-handshake.mjs "$(which visimark-mcp)"
```

Eight tools listed and a version number back is the whole test. Nothing about
the eight tools themselves matters yet — that is Part 3.

## 6. Ask it about a real document

One tool call, end to end, against a document already in this repository —
`docs/example-invoice.md`, which is clean, and its deliberately-broken sibling
`docs/example-invoice-drift.md` (the same one [`example-invoice-drift.md`](example-invoice-drift.md)
walks through by hand).

```json
→ {"jsonrpc":"2.0","id":3,"method":"tools/call",
   "params":{"name":"visimark_check","arguments":{"path":"docs/example-invoice.md"}}}
← {"command":"check","visimark":"0.1.8","status":"ok","findings":[],"skipped":{}}
```

```json
→ {"jsonrpc":"2.0","id":4,"method":"tools/call",
   "params":{"name":"visimark_check","arguments":{"path":"docs/example-invoice-drift.md"}}}
← {"command":"check","visimark":"0.1.8","status":"problems",
   "summary":{"problems":26,"stale":21,"errors":5}, "findings":[ … ] }
```

Read that second response carefully, because it is the one thing about this
server that is easy to get backwards: **`status: "problems"` is a successful
tool call.** The MCP layer reports no error, `isError` is not set, and the
agent gets exactly what it asked for — a document that disagrees with itself,
described precisely. A document with findings is not a broken server, in the
same way `visimark check`'s exit code `1` on the CLI is not a crash. Chapter
11 spells out the whole mapping.

Try it with no path at all — a table you are drafting in the conversation,
that exists nowhere on disk:

```json
→ {"jsonrpc":"2.0","id":5,"method":"tools/call",
   "params":{"name":"visimark_check",
             "arguments":{"content":"| Item | Qty |\n|---|---:|\n| a | 1 |\n"}}}
← {"command":"check","status":"problems","file":"<content>","skipped":{},
   "findings":[{"code":"COVERAGE", …}]}
```

`file` comes back as the literal string `"<content>"` rather than a made-up
path — there was never a path to report. This table has no `vmark` rule at
all, so the `COVERAGE` finding is correct: nothing in it is being checked.
Chapter 10 of [`ci.md`](ci.md) is the full explanation of that finding; here,
the point is narrower — you just verified an in-progress draft with no file
ever touching disk.

---

# Part 3 — The six read tools

## 7. `path` or `content`, never both, never neither

Every read tool takes **either** `path` **or** `content` — this is the one
place the surface deliberately does not mirror the CLI, because an agent
usually has a table in context, not a file.

| Input | What resolves |
|---|---|
| `path` only | imports, artifacts and staleness all resolve normally |
| `content` only | filesystem-dependent phases stand down — see below |
| both | a `USAGE` fault, never a silent preference for one |
| neither | a `USAGE` fault |

`visimark_eval`'s scenario argument follows the identical rule with
`scenarioPath` and `scenarioContent`, so a draft document can be evaluated
against a draft scenario without either one touching disk:

```json
→ {"name":"visimark_eval",
   "arguments":{"path":"docs/example-agent-budget.md",
                "scenarioContent":"{\"budget\":\"5.00\"}"}}
← {"command":"eval","status":"ok",
   "scenario":{"file":"<scenarioContent>",
               "params":{"rates.budget":{"value":"5","default":"2","source":"scenario"}}}, …}
```

The apply tools in Part 4 take `path` only — there is nothing to apply an edit
to inside a string.

### What `content` mode cannot see

A document handed over as `content` has no directory, so a declared `import`
or `chart` target cannot resolve. This is neither an error nor silent — it is
recorded:

```json
{ "skipped": { "imports": ["ledger"], "charts": ["costs.trend"] } }
```

`skipped` is `{}` when nothing was skipped, so its absence never has to be
inferred — `skipped.charts` present always means "these could not be
checked", and its absence always means "none were".

## 8. `visimark_check` — does the document agree with itself?

This is the one you already saw in chapter 6. Two more things worth knowing:

**An unreadable path is a different failure class from a document with
findings.** `path` naming a file that does not exist comes back as a `READ`
fault — a tool error, not a result:

```json
→ {"name":"visimark_check","arguments":{"path":"docs/nope.md"}}
← tool error — {"code":"READ", "message": …}
```

**Passing both `path` and `content`, or neither, is `USAGE`** — the same class
as a name that does not exist, covered in chapter 11's table.

## 9. `visimark_eval` — read a computed value straight out of a document

`eval` is how a document becomes something a workflow can read rather than
only something a person checks. `get` names a value, `sheet.name` or a bare
`name` where it is unambiguous:

```json
→ {"name":"visimark_eval",
   "arguments":{"path":"docs/example-invoice.md","get":"lines.gross_total"}}
← {"command":"eval","status":"ok","values":{"lines.gross_total":"…"}}
```

That value always comes back as a **decimal string**, never a JSON number —
JSON numbers are IEEE floats, and money is not one. Asking for a name the
document does not have is `USAGE`, the same as the CLI:

```json
← {"code":"USAGE","message":"visimark: no value named nope"}
```

A scenario that names an undeclared parameter, or a value that does not fit
its type, is its own fault class, `SCENARIO` — distinct from `USAGE` because
the request made sense and the *data* did not.

## 10. `visimark_explain` and `visimark_ref` — read the document's shape, or the language's

`explain` describes a document's sheets without evaluating anything —
useful when an agent wants to know what is *in* a document before deciding
what to ask it:

```json
→ {"name":"visimark_explain","arguments":{"path":"docs/example-invoice.md"}}
← {"command":"explain","status":"ok","sheets":[ … ]}
```

Naming a sheet that does not exist is, once again, `USAGE`:
`"visimark: no sheet #nope"`.

`visimark_ref` is the odd one out in the table: it takes **no file at all**.
It is the function reference — every VisiMark builtin, or one named function:

```json
→ {"name":"visimark_ref","arguments":{"name":"SUM"}}
← {"function":{"name":"SUM","signature": …}}
```

An unknown name gets exactly the CLI's own wording, did-you-mean included when
one exists:

```json
← {"code":"USAGE","message":"visimark: unknown function `SUMM` — did you mean `SUM`?"}
```

## 11. `visimark_infer` and `visimark_fmt` — the two tools that only plan

`infer` reads numbers already in a document and proposes the rules that
reproduce them, exactly, at each column's own precision:

```json
→ {"name":"visimark_infer",
   "arguments":{"content":"| Item | Qty | Rate | Net |\n|---|---:|---:|---:|\n| a | 2 | 3.00 | 6.00 |\n"}}
← {"command":"infer","status":"ok","proposals":[ … ]}
```

`fmt` reads a document and returns the edits that would repair every `STALE`
finding — and, like `infer`, writes nothing:

```json
→ {"name":"visimark_fmt","arguments":{"path":"docs/example-invoice-drift.md"}}
← {"command":"fmt","status":"problems","applied":false,
   "edits":[ … ], "sha256":"e3b0c442…", "artifactsWouldWrite":[ … ]}
```

Two details make that response worth reading carefully:

**`applied` is always `false` from this tool**, never omitted and never
`true`. There is a second tool for applying — chapter 13 — and the two never
collapse into one call, so an agent cannot accidentally write by calling the
wrong one with the right arguments.

**`sha256` is the hash of the bytes this plan was computed against.** It
travels with the plan into the apply call, and chapter 14 is entirely about
what happens when it no longer matches.

Both `infer` and `fmt` carry `readOnlyHint: true` in their tool annotation —
planning is not writing, and the annotation says so at the protocol level, not
only in prose.

---

# Part 4 — Turning on writes

## 12. The write gate: two conditions, neither reachable from a tool call

Writes are off unless **both** hold:

1. the server was started with `--allow-write`, **and**
2. the host declared at least one MCP root.

**No roots means no writes, even with the flag.** An operator who passes
`--allow-write` into a host that declares nothing has not chosen where writes
are allowed, and the server refuses to choose for them.

Neither half of that is something a tool call can set. Roots come only from
the MCP protocol itself — the host lists them once the connection completes,
and again whenever it notifies the server the list changed — never from an
argument a model supplies. An agent cannot argue its way past a flag it
cannot pass or a root it cannot declare.

The two apply tools — `visimark_fmt_apply`, `visimark_infer_apply` — are
**listed even when writes are disabled.** Calling one with the gate shut
returns a tool error, not silence:

```
writes are disabled. Start the server with --allow-write.
```

Listed-and-erroring rather than hidden, so a human looking at the error text
knows exactly what to do about it. Both apply tools carry
`destructiveHint: true` regardless of the gate's state, because the
annotation describes what the tool *is*, not what today's session happens to
allow.

This sits **on top of** a second gate that never turns off: containment in
the document's own directory, and a refusal to overwrite any file that does
not already carry VisiMark's own metadata marker — which is what stops an
artifact write from clobbering a hand-drawn SVG that happens to share a
filename.

## 13. `visimark_fmt_apply` — the plan you already reviewed, and only that plan

`fmt_apply` takes back the exact object `fmt` returned:

```json
→ {"name":"visimark_fmt_apply",
   "arguments":{"path":"docs/example-invoice-drift.md","plan":{ "sha256":"e3b0c442…", … }}}
← {"command":"fmt","applied":true,"changed":true,
   "cellsUpdated":<n>,"anchorsUpdated":<n>}
```

`cellsUpdated` and `anchorsUpdated` match the plan's own counts exactly — the
plan is what gets applied, not a fresh re-derivation of what *should* be
applied. A follow-up `visimark_check` on the same path now reports
`summary.stale: 0`: every number the plan named as stale is fixed. (A
document can carry other finding kinds `fmt` never touches — a cycle, an
unknown name, an unparseable date — so `stale: 0` is not the same claim as
"this document has no problems left".)

Drop the plan's `sha256` before calling apply, and the request is refused as
`USAGE` — a plan is not optional metadata, it is the thing being applied.

## 14. What happens when the file moved under the plan

Apply the same plan twice, or apply it after anything else touched the file:

```
visimark: … changed since this plan was computed
```

That is a `WRITE` fault, and it is the entire reason the split exists. A
`PlannedEdit` carries byte offsets computed against one specific version of
the file; splicing those offsets into a file that has since changed would
corrupt it silently. The digest check refuses instead of guessing.

The apply tools **do not silently re-plan** on a mismatch. That could not go
stale, technically — but it would mean the plan an agent (or a human reading
its call) reviewed is not the one that actually landed, which defeats the
point of separating plan from apply in the first place. A stale plan is an
error to surface, never a difference to paper over.

## 15. Artifacts: what a chart adds to the apply story

A document can declare a `chart`, an SVG rendered from its own sheet's
columns. `fmt`'s plan lists every artifact path it would write
(`artifactsWouldWrite`); `fmt_apply` re-derives the actual bytes from the
digest-proved-identical source, and refuses before touching the document if
any target in that list can no longer be written:

```json
→ … plan.artifactsWouldWrite still lists an SVG the document's chart declares,
    but a plan you edited to say the artifacts array is empty …
← {"code":"WRITE","message":"… was not in the plan"}
```

The document is **left completely unmodified** on that refusal — every
refusal that can be decided before a byte moves is decided first, and then
artifacts are written before the document is spliced, so one rejected target
never leaves half a `fmt` applied. `fmt --no-artifacts` exists on the CLI to
decline writing an artifact from a read-only context; the MCP tools carry no
equivalent flag, because the plan/apply split already gives an agent the
chance to inspect `artifactsWouldWrite` before ever calling apply.

`visimark_infer_apply` takes `visimark_infer`'s result the same way: drop any
proposal you rejected before calling apply, and only the survivors are
inserted. A plan whose every proposal was rejected inserts nothing — and, in
particular, does not mark the document `no-formulas` on your behalf.

---

# Part 5 — What the server teaches the agent

## 16. Resources: the discipline, not only the tool

Six tools tell an agent *how* to ask a question. The resources tell it *why*
the answers matter, and they are read from the installed package's own files
— never fetched over the network at request time.

| URI | Serves |
|---|---|
| `visimark://skill` | the authoring discipline itself — read this one first |
| `visimark://cli-reference` | every command, option, exit code and finding kind |
| `visimark://function-reference` | the builtins |
| `visimark://example/invoice` | a complete worked invoice |
| `visimark://example/drift` | the same invoice after one input changed and nothing derived from it followed |

The highest-value resource here is not any of the four reference documents —
it is the skill. A server that ships `check` without the reasoning behind it
hands an agent a verifier with none of the discipline that makes the verifier
worth anything, chief among them the rule this whole guide keeps repeating in
different words: a passing check is evidence of *agreement*, never evidence
of *derivation*.

That skill text is generated from this repository's own
[`skills/visimark/SKILL.md`](../skills/visimark/SKILL.md) at build time, with
its "Running it" section rewritten for a reader who has the server installed
and not the repository checked out. CI regenerates both the skill and the
reference doc copies the server ships and fails on any diff, so what an agent
reads through `visimark://skill` cannot quietly drift from what this
repository actually teaches.

## 17. Prompts: the two orderings agents get wrong unsupplied

| Name | The ordering it encodes |
|---|---|
| `visimark/take-over` | adopting an existing document: run `infer` first, never hand-author rules for numbers that are already there |
| `visimark/author` | writing a new one: table, then a `vmark` block, then anchors, then prose, then `fmt` — in that order |

Two prompts, deliberately, and not three. A prompt earns its place when it
encodes an ordering an agent reliably gets wrong without it, and VisiMark has
exactly two such orderings. The habit from chapter 4 of [`ci.md`](ci.md) —
change one input on purpose and confirm the document actually reacts — is a
step *inside* both prompts rather than a third prompt of its own, because
splitting it out would let an agent treat it as optional. It is not.

---

# Part 6 — Operating it

## 18. Node, Bun, and which one you are actually running

`visimark-mcp` needs the current Node LTS or newer, or Bun. Both `npm i -g` /
`npx` and `bun add -g` / `bunx` are first-class — this is the same runtime
parity the CLI carries, and for the identical reason: a `bin` entry that
assumed one runtime broke the published command for every user of the other
(issue #29 is the whole story, if you want it).

If you are testing a change to this repository itself rather than the
published package, two things matter that a released install never has to
think about:

```console
$ bun run packages/visimark-mcp/src/main.ts              # read-only
$ bun run packages/visimark-mcp/src/main.ts --allow-write
$ claude mcp add visimark-dev -- bun run "$(pwd)/packages/visimark-mcp/src/main.ts"
```

**`bunx visimark-mcp` and `npx visimark-mcp` both run the published build,
silently.** Neither will tell you that your local edit is not in it — you
will simply be testing last release's server. This is not a corner case
worth memorising for its own sake; it is the single most common way to "fix a
bug" and watch the fix not appear.

## 19. Two version numbers, on purpose

Every tool result's `visimark` field is the **engine** version. The MCP
`initialize` response's `serverInfo.version` is the **server's** version —
`visimark-mcp`'s own `package.json` version, which pins an exact `visimark`
dependency rather than a range. They move in lockstep by release policy — one
tag bumps both — but the envelope is deliberately not widened to carry both
numbers, so nothing downstream has to guess which field means what.

If you ever see a mismatch between what you expected and what a fresh install
reports, it is a version question before it is anything else: which
`visimark-mcp` did you just install, and does `npm view visimark-mcp version`
agree with what `initialize` told you.

## 20. Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| The host shows the server as failed to start | An unrecognised argument was passed | The server refuses before the transport opens; check the host's own log for the usage line on stderr |
| `writes are disabled. Start the server with --allow-write.` | The flag is missing, or the host declared no roots | Both conditions must hold — chapter 12 |
| A write tool's error names a path "outside every declared root" | The document lives outside every root the host declared | Point the host's root at the document's directory, or move the document |
| `… changed since this plan was computed` | The file moved between planning and applying | Call `visimark_fmt` (or `infer`) again and apply the fresh plan — chapter 14 |
| An artifact write is refused with "was not in the plan" or "can no longer be written" | The plan is stale, or something now occupies the artifact's path | Re-plan; if a real file already sits there, it is not VisiMark's to overwrite |
| A `visimark_check` call with findings looks like "the server is broken" | Findings are a **successful** call, not an error | Read `status`, not whether the call threw — chapter 6 and 8 |
| `bunx`/`npx` seems to ignore a local change | It ran the published package, not your working tree | Use `bun run packages/visimark-mcp/src/main.ts` from the repo instead — chapter 18 |
| The engine version in a result is not what you expected | The installed `visimark-mcp` pins an older engine | Check `npm view visimark-mcp@<version> dependencies.visimark`, or reinstall the version you meant |

If a failure is genuinely confusing, the handshake script from chapter 5
reproduces the exact exchange CI itself uses to prove a release actually
speaks the protocol — run it against your own installed binary before
suspecting the host.

### Where to go next

| Document | What it answers |
|---|---|
| [`mcp.md`](mcp.md) | The complete reference: every tool, every fault code, the full write-gate contract |
| [`ci.md`](ci.md) | The CI gate this server does not replace |
| [`tutorial.md`](tutorial.md) | The VisiMark language itself |
| [`cli-reference.md`](cli-reference.md) | The CLI this server wraps, command by command |
| [`example-invoice-drift.md`](example-invoice-drift.md) | The document behind every drifted example in this guide, walked through by hand |

<!--vmark:no-formulas-->
