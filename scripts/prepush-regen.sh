#!/bin/sh
# Pre-push hook: run a generator, and if it changed any of its committed
# outputs, commit them on the current branch and refuse the push so the fix
# travels with it — run `git push` again. Same behaviour as
# prepush-gen-articles-check.sh, parameterised so each generated artefact
# CI diffs (`playground-bundle`, `generated-docs`, `mcp-resources`) has a
# local twin. CI stays the authority; this saves the red check and round trip.
#
#   prepush-regen.sh [--pin-bun] <commit message> <command> <pathspec>...
#
# --pin-bun: the output depends on the minifier, so only regenerate when the
# local Bun is the one `packageManager` pins. Otherwise skip with a note,
# rather than commit churn that has nothing to do with the change.
#
# Pathspecs are quoted by the caller so git's own glob matches deleted
# files too, and scoped to the generated outputs only: a dirty *source* file
# must never be mistaken for stale output and swept into the commit.
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"

pin=0
if [ "${1:-}" = "--pin-bun" ]; then
  pin=1
  shift
fi
msg="$1"
cmd="$2"
shift 2

if [ "$pin" = 1 ]; then
  want="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json)"
  have="$(bun --version)"
  if [ "$want" != "$have" ]; then
    echo "$msg: skipped — local Bun is $have, packageManager pins $want (CI will check it)." >&2
    exit 0
  fi
fi

sh -c "$cmd" >/dev/null

if [ -n "$(git status --porcelain -- "$@")" ]; then
  # `add` first: a brand-new output is untracked and `--only` would not see it.
  git add -- "$@"
  # `--only` leaves any other staged work exactly as it was.
  git commit --only -m "$msg" -- "$@" >/dev/null
  echo "$msg: outputs were stale; regenerated and committed. Re-run git push." >&2
  exit 1
fi
