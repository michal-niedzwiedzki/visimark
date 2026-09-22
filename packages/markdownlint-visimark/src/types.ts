/**
 * The half of `markdownlint`'s rule API these rules touch, declared structurally
 * rather than imported: the published package depends on `visimark` and nothing
 * else, and a type imported from a devDependency would not resolve for a
 * consumer reading the emitted `.d.ts`.
 */

/** One node of `markdownlint`'s micromark token stream. */
export interface MicromarkToken {
  type: string;
  /** 1-based. */
  startLine: number;
  /** 1-based. */
  startColumn: number;
  /** 1-based. */
  endLine: number;
  /** 1-based, exclusive. */
  endColumn: number;
  /** The token's original text, from before HTML comments were blanked. */
  text: string;
  children: readonly MicromarkToken[];
}

export interface RuleParams {
  /**
   * The document's lines, front matter already removed and the content of every
   * HTML comment replaced with dots. `markdownlint` adds `frontMatterLines`'
   * length back to every reported `lineNumber` itself, so this package must not
   * offset anything — but it does have to undo the comment blanking, which
   * `sourceFrom` does. See `src/source.ts`.
   */
  lines: readonly string[];
  parsers: {
    micromark: { tokens: readonly MicromarkToken[] };
  };
}

export interface RuleErrorInfo {
  lineNumber: number;
  detail: string;
}

export type RuleOnError = (info: RuleErrorInfo) => void;

export interface Rule {
  names: string[];
  description: string;
  tags: string[];
  parser: "micromark";
  information: URL;
  function: (params: RuleParams, onError: RuleOnError) => void;
}
