import { MarkdownView, TFile } from "./obsidian.js";

/**
 * A fake `App` — the `Workspace` and `Vault` surface `main.ts` actually
 * calls, backed by plain in-memory state a test can drive directly. Cast
 * with `as unknown as App` at the one place a test constructs the plugin:
 * this object satisfies what the plugin *calls*, not the real `obsidian.d.ts`
 * interface's every member, the same trade-off the rest of this harness
 * makes everywhere else.
 */

type Handler = (...args: unknown[]) => void;

class EventBus {
  private readonly handlers = new Map<string, Set<Handler>>();

  on(name: string, handler: Handler): { name: string; handler: Handler } {
    let set = this.handlers.get(name);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler);
    return { name, handler };
  }

  off(ref: { name: string; handler: Handler }): void {
    this.handlers.get(ref.name)?.delete(ref.handler);
  }

  /** test-only: fire every handler registered for `name` */
  emit(name: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(name) ?? []) handler(...args);
  }
}

export class HarnessLeaf {
  view: MarkdownView | { getViewType(): string } | null = null;

  async setViewState(state: { type: string; active?: boolean }): Promise<void> {
    // real behaviour constructs the view through the plugin's registered
    // factory; the harness's own test drives `leaf.view` directly instead,
    // since `Workspace` here has no registry of view factories to call
    void state;
  }
}

export class HarnessWorkspace extends EventBus {
  readonly leaves: HarnessLeaf[] = [];
  private active: MarkdownView | null = null;
  private readonly onLayoutReadyCallbacks: (() => void)[] = [];
  private layoutIsReady = false;

  setActiveView(view: MarkdownView | null): void {
    this.active = view;
  }

  getActiveViewOfType<T>(type: new (...args: never[]) => T): T | null {
    if (this.active === null) return null;
    return this.active instanceof (type as unknown as new () => MarkdownView)
      ? (this.active as T)
      : null;
  }

  iterateAllLeaves(cb: (leaf: HarnessLeaf) => void): void {
    for (const leaf of this.leaves) cb(leaf);
  }

  getLeavesOfType(_type: string): HarnessLeaf[] {
    // the harness has no per-type registry — a test that needs one adds a
    // leaf directly and filters `this.leaves` itself before asserting
    return [];
  }

  getRightLeaf(_split: boolean): HarnessLeaf | null {
    const leaf = new HarnessLeaf();
    this.leaves.push(leaf);
    return leaf;
  }

  revealLeaf(_leaf: HarnessLeaf): void {}

  onLayoutReady(cb: () => void): void {
    if (this.layoutIsReady) {
      cb();
      return;
    }
    this.onLayoutReadyCallbacks.push(cb);
  }

  /** test-only: fire every `onLayoutReady` callback, as Obsidian does once at startup */
  fireLayoutReady(): void {
    this.layoutIsReady = true;
    for (const cb of this.onLayoutReadyCallbacks.splice(0)) cb();
  }
}

export class HarnessVault extends EventBus {
  private readonly files = new Map<string, string>();

  /** test-only: seed a note or CSV into the vault */
  setFile(path: string, content: string): TFile {
    this.files.set(path, content);
    return new TFile(path);
  }

  getMarkdownFiles(): TFile[] {
    return [...this.files.keys()].filter((p) => p.endsWith(".md")).map((p) => new TFile(p));
  }

  getAbstractFileByPath(path: string): TFile | null {
    return this.files.has(path) ? new TFile(path) : null;
  }

  async cachedRead(file: TFile): Promise<string> {
    const text = this.files.get(file.path);
    if (text === undefined) throw new Error(`not modelled: no file at ${file.path}`);
    return text;
  }

  readonly adapter = {
    read: async (path: string): Promise<string> => {
      const text = this.files.get(path);
      if (text === undefined) throw new Error(`ENOENT: no file at ${path}`);
      return text;
    },
  };
}

export interface HarnessApp {
  workspace: HarnessWorkspace;
  vault: HarnessVault;
}

export function harnessApp(): HarnessApp {
  return { workspace: new HarnessWorkspace(), vault: new HarnessVault() };
}

export const harnessManifest = {
  id: "visimark",
  name: "VisiMark",
  version: "0.0.0-test",
  minAppVersion: "1.8.7",
  description: "test manifest",
  author: "test",
};
