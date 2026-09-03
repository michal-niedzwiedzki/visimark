# Handoff — starting the VS Code plugin

## Where things stand

The engine is built and green: `visimark check`, `fmt`, `eval`, `explain`, 91
tests, both worked examples passing as the acceptance suite. Nothing about the
editor work has been implemented — only specified.

**The route is Plan A, then Plan B.** The goal is the VS Code plugin, but the
first commit belongs to the engine amendments — see the next section.

Everything below is on `master`, merged and unpushed.

| Artifact | Path |
|---|---|
| Engine spec (normative) | `doc/visimark-design.md` |
| Plugin spec (normative) | `doc/visimark-editor-plugins-design.md` |
| Plan A — engine amendments | `docs/superpowers/plans/2026-09-03-visimark-dup-units-spans.md` |
| Plan B — the plugins | `docs/superpowers/plans/2026-09-03-visimark-editor-plugins.md` |
| Agent skill | `skills/visimark/SKILL.md` |

## Read this first: run Plan A to completion, then Plan B

**Do not start Plan B until Plan A is finished and green.** Plan B is written
against the engine Plan A leaves behind, and depends on it in two ways:

- Plan B publishes diagnostics, and a diagnostic needs a range. Today only
  `UNDEF`, `VECTOR` and `ANCHOR` carry an offset. Plan A **Task 1** puts a
  `span` on every finding.
- Plan B's code assumes `DUP` and `UNIT` exist — a severity map that lists
  them, and an `applyUnit(...)` call inside `planFmt`. Those come from Plan A
  tasks 2–6.

Plan A is six mechanical tasks over code that already exists, and it is guarded
throughout by the acceptance suite below. Finish it first. Splitting it — doing
Task 1 alone to unblock the server sooner — means editing Plan B's samples
mid-flight and doing engine surgery twice, once before the workspace move and
once after.

## Starting

```bash
cd /home/michal/Projects/visimark
git status                      # expect clean, on master
bun test                        # expect 91 pass
git switch -c feat/dup-units-spans
```

Then invoke `superpowers:subagent-driven-development` (or
`superpowers:executing-plans`) on **Plan A**. Both plans are task-by-task with
checkboxes, real code in every step, and a commit at the end of each task.

When Plan A is done — full suite green, `typecheck` clean, the transcript
unchanged — merge it, branch again, and run Plan B the same way. Work on a
branch each time; `master` is the default branch and the plans commit
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
