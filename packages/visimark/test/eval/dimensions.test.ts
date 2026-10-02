import { describe, expect, test } from "bun:test";
import { check } from "../../src/eval/check.js";
import { formatUnit } from "../../src/lang/unit-expr.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

function run(src: string) {
  const result = check(build(locate(src)));
  const problems = result.findings
    .filter((f) => f.code !== "WARN" && f.code !== "NOTE")
    .map((f) => `${f.code} ${f.message ?? ""}`.trim());
  const unit = (id: string): string | undefined => {
    const u = result.unitMaps.get(id);
    return u ? `${formatUnit(u.map)} (${u.source})` : undefined;
  };
  return { result, problems, unit };
}

const scalars = (body: string) => `\`\`\`vmark #s\n${body}\n\`\`\`\n`;

describe("ascription and the check", () => {
  test("a unit-free right side takes the declared unit", () => {
    const r = run(scalars("fee [PLN] = 10\nx = fee * 2"));
    expect(r.problems).toEqual([]);
    expect(r.unit("s.fee")).toBe("PLN (declared)");
    expect(r.unit("s.x")).toBe("PLN (derived)");
  });

  test("a matching derived unit passes", () => {
    const r = run(
      scalars(
        "metabolic_rate [kcal] precision 0 = 1600\nhours [h] = 24\nper_hour [kcal/h] precision 2 = metabolic_rate / hours",
      ),
    );
    expect(r.problems).toEqual([]);
    expect(r.unit("s.per_hour")).toBe("kcal/h (declared)");
  });

  test("a mismatch names both units and the binding gets no value", () => {
    const r = run(
      scalars(
        "metabolic_rate [kcal] precision 0 = 1600\nper_hour [kcal/h] precision 2 = metabolic_rate / 24",
      ),
    );
    expect(r.problems).toEqual(["UNIT per_hour declares kcal/h but its formula derives kcal"]);
    expect(r.result.values.has("s.per_hour")).toBe(false);
  });

  test("a map that cancels to nothing is a mismatch, not unit-free", () => {
    const r = run(
      scalars("part [PLN] = 3\ntotal [PLN] = 4\nshare [PLN] precision 2 = part / total"),
    );
    expect(r.problems).toEqual(["UNIT share declares PLN but its formula derives dimensionless"]);
  });

  test("a percent literal is never given a unit", () => {
    const r = run(scalars("rate [PLN] = 23%"));
    expect(r.problems).toEqual(["UNIT 23% is a ratio and cannot carry a unit"]);
  });

  test("an expression containing a percent is ordinary", () => {
    expect(run(scalars("x [PLN] = 23% * 100")).problems).toEqual([]);
  });

  test("an undeclared literal scalar is dimensionless and absent from unitMaps", () => {
    const r = run(scalars("bare = 1600\ny = bare * 2"));
    expect(r.problems).toEqual([]);
    expect(r.unit("s.bare")).toBeUndefined();
  });
});

describe("operators", () => {
  test("+ needs matching units", () => {
    expect(run(scalars("a [kg] = 5\nb [m] = 3\nc = a + b")).problems).toEqual([
      "UNIT + needs matching units: kg and m",
    ]);
  });

  test("a bare literal added to a unit is a mismatch", () => {
    expect(run(scalars("a [PLN] = 5\nc = a + 10")).problems).toEqual([
      "UNIT + needs matching units: PLN and dimensionless",
    ]);
  });

  test("a literal with its own unit adds", () => {
    const r = run(scalars("a [PLN] = 5\nc = a + 10 [PLN]"));
    expect(r.problems).toEqual([]);
    expect(r.unit("s.c")).toBe("PLN (derived)");
  });

  test("the literal 0 matches any unit; a computed zero does not", () => {
    expect(run(scalars("a [PLN] = 5\nc = a + 0\nd = IF(a > 0, 0, a)")).problems).toEqual([]);
    expect(run(scalars("a [PLN] = 5\nz = a - a\nc = a + z")).problems).toEqual([]);
    expect(run(scalars("a [PLN] = 5\nb [kg] = 1\nz = b - b\nc = a + z")).problems).toEqual([
      "UNIT + needs matching units: PLN and kg",
    ]);
  });

  test("comparisons need matching units", () => {
    expect(run(scalars("a [PLN] = 5\nb [EUR] = 1\nc = IF(a == b, 1, 2)")).problems).toEqual([
      "UNIT == needs matching units: PLN and EUR",
    ]);
  });

  test("* and / combine maps, and a rate divides out", () => {
    const r = run(
      scalars(
        "gross [PLN] = 100\nfx [PLN/EUR] = 4.2650\neur [EUR] precision 2 = gross / fx\nwrong = gross * fx",
      ),
    );
    expect(r.problems).toEqual([]);
    expect(r.unit("s.wrong")).toBe("PLN²/EUR (derived)");
  });

  test("^ on a unit-bearing base needs a literal exponent", () => {
    expect(run(scalars("side [m] = 3\narea = side ^ 2")).unit("s.area")).toBe("m² (derived)");
    expect(run(scalars("side [m] = 3\nn = 2\narea = side ^ n")).problems).toEqual([
      "UNIT ^ needs a literal exponent when its base has a unit (m)",
    ]);
    expect(run(scalars("r = 5%\nyears = 3\ng precision 4 = (1 + r) ^ years")).problems).toEqual([]);
  });

  test("⋅ is a spelling of *", () => {
    expect(run(scalars("w [m] = 3\nh [m] = 4\narea [m^2] = w ⋅ h")).problems).toEqual([]);
  });
});

describe("builtins", () => {
  const table = `| Weight [kg] | Count |
|---:|---:|
| 2 | 4 |
| 3 | 1 |

`;

  test("reducers keep the column unit; COUNT is dimensionless", () => {
    const r = run(`${table}\`\`\`vmark #t
total [kg] = SUM(Weight)
n = COUNT(Weight)
\`\`\`
`);
    expect(r.problems).toEqual([]);
    expect(r.unit("t.total")).toBe("kg (declared)");
    expect(r.unit("t.n")).toBeUndefined();
    expect(r.unit("t.Weight")).toBe("kg (declared)");
  });

  test("a `1` argument must be dimensionless", () => {
    expect(run(scalars("x [kg] = 2.5\np [kg] = 1\ny = ROUND(x, p)")).problems).toEqual([
      "UNIT ROUND's places must be dimensionless, not kg",
    ]);
  });

  test("tied arguments must match", () => {
    expect(run(scalars("x [kg] = 7\ny [g] = 2\nz = MOD(x, y)")).problems).toEqual([
      "UNIT MOD needs matching units: kg and g",
    ]);
    expect(run(scalars("x [PLN] = 7\ny [EUR] = 2\nz = IF(1 < 2, x, y)")).problems).toEqual([
      "UNIT IF's branches need matching units: PLN and EUR",
    ]);
  });

  test("SQRT halves even exponents and refuses odd ones", () => {
    expect(run(scalars("a [m^2] = 9\ns precision 0 = SQRT(a)")).unit("s.s")).toBe("m (derived)");
    expect(run(scalars("a [m] = 9\ns precision 0 = SQRT(a)")).problems).toEqual([
      "UNIT SQRT needs even exponents; m has an odd one",
    ]);
  });

  test("⌊x⌋ takes its step in x's unit; FLOOR(x, 1) does not", () => {
    expect(run(scalars("w [kg] = 2.5\nf = ⌊w⌋")).unit("s.f")).toBe("kg (derived)");
    expect(run(scalars("w [kg] = 2.5\nf = FLOOR(w, 1)")).problems).toEqual([
      "UNIT FLOOR needs matching units: kg and dimensionless",
    ]);
    expect(run(scalars("w [kg] = 2.5\nf = FLOOR(w, 1 [kg])")).problems).toEqual([]);
  });
});

describe("dates", () => {
  test("a number with any unit may be added to a date", () => {
    const r = run(`| Start | Days [day] |
|---|---:|
| 2026-01-01 | 3 |

\`\`\`vmark #t
first = MIN(Start)
gap [day] = 3
due = first + gap
\`\`\`
`);
    expect(r.problems).toEqual([]);
  });

  test("a unit on a date column is refused", () => {
    const r = run(`| Start [day] | Qty |
|---|---:|
| 2026-01-01 | 3 |

\`\`\`vmark #t
\`\`\`
`);
    expect(r.problems).toContain("UNIT a date cannot carry a unit");
  });
});

describe("definitions", () => {
  test("a definition lets a declared name match its expansion", () => {
    const r = run(`\`\`\`vmark
[J] = [N⋅m]
force [N] = 10
distance [m] = 3
work [J] = force ⋅ distance
\`\`\`
`);
    expect(r.problems).toEqual([]);
    expect(r.unit("work")).toBe("J (declared)");
  });

  test("without it the units do not match", () => {
    expect(
      run(`\`\`\`vmark
force [N] = 10
distance [m] = 3
work [J] = force ⋅ distance
\`\`\`
`).problems,
    ).toEqual(["UNIT work declares J but its formula derives N⋅m"]);
  });

  test("an unused definition is WARN", () => {
    const r = check(
      build(
        locate(`\`\`\`vmark
[J] = [N⋅m]
x = 1
\`\`\`
`),
      ),
    );
    expect(r.findings.filter((f) => f.code === "WARN").map((f) => f.message)).toContain(
      "[J] is defined and never used",
    );
  });
});

describe("suppression, asserts and charts", () => {
  test("a reader of a failed binding is suppressed, not reported again", () => {
    const r = run(scalars("a [kg] = 5\nb [m] = 3\nc = a + b\nd = c * 2"));
    expect(r.problems).toEqual(["UNIT + needs matching units: kg and m"]);
  });

  test("an assert compares units", () => {
    expect(run(scalars("a [PLN] = 5\nb [EUR] = 5\nassert a == b")).problems).toEqual([
      "UNIT == needs matching units: PLN and EUR",
    ]);
    expect(run(scalars("v [PLN] = 0\nassert v == 0")).problems).toEqual([]);
  });

  test("a chart's columns share a unit", () => {
    const r = run(`| Item | Net [PLN] | Hours [h] |
|---|---:|---:|
| a | 1 | 2 |
| b | 3 | 4 |

\`\`\`vmark #t
chart cost as bar of Net, Hours labelled Item
\`\`\`
`);
    expect(r.problems).toContain(
      "UNIT chart cost needs one unit across its columns: Net is PLN, Hours is h",
    );
  });
});

test("a display rule refuses a unit-bearing value", () => {
  const r = run(`\`\`\`vmark #s
margin [PLN] precision 4 = 0.4026
\`\`\`

Margin **40.26%**<!--vmark=s.margin|percent-->.
`);
  expect(r.problems).toContain("TYPE |percent cannot render a value with a unit (PLN)");
});

describe("cell decorations under a header unit", () => {
  const col = (cells: string[]) =>
    `| Item | Weight [kg] |\n|---|---:|\n${cells.map((c, i) => `| r${i} | ${c} |`).join("\n")}\n\n\`\`\`vmark #t\ntotal = SUM(Weight)\n\`\`\`\n`;

  test.each([[["40", "2"]], [["40 kg", "2 kg"]], [["40kg", "2kg"]]])("%p passes", (cells) => {
    expect(run(col(cells)).problems).toEqual([]);
  });

  test("5 m² passes under [m^2] — the comparison is parsed", () => {
    const src = `| Item | Area [m^2] |\n|---|---:|\n| a | 5 m² |\n\n\`\`\`vmark #t\nt = SUM(Area)\n\`\`\`\n`;
    expect(run(src).problems).toEqual([]);
  });

  test.each([
    [["40 lbs"], 'cell "40 lbs" carries lbs, but the column declares kg'],
    [["5 kilogram"], 'cell "5 kilogram" carries kilogram, but the column declares kg'],
    [["5 €"], 'cell "5 €" carries "€", which is not a unit'],
    [["$40.00"], 'cell "$40.00" has a prefix, which a column with a unit forbids'],
    [["5%"], "5% is a ratio and cannot carry a unit"],
  ])("%p is UNIT", (cells, message) => {
    expect(run(col(cells)).problems).toContain(`UNIT ${message}`);
  });

  test("mixed decorations stay the existing UNIT", () => {
    expect(
      run(col(["40 kg", "2"])).problems.some((p) => p.startsWith("UNIT column mixes units")),
    ).toBe(true);
  });

  test("a column with no header unit keeps inert decorations", () => {
    const src = `| Item | Price |\n|---|---:|\n| a | $5.50 |\n\n\`\`\`vmark #t\nt = SUM(Price)\n\`\`\`\n`;
    expect(run(src).problems).toEqual([]);
  });

  test("an anchored span of a declared scalar answers to its unit", () => {
    const src = `\`\`\`vmark #s\nweight [kg] = 40\n\`\`\`\n\nIt weighs **40 lbs**<!--vmark=s.weight-->.\n`;
    expect(run(src).problems).toContain('UNIT anchor "40 lbs" carries lbs, but weight declares kg');
  });
});
