/**
 * A hand-written RFC 4180 CSV parser — no dependency, matching the project's
 * "never `eval()`, hand-written parser" posture in `lang/`.
 *
 * This module knows nothing about VisiMark: it turns text into rows of
 * strings. Duplicate headers, identifier-shaped headers, `labelled` matching,
 * and cell-value type conversion are the caller's job (`import/resolve.ts`),
 * which has the declaration context this parser deliberately does not.
 *
 * See `docs/design/declared-local-data-imports-spec.md` §3.2.
 */

export type CsvResult =
  | { ok: true; header: string[]; rows: string[][] }
  | { ok: false; message: string };

export function parseCsv(text: string, delimiter: string): CsvResult {
  if (text.length === 0) return { ok: false, message: "empty file (not even a header row)" };

  const hasCrlf = text.includes("\r\n");
  // a bare `\r` not part of `\r\n` also counts as "the other" line ending
  const bareLf = text.replace(/\r\n/g, "").includes("\n");
  const bareCr = text.replace(/\r\n/g, "").includes("\r");
  if (hasCrlf && (bareLf || bareCr)) {
    return { ok: false, message: "mixed line endings — the file mixes CRLF and bare LF/CR" };
  }

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const endField = (): void => {
    row.push(field);
    field = "";
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      endField();
      i++;
      continue;
    }
    if (c === "\r" && text[i + 1] === "\n") {
      endRow();
      i += 2;
      continue;
    }
    if (c === "\n" || c === "\r") {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  if (inQuotes) return { ok: false, message: "unterminated quoted field" };

  // a trailing newline leaves nothing pending; without one, the last row's
  // final field is still open and needs to be closed off
  if (field !== "" || row.length > 0) {
    endRow();
  }
  if (rows.length === 0) {
    return { ok: false, message: "empty file (not even a header row)" };
  }

  const [header, ...body] = rows;
  return { ok: true, header: header!, rows: body };
}
