---
description: Attribute every AI-authored git commit and PR to the agent that actually wrote it
alwaysApply: true
---

# AI attribution

Every commit, PR body, and public comment this session produces must name the
agent that actually wrote it. A prompt file, plan, or earlier commit that
says `Claude` is not a reason to stamp Claude on Grok's work, or the reverse.

**Git Author** stays the maintainer's configured identity (GPG-signed). Never
set `GIT_AUTHOR_*` to the AI.

**`Co-Authored-By`** is how the AI is credited. Use exactly one trailer, for
this session:

| This session is | Trailer |
|---|---|
| Claude (Anthropic / Claude Code) | `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` |
| Grok (xAI) | `Co-Authored-By: Grok 4.6 <grok@x.ai>` |

If the model name you are running is different (a newer Claude, a different
Grok), keep the vendor and put the real model name in the token. Do not invent
a third vendor. Do not copy a trailer out of a command file, an old plan, or
a previous commit.

**PR bodies.** Do not append `Generated with Claude Code` unless this session
is Claude Code. Do not append a Grok equivalent unless this session is Grok.
When unsure, omit the footer; the commit trailer is the record.

**Issue comments.** The `/issue-review` pre-review keeps the first-line token
`**Automated pre-review**`. Do not write "analysis by Claude" or "analysis by
Grok" unless that is this session.

**Plans.** A new implementation plan's Global Constraints point at this rule.
They do not paste a vendor name. Historical plans that already name Claude
are a record of who wrote those commits; leave them.

Commands that used to hardcode a Claude trailer (`/issue-review`,
`/issue-decide`) resolve the trailer from this table at commit time.
