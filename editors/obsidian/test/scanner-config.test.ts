import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ESLint } from "eslint";

// eslint.scanner.config.mjs is the CI gate for the two rules that turned the
// community scanner's Scorecard to Failed (#402). These prove it still bites:
// a config that silently stopped reporting would pass `lint:scanner` forever.

const ROOT = join(import.meta.dir, "../../..");
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: "editors/obsidian/eslint.scanner.config.mjs",
});
const PROBE = join(ROOT, "site/src/probe.ts");

async function messages(code: string): Promise<{ ruleId: string | null; severity: number }[]> {
  const [result] = await eslint.lintText(code, { filePath: PROBE });
  return result!.messages.map(({ ruleId, severity }) => ({ ruleId, severity }));
}

describe("the scanner gate", () => {
  test("flags an innerHTML assignment", async () => {
    expect(
      await messages(
        "declare const el: HTMLElement; declare const html: string; el.innerHTML = html;",
      ),
    ).toEqual([{ ruleId: "no-unsanitized/property", severity: 2 }]);
  });

  test("flags a static style", async () => {
    expect(await messages('declare const el: HTMLElement; el.style.left = "-9999px";')).toEqual([
      { ruleId: "obsidianmd/no-static-styles-assignment", severity: 2 },
    ]);
  });

  test("accepts setTrustedHtml", async () => {
    const code = [
      "function setTrustedHtml(el: Element, html: string): void {",
      '  el.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes);',
      "}",
      "declare const el: HTMLElement; declare const html: string;",
      "setTrustedHtml(el, html);",
    ].join("\n");
    expect(await messages(code)).toEqual([]);
  });

  test("ignores docs/vendor", async () => {
    expect(await eslint.isPathIgnored(join(ROOT, "docs/vendor/x.js"))).toBe(true);
  });
});
