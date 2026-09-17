// What the playground does when a document does not arrive.
//
// Review §2.1: the page used to `Promise.all` over 22 `fetch()`es with no
// `try`/`catch` anywhere in the boot chain, so one 404 rejected the whole IIFE
// and the visitor got the styled shell with no message at all. loadFiles now
// reports which documents failed instead of rejecting on the first one, and
// main.ts decides which of those are fatal.

import { afterEach, describe, expect, test } from "bun:test";
import { FILE_SOURCES, loadFiles, loadScenarios } from "../../../src/playground/app/sources.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Serves `bodies` by path; anything else 404s. */
function stubFetch(bodies: Record<string, string>): void {
  // `typeof fetch` carries Bun's `preconnect` sibling; a stub that only needs
  // to answer calls goes through `unknown` rather than growing one.
  globalThis.fetch = ((input: string) =>
    Promise.resolve(
      bodies[input] === undefined
        ? new Response("not found", { status: 404 })
        : new Response(bodies[input]),
    )) as unknown as typeof fetch;
}

describe("loadFiles", () => {
  test("one missing document costs that document and nothing else", async () => {
    const everything = Object.fromEntries(
      Object.values(FILE_SOURCES).map((path) => [path, `# ${path}`]),
    );
    delete everything["example-charts.md"];
    stubFetch(everything);

    const { files, failed } = await loadFiles(Object.keys(FILE_SOURCES));

    expect(failed.map((f) => f.name)).toEqual(["example-charts.md"]);
    expect(failed[0]!.reason).toBe("HTTP 404");
    expect(files["demo.md"]).toBe("# playground/demo.md");
    expect(files["example-charts.md"]).toBeUndefined();
    // every other document still loaded — the failure is not contagious
    expect(Object.keys(files)).toHaveLength(Object.keys(FILE_SOURCES).length - 1);
  });

  test("a network error is reported, not thrown", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("NetworkError"))) as unknown as typeof fetch;

    const { files, failed } = await loadFiles(Object.keys(FILE_SOURCES));

    expect(Object.keys(files)).toHaveLength(0);
    expect(failed).toHaveLength(Object.keys(FILE_SOURCES).length);
    expect(failed[0]!.reason).toBe("NetworkError");
  });

  test("every failure names the path that was actually requested", async () => {
    stubFetch({});
    const { failed } = await loadFiles(Object.keys(FILE_SOURCES));
    const imports = failed.find((f) => f.name === "13-imports.csv");
    expect(imports?.path).toBe("playground/tutorial/13-imports.csv");
  });
});

describe("loadScenarios", () => {
  test("rejects with the path, so the caller can name it", async () => {
    stubFetch({});
    expect(loadScenarios()).rejects.toThrow("playground/scenarios.json: HTTP 404");
  });

  test('drops the "//" documentation key', async () => {
    stubFetch({
      "playground/scenarios.json": JSON.stringify({
        "//": "what this file is",
        "demo.md": { body: "b" },
      }),
    });
    const scenarios = await loadScenarios();
    expect(Object.keys(scenarios)).toEqual(["demo.md"]);
  });
});
