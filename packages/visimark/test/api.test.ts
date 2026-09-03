import { expect, test } from "bun:test";
import {
  analyze,
  applyEdits,
  build,
  check,
  dependencies,
  fmt,
  locate,
  planFmt,
  resolve,
  runCli,
  topoOrder,
} from "../src/index.js";

test("the editor-facing API exports what the server needs", () => {
  for (const fn of [
    analyze,
    applyEdits,
    build,
    check,
    dependencies,
    fmt,
    locate,
    planFmt,
    resolve,
    runCli,
    topoOrder,
  ]) {
    expect(typeof fn).toBe("function");
  }
});

test("analyze returns a model and a check result over one parse", () => {
  const { model, result } = analyze("no vmark here\n");
  expect(model.sheets.size).toBe(0);
  expect(result.findings).toEqual([]);
});
