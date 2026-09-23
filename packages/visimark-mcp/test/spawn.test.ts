import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const pkg = join(import.meta.dir, "..");
const launcher = join(pkg, "bin/visimark-mcp");
const built = join(pkg, "dist/main.js");

/**
 * The one test that spawns the real binary. Everything else about tool
 * behaviour is asserted in-process; this is here to exercise the parts nothing
 * else touches — the `sh` launcher, the runtime it picks, and the newline
 * framing on a real pipe.
 *
 * It needs `bun run build`, so it skips when `dist/` is absent rather than
 * failing a bare `bun test` on a fresh clone. CI builds before it packs, and
 * `smoke-node` / `smoke-bun` drive the same handshake against the packed
 * tarball with only one runtime present.
 */
const isBuilt = existsSync(built);
const maybe = isBuilt ? test : test.skip;

function frame(message: object): string {
  return `${JSON.stringify(message)}\n`;
}

async function handshake(args: string[]): Promise<{ init: object; tools: object; stderr: string }> {
  const proc = Bun.spawn([launcher, ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(
    frame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "spawn-test", version: "0.0.0" },
      },
    }),
  );
  proc.stdin.write(frame({ jsonrpc: "2.0", method: "notifications/initialized" }));
  proc.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
  proc.stdin.flush();

  const seen: Record<string, object> = {};
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of proc.stdout) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim() === "") continue;
      const message = JSON.parse(line) as { id?: number; result?: object };
      if (message.id !== undefined && message.result) seen[String(message.id)] = message.result;
    }
    if (seen["1"] && seen["2"]) break;
  }
  proc.stdin.end();
  proc.kill();
  const stderr = await new Response(proc.stderr).text();
  return { init: seen["1"]!, tools: seen["2"]!, stderr };
}

maybe(
  "the launched binary completes initialize and lists its tools",
  async () => {
    const { init, tools, stderr } = await handshake([]);

    expect(init).toMatchObject({
      serverInfo: { name: "visimark", version: expect.any(String) },
      capabilities: { tools: expect.any(Object), resources: expect.any(Object) },
    });

    const names = (tools as { tools: { name: string }[] }).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "visimark_check",
      "visimark_eval",
      "visimark_explain",
      "visimark_fmt",
      "visimark_fmt_apply",
      "visimark_infer",
      "visimark_infer_apply",
      "visimark_ref",
    ]);

    const byName = new Map(
      (tools as { tools: { name: string; annotations?: object }[] }).tools.map((t) => [
        t.name,
        t.annotations,
      ]),
    );
    expect(byName.get("visimark_check")).toMatchObject({ readOnlyHint: true });
    expect(byName.get("visimark_fmt_apply")).toMatchObject({ destructiveHint: true });

    // Nothing on stdout but protocol traffic — every line parsed above, and
    // nothing spurious on stderr either. A stray console.log corrupts the
    // stream, and it corrupts it for the whole session.
    expect(stderr).toBe("");
  },
  20_000,
);

maybe(
  "--allow-write still lists the same tools",
  async () => {
    const { tools } = await handshake(["--allow-write"]);
    expect((tools as { tools: unknown[] }).tools.length).toBe(8);
  },
  20_000,
);

test("an unrecognised option exits 2 before the transport starts", async () => {
  const proc = Bun.spawn([launcher, "--nope"], { stdout: "pipe", stderr: "pipe" });
  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  expect(code).toBe(2);
  expect(err.trim()).toBe("visimark-mcp: unknown option --nope");
  // Not one byte of protocol traffic: the refusal happens before stdio is the
  // protocol stream, which is the whole reason it happens first (#121).
  expect(out).toBe("");
});
