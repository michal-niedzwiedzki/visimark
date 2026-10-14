import { registerCommands } from "./commands.js";
import { registerSettings } from "./settings.js";

/**
 * The Joplin plugin (#378, #384): two content scripts, their settings, the
 * palette commands, and the findings panel. The editor commands run the
 * engine in the CodeMirror content script; the panel and the sweep run it
 * here, reading notes through `joplin.data`. Every note is checked on its own,
 * with no reader, so no note's text supplies another's value
 * (visimark-design.md §2, constraint 4).
 */
void joplin.plugins.register({
  onStart: async () => {
    await registerSettings();
    await joplin.contentScripts.register(
      "codeMirrorPlugin",
      "visimark-codemirror",
      "./codemirrorContentScript.js",
    );
    await joplin.contentScripts.register(
      "markdownItPlugin",
      "visimark-markdown-it",
      "./markdownItContentScript.js",
    );
    await registerCommands();
  },
});
