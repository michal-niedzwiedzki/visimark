import { StreamLanguage } from "@codemirror/language";
import {
  isVmarkFence as firstWordIsVmark,
  tokenizeLine,
  type Kind,
  type Span,
} from "./tokenize.js";

/**
 * codemirror-visimark/highlight — the `vmark` block language (#367). The only
 * file in the package that touches `@codemirror/language`; the tokenizer
 * itself is `tokenize.ts`, which imports nothing.
 *
 * Tags are named by string, which `StreamLanguage` resolves against
 * `@lezer/highlight`'s `tags` itself, so this file never imports
 * `@lezer/highlight`. This table is the styling contract a host's
 * `HighlightStyle` relies on — docs/design/syntax-highlighting-for-vmark-blocks-spec.md §3.1.
 */
const TAG: Readonly<Record<Kind, string>> = {
  keyword: "keyword",
  wordOperator: "operatorKeyword",
  domainPreset: "typeName",
  atom: "atom",
  function: "variableName.function",
  definition: "variableName.definition",
  name: "variableName",
  assign: "definitionOperator",
  operator: "operator",
  paren: "paren",
  bracket: "bracket",
  domainBracket: "squareBracket",
  brace: "brace",
  separator: "separator",
  deref: "derefOperator",
  punctuation: "punctuation",
  number: "number",
  date: "literal",
  string: "string",
  unit: "unit",
  comment: "lineComment",
};

interface LineState {
  /** the line `spans` were computed for */
  line: string | null;
  spans: Span[];
  /** index of the first span not yet emitted */
  at: number;
}

const language = StreamLanguage.define<LineState>({
  name: "vmark",
  startState: () => ({ line: null, spans: [], at: 0 }),
  copyState: (s) => ({ line: s.line, spans: s.spans, at: s.at }),
  token(stream, state) {
    if (stream.sol() || state.line !== stream.string) {
      state.line = stream.string;
      state.spans = tokenizeLine(stream.string);
      state.at = 0;
    }
    while (state.at < state.spans.length && state.spans[state.at]!.to <= stream.pos) state.at++;
    const span = state.spans[state.at];
    if (span !== undefined && span.from <= stream.pos) {
      stream.pos = span.to;
      state.at++;
      return TAG[span.kind];
    }
    // a gap — whitespace or a character with no span — up to the next span
    stream.pos = span?.from ?? stream.string.length;
    return null;
  },
});

// The two exports are declared here rather than re-exported, so the shipped
// highlight.d.ts names nothing from ./tokenize.js (build.ts refuses that).

/** The `vmark` block language. Pass it to `markdown({ codeLanguages })`. */
export const visimarkLanguage: StreamLanguage<unknown> = language as StreamLanguage<unknown>;

/** `true` when a fence's info string opens a `vmark` block: its first word is `vmark`. */
export function isVmarkFence(info: string): boolean {
  return firstWordIsVmark(info);
}
