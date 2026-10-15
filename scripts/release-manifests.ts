/**
 * The one list of package manifests a core release versions together.
 *
 * `prepare-release.ts` bumps them and `check-versions.ts` asserts they agree;
 * both import this, so a new package is one edit here rather than three that
 * can drift (review 2026-10-15 §2.16). The Obsidian plugin is not here: its
 * version is its own (docs/releasing.md, "Release order").
 */
export interface ReleaseManifest {
  /** Repository-relative path, which is also the workspace's `bun.lock` key plus `/package.json`. */
  readonly file: string;
  /** The npm name it publishes under, or `null` when nothing goes to npm. */
  readonly npm: string | null;
  /** True when it pins the engine exactly in `dependencies.visimark`. */
  readonly pinsEngine: boolean;
}

export const ENGINE_MANIFEST = "packages/visimark/package.json";

export const RELEASE_MANIFESTS: readonly ReleaseManifest[] = [
  { file: ENGINE_MANIFEST, npm: "visimark", pinsEngine: false },
  // Bundled into the extension's .vsix, never published on its own.
  { file: "packages/visimark-lsp/package.json", npm: null, pinsEngine: false },
  // The Marketplace and Open VSX, not npm.
  { file: "editors/vscode/package.json", npm: null, pinsEngine: false },
  { file: "packages/remark-visimark/package.json", npm: "remark-lint-visimark", pinsEngine: true },
  {
    file: "packages/markdownlint-visimark/package.json",
    npm: "markdownlint-rule-visimark",
    pinsEngine: true,
  },
  { file: "packages/visimark-mcp/package.json", npm: "visimark-mcp", pinsEngine: true },
  // These two bundle the engine for the browser, so there is no pin (#360, #373).
  {
    file: "packages/codemirror-visimark/package.json",
    npm: "codemirror-visimark",
    pinsEngine: false,
  },
  {
    file: "packages/markdown-it-visimark/package.json",
    npm: "markdown-it-visimark",
    pinsEngine: false,
  },
];

/** The manifests that publish to npm. */
export const NPM_MANIFESTS = RELEASE_MANIFESTS.filter((m) => m.npm !== null);

/** The workspace's key in `bun.lock`'s `workspaces` block. */
export const workspaceOf = (file: string): string => file.replace(/\/package\.json$/, "");

/**
 * The text of one workspace's block in `bun.lock`, or `null` when absent.
 * bun.lock allows trailing commas, so it is searched rather than parsed. The
 * block is found by its exact `"<workspace>": {` key — "packages/visimark"
 * cannot match "packages/visimark-lsp" — and ends at the first line that is
 * four spaces then `}`, so a field missing from its own block cannot be read
 * out of the next one.
 */
export function lockBlock(lock: string, workspace: string): string | null {
  const start = lock.indexOf(`"${workspace}": {`);
  if (start === -1) return null;
  const close = /\n {4}\},?\n/.exec(lock.slice(start));
  return close === null ? null : lock.slice(start, start + close.index + close[0].length);
}

/** The `version` input's default in `action.yml`: the first `default:` under the `version:` key. */
export const ACTION_VERSION = /(^  version:[ \t]*\n(?:(?: {4}.*)?\n)*? {4}default: ")([^"]*)(")/m;

/** The pre-commit hook's single `pinned=X.Y.Z` line. */
export const HOOK_PIN = /^pinned=(\S*)$/gm;
