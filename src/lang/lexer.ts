import { LangError, type Token, type TokenKind } from "./token.js";

const WORD_OPS = new Set(["and", "or", "not"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const isDigit = (c: string) => c >= "0" && c <= "9";
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);

/** Longest-match operator table, longest first. Word operators handled separately. */
const SYMBOL_OPS = ["==", "!=", "<=", ">=", "^", "*", "/", "+", "-", "<", ">", "="];

export function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (kind: TokenKind, value: string, start: number, end: number) =>
    tokens.push({ kind, value, start, end });

  while (i < src.length) {
    const c = src[i]!;

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (c === "#") {
      throw new LangError("unexpected `#` in expression", i, i + 1);
    }

    if (c === "(") {
      push("lparen", "(", i, i + 1);
      i++;
      continue;
    }
    if (c === ")") {
      push("rparen", ")", i, i + 1);
      i++;
      continue;
    }
    if (c === ",") {
      push("comma", ",", i, i + 1);
      i++;
      continue;
    }

    if (c === '"') {
      const start = i;
      i++;
      let value = "";
      while (i < src.length && src[i] !== '"') {
        value += src[i];
        i++;
      }
      if (i >= src.length) {
        throw new LangError("unterminated string literal", start, src.length);
      }
      i++; // closing quote
      push("string", value, start, i);
      continue;
    }

    // ISO date must be tried before a bare number, and only when the full
    // ten-character shape stands alone (not the head of a longer digit run).
    if (isDigit(c)) {
      const rest = src.slice(i);
      const dm = DATE_RE.exec(rest);
      if (dm && !isDigit(rest[10] ?? "")) {
        push("date", dm[0], i, i + 10);
        i += 10;
        continue;
      }

      const start = i;
      while (i < src.length && isDigit(src[i]!)) i++;
      if (src[i] === "." && isDigit(src[i + 1] ?? "")) {
        i++;
        while (i < src.length && isDigit(src[i]!)) i++;
      }
      if (src[i] === "," && isDigit(src[i + 1] ?? "")) {
        throw new LangError(
          "thousands separators are not allowed; write the number without separators",
          start,
          i + 1,
        );
      }
      const numText = src.slice(start, i);
      if (src[i] === "%") {
        i++;
        push("percent", numText, start, i);
      } else {
        push("number", numText, start, i);
      }
      continue;
    }

    if (c === ".") {
      push("dot", ".", i, i + 1);
      i++;
      continue;
    }

    if (isIdentStart(c)) {
      const start = i;
      while (i < src.length && isIdentPart(src[i]!)) i++;
      const text = src.slice(start, i);
      if (text === "true" || text === "false") {
        push("bool", text, start, i);
      } else if (WORD_OPS.has(text)) {
        push("op", text, start, i);
      } else {
        push("ident", text, start, i);
      }
      continue;
    }

    const sym = SYMBOL_OPS.find((s) => src.startsWith(s, i));
    if (sym) {
      push("op", sym, i, i + sym.length);
      i += sym.length;
      continue;
    }

    throw new LangError(`unexpected character ${JSON.stringify(c)}`, i, i + 1);
  }

  push("eof", "", src.length, src.length);
  return tokens;
}
