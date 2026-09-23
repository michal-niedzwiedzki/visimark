import { describe, expect, test } from "bun:test";
import { compareEnvelopes } from "./cross-host-compare.js";

describe("compareEnvelopes", () => {
  test("identical envelopes diverge nowhere", () => {
    const envelope = {
      command: "check",
      visimark: "0.1.7",
      files: [{ path: "a.md", findings: [] }],
    };
    expect(compareEnvelopes(envelope, envelope)).toEqual([]);
  });

  test("a difference only in the visimark field is not reported", () => {
    const cli = { command: "check", visimark: "0.1.7", status: "ok" };
    const browser = { command: "check", visimark: "0.1.6", status: "ok" };
    expect(compareEnvelopes(cli, browser)).toEqual([]);
  });

  test("a real divergence names its exact path", () => {
    const cli = { files: [{ path: "a.md", findings: [{ code: "STALE" }] }] };
    const browser = { files: [{ path: "a.md", findings: [{ code: "DATE" }] }] };
    const divergences = compareEnvelopes(cli, browser);
    expect(divergences).toEqual([
      { path: "files[0].findings[0].code", cli: "STALE", browser: "DATE" },
    ]);
  });

  test("a difference at a scoped-exclusion path is not reported", () => {
    const cli = { files: [{ path: "a.md", imports: { order: { state: "current" } } }] };
    const browser = { files: [{ path: "a.md", imports: { order: { state: "skipped" } } }] };
    const divergences = compareEnvelopes(cli, browser, {
      scopedExclusions: ["files[0].imports.order"],
    });
    expect(divergences).toEqual([]);
  });

  test("a scoped exclusion does not hide an unrelated divergence", () => {
    const cli = {
      files: [
        { path: "a.md", imports: { order: { state: "current" } }, findings: [{ code: "STALE" }] },
      ],
    };
    const browser = {
      files: [
        { path: "a.md", imports: { order: { state: "skipped" } }, findings: [{ code: "DATE" }] },
      ],
    };
    const divergences = compareEnvelopes(cli, browser, {
      scopedExclusions: ["files[0].imports.order"],
    });
    expect(divergences).toEqual([
      { path: "files[0].findings[0].code", cli: "STALE", browser: "DATE" },
    ]);
  });

  test("a key present on one side and absent on the other is a divergence", () => {
    const cli = { status: "ok", scenario: { file: "s.json", params: {} } };
    const browser = { status: "ok" };
    const divergences = compareEnvelopes(cli, browser);
    expect(divergences).toEqual([
      { path: "scenario", cli: { file: "s.json", params: {} }, browser: undefined },
    ]);
  });
});
