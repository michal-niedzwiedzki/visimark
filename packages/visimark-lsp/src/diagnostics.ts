import {
  DiagnosticSeverity,
  type Diagnostic,
  type Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Finding, Span } from "visimark";
import type { Analysis } from "./analysis.js";

const SEVERITY: Record<string, DiagnosticSeverity> = {
  STALE: DiagnosticSeverity.Warning,
  DATE: DiagnosticSeverity.Error,
  UNIT: DiagnosticSeverity.Error,
  UNDEF: DiagnosticSeverity.Error,
  DUP: DiagnosticSeverity.Error,
  VECTOR: DiagnosticSeverity.Error,
  CYCLE: DiagnosticSeverity.Error,
  TYPE: DiagnosticSeverity.Error,
  SHEET: DiagnosticSeverity.Error,
  ANCHOR: DiagnosticSeverity.Warning,
  WARN: DiagnosticSeverity.Hint,
};

export function rangeOf(doc: TextDocument, span: Span): Range {
  return { start: doc.positionAt(span.start), end: doc.positionAt(span.end) };
}

export function messageOf(f: Finding): string {
  switch (f.code) {
    case "STALE":
      return f.formula
        ? `stored \`${f.stored}\`, formula gives \`${f.computed}\` (${f.formula})`
        : `stored \`${f.stored}\`, formula gives \`${f.computed}\``;
    case "DATE":
      if (f.isoFix) {
        return `dates must be ISO 8601 (YYYY-MM-DD); "${f.raw}" is unambiguous and can be rewritten to ${f.isoFix}`;
      }
      if (f.altA && f.altB) {
        return `"${f.raw}" is ambiguous: ${f.altA} or ${f.altB}, ${f.daysApart} days apart — fix by hand`;
      }
      return `dates must be ISO 8601 (YYYY-MM-DD); "${f.raw}" is not one`;
    case "UNIT":
      return f.message ?? "inconsistent unit decoration";
    case "UNDEF":
      return f.suggestion
        ? `unknown name \`${f.raw}\` — did you mean \`${f.suggestion}\`?`
        : `unknown name \`${f.raw}\``;
    case "DUP":
      return `\`${f.name}\` is already defined in this scope; the first binding wins`;
    case "VECTOR":
      return `\`${f.raw}\` is a column, not a value — wrap it in an aggregate, e.g. SUM(${f.raw})`;
    case "CYCLE":
      return `circular dependency: ${(f.cyclePath ?? []).join(" → ")}`;
    case "ANCHOR":
      return "no value to rewrite in front of this anchor";
    case "WARN":
      return f.suggestion
        ? `\`${f.name}\` is defined and never read — did you mean \`${f.suggestion}\`?`
        : `\`${f.name}\` is defined and never read`;
    case "TYPE":
      return f.suggestion
        ? `${f.message ?? "type error"} — did you mean \`${f.suggestion}\`?`
        : (f.message ?? "type error");
    default:
      return f.message ?? f.code;
  }
}

export function toDiagnostics(
  doc: TextDocument,
  analysis: Analysis,
): Diagnostic[] {
  if (!analysis.applicable) return [];
  const out: Diagnostic[] = [];
  for (const f of analysis.result.findings) {
    if (!f.span) continue; // NOTE and the collapsed anchor group have no site
    const d: Diagnostic = {
      range: rangeOf(doc, f.span),
      severity: SEVERITY[f.code] ?? DiagnosticSeverity.Information,
      code: f.code,
      source: "visimark",
      message: messageOf(f),
    };
    if (f.relatedSpan) {
      d.relatedInformation = [
        {
          location: { uri: doc.uri, range: rangeOf(doc, f.relatedSpan) },
          message: "first defined here",
        },
      ];
    }
    out.push(d);
  }
  return out;
}

export interface Status {
  uri: string;
  stale: number;
  errors: number;
}

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

export function statusOf(uri: string, analysis: Analysis): Status {
  let stale = 0;
  let errors = 0;
  for (const f of analysis.result.findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  return { uri, stale, errors };
}
