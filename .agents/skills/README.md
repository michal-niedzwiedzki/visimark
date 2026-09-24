# Skills

Real skill directories live here. `.claude/skills/<name>` and
`.grok/skills/<name>` are per-skill symlinks back into this directory, which is
how Claude Code and Grok discover them — see [`AGENTS.md`](../../AGENTS.md).
**A skill with no symlink exists in the tree but is not offered to either
agent.**

[`skills-lock.json`](../../skills-lock.json) at the repository root records the
source and content hash of every skill installed with the `skills` CLI, and
`bunx skills experimental_install` restores them from it. A skill absent from
the lockfile is written here by hand and has no upstream.

| Skill | In the lockfile | Shimmed for |
|---|---|---|
| `humanizer` | `blader/humanizer` | Claude, Grok |
| `gh-stack` | `github/gh-stack` | — |
| `using-git-worktrees` | `obra/superpowers` | — |
| `iterate-pr` | local | — |
| `obsidian-markdown` | `kepano/obsidian-skills` | Claude, Grok |
| `obsidian-bases` | `kepano/obsidian-skills` | Claude, Grok |
| `obsidian-cli` | `kepano/obsidian-skills` | Claude, Grok |
| `obsidian` | `gapmiss/obsidian-plugin-skill` | Claude, Grok |

## The four Obsidian skills

Chosen in [#176](https://github.com/michal-niedzwiedzki/visimark/issues/176) on
source and adoption rather than search rank, as reference material for the
Obsidian plugin ([`docs/design/obsidian-plugin-spec.md`](../../docs/design/obsidian-plugin-spec.md)).
The lockfile says where each came from; this says why.

| Skill | Why |
|---|---|
| `obsidian-markdown` | Obsidian's Markdown dialect — callouts, embeds, properties. Written by Obsidian's CEO; as close to normative as this gets, and [constraint 1](../../docs/visimark-design.md#2-constraints-that-shaped-the-design) makes "what does Obsidian actually do with this file" a question that deserves an authority. |
| `obsidian-bases` | Bases syntax and its function reference. Needed to hold the line between Bases's job and ours, and required before v2 row 20 can be designed honestly. |
| `obsidian-cli` | Driving a vault from outside — a partial answer to [§16](../../docs/visimark-design.md#16-renderer-verification)'s "not scriptable in this environment", which is why the Obsidian renderer check had to be run by hand. |
| `obsidian` | Plugin *development*: CSS, memory management, type safety, file operations, accessibility, and the community-plugin submission review. A reference, not an authority — small repo. |

Both upstream repositories are MIT. The four directories are left exactly as
the `skills` CLI installs them — nothing here is hand-edited, so an update is a
clean diff and the lockfile's hash stays meaningful.

**Not brought over** from `gapmiss/obsidian-plugin-skill`: its `create-plugin`
slash command and `tools/create-plugin.js` boilerplate generator.
`editors/obsidian` is a workspace inside an existing monorepo, not a new
standalone plugin repository, so the generator produces the wrong shape. The
`SKILL.md` section pointing at it is upstream text and is left unedited.

<!--vmark:no-formulas-->
