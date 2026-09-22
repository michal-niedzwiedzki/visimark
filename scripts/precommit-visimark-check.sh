#!/bin/sh
# Dispatch for the visimark pre-commit hook. Tries an already-on-PATH
# `visimark` first (so this repo's own workspace build, and any consumer who
# installed visimark globally, is used straight rather than re-fetched), then
# Bun's bunx, then npm's npx. Both fetcher branches pin the same version so a
# consumer's `rev:` pin stays coherent with the engine it runs — see
# docs/design/pre-commit-hook-spec.md §5. Referenced by both
# .pre-commit-hooks.yaml (the published hook) and .pre-commit-config.yaml
# (this repo's own dogfood config) — keep it as the one place the version is
# written.
if command -v visimark >/dev/null 2>&1; then
  exec visimark check "$@"
elif command -v bunx >/dev/null 2>&1; then
  exec bunx visimark@0.1.7 check "$@"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes visimark@0.1.7 check "$@"
else
  echo "visimark: needs npx (Node) or bunx (Bun) on PATH" >&2
  exit 127
fi
