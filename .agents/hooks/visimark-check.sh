#!/usr/bin/env bash
# Stop hook: verify every vmark block in the Markdown files a session changed
# still holds — a formula and the number it produced can't legally drift
# apart. Runs `visimark check` once at the end of a session, only on changed
# .md files, never on the whole repo. Advisory, not blocking: it surfaces
# findings via systemMessage rather than sending the agent back, matching
# format-and-lint.sh's stance that per-edit interruption is too noisy. To make
# it blocking instead, exit 2 in the failure branch below (see your host's
# hook docs for what a blocking exit does with the message).
#
# Requires the `visimark` CLI; npx/bunx resolves it on demand, no install
# needed. Canonical path in this repo: .agents/hooks/visimark-check.sh, wired
# from .claude/settings.json. Drop this file (and a matching hook-config
# entry) into any project that authors vmark blocks — it does not depend on
# anything else in this repo.
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root" || exit 0

# Changed (not deleted) tracked files + new untracked files, Markdown only.
files=()
while IFS= read -r f; do [ -n "$f" ] && [ -f "$f" ] && files+=("$f"); done < <(
  {
    git diff --name-only --diff-filter=d HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | grep -E '\.md$' | sort -u
)
[ ${#files[@]} -gt 0 ] || exit 0

runner=npx
command -v bunx >/dev/null 2>&1 && runner=bunx

output="$("$runner" -y visimark check "${files[@]}" 2>&1)" && exit 0

jq -n --arg msg "visimark check found a formula/number mismatch in changed Markdown:"$'\n'"${output}" \
  '{systemMessage: $msg}'
