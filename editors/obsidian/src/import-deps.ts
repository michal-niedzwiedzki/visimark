import { topoOrder, type DocModel } from "visimark";

/**
 * Which qualified names read an imported sheet's data, directly or through
 * another binding — review row 6, §2.2's Live Preview half.
 *
 * **Why this exists at all.** Live Preview decorates synchronously, with no
 * `ReaderPort` (`live-preview.ts`'s own header explains why). For a value
 * whose formula never touches an imported sheet, that reader-less `check` is
 * the right answer and the snapshot can only agree with it. For a value that
 * does — directly, by being declared inside a `from … .csv` sheet's own
 * block, or transitively, through a binding that is — the reader-less
 * `check` cannot tell `computed` from `disagrees`: it has never read the
 * file the value depends on. This is the predicate that tells the two apart,
 * so Live Preview can withhold the mark on the second kind until the
 * snapshot resolves rather than asserting the first kind's answer for both.
 *
 * **Membership, not `resolve()`, is what has to answer this.** `sheet.table`,
 * `columnIndex` and `inputColumns` for a `from`-declared sheet are populated
 * by `resolveImports` — `check`'s own first phase — from the CSV itself, not
 * from `build()`. Before that phase has ever run (exactly the situation this
 * function is called in: a model built with no reader), an imported sheet is
 * still table-less, so any reference to one of its columns resolves
 * `"unknown"`, the same answer a genuine typo gets. `resolve()` therefore
 * cannot be asked "does this ref read an import" pre-check; it would say no
 * to every one of them. What survives pre-check is the declaration itself —
 * `sheet.imported !== null` comes from parsing the fence's own `from` clause,
 * not from reading the file it names — so the base case here is simpler and
 * sturdier than a ref-kind check: **a binding declared inside an imported
 * sheet's own block is reading that sheet's data by construction**, whether
 * its own reference to a column is qualified, unqualified, or would (once
 * the CSV is actually read) turn out to be a column rule rather than a
 * scalar. The transitive walk over `deps` — which *does* resolve correctly
 * pre-check, because every edge in it is a reference to another *declared*
 * binding, never to a bare input column — is what carries that past the
 * imported sheet's own boundary to anything built on top of it.
 */
export function importDependentNames(model: DocModel): ReadonlySet<string> {
  const importedSheetIds = new Set<string>();
  for (const sheet of model.sheets.values()) {
    if (sheet.imported !== null) importedSheetIds.add(sheet.id);
  }
  if (importedSheetIds.size === 0) return new Set();

  const { depMap, order } = topoOrder(model);
  const bindingById = new Map(order.map((b) => [b.id, b] as const));

  const memo = new Map<string, boolean>();
  const computesFromImport = (id: string): boolean => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    memo.set(id, false); // cycle guard: a self-referential binding answers `false` mid-walk
    let result = importedSheetIds.has(bindingById.get(id)?.sheetId ?? "");
    if (!result) {
      for (const depId of depMap.get(id)?.deps ?? []) {
        if (bindingById.has(depId) && computesFromImport(depId)) {
          result = true;
          break;
        }
      }
    }
    memo.set(id, result);
    return result;
  };

  const dependent = new Set<string>();
  for (const binding of order) {
    if (binding.name === "") continue; // an assertion or chart node, never a decorated name
    if (computesFromImport(binding.id)) {
      dependent.add(binding.sheetId === "" ? binding.name : `${binding.sheetId}.${binding.name}`);
    }
  }
  return dependent;
}
