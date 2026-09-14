# VisiMark (agent skill)

This is the agent skill that teaches an AI coding assistant to write and
verify `vmark` arithmetic in Markdown documents instead of computing numbers
by hand. `SKILL.md` is the whole skill — plain Markdown, so it works with any
agent that supports skills.

## Installation

Install with the [Skills CLI](https://skills.sh):

```bash
npx skills add michal-niedzwiedzki/visimark
```

Add `-g`/`--global` to install it for every project instead of just the
current one, or `-a '*'`/`--agent '*'` to push it to every agent you have
configured (Claude, Grok, etc.) in one go.

For a manual install, copy `SKILL.md` into the agent's skill folder:

```bash
cp -r skills/visimark ~/.claude/skills/visimark
```

## What it does

See [`SKILL.md`](SKILL.md) for the full skill. In short: it makes an agent
run `visimark infer` before hand-authoring rules for a document with existing
numbers, refuse to report a document "checked" until it has proven the
formulas are actually derived (not just internally consistent), and never
hand-edit a computed cell or anchored value.
