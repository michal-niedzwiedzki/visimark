import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOC_FIELDS, SCENARIO_FIELDS, resolveInput, resolveOptionalInput } from "../src/input.js";

const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-input-"));
const doc = join(dir, "doc.md");
writeFileSync(doc, "# hello\n");

test("path only resolves to a document on disk", () => {
  const r = resolveInput({ path: doc });
  expect(r).toMatchObject({ source: "# hello\n", file: doc });
  expect("doc" in r && r.doc?.path).toBe(doc);
});

test("content only resolves to no document — the phases stand down", () => {
  // `doc: undefined` is how `fs/reader.ts` states "this document is not on a
  // filesystem". It is not a stub reader and must not become one.
  expect(resolveInput({ content: "# hi\n" })).toEqual({
    source: "# hi\n",
    doc: undefined,
    file: undefined,
  });
});

test("both given is a usage error, never a silent preference", () => {
  expect(resolveInput({ path: doc, content: "# hi\n" })).toEqual({
    code: "USAGE",
    message: "visimark: give path or content, not both",
  });
});

test("neither given is a usage error", () => {
  expect(resolveInput({})).toEqual({
    code: "USAGE",
    message: "visimark: give path or content",
  });
});

test("an unreadable path is READ, not USAGE", () => {
  const missing = join(dir, "nope.md");
  expect(resolveInput({ path: missing })).toEqual({
    code: "READ",
    message: `visimark: cannot read ${missing}`,
  });
});

test("the scenario fields follow the same four arms", () => {
  const f = SCENARIO_FIELDS;
  expect(resolveInput({ scenarioPath: doc }, f)).toMatchObject({ file: doc });
  expect(resolveInput({ scenarioContent: "x" }, f)).toMatchObject({ doc: undefined });
  expect(resolveInput({ scenarioPath: doc, scenarioContent: "x" }, f)).toEqual({
    code: "USAGE",
    message: "visimark: give scenarioPath or scenarioContent, not both",
  });
  expect(resolveInput({}, f)).toEqual({
    code: "USAGE",
    message: "visimark: give scenarioPath or scenarioContent",
  });
  expect(resolveInput({ scenarioPath: join(dir, "nope.md") }, f)).toMatchObject({ code: "READ" });
});

test("an absent scenario is not a fault — a scenario is optional", () => {
  expect(resolveOptionalInput({ path: doc }, SCENARIO_FIELDS)).toBeUndefined();
  expect(resolveOptionalInput({ path: doc, scenarioContent: "x" }, SCENARIO_FIELDS)).toMatchObject({
    source: "x",
  });
});

test("the document fields are the default", () => {
  expect(resolveInput({ content: "x" }, DOC_FIELDS)).toEqual(resolveInput({ content: "x" }));
});
