import { dirname, isAbsolute, resolve, sep } from "node:path";
import type { DocumentFile } from "./reader.js";

/**
 * The shared path gate, behind both the chart-output write gate
 * (`artifact/path.ts`) and the declared-input read gate (`import/path.ts`).
 *
 * A document states where its artifact lives, or where its data comes from, so
 * the path is author-supplied and must be bounded. Every rule here is a
 * **refusal, never a transformation** - nothing is normalised into legality,
 * because a silently rewritten path is exactly the kind of guess constraint 3
 * forbids.
 *
 * The two gates differ only in the noun their messages open with and the
 * extension they require, so they share one implementation: a rule hardened on
 * one side but not the other is the failure this module exists to prevent.
 * Anything beyond path legality belongs to the caller - notably the write
 * side's refusal to overwrite a file lacking VisiMark's metadata marker.
 *
 * **This verdict is about a name, and only at the instant it is asked.** It is
 * carried a long way before it is used, so it is not on its own evidence about
 * the object finally opened. `fs/open.ts` is where the use re-establishes its
 * own proof, and it says which part of the window stays open.
 */

export type PathResult = { ok: string } | { err: string };

export interface GateSpec {
  /** the noun opening every refusal message, e.g. "artifact path" */
  readonly noun: string;
  /** required lowercase extension including the dot, e.g. ".svg" */
  readonly ext: string;
}

/** `CON`, `NUL`, `COM1`... are special on Windows whatever the extension. */
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
// matching control characters is the point: they must never reach a path
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function gatePath(doc: DocumentFile, url: string, spec: GateSpec): PathResult {
  const { noun, ext } = spec;
  const { reader } = doc;

  if (url.length === 0) return { err: noun + " is empty" };
  if (CONTROL_CHARS.test(url)) {
    return { err: noun + " contains a control character" };
  }
  // a drive letter looks like a URL scheme, so it is judged first
  if (/^[A-Za-z]:/.test(url)) {
    return { err: noun + " must be relative, not a drive letter" };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return { err: noun + " must be a relative path, not a URL" };
  }
  if (isAbsolute(url) || url.startsWith("/") || url.startsWith("\\")) {
    return { err: noun + " must be relative" };
  }
  if (!url.endsWith(ext)) {
    return { err: noun + " must end in `" + ext + "`" };
  }

  for (const segment of url.split(/[\\/]/)) {
    if (WINDOWS_DEVICE.test(segment)) {
      return { err: noun + " uses a reserved device name `" + segment + "`" };
    }
  }

  const base = reader.realpath(dirname(resolve(doc.path)));
  const target = resolve(base, url);

  if (!contains(base, target)) {
    return { err: noun + " escapes the document's directory" };
  }

  // A symlink is resolved before the containment check, or the check is
  // trivially bypassed by pointing a link out of the tree.
  if (reader.exists(target)) {
    const real = reader.realpath(target);
    if (real !== target && !contains(base, real)) {
      return { err: noun + " resolves through a symlink out of the document's directory" };
    }
  }
  const parent = dirname(target);
  if (reader.exists(parent)) {
    const realParent = reader.realpath(parent);
    if (realParent !== parent && !contains(base, realParent)) {
      return { err: noun + " resolves through a symlink out of the document's directory" };
    }
  }

  return { ok: target };
}

function contains(base: string, target: string): boolean {
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep);
}
