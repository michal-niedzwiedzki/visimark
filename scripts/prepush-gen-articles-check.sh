#!/bin/sh
# Pre-push hook: regenerate docs/articles.html and docs/articles/**/index.html
# from docs/articles/articles.json, and likewise docs/examples.html and
# docs/examples/**/index.html from docs/examples/examples.json before the push leaves this machine. CI's
# `articles-pages` job (ci.yml) enforces the same invariant server-side, but
# by then it's a red check and a round trip; this catches it locally instead.
#
# If regeneration produces a diff, it is committed on the current branch and
# the push is refused so the fix travels with it — run `git push` again.
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"

bun run gen:articles >/dev/null
bun run gen:examples >/dev/null

# Scoped to the generated outputs only, not the docs/articles/ tree in
# general — a dirty *source* file (an in-progress article edit, say) must not
# be mistaken for stale output, staged, and swept into this commit.
#
# `set --` (not a shell variable) so the glob reaches git unexpanded: a
# shell-expanded glob only matches files that still exist, so a deleted
# stale page (gen-articles.ts prunes dropped slugs) would silently vanish
# from both the status check and the commit. Quoted here, git's own
# pathspec glob still matches the deletion.
set -- docs/articles.html 'docs/articles/*/index.html' docs/examples.html 'docs/examples/*/index.html'

if [ -n "$(git status --porcelain -- "$@")" ]; then
  # `add` before `commit --only`: a brand-new page is untracked, and
  # `--only` commits already-tracked or already-staged content at these
  # paths — it won't pick up a path git has never seen before.
  git add -- "$@"
  # `commit --only` takes these paths' content and commits it regardless of
  # anything else staged, so a contributor's own staged (but unrelated)
  # changes are left exactly as they were, still staged.
  git commit --only -m "build: regenerate article pages" -- "$@" >/dev/null
  echo "gen:articles: article pages were stale; regenerated and committed. Re-run git push." >&2
  exit 1
fi
