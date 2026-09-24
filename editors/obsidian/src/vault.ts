import { TFile, normalizePath, type Vault } from "obsidian";
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

/**
 * The same contract, preferring `cachedRead` for a note Obsidian already
 * knows about.
 *
 * The sweep reads **every** note in the vault, and reading is its dominant
 * cost once the prefilter has removed the parses (`sweep.ts`). `cachedRead` is
 * what Obsidian's own features use for exactly this: it answers from the
 * in-memory cache when the file is warm, and it is the documented way to read
 * a file you are not about to modify.
 *
 * It falls back to the adapter for anything that is not a Markdown file in the
 * vault — a declared CSV import, which `snapshot.ts` asks for through this
 * same function, is not a `TFile` the markdown index holds.
 */
export function vaultSweepRead(vault: Vault): VaultRead {
  const direct = vaultRead(vault);
  return async (path: string): Promise<string | null> => {
    const file = vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      try {
        return await vault.cachedRead(file);
      } catch {
        return null;
      }
    }
    return direct(path);
  };
}
