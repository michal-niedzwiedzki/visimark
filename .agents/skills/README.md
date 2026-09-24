# Skills

Real skill directories live here. `.claude/skills/<name>` and
`.grok/skills/<name>` are per-skill symlinks back into this directory, which is
how Claude Code and Grok discover them — see [`AGENTS.md`](../../AGENTS.md).
Every skill here gets both symlinks, so Claude's and Grok's skillsets stay
uniform; a skill that should reach only one agent doesn't belong in this
directory. `visimark` is the one exception in source, not in shimming: it's a
symlink to [`skills/visimark`](../../skills/visimark), the package's own
published skill, so there is one copy of its content, not a fork — it still
gets the same `.claude`/`.grok` symlinks as everything else.

[`skills-lock.json`](../../skills-lock.json) at the repository root records the
source and content hash of every skill installed with the `skills` CLI, and
`bunx skills experimental_install` restores them from it. A skill absent from
the lockfile is written here by hand and has no upstream.

| Skill | In the lockfile |
|---|---|
| `code-review` | `coderabbitai/skills` |
| `gh-stack` | `github/gh-stack` |
| `humanizer` | `blader/humanizer` |
| `i-have-adhd` | `ayghri/i-have-adhd` |
| `iterate-pr` | `getsentry/skills` |
| `karpathy-guidelines` | `szkocot/andrej-karpathy-skills` |
| `using-git-worktrees` | `obra/superpowers` |
| `obsidian-markdown` | `kepano/obsidian-skills` |
| `obsidian-bases` | `kepano/obsidian-skills` |
| `obsidian-cli` | `kepano/obsidian-skills` |
| `obsidian` | `gapmiss/obsidian-plugin-skill` |
| `visimark` | local ([`skills/visimark`](../../skills/visimark)) |

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
