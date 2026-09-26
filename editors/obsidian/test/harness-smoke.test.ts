import { expect, test } from "bun:test";

test("the obsidian module resolves to the harness stub", async () => {
  const obsidian = await import("obsidian");
  expect(obsidian.Platform.isMacOS).toBe(false);
});

test("happy-dom provides a document", () => {
  const el = document.createElement("div");
  expect(el.tagName).toBe("DIV");
});
