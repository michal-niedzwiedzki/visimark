import { describe, expect, test } from "bun:test";
import {
  applyScenario,
  listParams,
  parseScenarioJson,
  resolveScenario,
  ScenarioError,
} from "../../src/eval/scenario.js";
import { check } from "../../src/eval/check.js";
import { build } from "../../src/model/build.js";
import { locate } from "../../src/parse/document.js";

// docs/design/scenario-params-spec.md §3.3 (worked cases) and §4.2 (messages)

const DOC =
  "| Item | Price |\n|------|------:|\n| a    | 10    |\n\n" +
  "```vmark #budget\n" +
  "param tax precision 3 = default 19%\n" +
  "param rate precision 3 = default 0.19\n" +
  "param headcount precision 0 = default 40\n" +
  "Total = Price * 2\n" +
  "net precision 2 = 1000 * (1 + tax)\n" +
  "plain = 5\n" +
  "```\n\n" +
  "```vmark #forecast\n" +
  "param tax precision 3 = default 20%\n" +
  "param growth precision 2 = default 1.5\n" +
  "```\n";

const model = () => build(locate(DOC));

function resolve(json: string): Map<string, string> {
  return resolveScenario(model(), parseScenarioJson(json, "s.json"));
}

function fault(json: string): string {
  try {
    resolve(json);
  } catch (e) {
    if (e instanceof ScenarioError) return e.message;
    throw e;
  }
  throw new Error(`accepted: ${json}`);
}

describe("parseScenarioJson", () => {
  test("reads top-level pairs with their raw value text", () => {
    expect(parseScenarioJson('{ "a": "1", "b" : 2, "c": [1, {"x": ","}] }', "f")).toEqual([
      { key: "a", raw: '"1"' },
      { key: "b", raw: "2" },
      { key: "c", raw: '[1, {"x": ","}]' },
    ]);
  });

  test("an empty object has no entries", () => {
    expect(parseScenarioJson(" {} ", "f")).toEqual([]);
  });

  for (const text of ["", "nope", "[]", "3", '"x"', "null", "{"]) {
    test(`not an object: ${JSON.stringify(text)}`, () => {
      expect(() => parseScenarioJson(text, "t.json")).toThrow(
        "visimark: scenario t.json is not a JSON object",
      );
    });
  }

  test("keys with escapes", () => {
    expect(parseScenarioJson('{"a\\"b": "1"}', "f")[0]!.key).toBe('a"b');
  });
});

describe("listParams", () => {
  test("every param, qualified, in document order, with its canonical default", () => {
    expect(listParams(model()).map((p) => [p.id, p.defaultValue, p.percent])).toEqual([
      ["budget.tax", "0.19", true],
      ["budget.rate", "0.19", false],
      ["budget.headcount", "40", false],
      ["forecast.tax", "0.2", true],
      ["forecast.growth", "1.5", false],
    ]);
  });
});

describe("worked cases", () => {
  const accepted: [string, Record<string, string>][] = [
    ["{}", {}],
    ['{"budget.tax": "12.5%"}', { "budget.tax": "0.125" }],
    ['{"budget.tax": "12%"}', { "budget.tax": "0.12" }],
    ['{"budget.tax": "12.50%"}', { "budget.tax": "0.125" }],
    ['{"rate": "12.5%"}', { "budget.rate": "0.125" }],
    ['{"headcount": "-3"}', { "budget.headcount": "-3" }],
    ['{"headcount": "44.0"}', { "budget.headcount": "44" }],
    [
      '{"growth": "3.10", "forecast.tax": "21%"}',
      { "forecast.growth": "3.1", "forecast.tax": "0.21" },
    ],
    ['{"headcount": "12345678901234567890"}', { "budget.headcount": "12345678901234567890" }],
  ];
  for (const [json, want] of accepted) {
    test(`accepts ${json}`, () => {
      expect(Object.fromEntries(resolve(json))).toEqual(want);
    });
  }

  const refused: [string, string][] = [
    [
      '{"budget.tax": "12.55%"}',
      "visimark: scenario value for budget.tax has 4 decimals; tax declares 3",
    ],
    ['{"budget.tax": "12.5"}', 'visimark: budget.tax is a percent; write "12.5%"'],
    ['{"budget.tax": "0.125"}', 'visimark: budget.tax is a percent; write "0.125%"'],
    [
      '{"budget.tax": 12.5}',
      'visimark: scenario value for budget.tax must be a string: write "12.5"',
    ],
    ['{"headcount": 44}', 'visimark: scenario value for headcount must be a string: write "44"'],
    ['{"rate": "0.1255"}', "visimark: scenario value for rate has 4 decimals; rate declares 3"],
    [
      '{"headcount": "44.5"}',
      "visimark: scenario value for headcount has 1 decimal; headcount declares 0",
    ],
    ['{"headcount": "1e3"}', 'visimark: scenario value for headcount is not a number: "1e3"'],
    ['{"headcount": "1,000"}', 'visimark: scenario value for headcount is not a number: "1,000"'],
    ['{"headcount": " 44"}', 'visimark: scenario value for headcount is not a number: " 44"'],
    ['{"headcount": "+44"}', 'visimark: scenario value for headcount is not a number: "+44"'],
    ['{"headcount": "$44"}', 'visimark: scenario value for headcount is not a number: "$44"'],
    [
      '{"headcount": "2026-01-01"}',
      'visimark: scenario value for headcount is not a number: "2026-01-01"',
    ],
    ['{"headcount": true}', "visimark: scenario value for headcount is not a number: true"],
    ['{"headcount": null}', "visimark: scenario value for headcount is not a number: null"],
    ['{"headcount": []}', "visimark: scenario value for headcount is not a number: []"],
    ['{"headcount": {}}', "visimark: scenario value for headcount is not a number: {}"],
    ['{"tax": "12%"}', "visimark: scenario key tax is ambiguous: budget.tax, forecast.tax"],
    [
      '{"budget.tax": "12%", "budget.tax": "13%"}',
      "visimark: scenario key budget.tax is given twice",
    ],
    ['{"budget.rate": "1%", "rate": "2%"}', "visimark: scenario key rate is given twice"],
    [
      '{"headcont": "1"}',
      "visimark: scenario key headcont names no param; did you mean headcount?",
    ],
    ['{"zzzzzzzzzz": "1"}', "visimark: scenario key zzzzzzzzzz names no param"],
    ['{"net": "1"}', "visimark: scenario key net is a rule, not a param"],
    ['{"budget.plain": "1"}', "visimark: scenario key budget.plain is a rule, not a param"],
    ['{"Price": "1"}', "visimark: scenario key Price is a column, not a param"],
    ['{"budget.Item": "1"}', "visimark: scenario key budget.Item is a column, not a param"],
  ];
  for (const [json, message] of refused) {
    test(`refuses ${json}`, () => {
      expect(fault(json)).toBe(message);
    });
  }
});

describe("applyScenario", () => {
  test("downstream values change, rounding at each binding as always", () => {
    const m = model();
    applyScenario(m, resolveScenario(m, parseScenarioJson('{"budget.tax": "12.5%"}', "s")));
    const r = check(m);
    expect(String((r.values.get("budget.net") as { d: unknown }).d)).toBe("1125");
    expect(String((r.values.get("budget.rate") as { d: unknown }).d)).toBe("0.19");
  });
});
