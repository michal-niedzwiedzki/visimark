import {
  createConnection,
  DidChangeConfigurationNotification,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDocument, forgetDocument } from "./analysis.js";
import { DEFAULTS, mergeSettings, type Settings } from "./settings.js";
import { statusOf, toDiagnostics } from "./diagnostics.js";
import { formatEdits } from "./formatting.js";
import { codeActionsFor } from "./codeActions.js";
import { inlayHintsFor } from "./inlayHints.js";
import { codeLensesFor } from "./codeLens.js";
import { hoverAt } from "./hover.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let settings: Settings = DEFAULTS;

/** whether the client accepts `client/registerCapability` at all */
let dynamicConfiguration = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  dynamicConfiguration = Boolean(
    params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration,
  );
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      inlayHintProvider: true,
      codeLensProvider: { resolveProvider: false },
      hoverProvider: true,
      codeActionProvider: {
        codeActionKinds: ["quickfix", "source.fixAll.visimark"],
      },
    },
  };
});

connection.onInitialized(() => {
  // Registering against a client that does not advertise dynamic registration
  // draws a MethodNotFound response. Left unhandled that rejection takes the
  // whole server down, so ask only when the client said yes, and survive a no.
  if (!dynamicConfiguration) return;
  connection.client
    .register(DidChangeConfigurationNotification.type, { section: "visimark" })
    .catch((e: unknown) => {
      connection.console.warn(`visimark: configuration registration failed: ${String(e)}`);
    });
});

connection.onDidChangeConfiguration((change) => {
  settings = mergeSettings((change.settings as { visimark?: unknown } | undefined)?.visimark);
  for (const doc of documents.all()) scheduleCheck(doc);
});

// ---- the check policy: open, debounced change, immediate save ----

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCheck(doc: TextDocument, immediate = false): void {
  const existing = timers.get(doc.uri);
  if (existing) clearTimeout(existing);
  if (immediate) {
    void runCheck(doc);
    return;
  }
  timers.set(
    doc.uri,
    setTimeout(() => {
      timers.delete(doc.uri);
      void runCheck(doc);
    }, settings.check.debounce),
  );
}

async function runCheck(doc: TextDocument): Promise<void> {
  if (!settings.enable) {
    await connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
    return;
  }
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  await connection.sendDiagnostics({
    uri: doc.uri,
    diagnostics: toDiagnostics(doc, analysis),
  });
  await connection.sendNotification("visimark/status", statusOf(doc.uri, analysis));
}

documents.onDidOpen((e) => scheduleCheck(e.document, true));
documents.onDidChangeContent((e) => scheduleCheck(e.document));
documents.onDidSave((e) => scheduleCheck(e.document, true));
documents.onDidClose((e) => {
  const t = timers.get(e.document.uri);
  if (t) clearTimeout(t);
  timers.delete(e.document.uri);
  forgetDocument(e.document.uri);
  void connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ---- formatting: the only write path, and only when asked ----

connection.onDocumentFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return formatEdits(doc, analysis, { fixDates: settings.format.fixDates });
});

connection.onDocumentRangeFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return formatEdits(doc, analysis, { fixDates: settings.format.fixDates }, params.range);
});

connection.onCodeAction((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return codeActionsFor(doc, analysis, params.range, params.context.only, settings);
});

connection.languages.inlayHint.on((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable || !settings.inlayHints.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return inlayHintsFor(doc, analysis, params.range);
});

connection.onCodeLens((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable || !settings.codeLens.enable) return [];
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return codeLensesFor(doc, analysis);
});

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !settings.enable) return null;
  const analysis = analyzeDocument(doc.uri, doc.version, doc.getText());
  return hoverAt(doc, analysis, params.position);
});

documents.listen(connection);
connection.listen();

export { connection, documents };
