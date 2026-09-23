/**
 * Deep-compares two already-parsed `--json` envelopes — one from the real
 * CLI, one built from the committed browser bundle's raw result — and
 * reports every path where they disagree.
 *
 * Pure: no I/O, no subprocess, no bundle loading. `cross-host-check.ts` is
 * the orchestrator that produces the two envelopes this operates on.
 *
 * The `visimark` key is always excluded (cross-host-equivalence-check-spec.md
 * §5 — both hosts report the engine's own version, which only means
 * something to `playground-bundle`'s byte-exact rebuild check, not to this
 * one). `scopedExclusions` additionally drops the file-dependent entries on
 * the two file-reading documents, for `check`/`explain` only (§4's
 * eval-has-no-scoping-exception correction) — a path listed there is removed
 * from both sides before comparing, not compared against each other.
 */

export interface Divergence {
  /** JSON path within the envelope, e.g. `files[0].findings[2].code` */
  path: string;
  cli: unknown;
  browser: unknown;
}

export interface CompareOptions {
  scopedExclusions?: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** drops a `.`/`[n]`-style path from a value, returning a new value */
function omitPath(value: unknown, segments: string[]): unknown {
  if (segments.length === 0) return undefined;
  const [head, ...rest] = segments;
  if (Array.isArray(value)) {
    const i = Number(head);
    if (Number.isNaN(i) || i < 0 || i >= value.length) return value;
    if (rest.length === 0) return value.filter((_, idx) => idx !== i);
    const copy = value.slice();
    copy[i] = omitPath(copy[i], rest);
    return copy;
  }
  if (isPlainObject(value)) {
    if (!(head! in value)) return value;
    if (rest.length === 0) {
      const { [head!]: _dropped, ...remainder } = value;
      return remainder;
    }
    return { ...value, [head!]: omitPath(value[head!], rest) };
  }
  return value;
}

/** `"files[0].findings[2].code"` -> `["files", "0", "findings", "2", "code"]` */
function parsePath(path: string): string[] {
  return path.split(".").flatMap((part) => part.split(/\[(\d+)\]/).filter((s) => s !== ""));
}

function strip(value: unknown, paths: string[]): unknown {
  return paths.reduce((v, p) => omitPath(v, parsePath(p)), value);
}

function walk(cli: unknown, browser: unknown, path: string, out: Divergence[]): void {
  if (Array.isArray(cli) && Array.isArray(browser)) {
    if (cli.length !== browser.length) {
      out.push({ path, cli, browser });
      return;
    }
    for (let i = 0; i < cli.length; i++) walk(cli[i], browser[i], `${path}[${i}]`, out);
    return;
  }
  if (isPlainObject(cli) && isPlainObject(browser)) {
    const keys = new Set([...Object.keys(cli), ...Object.keys(browser)]);
    for (const k of keys) {
      const next = path ? `${path}.${k}` : k;
      if (!(k in cli) || !(k in browser)) {
        out.push({ path: next, cli: cli[k], browser: browser[k] });
        continue;
      }
      walk(cli[k], browser[k], next, out);
    }
    return;
  }
  if (cli !== browser) out.push({ path, cli, browser });
}

export function compareEnvelopes(
  cli: unknown,
  browser: unknown,
  options: CompareOptions = {},
): Divergence[] {
  const exclusions = ["visimark", ...(options.scopedExclusions ?? [])];
  const cliStripped = strip(cli, exclusions);
  const browserStripped = strip(browser, exclusions);
  const out: Divergence[] = [];
  walk(cliStripped, browserStripped, "", out);
  return out;
}
