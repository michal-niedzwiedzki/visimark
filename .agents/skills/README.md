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
| `visimark` | local ([`skills/visimark`](../../skills/visimark)) |

<!--vmark:no-formulas-->
