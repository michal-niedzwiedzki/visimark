# visimark-editor-shared

Editor logic that the Obsidian plugin (`editors/obsidian`) and the Joplin
plugin (`editors/joplin`) share: where the cursor is, what Infer would add,
the repair plan, the formula tooltip line, the templates and the sweep. Nothing
here imports a host API.

The package is private and has no version. It has no build either: each plugin
resolves `visimark-editor-shared/*` to `src/*` and bundles it from source, so
neither published artifact gains a dependency. Spec:
[`chore-bring-joplin-plugin-visimark-to-spec.md`](../../docs/design/chore-bring-joplin-plugin-visimark-to-spec.md)
§2.1.

`src/templates.ts` is generated from `templates/*.md`. Edit the Markdown and
run `bun run gen:editor-templates`; `test/templates.test.ts` fails on a diff.

<!--vmark:no-formulas-->
