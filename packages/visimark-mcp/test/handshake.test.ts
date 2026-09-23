import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { WRITES_DISABLED } from "../src/gate.js";
import { createServer } from "../src/server.js";

const repo = join(import.meta.dir, "../../..");
const clean = join(repo, "docs/example-invoice.md");
const drift = join(repo, "docs/example-invoice-drift.md");

/**
 * A connected client and server over an in-memory transport — fast, hermetic,
 * and the same code path a real host drives. `roots` is what the host
 * declares; an empty list is the closed gate, which is what a host that
 * declares nothing looks like.
 */
async function connected(opts: { allowWrite?: boolean; roots?: string[] } = {}) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const { connect } = createServer({ allowWrite: opts.allowWrite ?? false });
  const client = new Client(
    { name: "test", version: "0.0.0" },
    { capabilities: opts.roots ? { roots: {} } : {} },
  );
  if (opts.roots) {
    client.setRequestHandler(
      // the client answers roots/list with what the "host" declared
      (await import("@modelcontextprotocol/sdk/types.js")).ListRootsRequestSchema,
      () => ({ roots: opts.roots!.map((r) => ({ uri: pathToFileURL(r).href, name: r })) }),
    );
  }
  await Promise.all([connect(serverSide), client.connect(clientSide)]);
  // the server asks for roots once initialization completes; let that land
  await new Promise((r) => setTimeout(r, 10));
  return client;
}

function body(result: { content: unknown[] }): Record<string, unknown> {
  const first = result.content[0] as { text: string };
  return JSON.parse(first.text) as Record<string, unknown>;
}

test("initialize names the server and its own version", async () => {
  const client = await connected();
  const info = client.getServerVersion();
  // The SERVER version, not the engine's. The envelope carries the engine's,
  // and is not widened to carry both (§3.3).
  expect(info).toMatchObject({ name: "visimark", version: expect.any(String) });
});

test("tools/list returns the eight names with their annotations", async () => {
  const client = await connected();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    "visimark_check",
    "visimark_eval",
    "visimark_explain",
    "visimark_fmt",
    "visimark_fmt_apply",
    "visimark_infer",
    "visimark_infer_apply",
    "visimark_ref",
  ]);
  const byName = new Map(tools.map((t) => [t.name, t]));
  for (const name of ["visimark_check", "visimark_fmt", "visimark_infer", "visimark_ref"]) {
    expect({ name, ...byName.get(name)!.annotations }).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  }
  for (const name of ["visimark_fmt_apply", "visimark_infer_apply"]) {
    expect({ name, ...byName.get(name)!.annotations }).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  }
});

test("the apply tools are listed even with the gate shut", async () => {
  const client = await connected();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name)).toContain("visimark_fmt_apply");
});

test("findings are a successful call, not a protocol error", async () => {
  const client = await connected();
  const result = await client.callTool({ name: "visimark_check", arguments: { path: drift } });
  expect(result.isError).toBeFalsy();
  expect(body(result as { content: unknown[] })["status"]).toBe("problems");
});

test("a clean document is status ok", async () => {
  const client = await connected();
  const result = await client.callTool({ name: "visimark_check", arguments: { path: clean } });
  expect(body(result as { content: unknown[] })).toMatchObject({ status: "ok", findings: [] });
});

test("the 2 class is a tool error carrying the envelope's error object", async () => {
  const client = await connected();
  for (const [args, code] of [
    [{}, "USAGE"],
    [{ path: clean, content: "x" }, "USAGE"],
    [{ path: join(repo, "nope.md") }, "READ"],
  ] as const) {
    const result = await client.callTool({ name: "visimark_check", arguments: args });
    expect(result.isError).toBe(true);
    expect(body(result as { content: unknown[] })).toMatchObject({
      command: "check",
      status: "error",
      error: { code },
    });
  }
});

test("every read tool's error class survives the transport", async () => {
  const client = await connected();
  const cases: [string, Record<string, unknown>, string][] = [
    ["visimark_ref", { name: "NOPE" }, "USAGE"],
    ["visimark_check", {}, "USAGE"],
    ["visimark_explain", { path: clean, sheet: "nope" }, "USAGE"],
    ["visimark_eval", { path: clean, get: "nope" }, "USAGE"],
    ["visimark_infer", {}, "USAGE"],
    ["visimark_fmt", { path: join(repo, "nope.md") }, "READ"],
  ];
  for (const [name, args, code] of cases) {
    const result = await client.callTool({ name, arguments: args });
    expect({ name, isError: result.isError }).toMatchObject({ isError: true });
    expect({ name, ...(body(result as { content: unknown[] })["error"] as object) }).toMatchObject({
      code,
    });
  }
});

test("with no roots declared, an apply is refused however the flag is set", async () => {
  // No roots means no writes. An operator who passes the flag into a host that
  // declares nothing has not chosen a blast radius.
  const client = await connected({ allowWrite: true });
  const result = await client.callTool({
    name: "visimark_fmt_apply",
    arguments: { path: drift, plan: { sha256: "x", edits: [] } },
  });
  expect(result.isError).toBe(true);
  expect(body(result as { content: unknown[] })["error"]).toMatchObject({
    message: WRITES_DISABLED,
  });
});

test("with the flag and a declared root, an apply lands", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-hs-"));
  const path = join(dir, "drift.md");
  copyFileSync(drift, path);
  const client = await connected({ allowWrite: true, roots: [dir] });

  const planned = await client.callTool({ name: "visimark_fmt", arguments: { path } });
  const plan = body(planned as { content: unknown[] });
  const applied = await client.callTool({ name: "visimark_fmt_apply", arguments: { path, plan } });
  expect(applied.isError).toBeFalsy();
  expect(body(applied as { content: unknown[] })).toMatchObject({ applied: true, changed: true });
  expect(readFileSync(path, "utf8")).not.toBe(readFileSync(drift, "utf8"));
});

test("the declared root is the boundary, not the flag alone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-hs2-"));
  const client = await connected({ allowWrite: true, roots: [dir] });
  const result = await client.callTool({
    name: "visimark_fmt_apply",
    arguments: { path: drift, plan: { sha256: "x", edits: [] } },
  });
  expect(result.isError).toBe(true);
  expect(String(body(result as { content: unknown[] })["error"])).toBeDefined();
});

test("resources list and read", async () => {
  const client = await connected();
  const { resources } = await client.listResources();
  expect(resources.map((r) => r.uri)).toEqual([
    "visimark://skill",
    "visimark://cli-reference",
    "visimark://function-reference",
    "visimark://example/invoice",
    "visimark://example/drift",
  ]);
  for (const r of resources) {
    const read = await client.readResource({ uri: r.uri });
    expect({
      uri: r.uri,
      empty: (read.contents[0] as { text: string }).text.trim() === "",
    }).toMatchObject({ empty: false });
  }
});

test("prompts list and render", async () => {
  const client = await connected();
  const { prompts } = await client.listPrompts();
  expect(prompts.map((p) => p.name)).toEqual(["visimark/take-over", "visimark/author"]);
  const got = await client.getPrompt({ name: "visimark/take-over", arguments: { path: "q.md" } });
  const first = got.messages[0]!.content as { text: string };
  expect(first.text).toContain("visimark_infer");
});
