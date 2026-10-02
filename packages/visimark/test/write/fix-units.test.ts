import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";
import { fmt } from "../../src/write/fmt.js";

const DOC = `\`\`\`vmark
[W] = [kg*m^2/s^3]
t [degC] = 21
f [°F] = 70
\`\`\`

| Load [kg*m^2/s^2] | Rate [node⋅USD/month] | Note |
|---:|---:|---|
| 2 | 3 | 5 kg |

\`\`\`vmark #s
total [kg*m^2/s^2] = SUM(Load)
fee = 10 [USD/month/node] * 1
odd [N m] = 1
\`\`\`

Prose mentions [kg*m] and stays as written.
`;

test("--fix-units respells every bracket to its normalised form", () => {
  const r = fmt(DOC, { fixUnits: true });
  expect(r.output).toContain("[W] = [kg⋅m²/s³]");
  expect(r.output).toContain("t [℃] = 21");
  expect(r.output).toContain("f [℉] = 70");
  expect(r.output).toContain("| Load [kg⋅m²/s²] | Rate [USD⋅node/month] | Note |");
  expect(r.output).toContain("total [kg⋅m²/s²] = SUM(Load)");
  expect(r.output).toContain("fee = 10 [USD/month/node] * 1");
  expect(r.unitsFixed).toBe(6);
});

test("--fix-units never touches a malformed bracket, a cell decoration or prose", () => {
  const r = fmt(DOC, { fixUnits: true });
  expect(r.output).toContain("odd [N m] = 1");
  expect(r.output).toContain("| 2 | 3 | 5 kg |");
  expect(r.output).toContain("Prose mentions [kg*m] and stays as written.");
});

test("plain fmt leaves every bracket alone", () => {
  const r = fmt(DOC);
  expect(r.output).toBe(DOC);
  expect(r.unitsFixed).toBe(0);
});

test("a definition is never expanded or contracted", () => {
  const src = "```vmark\n[J] = [N*m]\nwork [J] = 1\nraw [kg*m^2/s^2] = 1\n```\n";
  const out = fmt(src, { fixUnits: true }).output;
  expect(out).toContain("work [J] = 1");
  expect(out).toContain("raw [kg⋅m²/s²] = 1");
  expect(out).toContain("[J] = [N⋅m]");
});

async function cli(args: string[]): Promise<{ code: number; out: string }> {
  const lines: string[] = [];
  const code = await runCli(args, { out: (l) => lines.push(l), err: (l) => lines.push(l) });
  return { code, out: lines.join("\n") };
}

test("the CLI reports the respelled units, and refuses the flag elsewhere", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-fix-units-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, "```vmark\nt [degC] = 21\n```\n");
  const r = await cli(["fmt", "--fix-units", path]);
  expect(r.out).toContain("updated 1 unit");
  expect(await Bun.file(path).text()).toBe("```vmark\nt [℃] = 21\n```\n");
  const refused = await cli(["check", "--fix-units", path]);
  expect(refused.code).toBe(2);
  expect(refused.out).toContain("--fix-units");
});

test("--fix-units composes with --fix-dates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-fix-units-"));
  const path = join(dir, "doc.md");
  writeFileSync(path, "```vmark\nt [degC] = 21\n```\n");
  const r = await cli(["fmt", "--fix-units", "--fix-dates", path]);
  expect(r.code).toBe(0);
});
