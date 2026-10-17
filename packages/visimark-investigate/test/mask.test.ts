import { describe, expect, test } from "bun:test";
import { maskMarkdown } from "../src/mask.js";

const newlineOffsets = (s: string): number[] => [...s].flatMap((c, i) => (c === "\n" ? [i] : []));

const regions = [
  "---",
  "title: x",
  "---",
  "# Heading",
  "",
  "```markdown",
  "| a | 1 |",
  "```",
  "",
  "~~~",
  "| b | 2 |",
  "~~~",
  "",
  "    | indented | 3 |",
  "",
  "<!-- a comment",
  "| c | 4 | -->",
  "> | quoted | 5 |",
  "",
  "kept text",
].join("\n");

describe("maskMarkdown", () => {
  test("keeps length and newline offsets", () => {
    const masked = maskMarkdown(regions);
    expect(masked.length).toBe(regions.length);
    expect(newlineOffsets(masked)).toEqual(newlineOffsets(regions));
  });

  test("masks ``` and ~~~ fences", () => {
    const masked = maskMarkdown(regions);
    expect(masked).not.toContain("| a | 1 |");
    expect(masked).not.toContain("| b | 2 |");
    expect(masked).not.toContain("```");
    expect(masked).not.toContain("~~~");
  });

  test("masks an unclosed fence to end of file", () => {
    const text = "intro\n```\n| a | 1 |\n|---|---|\n| b | 2 |\n";
    const masked = maskMarkdown(text);
    expect(masked.slice(0, 5)).toBe("intro");
    expect(masked.slice(6).replace(/\n/g, "").trim()).toBe("");
  });

  test("masks indented code, HTML comments, front matter, blockquote lines", () => {
    const masked = maskMarkdown(regions);
    expect(masked).not.toContain("indented");
    expect(masked).not.toContain("| c | 4 |");
    expect(masked).not.toContain("<!--");
    expect(masked).not.toContain("title: x");
    expect(masked).not.toContain("quoted");
    expect(masked).toContain("# Heading");
    expect(masked).toContain("kept text");
  });

  test("leaves <details> content and list-item tables readable", () => {
    const text =
      "<details>\n\n| a | 1 |\n|---|---|\n\n</details>\n\n- item\n\n  | b | 2 |\n  |---|---|\n";
    expect(maskMarkdown(text)).toBe(text);
  });

  test("CRLF: \\r survives outside regions, same length", () => {
    const text = "| a | 1 |\r\n|---|---|\r\n```\r\nx\r\n```\r\n";
    const masked = maskMarkdown(text);
    expect(masked.length).toBe(text.length);
    expect(masked.startsWith("| a | 1 |\r\n|---|---|\r\n")).toBe(true);
    expect(masked).not.toContain("```");
  });
});
