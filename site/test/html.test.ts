import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") GlobalRegistrator.register();

import { expect, test } from "bun:test";
import { setTrustedHtml } from "../src/html.js";

// setTrustedHtml must leave an element exactly as `innerHTML = s` would —
// it exists to change the pattern the scanner flags, not what reaches the
// page (see the boundary comment in ../src/html.ts).

test("matches innerHTML for a marked-style block", () => {
  // Already in the form an HTML serializer writes, so what `innerHTML = s`
  // would leave is `s` itself — compared without an `innerHTML` write, which
  // the scanner gate (lint:scanner) refuses in tests too.
  const s =
    "<h2>T</h2><table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>";
  const el = document.createElement("div");
  setTrustedHtml(el, s);
  expect(el.innerHTML).toBe(s);
});

test("keeps the SVG namespace", () => {
  const el = document.createElement("div");
  setTrustedHtml(el, '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
  expect(el.querySelector("svg")!.namespaceURI).toBe("http://www.w3.org/2000/svg");
});

test("text-only string becomes a text node", () => {
  const el = document.createElement("div");
  setTrustedHtml(el, "plain &amp; simple");
  expect(el.textContent).toBe("plain & simple");
  expect(el.childNodes.length).toBe(1);
});

test("replaces existing children", () => {
  const el = document.createElement("div");
  setTrustedHtml(el, "<p>a</p>");
  setTrustedHtml(el, "<p>b</p>");
  expect(el.innerHTML).toBe("<p>b</p>");
});

test("empty string clears", () => {
  const el = document.createElement("div");
  setTrustedHtml(el, "<p>a</p>");
  setTrustedHtml(el, "");
  expect(el.childNodes.length).toBe(0);
});

test("script is inert", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  setTrustedHtml(el, "<script>globalThis.__ran = true</script>");
  expect(el.querySelector("script")).not.toBeNull();
  expect((globalThis as Record<string, unknown>).__ran).toBeUndefined();
  el.remove();
});
