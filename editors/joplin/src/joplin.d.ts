/**
 * The part of Joplin's plugin API this plugin calls, typed by hand (spec §2.1).
 * The strings are the values of Joplin's `ContentScriptType` enum, which lives
 * in Joplin's source rather than in a package.
 */
declare const joplin: {
  plugins: { register(script: { onStart(): Promise<void> }): Promise<void> };
  contentScripts: {
    register(
      type: "codeMirrorPlugin" | "markdownItPlugin",
      id: string,
      scriptPath: string,
    ): Promise<void>;
  };
};
