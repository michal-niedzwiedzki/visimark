# Dependencies, surface and pins

What a published package depends on, what it exports, and every version it
pins are claims a user relies on. Each rule below exists because this
repository once broke it without anything noticing. The
[2026-10-15 review](../../docs/reviews/2026-10-15-dependencies-surface-docs.md)
found all of them at once. Where a check enforces a rule, the check is named;
a rule with no check is one a reviewer has to hold.

## Bundle third-party code, depend on first-party code

A published package's `dependencies` are exactly what its `dist/` loads at run
time, plus any package its published `.d.ts` names. Nothing else.

- **A Node-target build bundles its third-party code** and builds with
  `--production`. Without it, `bun build` resolves the `development` export
  condition: `visimark` 0.2.0 shipped micromark's debug build, and
  `DEBUG=micromark` printed 78,977 lines from one `check`. Bundling also means
  a transitive update cannot change how a released version reads a document.
- **A package that uses another first-party package marks it external** and
  pins it exactly (`--external visimark`). The lint plugins once bundled a
  whole engine *and* pinned one they never imported, so the pin and the smoke
  check that installed the packed engine tested nothing.
- **A bundled package moves to `devDependencies`.** `visimark` 0.2.0 installed
  68 packages it had bundled; `visimark-mcp` installed 158 for a stdio server
  whose SDK pulled in an HTTP server and an OAuth client.

Enforced by `scripts/check-dist-imports.ts` after `bun run build`, and by
`acceptance-node`'s `DEBUG=*` step.

## Add the fewest dependencies, peers and exports

Prefer the design that adds the fewest runtime dependencies, peer
dependencies and public exports. Keep cores free of their host (an
engine-free, CodeMirror-free core with a thin adapter), and keep engine
internals internal.

- **A new export needs a reason** in the PR, and
  `packages/visimark/test/api-surface.test.ts` makes it a visible diff.
  [`docs/library.md`](../../docs/library.md) says what is supported; a
  first-party-only helper does not join that list.
- **A published `.d.ts` is self-contained.** It imports only from packages
  the manifest declares; otherwise declare the few types it needs
  structurally, as `remark-lint-visimark` and `markdownlint-rule-visimark`
  do. `remark-lint-visimark` 0.2.0 imported `unified` and `mdast` types it
  did not depend on. Enforced by `scripts/check-dist-imports.ts` and by
  `smoke-node`'s typecheck of the packed declarations.

## A pin without a check is a comment

Every version, floor, override and hash this repository writes down has a
check that fails when it stops being true. A PR that adds one adds it to a
check in the same PR:

| Pin | Check |
|---|---|
| A package's own version, an exact engine pin, `action.yml`, the pre-commit hook, `server.json`, the Obsidian plugin's `manifest.json` and newest `versions.json` key | `scripts/check-versions.ts`, from the list in `scripts/release-manifests.ts` |
| A type package standing in for a runtime floor | `scripts/check-type-floors.ts` |
| A root `overrides` entry | `scripts/check-overrides.ts`; one that fixes an advisory, also `supply-chain.yml`'s osv-scanner jobs |
| An accepted advisory (`osv-scanner.toml`, with `ignoreUntil`) | `supply-chain.yml`'s osv-scanner jobs: an expired or unused entry fails |
| `engines.bun`, a Bun version in a workflow | `scripts/check-bun-policy.ts` |
| `engines.node`, a Node version in a workflow | `ci.yml`'s `node-support-policy` ([`runtime-parity.md`](runtime-parity.md)) |
| A vendored skill | `scripts/check-skills.ts` against `skills-lock.json` |
| A third-party action | zizmor (`workflow-audit`): a commit SHA, the tag in a comment |
| A file a workflow downloads | `scripts/check-workflow-downloads.ts` |

A new kind of pin with no row here gets a check, or a row in an existing one,
before it merges.

## A workflow runs nothing it has not pinned

- **A downloaded binary is a named release checked against a committed
  SHA-256** (`sha256sum -c`) in the same step, before it runs. Never
  `releases/latest`. Bump the version and the digest together.
- **A third-party action is pinned to a commit SHA.** First-party `actions/*`
  may stay on a tag.
- **A checkout that does not push sets `persist-credentials: false`.**
- **A workflow that publishes builds with the pinned toolchain**
  (`bun-version-file: package.json`), never `latest`.

## State each fact in one place

A fact that two documents restate drifts in one of them. The README said
"five commands" when there were seven, and called the extension unpublished
two paragraphs before saying where it was published. Write a fact where it
belongs and link to it everywhere else:

- where an artifact is published: [`docs/distribution.md`](../../docs/distribution.md);
- how to release: [`docs/releasing.md`](../../docs/releasing.md);
- every command, option and exit code: [`docs/cli-reference.md`](../../docs/cli-reference.md).

Never link to a gitignored path: nobody else has it.
`scripts/check-links.ts` fails on a relative link to a file that is not in
the repository; it cannot tell a stale sentence from a true one.

<!--vmark:no-formulas-->
