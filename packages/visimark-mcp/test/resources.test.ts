import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../package.json" with { type: "json" };
import { PROMPTS, promptFor } from "../src/prompts.js";
import { RESOURCES, readResource, resourceFor } from "../src/resources.js";
import { renderSkill, SERVED_DOCS } from "../../../scripts/gen-mcp-skill.js";

const repo = join(import.meta.dir, "../../..");

test("the five spec URIs are the ones served", () => {
  expect(RESOURCES.map((r) => r.uri)).toEqual([
    "visimark://skill",
    "visimark://cli-reference",
    "visimark://function-reference",
    "visimark://example/invoice",
    "visimark://example/drift",
  ]);
});

test("every declared URI resolves to non-empty content", () => {
  // A missing resource file must fail loudly rather than surface as an empty
  // resource at runtime — an agent handed a blank page has no way to tell it
  // from a document that says nothing.
  for (const def of RESOURCES) {
    expect({ uri: def.uri, length: readResource(def).length }).toMatchObject({
      length: expect.any(Number),
    });
    expect(readResource(def).trim().length).toBeGreaterThan(0);
  }
});

test("every resource file is inside a published files entry", () => {
  // Served from the installed package's own files, never fetched at runtime.
  const shipped = manifest.files as string[];
  for (const def of RESOURCES) {
    expect({ file: def.file, shipped }).toMatchObject({
      shipped: expect.arrayContaining([def.file.split("/")[0]!]),
    });
  }
});

test("the shipped docs are the committed docs, byte for byte", () => {
  // The freshness check in CI is what keeps this true; the test is what makes
  // a stale copy fail before the push.
  for (const name of SERVED_DOCS) {
    expect({ name, same: true }).toMatchObject({
      same:
        readFileSync(join(repo, "docs", name), "utf8") ===
        readFileSync(join(repo, "packages/visimark-mcp/docs", name), "utf8"),
    });
  }
});

test("the shipped skill is what the generator produces from SKILL.md", () => {
  const source = readFileSync(join(repo, "skills/visimark/SKILL.md"), "utf8");
  const shipped = readFileSync(join(repo, "packages/visimark-mcp/skill.md"), "utf8");
  expect(shipped).toBe(renderSkill(source));
});

test("the generated skill speaks in tools and resource URIs, not in clone paths", () => {
  const shipped = readFileSync(join(repo, "packages/visimark-mcp/skill.md"), "utf8");
  expect(shipped).toContain("visimark_check");
  expect(shipped).toContain("visimark://cli-reference");
  // "Running it" was rewritten for a reader who does not have the repository.
  expect(shipped).not.toContain("bun src/cli/main.ts");
  expect(shipped).not.toContain("(../../docs/cli-reference.md)");
  // and the frontmatter is still the first thing in the file
  expect(shipped.startsWith("---\nname: visimark\n")).toBe(true);
});

test("resourceFor answers by URI and nothing else", () => {
  expect(resourceFor("visimark://skill")?.name).toBe("skill");
  expect(resourceFor("visimark://nope")).toBeUndefined();
});

test("there are two prompts, and the probe is not a third", () => {
  // A prompt earns its place when it encodes an ordering the agent gets wrong
  // unsupplied. The change-an-input probe is a step inside both of these;
  // splitting it out invites an agent to treat it as optional.
  expect(PROMPTS.map((p) => p.name)).toEqual(["visimark/take-over", "visimark/author"]);
});

test("take-over runs infer first and ends on the probe", () => {
  const body = promptFor("visimark/take-over")!.render({ path: "quote.md" });
  expect(body).toContain("`quote.md`");
  expect(body.indexOf("visimark_infer")).toBeLessThan(body.indexOf("visimark_check"));
  expect(body).toContain("Change one input");
});

test("author states the authoring order and ends on the probe", () => {
  const body = promptFor("visimark/author")!.render({ subject: "an invoice" });
  const order = ["The table", "The `vmark` block", "The anchors", "The prose", "visimark_fmt"];
  let at = -1;
  for (const step of order) {
    const next = body.indexOf(step);
    expect({ step, ordered: next > at }).toMatchObject({ ordered: true });
    at = next;
  }
  expect(body).toContain("change one input");
});

test("a prompt renders without its optional arguments", () => {
  for (const p of PROMPTS) {
    expect(p.render({}).length).toBeGreaterThan(0);
    expect(p.arguments.every((a) => !a.required)).toBe(true);
  }
});
