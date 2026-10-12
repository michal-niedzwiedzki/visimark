import { Annotation, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { search, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { isVmarkFence, visimarkLanguage } from "codemirror-visimark/highlight.js";
import { VMARK_PALETTE } from "./highlight-palette.js";

/**
 * The editor (#360): CodeMirror 6, bundled, behind the same small surface the
 * store, pipeline and panels used to call on CodeMirror 5 — so none of them,
 * and none of their test fakes, had to learn a new editor.
 *
 * **A file switch is a fresh state, not an edit.** `load` starts a new
 * history, so undo after switching files cannot restore the previous file's
 * text into this one (CodeRabbit, #364). CodeMirror 5 shared one history
 * across switches; that was a bug, not a feature to keep.
 *
 * **`setValue` replaces only what changed.** `fmt` and infer hand back the
 * whole document; replacing it whole would drop the cursor to the top and
 * every mark with it. The longest common prefix and suffix bound the one
 * replacement, so the cursor and the marks map across it.
 *
 * **Search is CodeMirror's own.** CodeMirror 6 renders only the lines in
 * view, so the browser's find can miss text off screen; Ctrl/Cmd+F opens a
 * panel that sees the whole document.
 */

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorPort {
  getValue(): string;
  setValue(text: string): void;
  /**
   * Show a different document: a fresh editor state, so undo cannot reach
   * back into the file that was showing before. Reports no change — nothing
   * was edited.
   */
  load(text: string): void;
  getCursor(): EditorPosition;
  setCursor(pos: EditorPosition): void;
  getScrollInfo(): { top: number; height: number; clientHeight: number };
  scrollTo(x: number | null, y: number): void;
  on(event: "scroll", handler: () => void): void;
  on(event: "change", handler: (instance: EditorPort, change: { origin?: string }) => void): void;
  /** `aria-label` on the editable surface — the one assistive tech reads. */
  setLabel(text: string): void;
  /** Recompute the marks (and, later, the diagnostics) for the text now showing. */
  refreshMarks(): void;
}

export interface EditorSetup {
  readonly extensions?: readonly Extension[];
  readonly refresh?: (view: EditorView) => void;
}

const programmatic = Annotation.define<boolean>();

export function minimalChange(
  from: string,
  to: string,
): { from: number; to: number; insert: string } | null {
  if (from === to) return null;
  const max = Math.min(from.length, to.length);
  let start = 0;
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let endFrom = from.length;
  let endTo = to.length;
  while (
    endFrom > start &&
    endTo > start &&
    from.charCodeAt(endFrom - 1) === to.charCodeAt(endTo - 1)
  ) {
    endFrom--;
    endTo--;
  }
  return { from: start, to: endFrom, insert: to.slice(start, endTo) };
}

/** Today's dark editor, as the `.CodeMirror*` rules in playground.html had it. */
const theme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "transparent", color: "#e6e6e6", fontSize: "0.82rem" },
    ".cm-scroller": {
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
      lineHeight: "1.55",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      color: "#5c5c5c",
    },
    ".cm-cursor": { borderLeftColor: "#ff453a" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(255, 69, 58, 0.25)",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: tags.heading, color: "#7ee787" },
  { tag: tags.comment, color: VMARK_PALETTE.comment },
  { tag: [tags.url, tags.link, tags.monospace], color: "#79c0ff" },
  { tag: tags.list, color: "#ffb454" },
  // the inside of a vmark fence (#367)
  { tag: [tags.keyword, tags.operatorKeyword, tags.atom], color: VMARK_PALETTE.keyword },
  { tag: [tags.function(tags.variableName), tags.typeName], color: VMARK_PALETTE.callable },
  { tag: [tags.number, tags.literal, tags.unit], color: VMARK_PALETTE.literal },
  { tag: tags.string, color: VMARK_PALETTE.text, fontStyle: "italic" },
  { tag: tags.definition(tags.variableName), color: VMARK_PALETTE.text, fontWeight: "600" },
]);

export function createEditor(
  textarea: HTMLTextAreaElement,
  setup: EditorSetup = {},
): EditorPort & { readonly view: EditorView } {
  const changeHandlers: ((i: EditorPort, c: { origin?: string }) => void)[] = [];
  let port: EditorPort & { readonly view: EditorView };

  const listener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    const origin = update.transactions.some((tr) => tr.annotation(programmatic) === true)
      ? "setValue"
      : "+input";
    for (const handler of changeHandlers) handler(port, { origin });
  });

  const extensions: Extension[] = [
    lineNumbers(),
    history(),
    search(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.lineWrapping,
    markdown({
      base: markdownLanguage,
      codeLanguages: (info) => (isVmarkFence(info) ? visimarkLanguage : null),
    }),
    syntaxHighlighting(highlight),
    theme,
    ...(setup.extensions ?? []),
    listener,
  ];
  const view = new EditorView({
    state: EditorState.create({ doc: textarea.value, extensions }),
    parent: textarea.parentElement ?? document.body,
  });
  textarea.remove();

  port = {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      const change = minimalChange(view.state.doc.toString(), text);
      if (change === null) return;
      view.dispatch({ changes: change, annotations: programmatic.of(true) });
    },
    load(text) {
      view.setState(EditorState.create({ doc: text, extensions }));
    },
    getCursor() {
      const head = view.state.selection.main.head;
      const line = view.state.doc.lineAt(head);
      return { line: line.number - 1, ch: head - line.from };
    },
    setCursor(pos) {
      const doc = view.state.doc;
      const line = doc.line(Math.min(Math.max(pos.line + 1, 1), doc.lines));
      view.dispatch({
        selection: { anchor: line.from + Math.min(Math.max(pos.ch, 0), line.length) },
      });
    },
    getScrollInfo: () => ({
      top: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      clientHeight: view.scrollDOM.clientHeight,
    }),
    scrollTo(_x, y) {
      view.scrollDOM.scrollTop = y;
    },
    on(event: "scroll" | "change", handler: (...args: never[]) => void) {
      if (event === "scroll") view.scrollDOM.addEventListener("scroll", handler as () => void);
      else changeHandlers.push(handler as (i: EditorPort, c: { origin?: string }) => void);
    },
    setLabel(text) {
      view.contentDOM.setAttribute("aria-label", text);
    },
    refreshMarks() {
      setup.refresh?.(view);
    },
  };
  return port;
}
