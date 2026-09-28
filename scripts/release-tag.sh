#!/usr/bin/env bash
# Tags the current master commit for a release and pushes the tag.
#
# Usage: scripts/release-tag.sh vX.Y.Z   (core: release.yml)
#        scripts/release-tag.sh X.Y.Z    (Obsidian plugin: obsidian-release.yml)
#
# A tag is what publishes, and it cannot be taken back once the workflow has
# run. So this refuses unless the commit is exactly what CI already passed:
# on master, clean, level with origin/master, with `ci` and `dogfood` green on
# HEAD, and the tag not already taken. See docs/releasing.md.
set -euo pipefail

die() { echo "release-tag: $*" >&2; exit 1; }

[ $# -eq 1 ] || die "usage: scripts/release-tag.sh vX.Y.Z | X.Y.Z"
tag="$1"
if [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  manifest="packages/visimark/package.json"
elif [[ "$tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  manifest="editors/obsidian/manifest.json"
else
  die "'$tag' is neither vX.Y.Z (core) nor X.Y.Z (Obsidian plugin)."
fi

cd "$(git rev-parse --show-toplevel)"

[ "$(git rev-parse --abbrev-ref HEAD)" = master ] || die "not on master."
[ -z "$(git status --porcelain)" ] || die "the working tree is not clean."
git fetch --quiet origin master --tags
head="$(git rev-parse HEAD)"
[ "$head" = "$(git rev-parse origin/master)" ] || die "HEAD is not origin/master; pull or push first."

version="$(node -p "require('./$manifest').version")"
[ "${tag#v}" = "$version" ] || die "$manifest says $version, not ${tag#v}."

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null \
  || [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
  die "tag $tag already exists (locally or on origin). Never retag; see docs/releasing.md."
fi

for workflow in ci dogfood; do
  # The newest run on this commit decides: an older red one that was re-run
  # green does not count against it, and a green one that was superseded by a
  # red re-run does not count for it.
  verdict="$(gh run list --workflow "$workflow.yml" --commit "$head" --limit 1 \
    --json status,conclusion --jq '.[0] | "\(.status)/\(.conclusion)"' 2>/dev/null || true)"
  [ "$verdict" = "completed/success" ] || die "$workflow is not green on ${head:0:9} (latest run: ${verdict:-none})."
done

echo "Tagging ${head:0:9} as $tag ($manifest is $version; ci and dogfood are green)."
git tag -m "$tag" "$tag"
git push origin "refs/tags/$tag"
