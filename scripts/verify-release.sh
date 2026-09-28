#!/usr/bin/env bash
# Asks every registry whether a core release really landed.
#
# Usage: scripts/verify-release.sh vX.Y.Z
#
# release.yml's last step asserts the versions are listed. This also checks
# what it does not: the npm provenance attestations, the GitHub Release, and
# that the published MCP server actually starts, from the registry, under each
# runtime present. It needs only curl, gh and node or Bun. Run it after the release run goes green; see
# docs/releasing.md ("Verify every leg"). Read-only: it publishes nothing.
# Exits 0 when every check passes, 1 otherwise, 2 on usage.
set -uo pipefail

if [ $# -ne 1 ] || ! [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/verify-release.sh vX.Y.Z" >&2
  exit 2
fi
tag="$1"
version="${tag#v}"
cd "$(git rev-parse --show-toplevel)"

# Run package binaries with whichever runner is here: bunx, else npx.
if command -v bunx >/dev/null 2>&1; then runx=(bunx); else runx=(npx -y); fi

ext_ns="$(node -p "require('./editors/vscode/package.json').publisher")"
ext_name="$(node -p "require('./editors/vscode/package.json').name")"

fail=0
pass() { echo "ok    $*"; }
bad() { echo "FAIL  $*"; fail=1; }

# The npm registry's HTTP API rather than the `npm` CLI, so this runs on a
# machine that has only Bun (runtime-parity rule).
for pkg in visimark remark-lint-visimark markdownlint-rule-visimark visimark-mcp; do
  # Prints "listed", plus "attested" when dist.attestations is present. A version
  # published without --provenance has no attestations at all.
  state="$(curl -sS -f "https://registry.npmjs.org/$pkg/$version" 2>/dev/null \
    | V="$version" node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let d;try{d=JSON.parse(s)}catch{process.exit(1)}if(d.version!==process.env.V)process.exit(1);console.log(d.dist&&d.dist.attestations?"attested":"listed")})')"
  case "$state" in
    attested) pass "npm has $pkg@$version, with a provenance attestation" ;;
    listed) bad "npm has $pkg@$version but it carries no provenance attestation" ;;
    *) bad "npm does not have $pkg@$version" ;;
  esac
done

if curl -sS "https://registry.modelcontextprotocol.io/v0/servers?search=visimark" \
  | grep -q "\"version\"[[:space:]]*:[[:space:]]*\"$version\""; then
  pass "the MCP registry lists visimark $version"
else
  bad "the MCP registry does not list visimark $version"
fi

if "${runx[@]}" @vscode/vsce show "$ext_ns.$ext_name" --json 2>/dev/null \
  | V="$version" node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let d;try{d=JSON.parse(s)}catch{process.exit(1)}process.exit((d.versions||[]).some(v=>v.version===process.env.V)?0:1)})'; then
  pass "the Marketplace has $ext_ns.$ext_name@$version"
else
  bad "the Marketplace does not list $ext_ns.$ext_name@$version (a first publish can sit in verification; check the publisher hub)"
fi

code="$(curl -sS -o /dev/null -w '%{http_code}' "https://open-vsx.org/api/$ext_ns/$ext_name/$version")"
if [ "$code" = 200 ]; then
  pass "Open VSX has $ext_ns.$ext_name@$version"
else
  bad "Open VSX answered $code for $ext_ns.$ext_name@$version"
fi

if gh release view "$tag" >/dev/null 2>&1; then
  pass "GitHub Release $tag exists"
else
  bad "no GitHub Release for $tag"
fi

# A server that cannot start is invisible to every registry check. --nope is an
# unknown flag: a server that starts rejects it with exit 2 and a usage line.
smoke() {
  local runner="$1"; shift
  "$@" visimark-mcp@"$version" --nope >/dev/null 2>&1
  local status=$?
  if [ "$status" -eq 2 ]; then
    pass "$runner visimark-mcp@$version starts (exit 2 on --nope)"
  else
    bad "$runner visimark-mcp@$version exited $status on --nope, expected 2"
  fi
}
for pair in "npx:npx -y" "bunx:bunx"; do
  runner="${pair%%:*}"
  if command -v "$runner" >/dev/null 2>&1; then
    # shellcheck disable=SC2086
    smoke "$runner" ${pair#*:}
  else
    echo "skip  $runner is not installed; run its smoke on a machine that has it"
  fi
done

[ "$fail" -eq 0 ] && echo "$tag verified." || echo "$tag: verification FAILED." >&2
exit "$fail"
