import { expect, test } from "bun:test";
import { parseCsv } from "../../src/import/csv.js";

test("comma default", () => {
  const r = parseCsv("Id,Time\n1,12.3\n2,10.1\n", ",");
  expect(r).toEqual({
    ok: true,
    header: ["Id", "Time"],
    rows: [
      ["1", "12.3"],
      ["2", "10.1"],
    ],
  });
});

test("no trailing newline still closes the last row", () => {
  const r = parseCsv("Id,Time\n1,12.3", ",");
  expect(r).toEqual({ ok: true, header: ["Id", "Time"], rows: [["1", "12.3"]] });
});

test("custom delimiter", () => {
  const r = parseCsv("Id:Time\n1:12.3\n", ":");
  expect(r).toEqual({ ok: true, header: ["Id", "Time"], rows: [["1", "12.3"]] });
});

test("quoted field containing the delimiter", () => {
  const r = parseCsv('Name,Note\n"a,b",ok\n', ",");
  expect(r).toEqual({ ok: true, header: ["Name", "Note"], rows: [["a,b", "ok"]] });
});

test("quoted field containing a newline", () => {
  const r = parseCsv('Name,Note\n"line1\nline2",ok\n', ",");
  expect(r).toEqual({ ok: true, header: ["Name", "Note"], rows: [["line1\nline2", "ok"]] });
});

test('escaped quote ("")', () => {
  const r = parseCsv('Name\n"she said ""hi"""\n', ",");
  expect(r).toEqual({ ok: true, header: ["Name"], rows: [['she said "hi"']] });
});

test("CRLF line endings", () => {
  const r = parseCsv("Id,Time\r\n1,12.3\r\n", ",");
  expect(r).toEqual({ ok: true, header: ["Id", "Time"], rows: [["1", "12.3"]] });
});

test("mixed line endings are rejected", () => {
  const r = parseCsv("Id,Time\r\n1,12.3\n2,10.1\r\n", ",");
  expect(r.ok).toBe(false);
  expect(!r.ok && r.message).toContain("mixed line endings");
});

test("unterminated quote is rejected", () => {
  const r = parseCsv('Name\n"unterminated\n', ",");
  expect(r.ok).toBe(false);
  expect(!r.ok && r.message).toContain("unterminated");
});

test("empty file is rejected", () => {
  const r = parseCsv("", ",");
  expect(r.ok).toBe(false);
});

test("header-only file parses with zero data rows", () => {
  const r = parseCsv("Id,Time\n", ",");
  expect(r).toEqual({ ok: true, header: ["Id", "Time"], rows: [] });
});

test("empty fields are empty strings, not dropped", () => {
  const r = parseCsv("A,B,C\n1,,3\n", ",");
  expect(r).toEqual({ ok: true, header: ["A", "B", "C"], rows: [["1", "", "3"]] });
});
