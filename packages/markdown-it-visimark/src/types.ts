/**
 * The public option types, and the structural slice of markdown-it this
 * package touches. There is no `markdown-it` dependency or peer (spec §2.1):
 * the plugin only uses the instance it is handed, so these describe that
 * instance rather than importing its declarations.
 */

/**
 * Read one absolute path the engine's gate has already accepted. Return the
 * file's UTF-8 text, or null when the read does not happen. Synchronous —
 * `codemirror-visimark`'s `ReadImport` is the asynchronous one.
 */
export type ReadImportSync = (path: string) => string | null;

export interface MarkdownItVisimarkOptions {
  /** Filesystem path of the document being rendered, from the render `env`, or null. */
  path?: (env: unknown) => string | null;
  readImport?: ReadImportSync;
}

export type Attr = [string, string];

export interface Token {
  type: string;
  tag: string;
  nesting: number;
  attrs: Attr[] | null;
  map: [number, number] | null;
  content: string;
  info: string;
  children: Token[] | null;
  block: boolean;
  attrSet(name: string, value: string): void;
}

export type TokenCtor = new (type: string, tag: string, nesting: number) => Token;

export interface RenderOptions {
  html?: boolean;
}

export interface RendererLike {
  render(tokens: Token[], options: RenderOptions, env: unknown): string;
  renderToken(tokens: Token[], idx: number, options: RenderOptions): string;
  rules: Record<string, RenderRule | undefined>;
}

export type RenderRule = (
  tokens: Token[],
  idx: number,
  options: RenderOptions,
  env: unknown,
  self: RendererLike,
) => string;

export interface CoreStateLike {
  src: string;
  tokens: Token[];
  Token: TokenCtor;
}

export interface MarkdownItLike {
  core: { ruler: { push(name: string, rule: (state: CoreStateLike) => void): void } };
  renderer: RendererLike;
  utils: { escapeHtml(s: string): string };
}
