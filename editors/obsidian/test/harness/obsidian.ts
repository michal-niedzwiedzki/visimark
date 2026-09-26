/**
 * A minimal, honest stub of the subset of `obsidian` this plugin imports at
 * runtime — review row 12. It is not meant to be a full Obsidian: every
 * method's doc comment cites the `obsidian.d.ts` declaration it mirrors, and
 * where the real behaviour is unknown or not modelled, it throws
 * `"not modelled"` rather than guessing at one.
 *
 * Loaded only through `mock.module("obsidian", ...)` in `preload.ts`, for
 * `editors/obsidian`'s own `bun test` run — never through `bundle.test.ts`'s
 * real esbuild, and never by anything outside a test.
 */

// ---------------------------------------------------------------------------
// Notice — @public class Notice { constructor(message: string | DocumentFragment, timeout?: number) }
// ---------------------------------------------------------------------------

/** Every notice shown, in order — tests read this instead of a real toast. */
export const notices: string[] = [];

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

// ---------------------------------------------------------------------------
// Platform — @public const Platform: { isMacOS: boolean; isMobile: boolean; ... }
// ---------------------------------------------------------------------------

export const Platform = {
  isMacOS: false,
  isMobile: false,
};

// ---------------------------------------------------------------------------
// TFile — @public class TFile extends TAbstractFile { basename: string; extension: string }
// ---------------------------------------------------------------------------

export class TFile {
  readonly path: string;
  readonly basename: string;
  readonly extension: string;

  constructor(path: string) {
    this.path = path;
    const slash = path.lastIndexOf("/");
    const name = slash === -1 ? path : path.slice(slash + 1);
    const dot = name.lastIndexOf(".");
    this.basename = dot <= 0 ? name : name.slice(0, dot);
    this.extension = dot <= 0 ? "" : name.slice(dot + 1);
  }
}

// ---------------------------------------------------------------------------
// normalizePath — @public function normalizePath(path: string): string
// ---------------------------------------------------------------------------

/** Obsidian's own normalises separators and `.`/`..` segments; this only
 *  does the part every path this plugin ever builds actually needs. */
export function normalizePath(path: string): string {
  return path
    .split("/")
    .filter((seg) => seg !== "." && seg !== "")
    .join("/");
}

// ---------------------------------------------------------------------------
// debounce — @public function debounce<T, V>(cb, timeout?, resetTimer?): Debouncer<T, V>
// ---------------------------------------------------------------------------

export interface Debouncer<T extends unknown[]> {
  (...args: T): void;
  cancel(): void;
  run(): void;
}

export function debounce<T extends unknown[]>(
  cb: (...args: T) => void,
  timeout = 0,
  resetTimer = false,
): Debouncer<T> {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  const fire = (): void => {
    handle = null;
    if (pending !== null) cb(...pending);
    pending = null;
  };

  const wrapped = ((...args: T): void => {
    pending = args;
    if (handle !== null) {
      if (!resetTimer) return;
      clearTimeout(handle);
    }
    handle = setTimeout(fire, timeout);
  }) as Debouncer<T>;

  wrapped.cancel = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
    pending = null;
  };
  wrapped.run = () => {
    if (handle !== null) clearTimeout(handle);
    fire();
  };
  return wrapped;
}

// ---------------------------------------------------------------------------
// setIcon / setTooltip / displayTooltip — @public functions over an HTMLElement
// ---------------------------------------------------------------------------

/** @public function setIcon(parent: HTMLElement, iconId: string): void */
export function setIcon(el: HTMLElement, iconId: string): void {
  el.setAttribute("data-icon", iconId);
}

/** @public function setTooltip(el: HTMLElement, tooltip: string, options?: TooltipOptions): void */
export function setTooltip(el: HTMLElement, tooltip: string, _options?: unknown): void {
  el.setAttribute("data-tooltip", tooltip);
}

/** @public function displayTooltip(el: HTMLElement, tooltip: string, options?: TooltipOptions): void
 *  — fires the tooltip immediately, the way a real hover would once primed. */
export function displayTooltip(el: HTMLElement, tooltip: string, _options?: unknown): void {
  el.setAttribute("data-tooltip-shown", tooltip);
}

// ---------------------------------------------------------------------------
// editorInfoField — @public const editorInfoField: StateField<MarkdownFileInfo | null>
// ---------------------------------------------------------------------------

/**
 * `live-preview.ts` reads this through `view.state.field(field, false)` and
 * an `as unknown as` cast documented there — the harness never needs to
 * resolve a real CodeMirror `StateField`, only to exist as *a* value the
 * cast can point at. `main.test.ts`'s onload test does not exercise Live
 * Preview's CodeMirror extension at all (no CodeMirror `EditorView` in this
 * harness), so nothing ever calls `.field()` on this in a test yet.
 */
export const editorInfoField = { __harnessStub: "editorInfoField" };

// ---------------------------------------------------------------------------
// PluginSettingTab / Setting — @public classes, settings-tab.ts's whole surface
// ---------------------------------------------------------------------------

export class PluginSettingTab {
  readonly app: unknown;
  readonly containerEl: HTMLElement;

  constructor(app: unknown, _plugin: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }
}

interface ToggleComponent {
  setValue(value: boolean): ToggleComponent;
  onChange(cb: (value: boolean) => void | Promise<void>): ToggleComponent;
}

function toggleComponent(): ToggleComponent {
  const self: ToggleComponent = {
    setValue: () => self,
    onChange: (cb) => {
      self.onChange = () => self; // `settings-tab.ts` never calls onChange itself
      void cb; // recorded only if a future test needs to drive it
      return self;
    },
  };
  return self;
}

/** @public class Setting — only `.setName`/`.setDesc`/`.addToggle` are used here. */
export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addToggle(cb: (toggle: ToggleComponent) => void): this {
    cb(toggleComponent());
    return this;
  }
}

// ---------------------------------------------------------------------------
// ItemView / Modal — the base classes findings-view.ts / sweep-view.ts /
// *-modal.ts build on. Neither is exercised by the onload test yet; these
// exist so constructing one (which `registerView`'s factory does lazily,
// never during `onload` itself) would not throw if a later test opens one.
// ---------------------------------------------------------------------------

export class ItemView {
  readonly containerEl: HTMLElement;
  readonly contentEl: HTMLElement;

  constructor(readonly leaf: unknown) {
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
    this.containerEl.appendChild(this.contentEl);
  }

  getViewType(): string {
    throw new Error("not modelled: ItemView.getViewType must be overridden");
  }
  getDisplayText(): string {
    return "";
  }
  onOpen(): Promise<void> {
    return Promise.resolve();
  }
  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

export class Modal {
  readonly contentEl: HTMLElement;

  constructor(readonly app: unknown) {
    this.contentEl = document.createElement("div");
  }

  open(): void {
    this.onOpen();
  }
  close(): void {
    this.onClose();
  }
  onOpen(): void {}
  onClose(): void {}
}

// ---------------------------------------------------------------------------
// MarkdownView — @public class MarkdownView extends TextFileView
// ---------------------------------------------------------------------------

/** The harness's own shape for the one editor surface the plugin reads. */
export interface HarnessEditor {
  getValue(): string;
  setValue(value: string): void;
  getSelection(): string;
  getCursor(which?: "from" | "to" | "head" | "anchor"): { line: number; ch: number };
  posToOffset(pos: { line: number; ch: number }): number;
  offsetToPos(offset: number): { line: number; ch: number };
  replaceSelection(text: string): void;
  replaceRange(
    text: string,
    from: { line: number; ch: number },
    to?: { line: number; ch: number },
  ): void;
  transaction(spec: unknown): void;
}

export class MarkdownView {
  file: TFile | null = null;
  readonly editor: HarnessEditor;
  readonly containerEl: HTMLElement;
  readonly contentEl: HTMLElement;
  private mode: "source" | "preview" = "source";
  readonly previewMode = {
    rerender: (_full?: boolean) => {
      this.previewRerenderCount++;
    },
  };
  previewRerenderCount = 0;

  constructor(
    private source: string,
    file: TFile | null = null,
  ) {
    this.file = file;
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
    this.containerEl.appendChild(this.contentEl);
    this.editor = harnessEditorOver(
      () => this.source,
      (v) => (this.source = v),
    );
  }

  getViewData(): string {
    return this.source;
  }
  setViewData(data: string, _clear: boolean): void {
    this.source = data;
  }
  getMode(): "source" | "preview" {
    return this.mode;
  }
  /** test-only: not part of the real API, which switches mode through the UI */
  setModeForTest(mode: "source" | "preview"): void {
    this.mode = mode;
  }

  private readonly actions: { icon: string; title: string; el: HTMLElement; cb: () => void }[] = [];

  addAction(icon: string, title: string, cb: () => void): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-action-icon", icon);
    el.setAttribute("data-action-title", title);
    this.actions.push({ icon, title, el, cb });
    return el;
  }
}

function harnessEditorOver(get: () => string, set: (v: string) => void): HarnessEditor {
  const lineOffsets = (source: string): number[] => {
    const offsets = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") offsets.push(i + 1);
    return offsets;
  };
  return {
    getValue: () => get(),
    setValue: (value) => set(value),
    getSelection: () => "",
    getCursor: () => ({ line: 0, ch: 0 }),
    posToOffset: (pos) => {
      const offsets = lineOffsets(get());
      return (offsets[pos.line] ?? get().length) + pos.ch;
    },
    offsetToPos: (offset) => {
      const offsets = lineOffsets(get());
      let line = 0;
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i]! <= offset) line = i;
      }
      return { line, ch: offset - offsets[line]! };
    },
    replaceSelection: (text) => set(get() + text),
    replaceRange: (text, from, to) => {
      const editor = harnessEditorOver(get, set);
      const start = editor.posToOffset(from);
      const end = to !== undefined ? editor.posToOffset(to) : start;
      set(get().slice(0, start) + text + get().slice(end));
    },
    transaction: (spec: unknown) => {
      const changes = (spec as { changes?: { from: unknown; to?: unknown; text: string }[] })
        .changes;
      if (changes === undefined) return;
      const editor = harnessEditorOver(get, set);
      // apply in reverse document order so earlier offsets stay valid
      const withOffsets = changes.map((c) => ({
        ...c,
        start: editor.posToOffset(c.from as { line: number; ch: number }),
        end:
          c.to !== undefined
            ? editor.posToOffset(c.to as { line: number; ch: number })
            : editor.posToOffset(c.from as { line: number; ch: number }),
      }));
      withOffsets.sort((a, b) => b.start - a.start);
      let text = get();
      for (const c of withOffsets) text = text.slice(0, c.start) + c.text + text.slice(c.end);
      set(text);
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin — @public abstract class Plugin extends Component
// ---------------------------------------------------------------------------

export interface HarnessCommand {
  id: string;
  name: string;
  callback?: () => void;
  editorCallback?: (editor: HarnessEditor, view: MarkdownView) => void;
}

/**
 * The base class every real Obsidian plugin extends. This stub's job is
 * narrower than the real one's: record what the plugin registers, and throw
 * the one thing the real API actually throws — `registerView` on a type
 * already registered (row 12's motivating bug, #214: a pasted second
 * registration disabled the whole plugin, and nothing caught it because
 * there was no harness that could call `onload` at all).
 */
export class Plugin {
  readonly app: unknown;
  readonly manifest: unknown;
  settings: unknown;

  readonly registeredViews = new Map<string, (leaf: unknown) => unknown>();
  readonly commands: HarnessCommand[] = [];
  readonly postProcessors: ((el: HTMLElement, ctx: unknown) => unknown)[] = [];
  readonly editorExtensions: unknown[] = [];
  readonly settingTabs: unknown[] = [];
  readonly statusBarItems: HTMLElement[] = [];
  readonly ribbonIcons: HTMLElement[] = [];
  private readonly domListeners: {
    target: EventTarget;
    type: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  }[] = [];
  private data: unknown = null;

  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  registerView(type: string, factory: (leaf: unknown) => unknown): void {
    if (this.registeredViews.has(type)) {
      throw new Error(`Attempting to register an existing view type: ${type}`);
    }
    this.registeredViews.set(type, factory);
  }

  addCommand(command: HarnessCommand): void {
    this.commands.push(command);
  }

  addSettingTab(tab: unknown): void {
    this.settingTabs.push(tab);
  }

  registerMarkdownPostProcessor(fn: (el: HTMLElement, ctx: unknown) => unknown): void {
    this.postProcessors.push(fn);
  }

  registerEditorExtension(ext: unknown): void {
    this.editorExtensions.push(ext);
  }

  registerDomEvent(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.domListeners.push({ target, type, handler, options });
  }

  registerEvent(_ref: unknown): void {
    // event refs are already attached by whatever created them (the harness's
    // own Workspace/Vault `.on()` below); this only has to exist to be called
  }

  addStatusBarItem(): HTMLElement {
    const el = document.createElement("div");
    this.statusBarItems.push(el);
    return el;
  }

  addRibbonIcon(icon: string, title: string, _cb: () => void): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-icon", icon);
    el.setAttribute("data-title", title);
    this.ribbonIcons.push(el);
    return el;
  }

  async loadData(): Promise<unknown> {
    return this.data;
  }
  async saveData(data: unknown): Promise<void> {
    this.data = data;
  }

  /** test-only teardown: detach every DOM listener this instance registered */
  disposeForTest(): void {
    for (const { target, type, handler, options } of this.domListeners) {
      target.removeEventListener(type, handler, options);
    }
  }
}
