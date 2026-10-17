import { describe, expect, test } from "bun:test";
import { importTargets } from "../src/imports.js";
import { engine } from "./support.js";

const importing = (from: string) =>
  `| Item | Qty |\n|---|---|\n\n\`\`\`vmark #t from ${from} labelled Item, Qty\n\`\`\`\n`;

describe("importTargets", () => {
  test("collects from-paths relative to the document's directory", () => {
    const md = new Map([
      ["docs/a.md", importing("../data/x.csv")],
      ["docs/b.md", importing("y.csv")],
      ["c.md", importing("data/x.csv")],
    ]);
    expect(importTargets(md, engine)).toEqual(["data/x.csv", "docs/y.csv"]);
  });

  test("drops a path escaping the root", () => {
    expect(importTargets(new Map([["a.md", importing("../outside.csv")]]), engine)).toEqual([]);
  });
});
