import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import visimark from "../src/index.js";

/**
 * Joplin renders with `typographer`, `breaks` and `linkify` following user
 * settings (#378). This pins what each does to the marks. It pins, it does not
 * fix: a value typographer rewrites is left unmarked, as the README's "another
 * markdown-it plugin has rewritten" rule says, and never flagged as disagreeing.
 */
const doc = [
  'Label **Q3 -- "final"**<!--vmark=s.label--> and total **12.50**<!--vmark=s.total--> line',
  "next line www.example.com",
  "",
  "```vmark #s",
  'label = "Q3 -- \\"final\\""',
  "total precision 2 = 10 + 2.5",
  "```",
  "",
].join("\n");

const combos = [
  {},
  { typographer: true },
  { breaks: true },
  { linkify: true },
  { typographer: true, breaks: true, linkify: true },
];
const render = (o: object): string =>
  new MarkdownIt({ html: true, ...o }).use(visimark).render(doc);

for (const o of combos) {
  const typographer = "typographer" in o;
  test(`A12 ${JSON.stringify(o)}`, () => {
    const html = render(o);
    expect(html).toContain('<strong class="visimark-computed" data-vmark="s.total">12.50</strong>');
    expect(html).toContain('data-vmark-info="#s"');
    expect(html).not.toContain("visimark-disagrees");
    if (typographer) {
      expect(html).toContain("<strong>Q3 – “final”</strong>");
      expect(html).not.toContain('data-vmark="s.label"');
    } else {
      expect(html).toContain(
        '<strong class="visimark-computed" data-vmark="s.label">Q3 -- &quot;final&quot;</strong>',
      );
    }
  });
}
