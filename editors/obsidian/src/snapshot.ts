import { build, check, locate, memoryReader, type DocModel, type ReaderPort } from "visimark";

/**
 * The vault-backed reader — the one piece the engine does not supply, and the
 * place the "thin client" claim needed checking rather than repeating.
 *
 * **The problem.** `ReaderPort` is **synchronous** in all four methods
 * (`packages/visimark/src/fs/reader.ts`), because `check` is synchronous and
 * the digest has to ride on the read rather than a sibling `hash()`.
 * Obsidian's vault adapter is **asynchronous**. So a vault-backed `ReaderPort`
 * cannot be written as a direct adapter, and making the port async would be an
 * engine change that spends the one architectural result this whole client
 * rests on.
 *
 * **The answer is a snapshot: fetch asynchronously, then serve
 * synchronously.** Text is pulled out of the vault into a map, and the map is
 * handed to the engine's own `memoryReader`, which is the same
 * map-backed `ReaderPort` the browser playground already runs on and which
 * hashes with the engine's own synchronous SHA-256. The plugin writes neither
 * a reader nor a hash; it writes the fetch.
 *
 * ## How the paths are discovered
 *
 * `docs/design/obsidian-plugin-spec.md` §2.6 proposed reading the declared
 * `import … from <path>` and `chart` image paths off the parse and prefetching
 * those. This does something equivalent and stronger: it **asks the engine**.
 *
 * `check` is run against a reader that has nothing, and every path it asks for
 * is recorded. Those paths are fetched, and `check` is run again against a
 * reader that now has them. If the second run asks for a path the first did
 * not, that one is fetched too, and so on to a fixed point.
 *
 * Two reasons to prefer this to re-deriving the paths here:
 *
 * 1. **It cannot drift.** A re-derivation is a second implementation of "what
 *    does this document read", maintained in a plugin, against a model whose
 *    shape is the engine's business. The day the engine grows a third class of
 *    read, the re-derivation returns a set that is quietly too small and the
 *    plugin reports a spurious `IMPORT` finding.
 * 2. **It turns the spec's invariant into a checked property.** §2.6 rests on
 *    "nothing in the engine asks the reader for a path that a parse of the
 *    document did not name", which makes path requests syntactic and therefore
 *    independent of what the reader answered. If that holds, the loop settles
 *    after one fetch round. `MAX_ROUNDS` is the assertion: settling late is
 *    allowed and cheap, never settling throws rather than looping, and a throw
 *    means the invariant is false and the engine — not this file — has
 *    something new to say.
 *
 * The cost is one extra `check` per note over the ideal, on top of the one the
 * caller wanted. That is the same "the phases pay for the document several
 * times" cost the section-F catalogue row *Shared build across the document
 * phases* is about; it is a known lever and not a new one, and the note-sized
 * documents this plugin runs on check in 12–20 ms.
 *
 * ## Vault space and engine space
 *
 * Obsidian paths are vault-relative and carry no leading slash
 * (`notes/2026/q3.csv`). The engine works in absolute paths, and
 * `src/browser-path.ts` roots a bare relative path at `/` — which makes the
 * vault root the engine's containment boundary, exactly as the spec wants. So
 * the two spaces differ by one leading slash, and `toVaultPath` is the whole
 * translation. **The plugin adds no path policy of its own**: a path that
 * escapes the vault is simply not in the snapshot, `exists` answers false, and
 * the engine emits the `IMPORT` finding it already emits for a missing file.
 */

/**
 * Read one vault-relative path, or `null` for anything unreadable — missing,
 * a folder, outside the vault, or refused. The plugin passes
 * `(p) => vault.adapter.read(p).catch(() => null)`; the tests pass a `Map`.
 */
export type VaultRead = (vaultPath: string) => Promise<string | null>;

/**
 * How many times `check` may discover a path the previous round did not.
 *
 * One round discovers, one confirms, and a third is slack for an engine phase
 * that reads in two stages. A fourth would mean path requests depend on file
 * *contents*, which the design above says they do not — so this throws rather
 * than raising the number.
 */
const MAX_ROUNDS = 4;

/** The engine works in `/`-rooted paths; the vault does not. */
export function toVaultPath(enginePath: string): string {
  return enginePath.startsWith("/") ? enginePath.slice(1) : enginePath;
}

/** A reader that has nothing and remembers everything it was asked for. */
function recordingReader(have: Map<string, string>, asked: Set<string>): ReaderPort {
  const served = memoryReader((p) => have.get(p) ?? null);
  return {
    exists: (p) => {
      asked.add(p);
      return served.exists(p);
    },
    realpath: (p) => {
      asked.add(p);
      return served.realpath(p);
    },
    readText: (p) => {
      asked.add(p);
      return served.readText(p);
    },
    readSealed: (p) => {
      asked.add(p);
      return served.readSealed(p);
    },
  };
}

export interface Snapshot {
  /** the `ReaderPort` to hand `check`/`fmt` — synchronous, as the port requires */
  reader: ReaderPort;
  /** the `doc.path` that goes with it, in engine space */
  path: string;
  /** every path the engine asked for, in engine space — what the note reads */
  asked: ReadonlySet<string>;
  /** the subset that was readable; `asked` minus this is what is missing */
  held: ReadonlySet<string>;
  /** how many discovery rounds it took; 1 means nothing was read at all */
  rounds: number;
}

/**
 * Build a synchronous `ReaderPort` over everything the note reads.
 *
 * `notePath` is vault-relative, as Obsidian gives it (`notes/q3.md`). The
 * returned `path` is what `check` must be given alongside the reader.
 */
export async function vaultSnapshot(
  model: DocModel,
  notePath: string,
  read: VaultRead,
): Promise<Snapshot> {
  const path = "/" + toVaultPath(notePath);
  const have = new Map<string, string>();
  const attempted = new Set<string>();
  const everAsked = new Set<string>();

  let rounds = 0;
  for (;;) {
    rounds++;
    const asked = new Set<string>();
    check(model, { doc: { path, reader: recordingReader(have, asked) } });
    for (const p of asked) everAsked.add(p);

    const fresh = [...asked].filter((p) => !attempted.has(p) && p !== path);
    if (fresh.length === 0) break;
    if (rounds >= MAX_ROUNDS) {
      throw new Error(
        `visimark: reading ${notePath} did not settle after ${MAX_ROUNDS} rounds; ` +
          `still asking for ${fresh.join(", ")}. A path request now depends on a file's ` +
          `contents, which the snapshot design assumes it cannot — see src/snapshot.ts.`,
      );
    }
    for (const p of fresh) {
      attempted.add(p);
      const text = await read(toVaultPath(p));
      if (text !== null) have.set(p, text);
    }
  }

  return {
    reader: memoryReader((p) => have.get(p) ?? null),
    path,
    asked: everAsked,
    held: new Set(have.keys()),
    rounds,
  };
}

/** `locate` + `build` + a snapshot, which is what every command in §2.4 starts with. */
export async function readNote(
  source: string,
  notePath: string,
  read: VaultRead,
): Promise<{ model: DocModel; snapshot: Snapshot }> {
  const model = build(locate(source));
  return { model, snapshot: await vaultSnapshot(model, notePath, read) };
}
