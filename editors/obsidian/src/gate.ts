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
 * **It asks the engine, and that is the point — in two steps.** `mightHaveBlock`
 * answers "cannot possibly be" with a substring scan, and only what survives
 * that pays for `locate()` — the same parse the CLI keys on — to answer "is".
 * Neither half is a regular expression standing in for the real question, a
 * frontmatter key nor a folder: any second gate is a second definition of *is
 * this a VisiMark document*, and a second definition can disagree with the
 * CLI's. A regex would also be wrong in the ordinary way a substring scan is
 * not: a ```vmark fence inside a fenced code block is not a block, and only a
 * parse knows that — `mightHaveBlock` says yes to it on purpose and `locate`
 * says no.
 *
 * `locate` parses the whole note, and that only runs for a note the substring
 * scan cannot rule out. The caller is still responsible for not asking on
 * every keystroke — see `analysis.ts`'s memo and `live-preview.ts`, which
 * debounces the parse it schedules.
 */
export function hasVmarkBlock(source: string): boolean {
  if (!mightHaveBlock(source)) return false;
  return locate(source).blocks.length > 0;
}

/**
 * **The prefilter, stated once.** `includes` rather than a regular
 * expression: the question is only whether a parse could possibly find a
 * block, and a substring scan answers it with no false negatives and no
 * backtracking. A `vmark` block's opening fence carries the info string
 * `vmark`, whatever the fence is made of — the engine accepts ``` and ~~~,
 * any length of either, indented or not — so every document `locate` would
 * find a block in contains the literal text. It produces false positives
 * freely; `hasVmarkBlock` and `sweep.ts` both reject them, and `gate.test.ts`
 * / `sweep.test.ts` assert the no-false-negative half over the corpus rather
 * than trusting the argument.
 */
export function mightHaveBlock(source: string): boolean {
  return source.includes("vmark");
}
