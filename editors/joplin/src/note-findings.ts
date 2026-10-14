import { hasVmarkBlock } from "codemirror-visimark/gate.js";
import { build, check, describeFinding, isProblem, locate, type Finding } from "visimark";
import { importScope } from "./imports.js";

/**
 * One note's findings, for the findings panel and the sweep (#384 spec
 * §2.5), in the CLI's wording: `describeFinding`, as Joplin's diagnostics
 * already say it. Reader-less, so whatever depends on an import is dropped.
 */

export interface FindingRow {
  /** `{CODE} {name}{ · rowLabel}` */
  readonly label: string;
  readonly text: string;
  readonly span?: { readonly start: number; readonly end: number };
}

export type NoteFindings =
  | { readonly kind: "no-block" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "findings";
      readonly rows: FindingRow[];
      /** counted with `isProblem` */
      readonly problems: number;
      /** `WARN` findings: advice, never a problem */
      readonly advice?: number;
      readonly importsDropped: boolean;
    };

export function noteFindings(body: string): NoteFindings {
  if (!hasVmarkBlock(body)) return { kind: "no-block" };
  try {
    const model = build(locate(body));
    const result = check(model);
    const imports = importScope(model, result.findings);
    const kept = imports.kept.filter((f) => f.code !== "NOTE");
    // document order; a finding with no single site (the anchor group) last
    const ordered = [...kept].sort(
      (a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity),
    );
    return {
      kind: "findings",
      rows: ordered.map(rowFor),
      problems: kept.filter(isProblem).length,
      advice: kept.filter((f) => f.code === "WARN").length,
      importsDropped: imports.dropped,
    };
  } catch {
    return { kind: "failed" };
  }
}

function rowFor(f: Finding): FindingRow {
  const name = f.name === undefined ? "" : f.sheetId ? ` ${f.sheetId}.${f.name}` : ` ${f.name}`;
  const row = f.rowLabel === undefined ? "" : ` · ${f.rowLabel}`;
  const label = `${f.code}${name}${row}`;
  const text = describeFinding(f);
  return f.span === undefined
    ? { label, text }
    : { label, text, span: { start: f.span.start, end: f.span.end } };
}
