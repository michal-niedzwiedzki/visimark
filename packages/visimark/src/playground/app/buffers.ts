/**
 * The visitor's edits, across a reload (review §2.7).
 *
 * The page already decided persistence was worth having — earned badges have
 * survived a reload since the beginning (see ./badges.ts). It just persisted
 * the score and not the work, so someone eight chapters into the tutorial who
 * refreshed lost every edit with no warning that this would happen.
 *
 * **Only changed buffers are stored.** A file whose text still equals the
 * bundled original is not worth a localStorage entry, and the absence of an
 * entry *is* the "unmodified" state — which is what makes reverting one file
 * a delete rather than a re-fetch, and keeps a full tutorial run to a few KB.
 *
 * **A stale copy cannot shadow an updated document forever**, which is the
 * failure §2.7 asked to be designed against: edit chapter 4, come back three
 * releases later, and a saved copy of the *old* chapter 4 would quietly
 * replace the new one, in a playground whose entire subject is values that
 * silently stop matching their source. So each entry carries `base`, the
 * digest of the bundled text it was derived from, and is discarded when the
 * bundled text no longer hashes to it. Last-write-wins was the alternative and
 * it is exactly the bug the product exists to catch.
 *
 * The digest is VisiMark's own synchronous SHA-256 (src/playground/sha256.ts,
 * reached through `VM.sha256Hex`) — the same one the import chapter verifies
 * its CSV with. `crypto.subtle` is async and everything here is called from
 * synchronous render paths.
 *
 * Every read and write is wrapped, the way ./badges.ts already wraps its own:
 * private browsing, a disabled store and a full quota all degrade to the
 * behaviour before this module existed rather than breaking boot.
 */

const STORAGE_KEY = "visimark-playground-buffers";

/** Bumped when the stored shape changes; an older payload is discarded rather
 *  than migrated, since the worst case is losing scratch edits. */
const STORAGE_VERSION = 1;

interface StoredBuffer {
  /** Digest of the bundled document this was edited from, or null for a file
   *  the visitor created, which has no bundled original to drift from. */
  base: string | null;
  text: string;
}

interface StoredPayload {
  version: number;
  files: Record<string, StoredBuffer>;
}

export interface BufferStore {
  /**
   * The saved text for `name`, or undefined when there is none, when the
   * saved copy is identical to what arrived anyway, or when it was derived
   * from a bundled document that has since changed — in which case it is
   * dropped and `name` shows up in `discarded()`.
   *
   * `original` is null for a file the visitor created.
   */
  restore(name: string, original: string | null): string | undefined;
  /** Saves `text`, or clears the entry when it matches `original` again. */
  save(name: string, text: string, original: string | null): void;
  /** Drops `name`'s saved copy. */
  forget(name: string): void;
  /** Drops every saved copy. */
  forgetAll(): void;
  /** Names saved under no bundled original — files the visitor created, which
   *  have to be put back into the catalogue before they can be opened. */
  createdNames(): string[];
  /**
   * Names whose saved copy has been thrown away since this was last called,
   * because the bundled document moved on.
   *
   * It drains rather than accumulates, because the discards do not all happen
   * at once: a document is only checked when it is fetched, and review §2.5
   * means most of them are fetched after first paint. So the caller reports
   * whatever has turned up each time it asks (see main.ts) instead of
   * reporting the boot-time set and silently swallowing the rest.
   */
  discarded(): string[];
  /** Whether a saved copy exists for `name` right now. */
  has(name: string): boolean;
}

export function createBufferStore(digest: (text: string) => string): BufferStore {
  const files = load();
  const discarded: string[] = [];

  return {
    restore(name, original) {
      const entry = files[name];
      if (!entry) return undefined;
      if (original === null) {
        // A file the visitor created: there is nothing it could have drifted
        // from, so it is restored as-is.
        return entry.base === null ? entry.text : undefined;
      }
      if (entry.base !== digest(original)) {
        delete files[name];
        discarded.push(name);
        persist(files);
        return undefined;
      }
      // Identical to the bundled text: the entry is vestigial (the visitor
      // typed and undid), so clear it and behave as if it were never there.
      if (entry.text === original) {
        delete files[name];
        persist(files);
        return undefined;
      }
      return entry.text;
    },

    save(name, text, original) {
      if (original !== null && text === original) {
        if (files[name]) {
          delete files[name];
          persist(files);
        }
        return;
      }
      const base = original === null ? null : digest(original);
      const entry = files[name];
      if (entry && entry.text === text && entry.base === base) return;
      files[name] = { base, text };
      persist(files);
    },

    forget(name) {
      if (!files[name]) return;
      delete files[name];
      persist(files);
    },

    forgetAll() {
      for (const name of Object.keys(files)) delete files[name];
      persist(files);
    },

    createdNames: () => Object.keys(files).filter((name) => files[name]!.base === null),
    discarded: () => discarded.splice(0, discarded.length),
    has: (name) => Object.prototype.hasOwnProperty.call(files, name),
  };
}

function load(): Record<string, StoredBuffer> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const payload = JSON.parse(raw) as StoredPayload;
    if (payload.version !== STORAGE_VERSION || typeof payload.files !== "object") return {};
    return payload.files ?? {};
  } catch {
    // Unreadable, disabled, or written by a version that shaped it
    // differently — start empty rather than refuse to boot.
    return {};
  }
}

function persist(files: Record<string, StoredBuffer>): void {
  try {
    const payload: StoredPayload = { version: STORAGE_VERSION, files };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing, storage disabled, or the quota is full. The edits are
    // still in memory and the session works exactly as it did before §2.7;
    // only the reload is lost, which is where this started.
  }
}
