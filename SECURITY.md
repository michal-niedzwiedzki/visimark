# Security policy

## Supported versions

VisiMark is pre-1.0. Only the latest release receives security fixes. Older
versions do not. There are two release lines:

- **Core** (`vX.Y.Z` tags): the npm packages, the `visimark-mcp` entry in the
  official MCP registry, and the VS Code extension on the Marketplace and Open
  VSX.
- **The Obsidian plugin** (tags without a `v`, such as `0.3.0`), released on
  its own schedule through the Obsidian community plugin directory.

## Reporting a vulnerability

Report privately through GitHub's
[private vulnerability reporting](https://github.com/michal-niedzwiedzki/visimark/security/advisories/new)
— do not open a public issue for a suspected vulnerability.

If that is unavailable, email <michal@epsi.pl> with `VisiMark security` in the
subject.

Please include what you were doing, what happened, and a Markdown document or
command that reproduces it. Expect an acknowledgement within a week. Once a fix
is released the advisory is published with credit unless you ask otherwise.

## Scope

VisiMark reads Markdown files and evaluates the formulas written in their
`vmark` blocks. A document that causes `visimark` to execute code outside that
evaluator, read or write files it was not asked to, or hang the process on
input of a reasonable size is in scope. A formula that merely produces a wrong
number is a correctness bug — open a normal issue.

### Expression depth

A formula's nesting is bounded at parse time. Five recursive walkers descend
whatever the parser returns — the evaluator, the model builder, the reporter
and two more — so an expression deep enough to exhaust the stack used to end
the process with an uncaught `RangeError` rather than report anything, and
under `visimark-lsp` it ended the server for every open file, not just the one.
An expression past the bound is now refused like any other parse error: a
positioned finding, a normal exit code. The bound is two orders of magnitude
above the deepest formula in this repository's own documents, so no document a
person would write comes near it.

That covers stack exhaustion only. A document that exhausts *memory* or runs
for an unreasonable time is still in scope and still worth reporting.

### Concurrent local processes

A document states where its chart artifact is written and where its imported
CSV is read, so both paths are checked for legality and containment before
use, and both are then opened without following a symlink at the final path
component: an artifact that was expected to be absent is created with `O_EXCL`,
and one that was expected to be ours has its `<visimark/>` marker re-read
through the same descriptor the new bytes are written into. A target swapped
between the check and the write is refused rather than followed.

What remains open is narrower and out of scope. `O_NOFOLLOW` guards the final
component only, so another local process able to replace an *intermediate
directory* with a symlink during the run can still redirect the open; closing
that needs `openat` per component, which Node does not expose. A hardlink is
not a symlink and passes both flags, though the marker check catches all but a
link to an artifact VisiMark generated itself. Neither is reachable from a
document — both require a concurrent process that already has write access to
the working directory, which on a local developer CLI has easier paths to
harm. This would change if VisiMark ran as a long-lived service or in a CI
workspace shared with untrusted jobs; a report on that footing is in scope.

## Hosts other than the CLI

### The MCP server

`visimark-mcp` takes its arguments from an agent, and an agent can be
prompt-injected, so a tool argument is treated as untrusted.

- **Writes** go through a gate no tool argument can reach. The server writes
  nothing unless the operator started it with `--allow-write` **and** the host
  declared at least one MCP root, and then only inside those roots, on top of
  the engine's own artifact containment and marker check. A write outside a
  declared root, or any write with the gate closed, is in scope.
- **Reads are not contained.** A read tool given a `path` reads whatever the
  server's process can read, and its findings and `explain` view echo text
  from that file. That is the documented behaviour
  ([`docs/mcp.md`](docs/mcp.md#the-write-gate)), not a vulnerability: run the
  server as a user that should be able to read what the agent asks for.

### The language server and the editor plugins

`visimark-lsp` runs inside the editor for every open Markdown file, so a
document that crashes or hangs it is in scope the same way it is for the CLI,
and more urgently: it takes diagnostics away from every open file at once. The
Obsidian, Joplin and CodeMirror integrations evaluate documents in the editor
process, with the same scope.

The VS Code setting `visimark.server.path` names a file the extension runs as
its language server. It is a user-only (`machine`-scoped) setting, ignored in
Restricted Mode, so a workspace's `.vscode/settings.json` cannot set it. A way
for a repository to choose what the extension executes is in scope.
