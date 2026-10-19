/**
 * What the plugin says, spelled exactly as #384 spec §2.6 spells it. N1, C1,
 * X1, T1 and T2 match the Obsidian plugin's wording.
 */
export const MESSAGES = {
  N1: "This note has no VisiMark block, so there is nothing to check in it yet.",
  C1: "Everything in this note agrees with its formulas.",
  F2: "This note could not be checked, so nothing was changed.",
  X1: "Put the cursor on a value VisiMark works out, and ask again.",
  A1: "This note changed while VisiMark was working it out. Try again.",
  R1: "VisiMark commands work in the Markdown editor. Switch to it and try again.",
  T1: "This note already has a VisiMark block. Insert the template into a new note instead.",
  T2: "Could not find a place to insert the template. Try a new, empty note.",
  I1: "This note reads another file, which Joplin cannot open. Values that depend on it were not checked.",
} as const;

/** F1 */
export function applied(n: number): string {
  return `Applied ${n} ${n === 1 ? "repair" : "repairs"}.`;
}

/** I1, appended as a last line when it applies */
export function withImports(message: string, importsDropped: boolean | undefined): string {
  return importsDropped ? `${message}\n\n${MESSAGES.I1}` : message;
}
