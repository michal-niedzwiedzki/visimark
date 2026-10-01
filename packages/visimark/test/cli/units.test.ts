import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

function withFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "visimark-units-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, contents);
  return path;
}

async function run(args: string[]): Promise<{ code: number; out: string; lines: string[] }> {
  const lines: string[] = [];
  const code = await runCli(args, { out: (l) => lines.push(l), err: (l) => lines.push(l) });
  return { code, out: lines.join("\n"), lines };
}

const WEIGHT = `| Weight [kg] | Count |
|---:|---:|
| 2 | 4 |
| 3 | 1 |

\`\`\`vmark #s
total [kg] = SUM(Weight)
n = COUNT(Count)
\`\`\`
`;

test("eval prints a unit-bearing name with its unit in brackets", async () => {
  const { code, lines } = await run(["eval", withFile(WEIGHT)]);
  expect(code).toBe(0);
  expect(lines).toEqual(["s.total [kg]  5", "s.n           2"]);
});

test("eval --get prints the bare value", async () => {
  const { out } = await run(["eval", withFile(WEIGHT), "--get", "s.total"]);
  expect(out).toBe("5");
});

test("eval --json keys the name and adds units, input columns included", async () => {
  const { out } = await run(["eval", withFile(WEIGHT), "--json"]);
  const body = JSON.parse(out) as { values: object; units: object };
  expect(body.values).toEqual({ "s.total": "5", "s.n": "2" });
  expect(body.units).toEqual({ "s.total": { kg: 1 }, "s.Weight": { kg: 1 } });
  expect(Object.keys(body.units)).toEqual(["s.total", "s.Weight"]);
});

test("eval --json units is {} when nothing has a unit", async () => {
  const { out } = await run(["eval", withFile("```vmark\nx = 1\n```\n"), "--json"]);
  expect((JSON.parse(out) as { units: object }).units).toEqual({});
});

test("eval --json --get restricts units to the value asked for", async () => {
  const { out } = await run(["eval", withFile(WEIGHT), "--json", "--get", "s.total"]);
  expect((JSON.parse(out) as { units: object }).units).toEqual({ "s.total": { kg: 1 } });
});

test("a compound unit prints normalised in text and as a map in JSON", async () => {
  const doc =
    "```vmark\nm [kg] = 2\nd [m] = 3\nt [s] = 1\nwork precision 0 = m * d * d / (t * t)\n```\n";
  const text = await run(["eval", withFile(doc)]);
  expect(text.out).toContain("work [kg⋅m²/s²]  18");
  const json = JSON.parse((await run(["eval", withFile(doc), "--json"])).out) as {
    units: Record<string, object>;
  };
  expect(json.units["work"]).toEqual({ kg: 1, m: 2, s: -2 });
});
