import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "src", "server.ts");

export interface Harness {
  conn: MessageConnection;
  open(uri: string, text: string): Promise<void>;
  change(uri: string, text: string): Promise<void>;
  save(uri: string): Promise<void>;
  request<T>(method: string, params: unknown): Promise<T>;
  nextDiagnostics(uri: string, timeoutMs?: number): Promise<Diagnostic[]>;
  stop(): Promise<void>;
}

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string;
  source?: string;
  message: string;
  relatedInformation?: unknown[];
}

export async function startServer(): Promise<Harness> {
  const child: ChildProcessWithoutNullStreams = spawn("bun", [serverEntry, "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const conn = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );

  const pending = new Map<string, Diagnostic[][]>();
  const waiters = new Map<string, ((d: Diagnostic[]) => void)[]>();

  conn.onNotification(
    "textDocument/publishDiagnostics",
    (p: { uri: string; diagnostics: Diagnostic[] }) => {
      const w = waiters.get(p.uri);
      if (w && w.length > 0) {
        w.shift()!(p.diagnostics);
        return;
      }
      const q = pending.get(p.uri) ?? [];
      q.push(p.diagnostics);
      pending.set(p.uri, q);
    },
  );

  conn.listen();

  await conn.sendRequest("initialize", {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
  });
  await conn.sendNotification("initialized", {});

  const versions = new Map<string, number>();

  return {
    conn,
    async open(uri, text) {
      versions.set(uri, 1);
      await conn.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: "markdown", version: 1, text },
      });
    },
    async change(uri, text) {
      const v = (versions.get(uri) ?? 1) + 1;
      versions.set(uri, v);
      await conn.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: v },
        contentChanges: [{ text }],
      });
    },
    async save(uri) {
      await conn.sendNotification("textDocument/didSave", {
        textDocument: { uri },
      });
    },
    request<T>(method: string, params: unknown) {
      return conn.sendRequest(method, params) as Promise<T>;
    },
    nextDiagnostics(uri, timeoutMs = 4000) {
      const q = pending.get(uri);
      if (q && q.length > 0) return Promise.resolve(q.shift()!);
      return new Promise<Diagnostic[]>((resolve, reject) => {
        const list = waiters.get(uri) ?? [];
        list.push(resolve);
        waiters.set(uri, list);
        setTimeout(
          () => reject(new Error(`no diagnostics for ${uri} in ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
    },
    async stop() {
      conn.dispose();
      child.kill();
    },
  };
}

export const URI = "file:///test/doc.md";
