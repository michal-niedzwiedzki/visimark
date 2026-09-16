import { expect, test } from "bun:test";
import { FUNCTION_TABLE } from "../../src/eval/functions.js";
import { FUNCTION_DOCS } from "../../src/lang/reference.js";
import { analyze } from "../../src/index.js";

/**
 * Build a document whose last binding is the example expression, evaluate it,
 * and read the value back. A doc-scope binding's id is its bare name
 * (`model/build.ts`), so the binding is named `example` and read by that key.
 */
function evaluate(expr: string, given?: string): string {
  const source = `${given ?? ""}\n\`\`\`vmark\nexample = ${expr}\n\`\`\`\n`;
  const { result } = analyze(source);
  const errors = result.findings.filter((f) => f.code !== "WARN" && f.code !== "NOTE");
  expect(errors.map((f) => `${f.code} ${f.message}`)).toEqual([]);
  const v = result.values.get("example");
  if (!v) throw new Error(`no value for \`${expr}\``);
  return v.t === "num"
    ? v.d.toString()
    : v.t === "date"
      ? v.iso
      : v.t === "bool"
        ? String(v.b)
        : v.s;
}

for (const name of Object.keys(FUNCTION_TABLE) as (keyof typeof FUNCTION_TABLE)[]) {
  for (const ex of FUNCTION_DOCS[name].examples) {
    test(`${name}: ${ex.expr} is ${ex.is}`, () => {
      expect(evaluate(ex.expr, ex.given)).toBe(ex.is);
    });
  }
}
