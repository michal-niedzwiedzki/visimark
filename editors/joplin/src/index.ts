import { registerCommands } from "./commands.js";

/**
 * The Joplin plugin (#378, #384): two content scripts, and the palette
 * commands that route to the editor one. The engine runs in the content
 * script, over the one note that is open — no `joplin.data`, no reader — so
 * nothing outside the note changes what it computes (visimark-design.md §2,
 * constraint 4).
 */
void joplin.plugins.register({
  onStart: async () => {
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
