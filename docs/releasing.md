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
| `remark-lint-visimark` on npm, with a provenance attestation | `packages/remark-visimark/package.json` | `npm view remark-lint-visimark@<v>` — skip if already there |
| `markdownlint-rule-visimark` on npm, with a provenance attestation | `packages/markdownlint-visimark/package.json` | `npm view markdownlint-rule-visimark@<v>` — skip if already there |
| `visimark-mcp` on npm, with a provenance attestation | `packages/visimark-mcp/package.json` | `npm view visimark-mcp@<v>` — skip if already there |
| `io.github.michal-niedzwiedzki/visimark` on the MCP registry | `server.json`, rewritten from the tag | `GET /v0/servers?search=visimark` — skip if this version is listed; runs only if the npm leg succeeded, since the entry points at the npm package |
| `visimark-vscode` on the VS Code Marketplace | `editors/vscode/package.json` | `vsce show` — skip if the version is listed |
| `visimark-vscode` on Open VSX | `editors/vscode/package.json` | Open VSX API — skip if the version is there; create the namespace only if it is genuinely missing |
| GitHub Release, with the `.vsix` attached | the tag | needs a tag — the pushed one, or the `tag` input on a `workflow_dispatch` |
| Each request issue whose change ships in this release, closed | the `vocab/issue-<n>-<slug>-impl` or `issue/<n>-<slug>-impl` merge commit is an ancestor of the tag | the issue is still open — a re-run skips what is already closed |

`packages/visimark-lsp` is bundled into the extension and is not published on
its own, but its version moves in lockstep. The root `visimark-monorepo`
package is private and unversioned — leave it alone.

Every leg checks the registry for the exact version and publishes or skips on
that answer. A registry that *rejects* a publish fails the run — it is never
logged as "already done". It no longer fails it *immediately*, though: the legs
are independent and each one is guarded, so a credential problem in one does not
stop the others, the GitHub Release, or the issue bookkeeping. The run records
each leg's outcome and fails at the end. The only ordering that is real is the
`.vsix`: if packaging the extension fails, both marketplace legs and the GitHub
Release are skipped, because there is nothing to publish.

The last step of the run, **every leg must have landed**, asks all four
registries — npm, the VS Code Marketplace, Open VSX and
`registry.modelcontextprotocol.io` — whether the versions are actually there and fails the job if any is
missing. That is what makes a green run mean something — v0.1.1 went green with
both marketplace legs empty, and v0.1.3 shipped npm only. It is not a substitute
for [Verify every leg](#verify-every-leg), which also covers the provenance
attestation and the GitHub Release.

```mermaid
flowchart LR
  tag[Push tag vX.Y.Z] --> run[release.yml]
  run --> npm[npm visimark]
  run --> npmplugins[npm remark/markdownlint/mcp]
  run --> mcpreg[MCP registry]
  run --> vsce[VS Code Marketplace]
  run --> ovsx[Open VSX]
  run --> ghrel[GitHub Release with vsix]
  run --> closeIss[Close shipped request issues]
  npm --> present{"Version already there?"}
  vsce --> present
  ovsx --> present
  npmplugins --> present
  mcpreg --> present
  present -->|yes| skip[Skip that leg]
  present -->|no| pub[Publish]
  pub --> rejected{"Registry rejects?"}
  rejected -->|yes| legfail[Record the leg as failed, carry on]
  rejected -->|no| ok[Leg done]
  skip --> gate["every leg must have landed: re-ask all four registries"]
  ok --> gate
  legfail --> gate
  ghrel --> gate
  closeIss --> gate
  gate -->|all present, no leg failed| verify[Verify every leg by hand]
  gate -->|anything missing| fail[Fail the run]
  fail --> fix[Fix the cause]
  fix --> dispatch["workflow_dispatch -f tag=vX.Y.Z backfills what is missing"]
  dispatch --> present
```

A `workflow_dispatch` without a `tag` cuts no GitHub Release and closes no
issues — it has no tag to point at, and it says so in the run log. Pass
`-f tag=vX.Y.Z` to backfill those two as well; the run then checks that tag out
and builds from it.

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
3. **Bump the version** to the same `X.Y.Z` in all eight version-carrying files:
   ```
   packages/visimark/package.json
   packages/visimark-lsp/package.json
   editors/vscode/package.json
   action.yml                                  # the `version` input's default
   scripts/precommit-visimark-check.sh         # both visimark@ pins inside it
   packages/remark-visimark/package.json       # its own version AND its visimark dependency pin
   packages/markdownlint-visimark/package.json # its own version AND its visimark dependency pin
   packages/visimark-mcp/package.json          # its own version AND its visimark dependency pin
   ```
   They must match each other and the tag exactly. `action.yml` is in the list
   because its default is what a consumer's `npx` installs: leave it behind and
   everyone who pinned the new Action ref quietly keeps running the old engine.
   `scripts/precommit-visimark-check.sh` joins them for the same reason — it is
   what a consumer's pinned `pre-commit` `rev:` actually runs. No hand-run
   `grep` needed any more — `ci.yml`'s "every version-carrying file must agree"
   step fails the build if you miss one of them, so step 6's green CI is the
   confirmation.

   `server.json` is **not** in this list, and does not need to be: the
   MCP-registry leg rewrites its two version fields from the tag before it
   publishes, so it cannot go stale and cannot register an entry pointing at a
   version other than the one that just shipped.
4. **Write the changelog** — see [Preparing the changelog](#preparing-the-changelog).
   `ci.yml`'s "every release must have a changelog entry" step fails the build if
   `CHANGELOG.md` or `editors/vscode/CHANGELOG.md` has no dated
   `## X.Y.Z - YYYY-MM-DD` heading for its own manifest's version, so step 6's
   green CI is the confirmation. It checks that the entry exists, not that it is
   right.
5. **Promote the shipped rows.** In
   [`docs/vocabulary-catalogue.md`](vocabulary-catalogue.md)'s
   [Shipped register](vocabulary-catalogue.md#shipped), every row with an
   empty **Released** cell is about to ship. For each: confirm the behaviour is
   specified where it belongs — a vocabulary primitive in `visimark-design.md`
   [§4](visimark-design.md#4-syntax), a language feature in the section it
   changed, a tooling / process change in its own doc — then set its
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

```mermaid
flowchart LR
  local[Green locally] --> ci[Green CI on master]
  ci --> bump[Bump all eight version-carrying files]
  bump --> cl[Write the changelog]
  cl --> promo[Fill Shipped Released cells]
  promo --> commit[Commit and push]
  commit --> wait[Wait for CI on that commit]
  wait --> tag[Tag vX.Y.Z and push the tag]
```

## Preparing the changelog

Two files. Both are read by machines at release time, so both are part of the
release, not an afterthought. CI checks that each has an entry for the release;
it does not check what the entry says.

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
  the extension's Marketplace page.
  - Every release gets a dated `## X.Y.Z - YYYY-MM-DD` entry, even when it is
    one line: "No editor-visible changes. Bundles engine X.Y.Z." Same version,
    same date as the root file.
  - An entry lists only what an extension user sees: diagnostics, hover,
    highlighting, completion, settings, fixes. A language change belongs there
    only if the extension surfaces it.
  - To decide that, remember the language server calls the engine's `analyze()`
    (`packages/visimark-lsp/src/analysis.ts`). An engine finding reaches the
    editor as a diagnostic unless the language server maps it away, so a new or
    widened finding usually belongs here. CI cannot check this; you do.
  - `## Unreleased` is optional in this file. Write the entry when you cut the
    release.

If a change only touches CI, the build, or the tests, it does not need a
changelog line — unless a consumer can observe it (the provenance attestation
did, so it got one).

## Verify every leg

`release.yml`'s own final step now asserts all four registries have the
version, so a green run is no longer the empty signal it was for v0.1.1. It
still does not check the provenance attestation or the GitHub Release, and
`check` refuses to call a formula-free table verified — hold a release to the
same bar. After the run, for the version you released:

```bash
# This is also the Action's pinned default (ci.yml asserts the two agree), so
# it doubles as proof that a consumer's `npx visimark@<default>` can resolve.
# CI proves the number matches the manifests; only npm proves it was ever
# published, and v0.1.0 is the standing reminder that those are different
# questions.
npm view visimark@X.Y.Z version
npm view visimark@X.Y.Z dist.attestations            # provenance must be present

# The other three npm packages ship from the same tag and are just as easy to
# miss — each publishes on its own guarded leg, so any one of them can be the
# only thing absent from an otherwise green run.
for pkg in remark-lint-visimark markdownlint-rule-visimark visimark-mcp; do
  npm view "$pkg@X.Y.Z" version
  npm view "$pkg@X.Y.Z" dist.attestations
done

# The MCP registry. An agent discovers the server here and nowhere else, so an
# entry that is absent or stuck on the previous version is a release that
# shipped to npm and reached no one.
curl -sS 'https://registry.modelcontextprotocol.io/v0/servers?search=visimark' \
  | grep -o '"version":"[^"]*"'                      # expect X.Y.Z

npx @vscode/vsce show visimark-michal-niedzwiedzki.visimark-vscode
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://open-vsx.org/api/visimark-michal-niedzwiedzki/visimark-vscode/X.Y.Z   # expect 200
gh release view vX.Y.Z
```

Then prove the published MCP server actually runs, the way CI does — under
each runtime, from the registry rather than from a tarball you built:

```bash
npx -y visimark-mcp@X.Y.Z --nope    # expect exit 2 and a usage line on stderr
bunx visimark-mcp@X.Y.Z --nope      # the same, on a machine with Bun
```

A server that cannot start is not visible in any registry check. If either
form fails to resolve `visimark`, read
[Publishing a new package for the first time](#publishing-a-new-package-for-the-first-time)
— the lockstep note there is the usual cause.

A first Marketplace publish for a new publisher can sit in verification for a
while — check the publisher hub, not just `vsce show`, before calling it
missing.

## If a leg fails or was skipped wrongly

Fix the cause — a missing secret, an unverified publisher, a namespace that was
never created, an npm name that is not yours ([first
release](#publishing-a-new-package-for-the-first-time)) — then re-run:

```bash
gh workflow run release.yml -f tag=vX.Y.Z
```

`workflow_dispatch` re-checks every registry and backfills only what is missing.
With `tag`, it checks that tag out, so the versions it publishes are the tagged
ones and the GitHub Release and the request-issue bookkeeping are backfilled
too. Without `tag` it runs from the default branch against the versions
currently in the manifests, repairs the **publish** legs only — the four npm
packages, the MCP registry entry, the Marketplace and Open VSX — and warns in
the log that it skipped the two tag-gated ones, the GitHub Release and the
request-issue bookkeeping. **Never bump the version just to
re-trigger the pipeline.**

## Publishing a new package for the first time

Everything above assumes each leg has published before. A package's **first**
release is the one where a leg can fail for a reason no later release will ever
hit again, and the two that matter are ordering and ownership. This section
exists because `visimark-mcp` is the first package added to this pipeline since
the ordering rules were written down, and the next one will want the same list.

**1. The name must be free, or already yours.** `npm publish` on a name someone
else holds fails the leg outright — and unlike a version, a name cannot be
retried under a different number. Check before you tag, not after:

```bash
npm view <name> version    # "npm error 404" is what you want to see
```

**2. A leg that depends on another must run after it.** `release.yml` publishes
in dependency order — engine, then the remark plugin, the markdownlint rule and
`visimark-mcp`, then the MCP registry entry. Each of the latter pins the engine
exactly, and the registry entry points at an npm package that has to exist for
the listing to resolve. If you add a leg, put it after everything it names.

**3. The package must work against the *published* engine, not just the tree.**
This is the one that bit. `visimark-mcp` resolves its exact `visimark` pin from
the registry at install time, so it inherits whatever that published engine is
— including bugs already fixed on `master`. `visimark@0.1.7` carries the
[#170](https://github.com/michal-niedzwiedzki/visimark/issues/170) `bun`
exports condition, so a `visimark-mcp` released against it would fail
`bun add -g` for every user while passing every check in this repository.

Publishing both from one tag is what makes this safe, and it is why the
lockstep pin is exact rather than a caret. **Never publish a dependent package
against an engine version older than the tag**, however convenient it looks.

**4. A new registry needs its ownership settled once.** For npm that is the
`NPM_TOKEN` scope; for Open VSX the workflow creates the namespace on first
publish. For the MCP registry, `io.github.<owner>/<name>` is owned by the
GitHub identity that publishes it, proven by OIDC — so there is nothing to
claim in advance, but the first run is the first time that is tested. If it
fails, read the leg's log before assuming a credential problem: the guard
`GET /v0/servers?search=` runs first, and a network failure there looks like a
publish failure.

**5. Verify the first release by hand, even though the gate is green.** Run the
whole of [Verify every leg](#verify-every-leg) including the two `npx`/`bunx`
smoke commands. The final gate proves a version is *listed*; only running it
proves it *starts*.

## Rules that bite

| Rule | Consequence if ignored |
|------|------------------------|
| The tag is the only publisher. No hand-run `npm publish` / `vsce publish` / `ovsx publish`. | npm keeps the version number forever on the first publish it sees. `visimark@0.1.0` is a mis-publish that can never be reissued. |
| All six `package.json` versions equal the tag, exactly — and the three `dependencies.visimark` pins with them. | One tag then publishes mismatched version numbers, or a leg fails mid-release with the others already out. |
| The changelog entry is written, dated and merged **before** the tag. | The GitHub Release body is built from `CHANGELOG.md` at the tagged commit — a tag ahead of the changelog ships the previous version's notes. |
| Each changelog has a dated `## X.Y.Z - YYYY-MM-DD` heading for the release's version, in the release commit. | `ci.yml`'s "every release must have a changelog entry" step fails the release commit. Without the entry the GitHub Release body ships the previous version's notes, or the Marketplace page silently skips the version. The check proves the heading exists, not that the entry is accurate. |
| The Shipped-register **Released** cells are filled **before** the tag (step 5). | The released `vocabulary-catalogue.md` shows shipped primitives as still pending, while `release.yml` closes their issues — the catalogue and the tracker disagree. |
| Tag a commit already on `origin/master` with green `ci` and `dogfood`. | `release.yml` builds from the tag. Uncommitted, unpushed or red work is silently not in the release. |
| `action.yml`'s `version` default is bumped with the manifests. | Every consumer who pins the new Action ref keeps running the previous engine, with nothing at run time to tell them. Nothing fails; it just quietly verifies with the old code. |
| Changelog dates are ISO 8601, `YYYY-MM-DD`. | The project's own date rule. A release heading with no date fails CI; every other date in a changelog is unchecked, because nothing runs `check` with date repair on it. |
| A dependent package is never published against an engine older than the tag. | It inherits every bug that engine has, including ones already fixed on `master`, and no check in this repository would notice. `visimark@0.1.7`'s #170 `bun` exports condition would have made `bun add -g visimark-mcp` fail for every user. |
| Never retag, force-push a tag, or `npm unpublish` to tidy a botched release. | It rewrites history to look like the pipeline did something it did not. Bump to the next patch and let the record stand — the move `infer`'s near-miss refusal exists to enforce, applied to the release instead of a spreadsheet. |
| A green `release` run is not a fully released package. Verify each leg. | The run's final step asserts the four registries have the version, but nothing automated checks the provenance attestation or the GitHub Release. The v0.1.1 run reported success with npm and the GitHub Release done and both extension registries empty — that gap is closed; the remaining ones are yours. |

## Secrets the workflow needs

Set as repository secrets (`gh secret set …`):

| Secret | Used by | Notes |
|--------|---------|-------|
| `NPM_TOKEN` | npm publish | Automation token, publish scope. Provenance also needs `id-token: write`, which the workflow already declares. |
| `VSCE_PAT` | Marketplace publish | Azure DevOps PAT for the `visimark-michal-niedzwiedzki` publisher, Marketplace → Manage scope. |
| `OVSX_PAT` | Open VSX publish | open-vsx.org access token. The namespace is the extension's `publisher`, `visimark-michal-niedzwiedzki`; the workflow creates it on first publish if it is missing. |
| *(none)* | MCP registry publish | No secret. `mcp-publisher login github-oidc` uses the `id-token: write` permission the workflow already declares for npm provenance, and the `io.github.michal-niedzwiedzki/*` namespace is owned by virtue of that GitHub identity. Nothing to rotate, and nothing to set before the first release. |

<!--vmark:no-formulas-->
