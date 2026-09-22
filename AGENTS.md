# Agent instructions

Harness-neutral project config lives in [`.agents/`](.agents/):

| Path | What it is |
|------|------------|
| [`.agents/rules/`](.agents/rules/) | Always-on rules: [`ai-attribution.md`](.agents/rules/ai-attribution.md), [`runtime-parity.md`](.agents/rules/runtime-parity.md). |
| [`.agents/skills/`](.agents/skills/) | Skills (Codex, Grok, and Claude via a shim) |
| [`.agents/commands/`](.agents/commands/) | Slash commands (`issue-review`, `issue-decide`, `issue-discuss`) |
| [`.agents/hooks/`](.agents/hooks/) | Stop-hook scripts |

`.claude/` and `.grok/` are shims so Claude Code and Grok still discover the same files. Do not add a second copy of a rule, skill, command, or hook there.

Grok does not scan `.agents/rules/` itself. Attribution reaches Grok through `.claude/rules` (a symlink, loaded under Claude compatibility). Codex gets this file plus the pointer above; follow the linked rule on every commit, PR, and public comment.
