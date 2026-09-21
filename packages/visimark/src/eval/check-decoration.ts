import type { CheckState } from "./check-state.js";
import { rowLabel } from "./check-lookup.js";
import { inferColumnUnit, parseDecorated } from "./units.js";

/** the inference pass reads the tables and writes the two decoration maps */
type DecorationState = Pick<CheckState, "model" | "columnUnits" | "unitConflicts" | "emit">;

/**
 * A column's decoration is inferred from its own cells, exactly as write
 * precision is. Input columns count too: a computed neighbour never inherits
 * their decoration, but a reader still sees it.
 *
 * Writes the two decoration maps and nothing else; it runs before the binding
 * loop because a computed column's unit check compares against what its own
 * cells already say.
 */
export function inferDecoration(st: DecorationState): void {
  for (const sheet of st.model.sheets.values()) {
    const table = sheet.table;
    if (!table) continue;
    for (const [name, idx] of sheet.columnIndex) {
      const colId = `${sheet.id}.${name}`;
      const texts = table.rows.map((r) => r.cells[idx]?.text);

      const bothSidesRow = texts.findIndex((t) => parseDecorated(t ?? "").kind === "both-sides");
      if (bothSidesRow !== -1) {
        const cell = table.rows[bothSidesRow]!.cells[idx];
        st.unitConflicts.add(colId);
        st.columnUnits.set(colId, null);
        st.emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, bothSidesRow),
            raw: texts[bothSidesRow],
            message: `\`${texts[bothSidesRow]}\` is decorated on both sides; a unit sits before the number or after it, not both`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
        continue;
      }

      const inferred = inferColumnUnit(texts);
      st.columnUnits.set(colId, inferred.unit);
      if (inferred.conflict) {
        st.unitConflicts.add(colId);
        const row = inferred.firstDeviantRow!;
        const cell = table.rows[row]!.cells[idx];
        st.emit(
          {
            code: "UNIT",
            sheetId: sheet.id,
            name,
            rowLabel: rowLabel(table, row),
            raw: texts[row],
            message: `column mixes units: ${inferred.forms.join(" and ")}`,
            span: cell ? { start: cell.start, end: cell.end } : undefined,
          },
          { sheetId: sheet.id },
        );
      }
    }
  }
}
