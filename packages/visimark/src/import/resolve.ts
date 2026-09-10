import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DocModel, Finding, ImportStatus } from "../model/types.js";
import type { RawCell, RawRow, RawTable, Span } from "../parse/document.js";
import { parseCsv } from "./csv.js";
import { resolveImportPath } from "./path.js";

const DIGEST_RE = /^[0-9a-f]{64}$/;
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BOM = "﻿";

/**
 * Resolves every imported (`from`) sheet's declaration against the
 * filesystem: the path gate, the SHA-256 stamp, and the CSV parse. On
 * success it mutates that `Sheet`'s `table`/`columnIndex`/`inputColumns` in
 * place, building a synthetic table the rest of the engine reads exactly as
 * it reads a real GFM table. On failure it emits the one finding that names
 * the problem and leaves the sheet table-less, so every binding reading its
 * columns falls through the ordinary `UNDEF`/`VECTOR` path a table-less sheet
 * already takes.
 *
 * See `docs/design/declared-local-data-imports-spec.md` §3–§4.
 */
export function resolveImports(
  model: DocModel,
  docPath: string | undefined,
): { findings: Finding[]; statuses: Map<string, ImportStatus> } {
  const findings: Finding[] = [];
  const statuses = new Map<string, ImportStatus>();

  for (const sheet of model.sheets.values()) {
    const decl = sheet.imported;
    if (!decl) continue;

    const fail = (message: string, span: Span, state: ImportStatus["state"] = "error"): void => {
      findings.push({ code: "IMPORT", sheetId: sheet.id, message, span, sourceOffset: span.start });
      statuses.set(sheet.id, { sheetId: sheet.id, target: null, digest: null, state });
    };

    if (docPath === undefined) {
      // no document path to resolve against — mirrors chart handling: valid,
      // but nothing on disk can be checked, so nothing is reported either
      statuses.set(sheet.id, { sheetId: sheet.id, target: null, digest: null, state: "skipped" });
      continue;
    }

    const gated = resolveImportPath(docPath, decl.path);
    if ("err" in gated) {
      fail(gated.err, decl.pathSpan);
      continue;
    }

    let raw: Buffer;
    try {
      raw = readFileSync(gated.ok);
    } catch {
      fail("imported file not found: `" + decl.path + "`", decl.pathSpan);
      continue;
    }

    const digest = createHash("sha256").update(raw).digest("hex");

    // stamp clause well-formedness, checked before content — a malformed
    // stamp is a structural problem, judged without reading the file's data
    if (decl.stampSpan) {
      if (decl.stampPrefix !== "sha256") {
        fail(
          "unrecognised stamp prefix `" + (decl.stampPrefix ?? "") + "` — only `sha256:` is supported",
          decl.stampSpan,
        );
        continue;
      }
      const dig = decl.stampDigest ?? "";
      if (!DIGEST_RE.test(dig)) {
        const reason =
          dig.length !== 64
            ? "wrong length"
            : /[A-F]/.test(dig)
              ? "uppercase hex"
              : "non-hex character";
        fail("malformed digest (" + reason + ")", decl.stampSpan);
        continue;
      }
    }

    // stamp match — checked before parsing content: a changed file is a
    // changed file whether or not its bytes still parse as CSV
    let state: ImportStatus["state"] = "ok";
    if (decl.stampSpan && decl.stampDigest !== digest) {
      findings.push({
        code: "STALE",
        sheetId: sheet.id,
        artifact: decl.path,
        message:
          `\`${decl.path}\` does not match its recorded stamp — ` +
          `expected sha256:${decl.stampDigest}, got sha256:${digest}`,
        span: decl.stampSpan,
        sourceOffset: decl.stampSpan.start,
      });
      state = "stale";
    } else if (!decl.stampSpan) {
      state = "unstamped";
    }

    const bomStripped = raw.toString("utf8").startsWith(BOM)
      ? raw.toString("utf8").slice(1)
      : raw.toString("utf8");

    const parsed = parseCsv(bomStripped, decl.delimiter);
    if (!parsed.ok) {
      fail(parsed.message, decl.declSpan);
      continue;
    }

    const dupes = new Set<string>();
    const seen = new Set<string>();
    for (const h of parsed.header) {
      if (seen.has(h)) dupes.add(h);
      seen.add(h);
    }
    if (dupes.size > 0) {
      fail(
        "duplicate column " +
          [...dupes].map((d) => "`" + d + "`").join(", ") +
          " in imported header",
        decl.declSpan,
      );
      continue;
    }

    const badId = parsed.header.find((h) => !IDENTIFIER_RE.test(h));
    if (badId !== undefined) {
      fail("imported column `" + badId + "` is not a valid identifier", decl.declSpan);
      continue;
    }

    if (decl.labels) {
      const same =
        decl.labels.length === parsed.header.length &&
        decl.labels.every((l, i) => l === parsed.header[i]);
      if (!same) {
        fail(
          "labelled header does not match: expected [" +
            decl.labels.join(", ") +
            "], got [" +
            parsed.header.join(", ") +
            "]",
          decl.labelsSpan ?? decl.declSpan,
        );
        continue;
      }
    }

    // success: build a synthetic table the rest of the engine reads exactly
    // as a real GFM table — every cell's span is the declaration's own span,
    // since a CSV field has no location in the document
    const placeholder: Span = decl.declSpan;
    const headers: RawCell[] = parsed.header.map((text) => ({ text, ...placeholder }));
    const rows: RawRow[] = parsed.rows.map((r) => ({
      cells: r.map((text) => ({ text, ...placeholder })),
    }));
    const table: RawTable = { headers, rows, span: placeholder };

    sheet.table = table;
    sheet.columnIndex = new Map(parsed.header.map((h, i) => [h, i]));
    sheet.inputColumns = new Set(parsed.header);

    // a binding whose name shadows an imported column is not a column rule —
    // there is no cell to write — so it is pulled out of `scalars` and
    // reported instead (spec §2, "An imported sheet has no column rules")
    for (const name of parsed.header) {
      const shadow = sheet.scalars.get(name);
      if (!shadow) continue;
      sheet.scalars.delete(name);
      findings.push({
        code: "IMPORT",
        sheetId: sheet.id,
        name,
        message: "column rule on an imported sheet: `" + name + "` is a read-only imported column",
        span: shadow.span,
        sourceOffset: shadow.span.start,
      });
    }

    if (state === "unstamped") {
      findings.push({
        code: "IMPORT",
        sheetId: sheet.id,
        message: "unstamped import",
        span: decl.declSpan,
        sourceOffset: decl.declSpan.start,
      });
    }

    statuses.set(sheet.id, { sheetId: sheet.id, target: gated.ok, digest, state });
  }

  return { findings, statuses };
}
