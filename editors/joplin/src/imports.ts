import type { DocModel, Edit, Finding } from "visimark";
import { hasImportedSheet, importDependentNames } from "codemirror-visimark/import-deps.js";

/**
 * What the plugin cannot check: anything that depends on an import (#384
 * spec §1, "Imports"). A note has no path in Joplin and there is no reader,
 * so a `from x.csv` sheet is never read. Every command drops the findings,
 * edits and values that depend on one — the rule the editor marks already
 * follow — checks everything else, and says once that it did.
 */
export interface ImportScope {
  /** the note declares an imported sheet, so some values were not checked */
  readonly dropped: boolean;
  readonly finding: (f: Finding) => boolean;
  readonly name: (qualified: string) => boolean;
  readonly edit: (e: Edit) => boolean;
}

const NONE: ImportScope = {
  dropped: false,
  finding: () => false,
  name: () => false,
  edit: () => false,
};

export function importScope(model: DocModel, findings: readonly Finding[]): ImportScope {
  if (!hasImportedSheet(model)) return NONE;
  const names = importDependentNames(model);
  const sheets = new Set<string>();
  for (const sheet of model.sheets.values()) if (sheet.imported !== null) sheets.add(sheet.id);

  const sheetOf = (qualified: string): string =>
    qualified.includes(".") ? qualified.slice(0, qualified.indexOf(".")) : "";
  const name = (qualified: string): boolean =>
    names.has(qualified) || sheets.has(sheetOf(qualified));
  const qualify = (sheetId: string | undefined, n: string): string =>
    sheetId ? `${sheetId}.${n}` : n;

  const finding = (f: Finding): boolean => {
    if (f.code === "IMPORT") return true;
    if (f.sheetId !== undefined && sheets.has(f.sheetId)) return true;
    if (f.name !== undefined && name(qualify(f.sheetId, f.name))) return true;
    // a column of an unread sheet looks like a typo: `order.Total` is UNDEF
    // only because the CSV that defines it was never read
    return f.code === "UNDEF" && f.raw !== undefined && sheets.has(sheetOf(f.raw));
  };

  // An edit belongs to a dropped finding when it sits on that finding's span,
  // or on the value of an anchor that names an import-dependent value.
  const spans = findings.filter(finding).flatMap((f) => (f.span ? [f.span] : []));
  for (const a of model.anchors) {
    if (a.value && name(qualify(a.sheetId, a.name))) spans.push(a.value);
  }
  const edit = (e: Edit): boolean => spans.some((s) => e.start < s.end && s.start < e.end);

  return { dropped: true, finding, name, edit };
}
