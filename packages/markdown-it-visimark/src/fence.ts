import type { MarkdownItLike } from "./types.js";

/**
 * `data-vmark-info` (spec §2.5): the fence's info string after the word
 * `vmark`, so a rendered sheet keeps its id, `from` clause and column labels
 * (`#order from rows.csv labelled Item, Qty`) that HTML would otherwise drop.
 *
 * It is injected into the first opening tag of whatever the fence renderer
 * this one replaced produced, rather than set on `token.attrs`: markdown-it
 * drops `token.attrs` when a host's `highlight` returns its own `<pre>`.
 */

export function vmarkInfo(info: string): string | null {
  const m = /^vmark(?:\s+([\s\S]*))?$/.exec(info);
  return m === null ? null : (m[1] ?? "");
}

export function injectInfo(html: string, value: string, escapeHtml: (s: string) => string): string {
  const first = /<([A-Za-z][\w-]*)([^>]*)>/.exec(html);
  if (first === null || (first[1] !== "pre" && first[1] !== "code")) return html;
  if (/\sdata-vmark-info=/.test(first[2]!)) return html;
  const at = first.index + first[0].length - 1;
  return html.slice(0, at) + ` data-vmark-info="${escapeHtml(value)}"` + html.slice(at);
}

export function wrapFence(md: MarkdownItLike): void {
  const prev = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const html = prev ? prev(tokens, idx, opts, env, self) : self.renderToken(tokens, idx, opts);
    if (opts.html !== true) return html;
    const value = vmarkInfo(tokens[idx]!.info);
    return value === null ? html : injectInfo(html, value, md.utils.escapeHtml);
  };
}
