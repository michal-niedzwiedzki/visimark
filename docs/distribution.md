# Where VisiMark is listed

VisiMark ships five separate published artifacts (the `visimark` CLI/library,
two lint-rule plugins, the MCP server, the VS Code extension, and the
Obsidian plugin). Each artifact has its own set of registries and
third-party directories it can appear in. This page is the one place that
tracks, per artifact, what is **automatic** (fed by `release.yml` on every
tag, per [`docs/releasing.md`](releasing.md)), what is a **one-time manual
submission** that has been done, and what is **prepared but not yet sent**.

Update this table whenever a submission is sent, a listing goes live, or a
directory is ruled out — this is the durable record; scratch research files
under `docs/WIP/` are not (several are gitignored and session-local).

## `visimark` (npm)

| Where | Status | Notes |
|---|---|---|
| [npmjs.com/package/visimark](https://www.npmjs.com/package/visimark) | **Live**, automatic | Published with provenance on every tag; see [`docs/releasing.md`](releasing.md#what-one-tag-publishes). |

## `remark-lint-visimark` (npm)

| Where | Status | Notes |
|---|---|---|
| [npmjs.com/package/remark-lint-visimark](https://www.npmjs.com/package/remark-lint-visimark) | **Live**, automatic | Same release leg as above. |
| unifiedjs/remark plugin list | Not researched | No submission prepared yet. |

## `markdownlint-rule-visimark` (npm)

| Where | Status | Notes |
|---|---|---|
| [npmjs.com/package/markdownlint-rule-visimark](https://www.npmjs.com/package/markdownlint-rule-visimark) | **Live**, automatic | Same release leg as above. |
| DavidAnson/markdownlint custom-rules list | Not researched | No submission prepared yet. |

## `visimark-mcp` (npm + MCP directories)

| Where | Status | Notes |
|---|---|---|
| [npmjs.com/package/visimark-mcp](https://www.npmjs.com/package/visimark-mcp) | **Live**, automatic | Same release leg as above. |
| [Official MCP registry](https://registry.modelcontextprotocol.io) (`io.github.michal-niedzwiedzki/visimark`) | **Live**, automatic | Fed from `server.json` on tagged release; see [`docs/releasing.md`](releasing.md#what-one-tag-publishes). |
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | **PR open**, 2026-09-29 | [PR #15330](https://github.com/punkpeye/awesome-mcp-servers/pull/15330), awaiting merge. A bot comment made a Glama listing (next row) a hard requirement to merge, not just a nice-to-have; a second commit (`a64adf3`) added the required Glama score badge. |
| [Glama](https://glama.ai/mcp/servers) | **Live**, 2026-09-29 | Listed at <https://glama.ai/mcp/servers/michal-niedzwiedzki/visimark> (score still calculating as of publish, badge already resolves). Submitted via the web form ("Add MCP Server"). Glama's submission wizard auto-generates a Dockerfile that `git clone`s the monorepo at the pinned commit and never builds it — broken for this Bun workspace (the wizard installs pnpm, not Bun, and the dist the server needs is gitignored). Fixed by pasting in a Dockerfile that installs the already-published npm package and wraps it with `mcp-proxy`, the same way a real `npx visimark-mcp` user would run it; verified end-to-end locally (`docker build` + `docker run` + `docker logs` showing a completed `initialize` handshake) before pasting into Glama's Admin UI. Worth remembering for any future Docker-based directory submission for this package. |
| [mcp.so](https://mcp.so/submit?type=server) | Prepared, not sent | Manual web form (repo URL, name, description, tool count, transport, homepage, icon). Maintainer asked to hold this until rows above land. |
| [Cursor directory](https://cursor.directory/plugins/visimark) | **Live**, 2026-09-29 | Manual web form, submitted directly by the maintainer. Not MCP-only: the listing bundles four components — MCP server (`visimark-mcp`), the `visimark` Skill (auto-picked up from `.agents/skills/visimark`), a `/visimark-check` Command, and a Stop Hook — the last two added in [PR #303](https://github.com/michal-niedzwiedzki/visimark/pull/303) (`.agents/commands/visimark-check.md`, `.agents/hooks/visimark-check.sh`) specifically for this submission. |
| [Smithery](https://smithery.ai/new) | Not sent | OAuth-gated web form behind the maintainer's own login; no `smithery.yaml` needed (local stdio transport only). |
| [PulseMCP](https://www.pulsemcp.com/servers) | Not applicable right now | Submissions site-wide are paused; PulseMCP's own guidance is to rely on the official registry (already done) until they reopen. |
| [OpenTools](https://opentools.com/registry) | Not applicable | Project's CLI/tooling side is retired; it points new servers at the official MCP registry, already covered. |
| [mcpservers.org](https://mcpservers.org) | Unknown | Returned HTTP 403 to automated checks; reported elsewhere to mirror `awesome-mcp-servers`, unverified first-hand. |

Checked and ruled out: a distinct public "agent skill" marketplace, separate
from the MCP directories above, did not turn up in the research behind this
table — VisiMark's own `.agents/skills/` is in-repo skill delivery, not a
public marketplace listing. **awesome-remote-mcp-servers** (punkpeye's
sibling list) is out of scope too: it's for remote/hosted-URL-only servers
with no installable package, and `visimark-mcp` ships an installable npm
package with a stdio transport, so it belongs in `awesome-mcp-servers`
above, not that list.

## `visimark-vscode` (VS Code extension)

| Where | Status | Notes |
|---|---|---|
| [VS Code Marketplace](https://marketplace.visualstudio.com/) (`visimark-michal-niedzwiedzki.visimark-vscode`) | **Live**, automatic | Published by `release.yml` on every tag; see [`docs/releasing.md`](releasing.md#what-one-tag-publishes). |
| [Open VSX](https://open-vsx.org/) | **Live**, automatic | Same release leg; namespace created on first publish if missing. |

## VisiMark (Obsidian plugin)

| Where | Status | Notes |
|---|---|---|
| [community.obsidian.md](https://community.obsidian.md/account/plugins/visimark) | **Submitted and listed** | Confirmed 2026-09-29. One-time manual submission through the portal (PRs to `obsidianmd/obsidian-releases` are disabled); see [`docs/releasing.md`](releasing.md#submitting-to-the-community-registry) for the submission mechanics and what the scanner checks. Review feedback is answered by publishing a new plugin release, not by re-submitting. |

## Adding a new directory

When a new artifact ships, or a new directory is found for an existing one:

1. Research it thoroughly — URL, submission method, what metadata it wants,
   whether it's actively maintained — before sending anything.
2. Prepare submission material in the session scratchpad; get explicit
   maintainer sign-off before firing a PR, form, or comment to a third party.
3. Once sent, add or update the row here immediately, with the date and a
   link to the PR/listing.
