import type { JsonValue } from "visimark";

/**
 * What **Evaluate** shows: every name in the note and what it currently works
 * out to.
 *
 * A display shape, and only that. The API (`api.ts`) keeps a column as one
 * value per row because a caller should not have to undo a rendering; a person
 * reading a list wants a line. The join happens here, once, where it is seen.
 */

export interface ValueRow {
  /** the qualified name, as the document defines it */
  readonly name: string;
  /** what it works out to, as a line */
  readonly value: string;
  /** a column has one value per row; a scalar has one */
  readonly kind: "column" | "scalar";
}

/** the CLI's own separator for a column under `eval --get` */
const COLUMN_SEPARATOR = ", ";

/** the CLI's own placeholder for a cell that could not be computed */
const UNCOMPUTED = "?";

export function valueRows(values: Record<string, JsonValue>): ValueRow[] {
  return Object.entries(values)
    .map(([name, value]) =>
      Array.isArray(value)
        ? {
            name,
            kind: "column" as const,
            value: value.map((v) => v ?? UNCOMPUTED).join(COLUMN_SEPARATOR),
          }
        : { name, kind: "scalar" as const, value },
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The values as JSON, for a clipboard — v1 row 11 of #176.
 *
 * **It is the `values` object out of `visimark eval --json`, exactly.** Not a
 * reshaping of it: a person pasting this into a script, a spreadsheet or a
 * model prompt is pasting the contract
 * `docs/design/structured-output-json-spec.md` already specifies, and a second
 * shape would be a second contract that can drift from it. Columns stay arrays
 * with `null` for a cell that has no value, which is why the display join in
 * `valueRows` lives apart from this.
 *
 * Two-space indent and a trailing newline, matching the CLI's own `--json`
 * output, so a diff between something pasted from here and something piped
 * from there is empty rather than whitespace.
 */
export function valuesJson(values: Record<string, JsonValue>): string {
  return JSON.stringify(values, null, 2) + "\n";
}
