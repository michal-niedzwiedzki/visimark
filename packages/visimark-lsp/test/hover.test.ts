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
