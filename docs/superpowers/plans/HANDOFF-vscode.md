# Handoff — starting the VS Code plugin

## Where things stand

The engine is built and green: `visimark check`, `fmt`, `eval`, `explain`, 91
tests, both worked examples passing as the acceptance suite. Nothing about the
editor work has been implemented — only specified.

Everything below is on `master`, merged and unpushed.

| Artifact | Path |
|---|---|
| Engine spec (normative) | `doc/visimark-design.md` |
| Plugin spec (normative) | `doc/visimark-editor-plugins-design.md` |
| Plan A — engine amendments | `docs/superpowers/plans/2026-09-03-visimark-dup-units-spans.md` |
| Plan B — the plugins | `docs/superpowers/plans/2026-09-03-visimark-editor-plugins.md` |
| Agent skill | `skills/visimark/SKILL.md` |

## Read this first: Plan A comes before Plan B

**Plan B assumes Plan A is complete.** Two reasons, one hard and one soft:

- **Hard:** Plan B needs every `Finding` to carry a `span`. Today only `UNDEF`,
  `VECTOR` and `ANCHOR` carry an offset, and a diagnostic without a range
  cannot be published. That is Plan A **Task 1** — one task, purely additive,
  no behaviour change.
- **Soft:** Plan B's code samples assume `DUP` and `UNIT` exist (Plan A tasks
  2–6). Skipping them leaves a severity map with entries that never fire and
  one `applyUnit(...)` call in `planFmt` that has to become plain
  `showValue(...)`.

If you want the plugin moving today, do Plan A Task 1 and nothing else, then
start Plan B and adjust those two spots. Otherwise run Plan A end to end first
— it is six mechanical tasks and leaves the engine in the shape Plan B expects.

## Starting

```bash
cd /home/michal/Projects/visimark
git status                      # expect clean, on master
bun test                        # expect 91 pass
```

Then invoke `superpowers:subagent-driven-development` (or
`superpowers:executing-plans`) on the chosen plan. Both plans are task-by-task
with checkboxes, real code in every step, and a commit at the end of each task.

Work on a branch. `master` is the default branch and the plans commit
frequently.

## The invariant that governs both plans

`check doc/example-invoice.md` → zero findings. `fmt` on it → byte-for-byte
identical. `check doc/example-invoice-drift.md` → output equal to the fenced
`console` block inside that file, 26 problems, exit 1.

Neither `DUP` nor `UNIT` may fire on either example, and the monorepo move must
not change engine source beyond import paths. **If the transcript test fails,
the change is wrong — do not edit the example documents.**

## Three things that will bite

1. **Offsets are UTF-16 code units,** not bytes. mdast positions,
   `String.prototype.slice` and `TextDocument.positionAt` all agree already.
   Do not "fix" this toward bytes.

2. **`fmt` is the only write path, and it never runs on its own.** Format
   Document, the editor's own `editor.formatOnSave`, the fix-all action, an
   explicit command. Never on type, never on idle. The staleness that
   auto-formatting would erase is the signal the project exists to surface.

3. **A green `check` is not evidence.** It reports `0 problems` on a document
   containing no formulas at all. When verifying anything by hand, change an
   input and confirm the checker starts complaining. This is also the core of
   `skills/visimark/SKILL.md`, and it is how a real CLI bug was caught — the
   README's own `bun src/cli/main.ts check FILE` silently exited 0 until an
   `import.meta.main` guard was added.

## Open items, deliberately deferred

- `editors/vscode/icon.png` does not exist. `vsce package` fails without it, so
  Plan B Task 10 must resolve it before Task 11 can run.
- `release.yml` needs three repository secrets: `NPM_TOKEN`, `VSCE_PAT`,
  `OVSX_PAT`. Nothing is published until a `vX.Y.Z` tag is pushed.
- The repository URL in `editors/vscode/package.json` is a placeholder
  (`OWNER`). Fix it before publishing.
- No editor client other than VS Code. The server is built to be shared;
  Neovim, Zed and Helix are a later PR each.
