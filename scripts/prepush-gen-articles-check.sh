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

if [ -n "$(git status --porcelain -- docs/articles.html docs/articles/)" ]; then
  git add docs/articles.html docs/articles/
  git commit -m "build: regenerate article pages" >/dev/null
  echo "gen:articles: article pages were stale; regenerated and committed. Re-run git push." >&2
  exit 1
fi
