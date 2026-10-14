/**
 * The part of Joplin's plugin API this plugin calls, typed by hand (spec §2.1).
 * The strings are the values of Joplin's `ContentScriptType` and
 * `MenuItemLocation` enums, which live in Joplin's source rather than in a
 * package (`packages/lib/services/plugins/api/types.ts`, v3.7.1).
 */
declare const joplin: {
  plugins: { register(script: { onStart(): Promise<void> }): Promise<void> };
  contentScripts: {
    register(
      type: "codeMirrorPlugin" | "markdownItPlugin",
      id: string,
      scriptPath: string,
    ): Promise<void>;
    onMessage(id: string, callback: (message: unknown) => Promise<unknown>): Promise<void>;
  };
  commands: {
    register(command: {
      name: string;
      label?: string;
      execute(...args: unknown[]): Promise<unknown>;
    }): Promise<void>;
    execute(name: string, ...args: unknown[]): Promise<unknown>;
  };
  settings: {
    globalValue(key: string): Promise<unknown>;
    /** one of this plugin's own settings */
    value(key: string): Promise<unknown>;
    registerSection(name: string, section: { label: string }): Promise<void>;
    registerSettings(
      settings: Record<
        string,
        { value: unknown; type: number; section: string; public: boolean; label: string }
      >,
    ): Promise<void>;
    onChange(handler: (event: { keys: string[] }) => void): Promise<void>;
  };
  workspace: {
    selectedNote(): Promise<{ id: string; title: string; body: string } | null>;
    selectedFolder(): Promise<{ id: string } | null>;
    onNoteSelectionChange(handler: () => void): Promise<unknown>;
    onNoteChange(handler: () => void): Promise<unknown>;
  };
  data: { get(path: string[], query?: object): Promise<unknown> };
  views: {
    menus: {
      create(
        id: string,
        label: string,
        menuItems: { commandName: string }[],
        location?: "tools",
      ): Promise<void>;
    };
    menuItems: {
      create(
        id: string,
        commandName: string,
        location?: "editorContextMenu" | "folderContextMenu",
      ): Promise<void>;
    };
    panels: {
      create(id: string): Promise<string>;
      addScript(handle: string, path: string): Promise<void>;
      setHtml(handle: string, html: string): Promise<unknown>;
      onMessage(handle: string, callback: (message: unknown) => unknown): Promise<void>;
      show(handle: string, show?: boolean): Promise<void>;
      visible(handle: string): Promise<boolean>;
    };
    dialogs: {
      create(id: string): Promise<string>;
      setHtml(handle: string, html: string): Promise<void>;
      setButtons(handle: string, buttons: { id: string; title?: string }[]): Promise<void>;
      open(handle: string): Promise<{ id: string }>;
      showMessageBox(message: string): Promise<number>;
    };
  };
};
