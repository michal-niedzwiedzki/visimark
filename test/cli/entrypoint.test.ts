import { expect, test } from "bun:test";

/**
 * `bun src/cli/main.ts check FILE` must actually run. Before the
 * `import.meta.main` guard existed, main.ts only exported runCli: the module
 * loaded, no command ran, and the process exited 0 — a silent false green on a
 * document with 26 problems in it.
 */
async function run(args: string[]): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(["bun", "src/cli/main.ts", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  return { code: await proc.exited, out: out + err };
}

test("running main.ts directly reports the drift invoice and exits 1", async () => {
  const { code, out } = await run(["check", "doc/example-invoice-drift.md"]);
  expect(out).toContain("26 problems (21 stale, 5 errors)");
  expect(code).toBe(1);
});

test("running main.ts directly on the clean invoice exits 0", async () => {
  const { code, out } = await run(["check", "doc/example-invoice.md"]);
  expect(out).toContain("0 problems (0 stale, 0 errors)");
  expect(code).toBe(0);
});

test("no command prints usage and exits 2", async () => {
  const { code, out } = await run([]);
  expect(out).toContain("no command given");
  expect(code).toBe(2);
});
