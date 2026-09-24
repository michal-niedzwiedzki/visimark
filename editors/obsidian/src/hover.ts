import type { Explanation } from "./api.js";

/**
 * The one line a hover shows — v1 row 3 of #176, which rates it 5 and gives
 * it one job: *"Makes row 2 legible rather than decorative."*
 *
 * Row 2 marks a value as derived. That is a claim, and until a reader can ask
 * *derived from what* it is a claim they have to take on trust. This is the
 * answer, and manual test §2.3 says what it has to contain: **the formula, its
 * inputs and the result**, with a cross-sheet input named.
 *
 * **It is the document's own text plus two joining words.** The formula shown
 * is the binding line verbatim — the reader wrote it — because §2.3's pass
 * condition is that the numbers match what `visimark explain` prints for the
 * same binding, and a paraphrase cannot meet that. What is translated is only
 * the frame: "comes to", "reads". A reader who has never seen a dependency
 * graph does not need the word.
 */

/**
 * `row` is which row of a column the reader is pointing at. A column's
 * explanation carries every row's value; a hover over one cell has to say
 * what *that* cell comes to, or it answers a question nobody asked.
 */
export function summaryFor(explanation: Explanation, row?: number): string {
  const parts = [explanation.source.trim()];

  const value = valueAt(explanation, row);
  if (value !== null) parts.push(`comes to ${value}`);

  if (explanation.inputs.length > 0) parts.push(`reads ${explanation.inputs.join(", ")}`);

  return parts.join(" · ");
}

function valueAt(explanation: Explanation, row?: number): string | null {
  const value = explanation.value;
  if (value === null) return null;
  if (!Array.isArray(value)) return value;
  if (row === undefined) return null;
  return value[row] ?? null;
}

/** `data-vmark-row` as a number, or `undefined` for an anchor. */
export function rowFrom(attribute: string | null): number | undefined {
  if (attribute === null) return undefined;
  const row = Number.parseInt(attribute, 10);
  return Number.isInteger(row) && row >= 0 ? row : undefined;
}
