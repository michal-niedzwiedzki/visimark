import { passCache } from "./pass.js";
import { place } from "./place.js";
import type { MarkdownItLike, MarkdownItVisimarkOptions, Token, TokenCtor } from "./types.js";

export type { MarkdownItVisimarkOptions, ReadImportSync } from "./types.js";

/**
 * The markdown-it plugin (spec §2). `md.use(markdownItVisimark, options?)`.
 *
 * The core rule only remembers which source produced which token array; the
 * marks are applied by the render wrapper, with the **render** `env`. A host
 * may parse and render separately and cache the tokens in between — VS Code
 * does both, and parses with an `env` that has no document — so an engine
 * pass at parse time would never see the path and would bake marks into the
 * host's cache (spec §2.6).
 */
const sources = new WeakMap<Token[], { source: string; Tok: TokenCtor }>();

// `md: unknown`, as the published declaration says: any markdown-it instance
// satisfies it, so no markdown-it type is part of this package's contract, and
// markdown-it's own (stricter) declarations cannot disagree with ours.
export default function markdownItVisimark(
  instance: unknown,
  options: MarkdownItVisimarkOptions = {},
): void {
  const md = instance as MarkdownItLike;
  const pathOf = options.path ?? ((): null => null);
  const passFor = passCache(options.readImport);

  md.core.ruler.push("visimark", (state) => {
    sources.set(state.tokens, { source: state.src, Tok: state.Token });
  });

  const render = md.renderer.render;
  md.renderer.render = function (this: unknown, tokens, opts, env) {
    const seen = sources.get(tokens);
    if (seen === undefined || opts.html !== true) return render.call(this, tokens, opts, env);
    let out = tokens;
    try {
      const path = pathOf(env);
      const pass = passFor(seen.source, path);
      if (pass.model.located.blocks.length > 0)
        out = place(tokens, seen.source, pass, path, seen.Tok);
    } catch {
      out = tokens;
    }
    return render.call(this, out, opts, env);
  };
}
