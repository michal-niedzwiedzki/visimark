import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { mock } from "bun:test";
import * as harness from "./obsidian.js";

// `main.ts` and its dependents call `document.createElement`, dispatch DOM
// events and read `HTMLElement` properties; happy-dom is the DOM none of
// that has without it. Registered globally, once, before any test file in
// this workspace runs — `bunfig.toml`'s `[test].preload` is what guarantees
// that ordering.
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register();
}

/**
 * `addClass`/`removeClass`/`toggleClass`/`empty`/`setAttr`/`createEl`/
 * `createDiv`/`createSpan` are Obsidian's own additions to every
 * `HTMLElement`'s prototype (`obsidian.d.ts`'s global augmentation), not
 * standard DOM — real Obsidian installs them once at startup, and happy-dom
 * has never heard of them. Installed once, guarded the same way the
 * registrator above is, since a preload can in principle run more than once
 * per process.
 */
interface DomElementInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
}

function installObsidianDomExtensions(): void {
  const proto = globalThis.HTMLElement.prototype as HTMLElement & {
    addClass?: unknown;
  };
  if (proto.addClass !== undefined) return;

  Object.assign(globalThis.HTMLElement.prototype, {
    getText(this: HTMLElement): string {
      return this.textContent ?? "";
    },
    setText(this: HTMLElement, value: string): void {
      this.textContent = value;
    },
    addClass(this: HTMLElement, ...cls: string[]): void {
      this.classList.add(...cls);
    },
    removeClass(this: HTMLElement, ...cls: string[]): void {
      this.classList.remove(...cls);
    },
    toggleClass(this: HTMLElement, cls: string | string[], force?: boolean): void {
      for (const c of Array.isArray(cls) ? cls : [cls]) this.classList.toggle(c, force);
    },
    empty(this: HTMLElement): void {
      while (this.firstChild) this.removeChild(this.firstChild);
    },
    setAttr(this: HTMLElement, name: string, value: string | number | boolean | null): void {
      if (value === null) this.removeAttribute(name);
      else this.setAttribute(name, String(value));
    },
    createEl(this: HTMLElement, tag: string, info?: DomElementInfo | string): HTMLElement {
      const el = document.createElement(tag);
      const opts = typeof info === "string" ? { text: info } : info;
      if (opts?.cls !== undefined) {
        for (const c of Array.isArray(opts.cls) ? opts.cls : [opts.cls]) el.classList.add(c);
      }
      if (opts?.text !== undefined) el.textContent = opts.text;
      if (opts?.attr !== undefined) {
        for (const [name, value] of Object.entries(opts.attr)) {
          if (value !== null) el.setAttribute(name, String(value));
        }
      }
      this.appendChild(el);
      return el;
    },
    createDiv(this: HTMLElement, info?: DomElementInfo | string): HTMLElement {
      return (this as unknown as { createEl: typeof HTMLElement.prototype.createEl }).createEl(
        "div",
        info,
      );
    },
    createSpan(this: HTMLElement, info?: DomElementInfo | string): HTMLElement {
      return (this as unknown as { createEl: typeof HTMLElement.prototype.createEl }).createEl(
        "span",
        info,
      );
    },
  });

  // `reading-mode.ts` reads `el.doc` as Obsidian's own alias for `ownerDocument`
  Object.defineProperty(globalThis.HTMLElement.prototype, "doc", {
    configurable: true,
    get(this: HTMLElement) {
      return this.ownerDocument;
    },
  });
}

installObsidianDomExtensions();

// Every import of the bare specifier "obsidian" in this workspace's test run
// resolves to the stub instead of failing to find a real module — this is
// the one thing that makes `import "../src/main.js"` loadable under
// `bun test` at all (row 12: "there is no bun test harness that can load the
// real obsidian module and call onload").
mock.module("obsidian", () => harness);
