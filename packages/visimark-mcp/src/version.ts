import { createRequire } from "node:module";
import { readVersion } from "visimark";

/**
 * The two versions spec §3.3 keeps apart: the envelope carries the engine's,
 * the MCP `initialize` response's `serverInfo.version` carries this server's.
 * They are in lockstep by policy (§5.1) and by CI's version-agreement check,
 * not by being one field — the protocol already has a place for a server to
 * name itself, so the envelope is not widened to carry both.
 */

/** the engine version, read from the engine that is actually loaded */
export { readVersion as engineVersion };

/**
 * The server version. Read lazily from this package's own manifest for the
 * reason `packages/visimark/src/cli/version.ts` gives: a top-level JSON import
 * makes tsc treat the repo root as the source root and inlines a literal that
 * can go stale. `../package.json` resolves from `src/` in dev and from the
 * bundled `dist/` once installed.
 */
export function serverVersion(): string {
  const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
  return pkg.version;
}
