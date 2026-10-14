import markdownItVisimark from "markdown-it-visimark";

/** Marks in Joplin's viewer. No options: `path` is null and there is no reader. */
export default (_context: unknown) => ({
  plugin: (md: unknown) => markdownItVisimark(md),
  assets: () => [{ name: "visimark.css" }],
});
