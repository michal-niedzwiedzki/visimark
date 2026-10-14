/**
 * A stand-in for the `joplin` global: records what the plugin registers and
 * shows, and answers `editor.execCommand` from a table the test sets.
 */
export interface FakeJoplin {
  readonly commands: { name: string; label?: string; execute(...a: unknown[]): Promise<unknown> }[];
  readonly menus: { id: string; label: string; items: string[]; location?: string }[];
  readonly menuItems: { id: string; commandName: string; location?: string }[];
  readonly contentScripts: unknown[][];
  /** every message box, in order */
  readonly messages: string[];
  /** every dialog's HTML at the moment it opened */
  readonly dialogs: string[];
  /** the editor commands the main script asked for */
  readonly editorCalls: { name: string; args: unknown[] }[];
  /** what the plugin passed to `joplin.plugins.register` */
  onStart?: () => Promise<void>;
  settings: Record<string, unknown>;
  note: { id: string; title: string } | null;
  /** what `editor.execCommand` answers, by editor command name */
  editor: Record<string, unknown>;
  run(name: string, ...args: unknown[]): Promise<unknown>;
}

export function installFakeJoplin(): FakeJoplin {
  const fake: FakeJoplin = {
    commands: [],
    menus: [],
    menuItems: [],
    contentScripts: [],
    messages: [],
    dialogs: [],
    editorCalls: [],
    settings: { "editor.codeView": true },
    note: { id: "n1", title: "example-invoice-drift.md" },
    editor: {},
    async run(name, ...args) {
      const command = fake.commands.find((c) => c.name === name);
      if (!command) throw new Error(`no command ${name}`);
      return command.execute(...args);
    },
  };
  const html = new Map<string, string>();
  (globalThis as Record<string, unknown>).joplin = {
    plugins: {
      register: async (s: { onStart(): Promise<void> }) => void (fake.onStart = s.onStart),
    },
    contentScripts: { register: async (...a: unknown[]) => void fake.contentScripts.push(a) },
    commands: {
      register: async (c: FakeJoplin["commands"][number]) => void fake.commands.push(c),
      execute: async (name: string, value: { name: string; args: unknown[] }) => {
        if (name !== "editor.execCommand") throw new Error(`unexpected ${name}`);
        fake.editorCalls.push(value);
        return fake.editor[value.name];
      },
    },
    settings: { globalValue: async (key: string) => fake.settings[key] },
    workspace: { selectedNote: async () => fake.note },
    views: {
      menus: {
        create: async (
          id: string,
          label: string,
          items: { commandName: string }[],
          location?: string,
        ) => void fake.menus.push({ id, label, items: items.map((i) => i.commandName), location }),
      },
      menuItems: {
        create: async (id: string, commandName: string, location?: string) =>
          void fake.menuItems.push({ id, commandName, location }),
      },
      dialogs: {
        create: async (id: string) => {
          if (html.has(id)) throw new Error(`dialog ${id} created twice`);
          html.set(id, "");
          return id;
        },
        setHtml: async (h: string, body: string) => void html.set(h, body),
        setButtons: async () => {},
        open: async (h: string) => {
          fake.dialogs.push(html.get(h) ?? "");
          return { id: "ok" };
        },
        showMessageBox: async (m: string) => {
          fake.messages.push(m);
          return 0;
        },
      },
    },
  };
  return fake;
}
