import Decimal from "decimal.js";
import {
  COMPARISON_OPS,
  type Call,
  type Expr,
  type Ref,
} from "./ast.js";
import { lex } from "./lexer.js";
import { LangError, type Token } from "./token.js";

const LEFT_BP: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "^": 6,
};
const RIGHT_ASSOC = new Set(["^"]);
const UNARY_MINUS_BP = 5;
const UNARY_NOT_BP = 2;

class Parser {
  private pos = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token {
    return this.toks[this.pos]!;
  }
  private next(): Token {
    return this.toks[this.pos++]!;
  }
  private expect(kind: Token["kind"], what: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new LangError(`expected ${what}`, t.start, t.end);
    }
    return this.next();
  }

  parseTopLevel(): Expr {
    const expr = this.parseBp(0);
    const t = this.peek();
    if (t.kind !== "eof") {
      throw new LangError(
        `unexpected ${t.kind === "op" ? `operator \`${t.value}\`` : t.kind}`,
        t.start,
        t.end,
      );
    }
    return expr;
  }

  private parseBp(minBp: number): Expr {
    let left = this.nud();

    for (;;) {
      const t = this.peek();
      if (t.kind !== "op") break;
      const lbp = LEFT_BP[t.value];
      if (lbp === undefined || lbp <= minBp) break;

      if (
        COMPARISON_OPS.has(t.value) &&
        left.type === "binary" &&
        COMPARISON_OPS.has(left.op)
      ) {
        throw new LangError(
          "comparisons do not chain; use `and` to combine them",
          t.start,
          t.end,
        );
      }

      this.next();
      const rbp = RIGHT_ASSOC.has(t.value) ? lbp - 1 : lbp;
      const right = this.parseBp(rbp);
      left = {
        type: "binary",
        op: t.value,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  private nud(): Expr {
    const t = this.next();
    switch (t.kind) {
      case "number":
        return { type: "num", value: normNum(t.value), start: t.start, end: t.end };
      case "percent": {
        const folded = new Decimal(t.value).div(100).toString();
        return { type: "num", value: folded, start: t.start, end: t.end };
      }
      case "date":
        return { type: "date", value: t.value, start: t.start, end: t.end };
      case "string":
        return { type: "str", value: t.value, start: t.start, end: t.end };
      case "bool":
        return {
          type: "bool",
          value: t.value === "true",
          start: t.start,
          end: t.end,
        };
      case "ident":
        return this.identTail(t);
      case "lparen": {
        const inner = this.parseBp(0);
        const close = this.expect("rparen", "`)`");
        inner.start = t.start;
        inner.end = close.end;
        return inner;
      }
      case "op":
        if (t.value === "-") {
          const operand = this.parseBp(UNARY_MINUS_BP);
          return {
            type: "unary",
            op: "-",
            operand,
            start: t.start,
            end: operand.end,
          };
        }
        if (t.value === "not") {
          const operand = this.parseBp(UNARY_NOT_BP);
          return {
            type: "unary",
            op: "not",
            operand,
            start: t.start,
            end: operand.end,
          };
        }
        throw new LangError(`unexpected operator \`${t.value}\``, t.start, t.end);
      default:
        throw new LangError(`unexpected ${t.kind}`, t.start, t.end);
    }
  }

  private identTail(idTok: Token): Expr {
    if (this.peek().kind === "dot") {
      this.next();
      const nameTok = this.expect("ident", "a name after `.`");
      const ref: Ref = {
        type: "ref",
        qualifier: idTok.value,
        name: nameTok.value,
        start: idTok.start,
        end: nameTok.end,
      };
      return ref;
    }
    if (this.peek().kind === "lparen") {
      this.next();
      const args: Expr[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.parseBp(0));
        while (this.peek().kind === "comma") {
          this.next();
          args.push(this.parseBp(0));
        }
      }
      const close = this.expect("rparen", "`)`");
      const call: Call = {
        type: "call",
        name: idTok.value,
        args,
        start: idTok.start,
        end: close.end,
      };
      return call;
    }
    return { type: "ref", name: idTok.value, start: idTok.start, end: idTok.end };
  }
}

function normNum(text: string): string {
  // Preserve the written form's information but drop a redundant leading "+".
  return text;
}

export function parseExpr(src: string): Expr {
  return new Parser(lex(src)).parseTopLevel();
}

export interface Binding {
  name: string;
  expr: Expr;
  nameStart: number;
  nameEnd: number;
}

export function parseBinding(line: string): Binding {
  const toks = lex(line);
  const eqIndex = toks.findIndex((t) => t.kind === "op" && t.value === "=");
  if (eqIndex === -1) {
    throw new LangError("binding has no `=`", 0, line.length);
  }
  const lhs = toks.slice(0, eqIndex);
  const nameToks = lhs.filter((t) => t.kind !== "eof");
  if (nameToks.length !== 1 || nameToks[0]!.kind !== "ident") {
    const start = nameToks[0]?.start ?? 0;
    const end = nameToks[nameToks.length - 1]?.end ?? line.length;
    throw new LangError("the left of `=` must be a single name", start, end);
  }
  const nameTok = nameToks[0]!;
  const rhs = toks.slice(eqIndex + 1); // keeps the trailing eof
  const expr = new Parser(rhs).parseTopLevel();
  return {
    name: nameTok.value,
    expr,
    nameStart: nameTok.start,
    nameEnd: nameTok.end,
  };
}
