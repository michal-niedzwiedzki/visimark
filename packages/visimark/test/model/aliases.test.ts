import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";

const run = (s: string) => build(locate(s));

const withAlias = (rule: string) => `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
${rule}
\`\`\`
`;

test("an alias to an input column resolves with no rule", () => {
  const r = run(withAlias("peak = bpu"));
  expect(r.findings).toEqual([]);
  expect(r.sheets.get("network")!.aliases.get("bpu")).toMatchObject({
    header: "Bandwidth per Unit (TB/s, full-duplex)",
  });
});

test("assigning through the alias's short name is a column rule for the header", () => {
  const r = run(withAlias("bpu = GPUs * 2"));
  expect(r.findings).toEqual([]);
  const sheet = r.sheets.get("network")!;
  expect(sheet.columns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(true);
  expect(sheet.columns.has("bpu")).toBe(false); // canonical key is the header text
});

test("assigning through the alias when the header already has a rule is DUP", () => {
  const twoRules = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"Bandwidth per Unit (TB/s, full-duplex)" = GPUs
bpu = GPUs * 2
\`\`\`
`;
  const r = run(twoRules);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "network", name: "bpu" });
});

test("an alias whose header matches no column is UNDEF", () => {
  const r = run(
    withAlias("").replace(
      '"Bandwidth per Unit (TB/s, full-duplex)" is bpu',
      '"Bandwidth per Unyt (TB/s)" is bpu',
    ),
  );
  const undef = r.findings.find((f) => f.code === "UNDEF");
  expect(undef).toMatchObject({
    sheetId: "network",
    name: "bpu",
    raw: "Bandwidth per Unyt (TB/s)",
  });
  expect(undef!.suggestion).toBe("Bandwidth per Unit (TB/s, full-duplex)");
});

test("two aliases with the same symbol is DUP, first wins", () => {
  const twoAliases = `
| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is x
"B" is x
\`\`\`
`;
  const r = run(twoAliases);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s", name: "x" });
  expect(r.sheets.get("s")!.aliases.get("x")).toMatchObject({ header: "A" });
});

test("an alias symbol colliding with a chart name is DUP", () => {
  const clash = `
| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is chart1
chart chart1 as pie of B labelled A
\`\`\`
`;
  const r = run(clash);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s" });
});

test("an alias symbol colliding with an existing scalar is DUP", () => {
  // the scalar is declared in an earlier block of the same sheet — within one
  // block an alias is resolved first, so `total = 1` there would be a write
  // through the alias rather than a competing scalar (spec §3).
  const clash = `
\`\`\`vmark #s
total = 1
\`\`\`

| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is total
\`\`\`
`;
  const r = run(clash);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s", name: "total" });
  expect(r.sheets.get("s")!.aliases.size).toBe(0);
});

test("an alias symbol colliding with a header name is DUP", () => {
  const clash = `
| A | B |
|--:|--:|
| 1 | 2 |

\`\`\`vmark #s
"A" is B
\`\`\`
`;
  const r = run(clash);
  const dup = r.findings.find((f) => f.code === "DUP");
  expect(dup).toMatchObject({ sheetId: "s", name: "B" });
  expect(r.sheets.get("s")!.aliases.size).toBe(0);
});

test("an alias is order-independent: the rule may precede the declaration", () => {
  const before = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
bpu = GPUs * 2
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
\`\`\`
`;
  const r = run(before);
  expect(r.findings).toEqual([]);
  const sheet = r.sheets.get("network")!;
  expect(sheet.columns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(true);
  expect(sheet.columns.has("bpu")).toBe(false);
  expect(sheet.scalars.has("bpu")).toBe(false);
  expect(sheet.inputColumns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(false);
});

test("an alias declared in one block may be written through in a later block", () => {
  const split = `
| GPUs | Bandwidth per Unit (TB/s, full-duplex) |
|-----:|----------------------------------------:|
|    8 |                                      3.2 |

\`\`\`vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
\`\`\`

\`\`\`vmark #network
bpu = GPUs * 2
\`\`\`
`;
  const sheet = run(split).sheets.get("network")!;
  expect(sheet.columns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(true);
  expect(sheet.columns.has("bpu")).toBe(false);
  expect(sheet.columnIndex.get("Bandwidth per Unit (TB/s, full-duplex)")).toBe(1);
  expect(sheet.inputColumns.has("Bandwidth per Unit (TB/s, full-duplex)")).toBe(false);
});

test("a quoted binding naming a real header is a column rule keyed by the header", () => {
  const r = run(withAlias('"GPUs" = 4'));
  expect(r.findings).toEqual([]);
  const sheet = r.sheets.get("network")!;
  expect(sheet.columns.has("GPUs")).toBe(true);
  expect(sheet.columnIndex.get("GPUs")).toBe(0);
});

test("a quoted binding matching no header is UNDEF, never a scalar", () => {
  const r = run(withAlias('"Nope" = 1'));
  const undef = r.findings.find((f) => f.code === "UNDEF");
  expect(undef).toMatchObject({ sheetId: "network", raw: "Nope" });
  const sheet = r.sheets.get("network")!;
  expect(sheet.scalars.has("Nope")).toBe(false);
  expect(sheet.columns.has("Nope")).toBe(false);
});

test("`is` outside a sheet block is a SHEET finding, not a crash", () => {
  const docScope = `
\`\`\`vmark
"A" is x
\`\`\`
`;
  const r = run(docScope);
  expect(r.findings).toMatchObject([{ code: "SHEET" }]);
  expect(r.docScope.size).toBe(0);
});

test("a quoted binding outside a sheet block is a SHEET finding", () => {
  const docScope = `
\`\`\`vmark
"A" = 1
\`\`\`
`;
  const r = run(docScope);
  expect(r.findings).toMatchObject([{ code: "SHEET" }]);
  expect(r.docScope.size).toBe(0);
});
