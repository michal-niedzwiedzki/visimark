export type TokenKind =
  | "number"
  | "percent"
  | "date"
  | "string"
  | "bool"
  | "ident"
  | "op"
  | "dot"
  | "lparen"
  | "rparen"
  | "comma"
  | "eof";

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
}

export class LangError extends Error {
  readonly start: number;
  readonly end: number;
  constructor(message: string, start: number, end: number) {
    super(message);
    this.name = "LangError";
    this.start = start;
    this.end = end;
  }
}
