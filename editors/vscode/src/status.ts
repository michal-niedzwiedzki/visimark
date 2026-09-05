import * as vscode from "vscode";

export interface Status {
  uri: string;
  stale: number;
  errors: number;
}

export class StatusBar {
  private readonly item: vscode.StatusBarItem;
  private readonly seen = new Map<string, Status>();

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "visimark.showReport";
  }

  record(status: Status): void {
    this.seen.set(status.uri, status);
    this.refresh();
  }

  forget(uri: string): void {
    this.seen.delete(uri);
    this.refresh();
  }

  refresh(): void {
    const enabled = vscode.workspace
      .getConfiguration("visimark")
      .get<boolean>("statusBar.enable", true);
    const editor = vscode.window.activeTextEditor;
    const status = editor ? this.seen.get(editor.document.uri.toString()) : undefined;

    if (!enabled || !status) {
      this.item.hide();
      return;
    }
    if (status.stale === 0 && status.errors === 0) {
      this.item.text = "$(check) VisiMark";
      this.item.tooltip = "VisiMark: this document agrees with its formulas";
    } else {
      const bits: string[] = [];
      if (status.stale > 0) bits.push(`${status.stale} stale`);
      if (status.errors > 0) {
        bits.push(`${status.errors} error${status.errors === 1 ? "" : "s"}`);
      }
      this.item.text = `$(warning) VisiMark: ${bits.join(", ")}`;
      this.item.tooltip = "VisiMark: click for the full report";
    }
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
