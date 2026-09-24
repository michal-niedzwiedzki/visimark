import {
  check,
  dependencies,
  evalValues,
  type Binding,
  type Finding,
  type JsonValue,
} from "visimark";
import { readNote, type VaultRead } from "./snapshot.js";

/**
 * The plugin's public API — v1 row 9 of #176, and the architectural claim of
 * the whole fork, shipped rather than argued.
 *
 * #176 states what it is for in one line: it replaces *an LLM reads Markdown
 * and calculates* with *an LLM asks, and VisiMark calculates*. The same
 * applies to a second plugin. Reached as
 * `app.plugins.plugins["visimark"].api`.
 *
 * **Every method is async**, because every one of them goes through the
 * vault snapshot (`snapshot.ts`): a note's declared imports have to be
 * fetched before it can be checked, and a vault adapter is asynchronous.
 *
 * **Values are strings, never numbers** (spec §2.7). What the string buys is
 * **exactness**: the engine's arithmetic is decimal, and a round trip through
 * a JavaScript number is a round trip through binary floating point — the
 * thing `visimark-design.md` says no document should ever contain.
 *
 * §2.7 argues it from the declared width instead — "`686.0000` and `686` are
 * different renderings of one value" — and that is true of a *cell* and not of
 * an evaluated value. The engine renders a value with `Decimal.toString()`,
 * which normalises: `eval --get lines.net_total` on the worked invoice prints
 * `23300`, from a cell that reads `23300.00`. The width lives in the document,
 * `fmt` is what writes it, and this API reports values. `api.test.ts` pins
 * both halves so the distinction cannot quietly become the other claim.
 *
 * **`apiVersion` is semver'd from day one and a bump is a breaking change with
 * no migration channel** — the same property that freezes the MCP tool names.
 * That is why `explain` returns a shape defined here rather than the engine's
 * `ExplainView`: see `Explanation`.
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

export interface VisiMarkApi {
  readonly apiVersion: 1;
  /** every finding in the note, in the engine's own shape */
  check(file: unknown): Promise<Finding[]>;
  /** every named value in the note, keyed `sheet.name` */
  evaluate(file: unknown): Promise<Record<string, JsonValue>>;
  /** one named value, or `null` if the note does not define it */
  get(file: unknown, name: string): Promise<JsonValue | null>;
  /** what one name is, or `null` if the note does not define it */
  explain(file: unknown, name: string): Promise<Explanation | null>;
}

/**
 * Build the API.
 *
 * `resolve` turns whatever a caller passes — a `TFile`, a vault path — into a
 * path, or `null`. It is a parameter so this module never imports `obsidian`
 * and the whole surface can be exercised against a `Map`, which is what
 * `api.test.ts` does.
 */
export function createApi(read: VaultRead, resolve: (file: unknown) => string | null): VisiMarkApi {
  async function analyse(file: unknown) {
    const path = resolve(file);
    if (path === null) throw new Error("visimark: that is not a note in this vault");
    const source = await read(path);
    if (source === null) throw new Error(`visimark: cannot read ${path}`);
    const { model, snapshot } = await readNote(source, path, read);
    const result = check(model, {
      doc: { path: snapshot.path, reader: snapshot.reader },
    });
    return { model, result };
  }

  function bindingOf(
    model: Awaited<ReturnType<typeof analyse>>["model"],
    name: string,
  ): Binding | null {
    const dot = name.lastIndexOf(".");
    if (dot > 0) {
      const sheet = model.sheets.get(name.slice(0, dot));
      const local = name.slice(dot + 1);
      const found = sheet?.columns.get(local) ?? sheet?.scalars.get(local);
      if (found) return found;
    }
    return model.docScope.get(name) ?? null;
  }

  return {
    apiVersion: 1,

    async check(file) {
      return (await analyse(file)).result.findings;
    },

    async evaluate(file) {
      return evalValues((await analyse(file)).result);
    },

    async get(file, name) {
      // `evalValues` is the same function the CLI's `eval --json` uses, and
      // it renders each value with the same four lines `eval --get` does, so
      // this is the CLI's answer rather than a second one that could drift.
      // Manual test §2.9 is exactly that comparison.
      //
      // A column comes back as one entry per row rather than the CLI's
      // `", "`-joined line. Same values, and no rendering for a caller to
      // undo — the join is a terminal's business. §2.7 says `string`; the
      // reason it gives is that a value must not be a number, which an array
      // of strings is not.
      return evalValues((await analyse(file)).result)[name] ?? null;
    },

    async explain(file, name) {
      const { model, result } = await analyse(file);
      const binding = bindingOf(model, name);
      if (binding === null) return null;
      const info = dependencies(model, binding);
      return {
        name,
        kind: binding.kind,
        source: model.source.slice(binding.span.start, binding.span.end),
        value: evalValues(result)[name] ?? null,
        inputs: [...info.deps],
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
    },
  };
}
