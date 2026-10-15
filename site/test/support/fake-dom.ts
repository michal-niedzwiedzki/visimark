// Just enough DOM to run one module at a time.
//
// Follow-up review §2.7: four assertions in a11y.test.ts had become
// change-detectors — `expect(tabs).toContain('tab.setAttribute("aria-selected",
// String(active))')` passes a behaviour change that keeps the string and fails
// a rename that keeps the behaviour. The review pointed at store.test.ts's
// hand-rolled fake editor as the cheap way out, and this is the same idea one
// size up: a fake with only the members the modules under test actually touch,
// so `tabs.ts` and `quest.ts` can be driven rather than grepped.
//
// It is deliberately small and deliberately not a DOM. Nothing here lays out,
// nothing bubbles, and a selector is one class plus at most one attribute —
// which is every selector these modules use. If a module needs more than this,
// that is worth noticing rather than working around.

/** The subset of a CSS selector this fake understands: `.cls`, optionally
 *  narrowed by `[attr="value"]`. */
function matches(el: FakeElement, selector: string): boolean {
  const m = /^\.([\w-]+)(?:\[([\w-]+)="([^"]*)"\])?$/.exec(selector.trim());
  if (!m) throw new Error(`fake-dom: unsupported selector ${selector}`);
  if (!el.classList.contains(m[1]!)) return false;
  if (m[2] === undefined) return true;
  return el.getAttribute(m[2]) === m[3];
}

class FakeClassList {
  constructor(private readonly classes: Set<string>) {}
  add(...names: string[]): void {
    for (const n of names) this.classes.add(n);
  }
  remove(...names: string[]): void {
    for (const n of names) this.classes.delete(n);
  }
  toggle(name: string, force?: boolean): void {
    const on = force ?? !this.classes.has(name);
    if (on) this.classes.add(name);
    else this.classes.delete(name);
  }
  contains(name: string): boolean {
    return this.classes.has(name);
  }
  get value(): string {
    return [...this.classes].join(" ");
  }
}

export class FakeElement {
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  hidden = false;
  tabIndex = -1;
  /** Set by `focus()`, so "selection and focus travel together" is a thing a
   *  test can assert rather than take on trust. */
  focused = false;
  /** Whatever was last assigned to `innerHTML` — the modules here only ever
   *  clear it or hand it an SVG blob. */
  html = "";
  scrollTop = 0;
  readonly scrollHeight = 0;
  readonly offsetWidth = 0;
  private readonly classes = new Set<string>();
  private readonly attrs = new Map<string, string>();
  private readonly handlers = new Map<string, ((e: unknown) => void)[]>();
  private ownText = "";

  constructor(
    readonly tagName: string,
    private readonly doc: FakeDocument,
  ) {}

  readonly classList = new FakeClassList(this.classes);

  get className(): string {
    return this.classList.value;
  }
  set className(value: string) {
    this.classes.clear();
    for (const n of value.split(/\s+/).filter(Boolean)) this.classes.add(n);
  }

  get id(): string {
    return this.attrs.get("id") ?? "";
  }
  set id(value: string) {
    this.attrs.set("id", value);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-(.)/g, (_, c: string) => c.toUpperCase());
      return this.dataset[key] ?? null;
    }
    return this.attrs.get(name) ?? null;
  }

  get textContent(): string {
    return this.children.length === 0
      ? this.ownText
      : this.children.map((c) => c.textContent).join("");
  }
  set textContent(value: string) {
    this.children.length = 0;
    this.ownText = value;
  }

  get innerHTML(): string {
    return this.html;
  }
  set innerHTML(value: string) {
    this.children.length = 0;
    this.ownText = "";
    this.html = value;
  }

  get childNodes(): FakeElement[] {
    return this.children;
  }
  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }
  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeChild(child: FakeElement): FakeElement {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    child.parentElement = null;
    return child;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    for (const el of descendants(this)) if (matches(el, selector)) found.push(el);
    return found;
  }

  focus(): void {
    this.doc.activeElement = this;
    this.focused = true;
  }

  addEventListener(type: string, handler: (e: unknown) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Fires `type` on this element only — nothing here bubbles, because
   *  nothing under test relies on bubbling. */
  dispatch(type: string, event: Record<string, unknown> = {}): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler({ target: this, preventDefault: () => {}, stopPropagation: () => {}, ...event });
    }
  }

  click(): void {
    this.dispatch("click");
  }
}

function* descendants(root: FakeElement): Generator<FakeElement> {
  for (const child of root.children) {
    yield child;
    yield* descendants(child);
  }
}

export class FakeDocument {
  readonly body: FakeElement;
  activeElement: FakeElement | null = null;

  constructor() {
    this.body = new FakeElement("body", this);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  /** A fragment is an element whose own tag nobody looks at: it is appended
   *  and its children end up in the parent. Close enough for a test that only
   *  asks what ended up on the page. */
  createDocumentFragment(): FakeElement {
    return new FakeElement("#document-fragment", this);
  }

  getElementById(id: string): FakeElement | null {
    for (const el of descendants(this.body)) if (el.id === id) return el;
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.body.querySelectorAll(selector);
  }

  /** Creates an element, gives it an id and classes, and parents it — the
   *  three things every fixture here needs. */
  add(tagName: string, id: string, className = "", parent: FakeElement = this.body): FakeElement {
    const el = this.createElement(tagName);
    el.id = id;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }
}

interface Installed {
  document: FakeDocument;
  /** Puts the real globals back. Call it from `afterEach`. */
  restore(): void;
}

/**
 * Installs a fake `document`, `window` and `requestAnimationFrame` as globals.
 *
 * The modules under test reach for these directly, the way page code does, so
 * this is what lets them run under `bun test` — which has no DOM and, for
 * nineteen twentieths of this repository, needs none.
 */
export function installFakeDom(): Installed {
  const g = globalThis as Record<string, unknown>;
  const before = {
    document: g.document,
    window: g.window,
    requestAnimationFrame: g.requestAnimationFrame,
  };
  const doc = new FakeDocument();
  g.document = doc;
  g.window = {
    // Nothing here has asked for less movement; the tests that care about
    // reduced motion set their own.
    matchMedia: () => ({ matches: false }),
    innerWidth: 1280,
    innerHeight: 800,
  };
  // Immediate rather than scheduled: `revealFadeIn` uses it only to commit a
  // frame before adding a class, which a test has no paint to wait for.
  g.requestAnimationFrame = (fn: () => void) => {
    fn();
    return 0;
  };
  return {
    document: doc,
    restore() {
      g.document = before.document;
      g.window = before.window;
      g.requestAnimationFrame = before.requestAnimationFrame;
    },
  };
}
