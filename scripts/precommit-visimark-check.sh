#!/bin/sh
# Dispatch for the visimark pre-commit hook. Runs the pinned engine: an
# already-on-PATH `visimark` when it reports exactly the pinned version (so
# this repo's own workspace build, and a consumer's matching global install,
# is used straight rather than re-fetched), else Bun's bunx, else npm's npx.
# A `visimark` on PATH at any other version is passed over: an old global
# install must not stand in for the engine a consumer's `rev:` pins — see
# docs/design/pre-commit-hook-spec.md §5. Referenced by both
# .pre-commit-hooks.yaml (the published hook) and .pre-commit-config.yaml
# (this repo's own dogfood config) — keep `pinned` as the one place the
# version is written.
pinned=0.4.0
if command -v visimark >/dev/null 2>&1 &&
  [ "$(visimark --version 2>/dev/null)" = "visimark $pinned" ]; then
  exec visimark check "$@"
elif command -v bunx >/dev/null 2>&1; then
  exec bunx "visimark@$pinned" check "$@"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes "visimark@$pinned" check "$@"
else
  echo "visimark: needs npx (Node) or bunx (Bun) on PATH" >&2
  exit 127
fi
