import { normalizePath, type Vault } from "obsidian";
import type { VaultRead } from "./snapshot.js";

/**
 * The Obsidian side of `snapshot.ts`'s `VaultRead`: one vault-relative path
 * in, its text or `null` out.
 *
 * **The catching lives here and not in the snapshot**, because that is where
 * it can be honest. `VaultRead`'s contract is `null` for anything unreadable —
 * missing, a folder, outside the vault, refused — and this is the one place
 * that knows which of those a thrown adapter error was. A snapshot that
 * swallowed its own errors would turn a vault that has gone away into a note
 * reporting every import as missing, which reads exactly like a real finding.
 *
 * `normalizePath` is Obsidian's, not ours: it is what makes a path the vault
 * adapter will accept on every platform, and reimplementing it is the kind of
 * second definition this plugin spends its design avoiding.
 */
export function vaultRead(vault: Vault): VaultRead {
  return async (path: string): Promise<string | null> => {
    try {
      return await vault.adapter.read(normalizePath(path));
    } catch {
      return null;
    }
  };
}
