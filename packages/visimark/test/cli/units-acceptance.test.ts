/**
 * The acceptance for #317, from
 * `docs/design/algebraic-unit-maps-on-names-spec.md` §6: the motivating
 * invoice, one row per §4 finding, and no regression across `docs/`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const INVOICE = join(ROOT, "docs", "example-invoice.md");

function withFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "visimark-units-acc-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, contents);
  return path;
}

async function run(args: string[]): Promise<{ code: number; out: string; lines: string[] }> {
  const lines: string[] = [];
  const code = await runCli(args, { out: (l) => lines.push(l), err: (l) => lines.push(l) });
  return { code, out: lines.join("\n"), lines };
}

describe("§6.1 the invoice", () => {
  test("check passes", async () => {
    const r = await run(["check", INVOICE]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("0 problems (0 stale, 0 errors)");
  });

  test("eval prints every unit", async () => {
    const r = await run(["eval", INVOICE]);
    expect(r.lines).toEqual([
      "vat                          0.23",
      "early_pay_disc               0.02",
      "fx_eur [PLN/EUR]             4.265",
      "lines.net_total [PLN]        23300",
      "lines.vat_total [PLN]        5359",
      "lines.gross_total [PLN]      28659",
      "schedule.covered [PLN]       28659",
      "terms.early_pay_total [PLN]  28085.82",
      "terms.early_pay_saved [PLN]  573.18",
      "terms.eur_total [EUR]        6719.58",
      "recon.scheduled [PLN]        28659",
      "recon.variance [PLN]         0",
      "lines.Net [PLN]              3600, 14080, 2500, 3120",
      "lines.VAT [PLN]              828, 3238.4, 575, 717.6",
      "lines.Gross [PLN]            4428, 17318.4, 3075, 3837.6",
      "schedule.Amount [PLN]        8597.7, 11463.6, 8597.7",
    ]);
  });

  test("eval --json adds the units object", async () => {
    const body = JSON.parse((await run(["eval", INVOICE, "--json"])).out) as {
      units: Record<string, object>;
    };
    const pln = { PLN: 1 };
    expect(body.units).toEqual({
      fx_eur: { EUR: -1, PLN: 1 },
      "lines.net_total": pln,
      "lines.vat_total": pln,
      "lines.gross_total": pln,
      "schedule.covered": pln,
      "terms.early_pay_total": pln,
      "terms.early_pay_saved": pln,
      "terms.eur_total": { EUR: 1 },
      "recon.scheduled": pln,
      "recon.variance": pln,
      "lines.Net": pln,
      "lines.VAT": pln,
      "lines.Gross": pln,
      "schedule.Amount": pln,
      "lines.Rate": pln,
    });
    expect(Object.keys(body.units).at(-1)).toBe("lines.Rate");
  });

  test("multiplying by the rate instead of dividing fails check", async () => {
    const wrong = readFileSync(INVOICE, "utf8").replace(
      "lines.gross_total / fx_eur",
      "lines.gross_total * fx_eur",
    );
    const r = await run(["check", withFile(wrong)]);
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      "UNIT    terms.eur_total   eur_total declares EUR but its formula derives PLN²/EUR",
    );
  });
});

/** one §4 row: a document, and the one finding it must produce */
interface Row {
  title: string;
  doc: string;
  code: string;
  name?: string;
  message: string;
}

const block = (body: string, id = "#s") => `\`\`\`vmark ${id}\n${body}\n\`\`\`\n`;
const table = (header: string, cells: string) =>
  `| Item | ${header} |\n|---|---:|\n| a | ${cells} |\n\n`;

const ROWS: Row[] = [
  {
    title: "declared unit ≠ derived",
    doc: block("rate [kcal] precision 0 = 1600\nper_hour [kcal/h] precision 2 = rate / 24"),
    code: "UNIT",
    name: "per_hour",
    message: "per_hour declares kcal/h but its formula derives kcal",
  },
  {
    title: "+ on different maps",
    doc: block("a [kg] = 5\nb [m] = 3\nc = a + b"),
    code: "UNIT",
    name: "c",
    message: "+ needs matching units: kg and m",
  },
  {
    title: "a comparison on different maps",
    doc: block("a [PLN] = 5\nb [EUR] = 5\nc = IF(a == b, 1, 2)"),
    code: "UNIT",
    name: "c",
    message: "== needs matching units: PLN and EUR",
  },
  {
    title: "IF branches differ",
    doc: block("a [PLN] = 5\nb [EUR] = 5\nc = IF(1 < 2, a, b)"),
    code: "UNIT",
    name: "c",
    message: "IF's branches need matching units: PLN and EUR",
  },
  {
    title: "a tied builtin argument differs",
    doc: block("x [kg] = 7\ny [g] = 2\nz = MOD(x, y)"),
    code: "UNIT",
    name: "z",
    message: "MOD needs matching units: kg and g",
  },
  {
    title: "a `1` argument carries a unit",
    doc: block("x [kg] = 2.5\np [kg] = 1\ny = ROUND(x, p)"),
    code: "UNIT",
    name: "y",
    message: "ROUND's places must be dimensionless, not kg",
  },
  {
    title: "^ with a non-literal exponent on a unit-bearing base",
    doc: block("side [m] = 3\nn = 2\narea = side ^ n"),
    code: "UNIT",
    name: "area",
    message: "^ needs a literal exponent when its base has a unit (m)",
  },
  {
    title: "SQRT of an odd exponent",
    doc: block("a [m] = 9\ns precision 0 = SQRT(a)"),
    code: "UNIT",
    name: "s",
    message: "SQRT needs even exponents; m has an odd one",
  },
  {
    title: "a bracket that fails the grammar: digits",
    doc: block("x [100km] = 1"),
    code: "UNIT",
    name: "x",
    message: "[100km] is not a unit — an atom is letters only",
  },
  {
    title: "a bracket that fails the grammar: a space",
    doc: block("x [N m] = 1"),
    code: "UNIT",
    name: "x",
    message: "[N m] is not a unit — write a product as N⋅m",
  },
  {
    title: "a bracket that fails the grammar: ambiguous",
    doc: block("x [a/b⋅c] = 1"),
    code: "UNIT",
    name: "x",
    message: "[a/b⋅c] is ambiguous — write a⋅c/b or a/b/c",
  },
  {
    title: "[%]",
    doc: block("x [%] = 1"),
    code: "UNIT",
    name: "x",
    message: "[%] is not a unit — % is number syntax (23% is 0.23); drop the bracket",
  },
  {
    title: "an empty map",
    doc: block("x [node/node] = 1"),
    code: "UNIT",
    name: "x",
    message: "[node/node] declares no unit",
  },
  {
    title: "a % literal given a unit, inline",
    doc: block("x = 23% [PLN]"),
    code: "UNIT",
    name: "x",
    message: "23% is a ratio and cannot carry a unit",
  },
  {
    title: "a % literal given a unit, ascribed",
    doc: block("x [PLN] = 23%"),
    code: "UNIT",
    name: "x",
    message: "23% is a ratio and cannot carry a unit",
  },
  {
    title: "a bracket on a name operand",
    doc: block("a = 1\nx = a [PLN]"),
    code: "UNIT",
    name: "x",
    message: "a unit can be written only on a number literal",
  },
  {
    title: "a bracket on a column rule's head",
    doc: `| Qty | Net |\n|---:|---:|\n| 2 | 4 |\n\n${block("Net [PLN] = Qty * 2")}`,
    code: "UNIT",
    name: "Net",
    message: "Net's unit is declared on its header, not on its rule",
  },
  {
    title: "a bracket on a param default",
    doc: block("param rate [PLN] precision 2 = default 4.20 [PLN]"),
    code: "UNIT",
    name: "rate",
    message: "a param's unit is declared on its head",
  },
  {
    title: "a unit on a date column",
    doc: `| Start [day] | Qty |\n|---|---:|\n| 2026-01-01 | 3 |\n\n${block("")}`,
    code: "UNIT",
    name: "Start",
    message: "a date cannot carry a unit",
  },
  {
    title: "a header with an empty stem",
    doc: `| [kg] | Qty |\n|---:|---:|\n| 1 | 3 |\n\n${block("")}`,
    code: "UNIT",
    message: "a header needs a name before its unit",
  },
  {
    title: "a header with two unit clauses",
    doc: `| Speed [m] [s] | Qty |\n|---:|---:|\n| 1 | 3 |\n\n${block("")}`,
    code: "UNIT",
    name: "Speed [m]",
    message: "a header has one unit clause",
  },
  {
    title: "a cell decoration that disagrees",
    doc: table("Weight [kg]", "40 lbs") + block("t = SUM(Weight)", "#t"),
    code: "UNIT",
    name: "Weight",
    message: 'cell "40 lbs" carries lbs, but the column declares kg',
  },
  {
    title: "a cell with a prefix under a unit",
    doc: table("Cost [USD]", "$40.00") + block("t = SUM(Cost)", "#t"),
    code: "UNIT",
    name: "Cost",
    message: 'cell "$40.00" has a prefix, which a column with a unit forbids',
  },
  {
    title: "a cell suffix that is not a unit",
    doc: table("Weight [kg]", "5 €") + block("t = SUM(Weight)", "#t"),
    code: "UNIT",
    name: "Weight",
    message: 'cell "5 €" carries "€", which is not a unit',
  },
  {
    title: "chart value columns differ",
    doc: `| Item | Net [PLN] | Hours [h] |\n|---|---:|---:|\n| a | 1 | 2 |\n\n${block("chart cost as bar of Net, Hours labelled Item", "#t")}`,
    code: "UNIT",
    name: "cost",
    message: "chart cost needs one unit across its columns: Net is PLN, Hours is h",
  },
  {
    title: "a display rule on a unit-bearing value",
    doc: `${block("margin [PLN] precision 4 = 0.4026")}\nMargin **40.26%**<!--vmark=s.margin|percent-->.\n`,
    code: "TYPE",
    name: "margin",
    message: "|percent cannot render a value with a unit (PLN)",
  },
  {
    title: "the unit after precision",
    doc: block("x precision 2 [m] = 1"),
    code: "TYPE",
    name: "x",
    message: "the unit comes before precision: name [unit] precision N",
  },
  {
    title: "two headers with one name",
    doc: `| Weight | Weight [kg] |\n|---:|---:|\n| 1 | 2 |\n\n${block("")}`,
    code: "DUP",
    name: "Weight",
    message: "",
  },
  {
    title: "a definition in a sheet block",
    doc: block("[J] = [N⋅m]"),
    code: "SHEET",
    message: "a unit definition belongs in a document-scope block",
  },
  {
    title: "a definition's left side is not one atom",
    doc: block("[N⋅m] = [J]", ""),
    code: "UNIT",
    message: "a definition defines one atom",
  },
  {
    title: "a dimensionless definition",
    doc: block("[x] = [1]", ""),
    code: "UNIT",
    name: "[x]",
    message: "a unit cannot be defined as dimensionless",
  },
  {
    title: "an atom defined twice",
    doc: block("[J] = [N⋅m]\n[J] = [N⋅m]", ""),
    code: "DUP",
    name: "[J]",
    message: "[J] is already defined at line 2",
  },
  {
    title: "an unused definition",
    doc: block("[J] = [N⋅m]\nx = 1", ""),
    code: "WARN",
    name: "[J]",
    message: "[J] is defined and never used",
  },
];

interface JsonFinding {
  code: string;
  location: { sheet?: string; name?: string };
  details: { message?: string; hint?: string; cyclePath?: string[] };
}

async function findings(doc: string): Promise<JsonFinding[]> {
  const body = JSON.parse((await run(["check", withFile(doc), "--json"])).out) as {
    files: { findings: JsonFinding[] }[];
  };
  return body.files[0]!.findings;
}

describe("§6.2 one fixture per §4 row", () => {
  test.each(ROWS.map((r) => [r.title, r] as const))("%s", async (_t, row) => {
    const fs = await findings(row.doc);
    const match = fs.find(
      (f) =>
        f.code === row.code &&
        (row.message === "" || f.details.message === row.message) &&
        (row.name === undefined || f.location.name === row.name),
    );
    expect(match, JSON.stringify(fs, null, 2)).toBeDefined();
  });

  test("a definition cycle is CYCLE with its path", async () => {
    const fs = await findings(block("[a] = [b]\n[b] = [a]", ""));
    expect(fs.find((f) => f.code === "CYCLE")!.details.cyclePath).toEqual(["[a]", "[b]", "[a]"]);
  });

  test("an unresolved bracketed header is UNDEF with the hint", async () => {
    const fs = await findings(
      `| Weight [kg] | Count |\n|---:|---:|\n| 1 | 2 |\n\n${block('"Weight [kg]" is w')}`,
    );
    const undef = fs.find((f) => f.code === "UNDEF")!;
    expect(undef.details.hint).toBe("the header's name is Weight; [kg] is its unit");
  });

  test("every unit finding fails check with exit 1, and no new exit code", async () => {
    const r = await run(["check", withFile(block("a [kg] = 5\nb [m] = 3\nc = a + b"))]);
    expect(r.code).toBe(1);
  });
});

describe("§6.3 the header rule", () => {
  test("Weight [kg] is the column Weight, with unit kg", async () => {
    const doc = `| Weight [kg] | Count |\n|---:|---:|\n| 2 | 4 |\n| 3 | 1 |\n\n${block("total [kg] = SUM(Weight)")}`;
    const body = JSON.parse((await run(["eval", withFile(doc), "--json"])).out) as {
      units: object;
    };
    expect(body.units).toEqual({ "s.total": { kg: 1 }, "s.Weight": { kg: 1 } });
  });

  test("an escaped bracket stays in the name; links and footnotes are plain names", async () => {
    for (const header of ["Revenue \\[1\\]", "[x](https://example.com)", "Note [^1]"]) {
      const doc = `| ${header} | Qty |\n|---:|---:|\n| 1 | 2 |\n\n${block("t = SUM(Qty)")}`;
      const fs = await findings(doc);
      expect(fs.filter((f) => f.code === "UNIT")).toEqual([]);
    }
  });
});

describe("§6.8 no regression", () => {
  // every document under docs/ that passed check before #317, pinned so a
  // regression names the file
  const PASSING = [
    "ci.md",
    "cli-reference.md",
    "distribution.md",
    "example-agent-budget.md",
    "example-bandwidth.md",
    "example-charts.md",
    "example-ci-sharding.md",
    "example-deal-desk.md",
    "example-executable-documentation.md",
    "example-invoice-csv-import.md",
    "example-invoice.md",
    "example-onboarding-dashboard.md",
    "example-pricing-policy.md",
    "example-structural-check.md",
    "function-reference.md",
    "issue-runbook.md",
    "mcp.md",
    "mcp-server.md",
    "releasing.md",
    "tutorial.md",
    "visimark-design.md",
    "visimark-editor-plugins-design.md",
    "vocabulary-catalogue.md",
  ];
  test.each(PASSING)("%s still passes check", async (name) => {
    const r = await run(["check", join(ROOT, "docs", name)]);
    expect(r.code, r.out).toBe(0);
  });
});
