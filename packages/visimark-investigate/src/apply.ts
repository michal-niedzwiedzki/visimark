import type { Edit } from "./types.js";

/** `edits` applied to `text`. Throws when an edit's `old` is not what sits at `from..to`. */
export function applyEdits(text: string, edits: Edit[]): string {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) {
    if (text.slice(e.from, e.to) !== e.old) {
      throw new Error(
        `edit at ${e.from} expects ${JSON.stringify(e.old)}, found ${JSON.stringify(text.slice(e.from, e.to))}`,
      );
    }
    out = out.slice(0, e.from) + e.new + out.slice(e.to);
  }
  return out;
}
