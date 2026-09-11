import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";

function block(src: string) {
  return locate(src).blocks[0]!;
}

const FENCE = (meta: string, body = "") => ["```vmark " + meta, body, "```", ""].join("\n");

test("an ordinary sheet id has no import declaration", () => {
  const b = block(FENCE("#lines"));
  expect(b.sheetId).toBe("lines");
  expect(b.importDecl).toBeNull();
  expect(b.grammarError).toBeNull();
});

test("`from <path>` alone: unstamped import, comma delimiter, no labels", () => {
  const b = block(FENCE("#benchmark from benchmark.csv"));
  expect(b.importDecl).toMatchObject({
    path: "benchmark.csv",
    delimiter: ",",
    labels: null,
    stampPrefix: null,
    stampDigest: null,
    stampSpan: null,
  });
  expect(b.grammarError).toBeNull();
});

test("`from ... at sha256:<digest>`", () => {
  const digest = "a".repeat(64);
  const b = block(FENCE(`#benchmark from benchmark.csv at sha256:${digest}`));
  expect(b.importDecl?.stampPrefix).toBe("sha256");
  expect(b.importDecl?.stampDigest).toBe(digest);
  expect(b.importDecl?.stampSpan).not.toBeNull();
});

test("`delimited` and `labelled`, combined with `at`", () => {
  const b = block(
    FENCE(
      "#benchmark from benchmark.csv delimited : labelled Id, Time at sha256:" + "b".repeat(64),
    ),
  );
  expect(b.importDecl?.delimiter).toBe(":");
  expect(b.importDecl?.labels).toEqual(["Id", "Time"]);
  expect(b.importDecl?.stampDigest).toBe("b".repeat(64));
});

test("clauses out of order is a grammar error", () => {
  const b = block(
    FENCE("#benchmark from benchmark.csv at sha256:" + "c".repeat(64) + " delimited :"),
  );
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("delimited");
});

test("a repeated clause is a grammar error", () => {
  const b = block(FENCE("#benchmark from benchmark.csv delimited : delimited ;"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("delimited");
});

test("an unrecognised trailing token is a grammar error", () => {
  const b = block(FENCE("#benchmark from benchmark.csv bogus"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("bogus");
});

test("a bad delimiter character (digit) is a grammar error", () => {
  const b = block(FENCE("#benchmark from benchmark.csv delimited 5"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("delimited");
});

test("a multi-character delimiter is a grammar error", () => {
  const b = block(FENCE("#benchmark from benchmark.csv delimited ::"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError).not.toBeNull();
});

test("a non-`from` sheet with trailing garbage is left alone, as before", () => {
  const b = block(FENCE("#lines something else entirely"));
  expect(b.sheetId).toBe("lines");
  expect(b.importDecl).toBeNull();
  expect(b.grammarError).toBeNull();
});

test("spans are absolute offsets into the source, not into the meta string", () => {
  const src = FENCE("#benchmark from benchmark.csv");
  const b = block(src);
  const decl = b.importDecl!;
  expect(src.slice(decl.pathSpan.start, decl.pathSpan.end)).toBe("benchmark.csv");
});

test("`from <path>` alone has no labels mode", () => {
  const b = block(FENCE("#benchmark from benchmark.csv"));
  expect(b.importDecl?.labelsMode).toBeNull();
});

test("`labelled` sets labelsMode", () => {
  const b = block(FENCE("#benchmark from benchmark.csv labelled Id, Time"));
  expect(b.importDecl?.labelsMode).toBe("labelled");
});

test("`unlabelled <col>,...`, combined with `delimited` and `at`", () => {
  const b = block(
    FENCE(
      "#benchmark from benchmark.csv delimited : unlabelled Id, Time at sha256:" + "d".repeat(64),
    ),
  );
  expect(b.importDecl?.delimiter).toBe(":");
  expect(b.importDecl?.labels).toEqual(["Id", "Time"]);
  expect(b.importDecl?.labelsMode).toBe("unlabelled");
  expect(b.importDecl?.stampDigest).toBe("d".repeat(64));
  expect(b.grammarError).toBeNull();
});

test("`unlabelled` with an empty list is a grammar error", () => {
  const b = block(FENCE("#benchmark from benchmark.csv unlabelled at sha256:" + "e".repeat(64)));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("unlabelled");
});

test("`labelled` followed by `unlabelled` is out of order or repeated", () => {
  const b = block(FENCE("#benchmark from benchmark.csv labelled Id, Time unlabelled Id, Time"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("unlabelled");
  expect(b.grammarError?.message).toContain("out of order or repeated");
});

test("`unlabelled` followed by `labelled` is out of order or repeated", () => {
  const b = block(FENCE("#benchmark from benchmark.csv unlabelled Id, Time labelled Id, Time"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("labelled");
  expect(b.grammarError?.message).toContain("out of order or repeated");
});

test("`unlabelled` repeated is out of order or repeated", () => {
  const b = block(FENCE("#benchmark from benchmark.csv unlabelled Id unlabelled Time"));
  expect(b.importDecl).toBeNull();
  expect(b.grammarError?.message).toContain("out of order or repeated");
});
