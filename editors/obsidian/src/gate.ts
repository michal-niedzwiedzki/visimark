import { locate } from "visimark";

/**
 * The activation gate: **does this note contain at least one ```vmark fence?**
 *
 * v1 constraint 4 of #176 — *activation is opt-in per note* — and the pass
 * condition of `docs/design/obsidian-manual-test.md` §2.1: a vault of ordinary
 * notes must be indistinguishable from one without the plugin installed. Every
 * surface the plugin ever grows is gated on this one predicate, so it is one
 * function with one definition.
 *
 * **It asks the engine, and that is the point.** The gate is `locate()` —
 * the same parse the CLI keys on — and not a regular expression, not a
 * frontmatter key and not a folder. Any second gate is a second definition of
 * *is this a VisiMark document*, and a second definition can disagree with the
 * CLI's; the plugin's whole claim is that a note means the same thing inside
 * and outside the vault. A regex would also be wrong in the ordinary way: a
 * ```vmark fence inside a fenced code block is not a block, and only a parse
 * knows that.
 *
 * `locate` parses the whole note. That is the cost of asking the real question,
 * and the caller is responsible for not asking it on every keystroke — see
 * `main.ts`, which debounces.
 */
export function hasVmarkBlock(source: string): boolean {
  return locate(source).blocks.length > 0;
}
