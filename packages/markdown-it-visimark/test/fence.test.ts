import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import visimark from "../src/index.js";
import { injectInfo, vmarkInfo } from "../src/fence.js";

if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

const fence = (info: string, body = "a = 1\n"): string => "```" + info + "\n" + body + "```\n";
const md = (
  opts: ConstructorParameters<typeof MarkdownIt>[0] = { html: true },
): InstanceType<typeof MarkdownIt> => new MarkdownIt(opts).use(visimark);

test("vmarkInfo takes the rest of the info string after the word vmark", () => {
  expect(vmarkInfo("vmark #order from rows.csv labelled Item, Qty")).toBe(
    "#order from rows.csv labelled Item, Qty",
  );
  expect(vmarkInfo("vmark")).toBe("");
  expect(vmarkInfo("vmark   #s")).toBe("#s");
  expect(vmarkInfo("vmarkx #s")).toBeNull();
  expect(vmarkInfo("js")).toBeNull();
});

test("the first opening tag gets the attribute; one already there is kept", () => {
  const esc = new MarkdownIt().utils.escapeHtml;
  expect(injectInfo('<pre><code class="language-vmark">x</code></pre>\n', "#s", esc)).toBe(
    '<pre data-vmark-info="#s"><code class="language-vmark">x</code></pre>\n',
  );
  expect(injectInfo('<pre class="hljs"><code>x</code></pre>', "#s", esc)).toBe(
    '<pre class="hljs" data-vmark-info="#s"><code>x</code></pre>',
  );
  expect(injectInfo('<pre data-vmark-info="#t"><code>x</code></pre>', "#s", esc)).toBe(
    '<pre data-vmark-info="#t"><code>x</code></pre>',
  );
  expect(injectInfo("<div>x</div>", "#s", esc)).toBe("<div>x</div>");
});

test("escaping round-trips through an HTML parser", () => {
  const out = md().render(fence(`vmark #s "a<b>&'"`));
  expect(out).toContain(`data-vmark-info="#s &quot;a&lt;b&gt;&amp;'&quot;"`);
  const host = document.createElement("div");
  host.innerHTML = out;
  expect(host.querySelector("pre")!.getAttribute("data-vmark-info")).toBe(`#s "a<b>&'"`);
});

test("a highlight callback that returns its own <pre> still gets the attribute", () => {
  const out = md({ html: true, highlight: () => '<pre class="hl"><code>x</code></pre>' }).render(
    fence("vmark #s"),
  );
  expect(out.startsWith('<pre class="hl" data-vmark-info="#s">')).toBe(true);
});

test("a fence that is not vmark, and html: false, are untouched", () => {
  expect(md().render(fence("js"))).toBe(new MarkdownIt({ html: true }).render(fence("js")));
  expect(md({ html: false }).render(fence("vmark #s"))).toBe(
    new MarkdownIt({ html: false }).render(fence("vmark #s")),
  );
});

test("a fence rule replaced before this plugin is called, not lost", () => {
  const m = new MarkdownIt({ html: true });
  const prev = m.renderer.rules.fence!;
  m.renderer.rules.fence = (t, i, o, e, s) => '<div class="wrap">' + prev(t, i, o, e, s) + "</div>";
  m.use(visimark);
  // first tag is <div>, so the spec says: unchanged
  expect(m.render(fence("vmark #s"))).not.toContain("data-vmark-info");
});
