// The three libraries docs/playground.html loads from a CDN, typed only as
// far as this application actually uses them.
//
// They are deliberately *not* dependencies: the page loads them as plain
// `<script src>` tags with SRI hashes, so they arrive as globals rather than
// as modules, and pulling their real `@types` packages in would add two
// devDependencies whose only consumer is a page that never imports them. A
// hand-written surface is smaller, and — unlike `any` — it still fails the
// typecheck when a call site drifts from the API.

/** CodeMirror 5's editor handle — the members this playground calls. */
interface CodeMirrorEditor {
  getValue(): string;
  setValue(text: string): void;
  getCursor(): CodeMirrorPosition;
  setCursor(pos: CodeMirrorPosition): void;
  getScrollInfo(): { top: number; height: number; clientHeight: number };
  scrollTo(x: number | null, y: number): void;
  on(event: "scroll", handler: () => void): void;
  on(
    event: "change",
    handler: (instance: CodeMirrorEditor, change: { origin?: string }) => void,
  ): void;
  getInputField(): HTMLTextAreaElement;
}

interface CodeMirrorPosition {
  line: number;
  ch: number;
}

declare const CodeMirror: {
  fromTextArea(textarea: HTMLTextAreaElement, options: Record<string, unknown>): CodeMirrorEditor;
};

declare const marked: { parse(markdown: string): string };

declare const confetti: ((options: Record<string, unknown>) => void) | undefined;
