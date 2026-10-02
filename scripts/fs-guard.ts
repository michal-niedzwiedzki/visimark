/**
 * `repo:pr` writes into a clone of a repo it doesn't control — unlike the
 * ordinary CLI, where the user is trusted to not attack themselves. A
 * malicious repo can track `.github/workflows` (or any Markdown file
 * `infer`/`fmt` is about to rewrite) as a symlink to a path outside the
 * clone; git materializes that link on checkout, and an ordinary
 * `writeFileSync`/`mkdirSync` follows it without complaint, writing
 * attacker-chosen content wherever the link points — as the user running
 * this tool, not as the attacker. `isConfined` refuses that: every existing
 * path component between `root` and `target`, including `target` itself if
 * it already exists, must not be a symlink, and `target` must resolve
 * strictly under `root`.
 *
 * This is a narrow, targeted guard for the one new risk surface this repo's
 * write path introduced (operating on untrusted clones), not a general
 * replacement for `packages/visimark/src/fs/gate.ts`'s TOCTOU-safe reads —
 * that guards the engine's own import resolution; this guards the two
 * plain `writeFileSync`/`mkdirSync` call sites `repo-pr.ts` added.
 */
import { lstatSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

export function isConfined(root: string, target: string): boolean {
  const rel = relative(root, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  let current = root;
  for (const segment of rel.split(sep)) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return false;
    } catch {
      // Doesn't exist yet — nothing to follow, and every component checked
      // so far up to here is confirmed not a symlink.
    }
  }
  return true;
}
