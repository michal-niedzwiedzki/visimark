export interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Apply non-overlapping edits to `source` by byte offset. Edits are applied
 * right-to-left so earlier offsets stay valid. Overlapping edits throw.
 */
export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  let lastStart = source.length + 1;
  for (const e of sorted) {
    if (e.end > lastStart) {
      throw new Error(
        `overlapping edits at ${e.start}..${e.end} and ${lastStart}`,
      );
    }
    if (e.start < 0 || e.end > out.length || e.start > e.end) {
      throw new Error(`edit out of range: ${e.start}..${e.end}`);
    }
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    lastStart = e.start;
  }
  return out;
}
