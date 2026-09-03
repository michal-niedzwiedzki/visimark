import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node.js";
import { StatusBar, type Status } from "./status.js";
import { show, TextProvider } from "./virtualDocs.js";

let client: LanguageClient | undefined;
let statusBar: StatusBar | undefined;

const EXPLAIN_SCHEME = "visimark-explain";
const REPORT_SCHEME = "visimark-report";

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const configured = vscode.workspace
    .getConfiguration("visimark")
    .get<string>("server.path", "");
  const module =
    configured && configured.length > 0
      ? configured
      : context.asAbsolutePath(path.join("dist", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6019"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "markdown", scheme: "file" },
      { language: "markdown", scheme: "untitled" },
    ],
    synchronize: {
      configurationSection: "visimark",
    },
  };

  client = new LanguageClient(
    "visimark",
    "VisiMark",
    serverOptions,
    clientOptions,
  );

  statusBar = new StatusBar();
  const explain = new TextProvider();
  const report = new TextProvider();

  context.subscriptions.push(
    statusBar,
    vscode.workspace.registerTextDocumentContentProvider(
      EXPLAIN_SCHEME,
      explain,
    ),
    vscode.workspace.registerTextDocumentContentProvider(REPORT_SCHEME, report),
    vscode.window.onDidChangeActiveTextEditor(() => statusBar?.refresh()),
    vscode.workspace.onDidCloseTextDocument((d) =>
      statusBar?.forget(d.uri.toString()),
    ),

    vscode.commands.registerCommand("visimark.fixAllStale", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await vscode.commands.executeCommand("editor.action.formatDocument");
    }),

    vscode.commands.registerCommand(
      "visimark.fixSheet",
      async (uri: string, _sheetId: string) => {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.parse(uri),
        );
        await vscode.window.showTextDocument(doc);
        await vscode.commands.executeCommand("editor.action.formatDocument");
      },
    ),

    vscode.commands.registerCommand(
      "visimark.explainSheet",
      async (uri: string, sheetId: string) => {
        const text = await runCliOn(uri, ["explain", `#${sheetId}`]);
        await show(
          explain,
          vscode.Uri.parse(`${EXPLAIN_SCHEME}:${sheetId}.txt`),
          text,
        );
      },
    ),

    vscode.commands.registerCommand("visimark.showReport", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = await runCliOn(editor.document.uri.toString(), ["check"]);
      await show(report, vscode.Uri.parse(`${REPORT_SCHEME}:report.txt`), text);
    }),

    vscode.commands.registerCommand("visimark.restartServer", async () => {
      await client?.restart();
    }),
  );

  await client.start();

  client.onNotification("visimark/status", (s: Status) => {
    statusBar?.record(s);
  });
}

/**
 * Run a CLI command against the *in-editor* text, so the report reflects
 * unsaved edits. The engine is bundled into the extension, so this is an
 * in-process call, not a subprocess.
 */
async function runCliOn(uri: string, args: string[]): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const { analyze, formatCheck } = await import("visimark");
  if (args[0] === "check") {
    const { result } = analyze(doc.getText());
    return formatCheck(doc.uri.fsPath, result.findings);
  }
  const { runCli } = await import("visimark");
  const lines: string[] = [];
  await runCli([...args, doc.uri.fsPath], {
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
  });
  return lines.join("\n");
}

export async function deactivate(): Promise<void> {
  await client?.stop();
  client = undefined;
  statusBar = undefined;
}
