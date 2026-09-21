import type { DocumentFile } from "../fs/reader.js";
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
 *
 * `doc` is `undefined` when the document is not on a filesystem — the browser
 * playground's case. That is the same condition the old `docPath === undefined`
 * check tested, now stated structurally: without a `ReaderPort` there is no
 * `readSealed` to call, so the phase cannot reach a filesystem whether or not
 * one exists. See `fs/reader.ts`.
 */
export function resolveImports(
  model: DocModel,
  doc: DocumentFile | undefined,
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

    if (doc === undefined) {
      // no reader, so no document path to resolve against and nothing to read
      // — mirrors chart handling: valid, but nothing on disk can be checked,
      // so nothing is reported either
      statuses.set(sheet.id, { sheetId: sheet.id, target: null, digest: null, state: "skipped" });
      continue;
    }

    const gated = resolveImportPath(doc, decl.path);
    if ("err" in gated) {
      fail(gated.err, decl.pathSpan);
      continue;
    }

    // `readSealed`, not a plain read: the bytes come back from a descriptor
    // that cannot have followed a symlink, opened once and read through
    // rather than re-resolving the gated path. A link swapped in after the
    // gate would otherwise put an out-of-tree file's bytes into the model, and
    // from there into `check` output. An unstamped import - the common case
    // until `fmt` adds the stamp - has nothing to catch that afterwards. The
    // digest is of the bytes that descriptor produced, which is why it comes
    // back from the same call; see `fs/reader.ts`.
    const read = doc.reader.readSealed(gated.ok);
    if (read === null) {
      fail("imported file not found: `" + decl.path + "`", decl.pathSpan);
      continue;
    }
    const digest = read.sha256;

    // stamp clause well-formedness, checked before content — a malformed
    // stamp is a structural problem, judged without reading the file's data
    if (decl.stampSpan) {
      if (decl.stampPrefix !== "sha256") {
        fail(
          "unrecognised stamp prefix `" +
            (decl.stampPrefix ?? "") +
            "` — only `sha256:` is supported",
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

    const bomStripped = read.text.startsWith(BOM) ? read.text.slice(1) : read.text;

    const parsed = parseCsv(bomStripped, decl.delimiter);
    if (!parsed.ok) {
      fail(parsed.message, decl.declSpan);
      continue;
    }

    // `unlabelled`: row 1 is data, not a header — parseCsv always splits it
    // off, so it is reassembled onto the front of the row set here, and the
    // declared names stand in for the header everywhere below. See
    // docs/design/explicit-schema-for-headerless-csv-imports-spec.md §2–§4.
    const unlabelled = decl.labelsMode === "unlabelled";
    const names = unlabelled ? decl.labels! : parsed.header;
    const dataRows = unlabelled ? [parsed.header, ...parsed.rows] : parsed.rows;

    const dupes = new Set<string>();
    const seen = new Set<string>();
    for (const h of names) {
      if (seen.has(h)) dupes.add(h);
      seen.add(h);
    }
    if (dupes.size > 0) {
      fail(
        "duplicate column " +
          [...dupes].map((d) => "`" + d + "`").join(", ") +
          (unlabelled ? " in `unlabelled` declaration" : " in imported header"),
        unlabelled ? (decl.labelsSpan ?? decl.declSpan) : decl.declSpan,
      );
      continue;
    }

    const badId = names.find((h) => !IDENTIFIER_RE.test(h));
    if (badId !== undefined) {
      fail(
        unlabelled
          ? "declared column `" + badId + "` is not a valid identifier"
          : "imported column `" + badId + "` is not a valid identifier",
        unlabelled ? (decl.labelsSpan ?? decl.declSpan) : decl.declSpan,
      );
      continue;
    }

    if (!unlabelled && decl.labels) {
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

    // `unlabelled` only — no header row makes row width self-evident, so
    // every row's field count is validated against the declared name count.
    // A `labelled`/unasserted import validates none of this (spec §4:
    // ragged-row checking is new for `unlabelled` alone).
    if (unlabelled) {
      const raggedIndex = dataRows.findIndex((r) => r.length !== names.length);
      if (raggedIndex !== -1) {
        const row = dataRows[raggedIndex]!;
        const word = names.length < row.length ? "too few" : "too many";
        fail(
          `${word} names: declared ${names.length}, row ${raggedIndex + 1} has ${row.length} fields`,
          decl.labelsSpan ?? decl.declSpan,
        );
        continue;
      }
    }

    // success: build a synthetic table the rest of the engine reads exactly
    // as a real GFM table — every cell's span is the declaration's own span,
    // since a CSV field has no location in the document
    const placeholder: Span = decl.declSpan;
    const headers: RawCell[] = names.map((text) => ({ text, ...placeholder }));
    const rows: RawRow[] = dataRows.map((r) => ({
      cells: r.map((text) => ({ text, ...placeholder })),
    }));
    const table: RawTable = { headers, rows, span: placeholder };

    sheet.table = table;
    sheet.columnIndex = new Map(names.map((h, i) => [h, i]));
    sheet.inputColumns = new Set(names);

    // a binding whose name shadows an imported column is not a column rule —
    // there is no cell to write — so it is pulled out of `scalars` and
    // reported instead (spec §2, "An imported sheet has no column rules")
    for (const name of names) {
      const shadow = sheet.scalars.get(name);
      if (!shadow) continue;
      sheet.scalars.delete(name);
      if (shadow.param !== undefined) {
        // a param is never a column, imported or not — the same DUP as a param
        // named like an inline header (scenario-params-spec.md §4)
        findings.push({
          code: "DUP",
          sheetId: sheet.id,
          name,
          span: shadow.span,
          sourceOffset: shadow.span.start,
        });
        continue;
      }
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
