import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./support.js";

const ROOT = join(import.meta.dir, "../../..");

/** The §4.3 acceptance repository, as path → text. */
export function fixtureRepo(): Map<string, string> {
  const budget = fixture("total-row", "bad.md");
  return new Map([
    ["README.md", "# Fixture\n\n<!--vmark:no-formulas-->\n"],
    ["LICENSE", "MIT\n"],
    ["test/fixture.md", budget],
    [
      "docs/example-lunch-split-drift.md",
      readFileSync(join(ROOT, "docs/example-lunch-split-drift.md"), "utf8"),
    ],
    ["docs/budget.md", budget],
    ["docs/quote.md", fixture("line-product", "bad.md")],
  ]);
}
