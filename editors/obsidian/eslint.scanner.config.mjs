import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// The Obsidian community portal reads the root manifest.json, so its scanner
// lints this whole repository as if it were the plugin. Its Scorecard for
// 0.4.0 read Failed on two Error rules, both in site/, which nothing in CI
// linted (#402). This config is that gate: `bun run lint:scanner` runs it,
// from the repository root, over every tracked JS/TS file.
//
// Two rules, not the full ruleset. The scanner runs type-aware rules with a
// setup this repository cannot reproduce: the full typed
// `recommended`, run over the repository, reports 26 Errors the Scorecard does not
// list. So this checks exactly the rules that failed it. When
// eslint-plugin-obsidianmd is bumped, read the next Scorecard for new Error
// rules and add them here.
//
// The file set is a superset of the scanner's (everything tracked except the
// committed bundles in docs/vendor/), so CI is never more lenient than it,
// whatever it skips.
//
// The plugin objects and the parser come from obsidianmd's own `recommended`
// config rather than imports by name: eslint-plugin-no-unsanitized is that
// plugin's dependency, not this package's, and this workspace's own
// typescript-eslint refuses the repository's TypeScript 7, while the copy
// obsidianmd bundles brings its own TypeScript.

const recommended = obsidianmd.configs.recommended;
const plugins = Object.assign({}, ...recommended.map((c) => c.plugins ?? {}));
const parser = recommended.find((c) => c.languageOptions?.parser)?.languageOptions.parser;

export default defineConfig([
  { ignores: ["docs/vendor/**"] },
  {
    files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
    languageOptions: { parser },
    plugins: {
      "no-unsanitized": plugins["no-unsanitized"],
      obsidianmd: plugins.obsidianmd,
    },
    rules: {
      "no-unsanitized/property": "error",
      "obsidianmd/no-static-styles-assignment": "error",
    },
  },
]);
