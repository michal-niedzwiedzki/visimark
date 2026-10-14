import markdownItVisimark from "markdown-it-visimark";
import { build, check, locate } from "visimark";
import { explainBinding } from "visimark-editor-shared/explain.js";
import { rowFrom, summaryFor } from "visimark-editor-shared/hover.js";
import { importScope } from "./imports.js";

interface PluginOptions {
  /** the plugin's own setting, as Joplin hands it to a renderer script */
  settingValue?(key: string): unknown;
}

interface Token {
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
  children: Token[] | null;
}

interface MarkdownIt {
  core: {
    ruler: { push(name: string, rule: (state: { src: string; env: object }) => void): void };
  };
  renderer: { render(tokens: Token[], options: unknown, env: object): string };
}

/**
 * Marks in Joplin's viewer, and a tooltip on each (#384 spec §2.4). No
 * `path` and no reader. Joplin builds a new markdown-it for every render, so
 * `showMarks` is read once per render: off, the note renders untouched.
 */
export default (_context: unknown) => ({
  plugin: (instance: unknown, options: PluginOptions = {}) => {
    if (!showMarks(options)) return;
    const md = instance as MarkdownIt;
    withTitles(md);
    markdownItVisimark(md);
  },
  assets: () => [{ name: "visimark.css" }],
});

/**
 * The setting, or `true`. A `MarkupToHtml` caller that supplies no settings
 * gets Joplin's default `settingValue`, which throws; that must not take the
 * whole render down with it.
 */
function showMarks(options: PluginOptions): boolean {
  try {
    return options.settingValue?.("showMarks") !== false;
  } catch {
    return true;
  }
}

/**
 * A `title` on every element that carries `data-vmark`: the binding line,
 * what it comes to, and what it reads — the hover text the Obsidian plugin
 * shows. `markdown-it-visimark` places the marks while rendering, so this
 * wraps the renderer *under* it: installed first, it sees the tokens after
 * the marks are on them. One more analysis of the note per render.
 */
function withTitles(md: MarkdownIt): void {
  const sources = new WeakMap<object, string>();
  md.core.ruler.push("visimark_titles", (state) => {
    sources.set(state.env, state.src);
  });
  const render = md.renderer.render;
  md.renderer.render = function (this: unknown, tokens, options, env) {
    const source = sources.get(env);
    if (source !== undefined) {
      try {
        title(tokens, source);
      } catch {
        // a tooltip that cannot be worked out is left off, never the note
      }
    }
    return render.call(this, tokens, options, env);
  };
}

function title(tokens: Token[], source: string): void {
  const marked: Token[] = [];
  const walk = (list: Token[]): void => {
    for (const t of list) {
      if (t.attrGet("data-vmark") !== null) marked.push(t);
      if (t.children) walk(t.children);
    }
  };
  walk(tokens);
  if (marked.length === 0) return;
  const model = build(locate(source));
  const result = check(model);
  const imports = importScope(model, result.findings);
  for (const t of marked) {
    const name = t.attrGet("data-vmark")!;
    if (imports.name(name)) continue;
    const explanation = explainBinding(model, result, name);
    if (explanation === null) continue;
    t.attrSet("title", summaryFor(explanation, rowFrom(t.attrGet("data-vmark-row"))));
  }
}
