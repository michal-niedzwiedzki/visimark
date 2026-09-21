import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface Hover {
  contents: { kind: string; value: string };
}

const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **10.00**<!--vmark=s.total-->
`;

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function hover(line: number, character: number): Promise<Hover | null> {
  const uri = `file:///hv-${line}-${character}.md`;
  await h.open(uri, doc);
  await h.nextDiagnostics(uri);
  return h.request<Hover | null>("textDocument/hover", {
    textDocument: { uri },
    position: { line, character },
  });
}

test("hovering a rule name shows its formula and dependencies", async () => {
  const hv = await hover(5, 1); // "Net" in `Net = Price * Qty`
  expect(hv!.contents.value).toContain("Net = Price * Qty");
  expect(hv!.contents.value).toContain("Price");
  expect(hv!.contents.value).toContain("Qty");
});

test("hovering a stale cell shows the rule and what it should be", async () => {
  const hv = await hover(2, 24); // the "9.99" cell
  expect(hv!.contents.value).toContain("Net = Price * Qty");
  expect(hv!.contents.value).toContain("10.00");
  expect(hv!.contents.value).toContain("9.99");
});

test("hovering an anchored value shows its scalar rule", async () => {
  const hv = await hover(9, 10); // inside **10.00**
  expect(hv!.contents.value).toContain("total = SUM(Net)");
});

test("hovering prose returns nothing", async () => {
  expect(await hover(0, 2)).toBeNull();
});

test("hovering a function name shows its reference entry", async () => {
  const hv = await hover(6, 9); // "SUM" in `total = SUM(Net)`
  expect(hv!.contents.value).toContain("SUM(col)");
  expect(hv!.contents.value).toContain("Total of a column");
  expect(hv!.contents.value).toContain("returns: number");
});

// The editor is where a `PRECISION` diagnostic is read, so it is where the
// question the diagnostic raises — why does this need a declared width? — has
// to be answerable without leaving the file.
test("hovering a function name states where its result gets its width", async () => {
  const hv = await hover(6, 9); // "SUM" in `total = SUM(Net)`
  expect(hv!.contents.value).toContain("precision: the width of `col`");
});

test("hovering an argument inside a call still shows the binding, not the function", async () => {
  const hv = await hover(6, 13); // "Net" inside `SUM(Net)`
  expect(hv!.contents.value).toContain("total = SUM(Net)");
  expect(hv!.contents.value).not.toContain("Total of a column");
});

// --- prose notation and glyph-written calls (#64) ---------------------------

const glyphDoc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
Gap = ABS(Net)
Bar = |Net|
Flo = ⌊Net⌋
Root = √(Net)
Tot = Σ(Net)
\`\`\`
`;

async function hoverGlyph(line: number, character: number): Promise<string> {
  const uri = `file:///glyph-${line}-${character}.md`;
  await h.open(uri, glyphDoc);
  await h.nextDiagnostics(uri);
  const hv = await h.request<Hover | null>("textDocument/hover", {
    textDocument: { uri },
    position: { line, character },
  });
  return hv?.contents.value ?? "";
}

test("hovering a named call shows its entry and the prose spelling", async () => {
  const value = await hoverGlyph(6, 7); // the `B` of ABS in `Gap = ABS(Net)`
  expect(value).toContain("Absolute value");
  expect(value).toContain("also written: `|x|`");
});

test("a glyph-written call is hovered on its opening glyph only", async () => {
  // `Bar = |Net|`: the `|` is column 6, `Net` starts at 7, the closing `|` is 10
  expect(await hoverGlyph(7, 6)).toContain("Absolute value");
  expect(await hoverGlyph(7, 7)).not.toContain("Absolute value");
  expect(await hoverGlyph(7, 10)).not.toContain("Absolute value");
  // `Flo = ⌊Net⌋`
  expect(await hoverGlyph(8, 6)).toContain("Greatest multiple");
  expect(await hoverGlyph(8, 7)).not.toContain("Greatest multiple");
  // `Root = √(Net)`: `√` is column 7, `(` is 8, `Net` starts at 9
  expect(await hoverGlyph(9, 7)).toContain("square root");
  expect(await hoverGlyph(9, 9)).not.toContain("square root");
});

test("Σ hovers as SUM on the glyph, and the argument keeps its own hover", async () => {
  // `Tot = Σ(Net)`: `Σ` is column 6, `(` is 7, `Net` starts at 8. Before #64 the
  // three-character name width made the `N` at column 8 hover as SUM.
  expect(await hoverGlyph(10, 6)).toContain("Total of a column");
  expect(await hoverGlyph(10, 8)).not.toContain("Total of a column");
});

test("hovering a named SUM call is unchanged", async () => {
  const uri = "file:///named-sum.md";
  await h.open(uri, doc);
  await h.nextDiagnostics(uri);
  const at = (character: number) =>
    h.request<Hover | null>("textDocument/hover", {
      textDocument: { uri },
      position: { line: 6, character },
    });
  // `total = SUM(Net)`: the name spans columns 8..10, `Net` starts at 12
  expect((await at(8))!.contents.value).toContain("Total of a column");
  expect((await at(10))!.contents.value).toContain("Total of a column");
  expect((await at(12))!.contents.value).not.toContain("Total of a column");
});
