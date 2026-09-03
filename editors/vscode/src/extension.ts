import * as path from "node:path";
import * as vscode from "vscode";
import {
  DocumentFormattingRequest,
  LanguageClient,
  State,
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

    // `onWillSave` rather than `onDidSave`: the edits are folded into the
    // content being written, so the file lands on disk correct and the
    // document stays clean. Fixing after the save would dirty it again.
    vscode.workspace.onWillSaveTextDocument((event) => {
      if (!fixesOnSave(event)) return;
      event.waitUntil(staleEdits(event.document));
    }),

    vscode.commands.registerCommand("visimark.fixAllStale", async () => {
      const doc = await target();
      if (doc) await fix(doc);
    }),

    // Also a CodeLens target, which supplies the document the lens sits in.
    vscode.commands.registerCommand(
      "visimark.fixSheet",
      async (uri?: string, _sheetId?: string) => {
        const doc = await target(uri);
        if (doc) await fix(doc);
      },
    ),

    // Likewise: the lens names a sheet, the palette names nothing and gets
    // the whole of the active document.
    vscode.commands.registerCommand(
      "visimark.explainSheet",
      async (uri?: string, sheetId?: string) => {
        const doc = await target(uri);
        if (!doc) return;
        const args = sheetId ? ["explain", `#${sheetId}`] : ["explain"];
        const text = await runCliOn(doc, args);
        const name = sheetId ?? path.basename(doc.uri.fsPath);
        await show(
          explain,
          vscode.Uri.parse(`${EXPLAIN_SCHEME}:${name}.txt`),
          text,
        );
      },
    ),

    vscode.commands.registerCommand("visimark.showReport", async () => {
      const doc = await target();
      if (!doc) return;
      const text = await runCliOn(doc, ["check"]);
      await show(report, vscode.Uri.parse(`${REPORT_SCHEME}:report.txt`), text);
    }),

    // A client whose *first* start failed cannot be restarted at all — the
    // window has to be reloaded — so say that rather than let the rejection
    // surface as "command failed".
    vscode.commands.registerCommand("visimark.restartServer", async () => {
      try {
        await client?.restart();
      } catch {
        void vscode.window.showErrorMessage(
          "VisiMark: the server could not be restarted. Reload the window to try again.",
        );
      }
    }),
  );

  await client.start();

  client.onNotification("visimark/status", (s: Status) => {
    statusBar?.record(s);
  });
}

/**
 * The document a command should act on: the one a CodeLens named, or else
 * whatever Markdown file is in front of the user. Commands reached from the
 * Command Palette arrive with no arguments at all.
 */
async function target(uri?: string): Promise<vscode.TextDocument | undefined> {
  if (uri) return vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.languageId !== "markdown") {
    void vscode.window.showWarningMessage(
      "VisiMark: open a Markdown file first.",
    );
    return undefined;
  }
  return doc;
}

/**
 * Rewrite the stale values in `doc` using *VisiMark's* formatter.
 *
 * Deliberately not `editor.action.formatDocument`: that runs whatever
 * `editor.defaultFormatter` names — Prettier, for most people who write
 * Markdown — which reflows the prose and leaves every stale value in place,
 * so a command called "fix all stale values" appears to do nothing.
 */
async function fix(doc: vscode.TextDocument): Promise<void> {
  if (!client || client.state !== State.Running) {
    void vscode.window.showWarningMessage(
      "VisiMark: the language server is not running.",
    );
    return;
  }

  const edits = await staleEdits(doc);
  if (edits.length === 0) {
    void vscode.window.showInformationMessage("VisiMark: nothing to fix.");
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  for (const e of edits) {
    edit.replace(doc.uri, e.range, e.newText);
  }
  await vscode.workspace.applyEdit(edit);
}

/**
 * The edits that would bring every stale value in `doc` up to date.
 *
 * Answers with none rather than throwing when the server cannot be reached:
 * this also runs inside a save, where a dialog would interrupt something the
 * user did not ask VisiMark about.
 */
async function staleEdits(doc: vscode.TextDocument): Promise<vscode.TextEdit[]> {
  if (!client || client.state !== State.Running) return [];
  try {
    const edits = await client.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri: doc.uri.toString() },
      options: { tabSize: 2, insertSpaces: true },
    });
    if (!edits || edits.length === 0) return [];
    return await client.protocol2CodeConverter.asTextEdits(edits);
  } catch {
    return [];
  }
}

/**
 * Whether this save is one the user asked to be fixed.
 *
 * `format.fixOnSave` is off by default, and an autosave never counts however
 * it is set: `files.autoSave` fires every few hundred milliseconds, and
 * rewriting values then would move text out from under the cursor mid-edit.
 * `editor.formatOnSave` draws the same line.
 */
function fixesOnSave(event: vscode.TextDocumentWillSaveEvent): boolean {
  if (event.document.languageId !== "markdown") return false;
  if (event.reason === vscode.TextDocumentSaveReason.AfterDelay) return false;
  const config = vscode.workspace.getConfiguration("visimark");
  return (
    config.get<boolean>("enable", true) &&
    config.get<boolean>("format.fixOnSave", false)
  );
}

/**
 * Run a CLI command against the *in-editor* text, so the report reflects
 * unsaved edits. The engine is bundled into the extension, so this is an
 * in-process call, not a subprocess.
 */
async function runCliOn(
  doc: vscode.TextDocument,
  args: string[],
): Promise<string> {
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
