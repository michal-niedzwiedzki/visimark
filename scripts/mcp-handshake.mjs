/**
 * Drive an MCP stdio handshake against an installed `visimark-mcp` binary and
 * assert it is actually usable: `initialize`, then `tools/list`, then the
 * eight tool names with their annotations.
 *
 * This is what `smoke-node` and `smoke-bun` run against the packed tarball,
 * each with the other runtime absent from `PATH`. A `--version` check would
 * pass on a server that cannot speak the protocol; the handshake is the
 * smallest assertion that proves the binary works.
 *
 * No dependencies and no repo imports: the smoke jobs download this file
 * beside the tarballs and run it under whichever runtime they have.
 *
 *   node scripts/mcp-handshake.mjs /path/to/visimark-mcp
 *   bun  scripts/mcp-handshake.mjs /path/to/visimark-mcp
 */
import { spawn } from "node:child_process";

const EXPECTED = [
  "visimark_check",
  "visimark_eval",
  "visimark_explain",
  "visimark_fmt",
  "visimark_fmt_apply",
  "visimark_infer",
  "visimark_infer_apply",
  "visimark_ref",
];

const READ_ONLY = [
  "visimark_check",
  "visimark_eval",
  "visimark_explain",
  "visimark_fmt",
  "visimark_infer",
  "visimark_ref",
];
const DESTRUCTIVE = ["visimark_fmt_apply", "visimark_infer_apply"];

const bin = process.argv[2];
if (!bin) {
  console.error("usage: mcp-handshake.mjs <path to visimark-mcp>");
  process.exit(2);
}

function fail(message) {
  console.error(`mcp-handshake: ${message}`);
  if (stderr.trim() !== "") console.error(`--- the server's stderr ---\n${stderr.trimEnd()}`);
  if (exited) console.error(`--- the server exited: ${JSON.stringify(exited)} ---`);
  process.exit(1);
}

const child = spawn(bin, [], { stdio: ["pipe", "pipe", "pipe"] });

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

// A server that dies on an unresolved import looks exactly like one that is
// slow to answer, so say which it was. Without this, every startup failure
// reported itself as "initialize timed out" and hid the reason.
let exited = null;
child.on("exit", (code, signal) => {
  exited = { code, signal };
  for (const [, reject] of waiting) {
    reject(new Error(`the server exited (code ${code}, signal ${signal}) before answering`));
  }
  waiting.clear();
});
child.on("error", (e) => {
  fail(`could not launch ${bin}: ${e.message}`);
});

const pending = new Map();
const waiting = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += String(chunk);
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line === "") continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      // Nothing but protocol traffic may reach stdout. A stray console.log
      // corrupts the stream for the whole session, so it fails here.
      fail(`non-protocol output on stdout: ${line.slice(0, 200)}`);
      return;
    }
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(id, method, params) {
  return new Promise((resolve, reject) => {
    if (exited) {
      reject(new Error(`the server exited (code ${exited.code}) before ${method}`));
      return;
    }
    waiting.set(id, reject);
    pending.set(id, (message) => {
      waiting.delete(id);
      resolve(message);
    });
    send({ jsonrpc: "2.0", id, method, params });
    setTimeout(() => reject(new Error(`${method} timed out after 20s`)), 20000).unref?.();
  });
}

try {
  const init = await request(1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "ci-smoke", version: "0.0.0" },
  });
  if (init.error) fail(`initialize failed: ${JSON.stringify(init.error)}`);
  const name = init.result?.serverInfo?.name;
  if (name !== "visimark") fail(`serverInfo.name is ${JSON.stringify(name)}, expected "visimark"`);
  if (!/^\d+\.\d+\.\d+/.test(init.result?.serverInfo?.version ?? "")) {
    fail(`serverInfo.version is not a version: ${init.result?.serverInfo?.version}`);
  }

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  const listed = await request(2, "tools/list", {});
  if (listed.error) fail(`tools/list failed: ${JSON.stringify(listed.error)}`);
  const tools = listed.result?.tools ?? [];
  const names = tools.map((t) => t.name).sort();
  if (names.join(",") !== EXPECTED.join(",")) {
    fail(`tools/list returned ${names.join(",")}, expected ${EXPECTED.join(",")}`);
  }

  const byName = new Map(tools.map((t) => [t.name, t.annotations ?? {}]));
  for (const tool of READ_ONLY) {
    const a = byName.get(tool);
    if (a.readOnlyHint !== true || a.destructiveHint !== false) {
      fail(`${tool} should be readOnly and non-destructive, got ${JSON.stringify(a)}`);
    }
  }
  for (const tool of DESTRUCTIVE) {
    // Truthful in both gate states: the annotation describes the tool, not the
    // session, and hosts gate on it.
    const a = byName.get(tool);
    if (a.readOnlyHint !== false || a.destructiveHint !== true) {
      fail(`${tool} should be destructive, got ${JSON.stringify(a)}`);
    }
  }

  // Listing tools proves the server started. Calling one proves the engine it
  // imports actually loaded and ran — a different failure, and the one a
  // resolution problem in the installed tree produces.
  const called = await request(3, "tools/call", {
    name: "visimark_check",
    arguments: { content: "| Item | Qty |\n|---|---:|\n| a | 1 |\n" },
  });
  if (called.error) fail(`tools/call failed: ${JSON.stringify(called.error)}`);
  if (called.result?.isError) {
    fail(`visimark_check reported a tool error: ${JSON.stringify(called.result.content)}`);
  }
  let body;
  try {
    body = JSON.parse(called.result.content[0].text);
  } catch {
    fail(`visimark_check did not return a JSON envelope: ${JSON.stringify(called.result)}`);
  }
  // A table with no rules is a COVERAGE problem, and a **successful** call
  // reporting it — the whole §3.1 contract, end to end over a real pipe.
  if (body.command !== "check" || body.status !== "problems") {
    fail(
      `expected a successful check reporting problems, got ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  if (!body.findings?.some((f) => f.code === "COVERAGE")) {
    fail(`expected a COVERAGE finding, got ${JSON.stringify(body.findings).slice(0, 200)}`);
  }
  if (!/^\d+\.\d+\.\d+/.test(body.visimark ?? "")) {
    fail(`the envelope's engine version is not a version: ${body.visimark}`);
  }

  if (stderr.trim() !== "") fail(`unexpected stderr: ${stderr.trim().slice(0, 200)}`);
  console.log(
    `mcp-handshake: ok — ${names.length} tools, server ${init.result.serverInfo.version},` +
      ` engine ${body.visimark}, and visimark_check ran`,
  );
  child.kill();
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
