import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A stand-in for the `vscode` module, enough of one to load the built
 * extension bundle and call the commands it registers.
 *
 * The bundle is CommonJS and resolves `vscode` at require time, so the only
 * way in is to seed Node's require cache under that name before loading it —
 * which is also how the real extension host works.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export interface FakeDocument {
  uri: FakeUri;
  languageId: string;
  getText(): string;
}

export interface FakeUri {
  scheme: string;
  path: string;
  fsPath: string;
  toString(): string;
}

export interface Host {
  /** command id → handler, as the extension registered them */
  commands: Map<string, (...args: unknown[]) => unknown>;
  /** ids passed to `vscode.commands.executeCommand`, in order */
  executed: string[];
  /** messages the extension put in front of the user */
  messages: string[];
  /** documents the extension opened in an editor, newest last */
  shown: FakeDocument[];
  /** the `vscode` module the bundle sees */
  vscode: Record<string, unknown>;
  /** point `window.activeTextEditor` at a file on disk */
  openFile(path: string): FakeDocument;
  /** the text a virtual-document provider now serves for `uri` */
  virtual(uri: string): string;
  /** settings the extension reads, by full key ("visimark.format.fixOnSave") */
  config: Map<string, unknown>;
  /**
   * Fire `onWillSaveTextDocument`, and resolve to one entry per `waitUntil`
   * the handlers called — so a save nobody acted on resolves to `[]`.
   */
  save(doc: FakeDocument, reason?: number): Promise<unknown[][]>;
}

export function fakeUri(value: string): FakeUri {
  const colon = value.indexOf(":");
  const scheme = value.slice(0, colon);
  const rest = value.slice(colon + 1);
  const path = decodeURIComponent(
    rest.startsWith("//") ? rest.replace(/^\/\/[^/]*/, "") : rest,
  );
  return { scheme, path, fsPath: path, toString: () => value };
}

export function createHost(): Host {
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const executed: string[] = [];
  const messages: string[] = [];
  const shown: FakeDocument[] = [];
  const config = new Map<string, unknown>();
  const willSave: ((e: unknown) => void)[] = [];
  const providers = new Map<
    string,
    { provideTextDocumentContent(uri: FakeUri): string }
  >();
  const disposable = { dispose(): void {} };

  const record = (m: string): Promise<undefined> => {
    messages.push(m);
    return Promise.resolve(undefined);
  };

  const vscode: Record<string, unknown> = {
    version: "1.85.0",
    env: { language: "en" },
    Uri: {
      parse: fakeUri,
      file: (p: string) => fakeUri(`file://${p}`),
    },
    ViewColumn: { Beside: 2 },
    Position: class {
      constructor(
        readonly line: number,
        readonly character: number,
      ) {}
    },
    Range: class {
      constructor(...readonly args: unknown[]) {}
    },
    WorkspaceEdit: class {
      readonly replacements: unknown[] = [];
      replace(uri: unknown, range: unknown, newText: unknown): void {
        this.replacements.push({ uri, range, newText });
      }
    },
    EventEmitter: class {
      private readonly handlers: ((v: unknown) => void)[] = [];
      get event() {
        return (f: (v: unknown) => void) => {
          this.handlers.push(f);
          return disposable;
        };
      }
      fire(v: unknown): void {
        for (const f of this.handlers) f(v);
      }
      dispose(): void {}
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    TextDocumentSaveReason: { Manual: 1, AfterDelay: 2, FocusOut: 3 },
    commands: {
      registerCommand: (id: string, fn: (...a: unknown[]) => unknown) => {
        commands.set(id, fn);
        return disposable;
      },
      executeCommand: async (id: string) => {
        executed.push(id);
        return undefined;
      },
    },
    window: {
      activeTextEditor: undefined as { document: FakeDocument } | undefined,
      createStatusBarItem: () => ({
        text: "",
        tooltip: "",
        command: "",
        show(): void {},
        hide(): void {},
        dispose(): void {},
      }),
      createOutputChannel: () => ({
        name: "VisiMark",
        append(): void {},
        appendLine(): void {},
        clear(): void {},
        replace(): void {},
        show(): void {},
        dispose(): void {},
      }),
      showTextDocument: async (doc: FakeDocument) => {
        shown.push(doc);
        return { document: doc };
      },
      showInformationMessage: record,
      showWarningMessage: record,
      showErrorMessage: record,
    },
    workspace: {
      getConfiguration: (section?: string) => ({
        get: (key: string, d: unknown) => {
          const full = section ? `${section}.${key}` : key;
          return config.has(full) ? config.get(full) : d;
        },
      }),
      onWillSaveTextDocument: (fn: (e: unknown) => void) => {
        willSave.push(fn);
        return disposable;
      },
      registerTextDocumentContentProvider: (
        scheme: string,
        p: { provideTextDocumentContent(uri: FakeUri): string },
      ) => {
        providers.set(scheme, p);
        return disposable;
      },
      applyEdit: async () => true,
      openTextDocument: async (uri: FakeUri) => {
        if (uri.scheme === "file") return fileDocument(uri.fsPath);
        const p = providers.get(uri.scheme);
        if (!p) throw new Error(`no provider for scheme ${uri.scheme}`);
        const text = p.provideTextDocumentContent(uri);
        return { uri, languageId: "plaintext", getText: () => text };
      },
    },
    languages: {},
  };

  // `vscode-languageclient` subclasses a dozen `vscode` classes at module-eval
  // time and registers listeners the moment it starts. None of that is under
  // test here, so anything the bundle reaches for that this host does not model
  // becomes a bare class or a no-op registration rather than a crash.
  const fill = <T extends object>(obj: T): T =>
    new Proxy(obj, {
      get(target, key) {
        if (key in target) return target[key as keyof T];
        return () => disposable;
      },
    });
  vscode.workspace = fill(vscode.workspace as object);
  vscode.window = fill(vscode.window as object);
  vscode.languages = fill(vscode.languages as object);

  const stub = new Proxy(vscode, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (typeof key !== "string") return undefined;
      const cls = class {};
      Object.defineProperty(cls, "name", { value: key });
      target[key] = cls;
      return cls;
    },
  });

  function fileDocument(path: string): FakeDocument {
    const text = readFileSync(path, "utf8");
    return {
      uri: fakeUri(`file://${path}`),
      languageId: path.endsWith(".md") ? "markdown" : "plaintext",
      getText: () => text,
    };
  }

  const require_ = createRequire(import.meta.url);
  require_.cache["vscode"] = {
    id: "vscode",
    filename: "vscode",
    loaded: true,
    exports: stub,
  } as never;
  const Module = require_("node:module") as {
    _resolveFilename(request: string, ...rest: unknown[]): string;
  };
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: unknown[]) {
    return request === "vscode" ? "vscode" : resolve.call(this, request, ...rest);
  };

  return {
    commands,
    executed,
    messages,
    shown,
    vscode,
    openFile(path: string): FakeDocument {
      const doc = fileDocument(path);
      (vscode.window as { activeTextEditor: unknown }).activeTextEditor = {
        document: doc,
      };
      return doc;
    },
    virtual(uri: string): string {
      const u = fakeUri(uri);
      return providers.get(u.scheme)?.provideTextDocumentContent(u) ?? "";
    },
    config,
    async save(doc: FakeDocument, reason = 1): Promise<unknown[][]> {
      const offered: Promise<unknown>[] = [];
      const event = {
        document: doc,
        reason,
        waitUntil: (p: unknown) => {
          offered.push(Promise.resolve(p));
        },
      };
      for (const fn of willSave) fn(event);
      return (await Promise.all(offered)) as unknown[][];
    },
  };
}

/**
 * Load the built bundle and activate it. The language client cannot reach a
 * real server from here, so activation is expected to fail *after* the
 * commands are registered; the failure is returned rather than thrown.
 */
export async function activateExtension(
  host: Host,
): Promise<{ activationError: unknown }> {
  const require_ = createRequire(import.meta.url);
  const bundle = join(root, "dist", "extension.js");
  const ext = require_(bundle) as {
    activate(ctx: unknown): Promise<void>;
  };
  const context = {
    subscriptions: [] as unknown[],
    asAbsolutePath: (p: string) => join(root, p),
  };
  try {
    await ext.activate(context);
    return { activationError: undefined };
  } catch (e) {
    return { activationError: e };
  }
}
