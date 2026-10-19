import { EDITOR_COMMANDS } from "./protocol.js";

/**
 * The plugin's two settings (#384 spec §2.4), in their own section.
 * `showMarks` reaches the viewer through `settingValue` and the editor
 * through a message on load and `visimark.cm.setMarks` on change.
 * `fixDatesOnFormat` is read by Format each time it runs.
 */

/** Joplin's `SettingItemType.Bool` */
const BOOL = 3;

export async function registerSettings(): Promise<void> {
  await joplin.settings.registerSection("visimark", { label: "VisiMark" });
  await joplin.settings.registerSettings({
    showMarks: {
      value: true,
      type: BOOL,
      section: "visimark",
      public: true,
      label: "Show marks on computed values",
    },
    fixDatesOnFormat: {
      value: false,
      type: BOOL,
      section: "visimark",
      public: true,
      label: "When formatting, rewrite dates to ISO 8601 where the date is unambiguous",
    },
  });

  // the editor asks once, when it loads
  await joplin.contentScripts.onMessage("visimark-codemirror", async (message: unknown) => {
    if ((message as { kind?: unknown } | null)?.kind !== "settings") return undefined;
    return { showMarks: (await joplin.settings.value("showMarks")) !== false };
  });

  // and is told when it changes; an editor that is not open just misses it,
  // and asks again when it next loads
  await joplin.settings.onChange(async ({ keys }) => {
    if (!keys.includes("showMarks")) return;
    const show = (await joplin.settings.value("showMarks")) !== false;
    try {
      await joplin.commands.execute("editor.execCommand", {
        name: EDITOR_COMMANDS.setMarks,
        args: [{ show }],
      });
    } catch {
      // the Rich Text editor, or none at all: nothing to tell
    }
  });
}
