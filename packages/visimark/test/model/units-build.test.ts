import { describe, expect, test } from "bun:test";
import { formatUnit } from "../../src/lang/unit-expr.js";
import { build } from "../../src/model/build.js";
import type { DocModel, Finding } from "../../src/model/types.js";
import { locate } from "../../src/parse/document.js";
import { runCli } from "../../src/cli/main.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const model = (src: string): DocModel => build(locate(src));
const findings = (src: string): Finding[] => model(src).findings;

const WEIGHT = `| Weight [kg] | Count |
|---:|---:|
| 2 | 4 |

`;

describe("header names", () => {
  test("a bracketed header is keyed by its name and carries its unit", () => {
    const m = model(`${WEIGHT}\`\`\`vmark #s
total = SUM(Weight)
\`\`\`
`);
    const s = m.sheets.get("s")!;
    expect([...s.columnIndex.keys()]).toEqual(["Weight", "Count"]);
    expect(formatUnit(s.headerUnits.get("Weight")!.map)).toBe("kg");
    expect(s.headerUnits.has("Count")).toBe(false);
  });

  test("Weight beside Weight [kg] is DUP", () => {
    const f = findings(`| Weight | Weight [kg] |
|---:|---:|
| 1 | 2 |

\`\`\`vmark #s
\`\`\`
`);
    expect(f.map((x) => [x.code, x.name])).toContainEqual(["DUP", "Weight"]);
  });

  test("a malformed header bracket is UNIT, and the column keeps its name", () => {
    const m = model(`| Revenue [1] |
|---:|
| 1 |

\`\`\`vmark #s
\`\`\`
`);
    expect(m.findings).toContainEqual(
      expect.objectContaining({ code: "UNIT", message: "[1] declares no unit" }),
    );
    expect(m.sheets.get("s")!.columnIndex.has("Revenue")).toBe(true);
  });

  test("a quoted head of the full bracketed text is UNDEF with a hint", () => {
    const f = findings(`${WEIGHT}\`\`\`vmark #s
"Weight [kg]" = Count * 2
\`\`\`
`);
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "UNDEF",
        hint: "the header's name is Weight; [kg] is its unit",
      }),
    );
  });

  test("an alias of the full bracketed text is UNDEF with a hint", () => {
    const f = findings(`${WEIGHT}\`\`\`vmark #s
"Weight [kg]" is w
\`\`\`
`);
    const undef = f.find((x) => x.code === "UNDEF")!;
    expect(undef.hint).toBe("the header's name is Weight; [kg] is its unit");
    expect(undef.suggestion).toBeUndefined();
  });

  test("a quoted head and an alias match a non-identifier stem", () => {
    const m = model(`| Worker cost [USD/node/month] | Workers [node] |
|---:|---:|
| 250 | 48 |

\`\`\`vmark #s
"Worker cost" is wc
monthly = wc * Workers
\`\`\`
`);
    expect(m.findings).toEqual([]);
    expect(m.sheets.get("s")!.aliases.get("wc")!.header).toBe("Worker cost");
  });
});

describe("declarations", () => {
  test("a scalar's head unit is parsed", () => {
    const m = model(`\`\`\`vmark
fx_eur [PLN/EUR] = 4.2650
\`\`\`
`);
    expect(formatUnit(m.docScope.get("fx_eur")!.unit!.map)).toBe("PLN/EUR");
  });

  test("a malformed head unit is UNIT", () => {
    expect(
      findings(`\`\`\`vmark
x [N m] = 1
\`\`\`
`),
    ).toContainEqual(
      expect.objectContaining({
        code: "UNIT",
        message: "[N m] is not a unit — write a product as N⋅m",
      }),
    );
  });

  test("a bracket on a column rule's head is UNIT", () => {
    const f = findings(`| Qty | Net |
|---:|---:|
| 2 | 4 |

\`\`\`vmark #s
Net [PLN] = Qty * 2
\`\`\`
`);
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "UNIT",
        message: "Net's unit is declared on its header, not on its rule",
      }),
    );
  });

  test("a parse failure coded UNIT is a UNIT finding", () => {
    expect(
      findings(`\`\`\`vmark
x = a [PLN]
\`\`\`
`),
    ).toContainEqual(
      expect.objectContaining({
        code: "UNIT",
        message: "a unit can be written only on a number literal",
      }),
    );
  });
});

describe("definitions", () => {
  test("collected from document scope", () => {
    const m = model(`\`\`\`vmark
[J] = [N⋅m]
\`\`\`
`);
    expect(formatUnit(m.unitDefs.get("J")!)).toBe("N⋅m");
  });

  test("refused in a sheet block", () => {
    expect(
      findings(`\`\`\`vmark #s
[J] = [N⋅m]
\`\`\`
`),
    ).toContainEqual(
      expect.objectContaining({
        code: "SHEET",
        message: "a unit definition belongs in a document-scope block",
      }),
    );
  });

  test("a redefinition is DUP, naming the first line", () => {
    const f = findings(`\`\`\`vmark
[J] = [N⋅m]
[J] = [N⋅m]
\`\`\`
`);
    expect(f).toContainEqual(
      expect.objectContaining({ code: "DUP", message: "[J] is already defined at line 2" }),
    );
  });

  test("a dimensionless definition is refused", () => {
    expect(
      findings(`\`\`\`vmark
[x] = [1]
\`\`\`
`),
    ).toContainEqual(
      expect.objectContaining({
        code: "UNIT",
        message: "a unit cannot be defined as dimensionless",
      }),
    );
  });

  test("a cycle is reported once and nothing on it is kept", () => {
    const m = model(`\`\`\`vmark
[a] = [b]
[b] = [a]
[c] = [c⋅m]
\`\`\`
`);
    const cycles = m.findings.filter((f) => f.code === "CYCLE").map((f) => f.cyclePath);
    expect(cycles).toEqual([
      ["[a]", "[b]", "[a]"],
      ["[c]", "[c]"],
    ]);
    expect(m.unitDefs.size).toBe(0);
  });
});

test("check prints a header's UNDEF hint in place of a did-you-mean", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const path = join(dir, "doc.md");
  writeFileSync(
    path,
    `${WEIGHT}\`\`\`vmark #s
"Weight [kg]" is w
\`\`\`
`,
  );
  const lines: string[] = [];
  const code = await runCli(["check", path], {
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
  });
  expect(code).toBe(1);
  expect(lines.join("\n")).toContain("the header's name is Weight; [kg] is its unit");
  expect(lines.join("\n")).not.toContain("did you mean");
});
