/**
 * The Joplin plugin (#378): two content scripts and no logic of its own. It
 * reads one note — no `joplin.data`, no reader, no settings — so nothing
 * outside the note changes what it computes (visimark-design.md §2, constraint 4).
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
  },
});

export {}; // a module, so the test can import it; Joplin runs it as a script either way
