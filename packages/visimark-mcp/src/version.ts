import { createRequire } from "node:module";

/**
 * The two versions spec §3.3 keeps apart.
 *
 * Both are read out of this package's own `package.json`, lazily, for the
 * reason `packages/visimark/src/cli/version.ts` gives: a top-level JSON import
 * makes tsc treat the repo root as the source root and inlines a literal that
 * can go stale. `../package.json` resolves from `src/` in dev and from the
 * bundled `dist/` once installed.
 *
 * The **engine** version is read from this package's exact `visimark` pin
 * rather than from the engine itself: the engine does not export its version,
 * and `readVersion()` resolves `../../package.json` relative to whatever
 * bundle it lands in. The pin is the same string by construction — CI's
 * version-agreement check (task 8) asserts it against the engine's manifest —
 * and it is the version that is actually installed beside this server.
 */
function manifest(): { version: string; dependencies: Record<string, string> } {
  return createRequire(import.meta.url)("../package.json") as {
    version: string;
    dependencies: Record<string, string>;
  };
}

/** the engine version — the envelope's `visimark` field */
export function engineVersion(): string {
  return manifest().dependencies["visimark"] ?? "0.0.0";
}

/** the server version — the MCP `initialize` response's `serverInfo.version` */
export function serverVersion(): string {
  return manifest().version;
}
