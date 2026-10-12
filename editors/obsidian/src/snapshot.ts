/**
 * The vault-backed reader moved to `codemirror-visimark` (#360), where any
 * CodeMirror host can use it; this module keeps the plugin's own name for the
 * read function, `VaultRead`, so the vault, chart, API and sweep code does not
 * change. The symlink limitation (#233) is the plugin's, and is written down in
 * docs/design/obsidian-plugin-spec.md §2.6.
 */
export {
  readNote,
  toVaultPath,
  vaultSnapshot,
  type Snapshot,
} from "codemirror-visimark/snapshot.js";
export type { ReadImport as VaultRead } from "codemirror-visimark/snapshot.js";
