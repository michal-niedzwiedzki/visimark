import * as fs from "node:fs";
import * as vscode from "vscode";
import markdownItVisimark, { type MarkdownItVisimarkOptions } from "markdown-it-visimark";

/**
 * The built-in Markdown preview's VisiMark marks (#373, spec §2.7).
 *
 * VS Code builds one markdown-it instance for every preview and calls
 * `extendMarkdownIt` only when it builds it, so the setting is read here and
 * a change to it reloads the instance through `markdown.api.reloadPlugins`
 * (registered in `extension.ts`).
 *
 * The path comes from the **render** env's `currentDocument`; VS Code parses
 * with an env that has none. Imports are read from disk next to the
 * previewed file, refusing a symlink at the final component; the engine's
 * gate confines them to the file's directory.
 */

export function previewOptions(): MarkdownItVisimarkOptions {
  return {
    path: (env) => {
      const uri = (env as { currentDocument?: vscode.Uri } | undefined)?.currentDocument;
      return uri !== undefined && uri.scheme === "file" ? uri.fsPath : null;
    },
    readImport: (absolutePath) => {
      try {
        if (fs.lstatSync(absolutePath).isSymbolicLink()) return null;
        return fs.readFileSync(absolutePath, "utf8");
      } catch {
        return null;
      }
    },
  };
}

export function previewEnabled(): boolean {
  return vscode.workspace.getConfiguration("visimark").get<boolean>("preview.enable", true);
}

// `md` is VS Code's markdown-it instance. VS Code types it `any`; nothing
// here needs more than `use`, and the instance itself is what goes back.
export function extendMarkdownIt<T>(md: T): T {
  if (!previewEnabled()) return md;
  (md as { use(plugin: unknown, options: unknown): unknown }).use(
    markdownItVisimark,
    previewOptions(),
  );
  return md;
}
