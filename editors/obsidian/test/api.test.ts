import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { build, check, evalValues, locate, type JsonValue } from "visimark";
import { createApi } from "../src/api.js";
import type { VaultRead } from "../src/snapshot.js";

/**
 * **Manual test §2.9 is a comparison, and so is this.** Its pass condition is
 * that the API's answer equals
 * `visimark eval docs/example-invoice.md --get lines.gross_total`, and that
 * the call is made against the documented surface with no reach into plugin
 * internals. The second half is what a person checks in a console; the first
 * is arithmetic, and arithmetic can be checked here.
 *
 * The API is built over a `Map` rather than a vault, which is the same trick
 * `sweep.test.ts` uses and the reason `api.ts` takes its reader and its path
 * resolver as parameters: nothing in it imports `obsidian`.
 */

const docs = resolvePath(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");

const files: Record<string, string> = {
  "example-invoice.md": read("example-invoice.md"),
  "example-invoice-drift.md": read("example-invoice-drift.md"),
  "notes/plain.md": "# Groceries\n\n- milk\n",
};

const vaultRead: VaultRead = (p) => Promise.resolve(files[p] ?? null);
const api = createApi(vaultRead, (f) => (typeof f === "string" ? f : null));

/** what `eval --get NAME` would print, from the engine, for comparison */
function cliValue(file: string, name: string): JsonValue | null {
  return evalValues(check(build(locate(files[file]!))))[name] ?? null;
}

test("apiVersion is 1, and it is not a guess a caller has to make", () => {
  expect(api.apiVersion).toBe(1);
});

test("get equals what the CLI would print for the same name", async () => {
  // §2.9's own example
  const name = "lines.gross_total";
  expect(await api.get("example-invoice.md", name)).toBe(cliValue("example-invoice.md", name));
  expect(await api.get("example-invoice.md", name)).toBe("28659");
});

test("every name in the document agrees with the CLI, not just the one", async () => {
  const mine = await api.evaluate("example-invoice.md");
  const theirs = evalValues(check(build(locate(files["example-invoice.md"]!))));
  expect(mine).toEqual(theirs);
  expect(Object.keys(mine).length).toBeGreaterThan(10);
});

test("values are strings, never numbers", async () => {
  const values = await api.evaluate("example-invoice.md");
  for (const [name, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const cell of value) {
        expect(typeof cell, `${name} cell`).toBe(cell === null ? "object" : "string");
      }
    } else {
      expect(typeof value, name).toBe("string");
    }
  }
  // What the string buys is *exactness*, not the declared width: the engine's
  // arithmetic is decimal, and a round trip through a JavaScript number is a
  // round trip through binary floating point. The width lives in the
  // document's cells — `fmt` writes it — and `eval` reports the value, which
  // is why this is "23300" and the cell it came from reads "23300.00".
  expect(await api.get("example-invoice.md", "lines.net_total")).toBe("23300");
  expect(files["example-invoice.md"]!).toContain("23300.00");
});

test("a column comes back as one value per row, not a joined string", async () => {
  const net = await api.get("example-invoice.md", "lines.Net");
  expect(Array.isArray(net)).toBe(true);
  expect(net).toEqual(["3600", "14080", "2500", "3120"]);
  // the CLI joins the same values with ", " for a terminal; an array is the
  // same answer without a rendering a caller would have to undo
  expect((net as string[]).join(", ")).toBe("3600, 14080, 2500, 3120");
});

test("a name the note does not define is null, not a throw", async () => {
  expect(await api.get("example-invoice.md", "lines.nonesuch")).toBeNull();
  expect(await api.explain("example-invoice.md", "lines.nonesuch")).toBeNull();
});

test("check returns the engine's own findings", async () => {
  expect(await api.check("example-invoice.md")).toEqual([]);
  const drifted = await api.check("example-invoice-drift.md");
  expect(drifted.length).toBeGreaterThan(0);
  expect(drifted).toEqual(check(build(locate(files["example-invoice-drift.md"]!))).findings);
});

test("explain names the formula, its inputs and the result", async () => {
  // manual test §2.3's three requirements, at the API level
  const e = (await api.explain("example-invoice.md", "lines.net_total"))!;
  expect(e.name).toBe("lines.net_total");
  expect(e.kind).toBe("scalar");
  expect(e.source).toBe("net_total   = SUM(Net)");
  expect(e.value).toBe("23300");
  expect(e.inputs).toContain("lines.Net");
});

test("a cross-sheet input is named, qualified", async () => {
  // §2.3 calls this out by name: `terms.eur_total` reads `lines.gross_total`
  const e = (await api.explain("example-invoice.md", "terms.eur_total"))!;
  expect(e.inputs).toContain("lines.gross_total");
  expect(e.inputs).toContain("fx_eur");
  expect(e.precision).toBe(2);
});

test("a column's explanation is about the column, not one cell", async () => {
  const e = (await api.explain("example-invoice.md", "lines.Net"))!;
  expect(e.kind).toBe("column");
  expect(e.source).toBe("Net               = Qty * Rate");
  expect(Array.isArray(e.value)).toBe(true);
});

test("an input column is named, even though it has no rule of its own", async () => {
  // `dependencies()` deliberately excludes an input-column resolution from
  // `deps` ("inputs are leaves" — eval/graph.ts) because it has no binding
  // for the topological sort to order against. That is not the same as it
  // being unread: `Qty` and `Rate` are exactly what `Net = Qty * Rate` reads.
  const e = (await api.explain("example-invoice.md", "lines.Net"))!;
  expect(e.inputs).toEqual(["lines.Qty", "lines.Rate"]);
});

test("a cross-sheet column input is qualified, alongside a same-sheet one", async () => {
  // Amount precision 2 = Share * lines.gross_total — Share is an input
  // column on #schedule itself; lines.gross_total is a computed scalar on
  // another sheet. Both are inputs; only one is a dependency edge.
  const e = (await api.explain("example-invoice.md", "schedule.Amount"))!;
  expect(e.inputs).toEqual(["schedule.Share", "lines.gross_total"]);
});

test("a document-scope constant resolves without a sheet", async () => {
  const e = (await api.explain("example-invoice.md", "vat"))!;
  expect(e.kind).toBe("scalar");
  expect(e.value).toBe("0.23");
});

test("a note that is not in the vault is an error, not a wrong answer", async () => {
  await expect(api.get("nowhere.md", "x")).rejects.toThrow("cannot read nowhere.md");
  await expect(api.get(42, "x")).rejects.toThrow("not a note in this vault");
});

test("a note with no vmark block answers rather than throwing", async () => {
  expect(await api.check("notes/plain.md")).toEqual(
    check(build(locate(files["notes/plain.md"]!))).findings,
  );
  expect(await api.evaluate("notes/plain.md")).toEqual({});
});

test("concurrent get calls for the same note share one analysis (row 19)", async () => {
  // Row 19 of the 2026-09-26 follow-up: "an agent calling `get` for 20 names
  // still pays for 20 full analyses." `analyse` (api.ts) now goes through
  // `analysis.ts`'s shared `analyseWithSnapshot` cache instead of running its
  // own read-imports-then-check pipeline per call, so several `get`s issued
  // together for one note — the shape row 19 names — cost one pipeline, not
  // one per name. Modelled on `analysis-snapshot.test.ts`'s own
  // "concurrent calls... share one fetch" case, with a CSV-importing note so
  // there is an import fetch to count.
  const csvFixtures = resolvePath(
    import.meta.dir,
    "../../../packages/visimark/test/fixtures/import",
  );
  const csv = readFileSync(join(csvFixtures, "benchmark.csv"), "utf8");
  const source =
    "```vmark #benchmark from benchmark.csv labelled Id, Time at sha256:c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee\n" +
    "Mean precision 2 = AVG(benchmark.Time)\n" +
    "Count = COUNT(benchmark.Time)\n" +
    "```\n" +
    "\n" +
    "The mean is **1.00**<!--vmark=benchmark.Mean-->.\n";

  const countingApi = (): { api: ReturnType<typeof createApi>; calls: () => number } => {
    let calls = 0;
    const countingRead: VaultRead = async (p) => {
      calls++;
      if (p === "row19-note.md") return source;
      if (p === "benchmark.csv") return csv;
      return null;
    };
    return {
      api: createApi(countingRead, (f) => (typeof f === "string" ? f : null)),
      calls: () => calls,
    };
  };

  // what one `get` alone costs: one read of the note, plus however many
  // rounds `vaultSnapshot`'s fixed-point discovery takes to fetch the CSV
  const solo = countingApi();
  await solo.api.get("row19-note.md", "benchmark.Mean");
  const soloCalls = solo.calls();

  const together = countingApi();
  const [mean, count] = await Promise.all([
    together.api.get("row19-note.md", "benchmark.Mean"),
    together.api.get("row19-note.md", "benchmark.Count"),
  ]);
  expect(mean).toBe("12.47");
  expect(count).toBe("3");
  // the second concurrent caller adds one more note read (api.ts's own
  // `analyse` still reads the note source before consulting the shared
  // cache) but starts no pipeline of its own — it must not double the CSV
  // fetch cost the way two fully independent `get`s would.
  expect(together.calls()).toBeLessThan(2 * soloCalls);
});
