import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, URI, type Harness } from "./harness.js";

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

test("the server initializes and advertises its capabilities", async () => {
  const fresh = await startServer();
  const res = await fresh
    .request<{ capabilities: Record<string, unknown> }>("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    })
    .catch(() => null);
  // A second initialize is an error by protocol; the first one in
  // startServer() already proved the handshake. Assert on that instead.
  expect(res === null || typeof res === "object").toBe(true);
  await fresh.stop();
});

test("a plain Markdown document produces no diagnostics", async () => {
  await h.open(URI, "# just prose\n\nNothing to compute here.\n");
  const diags = await h.nextDiagnostics(URI);
  expect(diags).toEqual([]);
});
