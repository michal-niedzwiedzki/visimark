#!/bin/sh
# Pre-push hook: regenerate docs/articles.html and docs/articles/**/index.html
# from docs/articles/articles.json before the push leaves this machine. CI's
# `articles-pages` job (ci.yml) enforces the same invariant server-side, but
# by then it's a red check and a round trip; this catches it locally instead.
#
# If regeneration produces a diff, it is committed on the current branch and
# the push is refused so the fix travels with it — run `git push` again.
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"

bun run gen:articles >/dev/null

# Scoped to the generated outputs only, not the docs/articles/ tree in
# general — a dirty *source* file (an in-progress article edit, say) must not
# be mistaken for stale output, staged, and swept into this commit.
outputs="docs/articles.html docs/articles/*/index.html"

# shellcheck disable=SC2086
if [ -n "$(git status --porcelain -- $outputs)" ]; then
  # `commit --only` takes these paths' working-tree content and commits it
  # regardless of anything else staged, so a contributor's own staged (but
  # unrelated) changes are left exactly as they were, still staged.
  # shellcheck disable=SC2086
  git commit --only -m "build: regenerate article pages" -- $outputs >/dev/null
  echo "gen:articles: article pages were stale; regenerated and committed. Re-run git push." >&2
  exit 1
fi
