import * as vscode from "vscode";

/**
 * Read-only documents for `explain` and the full `check` report. The content
 * is pushed in by the extension; the provider just serves it.
 */
export class TextProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly content = new Map<string, string>();
  readonly onDidChange = this.emitter.event;

  set(uri: vscode.Uri, text: string): void {
    this.content.set(uri.toString(), text);
    this.emitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? "";
  }
}

export async function show(provider: TextProvider, uri: vscode.Uri, text: string): Promise<void> {
  provider.set(uri, text);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
}
