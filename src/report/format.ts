import type { Finding } from "../model/types.js";

const CONTENT_COL = 10; // where the payload after the code field starts
const ID_FIELD = 16; // id padded to this width, so `·` lands at column 26
const STORED_END = 49; // the id+label+stored field is this wide (cols 10..58)
const COMPUTED_FIELD = 11; // computed value padded to this before the formula
const DATE_VALUE_COL = 50; // where the quoted raw date sits
const CONT = " ".repeat(CONTENT_COL);

const ERROR_CODES = new Set([
  "DATE",
  "UNIT",
  "UNDEF",
  "DUP",
  "VECTOR",
  "CYCLE",
  "TYPE",
  "SHEET",
  "ANCHOR",
]);

export function formatCheck(path: string, findings: Finding[]): string {
  const lines: string[] = [path, ""];

  const stale = findings.filter((f) => f.code === "STALE");
  const rest = findings.filter((f) => f.code !== "STALE");

  for (const f of stale) lines.push(staleLine(f));

  if (rest.length > 0) {
    lines.push("");
    rest.forEach((f) => {
      lines.push(...renderGroup(f));
      lines.push("");
    });
  } else if (stale.length > 0) {
    lines.push("");
  }

  lines.push(footer(findings));
  return lines.join("\n");
}

function prefix(code: string): string {
  return "  " + code.padEnd(8);
}

function id(f: Finding): string {
  return `${f.sheetId ?? ""}.${f.name ?? ""}`;
}

function staleLine(f: Finding): string {
  if (f.anchorGroup) {
    return (
      prefix("STALE") +
      `${f.suppressedCount} prose anchors bound to the values above`
    );
  }
  const left = f.rowLabel
    ? id(f).padEnd(ID_FIELD) + "· " + f.rowLabel
    : id(f);
  const stored = f.stored ?? "";
  const pad = Math.max(1, STORED_END - left.length);
  const computed = f.formula
    ? (f.computed ?? "").padEnd(COMPUTED_FIELD) + f.formula
    : (f.computed ?? "");
  return prefix("STALE") + left + stored.padStart(pad) + " ≠ " + computed;
}

function renderGroup(f: Finding): string[] {
  switch (f.code) {
    case "DATE": {
      const head =
        prefix("DATE") +
        id(f).padEnd(ID_FIELD) +
        "· " +
        (f.rowLabel ?? "").padEnd(DATE_VALUE_COL - 28) +
        `"${f.raw}"`;
      const body = [
        CONT + "Dates must be ISO 8601 calendar dates: YYYY-MM-DD.",
      ];
      if (f.isoFix) {
        body.push(
          CONT +
            "Unambiguous — `visimark fmt --fix-dates` rewrites it to " +
            f.isoFix +
            ".",
        );
      } else if (f.altA && f.altB) {
        body.push(
          CONT +
            `Ambiguous: ${f.altA} or ${f.altB}, ${f.daysApart} days apart. Fix by hand.`,
        );
      } else {
        body.push(CONT + "Fix by hand.");
      }
      return [head, ...body];
    }
    case "NOTE":
      return [
        prefix("NOTE") + id(f).padEnd(ID_FIELD) + "· " + (f.message ?? ""),
      ];
    case "UNDEF":
      return [
        prefix("UNDEF") + id(f).padEnd(ID_FIELD) + "  " + "unknown name `" + f.raw + "`",
        ...(f.suggestion ? [CONT + "did you mean `" + f.suggestion + "`?"] : []),
      ];
    case "DUP":
      return [
        prefix("DUP") +
          id(f).padEnd(ID_FIELD) +
          "  " +
          "`" +
          (f.name ?? "") +
          "` is already defined in this scope",
        CONT + "the first binding wins; delete or rename one of them",
      ];
    case "VECTOR":
      return [
        prefix("VECTOR") +
          id(f).padEnd(ID_FIELD) +
          "  " +
          "`" +
          f.raw +
          "` is a column, not a value.",
        CONT + "Wrap it in an aggregate: SUM(" + f.raw + ")",
      ];
    case "CYCLE":
      return [prefix("CYCLE") + (f.cyclePath ?? []).join(" → ")];
    case "SHEET":
      return [
        prefix("SHEET") + id(f).padEnd(ID_FIELD) + "  " + (f.message ?? ""),
      ];
    case "ANCHOR":
      return [
        prefix("ANCHOR") +
          id(f).padEnd(ID_FIELD) +
          "  " +
          "no value to rewrite in front of this anchor",
      ];
    case "TYPE":
      return [
        prefix("TYPE") +
          id(f).padEnd(ID_FIELD) +
          (f.rowLabel ? "· " + f.rowLabel + "  " : "  ") +
          (f.message ?? ""),
      ];
    case "WARN":
      return [
        prefix("WARN") +
          id(f).padEnd(ID_FIELD) +
          "  " +
          "defined and never read" +
          (f.suggestion ? ` — did you mean \`${f.suggestion}\`?` : ""),
      ];
    default:
      return [prefix(f.code) + id(f)];
  }
}

function footer(findings: Finding[]): string {
  let stale = 0;
  let errors = 0;
  for (const f of findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? f.suppressedCount ?? 0 : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  const problems = stale + errors;
  return `  ${problems} problem${problems === 1 ? "" : "s"} (${stale} stale, ${errors} error${errors === 1 ? "" : "s"})`;
}
