import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

function withFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "visimark-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, contents);
  return path;
}

async function check(contents: string): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const code = await runCli(["check", withFile(contents)], {
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
  });
  return { code, out: lines.join("\n") };
}

test("check reports DUP and exits 1", async () => {
  const { code, out } = await check(`
\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`);
  expect(code).toBe(1);
  expect(out).toContain("DUP");
  expect(out).toContain("already defined in this scope");
});

test("check reports a mixed-unit column and exits 1", async () => {
  const { code, out } = await check(`| Item | Price |
|------|------:|
| pen  | $5.50 |
| ink  | €4.00 |

\`\`\`vmark #s
total = SUM(Price)
\`\`\`

Total: **9.50**<!--vmark=s.total-->
`);
  expect(code).toBe(1);
  expect(out).toContain("UNIT");
  expect(out).toContain("mixes units");
});

test("check is silent on a consistently decorated document", async () => {
  const { code, out } = await check(`| Item | Price | Qty |    Net |
|------|------:|----:|-------:|
| pen  | $5.50 |   3 | $16.50 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **$16.50**<!--vmark=s.total-->
`);
  expect(code).toBe(0);
  expect(out).toContain("0 problems");
});
