import {
  dependencies,
  evalValues,
  type Binding,
  type CheckResult,
  type DocModel,
  type JsonValue,
} from "visimark";

/**
 * What `explain` reports for one binding — moved out of the Obsidian plugin's
 * `api.ts` (#384) so the Joplin plugin's tooltip and Explain command give the
 * same answer. Obsidian's `VisiMarkApi.explain` returns this shape, so it is
 * frozen with `apiVersion`.
 */

/** What one binding is, and where its value came from. */
export interface Explanation {
  /** the qualified name, as a caller would write it: `lines.net_total` */
  readonly name: string;
  readonly kind: "column" | "scalar";
  /**
   * The binding line, verbatim out of the note — `Net = Qty * Rate`.
   *
   * The document's own text rather than a re-rendering of the parsed
   * expression: a caller showing this to a person should show what the person
   * wrote, and a caller feeding it to a model should feed the same.
   */
  readonly source: string;
  /** the value, as a string — or an array for a column, one entry per row */
  readonly value: JsonValue | null;
  /** every name this one reads, qualified, in the order the expression names them */
  readonly inputs: readonly string[];
  /** the write precision `check` settled on, when there is one */
  readonly precision: number | null;
}

/**
 * `explain`'s logic, taking an already-checked `model`/`result` rather than a
 * file to read.
 *
 * **Why this is a separate function from `createApi`'s `explain` method.**
 * `createApi`'s `explain` reads the note through `analyse`, which goes
 * through `vault.cachedRead` — the last *saved* text. `main.ts`'s Explain
 * command already has a live, unsaved editor buffer parsed and checked
 * (`noteFor`); routing it through `api.explain(file, name)` instead would
 * silently answer from the saved copy on a dirty note. Exporting this piece
 * lets both callers share the one implementation over whichever `model` and
 * `result` they already have.
 */
export function explainBinding(
  model: DocModel,
  result: CheckResult,
  name: string,
): Explanation | null {
  const binding = bindingOf(model, name);
  if (binding === null) return null;
  const info = dependencies(model, binding);
  return {
    name,
    kind: binding.kind,
    source: model.source.slice(binding.span.start, binding.span.end),
    value: evalValues(result)[name] ?? null,
    inputs: qualifiedInputs(info),
    // `check` settles a write precision per column id and per binding id,
    // and `Binding.id` is `sheet.name` for both — the same key
    // `report/explain.ts` looks them up by.
    precision:
      (binding.kind === "column"
        ? result.columnPrecision.get(binding.id)
        : result.scalarPrecision.get(binding.id)) ??
      binding.precision ??
      null,
  };
}

function bindingOf(model: DocModel, name: string): Binding | null {
  const dot = name.lastIndexOf(".");
  if (dot > 0) {
    const sheet = model.sheets.get(name.slice(0, dot));
    const local = name.slice(dot + 1);
    const found = sheet?.columns.get(local) ?? sheet?.scalars.get(local);
    if (found) return found;
  }
  return model.docScope.get(name) ?? null;
}

/**
 * The qualified names `explain`'s `inputs` reports, in expression order.
 *
 * **Not `info.deps`.** `dependencies()` (`eval/graph.ts`) builds `deps` as a
 * binding-level dependency edge, and an `input-column` resolution is
 * deliberately excluded from it — "inputs are leaves" is the comment there,
 * because a human-entered column has no rule of its own for the topological
 * sort to order against. But a leaf is still a name the expression reads, and
 * `inputs` promises "every name this one reads" (see `Explanation`), so this
 * walks `info.refs` instead: every resolved reference, in the order the
 * expression names it, deduplicated on first occurrence. `unknown` is
 * skipped — an undefined reference names nothing to report as an input.
 */
function qualifiedInputs(info: ReturnType<typeof dependencies>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { res } of info.refs) {
    let qualified: string | null;
    switch (res.kind) {
      case "column":
      case "scalar":
      case "doc-scalar":
        qualified = res.binding.id;
        break;
      case "input-column":
        qualified = `${res.sheetId}.${res.column}`;
        break;
      default:
        qualified = null; // "unknown" — an undefined reference names no input
    }
    if (qualified === null || seen.has(qualified)) continue;
    seen.add(qualified);
    out.push(qualified);
  }
  return out;
}
