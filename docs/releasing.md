# Releasing VisiMark

**The tag is the only publisher.** Pushing a `vX.Y.Z` tag runs
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which
publishes the engine to npm and the extension to the VS Code Marketplace and
Open VSX, and cuts a GitHub Release. Nobody runs `npm publish`, `vsce publish`
or `ovsx publish` by hand — not once, not "just to unblock it". npm burns a
version number permanently the first time it sees it; `visimark@0.1.0` is the
standing proof, a hand-publish from a work-in-progress tree that cost the number
and left an untraceable tarball on the registry for good.

## What one tag publishes

| Leg | Reads version from | Guard before it publishes |
|-----|--------------------|---------------------------|
| `visimark` on npm, with a provenance attestation | `packages/visimark/package.json` | `npm view visimark@<v>` — skip if already there |
| `visimark-vscode` on the VS Code Marketplace | `editors/vscode/package.json` | `vsce show` — skip if the version is listed |
| `visimark-vscode` on Open VSX | `editors/vscode/package.json` | Open VSX API — skip if the version is there; create the namespace only if it is genuinely missing |
| GitHub Release, with the `.vsix` attached | the tag | tag pushes only, not `workflow_dispatch` |
| Each vocabulary-request issue whose primitive ships in this release, closed | the `vocab/issue-<n>-<slug>-impl` merge commit is an ancestor of the tag | the issue is still open — a re-run skips what is already closed |

`packages/visimark-lsp` is bundled into the extension and is not published on
its own, but its version moves in lockstep. The root `visimark-monorepo`
package is private and unversioned — leave it alone.

Every leg checks the registry for the exact version and publishes or skips on
that answer. A registry that *rejects* a publish fails the whole run — it is
never logged as "already done". A green `release` run still is not proof: see
[Verify every leg](#verify-every-leg).

## Before you tag

1. **Green locally**, from a clean tree on `master`:
   ```bash
   bun install --frozen-lockfile
   bun run typecheck
   bun test
   bun run build
   ```
2. **Green in CI on the commit you will tag.** The `ci` and `dogfood` workflows
   run on every push to `master`. Wait for both before tagging — `release.yml`
   checks out the tag, not your working tree, so an unpushed or red commit
   cannot be in the release.
3. **Bump the version** to the same `X.Y.Z` in all three manifests:
   ```
   packages/visimark/package.json
   packages/visimark-lsp/package.json
   editors/vscode/package.json
   ```
   They must match each other and the tag exactly. Edit all three and confirm
   they agree — `grep -r '"version"' packages/*/package.json editors/*/package.json`.
4. **Write the changelog** — see [Preparing the changelog](#preparing-the-changelog).
5. **Promote the shipped vocabulary.** In
   [`docs/vocabulary-catalogue.md`](vocabulary-catalogue.md)'s
   [Shipped register](vocabulary-catalogue.md#shipped), every row with an
   empty **Released** cell is a primitive about to ship. For each: confirm it is
   in [`visimark-design.md`](visimark-design.md) §4, then set its
   **Released** cell to
   `[vX.Y.Z](https://github.com/michal-niedzwiedzki/visimark/releases/tag/vX.Y.Z)`.
   A filled **Released** cell is what makes the row `SHIPPED` rather than
   `UNRELEASED` — there is no separate status word. Commit with the changelog,
   or as its own `docs: promote <names> to SHIPPED`. The issues themselves are
   closed by `release.yml` after the tag — do not close them here.
6. **Commit** as `chore: release vX.Y.Z`, push to `master`, and wait for CI on
   that commit to pass.
7. **Tag and push the tag** — and only now:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

## Preparing the changelog

Two files. Both are read by machines at release time, so both are part of the
release, not an afterthought.

- **[`CHANGELOG.md`](../CHANGELOG.md)** — the whole file becomes the GitHub
  Release body, so it has to read correctly top-to-bottom as of the tag.
  - Keep a `## Unreleased` section at the top and add each user-facing change
    to it *as you make it*, under `Added` / `Changed` / `Fixed` / `Removed`.
  - At release time, rename `## Unreleased` to `## X.Y.Z - YYYY-MM-DD` and open
    a fresh empty `## Unreleased` above it.
  - The date is ISO 8601, `YYYY-MM-DD` — the project's own rule, and `fmt
    --fix-dates` will not rescue a changelog.
  - Add the `[X.Y.Z]: https://github.com/michal-niedzwiedzki/visimark/releases/tag/vX.Y.Z`
    link reference at the bottom.
- **[`editors/vscode/CHANGELOG.md`](../editors/vscode/CHANGELOG.md)** — shown on
  the extension's Marketplace page. Keep it to what an extension user sees:
  editor features, settings, fixes. Same version, same date.

If a change only touches CI, the build, or the tests, it does not need a
changelog line — unless a consumer can observe it (the provenance attestation
did, so it got one).

## Verify every leg

`release.yml` reporting success is where the check starts, not where it ends —
the v0.1.1 run went green while both marketplace legs shipped nothing. `check`
refuses to call a formula-free table verified; hold a release to the same bar.
After the run, for the version you released:

```bash
npm view visimark@X.Y.Z version
npm view visimark@X.Y.Z dist.attestations            # provenance must be present
npx @vscode/vsce show michal-niedzwiedzki.visimark-vscode
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://open-vsx.org/api/michal-niedzwiedzki/visimark-vscode/X.Y.Z   # expect 200
gh release view vX.Y.Z
```

A first Marketplace publish for a new publisher can sit in verification for a
while — check the publisher hub, not just `vsce show`, before calling it
missing.

## If a leg fails or was skipped wrongly

Fix the cause — a missing secret, an unverified publisher, a namespace that was
never created — then re-run:

```bash
gh workflow run release.yml
```

`workflow_dispatch` re-checks every registry against the version currently in
the manifests and backfills only what is missing. It does not cut a GitHub
Release (that needs a tag). **Never bump the version just to re-trigger the
pipeline.**

## Rules that bite

| Rule | Consequence if ignored |
|------|------------------------|
| The tag is the only publisher. No hand-run `npm publish` / `vsce publish` / `ovsx publish`. | npm keeps the version number forever on the first publish it sees. `visimark@0.1.0` is a mis-publish that can never be reissued. |
| All three `package.json` versions equal the tag, exactly. | One tag then publishes mismatched version numbers, or a leg fails mid-release with the others already out. |
| The changelog entry is written, dated and merged **before** the tag. | The GitHub Release body is built from `CHANGELOG.md` at the tagged commit — a tag ahead of the changelog ships the previous version's notes. |
| The Shipped-register **Released** cells are filled **before** the tag (step 5). | The released `vocabulary-catalogue.md` shows shipped primitives as still pending, while `release.yml` closes their issues — the catalogue and the tracker disagree. |
| Tag a commit already on `origin/master` with green `ci` and `dogfood`. | `release.yml` builds from the tag. Uncommitted, unpushed or red work is silently not in the release. |
| Changelog dates are ISO 8601, `YYYY-MM-DD`. | The project's own date rule, unenforced here because nothing runs `check` with date repair on the changelog. |
| Never retag, force-push a tag, or `npm unpublish` to tidy a botched release. | It rewrites history to look like the pipeline did something it did not. Bump to the next patch and let the record stand — the move `infer`'s near-miss refusal exists to enforce, applied to the release instead of a spreadsheet. |
| A green `release` run is not a released package. Verify each leg. | The v0.1.1 run reported success with npm and the GitHub Release done and both extension registries empty. |

## Secrets the workflow needs

Set as repository secrets (`gh secret set …`):

| Secret | Used by | Notes |
|--------|---------|-------|
| `NPM_TOKEN` | npm publish | Automation token, publish scope. Provenance also needs `id-token: write`, which the workflow already declares. |
| `VSCE_PAT` | Marketplace publish | Azure DevOps PAT for the `michal-niedzwiedzki` publisher, Marketplace → Manage scope. |
| `OVSX_PAT` | Open VSX publish | open-vsx.org access token. The `michal-niedzwiedzki` namespace must exist — `ovsx create-namespace` once, by hand, if the workflow's check ever reports it missing. |

<!--vmark:no-formulas-->
