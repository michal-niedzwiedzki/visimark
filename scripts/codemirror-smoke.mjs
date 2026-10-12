// Library smoke for codemirror-visimark, run by ci.yml's smoke-node (peer
// floor) and smoke-bun (latest peers) from a scratch project that installed
// the *packed* tarball. It renders a real EditorView under happy-dom: the
// marks appear, refresh recomputes, and lint reports the one STALE with a
// span. The ./highlight subpath (#367) tokenizes a vmark line without
// @codemirror/lang-markdown. Anything else is a broken artifact.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

const { EditorState } = await import("@codemirror/state");
const { EditorView } = await import("@codemirror/view");
const { forEachDiagnostic, forceLinting } = await import("@codemirror/lint");
const { visimark, refresh } = await import("codemirror-visimark");
const { visimarkLint } = await import("codemirror-visimark/lint");
const { ensureSyntaxTree } = await import("@codemirror/language");
const { isVmarkFence, visimarkLanguage } = await import("codemirror-visimark/highlight");

const doc =
  "# smoke\n\n```vmark #s\na = 2\nb = a * 3\nc = a + 1\n```\n\nB is **6**<!--vmark=s.b--> and C is **4**<!--vmark=s.c-->.\n";

const view = new EditorView({
  state: EditorState.create({
    doc,
    extensions: [visimark({ recompute: "on-refresh" }), visimarkLint()],
  }),
  parent: document.body,
});
view.dispatch({ effects: refresh.of(null) });
await new Promise((r) => setTimeout(r, 20));
forceLinting(view);
await new Promise((r) => setTimeout(r, 20));

const marks = view.dom.querySelectorAll(".visimark-computed").length;
const disagrees = view.dom.querySelectorAll(".visimark-disagrees").length;
let diagnostics = 0;
forEachDiagnostic(view.state, () => diagnostics++);
view.destroy();

if (marks !== 2 || disagrees !== 1 || diagnostics !== 1) {
  console.error(
    `::error::codemirror-visimark: ${marks} marks, ${disagrees} disagrees, ${diagnostics} diagnostics; expected 2, 1, 1`,
  );
  process.exit(1);
}
const line = "total = SUM(Net)";
const tree = ensureSyntaxTree(
  EditorState.create({ doc: line, extensions: [visimarkLanguage] }),
  line.length,
  5000,
);
const fn = tree?.resolveInner(9, 1);
if (
  !isVmarkFence("vmark #s") ||
  fn?.name !== "variableName.function" ||
  fn.from !== 8 ||
  fn.to !== 11
) {
  console.error(
    `::error::codemirror-visimark/highlight: SUM is ${fn?.name} at ${fn?.from}-${fn?.to}; expected variableName.function at 8-11`,
  );
  process.exit(1);
}
console.log(
  `codemirror-visimark ok — ${marks} marks, ${disagrees} disagrees, ${diagnostics} diagnostic, highlight ok`,
);
await GlobalRegistrator.unregister();
