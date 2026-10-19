/**
 * The playground's colours for `vmark` tokens (#367 spec §4.5), kept apart
 * from editor.ts so the contrast test can read them without CodeMirror. Only
 * the hues the editor already used; each reaches 4.5:1 on the background.
 */

/** `.editor` is rgba(0, 0, 0, 0.9) over the page's #1b1b1b. */
export const EDITOR_BACKGROUND = "#030303";

export const VMARK_PALETTE = {
  /** keyword, operatorKeyword, atom */
  keyword: "#ffb454",
  /** function(variableName), typeName */
  callable: "#79c0ff",
  /** number, literal, unit */
  literal: "#7ee787",
  /** string (italic), definition(variableName) (weight 600) */
  text: "#e6e6e6",
  /** comment, the rule the editor already had */
  comment: "#7d7d7d",
} as const;
