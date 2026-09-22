import { beforeEach, expect, test } from "bun:test";
import rules from "../src/index.js";
import { DESCRIPTIONS } from "../src/descriptions.js";
import { findingsFor, parseCount, resetFindingsCache } from "../src/findings.js";

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

/**
 * `markdownlint` passes the micromark token stream alongside the lines. These
 * two tests use documents with no HTML comment in them, so an empty stream
 * restores the source unchanged; `lint.test.ts` drives the real parser.
 */
function paramsFor(source: string) {
  return { lines: source.split("\n"), parsers: { micromark: { tokens: [] } } };
}

beforeEach(() => {
  resetFindingsCache();
});

test("one rule per FindingCode, seventeen of them", () => {
  // Registration order is DESCRIPTIONS' order, which transcribes the §10
  // taxonomy table rather than the FindingCode union. Nothing observable
  // depends on it — markdownlint sorts its output by rule name — so this
  // asserts the set, and the description test below pins the order.
  expect(rules).toHaveLength(17);
  expect(rules.map((r) => r.names[0]).sort()).toEqual(
    [
      "visimark-stale",
      "visimark-date",
      "visimark-unit",
      "visimark-undef",
      "visimark-dup",
      "visimark-vector",
      "visimark-cycle",
      "visimark-type",
      "visimark-sheet",
      "visimark-anchor",
      "visimark-assert",
      "visimark-precision",
      "visimark-artifact",
      "visimark-import",
      "visimark-warn",
      "visimark-note",
      "visimark-coverage",
    ].sort(),
  );
  for (const rule of rules) {
    expect(rule.names).toHaveLength(1);
  }
});

test("every rule carries the visimark tag; only WARN and NOTE are advisory", () => {
  for (const rule of rules) {
    expect(rule.tags).toContain("visimark");
  }
  const advisory = rules.filter((r) => r.tags.includes("visimark-advisory")).map((r) => r.names[0]);
  expect(advisory).toEqual(["visimark-warn", "visimark-note"]);
});

test("every rule reads the micromark parser and describes itself", () => {
  for (const rule of rules) {
    // Not "none": only the micromark token stream carries the original text of
    // an HTML comment, and VisiMark's prose anchors are HTML comments.
    expect(rule.parser).toBe("micromark");
    expect(rule.description.length).toBeGreaterThan(0);
  }
  expect(rules.map((r) => r.description)).toEqual(Object.values(DESCRIPTIONS));
});

test("information is a URL instance, not a string", () => {
  // markdownlint v0.41.1 throws inside rule validation on a string here and
  // takes the whole run down — not a cosmetic difference.
  for (const rule of rules) {
    expect(rule.information).toBeInstanceOf(URL);
    expect(rule.information.href).toBe(
      "https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy",
    );
  }
});

test("the seventeen rules pay one analyze() call per document", () => {
  for (const rule of rules) {
    rule.function(paramsFor(stale), () => {});
  }
  expect(parseCount()).toBe(1);
});

test("a second document with different content invalidates the cache", () => {
  expect(findingsFor(stale)).toHaveLength(1);
  expect(findingsFor(clean)).toHaveLength(0);
  expect(parseCount()).toBe(2);
});

test("a second document with byte-identical content still reports, from the cache", () => {
  const first = findingsFor(stale);
  const second = findingsFor(stale.slice(0)); // equal content, one analyze() call
  expect(second).toHaveLength(1);
  expect(second[0]!.code).toBe(first[0]!.code);
  expect(parseCount()).toBe(1);
});

test("prose with no table and no vmark block produces nothing", () => {
  const prose = "# Notes\n\nNothing to check here.\n";
  let calls = 0;
  for (const rule of rules) {
    rule.function(paramsFor(prose), () => {
      calls++;
    });
  }
  expect(findingsFor(prose)).toHaveLength(0);
  expect(calls).toBe(0);
});
