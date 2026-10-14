// Library smoke for markdown-it-visimark, run by ci.yml's smoke-node and
// smoke-bun from a scratch project that installed the *packed* tarball and
// one markdown-it version (13.0.2, the version Joplin's renderer pins; 14.3.2,
// the version VS Code's built-in Markdown extension locks; and latest). It
// renders the spec's fixture and expects the marks and the fence attribute.
// Anything else is a broken artifact.
import MarkdownIt from "markdown-it";
import visimark from "markdown-it-visimark";

const fixture = [
  "Total **12.50**<!--vmark=s.total-->, subtotal 10.00<!--vmark=s.sub--> and tax `2.50`<!--vmark=s.tax-->.",
  "",
  "| Item | Qty | Net |",
  "|------|----:|----:|",
  "| pen  |  2  | 10.00 |",
  "",
  "```vmark #s",
  "Net precision 2 = Qty * 5",
  "sub precision 2 = SUM(Net)",
  "tax precision 2 = sub * 0.25",
  "total precision 2 = sub + tax",
  "```",
  "",
].join("\n");

const html = new MarkdownIt({ html: true }).use(visimark).render(fixture);
const want = [
  'class="visimark-computed"',
  'data-vmark="s.total"',
  'data-vmark="s.sub"',
  'data-vmark-info="#s"',
];
const missing = want.filter((w) => !html.includes(w));
if (missing.length > 0) {
  console.error(`::error::markdown-it-visimark: missing ${missing.join(", ")} in:\n${html}`);
  process.exit(1);
}
console.log("markdown-it-visimark ok");
