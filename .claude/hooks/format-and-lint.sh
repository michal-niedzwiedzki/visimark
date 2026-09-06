#!/usr/bin/env bash
# Stop hook: once Claude finishes a batch of work, format every changed JS/TS
# file with oxfmt and run `oxlint --fix` over them. Anything oxlint still flags
# is surfaced to the user. This never blocks and never sends Claude back —
# formatting between individual edits was too noisy, so it runs once at the end.
#
# Wired up in .claude/settings.json. Mirrors `bun run format` / `bun run lint`,
# scoped to the files that changed this session.
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root" || exit 0

# Changed (not deleted) tracked files + new untracked files, JS/TS only.
files=()
while IFS= read -r f; do [ -n "$f" ] && [ -f "$f" ] && files+=("$f"); done < <(
  {
    git diff --name-only --diff-filter=d HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$' | sort -u
)
[ ${#files[@]} -gt 0 ] || exit 0

oxfmt="$root/node_modules/.bin/oxfmt"
[ -x "$oxfmt" ] || oxfmt="oxfmt"
oxlint="$root/node_modules/.bin/oxlint"
[ -x "$oxlint" ] || oxlint="oxlint"

"$oxfmt" --write "${files[@]}" >/dev/null 2>&1 || true
lint="$("$oxlint" --fix "${files[@]}" 2>&1 || true)"

if [ -n "$lint" ]; then
  jq -n --arg msg "oxfmt formatted the changed files; oxlint --fix ran. Remaining oxlint findings:"$'\n'"${lint}" \
    '{systemMessage: $msg}'
fi
