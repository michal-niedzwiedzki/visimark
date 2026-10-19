import { GlobalRegistrator } from "@happy-dom/global-registrator";

// The CodeMirror-backed command tests mount an `EditorView` on
// `document.body`. Joplin's editor is a DOM, so these tests get one too;
// registered once, before any test file in this workspace runs.
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register();
}
