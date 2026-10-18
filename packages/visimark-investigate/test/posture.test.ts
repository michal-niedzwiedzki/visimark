import { describe, expect, test } from "bun:test";
import { computePosture } from "../src/posture.js";

const ACTION = "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.4.1\n";

describe("computePosture", () => {
  test("CONTRIBUTING at the root, in docs/ and in .github/", () => {
    for (const p of [
      "CONTRIBUTING.md",
      "docs/CONTRIBUTING.rst",
      ".github/contributing",
      "CONTRIBUTING",
    ]) {
      expect(computePosture([p], [], null).contributing).toBe(true);
    }
    expect(computePosture(["src/CONTRIBUTING.md"], [], null).contributing).toBe(false);
  });

  test("PR template file and directory forms", () => {
    expect(computePosture(["PULL_REQUEST_TEMPLATE.md"], [], null).prTemplate).toBe(true);
    expect(computePosture([".github/pull_request_template.md"], [], null).prTemplate).toBe(true);
    expect(computePosture(["docs/pull_request_template.md"], [], null).prTemplate).toBe(true);
    expect(computePosture([".github/PULL_REQUEST_TEMPLATE/feature.md"], [], null).prTemplate).toBe(
      true,
    );
    expect(computePosture(["a/pull_request_template.md"], [], null).prTemplate).toBe(false);
  });

  test("LICENSE.md and COPYING at the root only", () => {
    expect(computePosture(["LICENSE.md"], [], null).license).toBe(true);
    expect(computePosture(["COPYING"], [], null).license).toBe(true);
    expect(computePosture(["Licence"], [], null).license).toBe(true);
    expect(computePosture(["docs/LICENSE"], [], null).license).toBe(false);
  });

  test("actionUsed from a workflow text", () => {
    expect(computePosture([], [ACTION], null).actionUsed).toBe(true);
    expect(computePosture([], ["steps: []\n"], null).actionUsed).toBe(false);
  });

  test("lastCommit passes through", () => {
    expect(computePosture([], [], "2026-09-30")).toEqual({
      available: true,
      contributing: false,
      prTemplate: false,
      license: false,
      actionUsed: false,
      lastCommit: "2026-09-30",
    });
  });

  test("unavailable when the workflows could not be read", () => {
    expect(computePosture(["LICENSE"], null, "2026-09-30")).toEqual({
      available: false,
      contributing: null,
      prTemplate: null,
      license: null,
      actionUsed: null,
      lastCommit: null,
    });
  });
});
